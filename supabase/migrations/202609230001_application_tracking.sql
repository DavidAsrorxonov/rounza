begin;

alter table public.applications add column revision integer not null default 1 check (revision > 0);

create function public.advance_application_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function public.advance_application_revision() from public, anon, authenticated;
create trigger applications_revision before update on public.applications
  for each row execute function public.advance_application_revision();

-- Bound text parameters give literal, case-insensitive substring search, even
-- for punctuation, SQL wildcards, or PostgREST filter syntax in a company name.
-- SECURITY INVOKER retains the caller's RLS and table privileges.
create function public.search_applications(search_term text default '', status_filter public.application_status default null)
returns setof public.applications language sql stable security invoker set search_path = '' as $$
  select * from public.applications
  where user_id = (select auth.uid())
    and (status_filter is null or status = status_filter)
    and (search_term = '' or position(lower(search_term) in lower(company || ' ' || role || ' ' || location)) > 0);
$$;
revoke all on function public.search_applications(text, public.application_status) from public, anon;
grant execute on function public.search_applications(text, public.application_status) to authenticated;

notify pgrst, 'reload schema';
commit;
