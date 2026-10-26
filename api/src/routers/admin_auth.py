import logging
import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.auth.deps import get_init_data
from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.auth import (
    AdminTokenOut,
    AuthSessionOut,
    AuthStatusOut,
    TelegramWidgetAuthIn,
)
from src.services.telegram_client import fetch_bot_username

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/auth",
    tags=["admin-auth"],
    dependencies=[Depends(rate_limiter)],
)

__all__ = [
    "AuthSessionOut",
    "AuthStatusOut",
    "TelegramWidgetAuthIn",
    "AdminTokenOut",
    "router",
]

_cached_bot_username: str | None = None


async def _get_bot_username(bot_token: str) -> str:
    global _cached_bot_username
    if _cached_bot_username:
        return _cached_bot_username
    try:
        settings = get_settings()
        if settings.bot_username and settings.bot_username != "domapizza_bot":
            _cached_bot_username = settings.bot_username
            return _cached_bot_username
    except Exception:
        pass
    try:
        username = await fetch_bot_username(bot_token)
        if username:
            _cached_bot_username = username
            return _cached_bot_username
    except Exception as e:
        logger.warning("Не вдалося автоматично визначити username бота: %s", e)
    return "urban_bites_tst_bot"


def generate_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


@router.post("/telegram-widget", response_model=AdminTokenOut)
async def admin_telegram_widget_login(
    payload: TelegramWidgetAuthIn,
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """
    Авторизація адміністратора з браузера через офіційний Telegram Login Widget.
    """
    from src.auth.admin_token import create_admin_token
    from src.auth.telegram_widget import validate_telegram_widget_data

    try:
        validate_telegram_widget_data(payload.model_dump(), settings.bot_token)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Невалідні дані Telegram Login: {e}",
        ) from e

    telegram_id = payload.id
    async with pool.acquire() as conn:
        manager = await conn.fetchrow(
            """
            SELECT m.id, m.telegram_id, m.role, m.location_id, m.is_active, u.full_name
            FROM managers m
            LEFT JOIN users u ON u.telegram_id = m.telegram_id
            WHERE m.telegram_id = $1
            """,
            telegram_id,
        )

        if not manager or not manager["is_active"]:
            logger.warning("Спроба входу в адмінку неавторизованого telegram_id=%s", telegram_id)
            raise HTTPException(
                status_code=403,
                detail=(
                    "У доступі відмовлено: ваш Telegram-акаунт не зареєстровано як адміністратора"
                ),
            )

        token = create_admin_token(telegram_id, settings.bot_token)
        return AdminTokenOut(
            token=token,
            telegram_id=telegram_id,
            name=manager["full_name"] or payload.first_name,
            role=manager["role"],
            location_id=manager["location_id"],
        )


@router.post("/telegram-webapp", response_model=AdminTokenOut)
async def admin_telegram_webapp_login(
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
    init_data: dict = Depends(get_init_data),
):
    """
    Миттєва авторизація персоналу при відкритті адмінки всередині Telegram (Webview / iframe).
    """
    from src.auth.admin_token import create_admin_token

    user_data = init_data.get("user")
    if not user_data or "id" not in user_data:
        raise HTTPException(status_code=400, detail="Відсутні дані користувача в initData")

    telegram_id = int(user_data["id"])
    async with pool.acquire() as conn:
        manager = await conn.fetchrow(
            """
            SELECT m.id, m.telegram_id, m.role, m.location_id, m.is_active, u.full_name
            FROM managers m
            LEFT JOIN users u ON u.telegram_id = m.telegram_id
            WHERE m.telegram_id = $1
            """,
            telegram_id,
        )

        if not manager or not manager["is_active"]:
            raise HTTPException(
                status_code=403,
                detail="У доступі відмовлено: ви не є діючим адміністратором",
            )

        token = create_admin_token(telegram_id, settings.bot_token)
        return AdminTokenOut(
            token=token,
            telegram_id=telegram_id,
            name=manager["full_name"] or user_data.get("first_name"),
            role=manager["role"],
            location_id=manager["location_id"],
        )


@router.post("/session", response_model=AuthSessionOut)
async def create_auth_session(
    pool: asyncpg.Pool = Depends(get_pool),
    settings=Depends(get_settings),
):
    """Створює сесію авторизації в адмінку для входу з комп'ютера (дійсна 10 хв)."""
    session_id = uuid.uuid4()
    code = generate_code()
    expires_at = datetime.now(UTC) + timedelta(minutes=10)

    async with pool.acquire() as conn:
        # Автоматичне фонове очищення прострочених та використаних сесій (SEC-11)
        await conn.execute(
            """
            DELETE FROM admin_auth_sessions
            WHERE expires_at < now() - INTERVAL '1 hour'
               OR (status = 'consumed' AND created_at < now() - INTERVAL '1 day')
            """
        )

        await conn.execute(
            """
            INSERT INTO admin_auth_sessions (id, code, status, expires_at)
            VALUES ($1, $2, 'pending', $3)
            """,
            session_id,
            code,
            expires_at,
        )

    bot_username = await _get_bot_username(settings.bot_token)
    bot_url = f"https://t.me/{bot_username}?start=admin_{code}"
    tg_url = f"tg://resolve?domain={bot_username}&start=admin_{code}"

    return AuthSessionOut(
        session_id=str(session_id),
        bot_url=bot_url,
        tg_url=tg_url,
        code=code,
        expires_in=600,
    )


@router.get("/session/{session_id}", response_model=AuthStatusOut)
async def check_auth_session(
    session_id: uuid.UUID,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Опитування статусу сесії з фронтенду."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT status, token, expires_at
            FROM admin_auth_sessions
            WHERE id = $1
            """,
            session_id,
        )

        if not row:
            raise HTTPException(status_code=404, detail="Сесію не знайдено")

        now = datetime.now(UTC)
        if row["expires_at"] < now and row["status"] == "pending":
            return AuthStatusOut(status="expired", error="Час дії сесії вичерпано")

        token = row["token"] if row["status"] == "approved" else None

        # Захист: маркуємо схвалену сесію як 'consumed' після першого зчитування токена
        if row["status"] == "approved":
            await conn.execute(
                "UPDATE admin_auth_sessions SET status = 'consumed' WHERE id = $1",
                session_id,
            )

    return AuthStatusOut(
        status=row["status"],
        token=token,
    )
