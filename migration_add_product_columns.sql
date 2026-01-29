-- Migration script to add missing columns to products table
-- Run this in your Postgres Easypanel interface or via SQL tool

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS base_ingredients TEXT,
ADD COLUMN IF NOT EXISTS extras JSONB;

-- Update existing rows with defaults if needed (optional)

-- Create a View to simplify Supabase API access for the Menu
CREATE OR REPLACE VIEW menu_view AS
SELECT 
    p.id,
    p.name, 
    p.price, 
    p.description, 
    p.base_ingredients, 
    p.extras, 
    p.image_url, 
    c.name as category_name 
FROM products p 
JOIN categories c ON p.category_id = c.id 
WHERE p.available = true;

