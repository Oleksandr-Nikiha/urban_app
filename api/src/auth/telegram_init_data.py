import contextlib
import hashlib
import hmac
import json
import time
import urllib.parse


def validate_init_data(
    init_data: str,
    bot_token: str,
    fallback_tokens: list[str] | None = None,
    max_age_seconds: int = 86400 * 30,
) -> dict:
    """
    Перевіряє підпис initData від Telegram.
    Підтримує перевірку за основним bot_token та резервними токенами.
    Повертає розпарсені дані (dict) якщо валідно.
    Кидає ValueError з описом причини, якщо ні.
    """

    parsed_pairs = urllib.parse.parse_qsl(init_data, keep_blank_values=True)
    parsed_data = dict(parsed_pairs)

    if "hash" not in parsed_data:
        raise ValueError("Відсутній параметр 'hash' у даних")

    received_hash = parsed_data.pop("hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))

    # Збираємо список усіх кандидатів токенів
    candidates = [bot_token]
    if fallback_tokens:
        for ft in fallback_tokens:
            if ft and ft not in candidates:
                candidates.append(ft)

    is_valid = False
    for token in candidates:
        secret_key = hmac.new(
            key=b"WebAppData", msg=token.encode("utf-8"), digestmod=hashlib.sha256
        ).digest()

        calculated_hash = hmac.new(
            key=secret_key, msg=data_check_string.encode("utf-8"), digestmod=hashlib.sha256
        ).hexdigest()

        if hmac.compare_digest(calculated_hash, received_hash):
            is_valid = True
            break

    if not is_valid:
        raise ValueError("Невалідний підпис: hash не співпадає")

    if "auth_date" not in parsed_data:
        raise ValueError("Відсутній параметр 'auth_date' у даних")

    try:
        auth_date = int(parsed_data["auth_date"])
    except ValueError:
        # Початковий ValueError від int() нічого не додає — обриваємо ланцюжок
        raise ValueError("Параметр 'auth_date' має бути цілим числом") from None

    current_time = time.time()
    if current_time - auth_date > max_age_seconds:
        raise ValueError(f"Дані застаріли (вік перевищує {max_age_seconds} секунд)")

    result = parsed_data.copy()
    for json_field in ("user", "receiver", "chat"):
        if json_field in result:
            # Поле, яке не розпарсилось, лишаємо сирим рядком — підпис уже
            # перевірено, тож це не привід відхиляти весь запит.
            with contextlib.suppress(json.JSONDecodeError):
                result[json_field] = json.loads(result[json_field])

    return result
