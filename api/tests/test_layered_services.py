import pytest
from fastapi import HTTPException

from src.schemas.catalog import CategoryOut, ProductDetailOut, ProductListItemOut
from src.schemas.delivery_address import DeliveryAddressOut
from src.schemas.location import LocationOut
from src.schemas.user import RegisterIn, UserUpdateIn
from src.services.catalog_service import CatalogService
from src.services.location_service import DeliveryAddressService, LocationService
from src.services.user_service import UserService
from tests.conftest import build_test_init_data


class TestCatalogService:
    """Тестування сервісного шару каталогу (CatalogService)."""

    async def test_list_categories(self, mock_db_conn):
        mock_db_conn.fetch.return_value = [
            {
                "id": 1,
                "name": "Піца",
                "icon": "🍕",
                "parent_id": None,
                "location_id": 1,
                "sort_order": 1,
                "location_name": "Doma Pizza",
            }
        ]
        categories = await CatalogService.list_categories(mock_db_conn, bypass_cache=True)
        assert len(categories) == 1
        assert isinstance(categories[0], CategoryOut)
        assert categories[0].name == "Піца"
        assert categories[0].parent_id is None

    async def test_list_products_by_category(self, mock_db_conn):
        mock_db_conn.fetch.return_value = [
            {
                "id": 10,
                "name": "Маргарита",
                "image_url": "https://img/pizza.jpg",
                "price_from": 180.0,
                "category_id": 1,
                "category_name": "Піца",
            }
        ]
        products = await CatalogService.list_products_by_category(
            mock_db_conn, category_id=1, bypass_cache=True
        )
        assert len(products) == 1
        assert isinstance(products[0], ProductListItemOut)
        assert products[0].name == "Маргарита"
        assert products[0].price_from == 180.0

    async def test_get_product_detail_not_found_raises_404(self, mock_db_conn):
        mock_db_conn.fetchrow.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            await CatalogService.get_product_detail(mock_db_conn, product_id=999, bypass_cache=True)
        assert exc_info.value.status_code == 404

    async def test_get_product_detail_success(self, mock_db_conn):
        mock_db_conn.fetchrow.return_value = {
            "id": 5,
            "name": "Круасан з лососем",
            "description": "Свіжий круасан з крем-сиром",
            "image_url": "https://img/croissant.jpg",
        }
        mock_db_conn.fetch.side_effect = [
            # product_variants
            [{"id": 50, "label": "Стандарт", "weight": "220г", "price": 140.0}],
            # product_option_groups
            [
                {
                    "group_id": 1,
                    "group_name": "Додатки",
                    "min_select": 0,
                    "max_select": 2,
                    "free_count": 0,
                    "variant_id": 99,
                    "price_delta": 20.0,
                    "name": "Авокадо",
                }
            ],
        ]
        detail = await CatalogService.get_product_detail(
            mock_db_conn, product_id=5, bypass_cache=True
        )
        assert isinstance(detail, ProductDetailOut)
        assert detail.name == "Круасан з лососем"
        assert len(detail.variants) == 1
        assert len(detail.option_groups) == 1
        assert detail.option_groups[0].items[0].name == "Авокадо"


class TestLocationAndDeliveryServices:
    """Тестування сервісного шару закладів та адрес доставки."""

    async def test_list_locations(self, mock_db_conn):
        mock_db_conn.fetch.return_value = [
            {
                "id": 1,
                "name": "Urban Pizza",
                "address": "вул. Хрещатик, 1",
                "phones": ["+380441112233"],
                "is_delivery_enabled": True,
                "delivery_start_time": "10:00",
                "delivery_end_time": "22:00",
            }
        ]
        locations = await LocationService.list_locations(mock_db_conn, bypass_cache=True)
        assert len(locations) == 1
        assert isinstance(locations[0], LocationOut)
        assert locations[0].name == "Urban Pizza"

    async def test_list_delivery_cities(self, mock_db_conn):
        mock_db_conn.fetch.return_value = [{"city": "Вишгород"}, {"city": "Київ"}]
        cities = await DeliveryAddressService.list_delivery_cities(mock_db_conn)
        assert cities == ["Вишгород", "Київ"]

    async def test_list_delivery_cities_empty_fallback(self, mock_db_conn):
        mock_db_conn.fetch.return_value = []
        cities = await DeliveryAddressService.list_delivery_cities(mock_db_conn)
        assert cities == ["Київ"]

    async def test_list_active_addresses(self, mock_db_conn):
        mock_db_conn.fetch.return_value = [
            {"id": 1, "city": "Київ", "street": "вул. Хрещатик"},
        ]
        addresses = await DeliveryAddressService.list_active_addresses(mock_db_conn, city="Київ")
        assert len(addresses) == 1
        assert isinstance(addresses[0], DeliveryAddressOut)
        assert addresses[0].street == "вул. Хрещатик"


class TestUserService:
    """Тестування сервісного шару користувачів (UserService)."""

    async def test_register_missing_init_data_raises_401(self, mock_db_conn):
        payload = RegisterIn(full_name="Олександр", phone="0931234567")
        with pytest.raises(HTTPException) as exc_info:
            await UserService.register_user(
                conn=mock_db_conn,
                payload=payload,
                init_data_raw=None,
                bot_token="test_token",
            )
        assert exc_info.value.status_code == 401

    async def test_register_success(self, mock_db_conn, test_bot_token):
        init_data = build_test_init_data(user_id=888, bot_token=test_bot_token)
        payload = RegisterIn(full_name="Тарас Шевченко", phone="0931234567")

        mock_db_conn.fetchrow.side_effect = [
            None,  # existing user check
            None,  # phone owner check
            {
                "id": 1,
                "telegram_id": 888,
                "full_name": "Тарас Шевченко",
                "first_name": "Тарас",
                "last_name": "Шевченко",
                "phone": "+380931234567",
                "is_phone_verified": False,
                "delivery_address": None,
                "bonus_balance": 50,
            },
        ]
        user_out = await UserService.register_user(
            conn=mock_db_conn,
            payload=payload,
            init_data_raw=init_data,
            bot_token=test_bot_token,
        )
        assert user_out.telegram_id == 888
        assert user_out.full_name == "Тарас Шевченко"
        assert user_out.bonus_balance == 50

    async def test_update_profile_changing_verified_phone_raises_400(self, mock_db_conn):
        user = {
            "telegram_id": 888,
            "is_phone_verified": True,
            "phone": "+380931112233",
        }
        payload = UserUpdateIn(
            first_name="Тарас",
            phone="0509998877",
        )
        with pytest.raises(HTTPException) as exc_info:
            await UserService.update_profile(
                conn=mock_db_conn,
                user=user,
                payload=payload,
                bot_token="test_token",
            )
        assert exc_info.value.status_code == 400
        assert "Верифікований номер" in exc_info.value.detail
