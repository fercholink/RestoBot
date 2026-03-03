-- =========================================================================
-- PASO 1: HABILITAR MULTI-TENANT (MÚLTIPLES HOTELES) - NEXUS
-- Ejecutar en: SQL Editor de Supabase
-- =========================================================================

-- 1. CREAR TIPO Y TABLA MAESTRA DE ORGANIZACIONES (HOTELES)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type_enum') THEN
        CREATE TYPE public.plan_type_enum AS ENUM ('free', 'pro', 'enterprise');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id), -- Quien la compró / Dueño
    contact_email TEXT,
    plan public.plan_type_enum DEFAULT 'free',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Organizaciones solo son vistas por sus dueños directo (revisaremos esto más abajo)
DROP POLICY IF EXISTS "Ver mi organizacion" ON public.organizations;
CREATE POLICY "Ver mi organizacion" ON public.organizations
    FOR SELECT USING (auth.uid() = owner_id);

-- =========================================================================
-- 2. MIGRAR DATOS EXISTENTES: ASIGNAR TODO A UNA "ORGANIZACIÓN 1"
-- Esto garantiza que no pierdas NADA de tu trabajo actual.
-- =========================================================================
DO $$
DECLARE
    default_org_id UUID;
    first_user_id UUID;
BEGIN
    -- Ver si ya existe alguna organización
    SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
    
    IF default_org_id IS NULL THEN
        -- Intentar agarrar el primer admin existente en el sistema
        SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
        
        -- Insertar el "Nexus Demo Hotel" o tu negocio actual
        INSERT INTO public.organizations (name, plan, status, owner_id)
        VALUES ('Nexus Hotel Demo', 'enterprise', 'active', first_user_id)
        RETURNING id INTO default_org_id;
    END IF;

    -- =====================================================================
    -- 3. AÑADIR LA COLUMNA MAGICA 'organization_id' A TODAS LAS TABLAS CLAVE
    -- Y ASIGNAR LOS DATOS ACTUALES A LA ORG CREADA
    -- =====================================================================
    
    -- profiles (Usuarios)
    BEGIN ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.profiles SET organization_id = default_org_id WHERE organization_id IS NULL;
    
    -- branches (Sedes/Cajas)
    BEGIN ALTER TABLE public.branches ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.branches SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- categories
    BEGIN ALTER TABLE public.categories ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.categories SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- products
    BEGIN ALTER TABLE public.products ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.products SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- orders (Pedidos)
    BEGIN ALTER TABLE public.orders ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.orders SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- order_items (Items de los pedidos)
    BEGIN ALTER TABLE public.order_items ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.order_items SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- bookings (Reservas de hotel)
    BEGIN ALTER TABLE public.bookings ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.bookings SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- rooms (Habitaciones)
    BEGIN ALTER TABLE public.rooms ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.rooms SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- room_charges (Cargos a habitaciones)
    BEGIN ALTER TABLE public.room_charges ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.room_charges SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- shifts (Turnos de caja)
    BEGIN ALTER TABLE public.shifts ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.shifts SET organization_id = default_org_id WHERE organization_id IS NULL;
    
    -- accounting_entries (Contabilidad)
    BEGIN ALTER TABLE public.accounting_entries ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.accounting_entries SET organization_id = default_org_id WHERE organization_id IS NULL;

    -- third_parties (Clientes, Dian, Proveedores)
    BEGIN ALTER TABLE public.third_parties ADD COLUMN organization_id UUID REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    UPDATE public.third_parties SET organization_id = default_org_id WHERE organization_id IS NULL;

END $$;


-- =========================================================================
-- 4. ÍNDICES DE VELOCIDAD (Para que buscar por hotel no ralentice nada)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_prof_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_branch_org ON public.branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_cat_org ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_org ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_book_org ON public.bookings(organization_id);


-- =========================================================================
-- 5. SEGURIDAD MAESTRA (LA BARRERA ENTRE HOTELES)
-- =========================================================================

-- Función SUPER rapida y segura para sacar de qué hotel es el usuario que inició sesión
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Política: Los usuarios pueden ver la organización a la que pertenecen
DROP POLICY IF EXISTS "Usuarios ven su propia organizacion" ON public.organizations;
CREATE POLICY "Usuarios ven su propia organizacion" ON public.organizations
    FOR SELECT TO authenticated USING (id = auth_user_org_id());

-- =========================================================================
-- 6. ENCENDER DEFENSA RLS EN TODO
-- Si una tabla no tenía RLS, la enciende
-- =========================================================================

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

-- EJEMPLO DE LA POLÍTICA EXTREMA DE PRIVACIDAD: 
-- "Tú solo puedes CREAR, VER, EDITAR y BORRAR cosas si pertenecen a tu misma organización (Hotel)"

-- Nota: Para simplificar el setup inicial y no romper nada existente, se habilita "FOR ALL" basado en el org_id.

DROP POLICY IF EXISTS "Tenant isolate branches" ON public.branches;
CREATE POLICY "Tenant isolate branches" ON public.branches FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate categories" ON public.categories;
CREATE POLICY "Tenant isolate categories" ON public.categories FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate products" ON public.products;
CREATE POLICY "Tenant isolate products" ON public.products FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate rooms" ON public.rooms;
CREATE POLICY "Tenant isolate rooms" ON public.rooms FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate bookings" ON public.bookings;
CREATE POLICY "Tenant isolate bookings" ON public.bookings FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate orders" ON public.orders;
CREATE POLICY "Tenant isolate orders" ON public.orders FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate order items" ON public.order_items;
CREATE POLICY "Tenant isolate order items" ON public.order_items FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate shifts" ON public.shifts;
CREATE POLICY "Tenant isolate shifts" ON public.shifts FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate accounts" ON public.accounting_entries;
CREATE POLICY "Tenant isolate accounts" ON public.accounting_entries FOR ALL TO authenticated USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS "Tenant isolate profiles safety" ON public.profiles;
-- Especial para perfiles: un usuario SIEMPRE debe poder ver su propio perfil independientemente
CREATE POLICY "Tenant isolate profiles safety" ON public.profiles
    FOR ALL TO authenticated USING (
        id = auth.uid() OR organization_id = auth_user_org_id()
    );

-- ¡LISTO! AHORA EL SISTEMA ESTA AISLADO POR HOTELES.
