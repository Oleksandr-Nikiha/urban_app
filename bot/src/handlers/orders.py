import contextlib
import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery

from src.db.connection import get_pool
from src.keyboards.orders import (
    build_all_statuses_keyboard,
    build_order_keyboard,
    build_time_keyboard,
)
from src.utils.bonus_calculator import (
    process_order_completion_bonuses_bot,
    refund_order_bonuses_bot,
)
from src.utils.order_helpers import (
    GROUP_STATUS_MAP,
    KYIV_TZ,
    STATUS_TITLES,
    calculate_new_time,
    check_manager_permission,
    get_bot_username,
    get_client_status_message,
    get_minutes_until_scheduled,
    set_bot_username,
    update_admin_message_text,
)

logger = logging.getLogger(__name__)

router = Router(name="orders")


@router.callback_query(
    F.data.startswith("order:confirm:")
    | F.data.startswith("order:reject:")
    | F.data.startswith("order:status:")
)
async def handle_order_status_change(callback: CallbackQuery) -> None:
    """
    Обробляє зміну статусу замовлення:
    - confirm/reject для зворотної сумісності зі старими кнопками
    - order:status:<order_id>:<new_status> для всіх переходів
    Логіка підтвердження (2.2, 2.3):
    - якщо замовлення на час і > 30 хв: 'confirmed'
    - якщо замовлення на найближчий час або <= 30 хв: одразу 'in_progress'
    """
    if not callback.data:
        await callback.answer("Некоректні дані кнопки")
        return

    parts = callback.data.split(":")
    if len(parts) == 3 and parts[0] == "order" and parts[1] in ("confirm", "reject"):
        action, order_id_str = parts[1], parts[2]
        requested_status = "confirmed" if action == "confirm" else "rejected"
    elif len(parts) == 4 and parts[0] == "order" and parts[1] == "status":
        order_id_str, requested_status = parts[2], parts[3]
    else:
        await callback.answer("Некоректний формат команди")
        return

    try:
        order_id = int(order_id_str)
    except ValueError:
        await callback.answer("Некоректний ID замовлення")
        return

    if requested_status not in GROUP_STATUS_MAP:
        await callback.answer("Невідомий статус замовлення", show_alert=True)
        return

    pool = get_pool()
    user_id = callback.from_user.id
    chat_id = callback.message.chat.id if callback.message else None

    allowed, err_msg = await check_manager_permission(pool, user_id, order_id, chat_id=chat_id)
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    manager_name = (
        f"@{callback.from_user.username}"
        if callback.from_user.username
        else callback.from_user.full_name
    )

    async with pool.acquire() as conn, conn.transaction():
        order = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, fulfillment_type, delivery_address,
                   contact_name, contact_phone, total_price, scheduled_time
            FROM orders
            WHERE id = $1
            FOR UPDATE
            """,
            order_id,
        )

        if not order:
            await callback.answer("Замовлення не знайдено в базі", show_alert=True)
            return

        current_status = order["status"]

        # Логіка визначення статусу при підтвердженні менеджером
        new_status = requested_status
        if requested_status == "confirmed":
            mins_left = get_minutes_until_scheduled(order["scheduled_time"])
            new_status = (
                "confirmed" if mins_left is not None and mins_left > 30 else "in_progress"
            )

        if current_status == new_status:
            status_title = STATUS_TITLES.get(new_status, new_status)
            await callback.answer(f"Замовлення вже має статус '{status_title}'")
            return

        group_status = GROUP_STATUS_MAP[new_status]

        await conn.execute(
            "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2",
            new_status,
            order_id,
        )
        await conn.execute(
            "UPDATE order_groups SET status = $1 WHERE order_id = $2",
            group_status,
            order_id,
        )

        if new_status in ("completed", "delivered"):
            await process_order_completion_bonuses_bot(conn, order_id)
        elif new_status in ("rejected", "cancelled"):
            await refund_order_bonuses_bot(conn, order_id)

    # Сповіщення клієнта
    client_msg = get_client_status_message(
        order_id=order_id,
        status=new_status,
        fulfillment_type=order["fulfillment_type"],
        addr=order["delivery_address"],
        total_price=float(order["total_price"]),
        scheduled_time=order["scheduled_time"],
    )
    if client_msg and order["telegram_id"]:
        try:
            await callback.bot.send_message(
                chat_id=order["telegram_id"],
                text=client_msg,
                parse_mode="HTML",
            )
        except Exception as e:
            logger.warning("Не вдалося сповістити клієнта tg_id=%s: %s", order["telegram_id"], e)

    # Оновлення повідомлення в адмін-групі
    st_title = STATUS_TITLES.get(new_status, new_status)
    status_label = f"{st_title} (співробітник {manager_name})"
    new_keyboard = build_order_keyboard(order_id, new_status, order["fulfillment_type"])

    if callback.message:
        try:
            original_text = callback.message.html_text or callback.message.text or ""
            new_text = update_admin_message_text(original_text, status_label=status_label)
            await callback.message.edit_text(new_text, reply_markup=new_keyboard, parse_mode="HTML")
        except Exception as e:
            logger.warning("Не вдалося оновити повідомлення замовлення: %s", e)
            with contextlib.suppress(Exception):
                await callback.message.edit_reply_markup(reply_markup=new_keyboard)

    await callback.answer(f"Статус оновлено: {st_title}")


@router.callback_query(F.data.startswith("order:status_menu:"))
async def handle_order_status_menu(callback: CallbackQuery) -> None:
    """Відкриває підменю вибору будь-якого доступного статусу."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 3:
        return
    try:
        order_id = int(parts[2])
    except ValueError:
        return

    pool = get_pool()
    chat_id = callback.message.chat.id if callback.message else None
    allowed, err_msg = await check_manager_permission(
        pool, callback.from_user.id, order_id, chat_id=chat_id
    )
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    async with pool.acquire() as conn:
        order = await conn.fetchrow(
            "SELECT status, fulfillment_type FROM orders WHERE id = $1", order_id
        )

    if not order:
        await callback.answer("Замовлення не знайдено", show_alert=True)
        return

    keyboard = build_all_statuses_keyboard(order_id, order["status"], order["fulfillment_type"])
    if callback.message:
        with contextlib.suppress(Exception):
            await callback.message.edit_reply_markup(reply_markup=keyboard)
    await callback.answer()


@router.callback_query(F.data.startswith("order:time_menu:"))
async def handle_order_time_menu(callback: CallbackQuery) -> None:
    """Відкриває підменю швидкої зміни часу доставки."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 3:
        return
    try:
        order_id = int(parts[2])
    except ValueError:
        return

    pool = get_pool()
    chat_id = callback.message.chat.id if callback.message else None
    allowed, err_msg = await check_manager_permission(
        pool, callback.from_user.id, order_id, chat_id=chat_id
    )
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    keyboard = build_time_keyboard(order_id)
    if callback.message:
        with contextlib.suppress(Exception):
            await callback.message.edit_reply_markup(reply_markup=keyboard)
    await callback.answer("Оберіть новий час доставки")


@router.callback_query(F.data.startswith("order:time_set:"))
async def handle_order_time_set(callback: CallbackQuery) -> None:
    """Встановлює новий час доставки, оновлює БД, повідомлення в чаті та сповіщає клієнта."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 4:
        await callback.answer("Некоректні дані")
        return

    try:
        order_id = int(parts[2])
    except ValueError:
        await callback.answer("Некоректний ID замовлення")
        return

    option = parts[3]

    pool = get_pool()
    chat_id = callback.message.chat.id if callback.message else None
    allowed, err_msg = await check_manager_permission(
        pool, callback.from_user.id, order_id, chat_id=chat_id
    )
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    manager_name = (
        f"@{callback.from_user.username}"
        if callback.from_user.username
        else callback.from_user.full_name
    )

    async with pool.acquire() as conn:
        order = await conn.fetchrow(
            """
            SELECT id, telegram_id, status, scheduled_time, fulfillment_type
            FROM orders
            WHERE id = $1
            """,
            order_id,
        )
        if not order:
            await callback.answer("Замовлення не знайдено", show_alert=True)
            return

        current_scheduled = order["scheduled_time"]
        new_time = calculate_new_time(current_scheduled, option)

        await conn.execute(
            "UPDATE orders SET scheduled_time = $1, updated_at = now() WHERE id = $2",
            new_time,
            order_id,
        )

    # Сповіщення клієнта про зміну часу
    if order["telegram_id"]:
        time_desc = f"На {new_time}" if new_time else "Якнайшвидше"
        client_time_msg = (
            f"⏱ <b>Оновлено час для замовлення #{order_id}</b>\n\n"
            f"Новий очікуваний час доставки/видачі: <b>{time_desc}</b> 🕒\n"
            f"Дякуємо за терпіння!"
        )
        try:
            await callback.bot.send_message(
                chat_id=order["telegram_id"],
                text=client_time_msg,
                parse_mode="HTML",
            )
        except Exception as e:
            logger.warning(
                "Не вдалося сповістити клієнта tg_id=%s про зміну часу: %s",
                order["telegram_id"],
                e,
            )

    # Оновлення повідомлення в групі
    time_display = (
        f"На {new_time} (змінено {manager_name})"
        if new_time
        else f"Якнайшвидше (змінено {manager_name})"
    )
    keyboard = build_order_keyboard(order_id, order["status"], order["fulfillment_type"])

    if callback.message:
        try:
            original_text = callback.message.html_text or callback.message.text or ""
            new_text = update_admin_message_text(original_text, time_label=time_display)
            await callback.message.edit_text(new_text, reply_markup=keyboard, parse_mode="HTML")
        except Exception as e:
            logger.warning("Не вдалося оновити текст повідомлення при зміні часу: %s", e)
            with contextlib.suppress(Exception):
                await callback.message.edit_reply_markup(reply_markup=keyboard)

    resp_text = f"Час змінено на {new_time}" if new_time else "Час змінено на 'Якнайшвидше'"
    await callback.answer(resp_text)


@router.callback_query(F.data.startswith("order:back:"))
async def handle_order_back(callback: CallbackQuery) -> None:
    """Повертає користувача до головної панелі дій замовлення."""
    if not callback.data:
        return
    parts = callback.data.split(":")
    if len(parts) != 3:
        return
    try:
        order_id = int(parts[2])
    except ValueError:
        return

    pool = get_pool()
    chat_id = callback.message.chat.id if callback.message else None
    allowed, err_msg = await check_manager_permission(
        pool, callback.from_user.id, order_id, chat_id=chat_id
    )
    if not allowed:
        await callback.answer(err_msg or "⛔ Доступ заборонено", show_alert=True)
        return

    async with pool.acquire() as conn:
        order = await conn.fetchrow(
            "SELECT status, fulfillment_type FROM orders WHERE id = $1", order_id
        )

    if not order:
        await callback.answer("Замовлення не знайдено", show_alert=True)
        return

    keyboard = build_order_keyboard(order_id, order["status"], order["fulfillment_type"])
    if callback.message:
        with contextlib.suppress(Exception):
            await callback.message.edit_reply_markup(reply_markup=keyboard)
    await callback.answer()


__all__ = [
    "GROUP_STATUS_MAP",
    "KYIV_TZ",
    "STATUS_TITLES",
    "build_all_statuses_keyboard",
    "build_order_keyboard",
    "build_time_keyboard",
    "calculate_new_time",
    "check_manager_permission",
    "get_bot_username",
    "get_client_status_message",
    "get_minutes_until_scheduled",
    "handle_order_back",
    "handle_order_status_change",
    "handle_order_status_menu",
    "handle_order_time_menu",
    "handle_order_time_set",
    "router",
    "set_bot_username",
    "update_admin_message_text",
]
