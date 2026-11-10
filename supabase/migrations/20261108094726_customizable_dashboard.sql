-- Version matches the applied migration history in the runtime project.
-- One document per account; only explicit saves create/update a row.
create table public.dashboard_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null check (
    jsonb_typeof(config) = 'object' and config ?& array['version','widgets'] and config->>'version' = '1'
    and jsonb_typeof(config->'widgets') = 'array'
  ),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_configs enable row level security;
revoke all on public.dashboard_configs from public, anon;
grant select, insert, update on public.dashboard_configs to authenticated;
create policy dashboard_configs_owner on public.dashboard_configs for all to authenticated
  using ((select auth.uid()) = user_id and public.has_active_key((select auth.uid())))
  with check ((select auth.uid()) = user_id and public.has_active_key((select auth.uid())));

-- Invoker permissions preserve RLS. Conditional update is atomic across devices.
create function public.save_dashboard_config(p_config jsonb, p_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_row public.dashboard_configs;
begin
  if v_owner is null or not public.has_active_key(v_owner) then
    raise exception '登录已失效或密钥已停用' using errcode = '42501';
  end if;
  if p_revision = 0 then
    begin
      insert into public.dashboard_configs(user_id,config) values(v_owner,p_config) returning * into v_row;
    exception when unique_violation then
      raise exception '看板已在其他窗口更新，请重新加载' using errcode = '40001';
    end;
  else
    update public.dashboard_configs set config=p_config,revision=revision+1,updated_at=now()
      where user_id=v_owner and revision=p_revision returning * into v_row;
    if not found then
      raise exception '看板已在其他窗口更新，请重新加载' using errcode = '40001';
    end if;
  end if;
  return jsonb_build_object('config',v_row.config,'revision',v_row.revision);
end $$;
revoke all on function public.save_dashboard_config(jsonb,integer) from public,anon;
grant execute on function public.save_dashboard_config(jsonb,integer) to authenticated;
