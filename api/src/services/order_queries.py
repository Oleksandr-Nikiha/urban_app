from typing import Any

import asyncpg
from fastapi import HTTPException

from src.db.cart_repo import get_or_create_cart_id
from src.schemas.order import (
    OrderGroupOut,
    OrderItemOptionOut,
    OrderItemOut,
    OrderOut,
    RepeatOrderOut,
)
from src.services.cart_helpers import build_options_key
from src.services.cart_service import _fetch_cart


async def fetch_orders_batch(
    conn: asyncpg.Connection, order_rows: list[asyncpg.Record]
) -> list[OrderOut]:
    """
    Пакетна вибірка деталей для списку замовлень (усуває проблему N+1 запитів).
    Виконує рівно 3 запити (groups, items, options) незалежно від кількості замовлень.
    """
    if not order_rows:
        return []

    order_ids = [r["id"] for r in order_rows]

    groups_rows = await conn.fetch(
        """
        SELECT og.id, og.order_id, og.location_id,
               loc.name AS location_name, og.status, og.subtotal
        FROM order_groups og
        JOIN locations loc ON loc.id = og.location_id
        WHERE og.order_id = ANY($1::int[])
        ORDER BY og.id
        """,
        order_ids,
    )

    group_ids = [g["id"] for g in groups_rows]
    items_rows = []
    if group_ids:
        items_rows = await conn.fetch(
            """
            SELECT id, order_group_id, variant_id, product_name, variant_label,
                   unit_price, qty, subtotal
            FROM order_items
            WHERE order_group_id = ANY($1::int[])
            ORDER BY id
            """,
            group_ids,
        )

    item_ids = [i["id"] for i in items_rows]
    options_rows = []
    if item_ids:
        options_rows = await conn.fetch(
            """
            SELECT id, order_item_id, option_group_name, option_name, price_delta, qty
            FROM order_item_options
            WHERE order_item_id = ANY($1::int[])
            ORDER BY id
            """,
            item_ids,
        )

    opts_by_item: dict[int, list[OrderItemOptionOut]] = {}
    for r in options_rows:
        opts_by_item.setdefault(r["order_item_id"], []).append(
            OrderItemOptionOut(
                id=r["id"],
                option_group_name=r["option_group_name"],
                option_name=r["option_name"],
                price_delta=float(r["price_delta"]),
                qty=r["qty"],
            )
        )

    items_by_group: dict[int, list[OrderItemOut]] = {}
    for r in items_rows:
        items_by_group.setdefault(r["order_group_id"], []).append(
            OrderItemOut(
                id=r["id"],
                variant_id=r["variant_id"],
                product_name=r["product_name"],
                variant_label=r["variant_label"],
                unit_price=float(r["unit_price"]),
                qty=r["qty"],
                subtotal=float(r["subtotal"]),
                options=opts_by_item.get(r["id"], []),
            )
        )

    groups_by_order: dict[int, list[OrderGroupOut]] = {}
    for g in groups_rows:
        target_order_id = (
            g["order_id"]
            if "order_id" in g
            else (order_ids[0] if len(order_ids) == 1 else None)
        )
        if target_order_id is not None:
            groups_by_order.setdefault(target_order_id, []).append(
                OrderGroupOut(
                    id=g["id"],
                    location_id=g["location_id"],
                    location_name=g["location_name"],
                    status=g["status"],
                    subtotal=float(g["subtotal"]),
                    items=items_by_group.get(g["id"], []),
                )
            )

    results = []
    for o in order_rows:
        results.append(
            OrderOut(
                id=o["id"],
                telegram_id=o["telegram_id"],
                status=o["status"],
                fulfillment_type=o["fulfillment_type"],
                delivery_address=o["delivery_address"],
                contact_name=o["contact_name"],
                contact_phone=o["contact_phone"],
                payment_method=o["payment_method"],
                scheduled_time=o["scheduled_time"],
                comment=o["comment"],
                total_price=float(o["total_price"]),
                bonus_spent=int(o.get("bonus_spent") or 0),
                bonus_earned=int(o.get("bonus_earned") or 0),
                created_at=o["created_at"],
                source=o.get("source") or "telegram",
                groups=groups_by_order.get(o["id"], []),
            )
        )
    return results


async def fetch_order_by_id(
    conn: asyncpg.Connection, order_id: int, telegram_id: int | None = None
) -> OrderOut | None:
    """Вибірка деталей замовлення разом із групами, позиціями та модифікаторами."""
    if telegram_id is not None:
        order_row = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                   contact_name, contact_phone, payment_method, scheduled_time,
                   comment, total_price, bonus_spent, bonus_earned, created_at, COALESCE(source, 'telegram') AS source
            FROM orders
            WHERE id = $1 AND telegram_id = $2
            """,
            order_id,
            telegram_id,
        )
    else:
        order_row = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                   contact_name, contact_phone, payment_method, scheduled_time,
                   comment, total_price, bonus_spent, bonus_earned, created_at, COALESCE(source, 'telegram') AS source
            FROM orders
            WHERE id = $1
            """,
            order_id,
        )
    if not order_row:
        return None

    orders = await fetch_orders_batch(conn, [order_row])
    return orders[0] if orders else None


async def cancel_user_order(
    conn: asyncpg.Connection,
    order_id: int,
    telegram_id: int,
) -> tuple[OrderOut, asyncpg.Record]:
    """
    Скасування замовлення клієнтом:
    - Перевіряє права доступу та статус pending_moderation (із блокуванням FOR UPDATE)
    - Переводить статус у cancelled
    Повертає (оновлене замовлення, рядок замовлення для сповіщення).
    """
    async with conn.transaction():
        order_row = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, contact_name, contact_phone, total_price
            FROM orders
            WHERE id = $1 AND telegram_id = $2
            FOR UPDATE
            """,
            order_id,
            telegram_id,
        )
        if not order_row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        if order_row["status"] != "pending_moderation":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Неможливо скасувати замовлення, оскільки воно вже обробляється "
                    "або завершено. Для скасування зателефонуйте, будь ласка, до закладу."
                ),
            )

        await conn.execute(
            "UPDATE orders SET status = 'cancelled' WHERE id = $1",
            order_id,
        )

    updated = await fetch_order_by_id(conn, order_id, telegram_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    return updated, order_row


async def repeat_user_order(
    conn: asyncpg.Connection,
    pool: asyncpg.Pool,
    order_id: int,
    telegram_id: int,
    replace_cart: bool = True,
) -> RepeatOrderOut:
    """
    Повторює раніше оформлене замовлення, додаючи його доступні позиції до кошика
    за актуальними цінами поточного меню.
    """
    async with conn.transaction():
        order_row = await conn.fetchrow(
            """
            SELECT id, telegram_id, total_price
            FROM orders
            WHERE id = $1 AND telegram_id = $2
            """,
            order_id,
            telegram_id,
        )
        if not order_row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        old_order_total = float(order_row["total_price"])

        group_rows = await conn.fetch(
            "SELECT id FROM order_groups WHERE order_id = $1",
            order_id,
        )
        if not group_rows:
            raise HTTPException(status_code=400, detail="У замовленні немає страв")

        group_ids = [g["id"] for g in group_rows]

        order_items_sql = """
            SELECT oi.id, oi.variant_id, oi.product_name, oi.variant_label, oi.qty,
                   pv.id as current_variant_id, pv.price as current_variant_price,
                   pv.is_available as pv_avail,
                   p.id as current_product_id, p.name as current_product_name,
                   p.is_available as p_avail
            FROM order_items oi
            LEFT JOIN product_variants pv ON pv.id = oi.variant_id
            LEFT JOIN products p ON p.id = pv.product_id
            WHERE oi.order_group_id = ANY($1::int[])
            ORDER BY oi.id
        """
        order_item_rows = await conn.fetch(order_items_sql, group_ids)

        order_item_ids = [r["id"] for r in order_item_rows]
        options_sql = """
            SELECT oio.order_item_id, oio.option_group_name, oio.option_name, oio.qty
            FROM order_item_options oio
            WHERE oio.order_item_id = ANY($1::int[])
            ORDER BY oio.id
        """
        order_opt_rows = (
            await conn.fetch(options_sql, order_item_ids) if order_item_ids else []
        )

        opts_by_order_item: dict[int, list[asyncpg.Record]] = {}
        for opt in order_opt_rows:
            opts_by_order_item.setdefault(opt["order_item_id"], []).append(opt)

        cart_id = await get_or_create_cart_id(conn, telegram_id)
        if replace_cart:
            await conn.execute("DELETE FROM cart_items WHERE cart_id = $1", cart_id)

        unavailable_items: list[str] = []
        added_count = 0

        for item in order_item_rows:
            p_name = item["product_name"]
            v_id = item["current_variant_id"]

            if not v_id or not item["pv_avail"] or not item["p_avail"]:
                unavailable_items.append(f"{p_name} ({item['variant_label']})")
                continue

            saved_opts = opts_by_order_item.get(item["id"], [])
            resolved_options: list[dict[str, Any]] = []
            options_unavailable = False

            if saved_opts:
                for s_opt in saved_opts:
                    opt_match = await conn.fetchrow(
                        """
                        SELECT ogi.group_id, ogi.variant_id,
                               ogi.is_available as ogi_avail,
                               op.is_available as op_avail,
                               opv.is_available as opv_avail
                        FROM product_variants pv
                        JOIN products p ON p.id = pv.product_id
                        JOIN product_option_groups pog ON pog.product_id = p.id
                        JOIN option_groups og ON og.id = pog.group_id
                        JOIN option_group_items ogi ON ogi.group_id = og.id
                        JOIN product_variants opv ON opv.id = ogi.variant_id
                        JOIN products op ON op.id = opv.product_id
                        WHERE pv.id = $1 AND og.name = $2 AND op.name = $3
                        LIMIT 1
                        """,
                        v_id,
                        s_opt["option_group_name"],
                        s_opt["option_name"],
                    )
                    if (
                        not opt_match
                        or not opt_match["ogi_avail"]
                        or not opt_match["op_avail"]
                        or not opt_match["opv_avail"]
                    ):
                        options_unavailable = True
                        break
                    resolved_options.append(
                        {
                            "group_id": opt_match["group_id"],
                            "variant_id": opt_match["variant_id"],
                            "qty": s_opt["qty"],
                        }
                    )

            if options_unavailable:
                unavailable_items.append(f"{p_name} (опції більше недоступні)")
                continue

            options_key = build_options_key(resolved_options, item_qty=item["qty"])

            cart_item_id = await conn.fetchval(
                """
                INSERT INTO cart_items (cart_id, variant_id, qty, options_key)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (cart_id, variant_id, options_key)
                DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty
                RETURNING id
                """,
                cart_id,
                v_id,
                item["qty"],
                options_key,
            )

            for opt in resolved_options:
                await conn.execute(
                    """
                    INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (cart_item_id, group_id, variant_id)
                    DO UPDATE SET qty = EXCLUDED.qty
                    """,
                    cart_item_id,
                    opt["group_id"],
                    opt["variant_id"],
                    opt["qty"],
                )

            added_count += 1

        if added_count == 0:
            raise HTTPException(
                status_code=400,
                detail="На жаль, жодна зі страв цього замовлення зараз недоступна в меню.",
            )

    current_cart = await _fetch_cart(pool, telegram_id)
    price_diff = abs(current_cart.total - old_order_total) > 0.01

    return RepeatOrderOut(
        added_count=added_count,
        unavailable_items=unavailable_items,
        price_changed=price_diff,
        old_total=old_order_total,
        new_total=current_cart.total,
    )


async def fetch_web_orders_history(
    conn: asyncpg.Connection,
    phone: str | None = None,
    telegram_id: int | None = None,
    limit: int = 25,
) -> list[OrderOut]:
    """Отримує історію замовлень для веб-сайту за телефоном або telegram_id."""
    clean_phone = phone.strip() if phone else None
    if not clean_phone and not telegram_id:
        return []

    norm_phone = clean_phone
    if clean_phone:
        from src.schemas.user import normalize_phone

        try:
            norm_phone = normalize_phone(clean_phone)
        except Exception:
            norm_phone = clean_phone

    order_rows = await conn.fetch(
        """
        SELECT id, telegram_id, status, fulfillment_type, delivery_address,
               contact_name, contact_phone, payment_method, scheduled_time,
               comment, total_price, bonus_spent, bonus_earned, created_at, COALESCE(source, 'web') AS source
        FROM orders
        WHERE ($1::text IS NOT NULL AND (contact_phone = $1 OR contact_phone = $2))
           OR ($3::bigint IS NOT NULL AND telegram_id = $3)
        ORDER BY id DESC
        LIMIT $4
        """,
        clean_phone,
        norm_phone,
        telegram_id,
        limit,
    )
    return await fetch_orders_batch(conn, order_rows)


async def fetch_user_orders(
    conn: asyncpg.Connection,
    telegram_id: int,
) -> list[OrderOut]:
    """Отримує історію замовлень авторизованого користувача Telegram."""
    order_rows = await conn.fetch(
        """
        SELECT id, telegram_id, status, fulfillment_type, delivery_address,
               contact_name, contact_phone, payment_method, scheduled_time,
               comment, total_price, bonus_spent, bonus_earned, created_at, COALESCE(source, 'telegram') AS source
        FROM orders
        WHERE telegram_id = $1
        ORDER BY id DESC
        """,
        telegram_id,
    )
    return await fetch_orders_batch(conn, order_rows)

