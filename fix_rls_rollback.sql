-- =================================================================================
-- ROLLBACK PARCIAL RLS — Restaurar sistema al estado operativo
-- =================================================================================
-- El RLS de profiles genera recursión infinita porque la política llama a
-- auth_user_org_id() que a su vez consulta profiles → bucle.
-- Este script deja el sistema funcional mientras se prepara correctamente el
-- esquema multi-tenant (agregar organization_id a todas las tablas).
-- =================================================================================

-- 1. Eliminar la política recursiva de profiles
DROP POLICY IF EXISTS "Tenant Isolate profiles" ON public.profiles;

-- 2. Crear política simple no-recursiva para profiles
--    (cada usuario solo ve su propio perfil — lo que ya hace el código)
CREATE POLICY "Own profile only" ON public.profiles
FOR ALL TO authenticated
USING (id = auth.uid());

-- 3. Deshabilitar RLS en tablas operativas que NO tienen organization_id todavía
--    Estas tablas quedan bloqueadas por el policy "USING (organization_id = ...)"
--    porque sus filas tienen organization_id = NULL
ALTER TABLE public.shifts           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_charges     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_parties    DISABLE ROW LEVEL SECURITY;

-- 4. Para branches, rooms, bookings: deshabilitar también hasta asignar org
ALTER TABLE public.branches         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings         DISABLE ROW LEVEL SECURITY;

-- 5. Deshabilitar en tablas de catálogo
ALTER TABLE public.categories       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         DISABLE ROW LEVEL SECURITY;

-- Verificar que no quede ningún bloqueo activo
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
