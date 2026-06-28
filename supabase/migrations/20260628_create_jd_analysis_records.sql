create extension if not exists pgcrypto;

create table if not exists public.jd_analysis_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null,
  application_id uuid,
  title text not null default '未命名JD分析',
  jd_text_snapshot text not null default '',
  jd_hash text not null,
  resume_text_snapshot text not null default '',
  resume_hash text not null,
  resume_title_snapshot text not null default '',
  company_snapshot text not null default '',
  position_snapshot text not null default '',
  analysis_result jsonb,
  status text not null default 'success' check (status in ('success', 'failed', 'running')),
  error_message text,
  model text not null,
  prompt_version text not null,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jd_analysis_records_user_resume
  on public.jd_analysis_records(user_id, resume_id, created_at desc);

create index if not exists idx_jd_analysis_records_application
  on public.jd_analysis_records(user_id, application_id, created_at desc);

create index if not exists idx_jd_analysis_records_match
  on public.jd_analysis_records(user_id, resume_id, application_id, resume_hash, jd_hash, model, prompt_version);

alter table public.jd_analysis_records enable row level security;

drop policy if exists jd_analysis_records_owner_select on public.jd_analysis_records;
drop policy if exists jd_analysis_records_owner_insert on public.jd_analysis_records;
drop policy if exists jd_analysis_records_owner_update on public.jd_analysis_records;
drop policy if exists jd_analysis_records_owner_delete on public.jd_analysis_records;

create policy jd_analysis_records_owner_select
  on public.jd_analysis_records for select
  to authenticated
  using (auth.uid() = user_id and public.has_active_key(auth.uid()));

create policy jd_analysis_records_owner_insert
  on public.jd_analysis_records for insert
  to authenticated
  with check (auth.uid() = user_id and public.has_active_key(auth.uid()));

create policy jd_analysis_records_owner_update
  on public.jd_analysis_records for update
  to authenticated
  using (auth.uid() = user_id and public.has_active_key(auth.uid()))
  with check (auth.uid() = user_id and public.has_active_key(auth.uid()));

create policy jd_analysis_records_owner_delete
  on public.jd_analysis_records for delete
  to authenticated
  using (auth.uid() = user_id and public.has_active_key(auth.uid()));
