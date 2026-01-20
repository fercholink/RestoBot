-- ==========================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS (SQL)
-- ==========================================

-- OPCIÓN A: Limpiar solo Transacciones (Pedidos y Clientes)
-- Conserva el Menú, las Mesas y los Usuarios.
-- ------------------------------------------
-- TRUNCATE TABLE order_items, orders, customers RESTART IDENTITY CASCADE;

-- OPCIÓN B: Limpieza TOTAL (Borra todo excepto el esquema)
-- Útil para una instalación desde cero.
-- ------------------------------------------
TRUNCATE TABLE 
    order_items, 
    orders, 
    customers, 
    products, 
    tables, 
    users, 
    branches 
RESTART IDENTITY CASCADE;

-- Re-insertar datos base mínimos para poder operar
-- ------------------------------------------
-- INSERT INTO tables (name, qr_code_id) VALUES ('Mesa 1', 'm1'), ('Mesa 2', 'm2');
-- INSERT INTO products (name, category, price) VALUES ('Producto Base', 'general', 1000);
