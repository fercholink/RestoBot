-- FIX: Permitir acceso público (anon) a las tablas del hotel
-- Esto es necesario si la autenticación no es estricta o persistente en la app.

-- 1. Eliminar políticas restrictivas anteriores
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON rooms;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON guests;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON bookings;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON room_charges;

-- 2. Crear políticas permisivas (Public Access)
DROP POLICY IF EXISTS "Enable all access for everyone" ON rooms;
CREATE POLICY "Enable all access for everyone" ON rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for everyone" ON guests;
CREATE POLICY "Enable all access for everyone" ON guests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for everyone" ON bookings;
CREATE POLICY "Enable all access for everyone" ON bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for everyone" ON room_charges;
CREATE POLICY "Enable all access for everyone" ON room_charges FOR ALL USING (true) WITH CHECK (true);

-- 3. Confirmación
COMMENT ON TABLE bookings IS 'Reservas de Hotel (Public Access Enabled)';
