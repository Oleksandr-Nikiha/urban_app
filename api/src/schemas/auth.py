from pydantic import BaseModel


class TelegramWidgetAuthIn(BaseModel):
    """Дані авторизації через Telegram Login Widget."""

    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class PhoneLoginIn(BaseModel):
    """Вхід за номером телефону на веб-сайті."""

    phone: str
    full_name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    telegram_id: int | None = None


class WebProfileUpdateIn(BaseModel):
    """Оновлення профілю клієнта з веб-сайту."""

    telegram_id: int | None = None
    phone: str | None = None
    full_name: str | None = None
    delivery_address: str | None = None
    additional_address: str | None = None
    bonus_balance: int | None = None


class AuthSessionOut(BaseModel):
    """Сесія авторизації для адмін-панелі."""

    session_id: str
    bot_url: str
    tg_url: str | None = None
    code: str
    expires_in: int


class AuthStatusOut(BaseModel):
    """Статус опитування сесії авторизації."""

    status: str
    token: str | None = None
    error: str | None = None


class AdminTokenOut(BaseModel):
    """Токен доступу для адміністратора/менеджера."""

    token: str
    telegram_id: int
    name: str | None = None
    role: str
    location_id: int | None = None
