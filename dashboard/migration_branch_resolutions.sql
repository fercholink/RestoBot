-- =================================================================
-- MIGRACIÓN FASE 1: RESOLUCIONES DIAN Y CONSECUTIVOS POR SUCURSAL
-- =================================================================

-- 1. Crear la tabla de resoluciones de facturación (DIAN)
CREATE TABLE IF NOT EXISTS public.branch_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT REFERENCES public.branches(id) ON DELETE CASCADE,
    
    resolution_number TEXT NOT NULL,
    prefix TEXT NOT NULL, -- Ej: 'POS-N'
    start_range INTEGER NOT NULL,
    end_range INTEGER NOT NULL,
    current_number INTEGER NOT NULL, -- El número actual que se usará en la próxima venta
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index único parcial: Solo puede haber una resolución activa (is_active = true) por sede (branch_id)
CREATE UNIQUE INDEX IF NOT EXISTS branch_resolutions_active_idx 
ON public.branch_resolutions (branch_id) 
WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.branch_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read all for auth resolutions" ON public.branch_resolutions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write all for auth resolutions" ON public.branch_resolutions FOR ALL USING (auth.role() = 'authenticated');

-- 2. Añadir campos necesarios en la tabla orders (Consecutivo y Totales de Impuesto)
-- Nota: orders ya tiene branch_id por migraciones anteriores (migration_multibranch_setup)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS invoice_number TEXT,                                     -- Ej: "POS-N-1234"
ADD COLUMN IF NOT EXISTS invoice_resolution_id UUID REFERENCES public.branch_resolutions(id),
ADD COLUMN IF NOT EXISTS tax_iva NUMERIC(15, 2) DEFAULT 0,                        -- Total IVA de la orden
ADD COLUMN IF NOT EXISTS tax_inc NUMERIC(15, 2) DEFAULT 0,                        -- Total Impoconsumo de la orden
ADD COLUMN IF NOT EXISTS tax_base NUMERIC(15, 2) DEFAULT 0;                       -- Base gravable (Total sin impuestos)

-- 3. Crear Función Transaccional para Generar el Siguiente Consecutivo (POS)
-- Se llamará desde Supabase Client RPC o vía Backend, justo al cobrar/confirmar el pago.
CREATE OR REPLACE FUNCTION public.generate_pos_invoice_number(p_branch_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolution RECORD;
    v_next_number INTEGER;
    v_invoice_number TEXT;
    v_result JSONB;
BEGIN
    -- 1. Buscar la resolución activa para la sede. FOR UPDATE bloquea la fila
    -- para evitar condiciones de carrera si dos cajas de la misma sede cobran a la vez.
    SELECT * INTO v_resolution
    FROM public.branch_resolutions
    WHERE branch_id = p_branch_id AND is_active = true
    FOR UPDATE;

    -- Validaciones de cumplimiento legal
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se encontró una resolución de facturación activa para esta sede.');
    END IF;

    IF v_resolution.current_number > v_resolution.end_range THEN
        RETURN jsonb_build_object('success', false, 'error', 'Las numeración de la resolución se ha agotado. Rango final alcanzado (' || v_resolution.end_range || ').');
    END IF;

    IF CURRENT_DATE > v_resolution.end_date THEN
        RETURN jsonb_build_object('success', false, 'error', 'La resolución de facturación se encuentra vencida (Fecha Final: ' || v_resolution.end_date || ').');
    END IF;

    -- 2. Armar el consecutivo (Ej. POS-N-1520)
    v_next_number := v_resolution.current_number;
    v_invoice_number := v_resolution.prefix || '-' || v_next_number::TEXT;

    -- 3. Actualizar el consecutivo consumiéndolo (+1)
    UPDATE public.branch_resolutions
    SET current_number = current_number + 1,
        updated_at = NOW()
    WHERE id = v_resolution.id;

    -- 4. Devolver la información generada
    v_result := jsonb_build_object(
        'success', true, 
        'invoice_number', v_invoice_number, 
        'resolution_id', v_resolution.id
    );
    
    RETURN v_result;
END;
$$;
