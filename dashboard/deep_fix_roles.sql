-- 1. Sincronizar Usuarios de Auth con Perfiles
-- Inserta un perfil para cada usuario registrado que no tenga uno.
INSERT INTO public.profiles (id, full_name, email, role, branch_id, organization_id, permissions)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    au.email,
    'admin', -- Por defecto Admin para desbloquear acceso
    (SELECT id FROM public.branches LIMIT 1), -- Asignar primera sede
    (SELECT id FROM public.organizations LIMIT 1), -- Asignar organización
    '{"all": true}'::jsonb -- Permisos totales
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- 2. Corregir cualquier perfil existente sin rol válido
UPDATE public.profiles
SET role = 'admin', permissions = '{"all": true}'::jsonb
WHERE role = 'authenticated' OR role IS NULL;

-- 3. HABILITAR LECTURA TOTAL DE PERFILES (Solución Definitiva RLS)
-- Esto permite que ANY usuario logueado pueda leer la tabla de perfiles.
-- Es necesario para que el UserManagement cargue la lista y AuthContext cargue el propio perfil.

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON public.profiles;

CREATE POLICY "Lectura Total Perfiles" ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 4. Habilitar Escritura completa para Admins
CREATE POLICY "Escritura Admins" ON public.profiles
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'gerente')
    )
);

-- 5. Permitir al usuario editar su propio perfil
CREATE POLICY "Editar Propio Perfil" ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- 6. Asegurar Organization en Branches (Re-apply para seguridad)
UPDATE public.branches 
SET organization_id = (SELECT id FROM public.organizations LIMIT 1) 
WHERE organization_id IS NULL;
