-- =================================================================================
-- FIX COMPLETO: Super Admin SaaS Panel — RLS + Funciones RPC
-- =================================================================================
-- Ejecutar TODO este script en el SQL Editor de Supabase.
-- Corrige: UPDATE status, UPDATE módulos, editar tenant, eliminar tenant.
-- =================================================================================

-- ─── PASO 1: Políticas RLS en organizations para superadmin ───────────────────

-- Superadmin puede UPDATE cualquier organización
DROP POLICY IF EXISTS "Superadmin update orgs" ON public.organizations;
CREATE POLICY "Superadmin update orgs" ON public.organizations
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true)
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- Superadmin puede DELETE cualquier organización
DROP POLICY IF EXISTS "Superadmin delete orgs" ON public.organizations;
CREATE POLICY "Superadmin delete orgs" ON public.organizations
FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- Superadmin puede INSERT nuevas organizaciones
DROP POLICY IF EXISTS "Superadmin insert orgs" ON public.organizations;
CREATE POLICY "Superadmin insert orgs" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true)
);

-- ─── PASO 2: Permitir escritura en global_logs ────────────────────────────────

-- Si la tabla global_logs existe, permitir insertar desde superadmin
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'global_logs') THEN
        EXECUTE '
            DROP POLICY IF EXISTS "Superadmin insert logs" ON public.global_logs;
            CREATE POLICY "Superadmin insert logs" ON public.global_logs
            FOR INSERT TO authenticated
            WITH CHECK (true);
        ';
    END IF;
END $$;

-- ─── PASO 3: Función delete_saas_tenant (cascade completo) ───────────────────

CREATE OR REPLACE FUNCTION public.delete_saas_tenant(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id uuid;
BEGIN
    -- Obtener owner antes de borrar
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

-- ─── PASO 4: Limpiar tenants de prueba ───────────────────────────────────────
-- Ejecutar después de crear la función (solo si quieres borrar los de prueba):

-- SELECT delete_saas_tenant(id) FROM public.organizations
-- WHERE name IN ('Mi Empresa (Default)', 'Mi Empresa Principal');

-- ─── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Verificar políticas creadas:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'organizations';
-- Verificar función creada:
-- SELECT proname FROM pg_proc WHERE proname = 'delete_saas_tenant';
