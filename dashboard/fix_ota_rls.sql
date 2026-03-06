-- =================================================================
-- FIX: Política RLS para que la Landing Page pueda insertar reservas
-- Ejecutar en: Supabase > SQL Editor
-- =================================================================

-- Asegurarse que la tabla existe (por si no se ejecutó la migración anterior)
CREATE TABLE IF NOT EXISTS public.channel_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    channel TEXT NOT NULL DEFAULT 'direct',
    external_id TEXT,
    guest_name TEXT NOT NULL,
    guest_email TEXT,
    guest_phone TEXT,
    guest_country TEXT,
    guest_document TEXT,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INTEGER,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    room_type_requested TEXT,
    total_amount NUMERIC(12,2),
    currency TEXT DEFAULT 'COP',
    commission_amount NUMERIC(12,2),
    payment_status TEXT DEFAULT 'pendiente',
    notes TEXT,
    raw_email_body TEXT,
    parsed_data JSONB,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'cancelada', 'ignorada')),
    booking_id BIGINT,
    branch_id BIGINT
);

-- Habilitar RLS
ALTER TABLE public.channel_bookings ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas viejas para evitar conflictos
DROP POLICY IF EXISTS "Authenticated users can read channel_bookings" ON public.channel_bookings;
DROP POLICY IF EXISTS "Authenticated users can write channel_bookings" ON public.channel_bookings;
DROP POLICY IF EXISTS "Anon can insert channel_bookings" ON public.channel_bookings;

-- POLÍTICA 1: Usuarios autenticados pueden leer todo
CREATE POLICY "Authenticated users can read channel_bookings"
ON public.channel_bookings FOR SELECT
USING (auth.role() = 'authenticated');

-- POLÍTICA 2: Usuarios autenticados pueden gestionar (update, delete)
CREATE POLICY "Authenticated users can manage channel_bookings"
ON public.channel_bookings FOR ALL
USING (auth.role() = 'authenticated');

-- POLÍTICA 3: CLAVE - Anon (landing page) puede insertar
-- Esto permite que la landing page inserte sin autenticación
CREATE POLICY "Anon can insert channel_bookings"
ON public.channel_bookings FOR INSERT
WITH CHECK (true);

-- Verificar índices
CREATE INDEX IF NOT EXISTS idx_channel_bookings_status ON public.channel_bookings(status);
CREATE INDEX IF NOT EXISTS idx_channel_bookings_check_in ON public.channel_bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_channel_bookings_channel ON public.channel_bookings(channel);

-- Confirmación
SELECT 'RLS configurada correctamente.' AS resultado;
