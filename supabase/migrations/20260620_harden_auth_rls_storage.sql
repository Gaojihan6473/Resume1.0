create extension if not exists pgcrypto;

create table if not exists public.valid_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  key_name text not null,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_valid_keys_key_hash on public.valid_keys(key_hash);
create index if not exists idx_valid_keys_user_active on public.valid_keys(user_id, is_active);

alter table public.valid_keys enable row level security;
revoke all on public.valid_keys from anon, authenticated;

create or replace function public.has_active_key(user_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select user_uuid is not null
    and user_uuid = auth.uid()
    and exists (
      select 1
      from public.valid_keys
      where user_id = user_uuid
        and is_active = true
    );
$$;

revoke all on function public.has_active_key(uuid) from public;
grant execute on function public.has_active_key(uuid) to authenticated, service_role;

create or replace function public.can_access_resume_storage_object(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  legacy_resume_id text;
  legacy_allowed boolean;
begin
  if object_name is null or auth.uid() is null or not public.has_active_key(auth.uid()) then
    return false;
  end if;

  if split_part(object_name, '/', 1) = auth.uid()::text then
    return true;
  end if;

  if object_name like 'previews/%.png' and to_regclass('public.resumes') is not null then
    legacy_resume_id := regexp_replace(split_part(object_name, '/', 2), '\.png$', '');
    execute 'select exists(select 1 from public.resumes where id::text = $1 and user_id = $2)'
      into legacy_allowed
      using legacy_resume_id, auth.uid();
    return coalesce(legacy_allowed, false);
  end if;

  return false;
end;
$$;

revoke all on function public.can_access_resume_storage_object(text) from public;
grant execute on function public.can_access_resume_storage_object(text) to authenticated, service_role;

alter table if exists public.resumes
  add column if not exists file_url text;

alter table if exists public.resumes
  add column if not exists preview_url text;

do $$
begin
  if to_regclass('public.resumes') is not null then
    execute 'alter table public.resumes enable row level security';

    execute 'drop policy if exists resumes_owner_select on public.resumes';
    execute 'drop policy if exists resumes_owner_insert on public.resumes';
    execute 'drop policy if exists resumes_owner_update on public.resumes';
    execute 'drop policy if exists resumes_owner_delete on public.resumes';
    execute 'drop policy if exists resumes_owner_rw on public.resumes';

    execute 'create policy resumes_owner_select on public.resumes for select to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy resumes_owner_insert on public.resumes for insert to authenticated with check (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy resumes_owner_update on public.resumes for update to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid())) with check (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy resumes_owner_delete on public.resumes for delete to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid()))';
  end if;
end $$;

do $$
begin
  if to_regclass('public.applications') is not null then
    execute 'alter table public.applications enable row level security';

    execute 'drop policy if exists applications_owner_select on public.applications';
    execute 'drop policy if exists applications_owner_insert on public.applications';
    execute 'drop policy if exists applications_owner_update on public.applications';
    execute 'drop policy if exists applications_owner_delete on public.applications';
    execute 'drop policy if exists applications_owner_rw on public.applications';
    execute 'drop policy if exists "Users can CRUD own applications" on public.applications';

    execute 'create policy applications_owner_select on public.applications for select to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy applications_owner_insert on public.applications for insert to authenticated with check (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy applications_owner_update on public.applications for update to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid())) with check (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy applications_owner_delete on public.applications for delete to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid()))';
  end if;
end $$;

do $$
begin
  if to_regclass('public.user_profiles') is not null then
    execute 'alter table public.user_profiles enable row level security';

    execute 'drop policy if exists profiles_owner_select on public.user_profiles';
    execute 'drop policy if exists profiles_owner_insert on public.user_profiles';
    execute 'drop policy if exists profiles_owner_update on public.user_profiles';
    execute 'drop policy if exists profiles_owner_delete on public.user_profiles';
    execute 'drop policy if exists profiles_owner_rw on public.user_profiles';

    execute 'create policy profiles_owner_select on public.user_profiles for select to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy profiles_owner_insert on public.user_profiles for insert to authenticated with check (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy profiles_owner_update on public.user_profiles for update to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid())) with check (auth.uid() = user_id and public.has_active_key(auth.uid()))';
    execute 'create policy profiles_owner_delete on public.user_profiles for delete to authenticated using (auth.uid() = user_id and public.has_active_key(auth.uid()))';
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;

do $$
begin
  execute 'drop policy if exists resumes_storage_select on storage.objects';
  execute 'drop policy if exists resumes_storage_insert on storage.objects';
  execute 'drop policy if exists resumes_storage_update on storage.objects';
  execute 'drop policy if exists resumes_storage_delete on storage.objects';

  execute 'create policy resumes_storage_select on storage.objects for select to authenticated using (bucket_id = ''resumes'' and public.can_access_resume_storage_object(name))';
  execute 'create policy resumes_storage_insert on storage.objects for insert to authenticated with check (bucket_id = ''resumes'' and split_part(name, ''/'', 1) = auth.uid()::text and public.has_active_key(auth.uid()))';
  execute 'create policy resumes_storage_update on storage.objects for update to authenticated using (bucket_id = ''resumes'' and public.can_access_resume_storage_object(name)) with check (bucket_id = ''resumes'' and split_part(name, ''/'', 1) = auth.uid()::text and public.has_active_key(auth.uid()))';
  execute 'create policy resumes_storage_delete on storage.objects for delete to authenticated using (bucket_id = ''resumes'' and public.can_access_resume_storage_object(name))';
end $$;
