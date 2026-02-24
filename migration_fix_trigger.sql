-- ============================================================
-- FIX: Trigger handle_new_user — incluir ROLE en ON CONFLICT
-- 
-- Problema: Cuando se crea un usuario desde UserManagement,
--   el trigger crea el perfil con role='cajero' (default),
--   y el ON CONFLICT NO actualiza el role, causando que
--   el rol asignado por el admin se pierda.
--
-- Solución: Actualizar el ON CONFLICT para incluir el role.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role TEXT;
    user_name    TEXT;
    user_email   TEXT;
BEGIN
    user_email := NEW.email;
    user_name  := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    default_role := COALESCE(
        NEW.raw_user_meta_data->>'role',
        'cajero'
    );

    -- Insertar perfil con ON CONFLICT que SÍ actualiza el role
    INSERT INTO public.profiles (id, full_name, email, role, active)
    VALUES (NEW.id, user_name, user_email, default_role, true)
    ON CONFLICT (id) DO UPDATE SET
        full_name  = EXCLUDED.full_name,
        email      = EXCLUDED.email,
        role       = EXCLUDED.role,   -- ← FIX: ahora sí actualiza el rol
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Recrear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- VERIFICACIÓN
SELECT 'Trigger actualizado correctamente' AS status;
