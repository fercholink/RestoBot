-- ============================================================
-- FIX: Infinite Recursion en Políticas RLS de 'profiles'
-- + Configuración completa de usuarios del sistema
--
-- EJECUTAR EN: Supabase SQL Editor
-- URL: https://n8n-bs-comunicaciones-bd-supabase.jz98vr.easypanel.host
-- ============================================================


-- ============================================================
-- PASO 1: Corregir el error de recursión en "profiles"
-- ============================================================

-- Eliminar TODAS las políticas actuales de profiles (causa del bucle)
DROP POLICY IF EXISTS "Users can view own profile"        ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"      ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"    ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles"        ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles"        ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users"  ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated"   ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner"    ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable"      ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy"            ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy"            ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy"            ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy"            ON profiles;

-- Función auxiliar SIN RECURSIÓN: obtiene el rol del usuario actual
-- usando auth.jwt() en vez de consultar profiles (evita el bucle)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER  -- Se ejecuta con permiso del creador, no del caller
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Deshabilitar RLS temporalmente para poder insertar sin trabas
-- (Supabase usa la anon key en el cliente, el service_role pasa siempre)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE  ROW LEVEL SECURITY;

-- Nuevas políticas SIN recursión
-- ① Todo usuario autenticado puede VER su propio perfil
CREATE POLICY "own_profile_select"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ② Admin/Gerente pueden VER todos los perfiles (usando JWT en vez de profiles)
CREATE POLICY "admin_view_all_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role') IN ('admin', 'gerente')
  OR auth.uid() = id  -- el propio usuario siempre puede verse
);

-- ③ Solo service_role puede INSERT (creación por trigger de Auth)
--    y usuarios autenticados con rol admin/gerente
CREATE POLICY "admin_insert_profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role') IN ('admin', 'gerente')
);

-- ④ Cada usuario puede actualizar su propio perfil
--    Admins pueden actualizar cualquiera
CREATE POLICY "admin_update_profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR (auth.jwt() ->> 'role') IN ('admin', 'gerente')
);

-- ⑤ Solo admin puede eliminar perfiles
CREATE POLICY "admin_delete_profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin'
);

-- Permitir que el service_role siempre pase (para triggers y edge functions)
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;


-- ============================================================
-- PASO 2: Crear usuarios en Supabase Auth + sus perfiles
-- (Ejecuta SOLO si quieres crear usuarios de prueba)
-- ============================================================

-- Los usuarios se crean desde el Dashboard de Supabase:
-- Authentication → Users → Add User
-- O desde la app en "Gestión de Personal"

-- Si necesitas insertar perfiles manualmente para usuarios
-- que ya existen en Auth, usa este template:
/*
INSERT INTO profiles (id, full_name, email, role, branch_id, permissions, active)
VALUES
  (
    'UUID-DEL-USUARIO-EN-AUTH',  -- Obtener desde Authentication → Users
    'Nombre Completo',
    'correo@empresa.com',
    'cajero',  -- admin | gerente | cajero | mesero | cocina | recepcion
    (SELECT id FROM branches LIMIT 1),  -- ID de la sede
    '{
      "restaurante": {"create": true, "read": true, "update": true, "delete": false},
      "hotel":       {"create": false,"read": false,"update": false,"delete": false},
      "financiero":  {"create": false,"read": false,"update": false,"delete": false},
      "usuarios":    {"create": false,"read": false,"update": false,"delete": false},
      "sedes":       {"create": false,"read": false,"update": false,"delete": false},
      "marketing":   {"create": false,"read": false,"update": false,"delete": false},
      "qr_tools":    {"create": false,"read": false,"update": false,"delete": false},
      "operaciones": {"create": false,"read": false,"update": false,"delete": false}
    }'::jsonb,
    true
  );
*/


-- ============================================================
-- PASO 3: Verificar que las políticas quedaron bien
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;
