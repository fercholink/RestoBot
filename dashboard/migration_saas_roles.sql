-- 1. Crear Tabla de Roles Dinámicos
-- Permite que cada organización defina sus propios roles y permisos
create table if not exists public.roles (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  organization_id uuid references public.organizations(id),
  permissions jsonb default '{}'::jsonb, -- Definición de qué puede hacer
  is_system boolean default false, -- Roles que no se pueden borrar (Admin, etc)
  created_at timestamptz default now()
);

-- 2. Seguridad RLS
alter table public.roles enable row level security;

-- Ver roles: Solo los de mi organización
create policy "Ver roles de mi organizacion" on public.roles
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid()) 
    OR is_system = true -- Permitir ver roles base del sistema
  );

-- Gestionar roles: Solo admins/gerentes de la organización
create policy "Gestionar roles de mi organizacion" on public.roles
  for all using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    AND (select role from profiles where id = auth.uid()) IN ('admin', 'gerente')
  );

-- 3. Insertar Roles por Defecto (Plantillas)
-- Se asignan a la organización por defecto creada anteriormente
DO $$
DECLARE
    org_id uuid;
BEGIN
    SELECT id INTO org_id FROM public.organizations LIMIT 1;

    -- Solo insertar si no existen
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE organization_id = org_id) THEN
        INSERT INTO public.roles (name, description, organization_id, is_system, permissions) VALUES
        ('Administrador', 'Acceso total al sistema', org_id, true, '{"all": true}'),
        ('Gerente', 'Gestión de recursos y reportes', org_id, true, '{"restaurante": true, "hotel": true, "financiero": true, "usuarios": true}'),
        ('Cajero', 'Facturación y Cuadre de Caja', org_id, false, '{"restaurante": true, "financiero": {"read": true, "create": true}}'),
        ('Mesero', 'Toma de pedidos y atención', org_id, false, '{"restaurante": {"read": true, "create": true, "update": true}}'),
        ('Chef de Cocina', 'Gestión de comanda y recetas', org_id, false, '{"restaurante": {"read": true, "update": true}, "inventario": true}'),
        ('Recepcionista', 'Check-in, Check-out y Reservas', org_id, false, '{"hotel": true, "reservas": true, "financiero": {"create": true}}'),
        ('Ama de Llaves', 'Estado de habitaciones y limpieza', org_id, false, '{"hotel": {"read": true, "update": true}}');
    END IF;
END $$;
