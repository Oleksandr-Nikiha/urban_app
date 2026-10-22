import html
import logging

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from src.auth.deps import get_current_staff
from src.config import get_settings
from src.db.connection import get_pool
from src.services.bonus_service import accrue_cashback_for_order
from src.schemas.admin import (
    AdminOrderDetailOut,
    AdminOrderGroupOut,
    AdminOrderItemOptionOut,
    AdminOrderItemOut,
    AdminOrderListItemOut,
    AdminOrderUpdateIn,
)
from src.services.telegram_client import send_telegram_message

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/orders", response_model=list[AdminOrderListItemOut])
async def list_admin_orders(
    status: str | None = Query(None),
    location_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Список замовлень для менеджера/адміністратора."""
    target_loc = staff["location_id"] if staff["role"] == "manager" else location_id

    sql = """
        SELECT o.id, o.telegram_id, o.status, o.fulfillment_type, o.delivery_address,
               o.contact_name, o.contact_phone, o.payment_method, o.scheduled_time,
               o.comment, o.total_price::float AS total_price,
               to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               COALESCE(u.is_blocked, false) AS user_is_blocked, u.admin_note AS user_admin_note,
               og.location_id, loc.name AS location_name,
               COALESCE(o.source, 'telegram') AS source,
               COALESCE(
                   (SELECT string_agg(oi.product_name || ' ×' || oi.qty, ', ')
                    FROM order_items oi
                    JOIN order_groups g ON g.id = oi.order_group_id
                    WHERE g.order_id = o.id), ''
               ) AS items_summary
        FROM orders o
        LEFT JOIN users u ON u.telegram_id = o.telegram_id
        LEFT JOIN order_groups og ON og.order_id = o.id
        LEFT JOIN locations loc ON loc.id = og.location_id
        WHERE ($1::text IS NULL OR o.status = $1)
          AND ($2::int IS NULL OR og.location_id = $2)
        GROUP BY o.id, u.is_blocked, u.admin_note, og.location_id, loc.name
        ORDER BY o.id DESC
        LIMIT $3
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, status, target_loc, limit)
    return [AdminOrderListItemOut(**dict(r)) for r in rows]


@router.get("/orders/{order_id}", response_model=AdminOrderDetailOut)
async def get_admin_order(
    order_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Детальна інформація про замовлення."""
    async with pool.acquire() as conn:
        order_row = await conn.fetchrow(
            """
            SELECT o.id, o.telegram_id, o.status, o.fulfillment_type, o.delivery_address,
                   o.contact_name, o.contact_phone, o.payment_method, o.scheduled_time,
                   o.comment, o.total_price::float AS total_price,
                   to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
                   COALESCE(u.is_blocked, false) AS user_is_blocked,
                   u.admin_note AS user_admin_note,
                   COALESCE(o.source, 'telegram') AS source
            FROM orders o
            LEFT JOIN users u ON u.telegram_id = o.telegram_id
            WHERE o.id = $1
            """,
            order_id,
        )
        if not order_row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        group_rows = await conn.fetch(
            """
            SELECT og.id, og.order_id, og.location_id, l.name AS location_name,
                   og.status, og.subtotal::float AS subtotal
            FROM order_groups og
            JOIN locations l ON l.id = og.location_id
            WHERE og.order_id = $1
            ORDER BY og.id
            """,
            order_id,
        )

        if staff["role"] == "manager" and staff["location_id"] is not None:
            loc_ids = [g["location_id"] for g in group_rows]
            if staff["location_id"] not in loc_ids:
                raise HTTPException(status_code=403, detail="Це замовлення належить іншому закладу")

        item_rows = await conn.fetch(
            """
            SELECT oi.id, oi.order_group_id, oi.variant_id, oi.product_name,
                   oi.variant_label, oi.unit_price::float AS unit_price,
                   oi.qty, oi.subtotal::float AS subtotal
            FROM order_items oi
            JOIN order_groups og ON og.id = oi.order_group_id
            WHERE og.order_id = $1
            ORDER BY oi.id
            """,
            order_id,
        )

        item_ids = [r["id"] for r in item_rows]
        option_rows = []
        if item_ids:
            option_rows = await conn.fetch(
                """
                SELECT id, order_item_id, option_group_name, option_name,
                       price_delta::float AS price_delta, qty
                FROM order_item_options
                WHERE order_item_id = ANY($1::int[])
                ORDER BY id
                """,
                item_ids,
            )

    options_by_item: dict[int, list[AdminOrderItemOptionOut]] = {}
    for opt in option_rows:
        item_id = opt["order_item_id"]
        if item_id not in options_by_item:
            options_by_item[item_id] = []
        options_by_item[item_id].append(AdminOrderItemOptionOut(**dict(opt)))

    items_by_group: dict[int, list[AdminOrderItemOut]] = {}
    for it in item_rows:
        gid = it["order_group_id"]
        if gid not in items_by_group:
            items_by_group[gid] = []
        it_dict = dict(it)
        it_dict["options"] = options_by_item.get(it["id"], [])
        items_by_group[gid].append(AdminOrderItemOut(**it_dict))

    groups_out = []
    for g in group_rows:
        g_dict = dict(g)
        g_dict["items"] = items_by_group.get(g["id"], [])
        groups_out.append(AdminOrderGroupOut(**g_dict))

    res_dict = dict(order_row)
    res_dict["groups"] = groups_out
    return AdminOrderDetailOut(**res_dict)


@router.put("/orders/{order_id}", response_model=AdminOrderDetailOut)
async def update_admin_order(
    order_id: int,
    data: AdminOrderUpdateIn,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Редагування замовлення: час доставки, позиції, додатки, контакти, статус."""
    status_changed = False
    new_status = None
    existing_tg_id = None
    existing_fulfillment = None
    existing_scheduled = None
    existing_addr = None
    existing_total = 0.0

    async with pool.acquire() as conn, conn.transaction():
        existing = await conn.fetchrow(
            """
            SELECT id, status, telegram_id, fulfillment_type, scheduled_time,
                   delivery_address, total_price
            FROM orders
            WHERE id = $1
            FOR UPDATE
            """,
            order_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        existing_tg_id = existing["telegram_id"]
        existing_fulfillment = existing["fulfillment_type"]
        existing_scheduled = existing["scheduled_time"]
        existing_addr = existing["delivery_address"]
        existing_total = float(existing["total_price"])

        group_rows = await conn.fetch(
            "SELECT id, location_id FROM order_groups WHERE order_id = $1", order_id
        )
        if not group_rows:
            raise HTTPException(status_code=400, detail="У замовлення немає групи закладів")

        if (
            staff["role"] == "manager"
            and staff["location_id"] is not None
            and staff["location_id"] not in [g["location_id"] for g in group_rows]
        ):
            raise HTTPException(status_code=403, detail="Це замовлення належить іншому закладу")

        # 1. Оновлення полів замовлення
        order_updates = []
        order_params = [order_id]

        if data.scheduled_time is not None:
            clean_time = data.scheduled_time.strip() or None
            order_params.append(clean_time)
            order_updates.append(f"scheduled_time = ${len(order_params)}")
            existing_scheduled = clean_time

        if data.status is not None:
            clean_status = data.status.strip()
            GROUP_STATUS_MAP = {
                "pending_moderation": "pending",
                "confirmed": "accepted",
                "in_progress": "cooking",
                "cooking": "cooking",
                "ready": "ready",
                "ready_for_pickup": "ready",
                "on_the_way": "ready",
                "delivering": "ready",
                "completed": "ready",
                "rejected": "cancelled",
                "cancelled": "cancelled",
            }
            if clean_status not in GROUP_STATUS_MAP:
                raise HTTPException(
                    status_code=400,
                    detail=f"Неприпустимий статус замовлення: {clean_status}",
                )
            order_params.append(clean_status)
            order_updates.append(f"status = ${len(order_params)}")
            if clean_status != existing["status"]:
                status_changed = True
                new_status = clean_status

        if data.delivery_address is not None:
            clean_addr = data.delivery_address.strip()
            order_params.append(clean_addr)
            order_updates.append(f"delivery_address = ${len(order_params)}")
            existing_addr = clean_addr

        if data.contact_name is not None:
            order_params.append(data.contact_name.strip())
            order_updates.append(f"contact_name = ${len(order_params)}")

        if data.contact_phone is not None:
            order_params.append(data.contact_phone.strip())
            order_updates.append(f"contact_phone = ${len(order_params)}")

        if data.comment is not None:
            order_params.append(data.comment.strip())
            order_updates.append(f"comment = ${len(order_params)}")

        if order_updates:
            order_updates.append("updated_at = now()")
            await conn.execute(
                f"UPDATE orders SET {', '.join(order_updates)} WHERE id = $1", *order_params
            )

        # 2. Якщо передано новий склад страв (items) — перераховуємо та замінюємо
        if data.items is not None:
            if len(data.items) == 0:
                raise HTTPException(status_code=400, detail="Замовлення не може бути порожнім")

            primary_group_id = group_rows[0]["id"]

            await conn.execute(
                "DELETE FROM order_items WHERE order_group_id = ANY($1::int[])",
                [g["id"] for g in group_rows],
            )

            total_calculated_price = 0.0
            for item in data.items:
                options_price = sum(opt.price_delta * opt.qty for opt in item.options)
                item_subtotal = round(item.unit_price * item.qty + options_price, 2)
                total_calculated_price += item_subtotal

                item_db = await conn.fetchrow(
                    """
                    INSERT INTO order_items (
                        order_group_id, variant_id, product_name, variant_label,
                        unit_price, qty, subtotal
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                    """,
                    primary_group_id,
                    item.variant_id,
                    item.product_name,
                    item.variant_label,
                    item.unit_price,
                    item.qty,
                    item_subtotal,
                )
                saved_item_id = item_db["id"]

                for opt in item.options:
                    await conn.execute(
                        """
                        INSERT INTO order_item_options (
                            order_item_id, option_group_name, option_name, price_delta, qty
                        )
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        saved_item_id,
                        opt.option_group_name,
                        opt.option_name,
                        opt.price_delta,
                        opt.qty,
                    )

            await conn.execute(
                "UPDATE order_groups SET subtotal = $1 WHERE id = $2",
                total_calculated_price,
                primary_group_id,
            )
            await conn.execute(
                "UPDATE orders SET total_price = $1, updated_at = now() WHERE id = $2",
                total_calculated_price,
                order_id,
            )

    if status_changed and new_status and existing_tg_id:
        settings = get_settings()
        if settings.bot_token:
            final_total = total_calculated_price if data.items is not None else existing_total
            time_part = f" на {existing_scheduled}" if existing_scheduled else ""
            esc_addr = html.escape(existing_addr or "")
            if new_status == "confirmed":
                client_fulfillment = (
                    f"🛵 Очікуйте кур'єра{time_part} за адресою: <code>{esc_addr}</code>"
                    if existing_fulfillment == "delivery"
                    else f"🛍️ Замовлення буде чекати на вас у закладі{time_part}!"
                )
                client_text = (
                    f"🎉 <b>Ваше замовлення #{order_id} підтверджено!</b>\n\n"
                    f"Ми почнемо готувати його своєчасно до обраного часу{time_part}. 🍕✨\n"
                    f"{client_fulfillment}\n"
                    f"💵 Сума: {final_total:.2f} ₴"
                )
            elif new_status in ("in_progress", "cooking"):
                client_text = (
                    f"👨‍🍳 <b>Замовлення #{order_id} готується!</b>\n\n"
                    f"Наші кухарі вже готують ваші улюблені страви на кухні. 🔥"
                )
            elif new_status in ("ready", "ready_for_pickup"):
                client_text = (
                    f"🛍️ <b>Замовлення #{order_id} готове до видачі!</b>\n\n"
                    f"Ваше замовлення чекає на вас у закладі. Завітайте забрати! ✨"
                )
            elif new_status in ("on_the_way", "delivering"):
                client_text = (
                    f"🛵 <b>Замовлення #{order_id} передано кур'єру та прямує до вас!</b>\n\n"
                    f"Кур'єр уже прямує за адресою: <code>{esc_addr}</code> 💨"
                )
            elif new_status == "completed":
                await accrue_cashback_for_order(conn, order_id)
                client_text = (
                    f"🏁 <b>Замовлення #{order_id} виконано!</b>\n\n"
                    f"Смачного! Дякуємо, що обираєте Urban Bites. Будемо раді бачити вас знову! ❤️"
                )

            elif new_status == "rejected":
                client_text = (
                    f"😔 <b>Замовлення #{order_id} відхилено</b>\n\n"
                    f"На жаль, наразі ми не можемо виконати це замовлення. "
                    f"Менеджер закладу зателефонує вам для уточнення деталей."
                )
            elif new_status == "cancelled":
                client_text = (
                    f"🚫 <b>Замовлення #{order_id} скасовано</b>\n\n"
                    f"Ваше замовлення було скасовано менеджером закладу."
                )
            else:
                client_text = None

            if client_text:
                background_tasks.add_task(
                    send_telegram_message,
                    bot_token=settings.bot_token,
                    chat_id=existing_tg_id,
                    text=client_text,
                    parse_mode="HTML",
                )

    return await get_admin_order(order_id, pool, staff)


@router.post("/orders/{order_id}/notify")
async def notify_order_updated(
    order_id: int,
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Надсилання оновленого чека / статусу замовлення клієнту в Telegram."""
    settings = get_settings()
    if not settings.bot_token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN не налаштовано")

    order = await get_admin_order(order_id, pool, staff)
    if not order.telegram_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "У цього замовлення немає прив'язаного Telegram-акаунта клієнта "
                "(замовлення з веб-сайту)."
            ),
        )

    items_text_list = []
    for g in order.groups:
        for it in g.items:
            opts_str = ""
            if it.options:
                opts = ", ".join(
                    f"{html.escape(o.option_name)}" + (f" ×{o.qty}" if o.qty > 1 else "")
                    for o in it.options
                )
                opts_str = f"\n   <i>↳ {opts}</i>"
            p_name = html.escape(it.product_name)
            v_label = html.escape(it.variant_label)
            items_text_list.append(
                f"• <b>{p_name}</b> ({v_label}) × {it.qty} — {it.subtotal:.2f} ₴{opts_str}"
            )
    items_block = "\n".join(items_text_list)

    time_line = f"⏰ <b>Бажаний час:</b> {order.scheduled_time}\n" if order.scheduled_time else ""

    text = (
        f"📝 <b>Оновлення замовлення #{order.id}</b>\n\n"
        f"Менеджер оновив деталі вашого замовлення:\n"
        f"{time_line}"
        f"📋 <b>Позиції:</b>\n{items_block}\n\n"
        f"💵 <b>Разом до сплати: {order.total_price:.2f} ₴</b>"
    )

    background_tasks.add_task(
        send_telegram_message,
        bot_token=settings.bot_token,
        chat_id=order.telegram_id,
        text=text,
        parse_mode="HTML",
    )
    return {"status": "ok", "message": "Сповіщення надіслано клієнту"}
