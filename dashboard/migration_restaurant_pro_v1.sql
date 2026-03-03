-- =================================================================
-- MIGRACIÓN: RESTAURANT PRO v1
-- Descripción: Descuentos en órdenes, auditoría de cambios e
--              índices de rendimiento para el módulo de restaurante.
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- =================================================================

-- 1. ── DESCUENTOS EN ÓRDENES ─────────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS discount        NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- 2. ── TABLA DE AUDITORÍA ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id     UUID,
    user_name   TEXT,
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data    JSONB,
    new_data    JSONB,
    ip_address  TEXT
);

-- RLS para audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Autenticados pueden leer audit_log"
    ON public.audit_log FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Sistema puede insertar audit_log"
    ON public.audit_log FOR INSERT
    WITH CHECK (true);

-- 3. ── FUNCIÓN + TRIGGER DE AUDITORÍA EN ÓRDENES ─────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_orders()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.audit_log (user_id, table_name, record_id, action, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::JSONB ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_orders();

-- 4. ── ÍNDICES DE RENDIMIENTO ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id    ON public.orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON public.audit_log(created_at DESC);

-- 5. ── HABILITAR REALTIME ─────────────────────────────────────────
-- (Si ya está habilitado para orders, esta instrucción es idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;

-- =================================================================
-- FIN DE MIGRACIÓN
-- =================================================================
