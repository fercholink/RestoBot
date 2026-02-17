-- 0. Crear Tipos Enumerados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type_enum') THEN
        CREATE TYPE public.plan_type_enum AS ENUM ('free', 'pro', 'enterprise');
    END IF;
END $$;

-- 1. Tabla de Organizaciones / Empresas
-- Esta será la tabla principal para identificar al cliente.
create table if not exists public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users(id), -- Dueño original
  contact_email text,
  plan public.plan_type_enum default 'free', -- Requires enum type to be created if not exists
  status text default 'active' check (status in ('active', 'suspended', 'cancelled')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Habilitar RLS en organizaciones
alter table public.organizations enable row level security;

-- 3. Políticas de acceso a organizaciones
-- El usuario solo ve SU organización
create policy "Users can view own organization" on public.organizations
  for select using (auth.uid() = owner_id);

-- 4. Modificar perfiles para pertenecer a una organización
alter table public.profiles 
add column if not exists organization_id uuid references public.organizations(id);

-- 5. Crear índice para búsquedas rápidas por organización
create index if not exists idx_profiles_organization_id on public.profiles(organization_id);

-- TODO: Rellenar con datos existentes (si aplica)
-- Por ahora, todos los usuarios existentes podrían asignarse a una organización "Default" manualmente.

-- 6. Función para crear organización automáticamente al registrarse (Primer usuario)
-- Trigger after insert on auth.users -> create organization
create or replace function public.handle_new_organization()
returns trigger as $$
begin
  -- Solo crea organización si es el primer usuario o mediante un flag en metadata
  -- Por ahora, dejémoslo manual o vía API de registro.
  return new;
end;
$$ language plpgsql security definer;
