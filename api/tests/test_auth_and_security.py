import hashlib
import hmac
import time
from datetime import UTC

import pytest
from fastapi import HTTPException

from src.auth.admin_token import (
    create_admin_token,
    create_user_token,
    verify_admin_token,
    verify_user_token,
)
from src.auth.deps import get_current_user, get_init_data, require_telegram_or_staff
from src.auth.telegram_init_data import validate_init_data
from src.auth.telegram_widget import validate_telegram_widget_data
from tests.conftest import build_test_init_data


class TestTelegramInitDataValidation:
    """Тестування перевірки підпису Telegram initData (HMAC-SHA256)."""

    def test_valid_init_data_success(self, test_bot_token):
        raw_data = build_test_init_data(user_id=12345, bot_token=test_bot_token)
        parsed = validate_init_data(raw_data, bot_token=test_bot_token)

        assert "user" in parsed
        assert parsed["user"]["id"] == 12345
        assert parsed["user"]["first_name"] == "Тестовий"

    def test_missing_hash_raises_value_error(self, test_bot_token):
        raw_data = "user=%7B%22id%22%3A123%7D&auth_date=1700000000"
        with pytest.raises(ValueError, match="Відсутній параметр 'hash'"):
            validate_init_data(raw_data, bot_token=test_bot_token)

    def test_invalid_hash_signature_mismatch(self, test_bot_token):
        raw_data = build_test_init_data(user_id=12345, bot_token=test_bot_token)
        # Підміняємо хеш
        tampered = raw_data[:-10] + "0123456789"
        with pytest.raises(ValueError, match="Невалідний підпис: hash не співпадає"):
            validate_init_data(tampered, bot_token=test_bot_token)

    def test_missing_auth_date_raises_value_error(self, test_bot_token):
        # Якщо немає auth_date
        with pytest.raises(ValueError):
            validate_init_data("query_id=123&hash=abc", bot_token=test_bot_token)

    def test_expired_init_data_raises_value_error(self, test_bot_token):
        # auth_date 2 дні тому
        old_date = int(time.time()) - (2 * 86400)
        raw_data = build_test_init_data(user_id=12345, bot_token=test_bot_token, auth_date=old_date)

        with pytest.raises(ValueError, match="Дані застаріли"):
            validate_init_data(raw_data, bot_token=test_bot_token, max_age_seconds=86400)


class TestTelegramWidgetValidation:
    """Тестування перевірки підпису Telegram Login Widget (SHA256 bot_token -> HMAC-SHA256)."""

    def _generate_valid_widget_data(
        self, user_id: int, bot_token: str, auth_date: int | None = None
    ):
        if auth_date is None:
            auth_date = int(time.time())
        data = {
            "id": user_id,
            "first_name": "Олександр",
            "last_name": "Тест",
            "username": "alex_test",
            "auth_date": auth_date,
        }
        # Telegram widget spec: key=value sorted alphabetically separated by \n
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
        secret_key = hashlib.sha256(bot_token.encode()).digest()
        data["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        return data

    def test_valid_widget_data_success(self, test_bot_token):
        data = self._generate_valid_widget_data(123456, test_bot_token)
        validated = validate_telegram_widget_data(data, test_bot_token)
        assert validated["id"] == 123456
        assert validated["first_name"] == "Олександр"

    def test_missing_hash_raises_value_error(self, test_bot_token):
        data = {"id": 123, "auth_date": int(time.time())}
        with pytest.raises(ValueError, match="Відсутній параметр 'hash'"):
            validate_telegram_widget_data(data, test_bot_token)

    def test_hash_mismatch_raises_value_error(self, test_bot_token):
        data = self._generate_valid_widget_data(123456, test_bot_token)
        data["hash"] = "invalid_hash_value"
        with pytest.raises(ValueError, match="Невалідний підпис: hash не співпадає"):
            validate_telegram_widget_data(data, test_bot_token)

    def test_expired_widget_data_raises_value_error(self, test_bot_token):
        old_time = int(time.time()) - (2 * 86400)
        data = self._generate_valid_widget_data(123456, test_bot_token, auth_date=old_time)
        with pytest.raises(ValueError, match="Дані авторизації застаріли"):
            validate_telegram_widget_data(data, test_bot_token, max_age_seconds=86400)


class TestAdminTokenSecurity:
    """Тестування генерації та верифікації токенів адміністратора."""

    def test_create_and_verify_admin_token_success(self, test_bot_token):
        token = create_admin_token(telegram_id=987654321, secret_key=test_bot_token, days=7)
        tg_id = verify_admin_token(token, secret_key=test_bot_token)
        assert tg_id == 987654321

    def test_expired_admin_token_returns_none(self, test_bot_token):
        # Токен із минулим строком дії (-1 день)
        expired_token = create_admin_token(
            telegram_id=987654321, secret_key=test_bot_token, days=-1
        )
        assert verify_admin_token(expired_token, secret_key=test_bot_token) is None

    def test_tampered_token_returns_none(self, test_bot_token):
        token = create_admin_token(telegram_id=987654321, secret_key=test_bot_token)
        # Змінюємо telegram_id у токені
        parts = token.split(".")
        parts[1] = "111111111"
        tampered_token = ".".join(parts)
        assert verify_admin_token(tampered_token, secret_key=test_bot_token) is None

    def test_wrong_secret_key_returns_none(self, test_bot_token):
        token = create_admin_token(telegram_id=987654321, secret_key=test_bot_token)
        assert verify_admin_token(token, secret_key="wrong_secret_key") is None

    def test_malformed_token_returns_none(self, test_bot_token):
        assert verify_admin_token("invalid.token", secret_key=test_bot_token) is None
        assert verify_admin_token("", secret_key=test_bot_token) is None


class TestUserTokenSecurity:
    """Тестування токенів сесії веб-клієнтів (HMAC-SHA256)."""

    def test_create_and_verify_user_token_success(self, test_bot_token):
        user_id = 42
        token = create_user_token(user_id=user_id, secret_key=test_bot_token, days=7)
        assert token.startswith("u1.42.")
        verified_id = verify_user_token(token, secret_key=test_bot_token)
        assert verified_id == user_id

    def test_tampered_user_token_returns_none(self, test_bot_token):
        token = create_user_token(user_id=42, secret_key=test_bot_token)
        parts = token.split(".")
        parts[1] = "99"
        tampered = ".".join(parts)
        assert verify_user_token(tampered, secret_key=test_bot_token) is None

    def test_wrong_secret_user_token_returns_none(self, test_bot_token):
        token = create_user_token(user_id=42, secret_key=test_bot_token)
        assert verify_user_token(token, secret_key="wrong_key") is None


class TestAuthDependencies:

    """Тестування FastApi dependencies авторизації."""

    async def test_get_init_data_missing_header_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_init_data(init_data_raw=None)
        assert exc_info.value.status_code == 401
        assert "Відсутній заголовок X-Telegram-Init-Data" in exc_info.value.detail

    async def test_require_telegram_or_staff_blocks_unauthorized(self, test_bot_token):
        """Прямий доступ без заголовків викликає 403 (SEC-5)."""
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        with pytest.raises(HTTPException) as exc_info:
            await require_telegram_or_staff(
                init_data_raw=None,
                admin_token_raw=None,
                settings=settings_mock,
            )
        assert exc_info.value.status_code == 403
        assert "лише через Telegram або для адміністратора" in exc_info.value.detail

    async def test_require_telegram_or_staff_allows_valid_init_data(self, test_bot_token):
        valid_raw = build_test_init_data(bot_token=test_bot_token)
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        allowed = await require_telegram_or_staff(
            init_data_raw=valid_raw,
            admin_token_raw=None,
            settings=settings_mock,
        )
        assert allowed is True

    async def test_require_telegram_or_staff_allows_admin_token(self, test_bot_token):
        admin_token = create_admin_token(telegram_id=999, secret_key=test_bot_token)
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        allowed = await require_telegram_or_staff(
            init_data_raw=None,
            admin_token_raw=admin_token,
            settings=settings_mock,
        )
        assert allowed is True

    async def test_get_current_user_unregistered_raises_404(
        self, test_bot_token, mock_db_pool, mock_db_conn
    ):
        valid_raw = build_test_init_data(user_id=55555, bot_token=test_bot_token)
        settings_mock = type("SettingsStub", (), {"bot_token": test_bot_token})()
        mock_db_conn.fetchrow.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                init_data_raw=valid_raw,
                admin_token_raw=None,
                settings=settings_mock,
                pool=mock_db_pool,
            )
        assert exc_info.value.status_code == 404
        assert "Користувача не зареєстровано" in exc_info.value.detail


class TestPublicAndHealthEndpoints:
    """Тестування публічних ендпоінтів."""

    async def test_healthcheck_endpoint(self, async_client):
        response = await async_client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestSecurityVulnerabilityFixes:
    """Тестування виправлення специфічних вразливостей безпеки."""

    async def test_register_verified_phone_cannot_be_changed(
        self, async_client, mock_db_conn, valid_init_data
    ):
        """Захист SEC-03: спроба змінити верифікований номер у POST /register викликає 400."""
        # Існуючий користувач з верифікованим номером
        mock_db_conn.fetchrow.return_value = {
            "is_phone_verified": True,
            "phone": "+380501112233",
        }

        payload = {
            "full_name": "Іван Тестовий",
            "phone": "+380509998877",  # Спроба підмінити номер
            "delivery_address": "м. Вишгород",
        }
        response = await async_client.post(
            "/api/register",
            json=payload,
            headers={"X-Telegram-Init-Data": valid_init_data},
        )
        assert response.status_code == 400
        assert "Верифікований номер телефону не можна змінювати" in response.json()["detail"]

    async def test_admin_auth_session_consumed_on_first_check(self, async_client, mock_db_conn):
        """Захист SEC-11: після першого отримання токена сесія маркується як consumed."""
        import uuid
        from datetime import datetime, timedelta

        session_id = uuid.uuid4()
        mock_db_conn.fetchrow.return_value = {
            "status": "approved",
            "token": "v1.12345.9999999.testsignature",
            "expires_at": datetime.now(UTC) + timedelta(minutes=5),
        }

        response = await async_client.get(f"/api/admin/auth/session/{session_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert response.json()["token"] == "v1.12345.9999999.testsignature"

        # Перевіряємо, що було виконано запит UPDATE admin_auth_sessions SET status = 'consumed'
        mock_db_conn.execute.assert_called_once()
        call_sql = mock_db_conn.execute.call_args[0][0]
        assert "consumed" in call_sql

    async def test_telegram_client_send_message_success(self):
        """Захист SEC-02: асинхронне надсилання через httpx без блокування пулу потоків."""
        from unittest.mock import AsyncMock, patch

        from src.services.telegram_client import send_telegram_message

        mock_resp = AsyncMock()
        mock_resp.status_code = 200

        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            ok = await send_telegram_message("test_token", 123456, "Привіт!")
            assert ok is True

    async def test_create_auth_session_purges_expired_sessions_sec_11(
        self, async_client, mock_db_conn
    ):
        """Захист SEC-11: нова сесія автоматично очищує застарілі сесії з БД."""
        response = await async_client.post("/api/admin/auth/session")
        assert response.status_code == 200
        assert "code" in response.json()
        assert "session_id" in response.json()

        # Перевіряємо, що було виконано DELETE з очищенням
        executed_sqls = [call[0][0] for call in mock_db_conn.execute.call_args_list]
        delete_calls = [sql for sql in executed_sqls if "DELETE FROM admin_auth_sessions" in sql]
        assert len(delete_calls) >= 1
        assert "expires_at < now()" in delete_calls[0]

    async def test_admin_users_requires_admin_role_sec_12(
        self, async_client, mock_db_conn, test_bot_token
    ):
        """Захист SEC-12: доступ до /api/admin/users заборонено менеджеру (403)."""
        manager_token = create_admin_token(telegram_id=123456789, secret_key=test_bot_token)

        # Користувач є персоналом із роллю 'manager', а не 'admin'
        mock_db_conn.fetchrow.return_value = {
            "id": 10,
            "telegram_id": 123456789,
            "role": "manager",
            "location_id": 1,
            "is_active": True,
            "location_name": "Центр",
            "full_name": "Тестовий Менеджер",
            "phone": "+380501112233",
        }

        response = await async_client.get(
            "/api/admin/users",
            headers={"X-Admin-Token": manager_token},
        )
        assert response.status_code == 403
        assert "Потрібні права головного адміністратора" in response.json()["detail"]

    async def test_list_admin_users_with_nullable_telegram_id(
        self, async_client, mock_db_conn, test_bot_token
    ):
        """Перевірка серіалізації користувачів без telegram_id (web users) в list_admin_users."""
        from src.schemas.admin import AdminUserOut

        # Перевірка напряму схеми Pydantic
        user_schema = AdminUserOut(
            id=1,
            telegram_id=None,
            full_name="Веб Клієнт",
            phone="+380501234567",
            created_at="2026-10-12 00:00",
        )
        assert user_schema.telegram_id is None

        admin_token = create_admin_token(telegram_id=999, secret_key=test_bot_token)
        mock_db_conn.fetchrow.return_value = {
            "id": 1,
            "telegram_id": 999,
            "role": "admin",
            "location_id": None,
            "is_active": True,
            "location_name": None,
            "full_name": "Головний Адмін",
            "phone": "+380501112233",
        }
        mock_db_conn.fetch.return_value = [
            {
                "id": 1,
                "telegram_id": None,
                "full_name": "Веб Клієнт",
                "phone": "+380501234567",
                "delivery_address": "вул. Грушевського, 1",
                "is_blocked": False,
                "is_phone_verified": True,
                "admin_note": None,
                "created_at": "2026-10-12 00:00",
                "orders_count": 3,
            },
            {
                "id": 2,
                "telegram_id": 123456789,
                "full_name": "Телеграм Клієнт",
                "phone": "+380507654321",
                "delivery_address": None,
                "is_blocked": False,
                "is_phone_verified": True,
                "admin_note": "Постійний клієнт",
                "created_at": "2026-10-11 15:30",
                "orders_count": 5,
            },
        ]

        response = await async_client.get(
            "/api/admin/users",
            headers={"X-Admin-Token": admin_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["telegram_id"] is None
        assert data[0]["full_name"] == "Веб Клієнт"
        assert data[1]["telegram_id"] == 123456789
        assert data[1]["full_name"] == "Телеграм Клієнт"

    async def test_healthcheck_endpoints(self, async_client):
        """Перевірка базового та readiness healthcheck ендпоінтів."""
        resp_basic = await async_client.get("/api/health")
        assert resp_basic.status_code == 200
        assert resp_basic.json() == {"status": "ok"}

        resp_ready = await async_client.get("/api/health/ready")
        assert resp_ready.status_code in (200, 503)
        data = resp_ready.json()
        assert "status" in data
        assert "database" in data
        assert "redis" in data

    async def test_update_web_profile_sync_success(self, async_client, mock_db_conn):
        """Перевірка синхронізації номеру телефону та даних з сайту для telegram_id."""
        mock_db_conn.fetchrow.return_value = {
            "id": 1,
            "telegram_id": 999888,
            "full_name": "Іван Тестовий",
            "first_name": "Іван",
            "last_name": "Тестовий",
            "phone": "+380509998877",
            "delivery_address": "просп. Шевченка, 2Д",
            "additional_address": None,
            "is_phone_verified": False,
            "bonus_balance": 50,
        }
        resp = await async_client.post(
            "/api/auth/web-profile",
            json={
                "telegram_id": 999888,
                "phone": "+380509998877",
                "full_name": "Іван Тестовий",
                "delivery_address": "просп. Шевченка, 2Д",
                "bonus_balance": 999999,  # спроба ін'єкції бонусів
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["telegram_id"] == 999888
        assert data["phone"] == "+380509998877"
        assert data["full_name"] == "Іван Тестовий"
        assert data["bonus_balance"] == 50  # бонуси не змінилися

    async def test_get_web_profile_by_telegram_id(self, async_client, mock_db_conn):
        """Перевірка отримання профілю за telegram_id: власний профіль дозволено, чужий блокується (403)."""
        # 1. Чужий профіль -> 403
        resp_forbidden = await async_client.get("/api/auth/web-profile?telegram_id=395090043")
        assert resp_forbidden.status_code == 403

        # 2. Власний профіль -> 200
        resp_own = await async_client.get("/api/auth/web-profile?telegram_id=123456789")
        assert resp_own.status_code == 200
        data = resp_own.json()
        assert data["telegram_id"] == 123456789

    async def test_get_web_profile_by_phone(self, async_client, mock_db_conn):
        """Перевірка отримання профілю за номером телефону: власний дозволено, чужий блокується (403)."""
        # 1. Чужий телефон -> 403
        resp_forbidden = await async_client.get("/api/auth/web-profile?phone=%2B380631395639")
        assert resp_forbidden.status_code == 403

        # 2. Власний телефон -> 200
        resp_own = await async_client.get("/api/auth/web-profile?phone=%2B380931112233")
        assert resp_own.status_code == 200
        data = resp_own.json()
        assert data["phone"] == "+380931112233"

    async def test_get_web_profile_missing_params(self, async_client):
        """Якщо параметри не вказано, повертається профіль поточного авторизованого користувача."""
        resp = await async_client.get("/api/auth/web-profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["telegram_id"] == 123456789
        assert data["phone"] == "+380931112233"


    async def test_phone_auth_endpoints_disabled(self, async_client):
        """Вхід за SMS-кодом та встановлення паролю відключено (404)."""
        res_code = await async_client.post("/api/auth/phone-code", json={"phone": "+380931112233"})
        assert res_code.status_code == 404

        res_pwd = await async_client.post(
            "/api/auth/phone-set-password",
            json={"phone": "+380931112233", "password": "1234"},
        )
        assert res_pwd.status_code == 404

    async def test_web_phone_login_success(self, async_client, mock_db_conn):
        """Прямий вхід через веб-сайт повертає профіль користувача з бонусами URBAN CLUB."""
        mock_db_conn.fetchrow.return_value = {
            "id": 15,
            "telegram_id": None,
            "full_name": "Іван Тестовий",
            "first_name": "Іван",
            "last_name": "Тестовий",
            "phone": "+380931112233",
            "delivery_address": "вул. Хрещатик, 1",
            "additional_address": None,
            "is_phone_verified": True,
            "bonus_balance": 50,
        }
        res_login = await async_client.post(
            "/api/auth/phone-login",
            json={"phone": "+380931112233", "full_name": "Іван Тестовий"},
        )
        assert res_login.status_code == 200
        data = res_login.json()
        assert data["id"] == 15
        assert data["bonus_balance"] == 50
        assert "auth_token" in data

    async def test_admin_notify_rejects_order_without_telegram(self, async_client, mock_db_conn):
        """Сповіщення відхиляється, якщо замовлення з веб-сайту не має telegram_id."""
        from src.auth.admin_token import create_admin_token
        from src.config import get_settings

        settings = get_settings()
        admin_token = create_admin_token(999, settings.bot_token)

        mock_db_conn.fetchrow.side_effect = [
            # staff lookup
            {"telegram_id": 999, "role": "admin", "location_id": None},
            # get_admin_order
            {
                "id": 42,
                "telegram_id": None,
                "status": "confirmed",
                "fulfillment_type": "delivery",
                "delivery_address": "вул. Шевченка, 1",
                "contact_name": "Веб Гість",
                "contact_phone": "+380931234567",
                "payment_method": "cash",
                "scheduled_time": None,
                "comment": None,
                "total_price": 150.0,
                "created_at": "2026-10-13 12:00",
                "user_is_blocked": False,
                "user_admin_note": None,
                "source": "web_croissants",
            },
        ]
        mock_db_conn.fetch.return_value = []

        res = await async_client.post(
            "/api/admin/orders/42/notify",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 400
        assert "немає прив'язаного Telegram-акаунта" in res.json()["detail"]

    async def test_admin_upload_image_requires_staff(self, async_client, mock_db_conn):
        """Ендпоінт /api/admin/upload вимагає прав персоналу (403 якщо не знайдено в managers)."""
        mock_db_conn.fetchrow.return_value = None
        files = {"file": ("test.jpg", b"fake image content", "image/jpeg")}
        res = await async_client.post("/api/admin/upload", files=files)
        assert res.status_code == 403

    async def test_admin_upload_image_rejects_bad_extension(
        self, async_client, mock_db_conn, test_bot_token
    ):
        """Ендпоінт /api/admin/upload відхиляє небезпечні розширення."""
        from src.auth.admin_token import create_admin_token

        admin_token = create_admin_token(999, test_bot_token)
        mock_db_conn.fetchrow.return_value = {
            "telegram_id": 999,
            "role": "admin",
            "location_id": None,
            "is_active": True,
            "full_name": "Адмін",
            "phone": "+380501234567",
        }

        files = {"file": ("malicious.exe", b"executable payload", "application/octet-stream")}
        res = await async_client.post(
            "/api/admin/upload",
            files=files,
            headers={"X-Admin-Token": admin_token},
        )
        assert res.status_code == 400
        assert "Непідтримуваний формат" in res.json()["detail"]

    async def test_admin_upload_image_success(
        self, async_client, mock_db_conn, test_bot_token, tmp_path, monkeypatch
    ):
        """Успішне завантаження фотографії страви через нативний ендпоінт адмінки."""
        from src.auth.admin_token import create_admin_token

        monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))

        admin_token = create_admin_token(999, test_bot_token)
        mock_db_conn.fetchrow.return_value = {
            "telegram_id": 999,
            "role": "admin",
            "location_id": None,
            "is_active": True,
            "full_name": "Адмін",
            "phone": "+380501234567",
        }

        image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        files = {"file": ("croissant.png", image_bytes, "image/png")}
        res = await async_client.post(
            "/api/admin/upload",
            files=files,
            headers={"X-Admin-Token": admin_token},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["url"].startswith("/api/uploads/")
        assert data["filename"].endswith(".png")

        # Переконуємось, що файл справді збережений на диск
        saved_file = tmp_path / data["filename"]
        assert saved_file.exists()
        assert saved_file.read_bytes() == image_bytes

    async def test_admin_upload_image_compression_webp(
        self, async_client, mock_db_conn, test_bot_token, tmp_path, monkeypatch
    ):
        """Перевірка автостискання та конвертації растрового зображення у WebP (до 1200x1200px)."""
        import io

        from PIL import Image

        from src.auth.admin_token import create_admin_token

        monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))

        admin_token = create_admin_token(999, test_bot_token)
        mock_db_conn.fetchrow.return_value = {
            "telegram_id": 999,
            "role": "admin",
            "location_id": None,
            "is_active": True,
            "full_name": "Адмін",
            "phone": "+380501234567",
        }

        # Створюємо велике тестове зображення 1600x1200
        raw_img = Image.new("RGB", (1600, 1200), color=(255, 100, 50))
        buf = io.BytesIO()
        raw_img.save(buf, format="JPEG", quality=95)
        raw_bytes = buf.getvalue()

        files = {"file": ("big_dish_photo.jpg", raw_bytes, "image/jpeg")}
        res = await async_client.post(
            "/api/admin/upload",
            files=files,
            headers={"X-Admin-Token": admin_token},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["url"].startswith("/api/uploads/")
        assert data["filename"].endswith(".webp")
        assert data["width"] == 1200
        assert data["height"] == 900
        assert data["size"] > 0
        assert data["original_size"] == len(raw_bytes)

        saved_file = tmp_path / data["filename"]
        assert saved_file.exists()
        opened = Image.open(saved_file)
        assert opened.format == "WEBP"
        assert opened.size == (1200, 900)

    def test_staff_token_create_and_verify(self, test_bot_token):
        """Перевірка генерації та валідації staff-токена (s1.staff_id...)."""
        from src.auth.admin_token import create_staff_token, verify_staff_token

        token = create_staff_token(staff_id=42, secret_key=test_bot_token, days=7)
        assert token.startswith("s1.42.")

        # Валідна перевірка
        staff_id = verify_staff_token(token, secret_key=test_bot_token)
        assert staff_id == 42

        # Невалідний секретний ключ
        assert verify_staff_token(token, secret_key="wrong_secret") is None

        # Прострочений токен (-1 день)
        expired_token = create_staff_token(staff_id=42, secret_key=test_bot_token, days=-1)
        assert verify_staff_token(expired_token, secret_key=test_bot_token) is None

    async def test_pos_orders_endpoint_requires_staff(self, async_client, mock_db_conn):
        """Ендпоінт /api/pos/orders вимагає прав персоналу (403 якщо не в managers)."""
        mock_db_conn.fetchrow.return_value = None
        res = await async_client.get("/api/pos/orders?location_id=1")
        assert res.status_code == 403
        assert "Тільки для персоналу" in res.json()["detail"]

    async def test_pos_pin_auth_with_pbkdf2_hash(
        self, async_client, mock_db_conn, test_bot_token
    ):
        """Вхід за PIN-кодом перевіряє PBKDF2 хеш і видає підписаний s1-токен."""
        from src.auth.admin_token import verify_staff_token
        from src.auth.password import hash_password

        hashed_pin = hash_password("2222")
        mock_db_conn.fetchrow.return_value = {
            "id": 2,
            "staff_name": "Іван Офіціант",
            "role": "waiter",
            "location_id": 1,
            "pin_code": hashed_pin,
            "telegram_id": None,
            "location_name": "Urban Pizza",
        }

        res = await async_client.post(
            "/api/pos/auth/pin",
            json={"staff_id": 2, "pin": "2222"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["token"].startswith("s1.2.")
        assert data["staff"]["staff_name"] == "Іван Офіціант"

        # Перевіряємо валідність виданого токена
        staff_id = verify_staff_token(data["token"], secret_key=test_bot_token)
        assert staff_id == 2

    async def test_pos_pin_auth_invalid_pin_rejected(
        self, async_client, mock_db_conn
    ):
        """Невірний PIN-код повертає 401 Unauthorized."""
        from src.auth.password import hash_password

        mock_db_conn.fetchrow.return_value = {
            "id": 2,
            "staff_name": "Іван",
            "role": "waiter",
            "location_id": 1,
            "pin_code": hash_password("2222"),
            "telegram_id": None,
            "location_name": "Urban Pizza",
        }

        res = await async_client.post(
            "/api/pos/auth/pin",
            json={"staff_id": 2, "pin": "9999"},
        )
        assert res.status_code == 401
        assert "невірний pin-код" in res.json()["detail"].lower()

    async def test_phone_login_without_password_does_not_issue_auth_token(
        self, async_client, mock_db_conn
    ):
        """Анонімний вхід за телефоном не видає підписаний токен авторизації."""
        mock_db_conn.fetchrow.return_value = {
            "id": 100,
            "telegram_id": None,
            "full_name": "Гість",
            "first_name": "Гість",
            "last_name": None,
            "phone": "+380501112233",
            "delivery_address": None,
            "additional_address": None,
            "is_phone_verified": False,
            "bonus_balance": 50,
            "password_hash": None,
            "phone_code": None,
            "phone_code_expires_at": None,
        }
        res = await async_client.post(
            "/api/auth/phone-login",
            json={"phone": "+380501112233", "full_name": "Гість"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["auth_token"] is None

    async def test_phone_login_with_password_success_and_failure(
        self, async_client, mock_db_conn
    ):
        """Вхід за паролем: успіх з правильним паролем (токен u1) і 401 з неправильним."""
        from src.auth.password import hash_password

        pwd_hash = hash_password("SecretPass123")
        mock_db_conn.fetchrow.return_value = {
            "id": 101,
            "telegram_id": None,
            "full_name": "Користувач",
            "first_name": "Користувач",
            "last_name": None,
            "phone": "+380509990011",
            "delivery_address": None,
            "additional_address": None,
            "is_phone_verified": True,
            "bonus_balance": 150,
            "password_hash": pwd_hash,
            "phone_code": None,
            "phone_code_expires_at": None,
        }

        # 1. Неправильний пароль -> 401
        res_fail = await async_client.post(
            "/api/auth/phone-login",
            json={"phone": "+380509990011", "password": "WrongPassword"},
        )
        assert res_fail.status_code == 401
        assert "невірний пароль" in res_fail.json()["detail"].lower()

        # 2. Правильний пароль -> 200 + u1 токен
        res_ok = await async_client.post(
            "/api/auth/phone-login",
            json={"phone": "+380509990011", "password": "SecretPass123"},
        )
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["auth_token"] is not None
        assert data["auth_token"].startswith("u1.101.")

    async def test_web_order_bonus_theft_rejected_without_matching_auth(
        self, async_client, mock_db_conn
    ):
        """Спроба списати бонуси без автентифікації або з чужого акаунта блокується (403)."""
        # Спроба відправити веб-замовлення зі списанням 100 бонусів
        web_payload = {
            "location_id": 2,
            "fulfillment_type": "pickup",
            "contact_name": "Крадій",
            "contact_phone": "+380671112233",
            "payment_method": "cash",
            "bonus_spent": 100,
            "source": "web_croissants",
            "items": [
                {
                    "variant_id": 10,
                    "qty": 2,
                    "option_variant_ids": [],
                }
            ],
        }

        # База повертає локацію, страву та користувача-жертву (id=99, відмінний від тестового id=1)
        mock_db_conn.fetchrow.side_effect = [
            # 1. loc_row
            {
                "id": 2,
                "name": "Doma Croissants",
                "is_delivery_enabled": True,
                "delivery_start_time": "08:00",
                "delivery_end_time": "21:00",
            },
            # 2. user_row жертви з id=99
            {
                "id": 99,
                "telegram_id": 999999,
                "phone": "+380671112233",
                "full_name": "Жертва Крадіжки",
                "is_phone_verified": True,
            },
        ]
        mock_db_conn.fetch.side_effect = [
            # 1. variants_sql
            [
                {
                    "variant_id": 10,
                    "price": 100.0,
                    "variant_label": "Стандарт",
                    "pv_avail": True,
                    "product_id": 5,
                    "product_name": "Круасан",
                    "p_avail": True,
                    "location_id": 2,
                }
            ],
            # 2. options_sql
            [],
        ]

        resp = await async_client.post("/api/orders/web", json=web_payload)
        assert resp.status_code == 403
        assert "списання бонусів" in resp.json()["detail"].lower()

    async def test_catalog_bypass_cache_requires_cryptographic_admin_token(
        self, async_client, mock_db_conn, test_bot_token
    ):
        """Параметр bypass_cache вимагає дійсного підписаного токена персоналу; фейковий токен ігнорується."""
        from unittest.mock import patch

        from src.auth.admin_token import create_admin_token

        valid_tok = create_admin_token(999, test_bot_token)

        with patch("src.services.catalog_service.CatalogService.list_categories") as mock_list:
            mock_list.return_value = []

            # 1. Запит з фейковим токеном -> bypass_cache=False (кеш використовується)
            await async_client.get(
                "/api/categories?bypass_cache=true",
                headers={"X-Admin-Token": "fake_invalid_token"},
            )
            assert mock_list.call_args.kwargs["bypass_cache"] is False

            # 2. Запит з валідним криптографічним токеном -> bypass_cache=True
            await async_client.get(
                "/api/categories?bypass_cache=true",
                headers={"X-Admin-Token": valid_tok},
            )
            assert mock_list.call_args.kwargs["bypass_cache"] is True

    async def test_web_order_tracking_idor_protection(
        self, async_client, mock_db_conn, test_bot_token
    ):
        """Публічний перегляд замовлення без токена блокується (403), а з коректним HMAC tracking_token дозволяється."""
        from datetime import datetime
        from unittest.mock import patch

        from src.auth.admin_token import create_order_tracking_token
        from src.schemas.order import OrderOut

        order_id = 777
        valid_track_token = create_order_tracking_token(order_id, test_bot_token)

        fake_order = OrderOut(
            id=order_id,
            status="confirmed",
            fulfillment_type="delivery",
            delivery_address="м. Київ, вул. Хрещатик, 1",
            contact_name="VIP Клієнт",
            contact_phone="+380991234567",
            payment_method="card",
            total_price=500.0,
            created_at=datetime.now(UTC),
            groups=[],
        )

        with patch("src.services.order_service.OrderService.fetch_order_by_id", return_value=fake_order):
            # 1. Запит без токена відстеження та без авторизації власника -> 403
            res_forbidden = await async_client.get(f"/api/orders/web/{order_id}")
            assert res_forbidden.status_code == 403
            assert "токен відстеження" in res_forbidden.json()["detail"].lower()

            # 2. Запит з недійсним токеном -> 403
            res_bad_tok = await async_client.get(f"/api/orders/web/{order_id}?token=ot1.777.badsignature")
            assert res_bad_tok.status_code == 403

            # 3. Запит з валідним tracking token -> 200 OK
            res_ok = await async_client.get(f"/api/orders/web/{order_id}?token={valid_track_token}")
            assert res_ok.status_code == 200
            data = res_ok.json()
            assert data["id"] == order_id
            assert data["contact_name"] == "VIP Клієнт"
            assert data["tracking_token"] is not None

    def test_telegram_init_data_replay_and_future_timestamp_prevention(self, test_bot_token):
        """Telegram initData блокує час з майбутнього та застарілі підписи (24 години)."""
        import time

        from src.auth.telegram_init_data import validate_init_data
        from tests.conftest import build_test_init_data

        now = int(time.time())

        # 1. Час із майбутнього (+10 хвилин) -> помилка
        future_data = build_test_init_data(
            user_id=123, bot_token=test_bot_token, auth_date=now + 600
        )
        with pytest.raises(ValueError, match="недійсний час авторизації"):
            validate_init_data(future_data, bot_token=test_bot_token)

        # 2. Підпис старший за 24 години (25 годин) -> застарілі дані
        old_data = build_test_init_data(
            user_id=123, bot_token=test_bot_token, auth_date=now - (25 * 3600)
        )
        with pytest.raises(ValueError, match="Дані застаріли"):
            validate_init_data(old_data, bot_token=test_bot_token)

        # 3. Свіжий підпис (5 хвилин тому) -> успіх
        fresh_data = build_test_init_data(
            user_id=123, bot_token=test_bot_token, auth_date=now - 300
        )
        parsed = validate_init_data(fresh_data, bot_token=test_bot_token)
        assert parsed["user"]["id"] == 123

    async def test_svg_upload_is_blocked(self, async_client, valid_admin_token, mock_db_conn):
        """Завантаження SVG файлів заборонено для усунення ризику Stored XSS."""
        mock_db_conn.fetchrow.return_value = {
            "id": 1,
            "telegram_id": 999999999,
            "role": "admin",
            "is_active": True,
        }

        # Спроба завантажити шкідливий SVG
        svg_content = b'<svg onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>'
        files = {"file": ("malicious.svg", svg_content, "image/svg+xml")}

        res = await async_client.post(
            "/api/admin/upload",
            files=files,
            headers={"X-Admin-Token": valid_admin_token},
        )
        assert res.status_code == 400
        assert "Непідтримуваний формат" in res.json()["detail"] or "Непідтримуваний MIME" in res.json()["detail"]

    async def test_cached_static_files_security_headers(self, async_client):
        """Статичні файли в /api/uploads віддаються із заголовками безпеки nosniff та sandbox CSP."""
        from pathlib import Path

        from src.main import _uploads_dir

        path = Path(_uploads_dir)
        path.mkdir(parents=True, exist_ok=True)

        test_file = path / "test_security_header.png"
        test_file.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

        try:
            res = await async_client.get("/api/uploads/test_security_header.png")
            assert res.status_code == 200
            assert res.headers.get("X-Content-Type-Options") == "nosniff"
            assert "sandbox" in res.headers.get("Content-Security-Policy", "")
        finally:
            if test_file.exists():
                test_file.unlink()




