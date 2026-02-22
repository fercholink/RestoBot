-- =================================================================
-- MIGRACIÓN: CONFIGURACIÓN MULTI-INDUSTRIA Y CORE COLOMBIANO
-- Descripción: Ampliación de la organización para cumplir con 
-- Decreto 957 de 2019, NIIF y configuración de Módulos (SaaS).
-- =================================================================

-- 1. TABLA DE CONFIGURACIÓN FISCAL / CONTABLE DE LA EMPRESA (Tenant)
-- Esta tabla extiende la organización principal ('organizations') con la taxonomía contable colombiana
CREATE TABLE IF NOT EXISTS public.tenant_accounting_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    -- Tipo de Industria Principal (Para activación de módulos en el SaaS)
    primary_industry TEXT NOT NULL DEFAULT 'restaurant', -- 'hotel', 'retail', 'real_estate', 'services'
    
    -- 1. Clasificación por Tamaño y Sector (Decreto 957 de 2019)
    macro_sector TEXT NOT NULL DEFAULT 'Servicios', -- 'Manufactura', 'Servicios', 'Comercio'
    size_classification TEXT, -- 'Microempresa', 'Pequeña', 'Mediana', 'Grande' (Calculable o manual por UVT)
    economic_sector TEXT, -- 'Primario', 'Secundario', 'Terciario', 'Cuaternario'
    
    -- 2. Clasificación por Forma Jurídica
    legal_form TEXT NOT NULL DEFAULT 'SAS', -- 'Persona Natural', 'SAS', 'SA', 'Limitada', 'En Comandita'
    
    -- 3. Clasificación para Efectos Contables (NIIF)
    niif_group INTEGER NOT NULL DEFAULT 3, -- 1: Grandes/Emisores, 2: Pymes, 3: Microempresas
    
    -- Modificadores y responsabilidades adicionales RUT
    is_great_contributor BOOLEAN DEFAULT FALSE, -- Gran Contribuyente
    is_self_retaining BOOLEAN DEFAULT FALSE, -- Autorretenedor
    tax_regime TEXT DEFAULT 'responsable_iva', -- 'responsable_iva', 'no_responsable', 'regimen_simple'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MÓDULOS ACTIVOS DEL SAAS
-- Aquí definimos qué "satélites" tiene encendidos esta empresa (Ej: Hotel + Restaurante)
CREATE TABLE IF NOT EXISTS public.active_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    module_code TEXT NOT NULL, -- 'HOTEL_CORE', 'RESTAURANT_POS', 'REAL_ESTATE_MGMT', 'PAYROLL'
    is_active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_module UNIQUE (organization_id, module_code)
);

-- 3. MOTOR DE EVENTOS Y PLANTILLAS CONTABLES (El puente entre Satélites y Contabilidad)
-- Define como un módulo satélite (ej. POS del restaurante) crea asientos contables automatizados.
CREATE TABLE IF NOT EXISTS public.accounting_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL significa Plantilla Global del Sistema
    
    module_code TEXT NOT NULL, -- Ej: 'RESTAURANT_POS'
    event_trigger TEXT NOT NULL, -- Ej: 'VENTA_PAGADA', 'COMPRA_INVENTARIO', 'CHECKOUT_HOTEL', 'PAGO_ARRIENDO'
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- La plantilla contiene en formato JSON las reglas de cuenta contable 
    -- Ej: [{"account_code": "110505", "type": "debit", "amount_source": "total_paid"}, 
    --      {"account_code": "412005", "type": "credit", "amount_source": "base_amount"}]
    entry_rules JSONB NOT NULL,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HABILITANDO SEGURIDAD RLS
ALTER TABLE public.tenant_accounting_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_templates ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS BÁSICAS PARA USO CON USUARIOS AUTENTICADOS 
-- (Se asume filtro por organización en las consultas Frontend)
CREATE POLICY "Allow read for tenant config" ON public.tenant_accounting_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for tenant config" ON public.tenant_accounting_config FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for active modules" ON public.active_modules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for active modules" ON public.active_modules FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read for accounting templates" ON public.accounting_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for accounting templates" ON public.accounting_templates FOR ALL USING (auth.role() = 'authenticated');
