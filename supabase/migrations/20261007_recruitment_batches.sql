-- Batch membership and association changes are checked at transaction commit.
create table public.recruitment_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  color text not null default 'blue' check (color in ('blue','violet','teal','amber','rose','slate')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create unique index recruitment_batches_default on public.recruitment_batches(user_id) where is_default;
create index recruitment_batches_owner on public.recruitment_batches(user_id, created_at desc);
alter table public.recruitment_batches enable row level security;
create policy recruitment_batches_owner on public.recruitment_batches for all to authenticated
  using (auth.uid() = user_id and public.has_active_key(auth.uid()))
  with check (auth.uid() = user_id and public.has_active_key(auth.uid()));

insert into public.recruitment_batches(user_id, name, is_default)
select id, '默认批次', true from auth.users;
alter table public.resumes add column batch_id uuid;
alter table public.applications add column batch_id uuid;
update public.resumes r set batch_id = b.id from public.recruitment_batches b where b.user_id = r.user_id and b.is_default;
update public.applications a set batch_id = b.id from public.recruitment_batches b where b.user_id = a.user_id and b.is_default;
alter table public.resumes alter column batch_id set not null;
alter table public.applications alter column batch_id set not null;
alter table public.resumes add constraint resumes_batch_owner_fk foreign key(user_id,batch_id)
  references public.recruitment_batches(user_id,id) deferrable initially deferred;
alter table public.applications add constraint applications_batch_owner_fk foreign key(user_id,batch_id)
  references public.recruitment_batches(user_id,id) deferrable initially deferred;
alter table public.resumes add constraint resumes_batch_identity unique(user_id,batch_id,id);
alter table public.applications add constraint applications_same_batch_resume_fk foreign key(user_id,batch_id,resume_id)
  references public.resumes(user_id,batch_id,id) deferrable initially deferred;
create index resumes_batch on public.resumes(user_id,batch_id);
create index applications_batch on public.applications(user_id,batch_id);

-- Auth Admin API inserts invoke this once; deleting an empty final batch does not recreate it.
create function public.initialize_recruitment_batch() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.recruitment_batches(user_id,name,is_default) values(new.id,'默认批次',true);
  return new;
end $$;
create trigger initialize_recruitment_batch after insert on auth.users for each row execute function public.initialize_recruitment_batch();
revoke all on function public.initialize_recruitment_batch() from public, anon, authenticated;

-- Compatibility for older clients: infer explicit linked resume first, otherwise an existing batch.
create function public.compatible_batch_membership() returns trigger language plpgsql set search_path = public as $$
begin
  if new.batch_id is null then
    if tg_table_name = 'applications' then
      select batch_id into new.batch_id from public.resumes where id = new.resume_id and user_id = new.user_id;
    end if;
    if new.batch_id is null then
      select id into new.batch_id from public.recruitment_batches where user_id = new.user_id
        order by is_default desc, created_at limit 1;
    end if;
    if new.batch_id is null then raise exception '请先创建并选择批次'; end if;
  end if;
  return new;
end $$;
create trigger resumes_compatible_batch before insert on public.resumes for each row execute function public.compatible_batch_membership();
create trigger applications_compatible_batch before insert on public.applications for each row execute function public.compatible_batch_membership();

create function public.preview_batch_transfer(p_source uuid, p_target uuid, p_resumes uuid[], p_applications uuid[], p_mode text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_resumes uuid[]; v_apps uuid[]; v_copies uuid[]; v_result jsonb;
begin
  if v_user is null or not public.has_active_key(v_user) then raise exception '未登录或登录权限已失效'; end if;
  if p_mode not in ('move','copy','delete') then raise exception '无效操作'; end if;
  if not exists(select 1 from public.recruitment_batches where id=p_source and user_id=v_user) then raise exception '来源批次不存在'; end if;
  if p_target is not null and (p_target=p_source or not exists(select 1 from public.recruitment_batches where id=p_target and user_id=v_user)) then raise exception '请选择有效的目标批次'; end if;
  if p_mode='delete' then
    select coalesce(array_agg(id), '{}') into v_resumes from public.resumes where batch_id=p_source and user_id=v_user;
    select coalesce(array_agg(id), '{}') into v_apps from public.applications where batch_id=p_source and user_id=v_user;
  else
    v_resumes := coalesce(p_resumes,'{}'); v_apps := coalesce(p_applications,'{}');
    if cardinality(v_resumes)+cardinality(v_apps)=0 then raise exception '请先选择内容'; end if;
    if exists(select 1 from unnest(v_resumes) x where not exists(select 1 from public.resumes r where r.id=x and r.batch_id=p_source and r.user_id=v_user))
      or exists(select 1 from unnest(v_apps) x where not exists(select 1 from public.applications a where a.id=x and a.batch_id=p_source and a.user_id=v_user)) then
      raise exception '内容已变化，请刷新后重新选择';
    end if;
    if p_mode='copy' and cardinality(v_apps)>0 then raise exception '仅支持复制简历'; end if;
    if p_mode='move' then
      select coalesce(array_agg(distinct id),'{}') into v_apps from public.applications
        where user_id=v_user and batch_id=p_source and (id=any(v_apps) or resume_id=any(v_resumes));
    end if;
  end if;
  if p_target is null and (p_mode<>'delete' or cardinality(v_resumes)+cardinality(v_apps)>0) then raise exception '请选择接收内容的批次'; end if;
  if p_mode='copy' then v_copies:=v_resumes; v_resumes:='{}';
  elsif p_mode='move' then
    select coalesce(array_agg(distinct resume_id),'{}') into v_copies from public.applications
      where id=any(v_apps) and user_id=v_user and resume_id is not null and not(resume_id=any(v_resumes));
  else v_copies:='{}'; end if;
  select jsonb_build_object(
    'resumes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'updated_at',updated_at) order by id) from public.resumes where id=any(v_resumes) and user_id=v_user),'[]'),
    'applications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',company||' · '||position,'updated_at',updated_at,'resume_id',resume_id) order by id) from public.applications where id=any(v_apps) and user_id=v_user),'[]'),
    'copies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'updated_at',updated_at) order by id) from public.resumes where id=any(v_copies) and user_id=v_user),'[]'),
    'source',p_source,'target',p_target,'mode',p_mode
  ) into v_result;
  return v_result || jsonb_build_object('fingerprint',md5(v_result::text));
end $$;

-- Idempotency is persisted in the same transaction, including copies and deletion.
create table public.batch_transfer_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null, input jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(user_id,request_id)
);
alter table public.batch_transfer_receipts enable row level security;
create policy batch_receipts_select on public.batch_transfer_receipts for select to authenticated
  using(auth.uid()=user_id and public.has_active_key(auth.uid()));

create function public.execute_batch_transfer(p_source uuid,p_target uuid,p_resumes uuid[],p_applications uuid[],p_mode text,p_fingerprint text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid:=auth.uid(); v_plan jsonb; v_input jsonb; v_receipt public.batch_transfer_receipts;
  v_row public.resumes; v_new_id uuid; v_item jsonb;
begin
  if v_user is null or not public.has_active_key(v_user) then raise exception '未登录或登录权限已失效'; end if;
  if p_request_id is null then raise exception '缺少操作标识'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  v_input:=jsonb_build_object('source',p_source,'target',p_target,'resumes',p_resumes,'applications',p_applications,'mode',p_mode,'fingerprint',p_fingerprint);
  select * into v_receipt from public.batch_transfer_receipts where user_id=v_user and request_id=p_request_id;
  if found then
    if v_receipt.input<>v_input then raise exception '操作标识已被使用'; end if;
    return v_receipt.result;
  end if;
  perform 1 from public.recruitment_batches where user_id=v_user and id in(p_source,p_target) order by id for update;
  perform 1 from public.resumes where user_id=v_user and batch_id=p_source order by id for update;
  perform 1 from public.applications where user_id=v_user and batch_id=p_source order by id for update;
  v_plan:=public.preview_batch_transfer(p_source,p_target,p_resumes,p_applications,p_mode);
  if v_plan->>'fingerprint' is distinct from p_fingerprint then raise exception '关联内容已变化，请重新预览并确认'; end if;
  for v_item in select value from jsonb_array_elements(v_plan->'copies') loop
    select * into strict v_row from public.resumes where id=(v_item->>'id')::uuid and user_id=v_user;
    insert into public.resumes(user_id,batch_id,title,content,source,file_url,preview_url)
      values(v_user,p_target,v_row.title,v_row.content,'batch-copy:'||v_row.id::text,v_row.file_url,v_row.preview_url) returning id into v_new_id;
    if p_mode='move' then
      update public.applications set resume_id=v_new_id,batch_id=p_target,updated_at=now()
        where user_id=v_user and id in(select (x->>'id')::uuid from jsonb_array_elements(v_plan->'applications') x) and resume_id=v_row.id;
    end if;
  end loop;
  if p_mode<>'copy' then
    update public.resumes set batch_id=p_target,updated_at=now() where user_id=v_user and id in(select (x->>'id')::uuid from jsonb_array_elements(v_plan->'resumes') x);
    update public.applications set batch_id=p_target,updated_at=now() where user_id=v_user and id in(select (x->>'id')::uuid from jsonb_array_elements(v_plan->'applications') x);
  end if;
  if p_mode='delete' then delete from public.recruitment_batches where id=p_source and user_id=v_user; end if;
  insert into public.batch_transfer_receipts(user_id,request_id,input,result) values(v_user,p_request_id,v_input,v_plan);
  return v_plan;
end $$;

-- Preserve existing resume deletion semantics without leaving broken associations.
create function public.delete_resume_with_links(p_resume uuid) returns void language plpgsql security invoker set search_path=public as $$
begin
  update public.applications set resume_id=null,updated_at=now() where user_id=auth.uid() and resume_id=p_resume;
  delete from public.resumes where user_id=auth.uid() and id=p_resume;
end $$;
revoke all on function public.execute_batch_transfer(uuid,uuid,uuid[],uuid[],text,text,uuid) from public, anon;
revoke all on function public.preview_batch_transfer(uuid,uuid,uuid[],uuid[],text) from public, anon;
revoke all on function public.delete_resume_with_links(uuid) from public, anon;
grant execute on function public.execute_batch_transfer(uuid,uuid,uuid[],uuid[],text,text,uuid) to authenticated;
grant execute on function public.preview_batch_transfer(uuid,uuid,uuid[],uuid[],text) to authenticated;
grant execute on function public.delete_resume_with_links(uuid) to authenticated;
