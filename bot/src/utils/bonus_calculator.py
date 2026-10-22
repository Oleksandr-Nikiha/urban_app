"""
Калькулятор кешбеку та лояльності URBAN CLUB для Telegram-бота.
Сітка від суми:
- <= 50 грн: 0%
- 50.01 – 100 грн: 1%
- 100.01 – 700 грн: 3%
- 700.01 – 1200 грн: 5%
- 1200.01 – 1800 грн: 7%
- > 1800 грн: 10%
"""
import logging

import asyncpg

logger = logging.getLogger(__name__)


def calculate_bonus_rate(amount: float) -> float:
    if amount <= 50.0:
        return 0.0
    if amount <= 100.0:
        return 0.01
    if amount <= 700.0:
        return 0.03
    if amount <= 1200.0:
        return 0.05
    if amount <= 1800.0:
        return 0.07
    return 0.10


def calculate_bonus_earned(amount: float) -> int:
    rate = calculate_bonus_rate(amount)
    return int(amount * rate)


async def process_order_completion_bonuses_bot(conn: asyncpg.Connection, order_id: int) -> int:
    order = await conn.fetchrow(
        """
        SELECT id, telegram_id, contact_phone, contact_name, total_price,
               bonus_spent, bonus_earned, bonus_processed, status
        FROM orders
        WHERE id = $1 FOR UPDATE
        """,
        order_id,
    )
    if not order or order["bonus_processed"]:
        return 0

    total_price = float(order["total_price"] or 0.0)
    earned = calculate_bonus_earned(total_price)

    # Знаходимо користувача
    user = None
    if order["telegram_id"]:
        user = await conn.fetchrow("SELECT id, bonus_balance FROM users WHERE telegram_id = $1", order["telegram_id"])
    if not user and order["contact_phone"]:
        user = await conn.fetchrow(
            "SELECT id, bonus_balance FROM users WHERE phone = $1 OR phone = $2 LIMIT 1",
            order["contact_phone"],
            order["contact_phone"].replace("+", ""),
        )

    if not user:
        await conn.execute(
            "UPDATE orders SET bonus_processed = TRUE, bonus_earned = $1 WHERE id = $2",
            earned,
            order_id,
        )
        return 0

    user_id = user["id"]
    current_balance = user["bonus_balance"] if user["bonus_balance"] is not None else 0
    new_balance = current_balance + earned

    await conn.execute(
        "UPDATE users SET bonus_balance = $1, updated_at = now() WHERE id = $2",
        new_balance,
        user_id,
    )
    if earned > 0:
        rate_percent = int(calculate_bonus_rate(total_price) * 100)
        await conn.execute(
            """
            INSERT INTO bonus_transactions (user_id, order_id, amount, balance_after, transaction_type, description)
            VALUES ($1, $2, $3, $4, 'order_accrual', $5)
            """,
            user_id,
            order_id,
            earned,
            new_balance,
            f"Кешбек {rate_percent}% за виконане замовлення #{order_id}",
        )

    await conn.execute(
        "UPDATE orders SET bonus_processed = TRUE, bonus_earned = $1 WHERE id = $2",
        earned,
        order_id,
    )
    return earned


async def refund_order_bonuses_bot(conn: asyncpg.Connection, order_id: int) -> None:
    order = await conn.fetchrow(
        "SELECT id, telegram_id, contact_phone, bonus_spent FROM orders WHERE id = $1 FOR UPDATE",
        order_id,
    )
    if not order or order["bonus_spent"] <= 0:
        return

    spent = order["bonus_spent"]
    user = None
    if order["telegram_id"]:
        user = await conn.fetchrow("SELECT id, bonus_balance FROM users WHERE telegram_id = $1", order["telegram_id"])
    if not user and order["contact_phone"]:
        user = await conn.fetchrow(
            "SELECT id, bonus_balance FROM users WHERE phone = $1 OR phone = $2 LIMIT 1",
            order["contact_phone"],
            order["contact_phone"].replace("+", ""),
        )
    if not user:
        return

    user_id = user["id"]
    current_balance = user["bonus_balance"] if user["bonus_balance"] is not None else 0
    new_balance = current_balance + spent

    await conn.execute(
        "UPDATE users SET bonus_balance = $1, updated_at = now() WHERE id = $2",
        new_balance,
        user_id,
    )
    await conn.execute(
        """
        INSERT INTO bonus_transactions (user_id, order_id, amount, balance_after, transaction_type, description)
        VALUES ($1, $2, $3, $4, 'order_refund', $5)
        """,
        user_id,
        order_id,
        spent,
        new_balance,
        f"Повернення списаних бонусів за скасоване замовлення #{order_id}",
    )
    await conn.execute("UPDATE orders SET bonus_spent = 0 WHERE id = $1", order_id)
