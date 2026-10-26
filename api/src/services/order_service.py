import logging
from datetime import datetime
from typing import Any

import asyncpg
from fastapi import HTTPException, status

from src.schemas.order import (
    OrderCreateIn,
    OrderGroupOut,
    OrderItemOptionOut,
    OrderItemOut,
    OrderOut,
)
from src.services.bonus_service import BonusService
from src.services.cart_helpers import options_cost
from src.services.order_queries import (
    cancel_user_order,
    fetch_order_by_id,
    fetch_orders_batch,
    fetch_user_orders,
    fetch_web_orders_history,
    repeat_user_order,
)
from src.services.order_validation import KYIV_TZ, validate_scheduled_time
from src.services.web_order_service import create_web_order

__all__ = ["KYIV_TZ", "OrderService", "datetime"]

logger = logging.getLogger(__name__)


class OrderService:
    """Сервісний шар доменної логіки замовлень."""

    validate_scheduled_time = staticmethod(validate_scheduled_time)
    fetch_orders_batch = staticmethod(fetch_orders_batch)
    fetch_order_by_id = staticmethod(fetch_order_by_id)
    cancel_user_order = staticmethod(cancel_user_order)
    repeat_user_order = staticmethod(repeat_user_order)
    create_web_order = staticmethod(create_web_order)
    fetch_web_orders_history = staticmethod(fetch_web_orders_history)
    fetch_user_orders = staticmethod(fetch_user_orders)

    @staticmethod
    async def create_cart_order(
        conn: asyncpg.Connection,
        user: dict[str, Any] | asyncpg.Record,
        payload: OrderCreateIn,
    ) -> tuple[OrderOut, dict[str, Any], bool]:
        """
        Створює нове замовлення з кошика авторизованого користувача:
        - Отримує позиції кошика та блокує їх (FOR UPDATE)
        - Перевіряє робочі години закладу, мультилокаційність, доступність доставки та QR-оплати
        - Перевіряє доступність страв та модифікаторів
        - Розраховує ціни з урахуванням безкоштовних модифікаторів
        - Запобігає дублюванню замовлень протягом 20 секунд (SEC-2)
        - Зберігає замовлення та очищає кошик
        Повертає (замовлення, дані сповіщення, is_duplicate).
        """
        telegram_id = user["telegram_id"]

        # 1. Отримуємо позиції кошика користувача разом із даними про заклад та наявність
        cart_items_sql = """
            SELECT ci.id, ci.variant_id, ci.qty,
                   p.id AS product_id, p.name AS product_name, p.is_available AS p_avail,
                   pv.label AS variant_label, pv.price, pv.is_available AS pv_avail,
                   loc.id AS location_id, loc.name AS location_name,
                   loc.is_delivery_enabled,
                   to_char(loc.delivery_start_time, 'HH24:MI') AS delivery_start_time,
                   to_char(loc.delivery_end_time, 'HH24:MI') AS delivery_end_time
            FROM cart_items ci
            JOIN product_variants pv ON pv.id = ci.variant_id
            JOIN products p ON p.id = pv.product_id
            JOIN categories cat ON cat.id = p.category_id
            JOIN locations loc ON loc.id = cat.location_id
            JOIN carts c ON c.id = ci.cart_id
            WHERE c.telegram_id = $1
            ORDER BY ci.id
            FOR UPDATE OF ci
        """
        item_rows = await conn.fetch(cart_items_sql, telegram_id)

        if not item_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Кошик порожній",
            )

        # 2. Фільтрація за закладом / перевірка мультилокаційності
        distinct_locations = {row["location_id"]: row["location_name"] for row in item_rows}

        if payload.location_id is not None:
            if payload.location_id not in distinct_locations:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="У кошику немає страв з обраного закладу",
                )
            target_location_id = payload.location_id
            target_location_name = distinct_locations[target_location_id]
            order_item_rows = [r for r in item_rows if r["location_id"] == target_location_id]
        else:
            if len(distinct_locations) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "У кошику є страви з різних закладів. "
                        "Будь ласка, оформіть окреме замовлення для кожного закладу."
                    ),
                )
            target_location_id = list(distinct_locations.keys())[0]
            target_location_name = list(distinct_locations.values())[0]
            order_item_rows = item_rows

        target_loc_row = order_item_rows[0]
        is_delivery_enabled = target_loc_row["is_delivery_enabled"]
        delivery_start_time = target_loc_row["delivery_start_time"] or "10:30"
        delivery_end_time = target_loc_row["delivery_end_time"] or "21:30"

        # Перевірка доступності доставки при навантаженні
        if payload.fulfillment_type == "delivery" and not is_delivery_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Доставка з закладу «{target_location_name}» тимчасово призупинена "
                    "через високе навантаження. Будь ласка, оберіть самовивіз."
                ),
            )

        # Перевірка умов оплати (QR доступний тільки для піцерії при доставці)
        if payload.payment_method == "qr":
            if "pizza" not in target_location_name.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Оплата по QR-коду доступна виключно для піцерії.",
                )
            if payload.fulfillment_type != "delivery":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Оплата по QR-коду доступна лише при замовленні доставки.",
                )

        # Валідація часу доставки або самовивозу (якщо вказано)
        clean_scheduled_time = payload.scheduled_time.strip() if payload.scheduled_time else None
        if clean_scheduled_time:
            OrderService.validate_scheduled_time(
                scheduled_str=clean_scheduled_time,
                delivery_start_time=delivery_start_time,
                delivery_end_time=delivery_end_time,
                target_location_name=target_location_name,
                fulfillment_type=payload.fulfillment_type,
            )

        target_cart_item_ids = [r["id"] for r in order_item_rows]

        # 3. Перевірка доступності товарів
        for row in order_item_rows:
            if not row["p_avail"] or not row["pv_avail"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Страва «{row['product_name']}» наразі недоступна для замовлення",
                )

        # 4. Отримуємо опції для вибраних позицій
        options_sql = """
            SELECT cio.cart_item_id, cio.group_id, cio.variant_id, cio.qty,
                   og.name AS group_name, op.name AS option_name,
                   ogi.price_delta, ogi.is_available AS ogi_avail,
                   op.is_available AS op_avail, opv.is_available AS opv_avail,
                   pog.free_count
            FROM cart_item_options cio
            JOIN option_groups og ON og.id = cio.group_id
            JOIN option_group_items ogi
                 ON ogi.group_id = cio.group_id AND ogi.variant_id = cio.variant_id
            JOIN product_variants opv ON opv.id = cio.variant_id
            JOIN products op ON op.id = opv.product_id
            JOIN cart_items ci ON ci.id = cio.cart_item_id
            JOIN product_variants cv ON cv.id = ci.variant_id
            JOIN product_option_groups pog
                 ON pog.product_id = cv.product_id AND pog.group_id = cio.group_id
            WHERE cio.cart_item_id = ANY($1::int[])
            ORDER BY cio.cart_item_id, pog.sort_order, ogi.sort_order
        """
        option_rows = await conn.fetch(options_sql, target_cart_item_ids)

        # Перевірка доступності опцій
        by_item_opts: dict[int, dict[int, list[asyncpg.Record]]] = {}
        for row in option_rows:
            if not row["ogi_avail"] or not row["op_avail"] or not row["opv_avail"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Опція «{row['option_name']}» наразі недоступна",
                )
            item_groups = by_item_opts.setdefault(row["cart_item_id"], {})
            item_groups.setdefault(row["group_id"], []).append(row)

        # 5. Підрахунок сум
        total_order_price = 0.0
        calculated_items: list[dict[str, Any]] = []

        for item in order_item_rows:
            groups = by_item_opts.get(item["id"], {})
            item_options: list[dict[str, Any]] = []
            extra_cost = 0.0

            for g_rows in groups.values():
                units: list[float] = []
                for o_row in g_rows:
                    delta = float(o_row["price_delta"])
                    units.extend([delta] * o_row["qty"])
                    item_options.append(
                        {
                            "option_group_name": o_row["group_name"],
                            "name": o_row["option_name"],
                            "price_delta": delta,
                            "qty": o_row["qty"],
                        }
                    )

                eff_free = g_rows[0]["free_count"] * item["qty"]
                extra_cost += options_cost(units, eff_free)

            unit_price = float(item["price"])
            item_subtotal = round(unit_price * item["qty"] + extra_cost, 2)
            total_order_price += item_subtotal

            calculated_items.append(
                {
                    "variant_id": item["variant_id"],
                    "product_name": item["product_name"],
                    "variant_label": item["variant_label"],
                    "unit_price": unit_price,
                    "qty": item["qty"],
                    "subtotal": item_subtotal,
                    "options": item_options,
                }
            )

        total_order_price = round(total_order_price, 2)
        bonus_to_spend = payload.bonus_to_spend if payload.bonus_to_spend is not None else payload.bonus_spent
        user_id = user.get("id")
        actual_bonus_spent = 0
        if bonus_to_spend > 0 and user_id:
            actual_bonus_spent = await BonusService.spend_bonuses(
                conn=conn,
                user_id=user_id,
                order_id=0,
                bonus_to_spend=min(bonus_to_spend, int(total_order_price)),
            )
            total_order_price = max(0.0, round(total_order_price - actual_bonus_spent, 2))

        # 5.1 Захист від дублювання замовлень (SEC-2)
        recent_order_id = await conn.fetchval(
            """
            SELECT o.id
            FROM orders o
            JOIN order_groups og ON og.order_id = o.id
            WHERE o.telegram_id = $1
              AND og.location_id = $2
              AND o.status = 'pending_moderation'
              AND o.total_price = $3
              AND o.created_at > now() - interval '20 seconds'
            ORDER BY o.id DESC
            LIMIT 1
            """,
            telegram_id,
            target_location_id,
            total_order_price,
        )
        if recent_order_id:
            logger.info(
                "Повторний запит: знайдено нещодавно створене замовлення #%s", recent_order_id
            )
            existing_order = await OrderService.fetch_order_by_id(
                conn, recent_order_id, telegram_id
            )
            if existing_order:
                return existing_order, {}, True

        # 6. Створення замовлення в БД
        order_insert_sql = """
            INSERT INTO orders (
                telegram_id, status, fulfillment_type, delivery_address,
                contact_name, contact_phone, payment_method, scheduled_time,
                comment, total_price, bonus_spent
            )
            VALUES ($1, 'pending_moderation', $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, created_at
        """
        order_row = await conn.fetchrow(
            order_insert_sql,
            telegram_id,
            payload.fulfillment_type,
            payload.delivery_address,
            payload.contact_name.strip(),
            payload.contact_phone.strip(),
            payload.payment_method,
            clean_scheduled_time,
            payload.comment.strip() if payload.comment else None,
            total_order_price,
            actual_bonus_spent,
        )
        order_id = order_row["id"]
        created_at = order_row["created_at"]

        if actual_bonus_spent > 0 and user_id:
            await conn.execute(
                """
                UPDATE bonus_transactions
                SET order_id = $1, description = $2
                WHERE user_id = $3 AND order_id = 0 AND transaction_type = 'order_redemption'
                """,
                order_id,
                f"Списання бонусів на замовлення #{order_id}",
                user_id,
            )

        group_insert_sql = """
            INSERT INTO order_groups (order_id, location_id, status, subtotal)
            VALUES ($1, $2, 'pending', $3)
            RETURNING id
        """
        group_row = await conn.fetchrow(
            group_insert_sql,
            order_id,
            target_location_id,
            total_order_price,
        )
        order_group_id = group_row["id"]

        saved_items: list[OrderItemOut] = []
        options_batch: list[tuple] = []
        options_by_item_map: dict[int, list[OrderItemOptionOut]] = {}

        item_insert_sql = """
            INSERT INTO order_items (
                order_group_id, variant_id, product_name, variant_label,
                unit_price, qty, subtotal
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        """

        for calc_item in calculated_items:
            item_db = await conn.fetchrow(
                item_insert_sql,
                order_group_id,
                calc_item["variant_id"],
                calc_item["product_name"],
                calc_item["variant_label"],
                calc_item["unit_price"],
                calc_item["qty"],
                calc_item["subtotal"],
            )
            saved_item_id = item_db["id"]
            options_by_item_map[saved_item_id] = []

            for opt in calc_item["options"]:
                options_batch.append(
                    (
                        saved_item_id,
                        opt["option_group_name"],
                        opt["name"],
                        opt["price_delta"],
                        opt["qty"],
                    )
                )
                options_by_item_map[saved_item_id].append(
                    OrderItemOptionOut(
                        id=0,
                        option_group_name=opt["option_group_name"],
                        option_name=opt["name"],
                        price_delta=opt["price_delta"],
                        qty=opt["qty"],
                    )
                )

            saved_items.append(
                OrderItemOut(
                    id=saved_item_id,
                    variant_id=calc_item["variant_id"],
                    product_name=calc_item["product_name"],
                    variant_label=calc_item["variant_label"],
                    unit_price=calc_item["unit_price"],
                    qty=calc_item["qty"],
                    subtotal=calc_item["subtotal"],
                    options=options_by_item_map[saved_item_id],
                )
            )

        if options_batch:
            opt_insert_sql = """
                INSERT INTO order_item_options (
                    order_item_id, option_group_name, option_name, price_delta, qty
                )
                VALUES ($1, $2, $3, $4, $5)
            """
            await conn.executemany(opt_insert_sql, options_batch)

        await conn.execute(
            "DELETE FROM cart_items WHERE id = ANY($1::int[])",
            target_cart_item_ids,
        )

        order_notification_data = {
            "location_name": target_location_name,
            "contact_name": payload.contact_name,
            "contact_phone": payload.contact_phone,
            "fulfillment_type": payload.fulfillment_type,
            "delivery_address": payload.delivery_address,
            "payment_method": payload.payment_method,
            "scheduled_time": clean_scheduled_time,
            "comment": payload.comment,
            "total_price": total_order_price,
            "items": calculated_items,
            "admin_note": user.get("admin_note"),
            "telegram_id": telegram_id,
            "is_phone_verified": bool(user.get("is_phone_verified")),
        }

        order_out = OrderOut(
            id=order_id,
            telegram_id=telegram_id,
            status="pending_moderation",
            fulfillment_type=payload.fulfillment_type,
            delivery_address=payload.delivery_address,
            contact_name=payload.contact_name,
            contact_phone=payload.contact_phone,
            payment_method=payload.payment_method,
            scheduled_time=clean_scheduled_time,
            comment=payload.comment,
            total_price=total_order_price,
            bonus_spent=actual_bonus_spent,
            bonus_earned=0,
            created_at=created_at,
            groups=[
                OrderGroupOut(
                    id=order_group_id,
                    location_id=target_location_id,
                    location_name=target_location_name,
                    status="pending",
                    subtotal=total_order_price,
                    items=saved_items,
                )
            ],
        )
        return order_out, order_notification_data, False



