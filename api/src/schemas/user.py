import re

from pydantic import BaseModel, field_validator


def standardize_phone(val: str | None) -> str | None:
    """Стандартизує номер телефону до формату E.164 (+380XXXXXXXXX).
    
    Повертає None, якщо рядок порожній або не містить достатньої кількості цифр.
    """
    if not val:
        return None
    digits = re.sub(r"\D", "", val)
    if not digits:
        return None
    if digits.startswith("380") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("80") and len(digits) == 11:
        return f"+3{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+38{digits}"
    if len(digits) == 9:
        return f"+380{digits}"
    return None


def normalize_phone(val: str) -> str:
    """Приводить номер телефону до стандарту E.164 (+380XXXXXXXXX)."""
    norm = standardize_phone(val)
    if norm:
        return norm
    raise ValueError(
        "Некоректний номер телефону. Вкажіть номер у форматі 0XXXXXXXXX або +380XXXXXXXXX"
    )


class RegisterIn(BaseModel):
    full_name: str
    phone: str
    delivery_address: str | None = None
    first_name: str | None = None
    last_name: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return normalize_phone(v)


class UserUpdateIn(BaseModel):
    first_name: str
    last_name: str | None = None
    phone: str | None = None
    delivery_address: str | None = None
    additional_address: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return normalize_phone(v)


class UserOut(BaseModel):
    id: int
    telegram_id: int | None = None
    full_name: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str
    is_phone_verified: bool = False
    delivery_address: str | None = None
    additional_address: str | None = None
    client_code: str | None = None
    bonus_balance: int = 0
    bot_username: str | None = None
    auth_token: str | None = None
