-- 0023_pos_shifts_and_cancellations.sql
-- Касові зміни (X/Z звіти), службові внесення/вилучення та причини скасування чеків у POS

-- 1. Таблиця касових змін
CREATE TABLE IF NOT EXISTS pos_shifts (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    opened_by_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
    opened_by_name TEXT NOT NULL,
    closed_by_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
    closed_by_name TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opening_cash NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    closing_cash_actual NUMERIC(10, 2),
    closing_cash_expected NUMERIC(10, 2),
    cash_inflow NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cash_outflow NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_orders_count INTEGER NOT NULL DEFAULT 0,
    total_revenue NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cash_revenue NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    card_revenue NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    bonus_spent_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_location_status ON pos_shifts(location_id, status);

-- 2. Таблиця службових операцій (внесення/вилучення готівки)
CREATE TABLE IF NOT EXISTS pos_cash_operations (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    staff_name TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('cash_in', 'cash_out')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_cash_ops_shift ON pos_cash_operations(shift_id);

-- 3. Прив'язка замовлень до зміни та причина скасування
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);

-- 4. Права доступу для сервісного користувача
GRANT ALL ON pos_shifts TO svc_urban_bites;
GRANT ALL ON pos_cash_operations TO svc_urban_bites;
GRANT USAGE, SELECT ON SEQUENCE pos_shifts_id_seq TO svc_urban_bites;
GRANT USAGE, SELECT ON SEQUENCE pos_cash_operations_id_seq TO svc_urban_bites;
