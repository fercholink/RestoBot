-- =================================================================
-- MIGRACIÓN: BANDEJA DE CANALES OTA (Booking.com, Airbnb, etc.)
-- Descripción: Tabla que recibe reservas entrantes desde n8n/webhooks
--              antes de ser confirmadas en el sistema hotelero.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.channel_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Canal de origen
    channel TEXT NOT NULL DEFAULT 'booking', -- 'booking', 'airbnb', 'expedia', 'direct', 'manual'
    external_id TEXT,          -- ID de la reserva en el canal (Nro. de Booking.com)

    -- Huésped
    guest_name TEXT NOT NULL,
    guest_email TEXT,
    guest_phone TEXT,
    guest_country TEXT,
    guest_document TEXT,

    -- Estadía
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INTEGER,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    room_type_requested TEXT,  -- 'Individual', 'Doble', 'Suite', etc. (texto del email)

    -- Financiero
    total_amount NUMERIC(12,2),
    currency TEXT DEFAULT 'COP',
    commission_amount NUMERIC(12,2),  -- Comisión del canal
    payment_status TEXT DEFAULT 'pendiente', -- 'pendiente', 'pagado_canal', 'pagado_hotel'

    -- Notas y datos crudos del email
    notes TEXT,
    raw_email_body TEXT,       -- Cuerpo del email original (para revisión)
    parsed_data JSONB,         -- Datos extra que n8n extrajo del email

    -- Estado en el sistema
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'cancelada', 'ignorada')),
    -- booking_id apunta a la reserva real una vez confirmada (BIGINT para coincidir con bookings.id)
    booking_id BIGINT,
    -- branch_id para multi-sede (BIGINT para coincidir con branches.id)
    branch_id BIGINT,

    UNIQUE(channel, external_id) -- Evitar duplicados del mismo canal
);

-- RLS
ALTER TABLE public.channel_bookings ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden leer/escribir
CREATE POLICY "Authenticated users can read channel_bookings"
ON public.channel_bookings FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can write channel_bookings"
ON public.channel_bookings FOR ALL
USING (auth.role() = 'authenticated');

-- Política especial: ANON puede insertar (para n8n sin autenticación de usuario)
-- IMPORTANTE: Para mayor seguridad, usar service_role en n8n en vez de anon key
CREATE POLICY "Anon can insert channel_bookings"
ON public.channel_bookings FOR INSERT
WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_channel_bookings_status ON public.channel_bookings(status);
CREATE INDEX IF NOT EXISTS idx_channel_bookings_check_in ON public.channel_bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_channel_bookings_channel ON public.channel_bookings(channel);
