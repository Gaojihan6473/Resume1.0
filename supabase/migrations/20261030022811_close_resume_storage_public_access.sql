-- Storage policies are permissive (OR-combined). A private bucket alone does
-- not protect files while an older public SELECT policy still exists.
update storage.buckets set public = false where id = 'resumes';

drop policy if exists "Public can view resumes" on storage.objects;
drop policy if exists "Users can view own resumes" on storage.objects;
drop policy if exists "Users can upload resumes" on storage.objects;
drop policy if exists "Users can update own resumes" on storage.objects;
drop policy if exists "Users can delete own resumes" on storage.objects;

-- Preserve legacy previews/<resume-id>.png access for their resume's owner.
-- Compare the complete path rather than relying on an escaped suffix regex.
create or replace function public.can_access_resume_storage_object(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if object_name is null or auth.uid() is null or not public.has_active_key(auth.uid()) then
    return false;
  end if;

  if split_part(object_name, '/', 1) = auth.uid()::text then
    return true;
  end if;

  return exists (
    select 1 from public.resumes r
    where r.user_id = auth.uid()
      and object_name = 'previews/' || r.id::text || '.png'
  );
end;
$$;

-- Supabase default privileges can grant anon EXECUTE explicitly, so revoking
-- PUBLIC alone does not necessarily remove anonymous access.
revoke all on function public.has_active_key(uuid) from public, anon;
revoke all on function public.can_access_resume_storage_object(text) from public, anon;
grant execute on function public.has_active_key(uuid) to authenticated, service_role;
grant execute on function public.can_access_resume_storage_object(text) to authenticated, service_role;

drop policy if exists resumes_storage_select on storage.objects;
drop policy if exists resumes_storage_insert on storage.objects;
drop policy if exists resumes_storage_update on storage.objects;
drop policy if exists resumes_storage_delete on storage.objects;

create policy resumes_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.can_access_resume_storage_object(name));
create policy resumes_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and split_part(name, '/', 1) = auth.uid()::text and public.has_active_key(auth.uid()));
create policy resumes_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and public.can_access_resume_storage_object(name))
  with check (bucket_id = 'resumes' and split_part(name, '/', 1) = auth.uid()::text and public.has_active_key(auth.uid()));
create policy resumes_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and public.can_access_resume_storage_object(name));
