#!/usr/bin/env bash
# ==============================================================================
# Скрипт розгортання та оновлення urban_app у production-середовищі.
# Перевіряє конфігурацію, збирає Docker-образи, накочує міграції
# та запускає всі сервіси під наглядом healthchecks.
#
# Використання:
#   ./scripts/deploy_prod.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "🚀 Запуск розгортання urban_app (Production Environment)"
echo "=========================================================="

# 1. Перевірка системних вимог
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Помилка: Docker не встановлено на сервері!"
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Помилка: Docker Compose v2 не встановлено!"
    exit 1
fi

# 2. Перевірка файлу .env
if [ ! -f .env ]; then
    echo "❌ Помилка: файл .env не знайдено!"
    echo "Створіть його: cp .env.prod.example .env та заповніть реальні значення."
    exit 1
fi

# 3. Валідація критичних змінних
echo "→ 1/5 Перевірка конфігурації оточення..."

BOT_TOKEN=$(grep -E '^BOT_TOKEN=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$BOT_TOKEN" ] || [[ "$BOT_TOKEN" == *"your-bot-token"* ]]; then
    echo "❌ Помилка: BOT_TOKEN не налаштовано або містить шаблонне значення!"
    exit 1
fi

POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$POSTGRES_PASSWORD" ] || [[ "$POSTGRES_PASSWORD" == *"change_me"* ]]; then
    echo "❌ Помилка: POSTGRES_PASSWORD не налаштовано або є ненадійним!"
    exit 1
fi

APP_DOMAIN=$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$APP_DOMAIN" ]; then
    echo "⚠️ Увага: APP_DOMAIN порожній. Caddy слухатиме лише HTTP :80 без автоматичного SSL."
fi

API_DEBUG=$(grep -E '^API_DEBUG=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "false")
if [ "$API_DEBUG" = "true" ]; then
    echo "⚠️ Увага: API_DEBUG=true! У production рекомендується API_DEBUG=false."
fi

# 4. Валідація Compose-файлу
echo "→ 2/5 Валідація синтаксису docker-compose.yml..."
docker compose -f docker-compose.yml config -q
echo "   ✓ Конфігурація валідна."

# 5. Збірка образів
echo "→ 3/5 Збірка production Docker-образів (API, Bot, Migrator, Caddy)..."
docker compose -f docker-compose.yml build

# 6. Запуск сервісів
echo "→ 4/5 Запуск сервісів (Postgres, Redis, Migrator, API, Bot, Caddy)..."
docker compose -f docker-compose.yml up -d

# 7. Очікування готовності сервісів
echo "→ 5/5 Очікування перевірки працездатності (Healthchecks)..."
sleep 5

MAX_WAIT=60
ELAPSED=0
API_READY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
    API_STATUS=$(docker compose -f docker-compose.yml ps api --format "{{.Health}}" 2>/dev/null || echo "starting")
    if [[ "$API_STATUS" == *"healthy"* ]]; then
        API_READY=true
        break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo "   Очікування API healthcheck... (${ELAPSED}s)"
done

if [ "$API_READY" = true ]; then
    echo "   ✓ FastAPI успішно пройшов healthcheck!"
else
    echo "   ⚠️ Попередження: API ще ініціалізується або healthcheck затримався."
fi

echo "=========================================================="
echo "✅ Розгортання завершено!"
echo "----------------------------------------------------------"
docker compose -f docker-compose.yml ps
echo "=========================================================="
if [ -n "$APP_DOMAIN" ]; then
    echo "🌐 Застосунок доступний за адресою: https://$APP_DOMAIN"
    echo "🔧 Адмін-панель: https://$APP_DOMAIN/admin"
else
    echo "🌐 Застосунок доступний за адресою: http://<IP-сервера>"
fi
echo "=========================================================="

