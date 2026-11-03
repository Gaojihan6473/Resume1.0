-- Keep snapshots by default; explicit cleanup is atomic and restricted to the owner.
create function public.delete_resume_with_agent_history(p_resume uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.has_active_key(auth.uid()) then
    raise exception '未登录或凭证已停用' using errcode = '42501';
  end if;
  perform 1 from public.resumes where id = p_resume and user_id = auth.uid() for update;
  perform public.delete_resume_with_links(p_resume);
  delete from public.jd_analysis_records
    where user_id = auth.uid() and resume_id = p_resume and analysis_result->>'kind' = 'resume-agent';
end $$;

create function public.delete_application_with_agent_history(p_application uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.has_active_key(auth.uid()) then
    raise exception '未登录或凭证已停用' using errcode = '42501';
  end if;
  perform 1 from public.applications where id = p_application and user_id = auth.uid() for update;
  delete from public.applications where user_id = auth.uid() and id = p_application;
  delete from public.jd_analysis_records
    where user_id = auth.uid() and application_id = p_application and analysis_result->>'kind' = 'resume-agent';
end $$;

revoke all on function public.delete_resume_with_agent_history(uuid) from public, anon;
revoke all on function public.delete_application_with_agent_history(uuid) from public, anon;
grant execute on function public.delete_resume_with_agent_history(uuid) to authenticated;
grant execute on function public.delete_application_with_agent_history(uuid) to authenticated;

-- Serialize history inserts with source deletion, including late Agent responses.
-- Existing historical snapshots remain readable after their sources are removed.
create function public.check_analysis_history_sources() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.resumes where id = new.resume_id and user_id = new.user_id for key share;
  if not found then raise exception '分析来源简历已不存在' using errcode = '23503'; end if;
  if new.application_id is not null then
    perform 1 from public.applications where id = new.application_id and user_id = new.user_id for key share;
    if not found then raise exception '分析来源岗位已不存在' using errcode = '23503'; end if;
  end if;
  return new;
end $$;
revoke all on function public.check_analysis_history_sources() from public, anon, authenticated;
create trigger check_analysis_history_sources before insert on public.jd_analysis_records
for each row execute function public.check_analysis_history_sources();
