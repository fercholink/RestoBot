-- Add payment_reference column to orders table if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
