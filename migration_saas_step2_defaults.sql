-- =========================================================================
-- PASO 2: AUTOMATIZAR INSERCIÓN DEL HOTEL EN LA BASE DE DATOS
-- =========================================================================
-- En vez de modificar 50 archivos en React para enviar "organization_id",
-- le indicamos a Postgres que lo auto-complete leyendo el perfil del 
-- usuario que está logueado haciendo la acción. Increíblemente eficiente.

DO $$
BEGIN
    
    -- Establecer el DEFAULT en las tablas principales
    -- Nota: Usamos auth_user_org_id() que creamos en el Paso 1
    
    ALTER TABLE public.branches ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.categories ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.products ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.rooms ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.bookings ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.orders ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.order_items ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.shifts ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.accounting_entries ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.third_parties ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    ALTER TABLE public.room_charges ALTER COLUMN organization_id SET DEFAULT auth_user_org_id();
    
    -- Los profiles y otras tablas críticas ya tienen el default o se inyectan desde UserManagement (App) o n8n.
    
END $$;
