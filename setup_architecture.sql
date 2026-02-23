-- ============================================================
-- ARQUITECTURA MAESTRA DE ROLES Y USUARIOS — RestoBot
-- Ejecutar en: Supabase SQL Editor
-- 
-- Este script configura:
-- 1. Tabla de roles con permisos definidos por módulo
-- 2. Tabla de perfiles vinculada a auth.users
-- 3. Trigger para auto-crear perfil al registrar usuario
-- 4. RLS sin recursión (usando security definer)
-- 5. Realtime habilitado en tablas clave
-- ============================================================


-- ============================================================
-- PASO 1: TABLA DE ROLES PREDEFINIDOS
-- Define los roles del sistema con sus permisos por módulo
-- ============================================================

-- Asegurarse de que la tabla roles existe con la estructura correcta
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,  -- admin, gerente, cajero, etc.
    label       TEXT NOT NULL,         -- "Administrador", "Gerente", etc.
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system   BOOLEAN DEFAULT false, -- true = no se puede borrar
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Limpiar roles existentes para insertar los correctos
TRUNCATE TABLE roles RESTART IDENTITY CASCADE;

-- Insertar los 7 roles del sistema
INSERT INTO roles (name, label, description, is_system, permissions) VALUES

-- ADMIN: acceso total
('admin', 'Administrador', 'Acceso total al sistema', true, '{
    "restaurante": {"create": true,  "read": true,  "update": true,  "delete": true},
    "hotel":       {"create": true,  "read": true,  "update": true,  "delete": true},
    "financiero":  {"create": true,  "read": true,  "update": true,  "delete": true},
    "usuarios":    {"create": true,  "read": true,  "update": true,  "delete": true},
    "sedes":       {"create": true,  "read": true,  "update": true,  "delete": true},
    "marketing":   {"create": true,  "read": true,  "update": true,  "delete": true},
    "qr_tools":    {"create": true,  "read": true,  "update": true,  "delete": true},
    "operaciones": {"create": true,  "read": true,  "update": true,  "delete": true}
}'::jsonb),

-- GERENTE: igual que admin pero sin gestión de usuarios y sedes
('gerente', 'Gerente', 'Gestión operativa completa', true, '{
    "restaurante": {"create": true,  "read": true,  "update": true,  "delete": true},
    "hotel":       {"create": true,  "read": true,  "update": true,  "delete": true},
    "financiero":  {"create": true,  "read": true,  "update": false, "delete": false},
    "usuarios":    {"create": false, "read": true,  "update": false, "delete": false},
    "sedes":       {"create": false, "read": true,  "update": false, "delete": false},
    "marketing":   {"create": true,  "read": true,  "update": true,  "delete": false},
    "qr_tools":    {"create": true,  "read": true,  "update": true,  "delete": false},
    "operaciones": {"create": true,  "read": true,  "update": true,  "delete": false}
}'::jsonb),

-- CAJERO: manejo de caja, pedidos y turnos
('cajero', 'Cajero', 'Gestión de pedidos y caja', false, '{
    "restaurante": {"create": true,  "read": true,  "update": true,  "delete": false},
    "hotel":       {"create": false, "read": false, "update": false, "delete": false},
    "financiero":  {"create": false, "read": false, "update": false, "delete": false},
    "usuarios":    {"create": false, "read": false, "update": false, "delete": false},
    "sedes":       {"create": false, "read": false, "update": false, "delete": false},
    "marketing":   {"create": false, "read": false, "update": false, "delete": false},
    "qr_tools":    {"create": false, "read": true,  "update": false, "delete": false},
    "operaciones": {"create": false, "read": true,  "update": false, "delete": false}
}'::jsonb),

-- MESERO: ver pedidos, cambiar estado a entregado
('mesero', 'Mesero', 'Atención de mesas y pedidos', false, '{
    "restaurante": {"create": false, "read": true,  "update": true,  "delete": false},
    "hotel":       {"create": false, "read": false, "update": false, "delete": false},
    "financiero":  {"create": false, "read": false, "update": false, "delete": false},
    "usuarios":    {"create": false, "read": false, "update": false, "delete": false},
    "sedes":       {"create": false, "read": false, "update": false, "delete": false},
    "marketing":   {"create": false, "read": false, "update": false, "delete": false},
    "qr_tools":    {"create": false, "read": true,  "update": false, "delete": false},
    "operaciones": {"create": false, "read": true,  "update": false, "delete": false}
}'::jsonb),

-- COCINA: ver pedidos en fabricación, marcar como listos
('cocina', 'Cocina', 'Visualización y gestión de producción', false, '{
    "restaurante": {"create": false, "read": true,  "update": true,  "delete": false},
    "hotel":       {"create": false, "read": false, "update": false, "delete": false},
    "financiero":  {"create": false, "read": false, "update": false, "delete": false},
    "usuarios":    {"create": false, "read": false, "update": false, "delete": false},
    "sedes":       {"create": false, "read": false, "update": false, "delete": false},
    "marketing":   {"create": false, "read": false, "update": false, "delete": false},
    "qr_tools":    {"create": false, "read": false, "update": false, "delete": false},
    "operaciones": {"create": false, "read": false, "update": false, "delete": false}
}'::jsonb),

-- RECEPCION: gestión de reservas y huéspedes del hotel
('recepcion', 'Recepción', 'Gestión de reservas y hotel', false, '{
    "restaurante": {"create": false, "read": true,  "update": false, "delete": false},
    "hotel":       {"create": true,  "read": true,  "update": true,  "delete": false},
    "financiero":  {"create": false, "read": false, "update": false, "delete": false},
    "usuarios":    {"create": false, "read": false, "update": false, "delete": false},
    "sedes":       {"create": false, "read": false, "update": false, "delete": false},
    "marketing":   {"create": false, "read": false, "update": false, "delete": false},
    "qr_tools":    {"create": false, "read": true,  "update": false, "delete": false},
    "operaciones": {"create": false, "read": true,  "update": false, "delete": false}
}'::jsonb),

-- ANALISTA: solo lectura de reportes y financiero
('analista', 'Analista', 'Acceso de solo lectura a reportes', false, '{
    "restaurante": {"create": false, "read": true,  "update": false, "delete": false},
    "hotel":       {"create": false, "read": true,  "update": false, "delete": false},
    "financiero":  {"create": false, "read": true,  "update": false, "delete": false},
    "usuarios":    {"create": false, "read": false, "update": false, "delete": false},
    "sedes":       {"create": false, "read": true,  "update": false, "delete": false},
    "marketing":   {"create": false, "read": true,  "update": false, "delete": false},
    "qr_tools":    {"create": false, "read": false, "update": false, "delete": false},
    "operaciones": {"create": false, "read": true,  "update": false, "delete": false}
}'::jsonb);


-- ============================================================
-- PASO 2: ACTUALIZAR TABLA PROFILES
-- Asegurar que tiene todos los campos necesarios
-- ============================================================

-- Agregar columnas faltantes si no existen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role       TEXT NOT NULL DEFAULT 'cajero';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB; -- NULL = usa permisos del rol
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraint: rol debe ser uno de los roles válidos
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin','gerente','cajero','mesero','cocina','recepcion','analista'));


-- ============================================================
-- PASO 3: TRIGGER — Auto-crear perfil al registrar usuario
-- Cuando alguien se registra en Supabase Auth, se crea
-- automáticamente su perfil en la tabla profiles
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Ejecuta con permisos del propietario de la función
SET search_path = public
AS $$
DECLARE
    default_role TEXT;
    user_name    TEXT;
    user_email   TEXT;
BEGIN
    -- Obtener datos del nuevo usuario
    user_email := NEW.email;
    user_name  := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    default_role := COALESCE(
        NEW.raw_user_meta_data->>'role',
        'cajero'  -- Rol por defecto para nuevos usuarios
    );

    -- Insertar perfil (o actualizar si ya existe)
    INSERT INTO public.profiles (id, full_name, email, role, active)
    VALUES (NEW.id, user_name, user_email, default_role, true)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email     = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Crear o reemplazar el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger para actualizar updated_at automáticamente en profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PASO 4: RLS SIN RECURSIÓN
-- Función SECURITY DEFINER para obtener el rol actual
-- sin consultar profiles desde adentro de profiles
-- ============================================================

-- Función auxiliar que obtiene el rol del usuario actual
-- SIN causar recursión (usa SECURITY DEFINER + search_path fijo)
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Habilitar RLS 
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "own_profile_select"        ON profiles;
DROP POLICY IF EXISTS "admin_view_all_profiles"   ON profiles;
DROP POLICY IF EXISTS "admin_insert_profiles"     ON profiles;
DROP POLICY IF EXISTS "admin_update_profiles"     ON profiles;
DROP POLICY IF EXISTS "admin_delete_profiles"     ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy"    ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy"    ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy"    ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy"    ON profiles;

-- SELECT: cada usuario ve su perfil; admin/gerente ven todos
CREATE POLICY "profiles_select"
ON profiles FOR SELECT TO authenticated
USING (
    auth.uid() = id
    OR auth_user_role() IN ('admin', 'gerente')
);

-- INSERT: solo admin/gerente pueden crear perfiles manualmente
-- (el trigger de auth lo hace automáticamente para nuevos usuarios)
CREATE POLICY "profiles_insert"
ON profiles FOR INSERT TO authenticated
WITH CHECK (
    auth_user_role() IN ('admin', 'gerente')
);

-- UPDATE: el propio usuario o admin/gerente pueden editar
CREATE POLICY "profiles_update"
ON profiles FOR UPDATE TO authenticated
USING (
    auth.uid() = id
    OR auth_user_role() IN ('admin', 'gerente')
);

-- DELETE: solo admin puede eliminar perfiles
CREATE POLICY "profiles_delete"
ON profiles FOR DELETE TO authenticated
USING (
    auth_user_role() = 'admin'
);


-- ============================================================
-- PASO 5: HABILITAR REALTIME EN TODAS LAS TABLAS CLAVE
-- ============================================================

DO $$
DECLARE
    t TEXT;
    tables_to_enable TEXT[] := ARRAY[
        'orders', 'order_items', 'shifts',
        'bookings', 'room_charges', 'rooms',
        'profiles', 'products', 'branches'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_enable LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
            RAISE NOTICE 'Realtime habilitado en tabla: %', t;
        ELSE
            RAISE NOTICE 'Tabla % ya estaba en Realtime', t;
        END IF;
    END LOOP;
END $$;


-- ============================================================
-- PASO 6: SINCRONIZAR PERFILES CON AUTH USUARIOS EXISTENTES
-- ============================================================

-- Crear perfiles para usuarios de Auth que no tienen perfil aún
INSERT INTO profiles (id, email, full_name, role, active)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'role', 'cajero'),
    true
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

-- Ver roles creados
SELECT name, label, description FROM roles ORDER BY id;

-- Ver perfiles de usuarios
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.active,
    p.branch_id
FROM profiles p
ORDER BY p.role, p.full_name;

-- Ver estado de Realtime
SELECT tablename AS "Tabla con Realtime"
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
