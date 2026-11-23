-- 0027_secure_pos_pins.sql
-- Безпечне збереження PIN-кодів персоналу POS-терміналу (хешування та розширення поля)

ALTER TABLE managers ALTER COLUMN pin_code TYPE VARCHAR(255);
