-- =================================================================================
-- MIGRATION: SAAS STEP 5 - SUPERADMIN & GLOBAL LOGS
-- =================================================================================
-- Proposito: Añadir el rol de 'superadmin' para gestionar la plataforma SaaS
-- y crear una tabla para auditoría global.
-- =================================================================================

-- 1. Añadir bandera is_superadmin a profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.is_superadmin IS 'Indica si el usuario tiene acceso total al panel administrativo del SaaS.';

-- Opcional: Proteger la columna para que los usuarios no puedan darse a sí mismos privilegios de superadmin a menos que ya lo sean.
-- Dado que supabase RLS maneja acceso a filas y no siempre a columnas, la sugerencia es que este valor
-- solo se altere por un admin real directamente en base de datos o por un trigger seguro.


-- 2. Crear tabla global_logs para auditoria de la plataforma
CREATE TABLE IF NOT EXISTS public.global_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- Puede ser null si es un log global del sistema
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Usuario que realizo la accion
    action_type TEXT NOT NULL, -- ej: 'MODULE_TOGGLED', 'SUBSCRIPTION_RENEWED', 'TENANT_CREATED'
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb -- Datos adicionales como el modulo afectado, montos, etc.
);

COMMENT ON TABLE public.global_logs IS 'Registro de auditoría global para operaciones a nivel plataforma SaaS';

-- Habilitar RLS en global_logs
ALTER TABLE public.global_logs ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas de lectura/escritura para global_logs
-- Solo super admins pueden leer todos los logs
-- (Opcionalmente: dueños/gerentes pueden ver logs de su org)

CREATE POLICY "SuperAdmins can view all logs" 
ON public.global_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_superadmin = true
    )
);

CREATE POLICY "Gerentes can view their org logs" 
ON public.global_logs
FOR SELECT
USING (
    organization_id = auth_user_org_id() 
    AND 
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'gerente')
    )
);

-- Todos los autenticados (y webhooks) pueden insertar logs, o preferiblemente aislar la escritura a funciones seguras.
-- Por ahora la política más abierta para inserción:
CREATE POLICY "System can insert logs" 
ON public.global_logs
FOR INSERT
WITH CHECK (true); -- Permitimos insertar libremente para auditoria (incluso operaciones desde service_role/funciones no usan esta politica)


-- =================================================================================
-- INSTRUCCIONES:
-- 1. Ejecuta este script manualmente en el SQL Editor de Supabase.
-- 2. Ve a la tabla "profiles" y pon a tu usuario propio con is_superadmin = true.
-- =================================================================================
