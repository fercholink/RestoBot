-- Función RPC para crear nuevos Tenants SaaS desde el Super Admin Panel.
-- Ejecutar en el SQL Editor de Supabase (con rol postgres/superusuario).
--
-- PREREQUISITO (solo una vez):
--   CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- DROP explícito para forzar recreación limpia y limpiar el schema cache de PostgREST
DROP FUNCTION IF EXISTS public.create_saas_tenant(text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.create_saas_tenant(
    p_empresa_nombre text,
    p_admin_email    text,
    p_admin_password text,
    p_modulos        text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- solo public; usar schema explícito para auth y extensions
AS $$
DECLARE
    new_org_id  uuid;
    new_user_id uuid;
BEGIN
    new_user_id := gen_random_uuid();

    -- 1. Crear usuario en auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role,
        email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        p_admin_email,
        extensions.crypt(p_admin_password, extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('name', 'Admin ' || p_empresa_nombre, 'role', 'gerente'),
        now(), now(),
        '', '', '', ''
    );

    -- 1b. Crear identidad en auth.identities (requerido para login en Supabase)
    --     provider_id = email para proveedor email (requerido en GoTrue v2+)
    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(),
        p_admin_email,    -- provider_id obligatorio en versiones recientes de Supabase
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', p_admin_email),
        'email',
        now(), now(), now()
    );

    -- 2. Crear la Organización
    INSERT INTO public.organizations (name, owner_id, contact_email, plan, active_modules, status)
    VALUES (
        p_empresa_nombre, new_user_id, p_admin_email,
        'enterprise', p_modulos, 'active'
    )
    RETURNING id INTO new_org_id;

    -- 3. Crear perfil del dueño (INSERT con ON CONFLICT para evitar duplicados)
    INSERT INTO public.profiles (id, organization_id, role, email, full_name, active)
    VALUES (new_user_id, new_org_id, 'gerente', p_admin_email, 'Gerente General', true)
    ON CONFLICT (id) DO UPDATE SET
        organization_id = new_org_id,
        role            = 'gerente',
        full_name       = 'Gerente General',
        active          = true;

    -- 4. Crear Sede Principal
    INSERT INTO public.branches (name, address, phone, organization_id)
    VALUES ('Sede Principal - ' || p_empresa_nombre, 'Dirección Principal', '000-0000', new_org_id);

    RETURN new_org_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'El correo electrónico % ya está en uso.', p_admin_email;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error al crear tenant: % — %', SQLSTATE, SQLERRM;
END;
$$;

-- Recargar el schema cache de PostgREST (obligatorio después de DROP+CREATE)
NOTIFY pgrst, 'reload schema';
