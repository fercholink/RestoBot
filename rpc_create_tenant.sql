-- Función RPC para que el Super Admin pueda crear nuevos Tenants (SaaS) directamente desde el frontend.
-- Debe ejecutarse en el SQL Editor de Supabase (con rol de superusuario Postgres).

CREATE OR REPLACE FUNCTION public.create_saas_tenant(
    p_empresa_nombre text,
    p_admin_email text,
    p_admin_password text,
    p_modulos text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del creador (postgres), permitiendo insertar en auth.users
AS $$
DECLARE
    new_org_id uuid;
    new_user_id uuid;
BEGIN
    -- 1. Generar nuevo ID para el usuario dueño
    new_user_id := gen_random_uuid();
    
    -- Insertar en auth.users central de Supabase (requiere que p_admin_password esté encriptado aquí)
    -- Asumiendo pgcrypto activado, que Supabase trae por defecto en auth schema
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_admin_email, 
        crypt(p_admin_password, gen_salt('bf')), 
        now(), 
        '{"provider":"email","providers":["email"]}', 
        jsonb_build_object('name', 'Admin ' || p_empresa_nombre, 'role', 'gerente'), 
        now(), now(), '', '', '', ''
    );

    -- 2. Crear la Organización
    INSERT INTO public.organizations (name, owner_id, contact_email, plan, active_modules)
    VALUES (
        p_empresa_nombre, 
        new_user_id, 
        p_admin_email, 
        'enterprise', 
        p_modulos
    ) RETURNING id INTO new_org_id;

    -- 3. Actualizar / Crear el Perfil del Dueño
    UPDATE public.profiles 
    SET 
        organization_id = new_org_id,
        role = 'gerente',
        full_name = 'Gerente General',
        active = true
    WHERE id = new_user_id;

    IF NOT FOUND THEN
         INSERT INTO public.profiles (id, organization_id, role, email, full_name, active)
         VALUES (new_user_id, new_org_id, 'gerente', p_admin_email, 'Gerente General', true);
    END IF;

    -- 4. Crear Sede Principal
    INSERT INTO public.branches (name, address, phone, organization_id)
    VALUES ('Sede Principal - ' || p_empresa_nombre, 'Dirección Principal', '000-0000', new_org_id);

    RETURN new_org_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'El correo electrónico % ya está en uso.', p_admin_email;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error al crear tenant: %', SQLERRM;
END;
$$;
