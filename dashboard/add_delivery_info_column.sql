-- Agrega la columna delivery_info de tipo JSONB a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_info JSONB;

-- Comentario para documentación
COMMENT ON COLUMN public.orders.delivery_info IS 'Almacena detalles estructurados del domicilio: address, neighborhood, city, housingType, etc.';
