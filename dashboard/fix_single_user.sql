-- Solución Específica para f_nis88@hotmail.com
-- 1. Borrar el perfil existente (si existe) para asegurar limpieza
DELETE FROM public.profiles WHERE email = 'f_nis88@hotmail.com';

-- 2. Re-insertar usando el ID correcto desde auth.users
-- Esto garantiza que el enlace (Foreign Key) sea perfecto.
INSERT INTO public.profiles (id, full_name, email, role, branch_id, organization_id, permissions)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'full_name', 'Usuario F_NIS88'),
    email,
    'admin', -- Rol Admin Fijo
    (SELECT id FROM public.branches LIMIT 1),
    (SELECT id FROM public.organizations LIMIT 1),
    '{"all": true}'::jsonb
FROM auth.users 
WHERE email = 'f_nis88@hotmail.com';

-- 3. Verificación de Seguridad (Por si acaso RLS sigue molestando)
-- Forzar que este usuario específico sea "Super Admin" en la definición de políticas (si las hubiera condicionales)
-- (No se requiere SQL extra si el rol ya es 'admin')

-- 4. Actualizar metadatos del usuario en Auth (Opcional, pero ayuda al frontend a tener datos frescos en sesión)
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
WHERE email = 'f_nis88@hotmail.com';
