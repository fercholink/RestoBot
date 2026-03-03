-- ============================================================
-- MIGRACIÓN: HOTEL PMS PRO — CRM Y HOUSEKEEPING (VERSIÓN 1.2)
-- ============================================================

-- 0. ASEGURAR ESTRUCTURA BASE (Si no existe)
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER,
    floor_id INTEGER,
    number TEXT NOT NULL,
    type TEXT,
    base_price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'disponible',
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. EXTENDER TABLA DE HABITACIONES (ROOMS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'housekeeping_status') THEN
        ALTER TABLE rooms ADD COLUMN housekeeping_status TEXT CHECK (housekeeping_status IN ('limpio', 'sucio', 'inspeccionado', 'mantenimiento')) DEFAULT 'limpio';
        ALTER TABLE rooms ADD COLUMN last_cleaned_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE rooms ADD COLUMN last_cleaned_by UUID;
        ALTER TABLE rooms ADD COLUMN housekeeping_notes TEXT;
    END IF;
END $$;

-- 2. EXTENDER TABLA DE HUÉSPEDES
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guests') THEN
        ALTER TABLE guests ADD COLUMN IF NOT EXISTS identification_photo_url TEXT;
        ALTER TABLE guests ADD COLUMN IF NOT EXISTS signature_url TEXT;
        ALTER TABLE guests ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE guests ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
        ALTER TABLE guests ADD COLUMN IF NOT EXISTS birth_date DATE;
        ALTER TABLE guests ADD COLUMN IF NOT EXISTS nationality TEXT;
    END IF;
END $$;

-- 3. EXTENDER TABLA DE RESERVAS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'directo';
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ota_reservation_id TEXT;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. VISTA DE ANALÍTICA (MÉTRICAS)
-- Reescrito usando CASE para máxima compatibilidad con parsers SQL
DROP VIEW IF EXISTS hotel_metrics_view;
CREATE OR REPLACE VIEW hotel_metrics_view AS
SELECT 
    branch_id,
    COUNT(CASE WHEN status = 'ocupada' THEN 1 END) as occupied_rooms,
    COUNT(*) as total_rooms,
    ROUND(
        COALESCE(
            CAST(COUNT(CASE WHEN status = 'ocupada' THEN 1 END) AS NUMERIC) / NULLIF(COUNT(*), 0) * 100, 
            0
        ), 
        2
    ) as occupancy_rate,
    COALESCE(AVG(CASE WHEN status = 'ocupada' THEN base_price END), 0) as adr,
    COALESCE(
        AVG(CASE WHEN status = 'ocupada' THEN base_price END) * 
        (CAST(COUNT(CASE WHEN status = 'ocupada' THEN 1 END) AS NUMERIC) / NULLIF(COUNT(*), 0)), 
        0
    ) as revpar
FROM rooms
GROUP BY branch_id;

-- 5. HABILITAR REALTIME
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
        EXCEPTION WHEN others THEN NULL; END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE guests;
        EXCEPTION WHEN others THEN NULL; END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
        EXCEPTION WHEN others THEN NULL; END;
    END IF;
END $$;

-- 6. ADD DISCOUNT COLUMNS TO ORDERS
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;

