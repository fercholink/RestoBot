-- ============================================================
-- SCRIPT DE PRUEBA PARA CONSULTA DE PRODUCTOS (N8N)
-- Ejecuta este script en el Editor SQL de Supabase
-- ============================================================

-- 1. Verificar que existen datos (Opcional: Descomentar si la tabla está vacía para probar)
/*
INSERT INTO categories (name, icon) VALUES 
('Hamburguesas', '🍔'),
('Perros', '🌭')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, price, category_id, available, description, base_ingredients, extras) 
VALUES 
('Hamburguesa Clásica', 15000, (SELECT id FROM categories WHERE name='Hamburguesas' LIMIT 1), true, 'Deliciosa carne artesanal', '["Carne", "Queso", "Lechuga"]'::jsonb, '[{"name": "Tocineta", "price": 3000}]'::jsonb)
ON CONFLICT DO NOTHING;
*/

-- 2. LA CONSULTA QUE USARÁ N8N
-- Esta consulta une productos con categorías y trae los ingredientes/extras formato JSON
SELECT 
    c.name as "Categoría",
    p.name as "Producto",
    p.price as "Precio Base",
    p.description as "Descripción",
    p.base_ingredients as "Ingredientes",
    p.extras as "Extras Disponibles"
FROM 
    products p
JOIN 
    categories c ON p.category_id = c.id
WHERE 
    p.available = true
ORDER BY 
    c.name, p.name;
