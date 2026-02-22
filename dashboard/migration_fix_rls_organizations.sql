-- Safe migration to add RLS policies for organizations without errors if they exist

DO $$
BEGIN
    -- 1. Permite a los usuarios insertar una organización marcándose como dueños
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Users can insert own organization') THEN
        CREATE POLICY "Users can insert own organization" 
        ON public.organizations
        FOR INSERT 
        WITH CHECK (auth.uid() = owner_id);
    END IF;

    -- 2. Permite a los usuarios actualizar los datos de su propia organización
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Users can update own organization') THEN
        CREATE POLICY "Users can update own organization" 
        ON public.organizations
        FOR UPDATE 
        USING (auth.uid() = owner_id);
    END IF;
    
    -- (Omitimos la política de 'profiles' porque la base de datos ya la tiene correctamente configurada)
END
$$;
