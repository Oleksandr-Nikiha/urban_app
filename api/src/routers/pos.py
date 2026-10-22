import html
import logging
from typing import Any

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from src.auth.admin_token import create_admin_token
from src.config import get_settings
from src.db.connection import get_pool
from src.schemas.pos import (
    PosAddItemsIn,
    PosAuthOut,
    PosCloseTableIn,
    PosCustomerLookupOut,
    PosOrderCreateIn,
    PosPinAuthIn,
    PosStaffMemberOut,
)
from src.services.bonus_service import BonusService
from src.services.telegram_client import send_telegram_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pos", tags=["pos"])


@router.get("/staff", response_model=list[PosStaffMemberOut])
async def list_pos_staff(pool: asyncpg.Pool = Depends(get_pool)):
    """Отримує список активних працівників для екрану швидкого вибору на POS."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT m.id,
                   COALESCE(m.staff_name, u.first_name, 'Співробітник') AS staff_name,
                   m.role,
                   m.location_id,
                   l.name AS location_name
            FROM managers m
            LEFT JOIN users u ON u.telegram_id = m.telegram_id
            LEFT JOIN locations l ON l.id = m.location_id
            WHERE m.is_active = true
            ORDER BY m.id ASC
            """
        )
        return [PosStaffMemberOut(**dict(r)) for r in rows]


@router.post("/auth/pin", response_model=PosAuthOut)
async def auth_pos_by_pin(
    payload: PosPinAuthIn,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Швидка авторизація співробітника за PIN-кодом."""
    clean_pin = payload.pin.strip()
    settings = get_settings()

    async with pool.acquire() as conn:
        if payload.staff_id:
            row = await conn.fetchrow(
                """
                SELECT m.id,
                       COALESCE(m.staff_name, u.first_name, 'Співробітник') AS staff_name,
                       m.role,
                       m.location_id,
                       m.pin_code,
                       m.telegram_id,
                       l.name AS location_name
                FROM managers m
                LEFT JOIN users u ON u.telegram_id = m.telegram_id
                LEFT JOIN locations l ON l.id = m.location_id
                WHERE m.id = $1 AND m.is_active = true
                """,
                payload.staff_id,
            )
        else:
            row = await conn.fetchrow(
                """
                SELECT m.id,
                       COALESCE(m.staff_name, u.first_name, 'Співробітник') AS staff_name,
                       m.role,
                       m.location_id,
                       m.pin_code,
                       m.telegram_id,
                       l.name AS location_name
                FROM managers m
                LEFT JOIN users u ON u.telegram_id = m.telegram_id
                LEFT JOIN locations l ON l.id = m.location_id
                WHERE m.pin_code = $1 AND m.is_active = true
                LIMIT 1
                """,
                clean_pin,
            )

        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Працівника не знайдено або невірний PIN-код",
            )

        if row["pin_code"] != clean_pin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Невірний PIN-код",
            )

        tg_id = row["telegram_id"] or row["id"]
        token = create_admin_token(tg_id, settings.bot_token)

        staff_data = PosStaffMemberOut(
            id=row["id"],
            staff_name=row["staff_name"],
            role=row["role"],
            location_id=row["location_id"],
            location_name=row["location_name"],
        )

        return PosAuthOut(token=token, staff=staff_data)


@router.get("/customer", response_model=PosCustomerLookupOut)
async def lookup_pos_customer(
    query: str = Query(..., min_length=3, description="Номер телефону або ім'я гостя"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Пошук клієнта для швидкого нарахування або списання бонусів URBAN CLUB."""
    clean_q = query.strip()
    digits = "".join(ch for ch in clean_q if ch.isdigit())

    async with pool.acquire() as conn:
        row = None
        if len(digits) >= 9:
            row = await conn.fetchrow(
                """
                SELECT telegram_id, first_name, phone, COALESCE(bonus_balance, 0) AS bonus_balance
                FROM users
                WHERE phone LIKE '%' || $1 || '%'
                LIMIT 1
                """,
                digits[-9:],
            )
        if not row:
            row = await conn.fetchrow(
                """
                SELECT telegram_id, first_name, phone, COALESCE(bonus_balance, 0) AS bonus_balance
                FROM users
                WHERE first_name ILIKE '%' || $1 || '%'
                LIMIT 1
                """,
                clean_q,
            )

        if row:
            return PosCustomerLookupOut(
                found=True,
                telegram_id=row["telegram_id"],
                first_name=row["first_name"],
                phone=row["phone"],
                bonus_balance=row["bonus_balance"],
            )

        return PosCustomerLookupOut(found=False, bonus_balance=0)


@router.get("/menu")
async def get_pos_menu(
    location_id: int = Query(..., description="ID закладу (1 - Pizza, 2 - Bakery)"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Повне меню для POS-терміналу: категорії, страви, варіанти та групи модифікаторів
    в одному швидкому запиті.
    """
    async with pool.acquire() as conn:
        categories = await conn.fetch(
            """
            SELECT c.id, c.name, c.icon, c.parent_id, c.sort_order
            FROM categories c
            WHERE c.location_id = $1 AND c.is_visible = true
            ORDER BY c.sort_order ASC, c.id ASC
            """,
            location_id,
        )

        products = await conn.fetch(
            """
            SELECT p.id, p.category_id, p.name, p.description, p.image_url,
                   p.is_available, p.sort_order
            FROM products p
            JOIN categories c ON c.id = p.category_id
            WHERE c.location_id = $1 AND p.is_available = true
            ORDER BY p.sort_order ASC, p.id ASC
            """,
            location_id,
        )

        variants = await conn.fetch(
            """
            SELECT pv.id, pv.product_id, pv.label, pv.price::float AS price,
                   pv.weight, pv.is_available, pv.sort_order
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE c.location_id = $1 AND pv.is_available = true
            ORDER BY pv.sort_order ASC, pv.id ASC
            """,
            location_id,
        )

        option_rows = await conn.fetch(
            """
            SELECT pog.product_id, g.id AS group_id, g.name AS group_name,
                   pog.min_select, pog.max_select, pog.free_count,
                   ogi.id AS option_item_id, ogi.variant_id, ogi.price_delta::float AS price_delta,
                   op.name AS option_name
            FROM product_option_groups pog
            JOIN option_groups g ON g.id = pog.group_id
            JOIN option_group_items ogi ON ogi.group_id = g.id
            JOIN product_variants v ON v.id = ogi.variant_id
            JOIN products op ON op.id = v.product_id
            JOIN products p ON p.id = pog.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE c.location_id = $1
              AND ogi.is_available = true
              AND v.is_available = true
              AND op.is_available = true
            ORDER BY pog.sort_order, ogi.sort_order
            """,
            location_id,
        )

    # Групуємо опції за продуктом
    options_by_product: dict[int, dict[int, Any]] = {}
    for r in option_rows:
        pid = r["product_id"]
        gid = r["group_id"]
        if pid not in options_by_product:
            options_by_product[pid] = {}
        if gid not in options_by_product[pid]:
            options_by_product[pid][gid] = {
                "group_id": gid,
                "name": r["group_name"],
                "min_select": r["min_select"],
                "max_select": r["max_select"],
                "free_count": r["free_count"],
                "items": [],
            }
        options_by_product[pid][gid]["items"].append(
            {
                "id": r["option_item_id"],
                "variant_id": r["variant_id"],
                "name": r["option_name"],
                "price": r["price_delta"],
            }
        )

    variants_by_product: dict[int, list[Any]] = {}
    for v in variants:
        variants_by_product.setdefault(v["product_id"], []).append(dict(v))

    products_by_category: dict[int, list[Any]] = {}
    for p in products:
        p_dict = dict(p)
        p_dict["variants"] = variants_by_product.get(p["id"], [])
        p_groups = options_by_product.get(p["id"], {})
        p_dict["option_groups"] = list(p_groups.values())
        products_by_category.setdefault(p["category_id"], []).append(p_dict)

    cat_list = []
    for c in categories:
        c_dict = dict(c)
        c_dict["products"] = products_by_category.get(c["id"], [])
        cat_list.append(c_dict)

    return cat_list


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_pos_order(
    payload: PosOrderCreateIn,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Створює замовлення безпосередньо з POS-терміналу офіціанта.
    - Розраховує ціну
    - Проводить бонуси (списання/нарахування)
    - Зберігає статус 'in_progress'
    - Сповіщає менеджерів у Telegram
    """
    settings = get_settings()

    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Перевіряємо заклад
            loc_row = await conn.fetchrow(
                "SELECT id, name FROM locations WHERE id = $1",
                payload.location_id,
            )
            if not loc_row:
                raise HTTPException(status_code=404, detail="Заклад не знайдено")
            location_name = loc_row["name"]

            # 2. Валідація позицій
            variant_ids = [it.variant_id for it in payload.items]
            var_rows = await conn.fetch(
                """
                SELECT pv.id AS variant_id, pv.price, pv.label AS variant_label,
                       p.id AS product_id, p.name AS product_name
                FROM product_variants pv
                JOIN products p ON p.id = pv.product_id
                WHERE pv.id = ANY($1::int[])
                """,
                variant_ids,
            )
            var_map = {r["variant_id"]: r for r in var_rows}
            if len(var_map) != len(set(variant_ids)):
                raise HTTPException(status_code=400, detail="Один із товарів не знайдено")

            # Збираємо опції
            all_opt_ids = [oid for it in payload.items for oid in it.option_variant_ids]
            opt_map = {}
            if all_opt_ids:
                options_sql = """
                    SELECT pog.product_id, pog.group_id, g.name AS group_name,
                           pog.free_count,
                           ogi.variant_id, ogi.price_delta, op.name AS option_name
                    FROM product_option_groups pog
                    JOIN option_groups g ON g.id = pog.group_id
                    JOIN option_group_items ogi ON ogi.group_id = g.id
                    JOIN product_variants opv ON opv.id = ogi.variant_id
                    JOIN products op ON op.id = opv.product_id
                    WHERE ogi.variant_id = ANY($1::int[])
                """
                opt_rows = await conn.fetch(options_sql, all_opt_ids)
                for r in opt_rows:
                    opt_map[(r["product_id"], r["variant_id"])] = dict(r)

            # Розрахунок підсумку
            total_price = 0.0
            order_items_data = []

            for it in payload.items:
                v = var_map[it.variant_id]
                prod_id = v["product_id"]
                v_price = float(v["price"])

                opt_by_group: dict[int, list[dict[str, Any]]] = {}
                for oid in it.option_variant_ids:
                    o = opt_map.get((prod_id, oid))
                    if o:
                        opt_by_group.setdefault(o["group_id"], []).append(o)

                opts_cost = 0.0
                item_opts = []
                for _gid, g_opts in opt_by_group.items():
                    deltas = [float(o["price_delta"]) for o in g_opts]
                    free_cnt = g_opts[0].get("free_count", 0)
                    chargeable = sorted(deltas, reverse=True)[free_cnt:]
                    opts_cost += sum(chargeable)

                    counts: dict[int, dict[str, Any]] = {}
                    for o in g_opts:
                        vid = o["variant_id"]
                        if vid not in counts:
                            counts[vid] = {"info": o, "qty": 0}
                        counts[vid]["qty"] += 1

                    for c in counts.values():
                        item_opts.append(
                            {
                                "option_group_name": c["info"]["group_name"],
                                "option_name": c["info"]["option_name"],
                                "price_delta": float(c["info"]["price_delta"]),
                                "qty": c["qty"],
                            }
                        )

                unit_price = v_price + opts_cost
                item_subtotal = unit_price * it.qty
                total_price += item_subtotal

                order_items_data.append(
                    {
                        "variant_id": it.variant_id,
                        "product_name": v["product_name"],
                        "variant_label": v["variant_label"],
                        "unit_price": unit_price,
                        "qty": it.qty,
                        "subtotal": item_subtotal,
                        "options": item_opts,
                    }
                )

            # Робота з бонусами та користувачем
            customer_user = None
            customer_tg_id = None
            is_paid = payload.payment_method in ("cash", "card")
            bonus_spent = 0

            # Бонуси списуються одразу тільки при миттєвій оплаті (на виніс)
            if is_paid and payload.customer_phone:
                customer_user = await BonusService.get_or_create_user_for_order(
                    conn,
                    phone=payload.customer_phone,
                    full_name=payload.customer_name or "Гість",
                )
                if customer_user:
                    customer_tg_id = customer_user.get("telegram_id")
                    if payload.bonus_spent > 0:
                        max_can_spend = min(
                            int(total_price),
                            int(customer_user.get("bonus_balance") or 0),
                            payload.bonus_spent,
                        )
                        bonus_spent = max_can_spend

            final_total = max(0.0, total_price - bonus_spent)

            # Створення головного замовлення в таблиці orders
            order_id = await conn.fetchval(
                """
                INSERT INTO orders (
                    telegram_id, status, fulfillment_type, delivery_address,
                    contact_name, contact_phone, payment_method, scheduled_time,
                    comment, total_price, bonus_spent, source, table_number, staff_name, is_paid
                )
                VALUES ($1, 'in_progress', $2, NULL, $3, $4, $5, NULL, $6, $7, $8, 'pos', $9, $10, $11)
                RETURNING id
                """,
                customer_tg_id,
                payload.fulfillment_type,
                payload.customer_name or (f"Стіл {payload.table_number}" if payload.table_number else "Гість"),
                payload.customer_phone or "POS",
                payload.payment_method,
                payload.comment,
                final_total,
                bonus_spent,
                payload.table_number,
                payload.staff_name,
                is_paid,
            )

            # Списання бонусів
            if is_paid and customer_user and bonus_spent > 0:
                await BonusService.spend_bonuses(
                    conn,
                    user_id=customer_user["id"],
                    order_id=order_id,
                    bonus_to_spend=bonus_spent,
                )

            # Створюємо order_group
            order_group_id = await conn.fetchval(
                """
                INSERT INTO order_groups (order_id, location_id, status, subtotal)
                VALUES ($1, $2, 'cooking', $3)
                RETURNING id
                """,
                order_id,
                payload.location_id,
                final_total,
            )

            # Зберігаємо позиції та опції
            for item in order_items_data:
                order_item_id = await conn.fetchval(
                    """
                    INSERT INTO order_items (order_group_id, variant_id, product_name, variant_label, unit_price, qty, subtotal)
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

                for opt in item["options"]:
                    await conn.execute(
                        """
                        INSERT INTO order_item_options (order_item_id, option_group_name, option_name, price_delta, qty)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        order_item_id,
                        opt["option_group_name"],
                        opt["option_name"],
                        opt["price_delta"],
                        opt["qty"],
                    )

    # Сповіщення в Telegram менеджерам
    summary_items = ", ".join(f"{it['product_name']} ×{it['qty']}" for it in order_items_data)
    type_str = f"В закладі (Стіл #{payload.table_number})" if payload.fulfillment_type == "dine_in" else "Takeaway (З собою)"
    pay_str = "Готівка" if payload.payment_method == "cash" else "Картка (термінал)"

    tg_text = (
        f"⚡ <b>Нове POS-замовлення #{order_id}</b>\n\n"
        f"🏢 <b>Заклад:</b> {html.escape(location_name)}\n"
        f"👤 <b>Офіціант/Персонал:</b> {html.escape(payload.staff_name)}\n"
        f"🍽️ <b>Тип:</b> {type_str}\n"
        f"💳 <b>Оплата:</b> {pay_str}\n"
        f"💰 <b>Сума:</b> {final_total:.2f} грн"
    )
    if bonus_spent > 0:
        tg_text += f" (списано {bonus_spent} бонусів)"
    tg_text += f"\n📋 <b>Позиції:</b> {html.escape(summary_items)}"
    if payload.comment:
        tg_text += f"\n💬 <b>Коментар:</b> {html.escape(payload.comment)}"

    if settings.bot_token and settings.manager_chat_id:
        background_tasks.add_task(
            send_telegram_message,
            token=settings.bot_token,
            chat_id=settings.manager_chat_id,
            text=tg_text,
        )

    return {
        "success": True,
        "order_id": order_id,
        "location_id": payload.location_id,
        "location_name": location_name,
        "total_price": final_total,
        "bonus_spent": bonus_spent,
        "table_number": payload.table_number,
        "staff_name": payload.staff_name,
        "fulfillment_type": payload.fulfillment_type,
        "payment_method": payload.payment_method,
    }


@router.get("/orders")
async def list_pos_orders(
    location_id: int = Query(..., description="ID закладу"),
    limit: int = Query(30, ge=1, le=100),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Список останніх замовлень на POS для перегляду чеків та статусів."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT o.id, o.status, o.fulfillment_type, o.table_number, o.staff_name,
                   o.payment_method, o.is_paid, o.total_price::float AS total_price,
                   o.bonus_spent, o.comment, o.contact_phone, o.contact_name,
                   to_char(o.created_at, 'HH24:MI') AS time_str,
                   COALESCE(
                       (SELECT string_agg(oi.product_name || ' ×' || oi.qty, ', ')
                        FROM order_items oi
                        JOIN order_groups g ON g.id = oi.order_group_id
                        WHERE g.order_id = o.id), ''
                   ) AS items_summary
            FROM orders o
            JOIN order_groups og ON og.order_id = o.id
            WHERE og.location_id = $1
            ORDER BY o.id DESC
            LIMIT $2
            """,
            location_id,
            limit,
        )

        order_ids = [r["id"] for r in rows]
        items_by_order: dict[int, list[dict[str, Any]]] = {}
        if order_ids:
            item_rows = await conn.fetch(
                """
                SELECT oi.id, og.order_id, oi.variant_id, oi.product_name, oi.variant_label,
                       oi.unit_price::float AS unit_price, oi.qty, oi.subtotal::float AS subtotal,
                       oi.is_served
                FROM order_items oi
                JOIN order_groups og ON og.id = oi.order_group_id
                WHERE og.order_id = ANY($1::int[])
                ORDER BY oi.id ASC
                """,
                order_ids,
            )
            for it in item_rows:
                items_by_order.setdefault(it["order_id"], []).append(dict(it))

        result = []
        for r in rows:
            d = dict(r)
            d["items"] = items_by_order.get(r["id"], [])
            result.append(d)

        return result


@router.patch("/order-items/{item_id}/toggle-served")
async def toggle_item_served(
    item_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Перемикає статус 'Подано/Винесено' для окремої страви в замовленні."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE order_items SET is_served = NOT is_served WHERE id = $1 RETURNING id, is_served",
            item_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Позицію не знайдено")
        return {"success": True, "item_id": item_id, "is_served": row["is_served"]}


@router.post("/orders/{order_id}/items")
async def add_items_to_pos_order(
    order_id: int,
    payload: PosAddItemsIn,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Динамічно додає нові позиції або збільшує кількість у відкритому замовленні столу."""
    settings = get_settings()

    async with pool.acquire() as conn:
        async with conn.transaction():
            order_row = await conn.fetchrow(
                """
                SELECT o.id, o.status, o.total_price, o.table_number, o.staff_name,
                       og.id AS order_group_id, og.subtotal AS group_subtotal,
                       l.name AS location_name
                FROM orders o
                JOIN order_groups og ON og.order_id = o.id
                JOIN locations l ON l.id = og.location_id
                WHERE o.id = $1 FOR UPDATE
                """,
                order_id,
            )
            if not order_row:
                raise HTTPException(status_code=404, detail="Замовлення не знайдено")
            if order_row["status"] in ("completed", "cancelled"):
                raise HTTPException(status_code=400, detail="Неможливо додати позиції до закритого замовлення")

            order_group_id = order_row["order_group_id"]
            variant_ids = [it.variant_id for it in payload.items]
            var_rows = await conn.fetch(
                """
                SELECT pv.id AS variant_id, pv.price, pv.label AS variant_label,
                       p.id AS product_id, p.name AS product_name
                FROM product_variants pv
                JOIN products p ON p.id = pv.product_id
                WHERE pv.id = ANY($1::int[])
                """,
                variant_ids,
            )
            var_map = {r["variant_id"]: r for r in var_rows}
            if len(var_map) != len(set(variant_ids)):
                raise HTTPException(status_code=400, detail="Один із товарів не знайдено")

            all_opt_ids = [oid for it in payload.items for oid in it.option_variant_ids]
            opt_map = {}
            if all_opt_ids:
                opt_rows = await conn.fetch(
                    """
                    SELECT pog.product_id, pog.group_id, g.name AS group_name,
                           pog.free_count,
                           ogi.variant_id, ogi.price_delta, op.name AS option_name
                    FROM product_option_groups pog
                    JOIN option_groups g ON g.id = pog.group_id
                    JOIN option_group_items ogi ON ogi.group_id = g.id
                    JOIN product_variants opv ON opv.id = ogi.variant_id
                    JOIN products op ON op.id = opv.product_id
                    WHERE ogi.variant_id = ANY($1::int[])
                    """,
                    all_opt_ids,
                )
                for r in opt_rows:
                    opt_map[(r["product_id"], r["variant_id"])] = dict(r)

            added_total = 0.0
            added_summary = []
            for it in payload.items:
                v = var_map[it.variant_id]
                prod_id = v["product_id"]
                v_price = float(v["price"])

                opt_by_group: dict[int, list[dict[str, Any]]] = {}
                for oid in it.option_variant_ids:
                    o = opt_map.get((prod_id, oid))
                    if o:
                        opt_by_group.setdefault(o["group_id"], []).append(o)

                opts_cost = 0.0
                item_opts = []
                for _gid, g_opts in opt_by_group.items():
                    deltas = [float(o["price_delta"]) for o in g_opts]
                    free_cnt = g_opts[0].get("free_count", 0)
                    chargeable = sorted(deltas, reverse=True)[free_cnt:]
                    opts_cost += sum(chargeable)

                    counts: dict[int, dict[str, Any]] = {}
                    for o in g_opts:
                        vid = o["variant_id"]
                        if vid not in counts:
                            counts[vid] = {"info": o, "qty": 0}
                        counts[vid]["qty"] += 1

                    for c in counts.values():
                        item_opts.append(
                            {
                                "option_group_name": c["info"]["group_name"],
                                "option_name": c["info"]["option_name"],
                                "price_delta": float(c["info"]["price_delta"]),
                                "qty": c["qty"],
                            }
                        )

                unit_price = v_price + opts_cost
                item_subtotal = unit_price * it.qty
                added_total += item_subtotal
                added_summary.append(f"{v['product_name']} ×{it.qty}")

                new_item_id = await conn.fetchval(
                    """
                    INSERT INTO order_items (order_group_id, variant_id, product_name, variant_label, unit_price, qty, subtotal, is_served)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, false)
                    RETURNING id
                    """,
                    order_group_id,
                    it.variant_id,
                    v["product_name"],
                    v["variant_label"],
                    unit_price,
                    it.qty,
                    item_subtotal,
                )

                for opt in item_opts:
                    await conn.execute(
                        """
                        INSERT INTO order_item_options (order_item_id, option_group_name, option_name, price_delta, qty)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        new_item_id,
                        opt["option_group_name"],
                        opt["option_name"],
                        opt["price_delta"],
                        opt["qty"],
                    )

            new_group_subtotal = float(order_row["group_subtotal"]) + added_total
            new_order_total = float(order_row["total_price"]) + added_total

            await conn.execute(
                "UPDATE order_groups SET subtotal = $1 WHERE id = $2",
                new_group_subtotal,
                order_group_id,
            )
            await conn.execute(
                "UPDATE orders SET total_price = $1, updated_at = now() WHERE id = $2",
                new_order_total,
                order_id,
            )

    # Сповіщення на кухню про дозамовлення
    table_str = f"Стіл #{order_row['table_number']}" if order_row["table_number"] else f"Замовлення #{order_id}"
    tg_text = (
        f"➕ <b>Дозамовлення до {table_str}</b>\n\n"
        f"🏢 <b>Заклад:</b> {html.escape(order_row['location_name'])}\n"
        f"👤 <b>Персонал:</b> {html.escape(order_row['staff_name'] or 'Офіціант')}\n"
        f"📋 <b>Додано:</b> {html.escape(', '.join(added_summary))}\n"
        f"💰 <b>Загальна сума чека:</b> {new_order_total:.2f} грн"
    )
    if settings.bot_token and settings.manager_chat_id:
        background_tasks.add_task(
            send_telegram_message,
            token=settings.bot_token,
            chat_id=settings.manager_chat_id,
            text=tg_text,
        )

    return {
        "success": True,
        "order_id": order_id,
        "new_total": new_order_total,
        "added_count": len(payload.items),
    }


@router.post("/orders/{order_id}/close-table")
async def close_pos_table_order(
    order_id: int,
    payload: PosCloseTableIn,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Розрахунок та закриття столу (оплата після обслуговування)."""
    settings = get_settings()

    async with pool.acquire() as conn, conn.transaction():
        order = await conn.fetchrow(
            "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
            order_id,
        )
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        if order["status"] == "completed" and order["is_paid"]:
            raise HTTPException(status_code=400, detail="Цей стіл вже розраховано")

        current_total = float(order["total_price"])
        customer_phone = payload.customer_phone or order["contact_phone"]
        customer_name = payload.customer_name or order["contact_name"]

        customer_user = None
        bonus_spent = 0
        if customer_phone and customer_phone != "POS":
            customer_user = await BonusService.get_or_create_user_for_order(
                conn,
                phone=customer_phone,
                full_name=customer_name or "Гість",
            )
            if customer_user and payload.bonus_spent > 0:
                max_spend = min(
                    int(current_total),
                    int(customer_user.get("bonus_balance") or 0),
                    payload.bonus_spent,
                )
                bonus_spent = max_spend

        final_total = max(0.0, current_total - bonus_spent)

        # Списання бонусів
        if customer_user and bonus_spent > 0:
            await BonusService.spend_bonuses(
                conn,
                user_id=customer_user["id"],
                order_id=order_id,
                bonus_to_spend=bonus_spent,
            )

        # Оновлюємо замовлення як оплачене та завершене
        await conn.execute(
            """
                UPDATE orders
                SET payment_method = $1, is_paid = true, status = 'completed',
                    total_price = $2, bonus_spent = $3, updated_at = now()
                WHERE id = $4
                """,
            payload.payment_method,
            final_total,
            bonus_spent,
            order_id,
        )
        await conn.execute(
            "UPDATE order_groups SET status = 'accepted' WHERE order_id = $1",
            order_id,
        )

        # Нарахування кешбеку гостю при закритті
        try:
            await BonusService.process_order_completion_bonuses(conn, order_id)
        except Exception as exc:
            logger.warning("Помилка нарахування бонусів при закритті столу #%s: %s", order_id, exc)

    # Сповіщення про закриття столу
    pay_str = "Готівка" if payload.payment_method == "cash" else "Картка (термінал)"
    table_str = f"Стіл #{order['table_number']}" if order["table_number"] else f"Замовлення #{order_id}"
    tg_text = (
        f"🏁 <b>{table_str} розраховано та закрито</b>\n\n"
        f"💳 <b>Оплата:</b> {pay_str}\n"
        f"💰 <b>Сплачено:</b> {final_total:.2f} грн"
    )
    if bonus_spent > 0:
        tg_text += f" (списано {bonus_spent} бонусів)"

    if settings.bot_token and settings.manager_chat_id:
        background_tasks.add_task(
            send_telegram_message,
            token=settings.bot_token,
            chat_id=settings.manager_chat_id,
            text=tg_text,
        )

    return {
        "success": True,
        "order_id": order_id,
        "total_paid": final_total,
        "bonus_spent": bonus_spent,
        "payment_method": payload.payment_method,
        "status": "completed",
    }


@router.patch("/orders/{order_id}/status")
async def update_pos_order_status(
    order_id: int,
    status_val: str = Query(..., regex="^(ready|completed|cancelled)$"),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Оновлення статусу замовлення з POS-терміналу (готове / видане / скасоване)."""
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2",
            status_val,
            order_id,
        )
        await conn.execute(
            "UPDATE order_groups SET status = $1 WHERE order_id = $2",
            "ready" if status_val == "ready" else ("cancelled" if status_val == "cancelled" else "accepted"),
            order_id,
        )
        if status_val == "completed":
            try:
                await BonusService.process_order_completion_bonuses(conn, order_id)
            except Exception as exc:
                logger.warning("Помилка нарахування бонусів для замовлення #%s: %s", order_id, exc)

        return {"success": True, "order_id": order_id, "status": status_val}
