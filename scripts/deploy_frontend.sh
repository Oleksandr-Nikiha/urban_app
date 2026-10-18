#!/usr/bin/env bash
# Збирає фронтенд і розкладає статику туди, звідки її віддає caddy.
#
# Навіщо окремий крок: назовні не можна виставляти dev-сервер Vite —
# він віддає вихідні тексти й підставляє у них значення VITE_*-змінних
# (зокрема підписаний VITE_DEV_INIT_DATA, який є валідними обліковими даними).
#
#   ./scripts/deploy_frontend.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET=/var/www/urban-bites/app
COMPOSE="docker compose -f docker-compose.dev.yml"

echo "→ збірка"
# VITE_DEV_INIT_DATA навмисно порожній: у проді мок не потрібен,
# а в бандл не має потрапити нічого схожого на облікові дані
$COMPOSE exec -T -e VITE_DEV_INIT_DATA= -e VITE_API_BASE_URL=/urban-bites/api frontend sh -c 'npm run build' >/dev/null

echo "→ перевірка бандла на секрети"
TOKEN=$(grep '^BOT_TOKEN=' .env | cut -d= -f2-)
if grep -rqF "$TOKEN" frontend/dist/ 2>/dev/null; then
    echo "ПОМИЛКА: у бандлі знайдено BOT_TOKEN — розгортання скасовано"; exit 1
fi
if grep -rqE 'auth_date=[0-9]{10}' frontend/dist/ 2>/dev/null; then
    echo "ПОМИЛКА: у бандлі знайдено initData — розгортання скасовано"; exit 1
fi

echo "→ копіювання в $TARGET"
sudo mkdir -p "$TARGET"
sudo rsync -a --delete frontend/dist/ "$TARGET/"

# SELinux у Enforcing: без правильного контексту caddy отримає 403
if command -v getenforce >/dev/null && [ "$(getenforce)" != "Disabled" ]; then
    sudo chcon -R -t httpd_sys_content_t "$TARGET"
fi
sudo chmod -R a+rX "$TARGET"

echo "✓ розгорнуто: $TARGET"
