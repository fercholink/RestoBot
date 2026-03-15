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
-- Orden correcto: hijos primero, luego padres (respetando FKs)
-- orders_branch_id_fkey y otras constraints requieren borrar en secuencia.

CREATE OR REPLACE FUNCTION public.delete_saas_tenant(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id   uuid;
    v_branch_ids bigint[];  -- solo necesario para floors y branch_resolutions (sin organization_id)
BEGIN
    SELECT owner_id INTO v_owner_id FROM public.organizations WHERE id = p_org_id;
    SELECT array_agg(id) INTO v_branch_ids FROM public.branches WHERE organization_id = p_org_id;

    -- Nivel 1: tablas hoja con organization_id propio
    DELETE FROM public.order_items        WHERE organization_id = p_org_id;
    DELETE FROM public.room_charges       WHERE organization_id = p_org_id;
    DELETE FROM public.accounting_entries WHERE organization_id = p_org_id;

    -- Nivel 2: tablas intermedias con organization_id propio
    DELETE FROM public.orders    WHERE organization_id = p_org_id;
    DELETE FROM public.bookings  WHERE organization_id = p_org_id;
    DELETE FROM public.shifts    WHERE organization_id = p_org_id;
    DELETE FROM public.rooms     WHERE organization_id = p_org_id;

    -- Nivel 3: tablas sin organization_id (referencian branch_id) — ignorar si no existen
    BEGIN
        IF v_branch_ids IS NOT NULL THEN
            DELETE FROM public.floors             WHERE branch_id = ANY(v_branch_ids);
            DELETE FROM public.branch_resolutions WHERE branch_id = ANY(v_branch_ids);
        END IF;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    -- Nivel 4: third_parties si tiene organization_id
    BEGIN
        DELETE FROM public.third_parties WHERE organization_id = p_org_id;
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    -- Nivel 5: branches (después de haber eliminado todos sus hijos)
    DELETE FROM public.branches WHERE organization_id = p_org_id;

    -- Nivel 6: profiles
    DELETE FROM public.profiles WHERE organization_id = p_org_id;

    -- Nivel 7: organización
    DELETE FROM public.organizations WHERE id = p_org_id;

    -- Nivel 8: usuario auth
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
