import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.deps import (
    get_current_user,
    init_data_header,
)
from src.auth.telegram_init_data import validate_init_data
from src.config import get_settings
from src.db.connection import get_pool
from src.middleware.rate_limiter import rate_limiter
from src.schemas.bonus import BonusTransactionOut
from src.schemas.user import RegisterIn, UserOut, UserUpdateIn
from src.services.user_helpers import (
    _sync_user_bonuses,
    _user_to_out,
)

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
    if not init_data_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Відсутній заголовок X-Telegram-Init-Data",
        )

    try:
        init_data = validate_init_data(init_data_raw, settings.bot_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Помилка авторизації: {e}",
        ) from e

    telegram_id = init_data.get("user", {}).get("id")
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не вдалося отримати telegram_id з даних авторизації",
        )

    first_name = payload.first_name or (
        payload.full_name.split(" ", 1)[0] if payload.full_name else ""
    )
    last_name = payload.last_name or (
        payload.full_name.split(" ", 1)[1]
        if payload.full_name and " " in payload.full_name
        else None
    )
    full_name = (
        payload.full_name.strip()
        if payload.full_name
        else f"{first_name} {last_name or ''}".strip()
    )

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT is_phone_verified, phone FROM users WHERE telegram_id = $1",
            telegram_id,
        )
        if existing and existing["is_phone_verified"]:
            current_phone = existing["phone"]
            from src.schemas.user import normalize_phone

            clean_current = normalize_phone(current_phone) if current_phone else ""
            clean_new = normalize_phone(payload.phone) if payload.phone else ""
            if clean_current and clean_new and clean_current != clean_new:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Верифікований номер телефону не можна змінювати. "
                        "Зверніться до адміністратора закладу."
                    ),
                )

        # Перевірка чи номер вже прив'язаний до іншого користувача
        phone_owner = await conn.fetchrow(
            """
            SELECT telegram_id, is_phone_verified FROM users
            WHERE phone = $1 AND telegram_id != $2
            """,
            payload.phone,
            telegram_id,
        )
        if phone_owner and phone_owner["is_phone_verified"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Цей номер телефону вже прив'язаний до іншого облікового запису.",
            )

        query = """
            INSERT INTO users (
                telegram_id, full_name, first_name, last_name, phone, delivery_address
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (telegram_id) DO UPDATE
            SET full_name = EXCLUDED.full_name,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                phone = CASE
                    WHEN users.is_phone_verified = true THEN users.phone
                    ELSE EXCLUDED.phone
                END,
                delivery_address = EXCLUDED.delivery_address,
                updated_at = now()
            RETURNING *
        """
        row = await conn.fetchrow(
            query,
            telegram_id,
            full_name,
            first_name,
            last_name,
            payload.phone,
            payload.delivery_address,
        )

        row = await _sync_user_bonuses(conn, row)
    return _user_to_out(row, settings.bot_token)


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
    first_name = payload.first_name.strip()
    last_name = payload.last_name.strip() if payload.last_name else None
    parts = [first_name]
    if last_name:
        parts.append(last_name)
    full_name = " ".join(parts)
    deliv_addr = payload.delivery_address.strip() if payload.delivery_address else None
    add_addr = payload.additional_address.strip() if payload.additional_address else None

    updates = [
        "first_name = $1",
        "last_name = $2",
        "full_name = $3",
        "delivery_address = $4",
        "additional_address = $5",
    ]
    params = [first_name, last_name, full_name, deliv_addr, add_addr]

    if payload.phone is not None:
        if user["is_phone_verified"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Верифікований номер телефону не можна змінювати. "
                    "Зверніться до адміністратора закладу."
                ),
            )
        params.append(payload.phone)
        updates.append(f"phone = ${len(params)}")

    params.append(user["telegram_id"])
    query = f"""
        UPDATE users
        SET {', '.join(updates)},
            updated_at = now()
        WHERE telegram_id = ${len(params)}
        RETURNING *
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            query,
            *params,
        )
        row = await _sync_user_bonuses(conn, row)

    return _user_to_out(row, settings.bot_token)


@router.get("/me/bonuses/history", response_model=list[BonusTransactionOut])
async def get_my_bonus_history(
    limit: int = 50,
    user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """Повертає історію нарахувань та списань бонусів для поточного користувача."""
    user_id = user["id"]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, user_id, order_id, amount, balance_after, transaction_type,
                   description, created_at
            FROM bonus_transactions
            WHERE user_id = $1
            ORDER BY id DESC
            LIMIT $2
            """,
            user_id,
            limit,
        )
    return [BonusTransactionOut(**dict(r)) for r in rows]
