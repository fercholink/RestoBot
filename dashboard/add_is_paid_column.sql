-- Add is_paid column to orders table if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Update existing records
UPDATE orders SET is_paid = FALSE WHERE is_paid IS NULL;
