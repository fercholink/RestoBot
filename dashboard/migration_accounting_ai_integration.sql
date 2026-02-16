-- =================================================================
-- MIGRACIÓN: INTEGRACIÓN AI / N8N
-- Descripción: Campos y funciones para permitir la inyección de asientos
-- desde agentes externos (Emails, WhatsApp).
-- =================================================================

-- 1. AGREGAR CAMPOS DE TRAZABILIDAD Y SOPORTES
ALTER TABLE public.accounting_entries
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual', -- 'manual', 'n8n_email', 'n8n_whatsapp', 'api'
ADD COLUMN IF NOT EXISTS external_reference_id TEXT, -- ID del correo, ID del mensaje de WA
ADD COLUMN IF NOT EXISTS attachment_url TEXT, -- URL del PDF o Imagen en Storage
ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb; -- Datos extraídos por la IA (confianza, tokens, etc)

-- 2. FUNCIÓN RPC PARA INSERTAR ASIENTO COMPLETO (ATÓMICO)
-- Esta función será llamada por n8n via Supabase REST API (POST /rpc/create_accounting_entry_v1)
CREATE OR REPLACE FUNCTION public.create_accounting_entry_v1(
    p_date DATE,
    p_description TEXT,
    p_reference TEXT,
    p_journal_type TEXT,
    p_origin TEXT,
    p_external_reference_id TEXT,
    p_attachment_url TEXT,
    p_items JSONB, -- Array de objetos: [{account_code, description, debit, credit, third_party_doc}]
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos de admin (cuidado con RLS)
AS $$
DECLARE
    v_new_entry_id UUID;
    v_item JSONB;
    v_account_id UUID;
    v_third_party_id UUID;
BEGIN
    -- 1. Crear Cabecera
    INSERT INTO public.accounting_entries (
        date, 
        description, 
        reference, 
        journal_type, 
        origin, 
        external_reference_id, 
        attachment_url,
        status,
        branch_id,
        created_by -- Asignar un usuario sistema o dejar null si RLS lo permite (o usar auth.uid() si n8n autentica)
    ) VALUES (
        p_date,
        p_description,
        p_reference,
        p_journal_type,
        p_origin,
        p_external_reference_id,
        p_attachment_url,
        'draft', -- Siempre en borrador para revisión humana
        p_branch_id,
        auth.uid()
    ) RETURNING id INTO v_new_entry_id;

    -- 2. Recorrer Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Buscar ID de Cuenta por Código
        SELECT id INTO v_account_id 
        FROM public.accounting_accounts 
        WHERE code = (v_item->>'account_code')
        LIMIT 1;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'Cuenta contable no encontrada: %', (v_item->>'account_code');
        END IF;

        -- Opcional: Buscar Tercero por Documento (Si viene en el JSON)
        v_third_party_id := NULL;
        IF (v_item->>'third_party_doc') IS NOT NULL THEN
            SELECT id INTO v_third_party_id
            FROM public.third_parties
            WHERE document_number = (v_item->>'third_party_doc')
            LIMIT 1;
        END IF;

        -- Insertar Item
        INSERT INTO public.accounting_entry_items (
            entry_id,
            account_id,
            third_party_id,
            description,
            debit,
            credit
        ) VALUES (
            v_new_entry_id,
            v_account_id,
            v_third_party_id,
            COALESCE(v_item->>'description', p_description),
            COALESCE((v_item->>'debit')::NUMERIC, 0),
            COALESCE((v_item->>'credit')::NUMERIC, 0)
        );
    END LOOP;

    RETURN v_new_entry_id;
END;
$$;
