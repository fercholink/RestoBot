-- =================================================================
-- MIGRACIÓN: MÓDULO CONTABLE (CORE)
-- Descripción: Tablas base para el sistema de contabilidad multi-industria
-- Compatible con: Normativa Colombiana (PUC) y Preparación NIIF
-- =================================================================

-- 1. TABLA DE TERCEROS (Unificación de atributos fiscales)
-- Reemplaza o extiende la gestión de perfiles actual.
-- Se usa para Clientes, Proveedores, Empleados y Entidades estatales.
CREATE TABLE IF NOT EXISTS public.third_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Identificación
    document_type TEXT NOT NULL DEFAULT 'CC', -- CC, NIT, TI, CE, PASS
    document_number TEXT NOT NULL,
    verification_digit INTEGER, -- Solo para NIT
    
    -- Datos Legales
    business_name TEXT, -- Razón Social (Para Jurídicas)
    first_name TEXT, -- Para Naturales
    last_name TEXT, -- Para Naturales
    
    -- Datos Fiscales
    tax_regime TEXT DEFAULT 'responsable_iva', -- responsable_iva, no_responsable, regimen_simple
    liability_code TEXT, -- Codigo Responsabilidad Fiscal (RUT 53, etc)
    
    -- Contacto
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    
    -- Metadatos
    is_client BOOLEAN DEFAULT FALSE,
    is_supplier BOOLEAN DEFAULT FALSE,
    is_employee BOOLEAN DEFAULT FALSE,
    
    -- Restricción de unicidad: Un mismo NIT no debe repetirse
    CONSTRAINT unique_document UNIQUE (document_type, document_number)
);

-- 2. PLAN ÚNICO DE CUENTAS (PUC / CATÁLOGO)
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- Código PUC: 110505
    name TEXT NOT NULL, -- Nombre: CAJA GENERAL
    
    -- Clasificación
    class_code TEXT GENERATED ALWAYS AS (SUBSTRING(code FROM 1 FOR 1)) STORED, -- 1: Activo, 2: Pasivo...
    group_code TEXT GENERATED ALWAYS AS (SUBSTRING(code FROM 1 FOR 2)) STORED, -- 11: Disponible
    
    -- Configuración
    nature TEXT NOT NULL CHECK (nature IN ('debit', 'credit')), -- Naturaleza por defecto
    is_movement BOOLEAN DEFAULT TRUE, -- Si TRUE, permite asientos. Si FALSE, es título/grupo.
    requires_third_party BOOLEAN DEFAULT FALSE, -- Exige NIT en el asiento (Ej: Cuentas por cobrar)
    requires_cost_center BOOLEAN DEFAULT FALSE, -- Exige Centro de Costos
    
    -- NIIF Mapping (Futuro)
    niif_code TEXT, -- Mapeo a taxonomía IFRS
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CABECERA DE ASIENTO (COMPROBANTE CONTABLE)
CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    date DATE NOT NULL, -- Fecha contable
    created_by UUID REFERENCES auth.users(id), -- Usuario que creó
    
    -- Clasificación
    journal_type TEXT NOT NULL DEFAULT 'diario', -- diario, egreso, ingreso, nomina
    status TEXT DEFAULT 'draft', -- draft, posted, voided
    
    -- Referencias
    reference TEXT, -- Numero de factura externa, etc.
    description TEXT, -- Glosa general
    
    -- NIIF (Parallel Ledger)
    ledger_type TEXT DEFAULT 'fiscal', -- fiscal (COLGAAP), ifrs (NIIF), both (Ambos)
    
    branch_id BIGINT REFERENCES public.branches(id) -- Sede
);

-- 4. DETALLE DE ASIENTO (MOVIMIENTOS)
CREATE TABLE IF NOT EXISTS public.accounting_entry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
    
    account_id UUID REFERENCES public.accounting_accounts(id) NOT NULL,
    third_party_id UUID REFERENCES public.third_parties(id), -- Tercero del movimiento
    
    description TEXT, -- Glosa específica
    
    -- Valores
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    
    base_amount NUMERIC(15, 2), -- Base gravable (para impuestos)
    
    -- Metadatos
    cost_center_id UUID, -- Futura tabla de centros de costos
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CONFIGURACIÓN DE IMPUESTOS
CREATE TABLE IF NOT EXISTS public.taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- IVA 19%, RETEFUENTE 2.5%
    code TEXT, -- Codigo DIAN
    
    rate NUMERIC(5, 2) NOT NULL, -- Porcentaje
    type TEXT NOT NULL, -- valor_agregado, retencion, consumo
    
    -- Contabilidad automática
    sales_account_id UUID REFERENCES public.accounting_accounts(id), -- Cuenta Ventas
    purchase_account_id UUID REFERENCES public.accounting_accounts(id) -- Cuenta Compras
);

-- ENABLE RLS (Seguridad)
ALTER TABLE public.third_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

-- POLITICAS RLS BÁSICAS (Permitir todo a autenticados por ahora, ajustar luego)
CREATE POLICY "Allow read all for auth users" ON public.third_parties FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write all for auth users" ON public.third_parties FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read all for auth accounts" ON public.accounting_accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write all for auth accounts" ON public.accounting_accounts FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read all for auth entries" ON public.accounting_entries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write all for auth entries" ON public.accounting_entries FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read all for auth items" ON public.accounting_entry_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write all for auth items" ON public.accounting_entry_items FOR ALL USING (auth.role() = 'authenticated');
