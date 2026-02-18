-- Add unit_price column to order_items if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'unit_price') THEN
        ALTER TABLE order_items ADD COLUMN unit_price DECIMAL(10, 2);
    END IF;
END $$;

-- Add product_name column to order_items if it doesn't exist (Good for historical records)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name') THEN
        ALTER TABLE order_items ADD COLUMN product_name VARCHAR(100);
    END IF;
END $$;
