import hashlib
import hmac
import time


def create_admin_token(telegram_id: int, secret_key: str, days: int = 30) -> str:
    """
    Генерує підписаний токен адміністратора на основі HMAC-SHA256.
    Формат: v1.{telegram_id}.{expires_timestamp}.{signature}
    """
    expires_at = int(time.time()) + (days * 86400)
    payload = f"{telegram_id}:{expires_at}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"v1.{telegram_id}.{expires_at}.{signature}"


def verify_admin_token(
    token: str, secret_key: str, fallback_keys: list[str] | None = None
) -> int | None:
    """
    Перевіряє підпис і строк дії токена.
    Повертає telegram_id, якщо токен валідний, або None.
    """
    try:
        parts = token.split(".")
        if len(parts) != 4 or parts[0] != "v1":
            return None

        telegram_id = int(parts[1])
        expires_at = int(parts[2])
        signature = parts[3]

        if expires_at < int(time.time()):
            return None

        payload = f"{telegram_id}:{expires_at}"
        keys = [secret_key] + (fallback_keys or [])

        for key in keys:
            if not key:
                continue
            expected_sig = hmac.new(
                key.encode("utf-8"),
                payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            if hmac.compare_digest(expected_sig, signature):
                return telegram_id

        return None
    except Exception:
        return None


def create_user_token(user_id: int, secret_key: str, days: int = 30) -> str:
    """
    Генерує підписаний токен користувача веб-сайту на основі HMAC-SHA256.
    Формат: u1.{user_id}.{expires_timestamp}.{signature}
    """
    expires_at = int(time.time()) + (days * 86400)
    payload = f"user:{user_id}:{expires_at}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"u1.{user_id}.{expires_at}.{signature}"


def verify_user_token(
    token: str, secret_key: str, fallback_keys: list[str] | None = None
) -> int | None:
    """
    Перевіряє підпис і строк дії користувацького токена.
    Повертає user_id, якщо токен валідний, або None.
    """
    try:
        parts = token.split(".")
        if len(parts) != 4 or parts[0] != "u1":
            return None

        user_id = int(parts[1])
        expires_at = int(parts[2])
        signature = parts[3]

        if expires_at < int(time.time()):
            return None

        payload = f"user:{user_id}:{expires_at}"
        keys = [secret_key] + (fallback_keys or [])

        for key in keys:
            if not key:
                continue
            expected_sig = hmac.new(
                key.encode("utf-8"),
                payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            if hmac.compare_digest(expected_sig, signature):
                return user_id

        return None
    except Exception:
        return None


def create_staff_token(staff_id: int, secret_key: str, days: int = 7) -> str:
    """
    Генерує підписаний токен персоналу POS-терміналу на основі HMAC-SHA256.
    Формат: s1.{staff_id}.{expires_timestamp}.{signature}
    """
    expires_at = int(time.time()) + (days * 86400)
    payload = f"staff:{staff_id}:{expires_at}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"s1.{staff_id}.{expires_at}.{signature}"


def verify_staff_token(
    token: str, secret_key: str, fallback_keys: list[str] | None = None
) -> int | None:
    """
    Перевіряє підпис і строк дії токена персоналу POS-терміналу.
    Повертає staff_id (managers.id), якщо токен валідний, або None.
    """
    try:
        parts = token.split(".")
        if len(parts) != 4 or parts[0] != "s1":
            return None

        staff_id = int(parts[1])
        expires_at = int(parts[2])
        signature = parts[3]

        if expires_at < int(time.time()):
            return None

        payload = f"staff:{staff_id}:{expires_at}"
        keys = [secret_key] + (fallback_keys or [])

        for key in keys:
            if not key:
                continue
            expected_sig = hmac.new(
                key.encode("utf-8"),
                payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            if hmac.compare_digest(expected_sig, signature):
                return staff_id

        return None
    except Exception:
        return None


def create_order_tracking_token(order_id: int, secret_key: str) -> str:
    """
    Генерує підписаний токен відстеження замовлення для публічного сайту.
    Формат: ot1.{order_id}.{signature}
    """
    payload = f"order_tracking:{order_id}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    return f"ot1.{order_id}.{signature}"


def verify_order_tracking_token(
    order_id: int,
    token: str,
    secret_key: str,
    fallback_keys: list[str] | None = None,
) -> bool:
    """
    Перевіряє валідність токена відстеження для конкретного номера замовлення.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3 or parts[0] != "ot1":
            return False

        if int(parts[1]) != order_id:
            return False

        signature = parts[2]
        payload = f"order_tracking:{order_id}"
        keys = [secret_key] + (fallback_keys or [])

        for key in keys:
            if not key:
                continue
            expected_sig = hmac.new(
                key.encode("utf-8"),
                payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()[:32]

            if hmac.compare_digest(expected_sig, signature):
                return True

        return False
    except Exception:
        return False


