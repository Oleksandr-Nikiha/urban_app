from datetime import UTC, datetime

from src.auth.deps import get_current_user
from src.main import app


class TestOrderCreationApi:
    """Тестування створення замовлення (POST /api/orders) та бізнес-правил."""

    async def test_blocked_user_cannot_create_order_raises_403(self, async_client):
        """Заблокований користувач не може створювати замовлення."""
        blocked_user = {
            "id": 1,
            "telegram_id": 123456789,
            "full_name": "Заблокований Юзер",
            "is_blocked": True,
        }
        app.dependency_overrides[get_current_user] = lambda: blocked_user

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Центральна, 1",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 403
        assert "акаунт заблоковано" in response.json()["detail"]

    async def test_empty_cart_raises_400(self, async_client, mock_db_conn):
        """Спроба замовлення з порожнім кошиком викликає 400."""
        mock_db_conn.fetch.return_value = []  # Порожній кошик

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Центральна, 1",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 400
        assert "Кошик порожній" in response.json()["detail"]

    async def test_multi_location_cart_without_target_location_raises_400(
        self, async_client, mock_db_conn
    ):
        """Кошик зі стравами двох різних закладів вимагає окремого оформлення."""
        cart_rows = [
            {
                "id": 1,
                "variant_id": 10,
                "qty": 1,
                "product_name": "Піца",
                "p_avail": True,
                "variant_label": "30см",
                "price": 200.0,
                "pv_avail": True,
                "location_id": 1,
                "location_name": "Doma Pizza",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            },
            {
                "id": 2,
                "variant_id": 20,
                "qty": 1,
                "product_name": "Круасан",
                "p_avail": True,
                "variant_label": "Класичний",
                "price": 80.0,
                "pv_avail": True,
                "location_id": 2,
                "location_name": "Doma Croissants",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            },
        ]
        mock_db_conn.fetch.return_value = cart_rows

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Центральна, 1",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 400
        assert "страви з різних закладів" in response.json()["detail"]

    async def test_disabled_delivery_raises_400(self, async_client, mock_db_conn):
        """Якщо доставку закладу тимчасово вимкнено через навантаження."""
        cart_rows = [
            {
                "id": 1,
                "variant_id": 10,
                "qty": 1,
                "product_name": "Піца",
                "p_avail": True,
                "variant_label": "30см",
                "price": 200.0,
                "pv_avail": True,
                "location_id": 1,
                "location_name": "Doma Pizza",
                "is_delivery_enabled": False,  # Доставка призупинена!
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            }
        ]
        mock_db_conn.fetch.return_value = cart_rows

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Центральна, 1",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 400
        assert "тимчасово призупинена" in response.json()["detail"]

    async def test_unavailable_product_raises_409(self, async_client, mock_db_conn):
        """Страва пішла в стоп-лист під час оформлення замовлення."""
        cart_rows = [
            {
                "id": 1,
                "variant_id": 10,
                "qty": 1,
                "product_name": "Піца Карбонара",
                "p_avail": False,  # Недоступна!
                "variant_label": "30см",
                "price": 250.0,
                "pv_avail": True,
                "location_id": 1,
                "location_name": "Doma Pizza",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            }
        ]
        mock_db_conn.fetch.return_value = cart_rows

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Центральна, 1",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 409
        assert "наразі недоступна для замовлення" in response.json()["detail"]

    async def test_qr_payment_restriction_for_non_pizza(self, async_client, mock_db_conn):
        """Оплата по QR-коду дозволена лише для піцерії."""
        cart_rows = [
            {
                "id": 1,
                "variant_id": 10,
                "qty": 1,
                "product_name": "Круасан з лососем",
                "p_avail": True,
                "variant_label": "Класичний",
                "price": 180.0,
                "pv_avail": True,
                "location_id": 2,
                "location_name": "Doma Croissants",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            }
        ]
        mock_db_conn.fetch.return_value = cart_rows

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Центральна, 1",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "qr",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 400
        assert "доступна виключно для піцерії" in response.json()["detail"]

    async def test_idempotent_duplicate_order_returns_existing_order(
        self, async_client, mock_db_conn
    ):
        """Повторний клік/запит протягом 20 секунд повертає вже створене замовлення (SEC-2)."""
        cart_rows = [
            {
                "id": 1,
                "variant_id": 10,
                "qty": 1,
                "product_name": "Піца 4 Сири",
                "p_avail": True,
                "variant_label": "30см",
                "price": 280.0,
                "pv_avail": True,
                "location_id": 1,
                "location_name": "Doma Pizza",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            }
        ]
        # 1. cart_items_sql
        # 2. options_sql (empty)
        # 3. recent_order_id знайшов існуюче замовлення #555!
        group_row = {
            "id": 1,
            "location_id": 1,
            "location_name": "Doma Pizza",
            "status": "pending",
            "subtotal": 280.0,
        }
        mock_db_conn.fetch.side_effect = [
            cart_rows,  # cart items
            [],  # options
            [group_row],  # groups in _fetch_order_by_id
            [],  # items in _fetch_order_by_id
            [],  # options in _fetch_order_by_id
        ]
        mock_db_conn.fetchval.return_value = 555  # recent_order_id знайдено

        mock_db_conn.fetchrow.return_value = {
            "id": 555,
            "telegram_id": 123456789,
            "status": "pending_moderation",
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Київська, 10",
            "contact_name": "Іван",
            "contact_phone": "+380931112233",
            "payment_method": "cash",
            "scheduled_time": None,
            "comment": None,
            "total_price": 280.0,
            "created_at": datetime.now(UTC),
        }

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Київська, 10",
            "contact_name": "Іван",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 555
        assert data["status"] == "pending_moderation"
        assert data["total_price"] == 280.0

    async def test_successful_order_creation(self, async_client, mock_db_conn):
        """Успішне створення замовлення зі статусом pending_moderation."""
        cart_rows = [
            {
                "id": 1,
                "variant_id": 10,
                "qty": 1,
                "product_name": "Піца Пепероні",
                "p_avail": True,
                "variant_label": "30см",
                "price": 250.0,
                "pv_avail": True,
                "location_id": 1,
                "location_name": "Doma Pizza",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            }
        ]
        mock_db_conn.fetch.side_effect = [
            cart_rows,  # cart_items_sql
            [],  # options_sql
        ]
        # recent_order_id = None (нове замовлення)
        mock_db_conn.fetchval.return_value = None

        mock_db_conn.fetchrow.side_effect = [
            # 1. order_insert_sql
            {"id": 777, "created_at": datetime.now(UTC)},
            # 2. group_insert_sql
            {"id": 88},
            # 3. item_insert_sql
            {"id": 999},
        ]

        payload = {
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Набережна, 1",
            "contact_name": "Олександр",
            "contact_phone": "0931112233",
            "payment_method": "cash",
        }
        response = await async_client.post("/api/orders", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 777
        assert data["status"] == "pending_moderation"
        assert data["total_price"] == 250.0
        assert len(data["groups"]) == 1
        assert data["groups"][0]["location_id"] == 1
        assert len(data["groups"][0]["items"]) == 1
        assert data["groups"][0]["items"][0]["product_name"] == "Піца Пепероні"


class TestOrderHistoryAndDetailsApi:
    """Тестування перегляду історії та деталей замовлення."""

    async def test_get_user_orders_list(self, async_client, mock_db_conn):
        mock_db_conn.fetch.side_effect = [
            [
                {
                    "id": 100,
                    "telegram_id": 123456789,
                    "status": "confirmed",
                    "fulfillment_type": "pickup",
                    "delivery_address": None,
                    "contact_name": "Іван",
                    "contact_phone": "+380931112233",
                    "payment_method": "card",
                    "scheduled_time": None,
                    "comment": None,
                    "total_price": 300.0,
                    "created_at": datetime.now(UTC),
                }
            ],
            [
                {
                    "id": 1,
                    "order_id": 100,
                    "location_id": 1,
                    "location_name": "Doma Pizza",
                    "status": "confirmed",
                    "subtotal": 300.0,
                }
            ],
            [],  # items
            [],  # options
        ]

        response = await async_client.get("/api/orders")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == 100
        assert data[0]["status"] == "confirmed"

    async def test_get_order_by_id_not_found_raises_404(self, async_client, mock_db_conn):
        mock_db_conn.fetchrow.return_value = None
        response = await async_client.get("/api/orders/9999")
        assert response.status_code == 404
        assert "Замовлення не знайдено" in response.json()["detail"]

    async def test_get_order_by_id_with_options_serializes_correctly(
        self, async_client, mock_db_conn
    ):
        """
        Перевірка що деталі замовлення з опціями серіалізуються без помилки 500 (option_group_name).
        """
        mock_db_conn.fetchrow.return_value = {
            "id": 105,
            "telegram_id": 123456789,
            "status": "pending_moderation",
            "fulfillment_type": "delivery",
            "delivery_address": "вул. Франка, 10",
            "contact_name": "Олександр",
            "contact_phone": "+380931112233",
            "payment_method": "cash",
            "scheduled_time": None,
            "comment": None,
            "total_price": 250.0,
            "created_at": datetime.now(UTC),
        }

        mock_db_conn.fetch.side_effect = [
            # groups
            [
                {
                    "id": 50,
                    "location_id": 1,
                    "location_name": "Doma Pizza",
                    "status": "pending",
                    "subtotal": 250.0,
                }
            ],
            # items
            [
                {
                    "id": 10,
                    "order_group_id": 50,
                    "variant_id": 1,
                    "product_name": "Піца 4 Сири",
                    "variant_label": "30см",
                    "unit_price": 230.0,
                    "qty": 1,
                    "subtotal": 250.0,
                }
            ],
            # options
            [
                {
                    "id": 15,
                    "order_item_id": 10,
                    "option_group_name": "Соуси",
                    "option_name": "Сирний соус",
                    "price_delta": 20.0,
                    "qty": 1,
                }
            ],
        ]

        response = await async_client.get("/api/orders/105")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 105
        assert len(data["groups"]) == 1
        item = data["groups"][0]["items"][0]
        assert item["product_name"] == "Піца 4 Сири"
        assert len(item["options"]) == 1
        assert item["options"][0]["option_group_name"] == "Соуси"
        assert item["options"][0]["option_name"] == "Сирний соус"

    def test_order_item_option_schema_accepts_group_name_alias(self):
        """Схема OrderItemOptionOut безпомилково приймає як option_group_name, так і group_name."""
        from src.schemas.order import OrderItemOptionOut

        # 1. За стандартним полем option_group_name
        opt1 = OrderItemOptionOut(
            id=1,
            option_group_name="Бортик",
            option_name="Сирний",
            price_delta=30.0,
            qty=1,
        )
        assert opt1.option_group_name == "Бортик"

        # 2. За аліасом group_name (якщо прийшло зі старого коду чи словника)
        opt2 = OrderItemOptionOut.model_validate(
            {
                "id": 2,
                "group_name": "Бортик",
                "option_name": "Сирний",
                "price_delta": 30.0,
                "qty": 1,
            }
        )
        assert opt2.option_group_name == "Бортик"

    async def test_create_and_get_web_order_success(self, async_client, mock_db_conn):
        """Тестування створення та отримання замовлення з веб-сайту закладу."""
        # 1. Мокаємо перевірку локації (Doma Croissants, id=2)
        mock_db_conn.fetchrow.side_effect = [
            # loc_row
            {
                "id": 2,
                "name": "Doma Croissants",
                "is_delivery_enabled": True,
                "delivery_start_time": "10:30",
                "delivery_end_time": "21:30",
            },
            # user_row (SELECT users) - None (гість)
            None,
            # order_row (INSERT orders)
            {"id": 301, "created_at": datetime.now(UTC)},
            # group_row (INSERT order_groups)
            {"id": 401},
            # item_row (INSERT order_items)
            {"id": 501},
        ]

        # 2. Мокаємо v_rows (variant)
        mock_db_conn.fetch.side_effect = [
            # v_rows
            [
                {
                    "variant_id": 10,
                    "price": 120.0,
                    "variant_label": "Стандартний",
                    "pv_avail": True,
                    "product_id": 5,
                    "product_name": "Круасан Фісташковий",
                    "p_avail": True,
                    "location_id": 2,
                }
            ]
        ]

        payload = {
            "location_id": 2,
            "fulfillment_type": "pickup",
            "contact_name": "Марія",
            "contact_phone": "0931234567",
            "payment_method": "cash",
            "source": "web_croissants",
            "items": [
                {
                    "variant_id": 10,
                    "qty": 2,
                    "option_variant_ids": [],
                }
            ],
        }

        response = await async_client.post("/api/orders/web", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == 301
        assert data["contact_name"] == "Марія"
        assert data["contact_phone"] == "+380931234567"
        assert data["total_price"] == 240.0
        assert data["source"] == "web_croissants"
        assert data["groups"][0]["location_name"] == "Doma Croissants"

    async def test_get_web_orders_history_batch(
        self, async_client, mock_db_conn, valid_admin_token
    ):
        """Тестування отримання історії веб-замовлень без N+1 проблеми (з авторизацією)."""
        # Без авторизації -> 401
        res_unauth = await async_client.get("/api/orders/web/history?phone=%2B380931234567")
        assert res_unauth.status_code == 401

        mock_db_conn.fetchrow.return_value = {
            "id": 99,
            "telegram_id": 999999999,
            "role": "admin",
            "phone": "+380931234567",
            "full_name": "Адміністратор",
            "is_active": True,
        }

        mock_db_conn.fetch.side_effect = [
            # 1. orders
            [
                {
                    "id": 301,
                    "telegram_id": None,
                    "status": "confirmed",
                    "fulfillment_type": "pickup",
                    "delivery_address": None,
                    "contact_name": "Марія",
                    "contact_phone": "+380931234567",
                    "payment_method": "cash",
                    "scheduled_time": None,
                    "comment": None,
                    "total_price": 240.0,
                    "created_at": datetime.now(UTC),
                    "source": "web_croissants",
                }
            ],
            # 2. groups
            [
                {
                    "id": 401,
                    "order_id": 301,
                    "location_id": 2,
                    "location_name": "Doma Croissants",
                    "status": "confirmed",
                    "subtotal": 240.0,
                }
            ],
            # 3. items
            [
                {
                    "id": 501,
                    "order_group_id": 401,
                    "variant_id": 10,
                    "product_name": "Круасан Фісташковий",
                    "variant_label": "Стандартний",
                    "unit_price": 120.0,
                    "qty": 2,
                    "subtotal": 240.0,
                }
            ],
            # 4. options
            [],
        ]

        response = await async_client.get(
            "/api/orders/web/history?phone=%2B380931234567",
            headers={"X-Admin-Token": valid_admin_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == 301
        assert data[0]["contact_name"] == "Марія"
        assert len(data[0]["groups"]) == 1
        assert data[0]["groups"][0]["location_name"] == "Doma Croissants"
        assert data[0]["groups"][0]["items"][0]["product_name"] == "Круасан Фісташковий"

