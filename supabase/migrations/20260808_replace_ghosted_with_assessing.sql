-- “无回音”状态已从产品流程中移除；历史记录回归“已投递”。
update public.applications
set status = 'applied'
where status = 'ghosted';

-- 移除旧的单字段状态检查约束（兼容不同的约束名称）。
do $$
declare
  status_constraint record;
begin
  for status_constraint in
    select constraint_info.conname
    from pg_constraint as constraint_info
    join pg_class as table_info
      on table_info.oid = constraint_info.conrelid
    join pg_namespace as schema_info
      on schema_info.oid = table_info.relnamespace
    join pg_attribute as column_info
      on column_info.attrelid = table_info.oid
      and column_info.attname = 'status'
    where schema_info.nspname = 'public'
      and table_info.relname = 'applications'
      and constraint_info.contype = 'c'
      and constraint_info.conkey = array[column_info.attnum]::smallint[]
  loop
    execute format(
      'alter table public.applications drop constraint %I',
      status_constraint.conname
    );
  end loop;
end
$$;

alter table public.applications
  add constraint applications_status_check
  check (status in ('interested', 'applied', 'assessing', 'interviewing', 'offered', 'rejected'));
