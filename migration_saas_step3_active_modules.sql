-- =========================================================================
-- PASO 3: FEATURE FLAGGING PARA MÓDULOS (SaaS)
-- =========================================================================
-- Este script agrega la capacidad de habilitar o deshabilitar módulos
-- (ej. Hotel, Restaurante) por cada Organización (Tenant) en la plataforma.

DO $$
BEGIN

    -- 1. Añadir la columna active_modules a la tabla organizations si no existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'active_modules'
    ) THEN
        -- Por defecto y para no romper los clientes actuales, habilitaremos 
        -- todos los módulos base del sistema.
        ALTER TABLE public.organizations 
        ADD COLUMN active_modules TEXT[] DEFAULT ARRAY[
            'restaurante', 
            'hotel', 
            'financiero', 
            'usuarios', 
            'sedes', 
            'marketing', 
            'qr_tools', 
            'operaciones'
        ];
        
        RAISE NOTICE 'Columna active_modules creada exitosamente.';
    ELSE
        RAISE NOTICE 'La columna active_modules ya existe en la tabla organizations.';
    END IF;

END $$;

-- =========================================================================
-- GUÍA RÁPIDA DE USO PARA ADMINISTRADORES:
-- =========================================================================
/*
-- CASO 1: Un cliente compró SOLO el software de restaurante (Sin Hotel).
-- Ejecutar en Supabase:
UPDATE public.organizations 
SET active_modules = ARRAY['restaurante', 'financiero', 'usuarios', 'sedes', 'marketing', 'qr_tools', 'operaciones']
WHERE id = 'ID_DE_LA_ORGANIZACION_AQUI';

-- CASO 2: Restablecer todos los módulos a una cuenta
UPDATE public.organizations 
SET active_modules = ARRAY['restaurante', 'hotel', 'financiero', 'usuarios', 'sedes', 'marketing', 'qr_tools', 'operaciones']
WHERE id = 'ID_DE_LA_ORGANIZACION_AQUI';
*/
