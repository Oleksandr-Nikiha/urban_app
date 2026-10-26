import asyncpg
from fastapi import HTTPException

from src.schemas.catalog import (
    CategoryOut,
    ProductDetailOut,
    ProductListItemOut,
    ProductVariantOut,
)
from src.services.cache import get_cached_json, set_cached_json


class CatalogService:
    """Сервіс для роботи з каталогом: категорії, список страв та детальна картка товару."""

    @staticmethod
    async def list_categories(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
        location_id: int | None = None,
        bypass_cache: bool = False,
    ) -> list[CategoryOut]:
        cache_key = (
            f"catalog:categories:loc_{location_id}"
            if location_id is not None
            else "catalog:categories"
        )

        if not bypass_cache:
            cached = await get_cached_json(cache_key)
            if cached is not None:
                return [CategoryOut(**item) for item in cached]

        query = """
            SELECT c.id, c.name, c.icon, c.parent_id, c.location_id,
                   c.sort_order, l.name AS location_name
            FROM categories c
            JOIN locations l ON l.id = c.location_id
            LEFT JOIN categories p_cat ON p_cat.id = c.parent_id
            WHERE c.is_visible = true
              AND ($1::int IS NULL OR c.location_id = $1)
              AND (
                  EXISTS (
                      SELECT 1
                      FROM products p
                      JOIN product_variants v ON v.product_id = p.id
                      WHERE p.category_id = c.id
                        AND p.is_available = true
                        AND v.is_available = true
                  )
                  OR
                  EXISTS (
                      SELECT 1
                      FROM categories sub
                      JOIN products p ON p.category_id = sub.id
                      JOIN product_variants v ON v.product_id = p.id
                      WHERE sub.parent_id = c.id
                        AND sub.is_visible = true
                        AND p.is_available = true
                        AND v.is_available = true
                  )
              )
            ORDER BY c.location_id,
                COALESCE(p_cat.sort_order, c.sort_order),
                c.parent_id NULLS FIRST,
                c.sort_order,
                c.id
        """

        rows = await conn_or_pool.fetch(query, location_id)
        result = [CategoryOut(**dict(row)) for row in rows]

        if not bypass_cache:
            await set_cached_json(cache_key, [r.model_dump(mode="json") for r in result])

        return result

    @staticmethod
    async def list_products_by_category(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
        category_id: int,
        bypass_cache: bool = False,
    ) -> list[ProductListItemOut]:
        cache_key = f"catalog:category:{category_id}:products"

        if not bypass_cache:
            cached = await get_cached_json(cache_key)
            if cached is not None:
                return [ProductListItemOut(**item) for item in cached]

        query = """
            SELECT
                p.id,
                p.name,
                p.image_url,
                MIN(v.price) AS price_from,
                p.category_id,
                c.name AS category_name
            FROM products p
            JOIN product_variants v ON v.product_id = p.id
            JOIN categories c ON c.id = p.category_id
            WHERE p.is_available
                AND c.is_visible
                AND v.is_available
                AND (p.category_id = $1
                OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $1))
            GROUP BY p.id, c.name, c.sort_order
            ORDER BY c.sort_order, p.sort_order
        """

        rows = await conn_or_pool.fetch(query, category_id)
        result = [ProductListItemOut(**dict(row)) for row in rows]

        if not bypass_cache:
            await set_cached_json(cache_key, [r.model_dump(mode="json") for r in result])

        return result

    @staticmethod
    async def get_product_detail(
        conn_or_pool: asyncpg.Connection | asyncpg.Pool,
        product_id: int,
        bypass_cache: bool = False,
    ) -> ProductDetailOut:
        cache_key = f"catalog:product:{product_id}"

        if not bypass_cache:
            cached = await get_cached_json(cache_key)
            if cached is not None:
                return ProductDetailOut(**cached)

        async def _query(conn: asyncpg.Connection):
            product_row = await conn.fetchrow(
                """
                SELECT p.id, p.name, p.description, p.image_url 
                FROM products p
                JOIN categories c ON c.id = p.category_id
                LEFT JOIN categories parent ON parent.id = c.parent_id
                WHERE p.id = $1 
                  AND p.is_available = true 
                  AND c.is_visible = true
                  AND (parent.id IS NULL OR parent.is_visible = true)
                """,
                product_id,
            )
            if product_row is None:
                raise HTTPException(status_code=404, detail="Товар не знайдено або він недоступний")

            variant_rows = await conn.fetch(
                """
                SELECT id, label, weight, price 
                FROM product_variants 
                WHERE product_id = $1 AND is_available = true
                ORDER BY sort_order
                """,
                product_id,
            )

            option_rows = await conn.fetch(
                """
                SELECT g.id AS group_id, g.name AS group_name, pog.min_select, pog.max_select,
                       pog.free_count,
                       ogi.variant_id, ogi.price_delta, op.name
                FROM product_option_groups pog
                JOIN option_groups g ON g.id = pog.group_id
                JOIN option_group_items ogi ON ogi.group_id = g.id
                JOIN product_variants v ON v.id = ogi.variant_id
                JOIN products op ON op.id = v.product_id
                WHERE pog.product_id = $1
                  AND ogi.is_available = true 
                  AND v.is_available = true
                  AND op.is_available = true
                ORDER BY pog.sort_order, ogi.sort_order
                """,
                product_id,
            )
            return product_row, variant_rows, option_rows

        if hasattr(conn_or_pool, "acquire"):
            async with conn_or_pool.acquire() as conn:
                product_row, variant_rows, option_rows = await _query(conn)
        else:
            product_row, variant_rows, option_rows = await _query(conn_or_pool)

        groups_dict: dict[int, dict] = {}
        for row in option_rows:
            g_id = row["group_id"]
            if g_id not in groups_dict:
                groups_dict[g_id] = {
                    "group_id": g_id,
                    "name": row["group_name"],
                    "min_select": row["min_select"],
                    "max_select": row["max_select"],
                    "free_count": row["free_count"],
                    "items": [],
                }

            groups_dict[g_id]["items"].append(
                {
                    "variant_id": row["variant_id"],
                    "name": row["name"],
                    "price_delta": row["price_delta"],
                }
            )

        result = ProductDetailOut(
            **dict(product_row),
            variants=[ProductVariantOut(**dict(v)) for v in variant_rows],
            option_groups=list(groups_dict.values()),
        )

        if not bypass_cache:
            await set_cached_json(cache_key, result.model_dump(mode="json"))

        return result
