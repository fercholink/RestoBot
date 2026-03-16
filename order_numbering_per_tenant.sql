-- ==================================================================================
-- NUMERACIÓN INDEPENDIENTE DE PEDIDOS POR ORGANIZACIÓN (TENANT)
-- Cada empresa tendrá su propia secuencia: 1, 2, 3...
-- El id global de la tabla sigue siendo el identificador técnico interno.
-- ==================================================================================

-- 1. TABLA DE CONTADORES POR ORGANIZACIÓN
-- Almacena el último número usado por cada empresa
CREATE TABLE IF NOT EXISTS public.organization_order_counters (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    last_number     INTEGER NOT NULL DEFAULT 0
);

-- Permisos RLS para la tabla de contadores
ALTER TABLE public.organization_order_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters_own_org" ON public.organization_order_counters
FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id());

-- El super admin puede ver todos
CREATE POLICY "counters_superadmin" ON public.organization_order_counters
FOR ALL TO authenticated
USING (public.jwt_is_superadmin());

-- 2. COLUMNA order_number EN LA TABLA DE PEDIDOS
-- Número legible por humanos, único por empresa (no globalmente)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- 3. FUNCIÓN QUE GENERA EL PRÓXIMO NÚMERO (ATÓMICA Y SEGURA)
-- Usa FOR UPDATE para evitar condiciones de carrera (concurrencia)
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    next_num INTEGER;
    org_id UUID;
BEGIN
    -- Obtener organization_id del nuevo pedido
    org_id := NEW.organization_id;
    
    -- Si no tiene organización, usar 0 como número (caso de emergencia)
    IF org_id IS NULL THEN
        NEW.order_number := 0;
        RETURN NEW;
    END IF;

    -- Insertar el contador si no existe, e incrementarlo de forma atómica
    INSERT INTO public.organization_order_counters (organization_id, last_number)
    VALUES (org_id, 1)
    ON CONFLICT (organization_id) DO UPDATE
        SET last_number = organization_order_counters.last_number + 1
    RETURNING last_number INTO next_num;

    NEW.order_number := next_num;
    RETURN NEW;
END;
$$;

-- 4. TRIGGER QUE LLAMA A LA FUNCIÓN ANTES DE CADA INSERT
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_order_number();

-- 5. ACTUALIZAR PEDIDOS EXISTENTES (Numerar los que ya existen)
-- Asigna números retroactivamente, ordenados por fecha de creación
DO $$
DECLARE
    org RECORD;
    ord RECORD;
    counter INTEGER;
BEGIN
    FOR org IN (SELECT DISTINCT organization_id FROM public.orders WHERE organization_id IS NOT NULL) LOOP
        counter := 1;
        FOR ord IN (
            SELECT id FROM public.orders 
            WHERE organization_id = org.organization_id 
            ORDER BY created_at ASC
        ) LOOP
            UPDATE public.orders SET order_number = counter WHERE id = ord.id;
            counter := counter + 1;
        END LOOP;
        
        -- Actualizar el contador al último número usado
        INSERT INTO public.organization_order_counters (organization_id, last_number)
        VALUES (org.organization_id, counter - 1)
        ON CONFLICT (organization_id) DO UPDATE SET last_number = EXCLUDED.last_number;
        
        RAISE NOTICE 'Organización %: % pedidos numerados', org.organization_id, counter - 1;
    END LOOP;
END $$;

-- Verificar resultado:
-- SELECT o.id, o.order_number, o.organization_id, org.name as empresa, o.created_at
-- FROM public.orders o
-- LEFT JOIN public.organizations org ON o.organization_id = org.id
-- ORDER BY org.name, o.order_number;
