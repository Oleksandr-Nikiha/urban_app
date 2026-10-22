from typing import Any

import asyncpg
from fastapi import HTTPException, status

from src.routers.cart import options_cost
from src.schemas.order import (
    OrderGroupOut,
    OrderItemOptionOut,
    OrderItemOut,
    OrderOut,
    WebOrderCreateIn,
)
from src.services.bonus_service import BonusService
from src.services.order_validation import validate_scheduled_time


async def create_web_order(
    conn: asyncpg.Connection,
    payload: WebOrderCreateIn,
) -> tuple[OrderOut, int | None, dict[str, Any]]:
    """
    Створює замовлення з веб-сайту закладу:
    - Валідує заклад, робочі години, доставку та запланований час
    - Перевіряє доступність страв та модифікаторів
    - Розраховує ціну з урахуванням безкоштовних модифікаторів (free_count)
    - Автоматично створює або оновлює користувача за номером телефону
    - Зберігає замовлення, групу, позиції та модифікатори
    Повертає (створене замовлення, telegram_id клієнта, дані для сповіщення).
    """
    # 1. Перевірка закладу та робочих годин
    loc_row = await conn.fetchrow(
        """
        SELECT id, name, is_delivery_enabled,
               to_char(delivery_start_time, 'HH24:MI') AS delivery_start_time,
               to_char(delivery_end_time, 'HH24:MI') AS delivery_end_time
        FROM locations
        WHERE id = $1
        """,
        payload.location_id,
    )
    if not loc_row:
        raise HTTPException(status_code=404, detail="Заклад не знайдено")

    target_location_name = loc_row["name"]
    is_delivery_enabled = loc_row["is_delivery_enabled"]
    delivery_start_time = loc_row["delivery_start_time"] or "10:30"
    delivery_end_time = loc_row["delivery_end_time"] or "21:30"

    if payload.fulfillment_type == "delivery" and not is_delivery_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Доставка з закладу «{target_location_name}» тимчасово призупинена. "
                "Будь ласка, оберіть самовивіз."
            ),
        )

    clean_scheduled_time = None
    if payload.scheduled_time and payload.scheduled_time.strip():
        clean_scheduled_time = payload.scheduled_time.strip()
        validate_scheduled_time(
            clean_scheduled_time,
            delivery_start_time,
            delivery_end_time,
            target_location_name,
            payload.fulfillment_type,
        )

    # 2. Валідація позицій замовлення
    variant_ids = [it.variant_id for it in payload.items]
    variants_sql = """
        SELECT pv.id AS variant_id, pv.price, pv.label AS variant_label,
               pv.is_available AS pv_avail,
               p.id AS product_id, p.name AS product_name, p.is_available AS p_avail,
               c.location_id
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE pv.id = ANY($1::int[])
    """
    v_rows = await conn.fetch(variants_sql, variant_ids)
    v_map = {r["variant_id"]: r for r in v_rows}

    for it in payload.items:
        v_info = v_map.get(it.variant_id)
        if not v_info:
            raise HTTPException(
                status_code=404,
                detail=f"Страву (варіант #{it.variant_id}) не знайдено",
            )
        if not v_info["p_avail"] or not v_info["pv_avail"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Страва «{v_info['product_name']}» наразі недоступна",
            )
        if v_info["location_id"] != payload.location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Страва «{v_info['product_name']}» належить іншому закладу",
            )

    # 3. Валідація модифікаторів
    all_opt_ids = [opt for it in payload.items for opt in it.option_variant_ids]
    opt_map = {}
    if all_opt_ids:
        options_sql = """
            SELECT pog.product_id, pog.group_id, g.name AS group_name,
                   pog.min_select, pog.max_select, pog.free_count,
                   ogi.variant_id, ogi.price_delta, op.name AS option_name,
                   ogi.is_available AS ogi_avail, op.is_available AS op_avail,
                   opv.is_available AS opv_avail
            FROM product_option_groups pog
            JOIN option_groups g ON g.id = pog.group_id
            JOIN option_group_items ogi ON ogi.group_id = g.id
            JOIN product_variants opv ON opv.id = ogi.variant_id
            JOIN products op ON op.id = opv.product_id
            WHERE ogi.variant_id = ANY($1::int[])
        """
        opt_rows = await conn.fetch(options_sql, all_opt_ids)
        for r in opt_rows:
            opt_map[(r["product_id"], r["variant_id"])] = r

    # 4. Розрахунок вартості страв та опцій
    total_order_price = 0.0
    calculated_items: list[dict[str, Any]] = []

    for it in payload.items:
        v_info = v_map[it.variant_id]
        prod_id = v_info["product_id"]
        unit_price = float(v_info["price"])

        item_options: list[dict[str, Any]] = []
        extra_cost = 0.0

        opt_by_group: dict[int, list[asyncpg.Record]] = {}
        for opt_vid in it.option_variant_ids:
            opt_row = opt_map.get((prod_id, opt_vid))
            if not opt_row:
                raise HTTPException(
                    status_code=400,
                    detail=f"Невалідна опція #{opt_vid} для страви «{v_info['product_name']}»",
                )
            if not opt_row["ogi_avail"] or not opt_row["op_avail"] or not opt_row["opv_avail"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Опція «{opt_row['option_name']}» наразі недоступна",
                )
            opt_by_group.setdefault(opt_row["group_id"], []).append(opt_row)

        for _g_id, g_opts in opt_by_group.items():
            units = [float(o["price_delta"]) for o in g_opts]
            eff_free = g_opts[0]["free_count"] * it.qty
            extra_cost += options_cost(units, eff_free)
            for o in g_opts:
                item_options.append(
                    {
                        "option_group_name": o["group_name"],
                        "name": o["option_name"],
                        "price_delta": float(o["price_delta"]),
                        "qty": 1,
                    }
                )

        item_subtotal = round(unit_price * it.qty + extra_cost, 2)
        total_order_price += item_subtotal

        calculated_items.append(
            {
                "variant_id": it.variant_id,
                "product_name": v_info["product_name"],
                "variant_label": v_info["variant_label"],
                "unit_price": unit_price,
                "qty": it.qty,
                "subtotal": item_subtotal,
                "options": item_options,
            }
        )

    total_order_price = round(total_order_price, 2)

    # 5. Транзакційний запис у БД
    async with conn.transaction():
        clean_phone = payload.contact_phone.strip()
        clean_name = payload.contact_name.strip()

        user_row = await conn.fetchrow(
            """
            SELECT id, telegram_id, phone, full_name, is_phone_verified
            FROM users
            WHERE phone = $1 OR (telegram_id IS NOT NULL AND telegram_id = $2)
            """,
            clean_phone,
            payload.telegram_id,
        )

        customer_tg_id = payload.telegram_id
        if user_row:
            user_dict = dict(user_row)
            customer_tg_id = user_dict.get("telegram_id") or payload.telegram_id
            await conn.execute(
                """
                UPDATE users
                SET full_name = CASE
                        WHEN full_name = '' OR full_name LIKE 'Гість%' THEN $1
                        ELSE full_name
                    END,
                    delivery_address = COALESCE(delivery_address, $2),
                    telegram_id = COALESCE(telegram_id, $3),
                    is_phone_verified = CASE
                        WHEN $3 IS NOT NULL THEN true
                        ELSE is_phone_verified
                    END,
                    updated_at = now()
                WHERE id = $4
                """,
                clean_name,
                payload.delivery_address,
                payload.telegram_id,
                user_dict.get("id"),
            )
        else:
            first_name = clean_name.split(" ", 1)[0] if clean_name else ""
            last_name = clean_name.split(" ", 1)[1] if " " in clean_name else None
            is_verified = bool(payload.telegram_id)
            await conn.execute(
                """
                INSERT INTO users (
                    telegram_id, full_name, first_name, last_name, phone,
                    delivery_address, is_phone_verified, password_hash
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                payload.telegram_id,
                clean_name,
                first_name,
                last_name,
                clean_phone,
                payload.delivery_address,
                is_verified,
                None,
            )

        actual_bonus_spent = 0
        if payload.bonus_spent > 0 and user_row:
            actual_bonus_spent = await BonusService.spend_bonuses(
                conn=conn,
                user_id=user_row["id"],
                order_id=0, # updated after insert
                bonus_to_spend=payload.bonus_spent,
            )

        order_row = await conn.fetchrow(
            """
            INSERT INTO orders (
                telegram_id, status, fulfillment_type, delivery_address,
                contact_name, contact_phone, payment_method, scheduled_time,
                comment, total_price, bonus_spent, source
            )
            VALUES ($1, 'pending_moderation', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, created_at
            """,
            customer_tg_id,
            payload.fulfillment_type,
            payload.delivery_address,
            clean_name,
            clean_phone,
            payload.payment_method,
            clean_scheduled_time,
            payload.comment.strip() if payload.comment else None,
            total_order_price,
            actual_bonus_spent,
            payload.source,
        )
        order_id = order_row["id"]
        created_at = order_row["created_at"]

        if actual_bonus_spent > 0 and user_row:
            await conn.execute(
                "UPDATE bonus_transactions SET order_id = $1, description = $2 WHERE user_id = $3 AND order_id IS NULL AND transaction_type = 'order_redemption'",
                order_id,
                f"Списання бонусів на замовлення #{order_id}",
                user_row["id"],
            )

        group_row = await conn.fetchrow(
            """
            INSERT INTO order_groups (order_id, location_id, status, subtotal)
            VALUES ($1, $2, 'pending', $3)
            RETURNING id
            """,
            order_id,
            payload.location_id,
            total_order_price,
        )
        order_group_id = group_row["id"]

        saved_items: list[OrderItemOut] = []
        for item in calculated_items:
            item_row = await conn.fetchrow(
                """
                INSERT INTO order_items (
                    order_group_id, variant_id, product_name, variant_label,
                    unit_price, qty, subtotal
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                order_group_id,
                item["variant_id"],
                item["product_name"],
                item["variant_label"],
                item["unit_price"],
                item["qty"],
                item["subtotal"],
            )
            saved_item_id = item_row["id"]

            saved_opts: list[OrderItemOptionOut] = []
            for opt in item["options"]:
                opt_row = await conn.fetchrow(
                    """
                    INSERT INTO order_item_options (
                        order_item_id, option_group_name, option_name, price_delta, qty
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                    """,
                    saved_item_id,
                    opt["option_group_name"],
                    opt["name"],
                    opt["price_delta"],
                    opt["qty"],
                )
                saved_opts.append(
                    OrderItemOptionOut(
                        id=opt_row["id"],
                        option_group_name=opt["option_group_name"],
                        option_name=opt["name"],
                        price_delta=opt["price_delta"],
                        qty=opt["qty"],
                    )
                )

            saved_items.append(
                OrderItemOut(
                    id=saved_item_id,
                    variant_id=item["variant_id"],
                    product_name=item["product_name"],
                    variant_label=item["variant_label"],
                    unit_price=item["unit_price"],
                    qty=item["qty"],
                    subtotal=item["subtotal"],
                    options=saved_opts,
                )
            )

    order_notification_data = {
        "location_name": target_location_name,
        "contact_name": payload.contact_name,
        "contact_phone": payload.contact_phone,
        "fulfillment_type": payload.fulfillment_type,
        "delivery_address": payload.delivery_address,
        "payment_method": payload.payment_method,
        "scheduled_time": clean_scheduled_time,
        "comment": payload.comment,
        "total_price": total_order_price,
        "items": calculated_items,
        "source": payload.source,
        "telegram_id": customer_tg_id,
    }

    order_out = OrderOut(
        id=order_id,
        telegram_id=customer_tg_id,
        status="pending_moderation",
        fulfillment_type=payload.fulfillment_type,
        delivery_address=payload.delivery_address,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        payment_method=payload.payment_method,
        scheduled_time=clean_scheduled_time,
        comment=payload.comment,
        total_price=total_order_price,
        bonus_spent=actual_bonus_spent,
        bonus_earned=0,
        created_at=created_at,
        source=payload.source,
        groups=[
            OrderGroupOut(
                id=order_group_id,
                location_id=payload.location_id,
                location_name=target_location_name,
                status="pending",
                subtotal=total_order_price,
                items=saved_items,
            )
        ],
    )
    return order_out, customer_tg_id, order_notification_data
