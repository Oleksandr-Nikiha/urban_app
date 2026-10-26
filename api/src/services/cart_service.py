import asyncpg
from fastapi import HTTPException

from src.db.cart_repo import get_or_create_cart_id
from src.schemas.cart import (
    CartItemIn,
    CartItemOptionOut,
    CartItemOut,
    CartItemUpdateIn,
    CartOut,
)
from src.services.cart_helpers import build_options_key, options_cost


class CartService:
    """Сервіс для управління кошиком користувача, валідації модифікаторів та розрахунку вартості."""

    @staticmethod
    async def fetch_cart(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
        telegram_id: int,
    ) -> CartOut:
        """
        Витягує кошик разом із вибраними опціями.
        Підтримує як asyncpg.Connection, так і asyncpg.Pool для уникнення зайвих циклів acquire/release.
        """
        items_query = """
            SELECT ci.id, ci.variant_id, p.id AS product_id, p.name AS product_name,
                   pv.label AS variant_label, pv.weight, pv.price, ci.qty,
                   loc.id AS location_id, loc.name AS location_name
            FROM cart_items ci
            JOIN product_variants pv ON pv.id = ci.variant_id
            JOIN products p ON p.id = pv.product_id
            JOIN categories cat ON cat.id = p.category_id
            JOIN locations loc ON loc.id = cat.location_id
            JOIN carts c ON c.id = ci.cart_id
            WHERE c.telegram_id = $1
            ORDER BY ci.id
        """
        options_query = """
            SELECT cio.cart_item_id, cio.group_id, cio.variant_id, cio.qty,
                   op.name, opv.label, ogi.price_delta, pog.free_count
            FROM cart_item_options cio
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

        async def _fetch_data(conn: asyncpg.Connection):
            item_rows = await conn.fetch(items_query, telegram_id)
            if not item_rows:
                return item_rows, []
            cart_item_ids = [r["id"] for r in item_rows]
            option_rows = await conn.fetch(options_query, cart_item_ids)
            return item_rows, option_rows

        if hasattr(conn_or_pool, "acquire"):
            async with conn_or_pool.acquire() as conn:
                item_rows, option_rows = await _fetch_data(conn)
        else:
            item_rows, option_rows = await _fetch_data(conn_or_pool)

        if not item_rows:
            return CartOut(items=[], total=0.0)

        by_item: dict[int, dict[int, list[asyncpg.Record]]] = {}
        for row in option_rows:
            by_item.setdefault(row["cart_item_id"], {}).setdefault(row["group_id"], []).append(row)

        items: list[CartItemOut] = []
        total = 0.0
        for item in item_rows:
            groups = by_item.get(item["id"], {})
            options: list[CartItemOptionOut] = []
            extra = 0.0

            for rows in groups.values():
                units: list[float] = []
                for row in rows:
                    delta = float(row["price_delta"])
                    units.extend([delta] * row["qty"])
                    options.append(
                        CartItemOptionOut(
                            group_id=row["group_id"],
                            variant_id=row["variant_id"],
                            name=row["name"],
                            label=row["label"],
                            price_delta=delta,
                            qty=row["qty"],
                        )
                    )

                effective_free = rows[0]["free_count"] * item["qty"]
                extra += options_cost(units, effective_free)

            price = float(item["price"])
            subtotal = round(price * item["qty"] + extra, 2)
            total += subtotal

            items.append(
                CartItemOut(
                    id=item["id"],
                    product_id=item["product_id"],
                    variant_id=item.get("variant_id"),
                    product_name=item["product_name"],
                    variant_label=item["variant_label"],
                    weight=item["weight"],
                    price=price,
                    qty=item["qty"],
                    subtotal=subtotal,
                    location_id=item["location_id"],
                    location_name=item["location_name"],
                    options=options,
                )
            )

        return CartOut(items=items, total=round(total, 2))

    @classmethod
    async def add_item_to_cart(
        cls,
        conn: asyncpg.Connection,
        telegram_id: int,
        payload: CartItemIn,
    ) -> CartOut:
        """Додає страву з обраними опціями до кошика або збільшує кількість існуючої."""
        seen_opts = set()
        for opt in payload.options:
            pair = (opt.group_id, opt.variant_id)
            if pair in seen_opts:
                raise HTTPException(status_code=400, detail="Дублювання опцій у запиті")
            seen_opts.add(pair)

        variant = await conn.fetchrow(
            """
            SELECT p.id as product_id, p.is_available as p_avail, pv.is_available as pv_avail 
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = $1
            """,
            payload.variant_id,
        )

        if not variant:
            raise HTTPException(status_code=404, detail="Варіант не знайдено")
        if not variant["p_avail"] or not variant["pv_avail"]:
            raise HTTPException(status_code=409, detail="Товар або варіант недоступний")

        product_id = variant["product_id"]

        groups = await conn.fetch(
            """
            SELECT group_id, min_select, max_select 
            FROM product_option_groups 
            WHERE product_id = $1
            """,
            product_id,
        )
        group_rules = {row["group_id"]: row for row in groups}

        requested_groups: dict[int, list] = {}
        for opt in payload.options:
            if opt.group_id not in group_rules:
                raise HTTPException(
                    status_code=400,
                    detail=f"Група {opt.group_id} не належить товару",
                )
            requested_groups.setdefault(opt.group_id, []).append(opt)

        for g_id, rule in group_rules.items():
            count = sum(o.qty for o in requested_groups.get(g_id, []))
            effective_min = rule["min_select"] * payload.qty
            effective_max = rule["max_select"] * payload.qty

            if count < effective_min or count > effective_max:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Група {g_id}: вибрано {count}, "
                        f"дозволено {rule['min_select']}-{rule['max_select']}"
                    ),
                )

        if payload.options:
            allowed_opts = await conn.fetch(
                """
                SELECT group_id, variant_id 
                FROM option_group_items 
                WHERE group_id = ANY($1) AND is_available = true
                """,
                list(group_rules.keys()),
            )
            allowed_set = {(row["group_id"], row["variant_id"]) for row in allowed_opts}

            for opt in payload.options:
                if (opt.group_id, opt.variant_id) not in allowed_set:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Опція {opt.group_id}:{opt.variant_id} недоступна",
                    )

        sorted_opts = sorted(payload.options, key=lambda x: (x.group_id, x.variant_id))
        options_key = build_options_key(payload.options, item_qty=payload.qty)

        cart_id = await get_or_create_cart_id(conn, telegram_id)

        existing_qty = await conn.fetchval(
            """
            SELECT qty FROM cart_items
            WHERE cart_id = $1 AND variant_id = $2 AND options_key = $3
            """,
            cart_id,
            payload.variant_id,
            options_key,
        )
        if existing_qty and (existing_qty + payload.qty) > 50:
            raise HTTPException(
                status_code=400,
                detail="Максимальна кількість однієї страви в кошику — 50 шт.",
            )

        upsert_query = """
            INSERT INTO cart_items (cart_id, variant_id, qty, options_key)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cart_id, variant_id, options_key) DO UPDATE
            SET qty = cart_items.qty + EXCLUDED.qty
            RETURNING id, (xmax = 0) AS is_insert
        """
        row = await conn.fetchrow(
            upsert_query, cart_id, payload.variant_id, payload.qty, options_key
        )
        cart_item_id = row["id"]

        if row["is_insert"]:
            if sorted_opts:
                opts_data = [(cart_item_id, o.group_id, o.variant_id, o.qty) for o in sorted_opts]
                await conn.executemany(
                    """
                    INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                    VALUES ($1, $2, $3, $4)
                    """,
                    opts_data,
                )
        else:
            if sorted_opts:
                await conn.executemany(
                    """
                    UPDATE cart_item_options
                    SET qty = qty + $1
                    WHERE cart_item_id = $2 AND group_id = $3 AND variant_id = $4
                    """,
                    [(o.qty, cart_item_id, o.group_id, o.variant_id) for o in sorted_opts],
                )

        return await cls.fetch_cart(conn, telegram_id)

    @classmethod
    async def update_cart_item(
        cls,
        conn: asyncpg.Connection,
        telegram_id: int,
        item_id: int,
        payload: CartItemUpdateIn,
    ) -> CartOut:
        """Оновлює товар у кошику (кількість, варіант або обрані опції)."""
        item = await conn.fetchrow(
            """
            SELECT ci.id, ci.cart_id, ci.qty, ci.variant_id, pv.product_id
            FROM cart_items ci
            JOIN carts c ON c.id = ci.cart_id
            JOIN product_variants pv ON pv.id = ci.variant_id
            WHERE ci.id = $1 AND c.telegram_id = $2
            FOR UPDATE OF ci
            """,
            item_id,
            telegram_id,
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

        if payload.options is not None:
            target_variant_id = (
                payload.variant_id if payload.variant_id is not None else item["variant_id"]
            )
            target_qty = payload.qty if payload.qty is not None else item["qty"]

            variant = await conn.fetchrow(
                """
                SELECT p.id as product_id, p.is_available as p_avail, pv.is_available as pv_avail 
                FROM product_variants pv
                JOIN products p ON p.id = pv.product_id
                WHERE pv.id = $1
                """,
                target_variant_id,
            )
            if not variant:
                raise HTTPException(status_code=404, detail="Варіант не знайдено")
            if not variant["p_avail"] or not variant["pv_avail"]:
                raise HTTPException(status_code=409, detail="Товар або варіант недоступний")

            product_id = variant["product_id"]

            groups = await conn.fetch(
                """
                SELECT group_id, min_select, max_select 
                FROM product_option_groups 
                WHERE product_id = $1
                """,
                product_id,
            )
            group_rules = {row["group_id"]: row for row in groups}

            seen_opts = set()
            requested_groups: dict[int, list] = {}
            for opt in payload.options:
                pair = (opt.group_id, opt.variant_id)
                if pair in seen_opts:
                    raise HTTPException(status_code=400, detail="Дублювання опцій у запиті")
                seen_opts.add(pair)

                if opt.group_id not in group_rules:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Група {opt.group_id} не належить товару",
                    )
                requested_groups.setdefault(opt.group_id, []).append(opt)

            for g_id, rule in group_rules.items():
                count = sum(o.qty for o in requested_groups.get(g_id, []))
                effective_min = rule["min_select"] * target_qty
                effective_max = rule["max_select"] * target_qty

                if count < effective_min or count > effective_max:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Група {g_id}: вибрано {count}, "
                            f"дозволено {rule['min_select']}-{rule['max_select']}"
                        ),
                    )

            if payload.options:
                allowed_opts = await conn.fetch(
                    """
                    SELECT group_id, variant_id 
                    FROM option_group_items 
                    WHERE group_id = ANY($1) AND is_available = true
                    """,
                    list(group_rules.keys()),
                )
                allowed_set = {(row["group_id"], row["variant_id"]) for row in allowed_opts}

                for opt in payload.options:
                    if (opt.group_id, opt.variant_id) not in allowed_set:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Опція {opt.group_id}:{opt.variant_id} недоступна",
                        )

            sorted_opts = sorted(payload.options, key=lambda x: (x.group_id, x.variant_id))
            options_key = build_options_key(payload.options, item_qty=payload.qty)
            cart_id = item["cart_id"]

            other_item = await conn.fetchrow(
                """
                SELECT id, qty FROM cart_items
                WHERE cart_id = $1 AND variant_id = $2 AND options_key = $3 AND id != $4
                """,
                cart_id,
                target_variant_id,
                options_key,
                item_id,
            )

            if other_item:
                merged_qty = other_item["qty"] + target_qty
                other_id = other_item["id"]

                await conn.execute("DELETE FROM cart_items WHERE id = $1", item_id)
                await conn.execute(
                    "UPDATE cart_items SET qty = $1 WHERE id = $2", merged_qty, other_id
                )
                await conn.execute(
                    "DELETE FROM cart_item_options WHERE cart_item_id = $1", other_id
                )

                if sorted_opts:
                    opts_data = []
                    for o in sorted_opts:
                        if target_qty > 0 and o.qty % target_qty == 0:
                            new_opt_qty = (o.qty // target_qty) * merged_qty
                        else:
                            ratio = o.qty // target_qty if target_qty > 0 else 0
                            new_opt_qty = o.qty + ratio * other_item["qty"]
                        opts_data.append((other_id, o.group_id, o.variant_id, new_opt_qty))

                    await conn.executemany(
                        """
                        INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                        VALUES ($1, $2, $3, $4)
                        """,
                        opts_data,
                    )
            else:
                await conn.execute(
                    """
                    UPDATE cart_items
                    SET variant_id = $1, qty = $2, options_key = $3
                    WHERE id = $4
                    """,
                    target_variant_id,
                    target_qty,
                    options_key,
                    item_id,
                )
                await conn.execute("DELETE FROM cart_item_options WHERE cart_item_id = $1", item_id)
                if sorted_opts:
                    opts_data = [(item_id, o.group_id, o.variant_id, o.qty) for o in sorted_opts]
                    await conn.executemany(
                        """
                        INSERT INTO cart_item_options (cart_item_id, group_id, variant_id, qty)
                        VALUES ($1, $2, $3, $4)
                        """,
                        opts_data,
                    )
        elif payload.qty is not None:
            old_qty = item["qty"]
            new_qty = payload.qty

            if new_qty != old_qty:
                rules = await conn.fetch(
                    """
                    SELECT group_id, min_select, max_select
                    FROM product_option_groups
                    WHERE product_id = $1
                    """,
                    item["product_id"],
                )

                selected = await conn.fetch(
                    """
                    SELECT group_id, variant_id, qty 
                    FROM cart_item_options 
                    WHERE cart_item_id = $1 
                    ORDER BY group_id, variant_id
                    """,
                    item_id,
                )

                if selected and rules:
                    is_proportional = all(r["qty"] % old_qty == 0 for r in selected)

                    if is_proportional:
                        scaled_options = []
                        new_group_totals: dict[int, int] = {}
                        for r in selected:
                            unit_qty = r["qty"] // old_qty
                            scaled_qty = unit_qty * new_qty
                            scaled_options.append((r["group_id"], r["variant_id"], scaled_qty))
                            new_group_totals[r["group_id"]] = (
                                new_group_totals.get(r["group_id"], 0) + scaled_qty
                            )

                        valid = True
                        for rule in rules:
                            eff_min = rule["min_select"] * new_qty
                            eff_max = rule["max_select"] * new_qty
                            count = new_group_totals.get(rule["group_id"], 0)
                            if count < eff_min or count > eff_max:
                                valid = False
                                break

                        if valid:
                            await conn.executemany(
                                """
                                UPDATE cart_item_options 
                                SET qty = $1 
                                WHERE cart_item_id = $2 AND group_id = $3 AND variant_id = $4
                                """,
                                [
                                    (s_qty, item_id, g_id, v_id)
                                    for g_id, v_id, s_qty in scaled_options
                                ],
                            )

                            ordered = sorted(scaled_options, key=lambda o: (o[0], o[1]))
                            new_key = "|".join(
                                f"{g}:{v}:{s_qty // new_qty if s_qty % new_qty == 0 else s_qty}"
                                for g, v, s_qty in ordered
                            )

                            await conn.execute(
                                "UPDATE cart_items SET qty = $1, options_key = $2 WHERE id = $3",
                                new_qty,
                                new_key,
                                item_id,
                            )
                        else:
                            raise HTTPException(
                                status_code=409,
                                detail=(
                                    "Кількість вибраних опцій неможливо автоматично масштабувати. "
                                    "Будь ласка, налаштуйте страву в меню."
                                ),
                            )
                    else:
                        raise HTTPException(
                            status_code=409,
                            detail=(
                                "Опції вибрано несиметрично. "
                                "Будь ласка, налаштуйте страву в меню з новою кількістю."
                            ),
                        )
                else:
                    for rule in rules:
                        if rule["min_select"] * new_qty > 0:
                            raise HTTPException(
                                status_code=409,
                                detail=(
                                    "Страва потребує вибору обов'язкових опцій. "
                                    "Налаштуйте страву в меню."
                                ),
                            )
                    await conn.execute(
                        "UPDATE cart_items SET qty = $1 WHERE id = $2", new_qty, item_id
                    )

        return await cls.fetch_cart(conn, telegram_id)

    @classmethod
    async def delete_cart_item(
        cls,
        conn: asyncpg.Connection,
        telegram_id: int,
        item_id: int,
    ) -> CartOut:
        """Видаляє товар з кошика."""
        delete_query = """
            DELETE FROM cart_items
            USING carts
            WHERE cart_items.cart_id = carts.id
              AND cart_items.id = $1
              AND carts.telegram_id = $2
        """
        result = await conn.execute(delete_query, item_id, telegram_id)

        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Товар не знайдено в кошику")

        return await cls.fetch_cart(conn, telegram_id)

    @classmethod
    async def clear_cart(
        cls,
        conn: asyncpg.Connection,
        telegram_id: int,
    ) -> CartOut:
        """Повністю очищає кошик користувача."""
        clear_query = """
            DELETE FROM cart_items
            USING carts
            WHERE cart_items.cart_id = carts.id
              AND carts.telegram_id = $1
        """
        await conn.execute(clear_query, telegram_id)
        return await cls.fetch_cart(conn, telegram_id)


# Зворотна сумісність для тестів та інших модулів
_fetch_cart = CartService.fetch_cart
