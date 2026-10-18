#!/usr/bin/env bash
# ==============================================================================
# Резервне копіювання бази даних PostgreSQL на production-сервері (для cron).
# Зберігає стиснутий дамп у backups/ та видаляє копії, старіші за RETENTION_DAYS.
#
# Налаштування в cron (щоночі о 03:00):
#   0 3 * * * /home/user/urban_app/scripts/backup_prod_db.sh >> /var/log/urban_backup.log 2>&1
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS=14
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ ! -f .env ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] .env не знайдено!"
    exit 1
fi

POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "urban_user")
POSTGRES_USER=${POSTGRES_USER:-urban_user}
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "urban_app_db")
POSTGRES_DB=${POSTGRES_DB:-urban_app_db}

echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Початок бекапу бази даних $POSTGRES_DB..."

if ! docker compose -f docker-compose.yml exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Контейнер postgres недоступний!"
    exit 1
fi

docker compose -f docker-compose.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges | gzip > "$BACKUP_FILE"

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Бекап успішно збережено: $BACKUP_FILE ($FILE_SIZE)"

# Очищення старих бекапів
DELETED_COUNT=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Видалено $DELETED_COUNT старих бекапів (> $RETENTION_DAYS днів)."
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Резервне копіювання завершено успішно."

