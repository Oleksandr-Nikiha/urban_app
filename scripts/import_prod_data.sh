#!/usr/bin/env bash
# ==============================================================================
# Імпорт даних на новому окремому production-сервері.
# Приймає файл міграційного бандлу (.tar.gz) або шлях до дампу:
#   1. Запускає та очікує готовності сервісу postgres у Docker Compose
#   2. Імпортує базу даних (структуру, дані каталогу, користувачів)
#   3. Розпаковує зображення страв у том uploads_data / каталог uploads/
#   4. Запускає автоматичний migrator для перевірки цілісності схеми
#   5. Перевіряє кількість імпортованих записів у ключових таблицях
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ $# -lt 1 ]; then
    echo "Використання: $0 <шлях_до_архіву_міграції.tar.gz>"
    echo "Приклад: $0 urban_prod_migration_20261011_120000.tar.gz"
    exit 1
fi

BUNDLE_FILE="$1"
if [ ! -f "$BUNDLE_FILE" ]; then
    echo "❌ Помилка: файл '$BUNDLE_FILE' не знайдено!"
    exit 1
fi

if [ ! -f .env ]; then
    echo "❌ Помилка: файл .env не знайдено у корені проєкту ($PROJECT_ROOT)!"
    echo "Створіть .env за шаблоном: cp .env.prod.example .env"
    exit 1
fi

echo "=========================================================="
echo "📥 Початок імпорту даних у прод-середовище urban_app"
echo "=========================================================="

TEMP_EXTRACT_DIR=$(mktemp -d /tmp/urban_import_XXXXXX)
trap 'rm -rf "$TEMP_EXTRACT_DIR"' EXIT

echo "→ 1/5 Розпакування міграційного бандлу..."
tar -xzf "$BUNDLE_FILE" -C "$TEMP_EXTRACT_DIR"

# Знаходимо директорію всередині архіву
INNER_DIR=$(find "$TEMP_EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)
if [ -z "$INNER_DIR" ]; then
    INNER_DIR="$TEMP_EXTRACT_DIR"
fi

SQL_FILE="$INNER_DIR/database.sql"
UPLOADS_ARCHIVE="$INNER_DIR/uploads.tar.gz"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Помилка: database.sql не знайдено всередині бандлу!"
    exit 1
fi

# Зчитуємо параметри PostgreSQL з .env
POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "urban_user")
POSTGRES_USER=${POSTGRES_USER:-urban_user}
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "urban_app_db")
POSTGRES_DB=${POSTGRES_DB:-urban_app_db}

echo "→ 2/5 Запуск та перевірка контейнера PostgreSQL..."
docker compose -f docker-compose.yml up -d postgres

echo "   Очікування готовності бази даних..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until docker compose -f docker-compose.yml exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
        echo "❌ Помилка: таймаут очікування PostgreSQL!"
        exit 1
    fi
    sleep 1
done
echo "   ✓ PostgreSQL готовий до прийому даних."

echo "→ 3/5 Імпорт SQL-дампу у базу $POSTGRES_DB..."
# Заливаємо SQL дамп безпосередньо через psql в контейнері
docker compose -f docker-compose.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SQL_FILE" >/dev/null
echo "   ✓ Дамп успішно імпортовано."

echo "→ 4/5 Відновлення медіа-файлів страв..."
mkdir -p uploads
if [ -f "$UPLOADS_ARCHIVE" ]; then
    tar -xzf "$UPLOADS_ARCHIVE" -C uploads/
    echo "   ✓ Файли розпаковано у ./uploads/ ($(ls -1 uploads/ | wc -l) файлів)"
    
    # Створюємо / монтуємо том для контейнерів
    docker compose -f docker-compose.yml up -d --no-deps api >/dev/null 2>&1 || true
    if docker compose -f docker-compose.yml ps -q api >/dev/null 2>&1; then
        docker compose -f docker-compose.yml cp uploads/. api:/directus/uploads/ >/dev/null 2>&1 || true
        echo "   ✓ Файли синхронізовано з Docker-томом uploads_data"
    fi
fi

echo "→ 5/5 Запуск валідації міграцій через migrator..."
docker compose -f docker-compose.yml run --rm migrator

echo "=========================================================="
echo "📊 Перевірка імпортованих даних:"
echo "----------------------------------------------------------"
docker compose -f docker-compose.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT
    (SELECT count(*) FROM locations) as locations,
    (SELECT count(*) FROM categories) as categories,
    (SELECT count(*) FROM products) as products,
    (SELECT count(*) FROM product_variants) as variants,
    (SELECT count(*) FROM option_groups) as option_groups,
    (SELECT count(*) FROM delivery_addresses) as delivery_addresses,
    (SELECT count(*) FROM schema_migrations) as applied_migrations,
    (SELECT count(*) FROM managers) as managers_count;
"

echo "=========================================================="
echo "🎉 Імпорт даних успішно завершено!"
echo "Тепер можна запустити повний продакшн-стек:"
echo "   ./scripts/deploy_prod.sh"
echo "=========================================================="

