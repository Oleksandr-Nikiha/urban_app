import html
import logging
import time
from datetime import UTC, datetime

from fastapi import Request

from src.config import get_settings
from src.services.telegram_client import send_telegram_message

logger = logging.getLogger(__name__)

# Anti-spam cooldown: signature -> timestamp
_recent_alerts: dict[str, float] = {}
COOLDOWN_SECONDS = 60.0


async def notify_server_error(request: Request, exc: Exception) -> None:
    """
    Надсилає термінове сповіщення в менеджерський Telegram-чат про необроблену помилку 500.
    Має захист від спаму: однакова помилка відправляється не частіше 1 разу на хвилину.
    """
    settings = get_settings()
    target_chat = settings.manager_chat_id
    if not target_chat and settings.managers_ids_list():
        target_chat = settings.managers_ids_list()[0]

    if not target_chat or not settings.bot_token:
        return

    sig = f"{request.method}:{request.url.path}:{type(exc).__name__}"
    now = time.time()
    last_sent = _recent_alerts.get(sig, 0.0)
    if now - last_sent < COOLDOWN_SECONDS:
        return

    _recent_alerts[sig] = now

    # Очищення старих записів кожні 10 хвилин
    if len(_recent_alerts) > 100:
        for k in list(_recent_alerts.keys()):
            if now - _recent_alerts[k] > COOLDOWN_SECONDS * 5:
                _recent_alerts.pop(k, None)

    method = html.escape(request.method)
    path = html.escape(request.url.path)
    exc_type = html.escape(type(exc).__name__)
    exc_msg = html.escape(str(exc)[:300])
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    text = (
        f"🚨 <b>Критичний збій API (500 Internal Error)</b>\n\n"
        f"▫️ <b>Запит:</b> <code>{method} {path}</code>\n"
        f"▫️ <b>Тип помилки:</b> <code>{exc_type}</code>\n"
        f"▫️ <b>Деталі:</b> <code>{exc_msg}</code>\n"
        f"▫️ <b>Час:</b> <code>{timestamp}</code>\n"
        f"▫️ <b>Сервер:</b> <code>urban_app-api-1</code>"
    )

    try:
        await send_telegram_message(
            bot_token=settings.bot_token,
            chat_id=target_chat,
            text=text,
            parse_mode="HTML",
        )
    except Exception as err:
        logger.warning("Не вдалося надіслати алерти 500 у Telegram: %s", err)
