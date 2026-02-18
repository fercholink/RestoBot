-- Migration for Factus Integration
-- 1. Create app_settings table for storing integration credentials
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enhance orders table for Factus
DO $$
BEGIN
    -- Add factus_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factus_id') THEN
        ALTER TABLE orders ADD COLUMN factus_id VARCHAR(100);
    END IF;

    -- Add factus_doc_number if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factus_doc_number') THEN
        ALTER TABLE orders ADD COLUMN factus_doc_number VARCHAR(50);
    END IF;

    -- Add tax_data JSONB if not exists (Critical for Factus Integration)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tax_data') THEN
        ALTER TABLE orders ADD COLUMN tax_data JSONB;
    END IF;

    -- Fix logical typo in schema (duplicate pdf_url) - Postgres handles duplicates by ignoring if exists, but we want to be clean.
    -- We can't easily drop one if they have same name, but in CREATE they do. 
    -- Here we just ensure we have one.
END $$;

-- 3. Initial Seed for Factus Verification (Optional, can be done via UI)
-- INSERT INTO app_settings (key, value, description) VALUES 
-- ('factus_credentials', '{"clientId": "...", "clientSecret": "..."}', 'Factus API Credentials');
