-- Función disparadora para registrar ventas del POS en la contabilidad general automáticamente

-- 1. Crear la función del Trigger
CREATE OR REPLACE FUNCTION trg_order_paid_accounting()
RETURNS TRIGGER AS $$
DECLARE
    v_entry_id UUID;
    v_caja_id UUID;
    v_ventas_id UUID;
    v_impuesto_id UUID;
    v_amount DECIMAL;
    v_tax_amount DECIMAL;
BEGIN
    -- Asegurar que se dispare en INSERT (si ya viene pagado) 
    -- o en UPDATE (si cambia a pagado)
    IF (TG_OP = 'INSERT' AND (NEW.status = 'pagado' OR NEW.is_paid = TRUE)) OR
       (TG_OP = 'UPDATE' AND ((NEW.status = 'pagado' AND OLD.status != 'pagado') OR 
                              (NEW.is_paid = TRUE AND OLD.is_paid = FALSE))) THEN
        
        -- Si es un cargo a habitación del restaurante, no lo contabilizamos aquí, 
        -- se contabilizará globalmente al hacer el Check-Out del hotel.
        -- NOTA: Los checkouts reales del hotel SÍ deben contabilizarse (tienen 'Checkout' en notas).
        IF NEW.table_number LIKE 'HAB-%' AND COALESCE(NEW.notes, '') NOT LIKE 'Checkout Habitación%' THEN
            RETURN NEW;
        END IF;
        
        -- Monto total de la venta
        v_amount := COALESCE(NEW.total, NEW.total_price, 0);
        
        -- Evitar transacciones en 0 por seguridad
        IF v_amount <= 0 THEN
            RETURN NEW;
        END IF;

        -- Buscar las Cuentas Contables en el PUC (Limitamos a la primera coincidencia del prefijo)
        -- 1105 - Caja
        SELECT id INTO v_caja_id FROM public.accounting_accounts WHERE code LIKE '1105%' LIMIT 1;
        
        -- 4140 - Ingresos por Ventas de Restaurante / Hotel
        SELECT id INTO v_ventas_id FROM public.accounting_accounts WHERE code LIKE '4140%' LIMIT 1;
        
        -- 2408 - Impuesto sobre las ventas por pagar // 240801
        SELECT id INTO v_impuesto_id FROM public.accounting_accounts WHERE code LIKE '2408%' LIMIT 1;

        -- Si no hay cuentas de caja y ventas, no se puede hacer el asiento
        IF v_caja_id IS NULL OR v_ventas_id IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Determinar los impuestos (Si el objeto JSONB tax_data existe)
        v_tax_amount := 0;
        BEGIN
            IF NEW.tax_data IS NOT NULL THEN
                -- Tratar de extraer 'total_tax' de manera segura
                v_tax_amount := COALESCE((NEW.tax_data->>'total_tax')::DECIMAL, 0);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_tax_amount := 0;
        END;

        -- Si el impuesto es mayor que el monto, algo anda mal, así que lo forzamos a 0
        IF v_tax_amount >= v_amount THEN
            v_tax_amount := 0;
        END IF;

        -- 1. Insertar el Encabezado del Asiento Contable
        INSERT INTO public.accounting_entries (
            date,
            reference,
            description,
            journal_type,
            status
        ) VALUES (
            CURRENT_DATE,
            'POS-' || NEW.id,
            'Venta automática POS Pedido #' || NEW.id,
            'ingreso',
            'posted'
        ) RETURNING id INTO v_entry_id;

        -- 2. Asentar Débito a Caja (Entra el dinero completo + impuestos) (Activo aumenta por Débito)
        INSERT INTO public.accounting_entry_items (entry_id, account_id, description, debit, credit)
        VALUES (v_entry_id, v_caja_id, 'Ingreso a caja', v_amount, 0);

        -- 3. Asentar Crédito a Ventas (Aumenta el ingreso, descontando el impuesto de la base) (Ingreso aumenta por Crédito)
        INSERT INTO public.accounting_entry_items (entry_id, account_id, description, debit, credit)
        VALUES (v_entry_id, v_ventas_id, 'Ingreso por venta', 0, v_amount - v_tax_amount);

        -- 4. Asentar Crédito a IVA/Impoconsumo (Pasivo) si aplica (Pasivo aumenta por Crédito)
        IF v_tax_amount > 0 AND v_impuesto_id IS NOT NULL THEN
            INSERT INTO public.accounting_entry_items (entry_id, account_id, description, debit, credit)
            VALUES (v_entry_id, v_impuesto_id, 'Impuestos generados', 0, v_tax_amount);
        END IF;
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear el Trigger (Borrar si ya existe para evitar duplicidad)
DROP TRIGGER IF EXISTS trigger_order_paid_accounting ON public.orders;

CREATE TRIGGER trigger_order_paid_accounting
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION trg_order_paid_accounting();
