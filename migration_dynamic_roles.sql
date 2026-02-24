-- ============================================================
-- MIGRACIÓN: Roles Dinámicos — RestoBot
-- Ejecutar en: Supabase SQL Editor
-- 
-- Cambios:
-- 1. Eliminar constraint de roles fijos en profiles
-- 2. Agregar campos de estilo para roles personalizados
-- 3. Agregar RLS a la tabla roles
-- 4. Agregar la tabla roles al Realtime
-- ============================================================

-- PASO 1: Eliminar constraint que limita a roles fijos
-- Permite crear roles personalizados dinámicamente
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- PASO 2: Agregar columnas de estilo a la tabla roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Shield';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Trigger para updated_at en roles
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_updated_at ON roles;
CREATE TRIGGER roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_roles_updated_at();

-- PASO 3: Actualizar roles existentes con colores e iconos
UPDATE roles SET color = '#6c5ce7', icon = 'Crown' WHERE name = 'admin';
UPDATE roles SET color = '#0984e3', icon = 'Briefcase' WHERE name = 'gerente';
UPDATE roles SET color = '#e17055', icon = 'CreditCard' WHERE name = 'cajero';
UPDATE roles SET color = '#00b894', icon = 'ConciergeBell' WHERE name = 'mesero';
UPDATE roles SET color = '#d63031', icon = 'ChefHat' WHERE name = 'cocina';
UPDATE roles SET color = '#a29bfe', icon = 'Building2' WHERE name = 'recepcion';
UPDATE roles SET color = '#636e72', icon = 'BarChart3' WHERE name = 'analista';

-- PASO 4: Función auxiliar auth_user_role (necesaria para las políticas RLS)
-- Obtiene el rol del usuario autenticado SIN causar recursión
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- PASO 5: RLS para la tabla roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
DROP POLICY IF EXISTS "roles_delete" ON roles;

-- Todos los autenticados pueden VER roles
CREATE POLICY "roles_select"
ON roles FOR SELECT TO authenticated
USING (true);

-- Solo admin puede crear roles
CREATE POLICY "roles_insert"
ON roles FOR INSERT TO authenticated
WITH CHECK (auth_user_role() = 'admin');

-- Solo admin puede editar roles
CREATE POLICY "roles_update"
ON roles FOR UPDATE TO authenticated
USING (auth_user_role() = 'admin');

-- Solo admin puede borrar roles NO de sistema
CREATE POLICY "roles_delete"
ON roles FOR DELETE TO authenticated
USING (auth_user_role() = 'admin' AND is_system = false);

-- PASO 5: Agregar roles al Realtime si no está
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'roles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE roles;
        RAISE NOTICE 'Realtime habilitado en tabla: roles';
    ELSE
        RAISE NOTICE 'Tabla roles ya estaba en Realtime';
    END IF;
END $$;

-- VERIFICACIÓN
SELECT id, name, label, description, is_system, color, icon FROM roles ORDER BY id;
