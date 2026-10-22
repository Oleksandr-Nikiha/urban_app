"""
Сервіс для розрахунку та процесингу бонусів URBAN CLUB.
Єдина система лояльності для всіх закладів екосистеми Urban Bites.

Правила кешбеку:
- Сума <= 50 грн: 0% (бонуси не нараховуються)
- Сума 50.01 – 100 грн: 1%
- Сума 100.01 – 700 грн: 3%
- Сума 700.01 – 1200 грн: 5%
- Сума 1200.01 – 1800 грн: 7%
- Сума понад 1800 грн: 10%
"""

import logging
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)


def calculate_bonus_rate(amount: float) -> float:
    """Повертає коефіцієнт кешбеку для суми (0.01 для 1%, 0.03 для 3% тощо)."""
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
    """Розраховує кількість цілих бонусів кешбеку для суми."""
    rate = calculate_bonus_rate(amount)
    return int(amount * rate)


class BonusService:
    @staticmethod
    async def get_or_create_user_for_order(
        conn: asyncpg.Connection,
        phone: str,
        telegram_id: int | None = None,
        full_name: str | None = None,
    ) -> asyncpg.Record | dict[str, Any] | None:
        """Знаходить або повертає користувача за номером телефону чи telegram_id."""
        clean_phone = phone.strip() if phone else ""
        if telegram_id:
            user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)
            if user:
                return user
        if clean_phone:
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE phone = $1 OR phone = $2 LIMIT 1",
                clean_phone,
                clean_phone.replace("+", ""),
            )
            if user:
                return user
            # Створюємо нового користувача з 50 вітальними бонусами
            new_id = await conn.fetchval(
                """
                INSERT INTO users (phone, full_name, telegram_id, bonus_balance, is_phone_verified)
                VALUES ($1, $2, $3, 50, FALSE)
                RETURNING id
                """,
                clean_phone,
                full_name or "Клієнт",
                telegram_id,
            )
            # Записуємо транзакцію вітальних бонусів
            await conn.execute(
                """
                INSERT INTO bonus_transactions (user_id, amount, balance_after, transaction_type, description)
                VALUES ($1, 50, 50, 'welcome', 'Вітальні 50 бонусів URBAN CLUB')
                """,
                new_id,
            )
            return await conn.fetchrow("SELECT * FROM users WHERE id = $1", new_id)
        return None

    @staticmethod
    async def spend_bonuses(
        conn: asyncpg.Connection,
        user_id: int,
        order_id: int,
        bonus_to_spend: int,
    ) -> int:
        """Списує бонуси під час оформлення замовлення."""
        if bonus_to_spend <= 0:
            return 0

        # Атомарно блокуємо користувача
        row = await conn.fetchrow(
            "SELECT bonus_balance FROM users WHERE id = $1 FOR UPDATE",
            user_id,
        )
        if not row:
            return 0

        current_balance = row["bonus_balance"] or 0
        actual_spend = min(current_balance, bonus_to_spend)
        if actual_spend <= 0:
            return 0

        new_balance = current_balance - actual_spend
        await conn.execute(
            "UPDATE users SET bonus_balance = $1, updated_at = now() WHERE id = $2",
            new_balance,
            user_id,
        )
        await conn.execute(
            """
            INSERT INTO bonus_transactions (user_id, order_id, amount, balance_after, transaction_type, description)
            VALUES ($1, $2, $3, $4, 'order_redemption', $5)
            """,
            user_id,
            order_id,
            -actual_spend,
            new_balance,
            f"Списання бонусів на замовлення #{order_id}",
        )
        await conn.execute(
            "UPDATE orders SET bonus_spent = $1 WHERE id = $2",
            actual_spend,
            order_id,
        )
        return actual_spend

    @staticmethod
    async def process_order_completion_bonuses(
        conn: asyncpg.Connection,
        order_id: int,
    ) -> int:
        """
        Нараховує кешбек за замовлення при переході в статус 'completed' / 'delivered'.
        Виконується лише один раз за допомогою bonus_processed = TRUE.
        """
        order = await conn.fetchrow(
            """
            SELECT id, telegram_id, contact_phone, contact_name, total_price,
                   bonus_spent, bonus_earned, bonus_processed, status
            FROM orders
            WHERE id = $1 FOR UPDATE
            """,
            order_id,
        )
        if not order:
            return 0

        if order["bonus_processed"]:
            logger.info("Бонуси для замовлення #%s вже були нараховані раніше", order_id)
            return 0

        total_price = float(order["total_price"] or 0.0)
        # Сума більше 50 грн, розраховуємо бонуси за шкалою
        earned = calculate_bonus_earned(total_price)

        user = await BonusService.get_or_create_user_for_order(
            conn,
            phone=order["contact_phone"],
            telegram_id=order["telegram_id"],
            full_name=order["contact_name"],
        )

        if not user:
            logger.warning("Не вдалося визначити користувача для нарахування бонусів за замовлення #%s", order_id)
            await conn.execute(
                "UPDATE orders SET bonus_processed = TRUE, bonus_earned = $1 WHERE id = $2",
                earned,
                order_id,
            )
            return 0

        user_id = user["id"]
        # Блокуємо рядок користувача для безпечного оновлення балансу
        user_row = await conn.fetchrow(
            "SELECT bonus_balance FROM users WHERE id = $1 FOR UPDATE",
            user_id,
        )
        current_balance = user_row["bonus_balance"] if user_row and user_row["bonus_balance"] is not None else 0
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
        logger.info("Замовлення #%s: нараховано %s бонусів для користувача #%s", order_id, earned, user_id)
        return earned

    @staticmethod
    async def refund_order_bonuses_if_cancelled(
        conn: asyncpg.Connection,
        order_id: int,
    ) -> None:
        """Повертає списані бонуси клієнту, якщо замовлення було скасовано чи відхилено."""
        order = await conn.fetchrow(
            """
            SELECT id, telegram_id, contact_phone, bonus_spent, bonus_processed
            FROM orders
            WHERE id = $1 FOR UPDATE
            """,
            order_id,
        )
        if not order or order["bonus_spent"] <= 0:
            return

        spent = order["bonus_spent"]
        user = await BonusService.get_or_create_user_for_order(
            conn,
            phone=order["contact_phone"],
            telegram_id=order["telegram_id"],
        )
        if not user:
            return

        user_id = user["id"]
        user_row = await conn.fetchrow(
            "SELECT bonus_balance FROM users WHERE id = $1 FOR UPDATE",
            user_id,
        )
        current_balance = user_row["bonus_balance"] if user_row and user_row["bonus_balance"] is not None else 0
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
        await conn.execute(
            "UPDATE orders SET bonus_spent = 0 WHERE id = $1",
            order_id,
        )
