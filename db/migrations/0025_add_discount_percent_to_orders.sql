-- Add discount_percent to orders table for POS discounts
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percent integer DEFAULT 0;
