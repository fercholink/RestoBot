-- 1. Tabla de Jobs de Marketing
create table if not exists public.marketing_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid, -- Lo dejamos opcional por ahora si aún no migramos Auth completo
  status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  prompt text not null,
  platform text,
  target_audience text,
  image_product_url text,
  result_url text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Habilitar Realtime
alter publication supabase_realtime add table public.marketing_jobs;

-- 3. Políticas de Seguridad (RLS) - Permisivas por ahora para facilitar la demo
alter table public.marketing_jobs enable row level security;

create policy "Permitir acceso anonimo para demo"
on public.marketing_jobs
for all
using (true)
with check (true);

-- 4. Bucket de Storage para imágenes
insert into storage.buckets (id, name, public) 
values ('marketing-assets', 'marketing-assets', true)
on conflict (id) do nothing;

create policy "Imagenes publicas" 
on storage.objects for select 
using ( bucket_id = 'marketing-assets' );

create policy "Permitir subida anonima demo" 
on storage.objects for insert 
with check ( bucket_id = 'marketing-assets' );
