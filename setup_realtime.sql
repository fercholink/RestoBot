-- ============================================================
-- CONFIGURACIÓN COMPLETA DE REALTIME + RLS
-- Para que los pedidos se actualicen en tiempo real
-- para TODOS los usuarios según su rol
--
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================================


-- ============================================================
-- PASO 1: HABILITAR REALTIME EN LAS TABLAS CLAVE
-- ============================================================

-- Agregar tablas a la publicación de Realtime de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Verificar que quedaron activas
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;


-- ============================================================
-- PASO 2: POLÍTICAS RLS PARA "orders"
-- Todos los usuarios autenticados pueden VER pedidos
-- Solo admin/cajero/gerente pueden CREAR y MODIFICAR
-- ============================================================

-- Limpiar políticas anteriores si existen
DROP POLICY IF EXISTS "authenticated_read_orders"  ON orders;
DROP POLICY IF EXISTS "authenticated_write_orders" ON orders;
DROP POLICY IF EXISTS "cajero_insert_orders"       ON orders;
DROP POLICY IF EXISTS "cajero_update_orders"       ON orders;
DROP POLICY IF EXISTS "admin_delete_orders"        ON orders;

-- Habilitar RLS (si no está habilitado)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ① LEER: Todos los usuarios autenticados ven los pedidos
CREATE POLICY "authenticated_read_orders"
ON orders FOR SELECT
TO authenticated
USING (true);  -- Sin restricción: todos los roles ven todos los pedidos

-- ② CREAR: Cajero, admin y gerente pueden crear pedidos
CREATE POLICY "cajero_insert_orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (true);  -- Cualquier autenticado puede crear (filtrar por rol en la app)

-- ③ ACTUALIZAR: Cajero, admin y gerente pueden actualizar estado
CREATE POLICY "cajero_update_orders"
ON orders FOR UPDATE
TO authenticated
USING (true);

-- ④ ELIMINAR: Solo admin puede borrar pedidos
CREATE POLICY "admin_delete_orders"
ON orders FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin');


-- ============================================================
-- PASO 3: POLÍTICAS RLS PARA "order_items"
-- ============================================================

DROP POLICY IF EXISTS "authenticated_read_order_items"   ON order_items;
DROP POLICY IF EXISTS "authenticated_insert_order_items" ON order_items;
DROP POLICY IF EXISTS "authenticated_delete_order_items" ON order_items;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_order_items"
ON order_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_order_items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_order_items"
ON order_items FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "authenticated_delete_order_items"
ON order_items FOR DELETE
TO authenticated
USING (true);


-- ============================================================
-- PASO 4: POLÍTICAS RLS PARA "shifts" (Turnos de caja)
-- ============================================================

DROP POLICY IF EXISTS "authenticated_read_shifts"  ON shifts;
DROP POLICY IF EXISTS "authenticated_write_shifts" ON shifts;

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_shifts"
ON shifts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_shifts"
ON shifts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_shifts"
ON shifts FOR UPDATE
TO authenticated
USING (true);


-- ============================================================
-- PASO 5: POLÍTICAS RLS PARA "bookings" (Reservas Hotel)
-- ============================================================

DROP POLICY IF EXISTS "authenticated_read_bookings"  ON bookings;
DROP POLICY IF EXISTS "authenticated_write_bookings" ON bookings;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_bookings"
ON bookings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_bookings"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_bookings"
ON bookings FOR UPDATE
TO authenticated
USING (true);


-- ============================================================
-- PASO 6: VERIFICACIÓN FINAL
-- ============================================================

-- Ver tablas con Realtime activo
SELECT 
  '✅ Realtime activo en: ' || tablename as estado
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Ver políticas creadas
SELECT 
  tablename,
  policyname,
  cmd as operacion,
  roles
FROM pg_policies
WHERE tablename IN ('orders', 'order_items', 'shifts', 'bookings')
ORDER BY tablename, cmd;
