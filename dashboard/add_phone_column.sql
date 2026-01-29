-- =============================================
-- MIGRACIÓN: Agregar columna de teléfono
-- =============================================

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_phone text;

-- Opcional: Agregar comentario
COMMENT ON COLUMN public.orders.customer_phone IS 'Teléfono del cliente con código de país (ej. +57...)';
