-- ============================================================
-- BACKUP COMPLETO DE LA BASE DE DATOS — RestoBot
-- 
-- CÓMO USAR:
-- 1. Ir a Supabase Dashboard → SQL Editor
-- 2. Ejecutar CADA sección por separado
-- 3. Copiar los resultados y guardarlos en un archivo .sql
--
-- NOTA: Este script genera consultas SELECT que puedes
-- exportar. Para un dump completo, usa pg_dump.
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- SECCIÓN 1: EXPORTAR ESTRUCTURA (DDL)
-- Ejecutar esto para ver todas las tablas y sus columnas
-- ═══════════════════════════════════════════════════════════════

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ═══════════════════════════════════════════════════════════════
-- SECCIÓN 2: EXPORTAR DATOS — Ejecutar cada SELECT por separado
-- y exportar como CSV desde el botón de Supabase
-- ═══════════════════════════════════════════════════════════════

-- 2.1 Roles
SELECT * FROM roles ORDER BY id;

-- 2.2 Perfiles de usuarios
SELECT * FROM profiles ORDER BY created_at;

-- 2.3 Sucursales  
SELECT * FROM branches ORDER BY id;

-- 2.4 Productos
SELECT * FROM products ORDER BY id;

-- 2.5 Categorías (si existe)
-- SELECT * FROM categories ORDER BY id;

-- 2.6 Pedidos
SELECT * FROM orders ORDER BY created_at DESC;

-- 2.7 Items de pedidos
SELECT * FROM order_items ORDER BY id;

-- 2.8 Turnos/Cajas
SELECT * FROM shifts ORDER BY start_time DESC;

-- 2.9 Reservas de hotel (si existe)
SELECT * FROM bookings ORDER BY created_at DESC;

-- 2.10 Habitaciones (si existe)
SELECT * FROM rooms ORDER BY id;

-- 2.11 Cuentas contables (si existe)
-- SELECT * FROM accounts ORDER BY code;

-- 2.12 Asientos contables (si existe)
-- SELECT * FROM journal_entries ORDER BY created_at DESC;


-- ═══════════════════════════════════════════════════════════════
-- SECCIÓN 3: EXPORTAR FUNCIONES Y TRIGGERS
-- ═══════════════════════════════════════════════════════════════

SELECT 
    routine_name AS function_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;


-- ═══════════════════════════════════════════════════════════════
-- SECCIÓN 4: EXPORTAR POLÍTICAS RLS
-- ═══════════════════════════════════════════════════════════════

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ═══════════════════════════════════════════════════════════════
-- SECCIÓN 5: VER TABLAS EN REALTIME
-- ═══════════════════════════════════════════════════════════════

SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
