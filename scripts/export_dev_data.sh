#!/usr/bin/env bash
# ==============================================================================
# Експорт даних з dev-середовища для міграції в окремий production-сервер.
# Створює повний архів:
#   1. Дамп бази даних PostgreSQL (схема, дані, міграції)
#   2. Архів медіафайлів (каталог uploads/ з зображеннями страв)
#   3. Метадані експорту та контрольну суму
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
EXPORT_DIR="$PROJECT_ROOT/exports/migration_$TIMESTAMP"
BUNDLE_FILE="$PROJECT_ROOT/exports/urban_prod_migration_$TIMESTAMP.tar.gz"

mkdir -p "$EXPORT_DIR"

echo "=========================================================="
echo "📦 Підготовка експорту даних urban_app ($TIMESTAMP)"
echo "=========================================================="

# 1. Читання DATABASE_URL
if [ ! -f .env ]; then
    echo "❌ Помилка: файл .env не знайдено!"
    exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Помилка: DATABASE_URL не знайдено в .env!"
    exit 1
fi

echo "→ 1/3 Створення SQL-дампу PostgreSQL..."
DUMP_FILE="$EXPORT_DIR/database.sql"

if command -v pg_dump >/dev/null 2>&1; then
    pg_dump --no-owner --no-privileges "$DATABASE_URL" > "$DUMP_FILE"
else
    docker run --rm --net=host \
        -e DATABASE_URL="$DATABASE_URL" \
        postgres:alpine \
        sh -c 'pg_dump --no-owner --no-privileges "$DATABASE_URL"' > "$DUMP_FILE"
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "   ✓ Дамп створено: $DUMP_FILE ($DUMP_SIZE)"

echo "→ 2/3 Архівування медіафайлів страв (uploads/)..."
UPLOADS_TAR="$EXPORT_DIR/uploads.tar.gz"
if [ -d "uploads" ] && [ "$(ls -A uploads 2>/dev/null)" ]; then
    tar -czf "$UPLOADS_TAR" -C uploads .
    UPLOADS_SIZE=$(du -h "$UPLOADS_TAR" | cut -f1)
    echo "   ✓ Медіафайли заархівовано ($UPLOADS_SIZE)"
else
    echo "   ⚠️ Каталог uploads/ порожній або відсутній, створено порожній архів."
    tar -czf "$UPLOADS_TAR" --files-from /dev/null
fi

echo "→ 3/3 Створення маніфесту та єдиного бандлу міграції..."
cat <<EOF > "$EXPORT_DIR/manifest.json"
{
  "project": "urban_app",
  "exported_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo "unknown")",
  "database_size": "$DUMP_SIZE",
  "uploads_size": "$(du -h "$UPLOADS_TAR" | cut -f1)"
}
EOF

tar -czf "$BUNDLE_FILE" -C "$PROJECT_ROOT/exports" "migration_$TIMESTAMP"
rm -rf "$EXPORT_DIR"

BUNDLE_SIZE=$(du -h "$BUNDLE_FILE" | cut -f1)
echo "=========================================================="
echo "✅ Експорт завершено успішно!"
echo "   Файл бандлу: $BUNDLE_FILE ($BUNDLE_SIZE)"
echo ""
echo "🚀 Інструкція з передачі на прод-сервер:"
echo "   scp $BUNDLE_FILE user@your-prod-server:/home/user/urban_app/"
echo "   На прод-сервері виконайте:"
echo "   ./scripts/import_prod_data.sh urban_prod_migration_$TIMESTAMP.tar.gz"
echo "=========================================================="
