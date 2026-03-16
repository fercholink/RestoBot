-- =================================================================================
-- FIX DEFINITIVO: "Database error querying schema" en login de tenants
-- Causa raíz: handle_new_user trigger inserta en profiles sin organization_id
--             mientras la columna tiene NOT NULL → usuario "roto" → login falla
-- =================================================================================
-- Ejecutar TODO en el SQL Editor de Supabase, en un solo bloque.
-- =================================================================================

-- ─── BLOQUE 1: APAGAR RLS Y BORRAR TODAS LAS POLÍTICAS ───────────────────────
-- Evita conflictos de políticas duplicadas o recursivas

ALTER TABLE public.profiles       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- ─── BLOQUE 2: ELIMINAR FUNCIONES CONFLICTIVAS ───────────────────────────────
-- Estas funciones causaban recursión al ser usadas dentro del RLS

DROP FUNCTION IF EXISTS public.is_superadmin()      CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()            CASCADE;
DROP FUNCTION IF EXISTS public.get_my_org_id()       CASCADE;
DROP FUNCTION IF EXISTS public.get_my_tenant_id()    CASCADE;
DROP FUNCTION IF EXISTS public.my_org_id()           CASCADE;
DROP FUNCTION IF EXISTS public.check_is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS auth.get_my_org()            CASCADE;
DROP FUNCTION IF EXISTS auth.is_nexus_admin()        CASCADE;

-- ─── BLOQUE 3: REPARAR LA COLUMNA (Quitar NOT NULL del trigger) ──────────────
-- El trigger de Supabase crea el perfil sin organization_id, necesitamos que esté permitido

ALTER TABLE public.profiles ALTER COLUMN organization_id DROP NOT NULL;

-- ─── BLOQUE 4: REPARAR EL TRIGGER handle_new_user ────────────────────────────
-- Versión segura que no rompe si organization_id es NULL

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'cajero'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Asegurar que el trigger esté activo y bien conectado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── BLOQUE 5: REPARAR PERFILES ROTOS (Usuarios sin organization_id) ─────────
-- Vincula los tenants existentes que quedaron sin organización asignada

UPDATE public.profiles p
SET organization_id = o.id
FROM public.organizations o
WHERE p.organization_id IS NULL
  AND p.email = o.contact_email;

-- ─── BLOQUE 6: FUNCIÓN MAESTRA DE SEGURIDAD (Sin recursión) ──────────────────
-- Lee SOLO del JWT, nunca consulta tablas → imposible que cause bucles

CREATE OR REPLACE FUNCTION public.jwt_org_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF((auth.jwt()->'app_metadata'->>'organization_id'), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE((auth.jwt()->'app_metadata'->>'is_superadmin')::BOOLEAN, false);
$$;

-- ─── BLOQUE 7: PROMOVER DATOS DE SEGURIDAD AL JWT ────────────────────────────
-- Pone el organization_id y is_superadmin en el token de cada usuario
-- Esto hace que las funciones jwt_* funcionen correctamente

UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
        'organization_id', p.organization_id::text,
        'is_superadmin', COALESCE(p.is_superadmin, false)
    )
FROM public.profiles p
WHERE u.id = p.id
  AND p.organization_id IS NOT NULL;

-- ─── BLOQUE 8: POLÍTICAS RLS SIMPLES Y SIN RECURSIÓN ─────────────────────────

-- PROFILES: Todos los logueados pueden leer perfiles de su empresa
-- (El SuperAdmin ve todo gracias al jwt_is_superadmin)
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (
  public.jwt_is_superadmin()
  OR organization_id = public.jwt_org_id()
  OR id = auth.uid()
);

CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  public.jwt_is_superadmin()
  OR organization_id = public.jwt_org_id()
);

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE TO authenticated
USING (
  public.jwt_is_superadmin()
  OR id = auth.uid()
  OR organization_id = public.jwt_org_id()
);

CREATE POLICY "profiles_delete" ON public.profiles
FOR DELETE TO authenticated
USING (
  public.jwt_is_superadmin()
  OR organization_id = public.jwt_org_id()
);

-- ORGANIZATIONS: Los tenants solo ven la suya, el SuperAdmin ve todas
CREATE POLICY "orgs_select" ON public.organizations
FOR SELECT TO authenticated
USING (
  public.jwt_is_superadmin()
  OR id = public.jwt_org_id()
);

CREATE POLICY "orgs_all_admin" ON public.organizations
FOR ALL TO authenticated
USING (public.jwt_is_superadmin());

-- TABLAS OPERATIVAS: Aislamiento por empresa
DO $$ 
DECLARE 
    t text;
    tbls text[] := ARRAY['products','categories','orders','order_items',
                         'branches','rooms','bookings','shifts','accounting_entries'];
BEGIN
    FOREACH t IN ARRAY tbls LOOP
        EXECUTE format('
            CREATE POLICY "tenant_isolation_%s" ON public.%I
            FOR ALL TO authenticated
            USING (
                public.jwt_is_superadmin()
                OR organization_id = public.jwt_org_id()
            )
            WITH CHECK (
                public.jwt_is_superadmin()
                OR organization_id = public.jwt_org_id()
            )', t, t);
    END LOOP;
END $$;

-- ─── BLOQUE 9: REACTIVAR RLS ─────────────────────────────────────────────────

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

-- ─── BLOQUE 10: REINSTALAR create_saas_tenant (DEFINITIVO) ───────────────────
-- Orden correcto: ORG primero → USER → UPDATE perfil → BRANCH
-- Actualiza el JWT de app_metadata al crear el usuario

DROP FUNCTION IF EXISTS public.create_saas_tenant(text, text, text, text[]);

CREATE FUNCTION public.create_saas_tenant(
    p_empresa_nombre text,
    p_admin_email    text,
    p_admin_password text,
    p_modulos        text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_org_id  uuid;
    new_user_id uuid;
BEGIN
    -- 1. Crear la Organización primero (así ya existe cuando el trigger del usuario se dispare)
    INSERT INTO public.organizations (name, contact_email, plan, active_modules, status)
    VALUES (p_empresa_nombre, p_admin_email, 'enterprise', p_modulos, 'active')
    RETURNING id INTO new_org_id;

    -- 2. Crear el usuario (el trigger handle_new_user creará un perfil básico sin org)
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        p_admin_email,
        extensions.crypt(p_admin_password, extensions.gen_salt('bf')),
        now(),
        -- JWT app_metadata incluye el organization_id para que jwt_org_id() funcione
        jsonb_build_object(
            'provider',         'email',
            'providers',        ARRAY['email'],
            'organization_id',  new_org_id::text,
            'is_superadmin',    false
        ),
        jsonb_build_object('name', 'Admin '||p_empresa_nombre, 'role', 'gerente'),
        now(), now()
    );

    -- 3. Vincular el perfil con la organización y asignar rol gerente + permisos totales
    UPDATE public.profiles
    SET
        organization_id = new_org_id,
        role            = 'gerente',
        full_name       = 'Gerente General',
        active          = true,
        permissions     = '{"dashboard":true,"ventas":true,"usuarios":true,"configuracion":true,
                           "inventario":true,"reportes":true,"hoteleria":true,"facturacion":true}'::jsonb
    WHERE id = new_user_id;

    -- 4. Crear Sede Principal
    INSERT INTO public.branches (name, address, phone, organization_id)
    VALUES ('Sede Principal - '||p_empresa_nombre, 'Dirección Principal', '000-0000', new_org_id);

    RETURN new_org_id;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'El correo % ya está en uso.', p_admin_email;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error al crear tenant: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_saas_tenant TO authenticated;

-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
-- Verificar que el trigger existe:
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'users';
-- Verificar perfiles reparados:
-- SELECT email, organization_id FROM public.profiles WHERE organization_id IS NULL;
-- Verificar políticas activas:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
