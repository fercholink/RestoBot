-- Arreglar permisos RLS para el módulo de Hotel
-- Habilita lectura y escritura pública (o autenticada) en las tablas necesarias

-- 1. Branches (Sucursales/Sedes)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable read access for all users" ON branches;
    DROP POLICY IF EXISTS "Enable insert access for all users" ON branches;
    DROP POLICY IF EXISTS "Enable update access for all users" ON branches;
    
    CREATE POLICY "Enable read access for all users" ON branches FOR SELECT USING (true);
    CREATE POLICY "Enable insert access for all users" ON branches FOR INSERT WITH CHECK (true);
    CREATE POLICY "Enable update access for all users" ON branches FOR UPDATE USING (true);
END $$;

-- 2. Floors (Pisos)
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable read access for all users" ON floors;
    DROP POLICY IF EXISTS "Enable insert access for all users" ON floors;
    DROP POLICY IF EXISTS "Enable update access for all users" ON floors;

    CREATE POLICY "Enable read access for all users" ON floors FOR SELECT USING (true);
    CREATE POLICY "Enable insert access for all users" ON floors FOR INSERT WITH CHECK (true);
    CREATE POLICY "Enable update access for all users" ON floors FOR UPDATE USING (true);
END $$;

-- 3. Rooms (Habitaciones)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
    DROP POLICY IF EXISTS "Enable insert access for all users" ON rooms;
    DROP POLICY IF EXISTS "Enable update access for all users" ON rooms;

    CREATE POLICY "Enable read access for all users" ON rooms FOR SELECT USING (true);
    CREATE POLICY "Enable insert access for all users" ON rooms FOR INSERT WITH CHECK (true);
    CREATE POLICY "Enable update access for all users" ON rooms FOR UPDATE USING (true);
END $$;

-- 4. Bookings (Reservas)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable read access for all users" ON bookings;
    DROP POLICY IF EXISTS "Enable insert access for all users" ON bookings;
    DROP POLICY IF EXISTS "Enable update access for all users" ON bookings;

    CREATE POLICY "Enable read access for all users" ON bookings FOR SELECT USING (true);
    CREATE POLICY "Enable insert access for all users" ON bookings FOR INSERT WITH CHECK (true);
    CREATE POLICY "Enable update access for all users" ON bookings FOR UPDATE USING (true);
END $$;

-- 5. Insertar Sede por Defecto si no existe
INSERT INTO branches (name, address, phone, active)
SELECT 'Sede Principal', 'Calle Principal #123', '3001234567', true
WHERE NOT EXISTS (SELECT 1 FROM branches);
