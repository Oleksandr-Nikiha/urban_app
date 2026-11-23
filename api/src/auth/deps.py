import asyncpg
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from src.auth.admin_token import verify_admin_token
from src.auth.telegram_init_data import validate_init_data
from src.config import get_settings
from src.db.connection import get_pool

init_data_header = APIKeyHeader(
    name="X-Telegram-Init-Data",
    scheme_name="TelegramInitData",
    description=(
        "Рядок Telegram.WebApp.initData. Для локального тестування "
        "згенеруйте його: python3 scripts/generate_test_init_data.py $BOT_TOKEN"
    ),
    auto_error=False,
)

admin_token_header = APIKeyHeader(
    name="X-Admin-Token",
    scheme_name="AdminToken",
    description="Токен адміністратора для доступу з комп'ютера",
    auto_error=False,
)


user_token_header = APIKeyHeader(
    name="X-Auth-Token",
    scheme_name="UserAuthToken",
    description="Токен авторизації веб-клієнта (X-Auth-Token)",
    auto_error=False,
)

auth_header = APIKeyHeader(
    name="Authorization",
    scheme_name="BearerAuth",
    description="Bearer токен авторизації",
    auto_error=False,
)


def _get_fallback_tokens(settings) -> list[str]:
    fn = getattr(settings, "fallback_bot_token_list", None)
    if callable(fn):
        return fn()
    raw = getattr(settings, "fallback_bot_tokens", "")
    if isinstance(raw, str) and raw:
        return [t.strip() for t in raw.split(",") if t.strip()]
    return []


async def get_init_data(
    init_data_raw: str | None = Depends(init_data_header), settings=Depends(get_settings)
) -> dict:
    """
    Дістає заголовок X-Telegram-Init-Data, валідує його
    та повертає розпарсений словник із даними.
    """
    if not init_data_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Відсутній заголовок X-Telegram-Init-Data",
        )

    try:
        return validate_init_data(
            init_data=init_data_raw,
            bot_token=settings.bot_token,
            fallback_tokens=_get_fallback_tokens(settings),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Помилка авторизації: {e}"
        ) from e


async def require_telegram_or_staff(
    init_data_raw: str | None = Depends(init_data_header),
    admin_token_raw: str | None = Depends(admin_token_header),
    settings=Depends(get_settings),
) -> bool:
    """
    Дозволяє доступ до каталогу та меню виключно через Telegram (додаток чи вебфрейм)
    або для персоналу закладу з валідним токеном адміністратора.
    Усі запити в обхід Telegram без токена персоналу блокуються.
    """
    fallback_tokens = _get_fallback_tokens(settings)
    if admin_token_raw:
        telegram_id = verify_admin_token(
            admin_token_raw, settings.bot_token, fallback_tokens
        )
        if telegram_id:
            return True

    if init_data_raw:
        try:
            validate_init_data(
                init_data=init_data_raw,
                bot_token=settings.bot_token,
                fallback_tokens=fallback_tokens,
            )
            return True
        except ValueError:
            pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Доступ до меню дозволено лише через Telegram або для адміністратора.",
    )


async def get_current_user(
    init_data_raw: str | None = Depends(init_data_header),
    admin_token_raw: str | None = Depends(admin_token_header),
    user_token_raw: str | None = Depends(user_token_header),
    bearer_raw: str | None = Depends(auth_header),
    settings=Depends(get_settings),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Авторизує користувача через X-Admin-Token, X-Telegram-Init-Data,
    X-Auth-Token або Bearer токен. Повертає запис користувача з бази даних.
    """
    fallback_tokens = _get_fallback_tokens(settings)

    # Підтримка Authorization: Bearer <token>
    staff_token_raw = None
    if isinstance(bearer_raw, str) and bearer_raw.startswith("Bearer "):
        bearer_token = bearer_raw[7:].strip()
        if bearer_token.startswith("u1."):
            user_token_raw = bearer_token
        elif bearer_token.startswith("v1."):
            admin_token_raw = bearer_token
        elif bearer_token.startswith("s1."):
            staff_token_raw = bearer_token
    elif isinstance(admin_token_raw, str) and admin_token_raw.startswith("s1."):
        staff_token_raw = admin_token_raw

    # 0. Токен співробітника POS (s1.staff_id...)
    if isinstance(staff_token_raw, str):
        from src.auth.admin_token import verify_staff_token

        staff_id = verify_staff_token(
            staff_token_raw, settings.bot_token, fallback_tokens
        )
        if staff_id:
            async with pool.acquire() as conn:
                staff_row = await conn.fetchrow(
                    """
                    SELECT m.id AS manager_id, m.id, m.telegram_id, m.role, m.location_id, m.is_active,
                           COALESCE(m.staff_name, u.first_name, 'Співробітник') AS staff_name,
                           l.name AS location_name,
                           COALESCE(u.full_name, m.staff_name, 'Співробітник') AS full_name,
                           u.phone
                    FROM managers m
                    LEFT JOIN users u ON u.telegram_id = m.telegram_id
                    LEFT JOIN locations l ON l.id = m.location_id
                    WHERE m.id = $1 AND m.is_active = true
                    """,
                    staff_id,
                )
            if staff_row:
                return staff_row
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Обліковий запис співробітника деактивовано або не знайдено",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недійсний або прострочений токен персоналу",
        )

    # 1. Токен користувача веб-додатку (u1.user_id...)
    if isinstance(user_token_raw, str):
        from src.auth.admin_token import verify_user_token

        user_id = verify_user_token(
            user_token_raw, settings.bot_token, fallback_tokens
        )
        if user_id:
            async with pool.acquire() as conn:
                user_row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
            if user_row:
                return user_row

    # 2. Токен адміністратора (v1.telegram_id...)
    telegram_id: int | None = None
    if isinstance(admin_token_raw, str):
        telegram_id = verify_admin_token(
            admin_token_raw, settings.bot_token, fallback_tokens
        )
        if not telegram_id and not init_data_raw:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недійсний або прострочений токен адміністратора (X-Admin-Token)",
            )
    elif isinstance(init_data_raw, str):
        try:
            init_data = validate_init_data(
                init_data=init_data_raw,
                bot_token=settings.bot_token,
                fallback_tokens=fallback_tokens,
            )
            user_data = init_data.get("user", {})
            telegram_id = user_data.get("id")
        except ValueError as e:
            if not user_token_raw:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Помилка авторизації: {e}"
                ) from e
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Відсутній заголовок авторизації "
                "(X-Telegram-Init-Data, X-Auth-Token або X-Admin-Token)"
            ),
        )



    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не вдалося отримати telegram_id з даних авторизації",
        )

    async with pool.acquire() as conn:
        user_row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)

    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Користувача не зареєстровано"
        )

    return user_row


async def get_optional_current_user(
    init_data_raw: str | None = Depends(init_data_header),
    admin_token_raw: str | None = Depends(admin_token_header),
    user_token_raw: str | None = Depends(user_token_header),
    bearer_raw: str | None = Depends(auth_header),
    settings=Depends(get_settings),
    pool: asyncpg.Pool = Depends(get_pool),
) -> asyncpg.Record | None:
    """
    Повертає поточного користувача, якщо надано валідний заголовок авторизації,
    або None для анонімних запитів.
    """
    if not (init_data_raw or admin_token_raw or user_token_raw or bearer_raw):
        return None
    try:
        return await get_current_user(
            init_data_raw=init_data_raw,
            admin_token_raw=admin_token_raw,
            user_token_raw=user_token_raw,
            bearer_raw=bearer_raw,
            settings=settings,
            pool=pool,
        )
    except HTTPException:
        return None


async def get_current_staff(
    user: asyncpg.Record = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
) -> asyncpg.Record:
    """
    Перевіряє, чи є користувач активним менеджером або адміністратором.
    Повертає запис зі штату з полями role, location_id, is_active тощо.
    """
    # Якщо user вже містить запис менеджера (з s1 staff token):
    if "manager_id" in user or ("role" in user and "is_active" in user and user.get("is_active")):
        return user

    async with pool.acquire() as conn:
        staff_row = await conn.fetchrow(
            """
            SELECT m.id, m.telegram_id, m.role, m.location_id, m.is_active,
                   COALESCE(m.staff_name, u.first_name, 'Співробітник') AS staff_name,
                   l.name AS location_name,
                   COALESCE(u.full_name, m.staff_name, 'Співробітник') AS full_name,
                   u.phone
            FROM managers m
            JOIN users u ON u.telegram_id = m.telegram_id
            LEFT JOIN locations l ON l.id = m.location_id
            WHERE m.telegram_id = $1 AND m.is_active = true
            """,
            user["telegram_id"],
        )

    if not staff_row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ заборонено. Тільки для персоналу закладу.",
        )

    return staff_row


async def get_current_admin(
    staff: asyncpg.Record = Depends(get_current_staff),
) -> asyncpg.Record:
    """
    Перевіряє, чи має користувач найвищу роль 'admin'.
    """
    if staff["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ заборонено. Потрібні права головного адміністратора.",
        )

    return staff
