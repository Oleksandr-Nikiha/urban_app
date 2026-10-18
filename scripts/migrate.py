#!/usr/bin/env python3
"""
Автоматичний раннер міграцій бази даних urban_app.
Читає SQL-файли з db/migrations/, перевіряє їх проти таблиці schema_migrations
і транзакційно застосовує нові міграції у строгому порядку.

Використання:
    python3 scripts/migrate.py
    або
    DATABASE_URL=postgresql://... python3 scripts/migrate.py
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

import asyncpg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("migrator")


def get_database_url() -> str:
    # 1. Спроба взяти з змінних оточення
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    # 2. Спроба зчитати з .env файлу в корені проєкту
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")

    raise RuntimeError("DATABASE_URL не знайдено ні в оточенні, ні в файлі .env")


async def run_migrations() -> None:
    db_url = get_database_url()
    project_root = Path(__file__).resolve().parent.parent
    migrations_dir = project_root / "db" / "migrations"

    if not migrations_dir.exists():
        logger.error("Каталог міграцій %s не знайдено", migrations_dir)
        sys.exit(1)

    # Знаходимо всі SQL файли, відсортовані за назвою (0001_, 0002_ ...)
    migration_files = sorted(migrations_dir.glob("*.sql"), key=lambda p: p.name)
    if not migration_files:
        logger.info("У каталозі %s немає .sql файлів", migrations_dir)
        return

    logger.info("Підключення до бази даних...")
    conn = await asyncpg.connect(db_url)
    try:
        # Створюємо таблицю обліку міграцій, якщо її ще немає
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )

        # Отримуємо вже застосовані міграції
        rows = await conn.fetch("SELECT version FROM schema_migrations")
        applied_versions = {r["version"] for r in rows}

        pending = [f for f in migration_files if f.name not in applied_versions]

        if not pending:
            logger.info(
                "✨ Усі міграції вже застосовані (всього: %d). База даних актуальна!",
                len(migration_files),
            )
            return

        logger.info("Знайдено %d нових міграцій для застосування:", len(pending))
        for f in pending:
            logger.info("  • %s", f.name)

        # Застосовуємо кожну нову міграцію в окремій транзакції
        for migration_file in pending:
            sql = migration_file.read_text(encoding="utf-8")
            logger.info("⏳ Застосування міграції %s...", migration_file.name)

            async with conn.transaction():
                # Виконуємо SQL-файл
                await conn.execute(sql)
                # Фіксуємо версію в таблиці
                await conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)",
                    migration_file.name,
                )

            logger.info("✅ Міграцію %s успішно застосовано!", migration_file.name)

        logger.info("🎉 Всі нові міграції успішно виконано!")

    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(run_migrations())
    except Exception as e:
        logger.error("❌ Помилка виконання міграцій: %s", e)
        sys.exit(1)

