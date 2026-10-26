import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from src.auth.deps import get_current_staff
from src.db.connection import get_pool
from src.schemas.admin import (
    AvailabilityUpdateIn,
    BulkAvailabilityIn,
    BulkOptionGroupActionIn,
    ProductAdminOut,
    ProductCreateIn,
    ProductOptionGroupAdminOut,
    ProductUpdateIn,
    VariantAdminOut,
    VariantCreateIn,
)

router = APIRouter()


@router.get("/products", response_model=list[ProductAdminOut])
async def list_admin_products(
    category_id: int | None = Query(None),
    location_id: int | None = Query(None),
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Отримання списку страв з усіма варіантами (розмірами/цінами)."""
    target_loc = staff["location_id"] if staff["role"] == "manager" else location_id

    async with pool.acquire() as conn:
        products = await conn.fetch(
            """
            SELECT p.id, p.name, p.category_id, c.name AS category_name,
                   c.location_id, l.name AS location_name,
                   p.description, p.image_url, p.sort_order, p.is_available
            FROM products p
            JOIN categories c ON c.id = p.category_id
            LEFT JOIN locations l ON l.id = c.location_id
            WHERE ($1::int IS NULL
                   OR p.category_id = $1
                   OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $1))
              AND ($2::int IS NULL OR c.location_id = $2)
            ORDER BY c.sort_order, p.sort_order, p.id
            """,
            category_id,
            target_loc,
        )

        product_ids = [p["id"] for p in products]
        if not product_ids:
            return []

        variants = await conn.fetch(
            """
            SELECT id, product_id, label, price, weight, sort_order, is_available
            FROM product_variants
            WHERE product_id = ANY($1::int[])
            ORDER BY sort_order, id
            """,
            product_ids,
        )

        pogs = await conn.fetch(
            """
            SELECT pog.product_id, pog.group_id, g.name AS group_name,
                   pog.min_select, pog.max_select, pog.free_count, pog.sort_order
            FROM product_option_groups pog
            JOIN option_groups g ON g.id = pog.group_id
            WHERE pog.product_id = ANY($1::int[])
            ORDER BY pog.sort_order, pog.group_id
            """,
            product_ids,
        )

    # Групуємо варіанти по product_id
    variants_by_product: dict[int, list[VariantAdminOut]] = {}
    for v in variants:
        v_out = VariantAdminOut(**dict(v))
        variants_by_product.setdefault(v["product_id"], []).append(v_out)

    pogs_by_product: dict[int, list[ProductOptionGroupAdminOut]] = {}
    for pg in pogs:
        pg_out = ProductOptionGroupAdminOut(**dict(pg))
        pogs_by_product.setdefault(pg["product_id"], []).append(pg_out)

    result = []
    for p in products:
        p_dict = dict(p)
        p_dict["variants"] = variants_by_product.get(p["id"], [])
        p_dict["option_groups"] = pogs_by_product.get(p["id"], [])
        result.append(ProductAdminOut(**p_dict))

    return result


@router.post("/products", response_model=ProductAdminOut)
async def create_product(
    data: ProductCreateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Створення нової страви разом із варіантами цін."""
    async with pool.acquire() as conn, conn.transaction():
        cat = await conn.fetchrow(
            """
            SELECT c.id, c.name, c.location_id, l.name AS location_name
            FROM categories c
            JOIN locations l ON l.id = c.location_id
            WHERE c.id = $1
            """,
            data.category_id,
        )
        if not cat:
            raise HTTPException(status_code=404, detail="Категорію не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and cat["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до цієї категорії")

        p_row = await conn.fetchrow(
            """
            INSERT INTO products (
                category_id, name, description, image_url, sort_order, is_available
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, category_id, name, description,
                      image_url, sort_order, is_available
            """,
            data.category_id,
            data.name,
            data.description,
            data.image_url or data.image,
            data.sort_order,
            data.is_available,
        )
        product_id = p_row["id"]

        variants_out = []
        variants_to_insert = data.variants or [
            VariantCreateIn(label="Стандарт", price=0.0, sort_order=0, is_available=True)
        ]

        for v in variants_to_insert:
            v_row = await conn.fetchrow(
                """
                INSERT INTO product_variants (
                    product_id, label, price, weight, sort_order, is_available
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, product_id, label, price, weight, sort_order, is_available
                """,
                product_id,
                v.label,
                v.price,
                v.weight,
                v.sort_order,
                v.is_available,
            )
            variants_out.append(VariantAdminOut(**dict(v_row)))

    res = dict(p_row)
    res["category_name"] = cat["name"]
    res["location_id"] = cat["location_id"]
    res["location_name"] = cat["location_name"]
    res["variants"] = variants_out
    return ProductAdminOut(**res)


@router.patch("/products/bulk/availability")
async def bulk_toggle_products_availability(
    data: BulkAvailabilityIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Масова зміна доступності страв (включення / виключення зі стоп-листа)."""
    if not data.product_ids:
        return {"updated_count": 0, "product_ids": [], "is_available": data.is_available}

    async with pool.acquire() as conn:
        if staff["role"] == "manager" and staff["location_id"]:
            allowed = await conn.fetch(
                """
                SELECT p.id
                FROM products p
                JOIN categories c ON c.id = p.category_id
                WHERE p.id = ANY($1::int[]) AND c.location_id = $2
                """,
                data.product_ids,
                staff["location_id"],
            )
            product_ids = [r["id"] for r in allowed]
        else:
            allowed = await conn.fetch(
                "SELECT id FROM products WHERE id = ANY($1::int[])",
                data.product_ids,
            )
            product_ids = [r["id"] for r in allowed]

        if not product_ids:
            return {"updated_count": 0, "product_ids": [], "is_available": data.is_available}

        await conn.execute(
            "UPDATE products SET is_available = $1 WHERE id = ANY($2::int[])",
            data.is_available,
            product_ids,
        )
        await conn.execute(
            "UPDATE product_variants SET is_available = $1 WHERE product_id = ANY($2::int[])",
            data.is_available,
            product_ids,
        )

    return {
        "updated_count": len(product_ids),
        "product_ids": product_ids,
        "is_available": data.is_available,
    }


@router.post("/products/bulk/option-groups")
async def bulk_manage_product_option_groups(
    data: BulkOptionGroupActionIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Масове керування додатками до страв: attach, detach, replace, clear."""
    if not data.product_ids:
        return {"updated_count": 0, "product_ids": [], "action": data.action}

    async with pool.acquire() as conn:
        if staff["role"] == "manager" and staff["location_id"]:
            allowed = await conn.fetch(
                """
                SELECT p.id
                FROM products p
                JOIN categories c ON c.id = p.category_id
                WHERE p.id = ANY($1::int[]) AND c.location_id = $2
                """,
                data.product_ids,
                staff["location_id"],
            )
            product_ids = [r["id"] for r in allowed]
        else:
            allowed = await conn.fetch(
                "SELECT id FROM products WHERE id = ANY($1::int[])",
                data.product_ids,
            )
            product_ids = [r["id"] for r in allowed]

        if not product_ids:
            return {"updated_count": 0, "product_ids": [], "action": data.action}

        if data.action == "attach":
            if not data.group_id:
                raise HTTPException(status_code=400, detail="group_id є обов'язковим для attach")
            group = await conn.fetchrow("SELECT id FROM option_groups WHERE id = $1", data.group_id)
            if not group:
                raise HTTPException(status_code=404, detail="Групу додатків не знайдено")
            if data.min_select < 0 or data.max_select < data.min_select:
                raise HTTPException(
                    status_code=400,
                    detail="Некоректні ліміти: max_select повинен бути >= min_select >= 0",
                )
            await conn.execute(
                """
                INSERT INTO product_option_groups (
                    product_id, group_id, min_select, max_select, free_count, sort_order
                )
                SELECT pid, $2, $3, $4, $5, 0
                FROM unnest($1::int[]) AS pid
                ON CONFLICT (product_id, group_id) DO UPDATE
                    SET min_select = EXCLUDED.min_select,
                        max_select = EXCLUDED.max_select,
                        free_count = EXCLUDED.free_count
                """,
                product_ids,
                data.group_id,
                data.min_select,
                data.max_select,
                data.free_count,
            )

        elif data.action == "detach":
            if not data.group_id:
                raise HTTPException(status_code=400, detail="group_id є обов'язковим для detach")
            await conn.execute(
                """
                DELETE FROM product_option_groups
                WHERE product_id = ANY($1::int[]) AND group_id = $2
                """,
                product_ids,
                data.group_id,
            )

        elif data.action == "replace":
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM product_option_groups WHERE product_id = ANY($1::int[])",
                    product_ids,
                )
                if data.groups:
                    for g in data.groups:
                        if g.min_select < 0 or g.max_select < g.min_select:
                            raise HTTPException(
                                status_code=400,
                                detail=(
                                    f"Некоректні ліміти для групи {g.group_id}: "
                                    "max_select >= min_select >= 0"
                                ),
                            )
                        await conn.execute(
                            """
                            INSERT INTO product_option_groups (
                                product_id, group_id, min_select, max_select, free_count, sort_order
                            )
                            SELECT pid, $2, $3, $4, $5, $6
                            FROM unnest($1::int[]) AS pid
                            ON CONFLICT (product_id, group_id) DO UPDATE
                                SET min_select = EXCLUDED.min_select,
                                    max_select = EXCLUDED.max_select,
                                    free_count = EXCLUDED.free_count,
                                    sort_order = EXCLUDED.sort_order
                            """,
                            product_ids,
                            g.group_id,
                            g.min_select,
                            g.max_select,
                            g.free_count,
                            g.sort_order,
                        )

        elif data.action == "clear":
            await conn.execute(
                "DELETE FROM product_option_groups WHERE product_id = ANY($1::int[])",
                product_ids,
            )

    return {
        "updated_count": len(product_ids),
        "product_ids": product_ids,
        "action": data.action,
    }


@router.patch("/products/{product_id}", response_model=ProductAdminOut)
async def update_product(
    product_id: int,
    data: ProductUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Оновлення основних даних страви."""
    async with pool.acquire() as conn:
        p = await conn.fetchrow(
            """
            SELECT p.id, c.location_id
            FROM products p
            JOIN categories c ON c.id = p.category_id
            WHERE p.id = $1
            """,
            product_id,
        )
        if not p:
            raise HTTPException(status_code=404, detail="Страву не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and p["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до страви іншого закладу")

        updates = []
        params = [product_id]
        dumped = data.model_dump(exclude_unset=True)
        for field, val in dumped.items():
            if field == "image":
                if "image_url" not in dumped:
                    params.append(val)
                    updates.append(f"image_url = ${len(params)}")
                continue
            params.append(val)
            updates.append(f"{field} = ${len(params)}")

        if updates:
            await conn.execute(
                f"UPDATE products SET {', '.join(updates)} WHERE id = $1",
                *params,
            )

        updated_p = await conn.fetchrow(
            """
            SELECT p.id, p.name, p.category_id, c.name AS category_name,
                   c.location_id, l.name AS location_name,
                   p.description, p.image_url, p.sort_order, p.is_available
            FROM products p
            JOIN categories c ON c.id = p.category_id
            LEFT JOIN locations l ON l.id = c.location_id
            WHERE p.id = $1
            """,
            product_id,
        )
        variants = await conn.fetch(
            "SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order, id",
            product_id,
        )

    res = dict(updated_p)
    res["variants"] = [VariantAdminOut(**dict(v)) for v in variants]
    return ProductAdminOut(**res)


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Видалення страви (та її варіантів каскадно)."""
    async with pool.acquire() as conn:
        p = await conn.fetchrow(
            """
            SELECT p.id, c.location_id
            FROM products p
            JOIN categories c ON c.id = p.category_id
            WHERE p.id = $1
            """,
            product_id,
        )
        if not p:
            raise HTTPException(status_code=404, detail="Страву не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and p["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу до страви іншого закладу")

        await conn.execute("DELETE FROM products WHERE id = $1", product_id)

    return {"status": "ok", "message": "Страву видалено"}


# ============================================================================
# 5. Швидкий стоп-лист (Швидке перемикання наявності)
# ============================================================================


@router.patch("/products/{product_id}/toggle-availability")
async def toggle_product_availability(
    product_id: int,
    data: AvailabilityUpdateIn,
    pool: asyncpg.Pool = Depends(get_pool),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """Швидке включення / виключення всієї страви зі стоп-листа."""
    async with pool.acquire() as conn:
        p = await conn.fetchrow(
            """
            SELECT p.id, c.location_id
            FROM products p
            JOIN categories c ON c.id = p.category_id
            WHERE p.id = $1
            """,
            product_id,
        )
        if not p:
            raise HTTPException(status_code=404, detail="Страву не знайдено")

        if (
            staff["role"] == "manager"
            and staff["location_id"]
            and p["location_id"] != staff["location_id"]
        ):
            raise HTTPException(status_code=403, detail="Немає доступу")

        await conn.execute(
            "UPDATE products SET is_available = $1 WHERE id = $2",
            data.is_available,
            product_id,
        )

    return {"id": product_id, "is_available": data.is_available}

