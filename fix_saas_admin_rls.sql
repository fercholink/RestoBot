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
    v_owner_id uuid;
    v_branch_ids uuid[];
    v_room_ids   uuid[];
    v_order_ids  uuid[];
    v_booking_ids uuid[];
    v_shift_ids  uuid[];
BEGIN
    -- Obtener owner antes de borrar
    SELECT owner_id INTO v_owner_id FROM public.organizations WHERE id = p_org_id;

    -- Pre-calcular IDs para usar en subqueries sin columnas desconocidas
    SELECT array_agg(id) INTO v_branch_ids  FROM public.branches  WHERE organization_id = p_org_id;
    SELECT array_agg(id) INTO v_room_ids    FROM public.rooms     WHERE branch_id = ANY(v_branch_ids);
    SELECT array_agg(id) INTO v_order_ids   FROM public.orders    WHERE branch_id = ANY(v_branch_ids);
    SELECT array_agg(id) INTO v_booking_ids FROM public.bookings  WHERE room_id   = ANY(v_room_ids);
    SELECT array_agg(id) INTO v_shift_ids   FROM public.shifts    WHERE branch_id = ANY(v_branch_ids);

    -- NIVEL 1: order_items
    IF v_order_ids IS NOT NULL THEN
        DELETE FROM public.order_items WHERE order_id = ANY(v_order_ids);
    END IF;

    -- NIVEL 1: room_charges (intentar por booking_id, luego ignorar si columna no existe)
    BEGIN
        IF v_booking_ids IS NOT NULL THEN
            DELETE FROM public.room_charges WHERE booking_id = ANY(v_booking_ids);
        END IF;
    EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
    END;

    -- NIVEL 1: accounting_entries — intentar por branch_id directo, luego por order_id
    BEGIN
        IF v_branch_ids IS NOT NULL THEN
            DELETE FROM public.accounting_entries WHERE branch_id = ANY(v_branch_ids);
        END IF;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
        BEGIN
            IF v_order_ids IS NOT NULL THEN
                DELETE FROM public.accounting_entries WHERE order_id = ANY(v_order_ids);
            END IF;
        EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
        END;
    END;

    -- NIVEL 2: orders
    IF v_order_ids IS NOT NULL THEN
        DELETE FROM public.orders WHERE id = ANY(v_order_ids);
    END IF;

    -- NIVEL 2: bookings
    IF v_booking_ids IS NOT NULL THEN
        DELETE FROM public.bookings WHERE id = ANY(v_booking_ids);
    END IF;

    -- NIVEL 2: shifts
    IF v_shift_ids IS NOT NULL THEN
        DELETE FROM public.shifts WHERE id = ANY(v_shift_ids);
    END IF;

    -- NIVEL 3: rooms
    IF v_room_ids IS NOT NULL THEN
        DELETE FROM public.rooms WHERE id = ANY(v_room_ids);
    END IF;

    -- NIVEL 4: third_parties
    BEGIN
        DELETE FROM public.third_parties WHERE organization_id = p_org_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
    END;

    -- NIVEL 5: branches
    IF v_branch_ids IS NOT NULL THEN
        DELETE FROM public.branches WHERE id = ANY(v_branch_ids);
    END IF;

    -- NIVEL 6: profiles
    DELETE FROM public.profiles WHERE organization_id = p_org_id;

    -- NIVEL 7: organización
    DELETE FROM public.organizations WHERE id = p_org_id;

    -- NIVEL 8: usuario de auth
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
