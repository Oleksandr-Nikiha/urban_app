-- 0022_pos_table_workflow.sql
-- Підтримка ресторанного процесу для столиків:
-- 1. Дозвіл 'pending' (очікує оплати) для замовлень за столиками
-- 2. Прапорець is_paid для відстеження оплати замовлення
-- 3. Прапорець is_served у order_items для позначення винесених страв

-- 1. Дозволяємо 'pending' у payment_method
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'qr', 'pending'));

-- 2. Прапорець оплати в orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

UPDATE orders SET is_paid = true WHERE payment_method IN ('cash', 'card', 'qr');

-- 3. Позначка винесення страви офіціантом
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_served BOOLEAN NOT NULL DEFAULT false;
