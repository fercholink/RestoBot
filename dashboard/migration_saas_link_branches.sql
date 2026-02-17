-- 1. Asegurar Organización por defecto
DO $$
DECLARE
    default_org_id uuid;
BEGIN
    -- Intentar buscar una organización existente
    SELECT id INTO default_org_id FROM public.organizations LIMIT 1;

    -- Si no existe ninguna, crear una "Organización Maestra"
    IF default_org_id IS NULL THEN
        INSERT INTO public.organizations (name, plan, status)
        VALUES ('Mi Empresa Principal', 'pro', 'active')
        RETURNING id INTO default_org_id;
    END IF;

    -- 2. Asegurar que 'branches' tenga la columna organization_id
    BEGIN
        ALTER TABLE public.branches ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
    EXCEPTION
        WHEN duplicate_column THEN
            NULL; -- Ya existe, no hacer nada
    END;

    -- 3. Vincular Perfiles Huérfanos
    UPDATE public.profiles
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;

    -- 4. Vincular Branches Huérfanas
    UPDATE public.branches
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;

    -- 5. Crear índice para Branches
    CREATE INDEX IF NOT EXISTS idx_branches_org_id ON public.branches(organization_id);

    -- 6. Habilitar RLS en Branches (para aislar sedes por organización)
    ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

    -- Política: Ver solo branches de mi organización
    DROP POLICY IF EXISTS "Ver branches de mi organizacion" ON public.branches;
    CREATE POLICY "Ver branches de mi organizacion" ON public.branches
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

    -- Permitir todo a usuarios autenticados temporalmente si falla la lógica anterior (backup)
    -- CREATE POLICY "Allow all branches for authenticated" ON public.branches FOR ALL TO authenticated USING (true);
END $$;
