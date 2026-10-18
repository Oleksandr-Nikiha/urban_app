# Внесок у Urban Mini App

Дякуємо за інтерес до проєкту. Нижче — усе, що треба, щоб зібрати оточення й надіслати зміни.

## Локальне оточення

Передумови й перші кроки описані в [README](README.md#швидкий-старт).
Коротко:

```bash
cp .env.example .env        # заповнити DATABASE_URL, BOT_TOKEN, MINI_APP_URL
for f in $(ls db/migrations/*.sql | sort); do psql "$DATABASE_URL" -f "$f"; done
psql "$DATABASE_URL" -f db/seed/seed_catalog.sql
docker compose -f docker-compose.dev.yml up --build
```

`api` монтує `./api/src` всередину контейнера й запускається з `--reload`,
тож правки бекенду підхоплюються без перезбірки. Для бота потрібен рестарт:

```bash
docker compose -f docker-compose.dev.yml restart bot
```

### Робота без Docker

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r api/requirements.txt
set -a && . ./.env && set +a
uvicorn src.main:app --app-dir api --reload --port 8010
```

> Для бота потрібен окремий venv: `aiogram` і `api/requirements.txt`
> тягнуть різні набори залежностей.

## Перед тим, як надсилати PR

CI ганяє те саме, тож зручно прогнати локально:

```bash
ruff check api bot                                    # лінт
python -m compileall -q api/src bot/src               # синтаксис
docker compose -f docker-compose.dev.yml config -q    # валідність compose
docker compose -f docker-compose.yml config -q
docker run --rm -v "$PWD/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile # синтаксис caddy
cd frontend && npm ci && npx tsc --noEmit && npx vite build # типізація та збірка фронтенду
```

Ендпоінти зручно перевіряти наскрізно — згенеруйте підписаний `initData`
(див. [README](README.md#тестування-api-без-telegram)) і бийте по `/docs`.

## Домовленості

**Мова.** Коментарі, докстрінги, повідомлення користувачу й тексти комітів — українською.
Ідентифікатори в коді — англійською.

**Коментарі** пояснюють *чому*, а не *що*. Якщо рядок очевидний з коду — коментар зайвий.
Коментувати варто неочевидні рішення: обхід обмеження, компроміс, підводний камінь.

**Python.** Типізація на публічних функціях, асинхронний I/O скрізь (`asyncpg`, `aiogram`),
SQL — параметризований (`$1`, `$2`), ніякої конкатенації рядків у запитах.

**Схема БД.** Кожна зміна — новим файлом `db/migrations/000N_опис.sql`.
Уже застосовані міграції не редагуються.

**Секрети.** `.env` не комітиться ніколи. Нові змінні оточення додавайте
в `.env.example` із плейсхолдером і в таблицю змінних у README.

## Коміти

Заголовок — в наказовому способі, до ~70 символів, без крапки:

```text
Додано ендпоінт очищення кошика
```

Тіло (якщо потрібне) пояснює причину зміни та неочевидні рішення.
Один коміт — одна логічна зміна.

## Pull request

1. Гілка від `main`: `git switch -c feat/коротка-назва`
2. Переконайтесь, що перевірки вище проходять
3. В описі PR: що змінено, навіщо, як перевірити
4. Для змін у Mini App — скріншот або запис екрана з Telegram

## Питання

Не впевнені, чи вписується ідея в roadmap — відкрийте issue до того,
як писати код. Обсяг фаз описаний у [Development.md](Development.md).
