-- Cascade Tech: run this once in Supabase -> SQL Editor.
-- BEFORE running: replace admin@example.com below with YOUR admin email.

-- 1. Table that lists every material --------------------------------------
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  category    text not null,
  access      text not null default 'free' check (access in ('free', 'premium')),
  file_path   text not null,
  file_name   text not null,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

-- 2. Who counts as admin --------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'admin@example.com'
$$;

-- 3. Row rules for the table: everyone reads, only the admin writes --------
alter table public.resources enable row level security;

drop policy if exists "Anyone can read resources" on public.resources;
drop policy if exists "Admin can add resources" on public.resources;
drop policy if exists "Admin can edit resources" on public.resources;
drop policy if exists "Admin can delete resources" on public.resources;

create policy "Anyone can read resources" on public.resources
  for select using (true);
create policy "Admin can add resources" on public.resources
  for insert with check (public.is_admin());
create policy "Admin can edit resources" on public.resources
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete resources" on public.resources
  for delete using (public.is_admin());

-- 4. File storage bucket (public downloads, 50 MB limit) -------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', true, 52428800)
on conflict (id) do nothing;

drop policy if exists "Anyone can download resource files" on storage.objects;
drop policy if exists "Admin can upload resource files" on storage.objects;
drop policy if exists "Admin can replace resource files" on storage.objects;
drop policy if exists "Admin can delete resource files" on storage.objects;

create policy "Anyone can download resource files" on storage.objects
  for select using (bucket_id = 'resources');
create policy "Admin can upload resource files" on storage.objects
  for insert with check (bucket_id = 'resources' and public.is_admin());
create policy "Admin can replace resource files" on storage.objects
  for update using (bucket_id = 'resources' and public.is_admin());
create policy "Admin can delete resource files" on storage.objects
  for delete using (bucket_id = 'resources' and public.is_admin());
