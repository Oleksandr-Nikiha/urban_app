import logging

import asyncpg
from fastapi import APIRouter, Depends

from src.auth.deps import get_current_user
from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.auth import (
    PhoneLoginIn,
    TelegramWidgetAuthIn,
    WebProfileUpdateIn,
)
from src.schemas.bonus import BonusTransactionOut
from src.schemas.user import UserOut
from src.services.web_auth_service import WebAuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["WebAuth"], dependencies=[Depends(rate_limiter)])

__all__ = [
    "TelegramWidgetAuthIn",
    "PhoneLoginIn",
    "WebProfileUpdateIn",
    "WebAuthService",
    "router",
]


@router.post("/telegram-widget", response_model=UserOut)
async def auth_telegram_widget(
    payload: TelegramWidgetAuthIn,
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Авторизація клієнта через офіційний Telegram Login Widget на публічному веб-сайті.
    Знаходить або створює обліковий запис у таблиці users та проставляє верифікацію.
    """
    async with pool.acquire() as conn:
        return await WebAuthService.auth_telegram_widget(
            conn=conn,
            payload=payload,
            bot_token=settings.bot_token,
        )


@router.post("/phone-login", response_model=UserOut)
async def auth_phone_login(
    payload: PhoneLoginIn,
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Прямий вхід та синхронізація за номером телефону (для публічних сайтів).
    Знаходить існуючого клієнта або створює новий обліковий запис із 50 бонусами URBAN CLUB.
    """
    async with pool.acquire() as conn:
        return await WebAuthService.auth_phone_login(
            conn=conn,
            payload=payload,
            bot_token=settings.bot_token,
        )


@router.get("/web-profile", response_model=UserOut)
async def get_web_profile(
    telegram_id: int | None = None,
    phone: str | None = None,
    user: asyncpg.Record = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Отримання актуальних даних профілю з бази даних для авторизованого клієнта.
    Захищає конфіденційні дані (адреси, ПІБ, бонуси) від несанкціонованого парсингу.
    """
    async with pool.acquire() as conn:
        return await WebAuthService.get_web_profile(
            conn=conn,
            current_user=user,
            telegram_id=telegram_id,
            phone=phone,
            bot_token=settings.bot_token,
        )


@router.post("/web-profile", response_model=UserOut)
async def update_web_profile(
    payload: WebProfileUpdateIn,
    user: asyncpg.Record = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Оновлення контактних даних поточного авторизованого користувача.
    Синхронізує телефон, ім'я та адресу виключно для поточного сеансу.
    """
    async with pool.acquire() as conn:
        return await WebAuthService.update_web_profile(
            conn=conn,
            current_user=user,
            payload=payload,
            bot_token=settings.bot_token,
        )


@router.get("/bonuses/history", response_model=list[BonusTransactionOut])
async def get_web_user_bonus_history(
    phone: str | None = None,
    telegram_id: int | None = None,
    limit: int = 50,
    user: asyncpg.Record = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Повертає історію нарахувань та списань бонусів для авторизованого користувача."""
    async with pool.acquire() as conn:
        return await WebAuthService.get_bonus_history(
            conn=conn,
            current_user=user,
            phone=phone,
            telegram_id=telegram_id,
            limit=limit,
        )
