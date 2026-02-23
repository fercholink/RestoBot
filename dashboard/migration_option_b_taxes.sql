-- Opción B: Discriminación de Impuestos y Tarifas (IVA / INC)

-- 1. Añadimos columnas de impuestos a la tabla products si no existen
-- Usamos NUMERIC para precisión en porcentajes.
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(10, 2) DEFAULT 0,  -- Ej: 19.00 o 8.00
ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'EXENTO';     -- 'IVA_19', 'ICO_8', 'EXENTO'

-- 2. Asegurarnos que existan las columnas en order_items para guardar 
-- una foto histórica del impuesto al momento de la venta.
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'EXENTO',
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2) DEFAULT 0;

-- 3. Actualizamos productos existentes con valores por defecto 
-- (asumiendo ICO del 8% como común en restaurantes si es el caso, o EXENTO provisionalmente)
-- Puedes cambiar esta consulta según la realidad de la mayoría de tu menú
UPDATE public.products 
SET 
    tax_type = 'ICO_8', 
    tax_rate = 8.00 
WHERE tax_type = 'EXENTO'; -- Cuidado: solo aplica si confías en que la mayoría lleva el 8%.

-- Si quisieras poner todo a IVA 19, usarías:
-- UPDATE public.products SET tax_type = 'IVA_19', tax_rate = 19.00 WHERE tax_type IS NULL;

-- 4. Notificar a Supabase de que recargue los cachés 
NOTIFY pgrst, 'reload schema';
