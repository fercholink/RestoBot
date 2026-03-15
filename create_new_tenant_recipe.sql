-- =========================================================================
-- GUÍA DE CREACIÓN DE UN NUEVO CLIENTE (TENANT) EN NEXUS SaaS
-- =========================================================================
-- Para crear un nuevo restaurante u hotel desde cero, debes correr estas
-- tres sentencias en orden.

DO $$
DECLARE
    new_org_id UUID;
    new_user_id UUID;
    
    -- CONFIGURACIÓN DEL NUEVO CLIENTE (¡Cambia estos valores!)
    -----------------------------------------------------------
    v_nombre_empresa TEXT := 'Restaurante El Buen Sabor';
    v_email_admin TEXT := 'admin@elbuensabor.com';
    v_password_admin TEXT := 'PasswordSeguro123';
    -- Módulos que compró el cliente:
    v_modulos_comprados TEXT[] := ARRAY['restaurante', 'financiero', 'usuarios', 'sedes']; 
BEGIN

    RAISE NOTICE 'INICIANDO CREACIÓN DE CLIENTE: %', v_nombre_empresa;

    -- 1. CREAR EL USUARIO EN AUTH.USERS (Sistema de Autenticación Central de Supabase)
    -- Generamos un UUID seguro para el nuevo usuario dueño.
    new_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email_admin, 
        crypt(v_password_admin, gen_salt('bf')), -- Encripta la contraseña de Supabase
        now(), 
        '{"provider":"email","providers":["email"]}', 
        jsonb_build_object('name', 'Admin ' || v_nombre_empresa, 'role', 'gerente'), 
        now(), now(), '', '', '', ''
    );

    RAISE NOTICE '1. Autenticación generada: %', v_email_admin;

    -- 2. CREAR LA ORGANIZACIÓN (TENANT) EN LA BASE DE DATOS
    -- Vinculamos esta Organización con el usuario creador.
    INSERT INTO public.organizations (name, owner_id, contact_email, plan, active_modules)
    VALUES (
        v_nombre_empresa, 
        new_user_id,        -- El administrador inicial es el dueño
        v_email_admin, 
        'enterprise',       -- Tipo de plan
        v_modulos_comprados -- Bloquea o Habilita visualizaciones (ej: Hotel)
    ) RETURNING id INTO new_org_id;
    
    RAISE NOTICE '2. Organización creada con ID: %', new_org_id;

    -- 3. ACTUALIZAR EL PERFIL PÚBLICO DEL DUEÑO
    -- Supabase ya creó un perfil por su trigger en auth.users, así que lo actualizamos
    -- dándole Rango Gerente y asignándolo a su recién creada Organización.
    UPDATE public.profiles 
    SET 
        organization_id = new_org_id,
        role = 'gerente',
        full_name = 'Gerente General',
        active = true
    WHERE id = new_user_id;

    -- SI EL TRIGGER DE PERFIL NO SE DISPARÓ (Por fallas), LO CREAMOS:
    IF NOT FOUND THEN
         INSERT INTO public.profiles (id, organization_id, role, email, full_name, active)
         VALUES (new_user_id, new_org_id, 'gerente', v_email_admin, 'Gerente General', true);
    END IF;
    
    RAISE NOTICE '3. Perfil del dueño vinculado a la Organización.';

    -- 4. CREAR UNA SEDE INICIAL POR DEFECTO PARA EL CLIENTE
    -- Con RLS, si la sede no tiene organization_id el gerente no la verá.
    INSERT INTO public.branches (name, address, phone, organization_id)
    VALUES ('Sede Principal - ' || v_nombre_empresa, 'Dirección Principal', '000-0000', new_org_id);
    
    RAISE NOTICE '4. Sede central creada.';

    RAISE NOTICE '=======================================================';
    RAISE NOTICE '✅ Nuevo Cliente creado exitosamente. Puede iniciar sesión con:';
    RAISE NOTICE 'Usuario: %', v_email_admin;
    RAISE NOTICE 'Módulos: %', v_modulos_comprados;
    RAISE NOTICE '=======================================================';

END $$;
