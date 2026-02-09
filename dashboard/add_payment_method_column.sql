-- Add payment_method column to orders table if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'pendiente';

-- Update existing records to have a default if needed
UPDATE orders SET payment_method = 'pendiente' WHERE payment_method IS NULL;
