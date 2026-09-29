begin;

-- Private configuration is set by the operator before enabling OAuth. Never put
-- this schema in PostgREST's exposed schemas. No model/provider secrets are used.
create schema if not exists rounza_private;
revoke all on schema rounza_private from public, anon, authenticated;
grant usage on schema rounza_private to authenticated;
create table rounza_private.mcp_settings (
  singleton boolean primary key default true check (singleton),
  resource text not null check (resource ~ '^https://[^/?#]+/mcp$' or resource ~ '^http://(localhost|127\.0\.0\.1):[0-9]+/mcp$')
);
revoke all on rounza_private.mcp_settings from public, anon, authenticated;

create table public.ai_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null,
  client_name text not null check (char_length(client_name) between 1 and 160),
  application_access text not null default 'selected' check (application_access in ('none','selected','all')),
  application_ids uuid[] not null default '{}' check (cardinality(application_ids) <= 500),
  resume_access text not null default 'none' check (resume_access in ('none','selected','all')),
  resume_ids uuid[] not null default '{}' check (cardinality(resume_ids) <= 500),
  activated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
alter table public.ai_connections enable row level security;
revoke all on public.ai_connections from public, anon, authenticated;
grant select, insert, update on public.ai_connections to authenticated;
grant all on public.ai_connections to service_role;
create policy owner_browser on public.ai_connections for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt()->>'client_id') is null)
  with check (user_id = (select auth.uid()) and (select auth.jwt()->>'client_id') is null);

create function rounza_private.validate_ai_connection() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id,new.user_id,new.client_id) is distinct from (old.id,old.user_id,old.client_id) then
      raise exception 'Connection identity cannot change' using errcode = '23514';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
    new.activated_at := case when old.revoked_at is not null and new.revoked_at is null
      then clock_timestamp() else old.activated_at end;
  else
    new.revision := 1;
    new.created_at := now();
    new.activated_at := clock_timestamp();
  end if;
  new.updated_at := now();
  if new.revoked_at is not null then new.revoked_at := clock_timestamp(); end if;
  if new.application_access <> 'selected' then new.application_ids := '{}'; end if;
  if new.resume_access <> 'selected' then new.resume_ids := '{}'; end if;
  -- Validate arrays with the caller's RLS, including null/foreign IDs. Deleted
  -- selections can be removed on the next edit; they never authorize other rows.
  if exists (select 1 from unnest(new.application_ids) x where x is null or not exists
      (select 1 from public.applications a where a.id=x and a.user_id=new.user_id)) or
     exists (select 1 from unnest(new.resume_ids) x where x is null or not exists
      (select 1 from public.resumes r where r.id=x and r.user_id=new.user_id)) then
    -- Revocation must remain possible even after a selected record was deleted.
    if new.revoked_at is null then
      raise exception 'Selected records are unavailable' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function rounza_private.validate_ai_connection() from public, anon, authenticated;
create trigger validate_ai_connection before insert or update on public.ai_connections
  for each row execute function rounza_private.validate_ai_connection();

-- A live Auth session is checked on every query. Token refresh cannot change
-- its creation date. Reactivation moves the cutoff, so old tokens stay denied
-- even if the provider revocation call failed or a refresh raced revocation.
create function rounza_private.current_ai_connection() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.ai_connections c
  join auth.sessions s on s.user_id=c.user_id and s.oauth_client_id=c.client_id
  join rounza_private.mcp_settings m on m.singleton
  where c.user_id=(select auth.uid()) and c.client_id::text=(select auth.jwt()->>'client_id')
    and s.id::text=(select auth.jwt()->>'session_id')
    and (select auth.jwt()->>'aud')=m.resource
    and (select auth.jwt()->>'role')='authenticated'
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
    and c.revoked_at is null and s.created_at >= c.activated_at
    and (s.not_after is null or s.not_after > now())
  limit 1;
$$;
create function rounza_private.ai_can_read(kind text, record_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ai_connections c
    where c.id=(select rounza_private.current_ai_connection()) and
    case kind
      when 'application' then c.application_access='all' or (c.application_access='selected' and record_id=any(c.application_ids))
      when 'resume' then c.resume_access='all' or (c.resume_access='selected' and record_id=any(c.resume_ids))
      else false end);
$$;
revoke all on function rounza_private.current_ai_connection(), rounza_private.ai_can_read(text,uuid) from public, anon;
grant execute on function rounza_private.current_ai_connection(), rounza_private.ai_can_read(text,uuid) to authenticated;
create function public.ai_connection_status() returns boolean
language sql stable security invoker set search_path = '' as $$
  select rounza_private.current_ai_connection() is not null;
$$;
revoke all on function public.ai_connection_status() from public, anon;
grant execute on function public.ai_connection_status() to authenticated;

-- Restrictive policies AND with the existing ownership policies. Adding another
-- permissive policy would leave the previous owner-only rules as a bypass.
do $$ declare tab text; key_column text; kind text; begin
  foreach tab in array array['profiles','applications','hiring_rounds','preparation_tasks','application_contacts','round_schedule_history','resumes','credential_vaults','portal_accounts','application_portals'] loop
    if tab in ('profiles','credential_vaults','portal_accounts','application_portals') then
      execute format('create policy browser_only on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''client_id'') is null) with check ((select auth.jwt()->>''client_id'') is null)',tab);
    else
      kind := case when tab='resumes' then 'resume' else 'application' end;
      key_column := case when tab in ('resumes','applications') then 'id' else 'application_id' end;
      execute format('create policy delegated_read on public.%I as restrictive for select to authenticated using ((select auth.jwt()->>''client_id'') is null or rounza_private.ai_can_read(%L,%I))',tab,kind,key_column);
      execute format('create policy browser_insert on public.%I as restrictive for insert to authenticated with check ((select auth.jwt()->>''client_id'') is null)',tab);
      execute format('create policy browser_update on public.%I as restrictive for update to authenticated using ((select auth.jwt()->>''client_id'') is null) with check ((select auth.jwt()->>''client_id'') is null)',tab);
      execute format('create policy browser_delete on public.%I as restrictive for delete to authenticated using ((select auth.jwt()->>''client_id'') is null)',tab);
    end if;
  end loop;
end $$;

-- Enable this function in Supabase Auth / Hooks AFTER setting mcp_settings.
-- Original required claims and browser sessions are preserved unchanged.
create function public.rounza_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare claims jsonb := event->'claims'; resource text;
begin
  if nullif(claims->>'client_id','') is not null then
    select m.resource into resource from rounza_private.mcp_settings m where m.singleton;
    if resource is null then
      return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','AI connections are not configured.'));
    end if;
    claims := jsonb_set(claims,'{aud}',to_jsonb(resource));
  end if;
  return jsonb_build_object('claims',claims);
end;
$$;
revoke all on function public.rounza_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.rounza_access_token_hook(jsonb) to supabase_auth_admin;
notify pgrst, 'reload schema';
commit;
