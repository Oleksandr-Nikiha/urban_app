import html
import logging
from typing import Any

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from src.auth.deps import get_current_user, get_optional_current_user
from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.order import (
    OrderCreateIn,
    OrderOut,
    RepeatOrderIn,
    RepeatOrderOut,
    WebOrderCreateIn,
)
from src.services.order_notifier import OrderNotifier
from src.services.order_service import KYIV_TZ, OrderService
from src.services.telegram_client import send_telegram_message

__all__ = [
    "KYIV_TZ",
    "router",
    "_validate_scheduled_time",
    "send_order_to_manager",
    "send_order_to_customer",
    "_fetch_order_by_id",
]

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["Orders"], dependencies=[Depends(rate_limiter)])


def _validate_scheduled_time(
    scheduled_str: str,
    delivery_start_time: str,
    delivery_end_time: str,
    target_location_name: str,
    fulfillment_type: str,
) -> None:
    return OrderService.validate_scheduled_time(
        scheduled_str=scheduled_str,
        delivery_start_time=delivery_start_time,
        delivery_end_time=delivery_end_time,
        target_location_name=target_location_name,
        fulfillment_type=fulfillment_type,
    )


async def send_order_to_manager(order_id: int, order_data: dict[str, Any], settings) -> None:
    await OrderNotifier.send_manager_notification(order_id, order_data, settings)


async def send_order_to_customer(
    order_id: int, order_data: dict[str, Any], settings, customer_telegram_id: int | None = None
) -> None:
    await OrderNotifier.send_customer_notification(
        order_id, order_data, settings, customer_telegram_id
    )


async def _fetch_order_by_id(
    conn, order_id: int, telegram_id: int | None = None
) -> OrderOut | None:
    return await OrderService.fetch_order_by_id(conn, order_id, telegram_id)


@router.post("/web", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_web_order(
    payload: WebOrderCreateIn,
    background_tasks: BackgroundTasks,
    current_user: asyncpg.Record | None = Depends(get_optional_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Створює нове замовлення безпосередньо з веб-сайту закладу.
    Підтримує анонімне замовлення, а для використання бонусів вимагає авторизацію.
    Сповіщення персоналу надсилається в Telegram-чат із позначкою сайту.
    """
    settings = get_settings()

    async with pool.acquire() as conn:
        order, customer_tg_id, notif_data = await OrderService.create_web_order(
            conn, payload, authenticated_user=current_user
        )

    background_tasks.add_task(send_order_to_manager, order.id, notif_data, settings)
    if customer_tg_id:
        background_tasks.add_task(
            send_order_to_customer,
            order.id,
            notif_data,
            settings,
            customer_tg_id,
        )

    return order


@router.get("/web/history", response_model=list[OrderOut])
async def get_web_orders_history(
    phone: str | None = Query(None, description="Номер телефону клієнта"),
    telegram_id: int | None = Query(None, description="Telegram ID клієнта"),
    limit: int = Query(25, ge=1, le=50),
    current_user: asyncpg.Record | None = Depends(get_optional_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Отримує історію замовлень для сайту.
    Вимагає авторизацію користувача або персонал для захисту історії від несанкціонованого доступу.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Для перегляду історії замовлень потрібна авторизація",
        )

    is_staff = (
        current_user.get("role") in ("admin", "manager", "cashier", "waiter")
        or "manager_id" in current_user
    )

    clean_phone = phone.strip() if phone else None
    if not is_staff:
        user_phone = current_user.get("phone")
        user_tg = current_user.get("telegram_id")
        if telegram_id and user_tg and telegram_id != user_tg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ до історії замовлень іншого користувача заборонено",
            )
        if clean_phone and user_phone:
            from src.schemas.user import normalize_phone

            try:
                p1 = normalize_phone(clean_phone)
                p2 = normalize_phone(user_phone)
            except Exception:
                p1 = clean_phone
                p2 = user_phone
            if p1 != p2 and not (user_tg and telegram_id == user_tg):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Доступ до історії замовлень іншого користувача заборонено",
                )
        clean_phone = clean_phone or user_phone
        telegram_id = telegram_id or user_tg

    async with pool.acquire() as conn:
        return await OrderService.fetch_web_orders_history(
            conn=conn,
            phone=clean_phone,
            telegram_id=telegram_id,
            limit=limit,
        )


@router.get("/web/{order_id}", response_model=OrderOut)
async def get_web_order_by_id(
    order_id: int,
    token: str | None = Query(None, description="Токен безпечного відстеження замовлення"),
    current_user: asyncpg.Record | None = Depends(get_optional_current_user),
    settings=Depends(get_settings),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Отримує статус замовлення за його ID.
    Захищає конфіденційні дані (IDOR) перевіркою tracking_token або автентифікації власника.
    """
    async with pool.acquire() as conn:
        order = await OrderService.fetch_order_by_id(conn, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")

        from src.auth.admin_token import (
            create_order_tracking_token,
            verify_order_tracking_token,
        )
        from src.auth.deps import _get_fallback_tokens

        # 1. Перевірка підписаного токена відстеження
        is_token_valid = False
        if token:
            fallback = _get_fallback_tokens(settings)
            is_token_valid = verify_order_tracking_token(
                order_id, token, settings.bot_token, fallback
            )

        # 2. Перевірка авторизованого сеансу (власник або персонал)
        is_owner_or_staff = False
        if current_user:
            is_staff = (
                current_user.get("role") in ("admin", "manager", "cashier", "waiter")
                or "manager_id" in current_user
            )
            is_owner = (
                (current_user.get("telegram_id") and current_user.get("telegram_id") == order.telegram_id)
                or (current_user.get("phone") and current_user.get("phone") == order.contact_phone)
            )
            is_owner_or_staff = is_staff or is_owner

        if not (is_token_valid or is_owner_or_staff):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ до деталей замовлення заборонено. Потрібна авторизація або дійсний токен відстеження.",
            )

        order.tracking_token = create_order_tracking_token(order.id, settings.bot_token)
        return order


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreateIn,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Створює нове замовлення з поточного кошика користувача.
    Підтримує оформлення замовлення для конкретного закладу.
    """
    settings = get_settings()
    telegram_id = user["telegram_id"]

    if user.get("is_blocked"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш акаунт заблоковано адміністрацією. Оформлення замовлень недоступне.",
        )

    async with pool.acquire() as conn, conn.transaction():
        order, notif_data, is_duplicate = await OrderService.create_cart_order(conn, user, payload)

    if is_duplicate:
        return order

    background_tasks.add_task(send_order_to_manager, order.id, notif_data, settings)
    background_tasks.add_task(
        send_order_to_customer,
        order.id,
        notif_data,
        settings,
        telegram_id,
    )
    return order


@router.get("", response_model=list[OrderOut])
async def get_user_orders(
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримує історію замовлень поточного користувача."""
    async with pool.acquire() as conn:
        return await OrderService.fetch_user_orders(conn, user["telegram_id"])


@router.get("/{order_id}", response_model=OrderOut)
async def get_order_by_id(
    order_id: int,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Отримує деталі конкретного замовлення."""
    telegram_id = user["telegram_id"]

    async with pool.acquire() as conn:
        order = await OrderService.fetch_order_by_id(conn, order_id, telegram_id)
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Скасування замовлення клієнтом (доступно, поки замовлення очікує підтвердження)."""
    telegram_id = user["telegram_id"]
    settings = get_settings()

    async with pool.acquire() as conn:
        updated, order_row = await OrderService.cancel_user_order(conn, order_id, telegram_id)

    if settings.manager_chat_id and settings.bot_token:
        c_name = html.escape(str(order_row["contact_name"]))
        c_phone = html.escape(str(order_row["contact_phone"]))
        manager_msg = (
            f"🚫 <b>Клієнт скасував замовлення #{order_id}</b>\n\n"
            f"👤 Клієнт: <b>{c_name}</b> ({c_phone})\n"
            f"💵 Сума: {float(order_row['total_price']):.2f} ₴\n"
            f"<i>Замовлення автоматично позначено як скасоване.</i>"
        )
        background_tasks.add_task(
            send_telegram_message,
            bot_token=settings.bot_token,
            chat_id=settings.manager_chat_id,
            text=manager_msg,
            parse_mode="HTML",
        )

    return updated


@router.post("/{order_id}/repeat", response_model=RepeatOrderOut)
async def repeat_order(
    order_id: int,
    payload: RepeatOrderIn | None = None,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Повторює раніше оформлене замовлення, додаючи його позиції до кошика за АКТУАЛЬНИМИ цінами.
    Перевіряє доступність страв та опцій у меню на поточний момент.
    """
    telegram_id = user["telegram_id"]
    replace_cart = payload.replace_cart if payload is not None else True

    async with pool.acquire() as conn:
        return await OrderService.repeat_user_order(
            conn, pool, order_id, telegram_id, replace_cart=replace_cart
        )
