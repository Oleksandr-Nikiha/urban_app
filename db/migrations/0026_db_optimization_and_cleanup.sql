-- 0026_db_optimization_and_cleanup.sql
-- Рефакторинг бази даних: оптимізація індексів, чистка старих полів та аудит структури.
-- 1. Видалення надлишкових/дублюючих префіксних індексів.
-- 2. Видалення мертвого поля Directus (products.image) та застарілого індексу.
-- 3. Додавання відсутніх FK-індексів та композитних індексів для частих запитів (POS, Admin, Orders).

BEGIN;

-- 1. Видалення мертвого поля image (UUID) з таблиці products (використовується image_url)
DROP INDEX IF EXISTS idx_products_image;
ALTER TABLE products DROP COLUMN IF EXISTS image;

-- 2. Видалення надлишкових дублікатів префіксних індексів:
-- idx_orders_telegram_id покривається індексом idx_orders_telegram_id_id_desc(telegram_id, id DESC)
DROP INDEX IF EXISTS idx_orders_telegram_id;

-- idx_categories_location покривається idx_categories_listing(location_id, is_visible, sort_order)
DROP INDEX IF EXISTS idx_categories_location;

-- idx_products_category покривається idx_products_listing(category_id, is_available, sort_order)
DROP INDEX IF EXISTS idx_products_category;

-- idx_variants_product покривається idx_variants_product_sort(product_id, is_available, sort_order)
DROP INDEX IF EXISTS idx_variants_product;

-- idx_size_preset_items_preset покривається uq_size_preset_items_preset_label(preset_id, label)
DROP INDEX IF EXISTS idx_size_preset_items_preset;

-- idx_cart_items_cart покривається cart_items_cart_id_variant_id_options_key_key(cart_id, variant_id, options_key)
DROP INDEX IF EXISTS idx_cart_items_cart;

-- idx_delivery_addresses_city_active застарів на користь функціонального idx_delivery_addresses_lower_city_active
DROP INDEX IF EXISTS idx_delivery_addresses_city_active;

-- 3. Створення нових цільових та композитних індексів:
-- Прискорює вибірку замовлень за статусом зі зворотним сортуванням за ID
CREATE INDEX IF NOT EXISTS idx_orders_status_id_desc ON orders(status, id DESC);
-- Старий одиничний індекс за статусом стає надлишковим
DROP INDEX IF EXISTS idx_orders_status;

-- Прискорює вибірку останніх замовлень закладу в POS та адмінці
CREATE INDEX IF NOT EXISTS idx_order_groups_loc_order_desc ON order_groups(location_id, order_id DESC);
DROP INDEX IF EXISTS idx_order_groups_location;

-- Зовнішні ключі для змін POS (запобігає sequential scan при оновленні/видаленні менеджерів)
CREATE INDEX IF NOT EXISTS idx_pos_shifts_opened_by ON pos_shifts(opened_by_id);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_closed_by ON pos_shifts(closed_by_id);

-- Зовнішній ключ для касових операцій POS
CREATE INDEX IF NOT EXISTS idx_pos_cash_ops_location_id ON pos_cash_operations(location_id);

-- Частковий індекс для миттєвої авторизації співробітників за PIN-кодом на POS
CREATE INDEX IF NOT EXISTS idx_managers_active_pin ON managers(pin_code) WHERE is_active = true AND pin_code IS NOT NULL;

COMMIT;
