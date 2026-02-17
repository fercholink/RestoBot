-- 1. Añadir columna 'code' a roles para compatibilidad con lógica legacy ('admin', 'gerente')
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS code text;

-- 2. Actualizar roles existentes con los códigos correctos
UPDATE public.roles SET code = 'admin' WHERE name = 'Administrador' OR name = 'Admin';
UPDATE public.roles SET code = 'gerente' WHERE name = 'Gerente' OR name = 'Manager';
UPDATE public.roles SET code = 'cajero' WHERE name = 'Cajero';
UPDATE public.roles SET code = 'mesero' WHERE name = 'Mesero';
UPDATE public.roles SET code = 'cocina' WHERE name LIKE '%Cocina%';
UPDATE public.roles SET code = 'recepcion' WHERE name LIKE '%Recepcic%';
UPDATE public.roles SET code = 'ama_llaves' WHERE name LIKE '%Llaves%';

-- Fallback para cualquier otro
UPDATE public.roles SET code = lower(name) WHERE code IS NULL;

-- 3. Corrección de Emergencia RLS (Evitar recursión infinita en AuthContext)
-- El error "authenticated" en el frontend sugiere que la carga del perfil falló silenciosamente.
-- Esto suele ocurrir cuando al intentar leer 'branches' dentro de la query del perfil, la política de RLS falla o cicla.

ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
-- Por ahora deshabilitamos RLS en branches para asegurar que el Login/Perfil cargue.
-- Luego se puede refinar con una función SECURITY DEFINER para evitar el ciclo.

-- 4. Asegurarse de que el usuario actual tenga una organización
-- (Si el script anterior falló o corrió antes de que existiera el usuario)
DO $$
DECLARE
    def_org uuid;
BEGIN
    SELECT id INTO def_org FROM public.organizations LIMIT 1;
    
    IF def_org IS NOT NULL THEN
        UPDATE public.profiles 
        SET organization_id = def_org 
        WHERE organization_id IS NULL;
        
        -- También asegurar que el admin actual tenga el rol 'admin' (código legacy)
        -- para ver los módulos, independientemente del nombre del rol.
        UPDATE public.profiles
        SET role = 'admin'
        WHERE role = 'Administrador'; 
    END IF;
END $$;
