-- 0024_user_delete_cascade_or_set_null.sql
-- Дозволити коректне видалення користувачів без блокування зовнішніми ключами замовлень та розсилок:
-- 1. orders: при видаленні користувача зберігаємо замовлення для фінансової та аналітичної звітності, але зануляємо telegram_id (ON DELETE SET NULL).
-- 2. broadcasts: автор розсилки стає nullable та при видаленні користувача встановлюється у NULL (ON DELETE SET NULL).

-- orders: зміна обмеження зовнішнього ключа на ON DELETE SET NULL
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_telegram_id_fkey;
ALTER TABLE orders
    ADD CONSTRAINT orders_telegram_id_fkey
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE SET NULL;

-- broadcasts: робимо author_id nullable та встановлюємо ON DELETE SET NULL
ALTER TABLE broadcasts ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE broadcasts DROP CONSTRAINT IF EXISTS broadcasts_author_id_fkey;
ALTER TABLE broadcasts
    ADD CONSTRAINT broadcasts_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(telegram_id) ON DELETE SET NULL;
