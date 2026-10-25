-- 0020_bonus_system_and_transactions.sql
-- Система лояльності URBAN CLUB: транзакції балів та бонуси в замовленнях

-- 1. Додаємо в orders поля для списання та нарахування бонусів
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonus_spent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonus_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonus_processed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Таблиця транзакцій бонусів для прозорого аудиту та історії
CREATE TABLE IF NOT EXISTS bonus_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL, -- Додатне число (нарахування), від'ємне (списання)
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'welcome', 'order_accrual', 'order_redemption', 'order_refund', 'admin_adjustment'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonus_tx_user_id ON bonus_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_tx_order_id ON bonus_transactions(order_id);
