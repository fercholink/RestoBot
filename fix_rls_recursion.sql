-- =================================================================================
-- FIX URGENTE: Infinite recursion en RLS de tabla "profiles"
-- =================================================================================
-- Problema: auth_user_org_id() consulta `profiles`, pero `profiles` tiene una
--           política RLS que llama a auth_user_org_id() → bucle infinito.
--
-- Solución: Agregar SECURITY DEFINER a la función para que corra con privilegios
--           de postgres y NO active las políticas RLS al hacer la consulta interna.
-- =================================================================================

-- PASO 1: Recrear la función helper con SECURITY DEFINER (rompe la recursión)
CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- PASO 2: Verificar que funciona (debe devolver un UUID o NULL sin error)
-- SELECT public.auth_user_org_id();


-- =================================================================================
-- NOTAS ADICIONALES:
-- =================================================================================
-- Si después de este fix sigues sin ver datos en orders, shifts, bookings, etc.,
-- es porque esas tablas pueden no tener la columna organization_id.
-- En ese caso, deshabilitar temporalmente el RLS en las tablas afectadas:
--
-- ALTER TABLE public.shifts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
--
-- Y luego agregar la columna + asignar valores:
-- ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS organization_id UUID;
-- ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS organization_id UUID;
-- =================================================================================
