import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from src.auth.deps import get_current_admin
from src.db.connection import get_pool
from src.schemas.admin import (
    AdminUserOut,
    AdminUserUpdateIn,
)
from src.schemas.bonus import (
    BonusAnalyticsSummary,
    BonusTransactionOut,
)

router = APIRouter()


@router.get("/users", response_model=list[AdminUserOut])
async def list_admin_users(
    query: str = Query("", description="Пошук за номером телефону або ПІБ"),
    limit: int = Query(50, ge=1, le=100),
    pool: asyncpg.Pool = Depends(get_pool),
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Пошук клієнтів за номером телефону або ПІБ."""
    clean_q = query.strip()
    sql = """
        SELECT u.id, u.telegram_id, u.full_name, u.phone, u.delivery_address,
               u.is_blocked, u.is_phone_verified, u.admin_note,
               COALESCE(u.bonus_balance, 0)::int AS bonus_balance,
               to_char(u.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               COUNT(o.id)::int AS orders_count
        FROM users u
        LEFT JOIN orders o ON (
            (u.telegram_id IS NOT NULL AND o.telegram_id = u.telegram_id)
            OR (u.telegram_id IS NULL AND u.phone <> '' AND o.contact_phone = u.phone)
        )
        WHERE (
            $1 = ''
            OR u.phone ILIKE '%' || $1 || '%'
            OR u.full_name ILIKE '%' || $1 || '%'
            OR (u.telegram_id IS NOT NULL AND u.telegram_id::text ILIKE '%' || $1 || '%')
        )
        GROUP BY u.id
        ORDER BY u.id DESC
        LIMIT $2
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, clean_q, limit)
    return [AdminUserOut(**dict(r)) for r in rows]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_admin_user(
    user_id: int,
    data: AdminUserUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """
    Оновлення клієнта: блокування, верифікація телефону, примітки та ручне коригування бонусів.
    Доступно виключно адміністратору (не менеджеру).
    """
    updates = []
    params = [user_id]

    if data.is_blocked is not None:
        params.append(data.is_blocked)
        updates.append(f"is_blocked = ${len(params)}")

    if data.admin_note is not None:
        params.append(data.admin_note.strip() if data.admin_note else None)
        updates.append(f"admin_note = ${len(params)}")

    if data.is_phone_verified is not None:
        params.append(data.is_phone_verified)
        updates.append(f"is_phone_verified = ${len(params)}")

    async with pool.acquire() as conn, conn.transaction():
        # Перевірка наявності користувача
        curr_user = await conn.fetchrow(
            "SELECT id, bonus_balance FROM users WHERE id = $1 FOR UPDATE",
            user_id,
        )
        if not curr_user:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        # Ручне встановлення або коригування балансу бонусів
        new_balance = curr_user["bonus_balance"] or 0
        if data.bonus_adjustment is not None and data.bonus_adjustment != 0:
            diff = data.bonus_adjustment
            new_balance = max(0, new_balance + diff)
            params.append(new_balance)
            updates.append(f"bonus_balance = ${len(params)}")
            reason = data.bonus_adjustment_reason or "Ручне коригування адміністратором"
            await conn.execute(
                """
                INSERT INTO bonus_transactions (user_id, amount, balance_after, transaction_type, description)
                VALUES ($1, $2, $3, 'admin_adjustment', $4)
                """,
                user_id,
                diff,
                new_balance,
                f"Адмін: {reason}",
            )
        elif data.bonus_balance is not None:
            new_balance = max(0, data.bonus_balance)
            diff = new_balance - (curr_user["bonus_balance"] or 0)
            params.append(new_balance)
            updates.append(f"bonus_balance = ${len(params)}")
            if diff != 0:
                reason = data.bonus_adjustment_reason or "Встановлення балансу адміністратором"
                await conn.execute(
                    """
                    INSERT INTO bonus_transactions (user_id, amount, balance_after, transaction_type, description)
                    VALUES ($1, $2, $3, 'admin_adjustment', $4)
                    """,
                    user_id,
                    diff,
                    new_balance,
                    f"Адмін: {reason}",
                )

        if updates:
            updates.append("updated_at = now()")
            update_sql = f"UPDATE users SET {', '.join(updates)} WHERE id = $1 RETURNING id"
            await conn.execute(update_sql, *params)

        row = await conn.fetchrow(
            """
            SELECT u.id, u.telegram_id, u.full_name, u.phone, u.delivery_address,
                   u.is_blocked, u.is_phone_verified, u.admin_note,
                   COALESCE(u.bonus_balance, 0)::int AS bonus_balance,
                   to_char(u.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
                   COUNT(o.id)::int AS orders_count
            FROM users u
            LEFT JOIN orders o ON (
                (u.telegram_id IS NOT NULL AND o.telegram_id = u.telegram_id)
                OR (u.telegram_id IS NULL AND u.phone <> '' AND o.contact_phone = u.phone)
            )
            WHERE u.id = $1
            GROUP BY u.id
            """,
            user_id,
        )

    return AdminUserOut(**dict(row))


@router.get("/users/{user_id}/bonus-history", response_model=list[BonusTransactionOut])
async def get_admin_user_bonus_history(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    pool: asyncpg.Pool = Depends(get_pool),
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Повна історія нарахування та списання балів користувача для адміна."""
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


@router.get("/bonuses/analytics", response_model=BonusAnalyticsSummary)
async def get_bonus_analytics(
    pool: asyncpg.Pool = Depends(get_pool),
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Аналітика бонусного фонду та програми лояльності URBAN CLUB."""
    async with pool.acquire() as conn:
        # Загальний бонусний баланс
        users_row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)::int AS total_users_with_bonuses,
                COALESCE(SUM(bonus_balance), 0)::int AS total_bonus_pool
            FROM users
            WHERE bonus_balance > 0
            """
        )
        # Суми нарахувань та списань з транзакцій
        tx_row = await conn.fetchrow(
            """
            SELECT
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::int AS total_issued,
                COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::int AS total_redeemed
            FROM bonus_transactions
            """
        )
        # Кількість замовлень з кешбеком
        orders_row = await conn.fetchrow(
            """
            SELECT COUNT(*)::int AS total_orders_with_cashback
            FROM orders
            WHERE bonus_earned > 0
            """
        )

    return BonusAnalyticsSummary(
        total_users_with_bonuses=users_row["total_users_with_bonuses"],
        total_bonus_pool=users_row["total_bonus_pool"],
        total_bonuses_issued=tx_row["total_issued"],
        total_bonuses_redeemed=tx_row["total_redeemed"],
        total_orders_with_cashback=orders_row["total_orders_with_cashback"],
    )


@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    admin: asyncpg.Record = Depends(get_current_admin),
):
    """Видалення користувача (тільки для ролі admin)."""
    async with pool.acquire() as conn, conn.transaction():
        existing = await conn.fetchrow("SELECT id, telegram_id FROM users WHERE id = $1", user_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Користувача не знайдено")

        if existing["telegram_id"] is not None and existing["telegram_id"] == admin["telegram_id"]:
            raise HTTPException(status_code=400, detail="Не можна видалити власний акаунт")

        if existing["telegram_id"] is not None:
            tg_id = existing["telegram_id"]
            await conn.execute("DELETE FROM managers WHERE telegram_id = $1", tg_id)
            await conn.execute("DELETE FROM carts WHERE telegram_id = $1 OR user_id = $2", tg_id, user_id)
        else:
            await conn.execute("DELETE FROM carts WHERE user_id = $1", user_id)

        await conn.execute("DELETE FROM users WHERE id = $1", user_id)

    return {"ok": True, "message": "Користувача видалено"}
