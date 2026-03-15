-- =================================================================================
-- RPC para eliminar un Tenant completo (cascade) desde el Super Admin Panel
-- Debe ejecutarse en el SQL Editor de Supabase.
-- =================================================================================
-- Elimina en orden: branches → profiles → organization → auth.users (owner)
-- SECURITY DEFINER bypasa el RLS que bloquea el DELETE desde el cliente.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.delete_saas_tenant(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id uuid;
BEGIN
    -- Obtener el owner antes de borrar
    SELECT owner_id INTO v_owner_id FROM public.organizations WHERE id = p_org_id;

    -- 1. Eliminar sedes de la organización
    DELETE FROM public.branches WHERE organization_id = p_org_id;

    -- 2. Eliminar perfiles de la organización
    DELETE FROM public.profiles WHERE organization_id = p_org_id;

    -- 3. Eliminar la organización
    DELETE FROM public.organizations WHERE id = p_org_id;

    -- 4. Eliminar el usuario de auth (limpieza completa)
    IF v_owner_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = v_owner_id;
    END IF;
END;
$$;

-- Limpiar tenants de prueba (ejecutar DESPUÉS de crear la función):
-- DELETE FROM public.organizations WHERE name IN ('Mi Empresa (Default)', 'Mi Empresa Principal');
-- O usando la función: SELECT delete_saas_tenant(id) FROM organizations WHERE name LIKE 'Mi Empresa%';
