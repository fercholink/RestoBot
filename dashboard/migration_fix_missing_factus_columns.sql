-- Migration to add missing columns for Factus Integration
-- This script adds 'pdf_url' and 'factus_status' to the 'orders' table if they don't exist.

DO $$
BEGIN
    -- Add factus_status if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factus_status') THEN
        ALTER TABLE orders ADD COLUMN factus_status VARCHAR(50);
    END IF;

    -- Add pdf_url if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'pdf_url') THEN
        ALTER TABLE orders ADD COLUMN pdf_url TEXT;
    END IF;

END $$;
