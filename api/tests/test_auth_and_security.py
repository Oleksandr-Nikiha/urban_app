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
        mock_db_conn.fetchrow.side_effect = [
            None,  # не знайдено existing
            {  # new_row після INSERT
                "id": 42,
                "telegram_id": 999888,
                "full_name": "Іван Тестовий",
                "first_name": "Іван",
                "last_name": "Тестовий",
                "phone": "+380509998877",
                "delivery_address": "просп. Шевченка, 2Д",
                "additional_address": None,
                "is_phone_verified": False,
            },
        ]
        resp = await async_client.post(
            "/api/auth/web-profile",
            json={
                "telegram_id": 999888,
                "phone": "+380509998877",
                "full_name": "Іван Тестовий",
                "delivery_address": "просп. Шевченка, 2Д",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["telegram_id"] == 999888
        assert data["phone"] == "+380509998877"
        assert data["full_name"] == "Іван Тестовий"

    async def test_get_web_profile_by_telegram_id(self, async_client, mock_db_conn):
        """Перевірка отримання профілю за telegram_id."""
        mock_db_conn.fetchrow.return_value = {
            "id": 1,
            "telegram_id": 395090043,
            "full_name": "Олександр Нікіга",
            "first_name": "Олександр",
            "last_name": "Нікіга",
            "phone": "+380631395639",
            "delivery_address": "м. Вишгород, просп. Шевченка, буд. 6а",
            "additional_address": None,
            "is_phone_verified": True,
        }
        resp = await async_client.get("/api/auth/web-profile?telegram_id=395090043")
        assert resp.status_code == 200
        data = resp.json()
        assert data["telegram_id"] == 395090043
        assert data["phone"] == "+380631395639"
        assert data["is_phone_verified"] is True

    async def test_get_web_profile_by_phone(self, async_client, mock_db_conn):
        """Перевірка отримання профілю за номером телефону."""
        mock_db_conn.fetchrow.return_value = {
            "id": 1,
            "telegram_id": 395090043,
            "full_name": "Олександр Нікіга",
            "first_name": "Олександр",
            "last_name": "Нікіга",
            "phone": "+380631395639",
            "delivery_address": "м. Вишгород, просп. Шевченка, буд. 6а",
            "additional_address": None,
            "is_phone_verified": True,
        }
        resp = await async_client.get("/api/auth/web-profile?phone=%2B380631395639")
        assert resp.status_code == 200
        data = resp.json()
        assert data["phone"] == "+380631395639"
        assert data["is_phone_verified"] is True

    async def test_get_web_profile_missing_params(self, async_client):
        """Перевірка помилки 400 якщо не вказано ані telegram_id, ані phone."""
        resp = await async_client.get("/api/auth/web-profile")
        assert resp.status_code == 400


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



