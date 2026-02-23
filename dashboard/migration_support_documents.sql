-- Migración para añadir soporte de Documentos Soporte (DIAN) a Gastos
ALTER TABLE public.accounting_entries
ADD COLUMN IF NOT EXISTS factus_id TEXT,
ADD COLUMN IF NOT EXISTS factus_doc_number TEXT,
ADD COLUMN IF NOT EXISTS factus_status TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Forzar recarga del cache del schema de Supabase
NOTIFY pgrst, 'reload schema';
