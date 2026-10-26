import logging

import asyncpg
from fastapi import APIRouter, Depends

from src.auth.deps import (
    get_current_user,
    init_data_header,
)
from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.bonus import BonusTransactionOut
from src.schemas.user import RegisterIn, UserOut, UserUpdateIn
from src.services.user_helpers import _user_to_out
from src.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Users"], dependencies=[Depends(rate_limiter)])


@router.post("/register", response_model=UserOut)
async def register_user(
    payload: RegisterIn,
    init_data_raw: str | None = Depends(init_data_header),
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Реєструє нового користувача.
    Бере telegram_id з валідованих даних Telegram initData.
    """
    async with pool.acquire() as conn:
        return await UserService.register_user(
            conn=conn,
            payload=payload,
            init_data_raw=init_data_raw,
            bot_token=settings.bot_token,
        )


@router.get("/me", response_model=UserOut)
async def get_me(user=Depends(get_current_user), settings=Depends(get_settings)):
    """Повертає профіль поточного авторизованого користувача."""
    return _user_to_out(user, settings.bot_token)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdateIn,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Оновлює дані профілю: ім'я, прізвище, основну та додаткову адреси,
    а також номер телефону (якщо він ще не був верифікований).
    """
    async with pool.acquire() as conn:
        return await UserService.update_profile(
            conn=conn,
            user=user,
            payload=payload,
            bot_token=settings.bot_token,
        )


@router.get("/me/bonuses/history", response_model=list[BonusTransactionOut])
async def get_my_bonus_history(
    limit: int = 50,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Повертає історію нарахувань та списань бонусів для поточного користувача."""
    async with pool.acquire() as conn:
        return await UserService.get_bonus_history(
            conn=conn,
            user_id=user["id"],
            limit=limit,
        )
