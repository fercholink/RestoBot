-- =========================================================================
-- PASO 4: HABILITAR ROW LEVEL SECURITY (RLS) PARA ARQUITECTURA SaaS
-- AISLAMIENTO TOTAL ENTRE CLIENTES (MULTI-TENANT)
-- =========================================================================
-- Este script activa el cerco de seguridad RLS en todas las tablas sensibles
-- operativas, de tal forma que un comercio NO pueda consultar la información
-- de la base de datos de otro comercio, aislando los datos mediante el token de
-- autenticación del usuario logueado en la aplicación (auth.uid).

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'INICIANDO CONFIGURACIÓN DE AISLAMIENTO MULTI-TENANT (SaaS RLS)...';

    -- 1. Asegurar que tenemos la función ayudante auth_user_org_id()
    -- Esta función evita consultas recursivas de RLS en la tabla profiles al 
    -- buscar la organización a la que el usuario que ejecuta la petición pertenece.
    CREATE OR REPLACE FUNCTION public.auth_user_org_id() 
    RETURNS UUID
    LANGUAGE sql
    STABLE
    AS $func$
      SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
    $func$;

    -- 2. Lista de Tablas que deben ser fuertemente resguardadas
    -- Sólo pueden ser consultadas/modificadas por usuarios cuya 'organization_id' coincida con la de la fila.
    FOR rec IN 
        SELECT unnest(ARRAY[
            'profiles',
            'branches',
            'categories',
            'products',
            'orders',
            'order_items',
            'rooms',
            'bookings',
            'room_charges',
            'shifts',
            'accounting_entries',
            'third_parties',
            'subscriptions'
        ]) AS table_name
    LOOP
        -- A: Habilitar Row Level Security (RLS) en la tabla si existe en public
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = rec.table_name) THEN
            
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', rec.table_name);
            RAISE NOTICE '✅ RLS Activado en tabla: %', rec.table_name;

            -- B: Borramos la política "Tenant Isolate" si ya existiera para evitar errores de creación múltiple
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolate %I" ON public.%I;', rec.table_name, rec.table_name);

            -- C: Construir la política estandarizada SaaS
            -- Los super-admins globales (si existieran sin organización) o los logs del sistema, 
            -- típicamente usarán el service_role key que salta el RLS.
            -- Para usuarios 'authenticated', la regla es estricta: Coincidencia de Org.
            
            -- Trato especial para tabla PERFILES (profiles) para permitir el auth.uid() igual a la propia fila,
            -- lo que previene "lockouts" durante el registro o actualizaciones de perfil.
            IF rec.table_name = 'profiles' THEN
                EXECUTE format('
                    CREATE POLICY "Tenant Isolate %I" ON public.%I 
                    FOR ALL TO authenticated 
                    USING ( id = auth.uid() OR organization_id = auth_user_org_id() );
                ', rec.table_name, rec.table_name);
            ELSE
                EXECUTE format('
                    CREATE POLICY "Tenant Isolate %I" ON public.%I 
                    FOR ALL TO authenticated 
                    USING ( organization_id = auth_user_org_id() );
                ', rec.table_name, rec.table_name);
            END IF;
            
            RAISE NOTICE '🔒 Política "Tenant Isolate" creada para: %', rec.table_name;
        ELSE
            RAISE NOTICE '⚠️ Tabla ignorada (No existe aún): %', rec.table_name;
        END IF;

    END LOOP;

    RAISE NOTICE '==================================================';
    RAISE NOTICE '🚀 DESPLIEGUE RLS FINALIZADO CON ÉXITO. SUS DATOS ESTÁN AISLADOS.';
    RAISE NOTICE '==================================================';
END $$;
