
import pytest

from src.schemas.user import standardize_phone
from src.services.bonus_service import BonusService


class TestPhoneStandardization:
    """Тестування стандартизації номера телефону до формату +380XXXXXXXXX."""

    @pytest.mark.parametrize(
        ("input_phone", "expected"),
        [
            ("0631234567", "+380631234567"),
            ("+380631234567", "+380631234567"),
            ("380631234567", "+380631234567"),
            ("80631234567", "+380631234567"),
            ("631234567", "+380631234567"),
            ("+38 (063) 123-45-67", "+380631234567"),
            ("050-999-88-77", "+380509998877"),
            ("  +38 097 555 44 33  ", "+380975554433"),
        ],
    )
    def test_standardize_valid_formats(self, input_phone: str, expected: str):
        assert standardize_phone(input_phone) == expected

    @pytest.mark.parametrize(
        "invalid_phone",
        [
            None,
            "",
            "   ",
            "123",
            "0631234",  # коротке
            "38093123456789",  # забагато цифр
            "+1234567890",
            "abcdefghij",
        ],
    )
    def test_standardize_invalid_formats(self, invalid_phone: str | None):
        assert standardize_phone(invalid_phone) is None


class TestBonusServiceCustomerRegistration:
    """Тестування логіки підрахунку замовлень та реєстрації в BonusService."""

    @pytest.mark.asyncio
    async def test_get_or_create_user_returns_existing(self, mock_db_conn):
        """Якщо користувач вже існує в базі, він повертається без створення нового."""
        existing_user = {
            "id": 10,
            "phone": "+380631234567",
            "full_name": "Іван",
            "bonus_balance": 100,
            "telegram_id": None,
        }
        mock_db_conn.fetchrow.return_value = existing_user

        res = await BonusService.get_or_create_user_for_order(
            conn=mock_db_conn,
            phone="0631234567",
        )
        assert res == existing_user
        # Не повинен викликатися INSERT
        assert not any("INSERT INTO users" in str(call) for call in mock_db_conn.fetchval.mock_calls)

    @pytest.mark.asyncio
    async def test_get_or_create_user_under_threshold_returns_none(self, mock_db_conn):
        """Якщо замовлень менше 5 (< auto_create_min_orders), користувач НЕ створюється."""
        # 1. Пошук існуючого користувача -> None
        mock_db_conn.fetchrow.return_value = None
        # 2. Підрахунок кількості замовлень -> 3
        mock_db_conn.fetchval.return_value = 3

        res = await BonusService.get_or_create_user_for_order(
            conn=mock_db_conn,
            phone="0631234567",
            auto_create_min_orders=5,
        )
        assert res is None
        # Перевірка що INSERT в users не відбувався
        for call in mock_db_conn.fetchval.mock_calls:
            assert "INSERT INTO users" not in str(call)

    @pytest.mark.asyncio
    async def test_get_or_create_user_at_threshold_auto_registers(self, mock_db_conn):
        """Якщо замовлень >= 5, клієнт автоматично реєструється з 50 бонусами."""
        # Пошук існуючого користувача: перший виклик -> None, після створення -> новий користувач
        created_user = {
            "id": 42,
            "phone": "+380631234567",
            "full_name": "Client",
            "first_name": "Client",
            "bonus_balance": 50,
            "telegram_id": None,
        }
        mock_db_conn.fetchrow.side_effect = [None, None, created_user]
        # Підрахунок кількості замовлень -> 5, потім fetchval для INSERT RETURNING id -> 42
        mock_db_conn.fetchval.side_effect = [5, 42]

        res = await BonusService.get_or_create_user_for_order(
            conn=mock_db_conn,
            phone="0631234567",
            auto_create_min_orders=5,
        )
        assert res == created_user
        # Перевірка що був виклик bonus_transactions з welcome бонусами
        executed_sqls = [str(call) for call in mock_db_conn.execute.mock_calls]
        assert any("bonus_transactions" in sql and "welcome" in sql for sql in executed_sqls)

    @pytest.mark.asyncio
    async def test_manual_register_customer(self, mock_db_conn):
        """Ручна реєстрація зберігає ім'я, номер +380... та 50 бонусів."""
        created_user = {
            "id": 77,
            "phone": "+380509998877",
            "full_name": "Оксана",
            "first_name": "Оксана",
            "bonus_balance": 50,
            "telegram_id": None,
        }
        mock_db_conn.fetchrow.side_effect = [None, created_user]
        mock_db_conn.fetchval.return_value = 77

        res = await BonusService.register_customer(
            conn=mock_db_conn,
            phone="0509998877",
            full_name="Оксана",
        )
        assert res == created_user


class TestPosCustomerRegisterEndpoint:
    """Тестування ендпоінту POST /api/pos/customer/register."""

    @pytest.mark.asyncio
    async def test_register_new_customer_endpoint(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.side_effect = [
            None,  # find existing
            {
                "id": 99,
                "phone": "+380631112233",
                "full_name": "Client",
                "first_name": "Client",
                "bonus_balance": 50,
                "telegram_id": None,
            },
        ]
        mock_db_conn.fetchval.side_effect = [99, 0]  # new_id=99, count_orders=0

        resp = await async_client.post(
            "/api/pos/customer/register",
            json={"phone": "0631112233", "name": "Client"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "успішно зареєстровано" in data["message"]
        assert data["customer"]["phone"] == "+380631112233"
        assert data["customer"]["bonus_balance"] == 50

    @pytest.mark.asyncio
    async def test_register_already_existing_customer(self, async_client, mock_db_conn):
        existing = {
            "id": 15,
            "phone": "+380631112233",
            "full_name": "Марія",
            "first_name": "Марія",
            "bonus_balance": 120,
            "telegram_id": 998877,
        }
        mock_db_conn.fetchrow.return_value = existing
        mock_db_conn.fetchval.return_value = 4  # 4 замовлення

        resp = await async_client.post(
            "/api/pos/customer/register",
            json={"phone": "0631112233"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "вже зареєстрований" in data["message"]
        assert data["customer"]["first_name"] == "Марія"
        assert data["customer"]["bonus_balance"] == 120
        assert data["customer"]["orders_count"] == 4

    @pytest.mark.asyncio
    async def test_register_invalid_phone_returns_400(self, async_client):
        resp = await async_client.post(
            "/api/pos/customer/register",
            json={"phone": "invalid-phone", "name": "Client"},
        )
        assert resp.status_code == 400
        assert "Некоректний номер телефону" in resp.json()["detail"]
