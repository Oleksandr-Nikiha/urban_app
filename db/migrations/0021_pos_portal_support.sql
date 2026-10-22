-- 0021_pos_portal_support.sql
-- Підтримка POS-терміналу для офіціантів та персоналу:
-- 1. Дозвіл типу замовлення 'dine_in' (в залі / столик)
-- 2. Номер столика та ім'я офіціанта в замовленні
-- 3. PIN-код та ім'я персоналу для швидкої авторизації на POS

-- 1. Оновлення перевірки fulfillment_type у таблиці orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_type_check
    CHECK (fulfillment_type IN ('delivery', 'pickup', 'dine_in'));

-- 2. Додаткові поля в orders для POS
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(32);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_name VARCHAR(100);

-- 3. Додавання PIN-коду та розширення ролей персоналу у managers
ALTER TABLE managers ADD COLUMN IF NOT EXISTS pin_code VARCHAR(10);
ALTER TABLE managers ADD COLUMN IF NOT EXISTS staff_name VARCHAR(100);

ALTER TABLE managers DROP CONSTRAINT IF EXISTS managers_role_check;
ALTER TABLE managers ADD CONSTRAINT managers_role_check
    CHECK (role IN ('admin', 'manager', 'waiter', 'cashier'));

-- Дозволяємо створювати персонал без обов'язкового прив'язування до Telegram ID
ALTER TABLE managers ALTER COLUMN telegram_id DROP NOT NULL;

-- Встановлюємо дефолтний PIN '1111' для наявного персоналу/адміна
UPDATE managers SET pin_code = '1111' WHERE pin_code IS NULL;

-- Оновлюємо ім'я для першого адміна, якщо воно пусте
UPDATE managers m
SET staff_name = COALESCE(u.first_name, 'Адміністратор')
FROM users u
WHERE m.telegram_id = u.telegram_id AND m.staff_name IS NULL;
