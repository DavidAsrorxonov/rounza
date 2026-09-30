begin;

alter table public.ai_connections add column allow_proposals boolean not null default false;
create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.ai_connections(id) on delete cascade,
  connection_activated_at timestamptz not null,
  oauth_session_id uuid not null,
  client_name text not null,
  idempotency_key uuid not null,
  title text not null,
  summary text not null,
  request jsonb not null check (octet_length(request::text) <= 220000),
  changes jsonb not null check (jsonb_array_length(changes) between 1 and 10),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  decided_at timestamptz,
  result jsonb not null default '[]',
  unique(connection_id,idempotency_key)
);
create index proposals_owner_status on public.ai_proposals(user_id,status,created_at desc,id);
alter table public.ai_proposals enable row level security;
revoke all on public.ai_proposals from public, anon, authenticated;
grant select on public.ai_proposals to authenticated;
grant all on public.ai_proposals to service_role;
create policy owner_browser_read on public.ai_proposals for select to authenticated
  using (user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);

-- Fixed allowlists are shared by staging, validation, snapshots and application.
-- These helpers are private and not executable by either browser or OAuth clients.
create function rounza_private.proposal_table(entity text) returns text
language sql immutable set search_path = '' as $$
  select case entity when 'application' then 'applications' when 'round' then 'hiring_rounds'
    when 'task' then 'preparation_tasks' when 'contact' then 'application_contacts' when 'resume' then 'resumes' end;
$$;
create function rounza_private.proposal_defaults(entity text) returns jsonb
language sql immutable set search_path = '' as $$
  select case entity
    when 'application' then '{"company":"","role":"","status":"Saved","location":"","job_url":null,"applied_on":null,"description":"","notes":""}'::jsonb
    when 'round' then '{"title":"","kind":"Interview","status":"Planned","position":1,"scheduled_at":null,"time_zone":"UTC","duration_minutes":60,"due_on":null,"meeting_url":null,"location":"","people":"","notes":"","schedule_note":""}'::jsonb
    when 'task' then '{"title":"","round_id":null,"due_on":null,"completed":false,"notes":""}'::jsonb
    when 'contact' then '{"name":"","role":"","email":"","phone":"","notes":""}'::jsonb
    when 'resume' then '{"name":"","body":""}'::jsonb end;
$$;
create function rounza_private.validate_proposal_data(entity text, data jsonb) returns void
language plpgsql set search_path = '' as $$
declare k text; v jsonb; limits jsonb; limit_n integer; required_fields text[];
begin
  limits := case entity
    when 'application' then '{"company":160,"role":200,"location":200,"description":50000,"notes":20000}'::jsonb
    when 'round' then '{"title":200,"time_zone":100,"location":300,"people":500,"notes":20000,"schedule_note":1000}'::jsonb
    when 'task' then '{"title":200,"notes":10000}'::jsonb
    when 'contact' then '{"name":160,"role":200,"email":254,"phone":80,"notes":5000}'::jsonb
    when 'resume' then '{"name":160,"body":100000}'::jsonb end;
  required_fields := case entity when 'application' then array['company','role'] when 'resume' then array['name','body'] when 'contact' then array['name'] else array['title'] end;
  for k,v in select * from jsonb_each(data) loop
    if v='null'::jsonb then
      if k not in ('job_url','applied_on','scheduled_at','due_on','meeting_url','round_id') then raise exception 'Null field' using errcode='22023'; end if;
      continue;
    end if;
    if k in ('position','duration_minutes') then
      if jsonb_typeof(v)<>'number' or (v::text)::numeric <> trunc((v::text)::numeric) then raise exception 'Invalid number' using errcode='22023'; end if;
    elsif k='completed' then
      if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid boolean' using errcode='22023'; end if;
    elsif jsonb_typeof(v)<>'string' then raise exception 'Invalid text' using errcode='22023';
    end if;
    limit_n := (limits->>k)::integer;
    if limit_n is not null and char_length(data->>k)>limit_n then raise exception 'Text too long' using errcode='22023'; end if;
    if k=any(required_fields) and ((data->>k)!~'[^[:space:]]' or (data->>k)<>btrim(data->>k)) then raise exception 'Required field' using errcode='22023'; end if;
    if k in ('job_url','meeting_url') and (char_length(data->>k)>2048 or (data->>k)!~'^https?://[^[:space:]]+$' or (data->>k)~*'^https?://[^/?#]*@' or position(chr(92) in (data->>k))>0) then raise exception 'Unsafe URL' using errcode='22023'; end if;
    if k in ('applied_on','due_on') then
      if (data->>k)!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (data->>k)::date not between '0001-01-01'::date and '9999-12-31'::date then raise exception 'Invalid date' using errcode='22023'; end if;
    end if;
    if k='round_id' then perform (data->>k)::uuid; end if;
  end loop;
  if entity='application' and data->>'status' not in ('Saved','Applied','Interviewing','Offer','Rejected','Withdrawn') then raise exception 'Invalid status' using errcode='22023'; end if;
  if entity='round' then
    if data->>'kind' not in ('Interview','Assessment','Other') or data->>'status' not in ('Planned','Scheduled','Completed','Cancelled') or
      (data->>'position')::integer not between 1 and 999 or (data->>'duration_minutes')::integer not between 5 and 1440 or
      not exists(select 1 from pg_catalog.pg_timezone_names where name=data->>'time_zone') then raise exception 'Invalid round' using errcode='22023'; end if;
    if data->>'scheduled_at' is not null then
      if (data->>'scheduled_at') !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' or (data->>'scheduled_at')::timestamptz < '0001-01-01'::timestamptz or (data->>'scheduled_at')::timestamptz >= '10000-01-01'::timestamptz then raise exception 'Invalid instant' using errcode='22023'; end if;
    end if;
    if (data->>'status'='Planned' and data->>'scheduled_at' is not null) or (data->>'status'='Scheduled' and data->>'scheduled_at' is null) then raise exception 'Invalid schedule' using errcode='22023'; end if;
  end if;
end;
$$;

-- Build immutable before/after snapshots from owned, currently permitted rows.
-- Creating a parent before its children permits a whole new journey in one batch.
create function rounza_private.compile_proposal(c public.ai_connections, changes jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare op jsonb; entity text; tab text; id uuid; parent uuid; row_data jsonb; before_data jsonb; after_data jsonb;
  defaults jsonb; parent_revision integer; parent_label text; expected integer; output jsonb:='[]'; seen uuid[]:='{}'; new_apps uuid[]:='{}'; new_rounds jsonb:='{}';
begin
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 10 then raise exception 'Invalid changes' using errcode='22023'; end if;
  for op in select * from jsonb_array_elements(changes) loop
    entity:=op->>'entity'; tab:=rounza_private.proposal_table(entity); defaults:=rounza_private.proposal_defaults(entity);
    if tab is null or jsonb_typeof(op) is distinct from 'object' or op->>'action' is null or op->>'action' not in ('create','update') or
       exists(select 1 from jsonb_object_keys(op) k where k not in ('entity','action','record_id','expected_revision','application_id','data')) or
       jsonb_typeof(op->'data') is distinct from 'object' or op->'data'='{}'::jsonb or
       exists(select 1 from jsonb_object_keys(op->'data') k where not defaults ? k) then raise exception 'Invalid change' using errcode='22023'; end if;
    id:=(op->>'record_id')::uuid; parent:=(op->>'application_id')::uuid; expected:=(op->>'expected_revision')::integer;
    if id is null or id=any(seen) or (op->>'action'='create' and expected is not null) or (op->>'action'='update' and (expected is null or expected<1)) then raise exception 'Invalid identity or revision' using errcode='22023'; end if;
    seen:=array_append(seen,id); parent_revision:=null; parent_label:=null;
    if entity in ('application','resume') and parent is not null then raise exception 'Invalid parent' using errcode='22023'; end if;
    if entity='resume' then
      if not (c.resume_access='all' or (op->>'action'='update' and c.resume_access='selected' and id=any(c.resume_ids))) then raise exception 'Outside connection permissions' using errcode='42501'; end if;
    elsif entity='application' then
      if not (c.application_access='all' or (op->>'action'='update' and c.application_access='selected' and id=any(c.application_ids))) then raise exception 'Outside connection permissions' using errcode='42501'; end if;
    else
      if parent is null or not (c.application_access='all' or (c.application_access='selected' and parent=any(c.application_ids))) then raise exception 'Outside connection permissions' using errcode='42501'; end if;
      if not parent=any(new_apps) then
        select revision,company || ' — ' || role into parent_revision,parent_label from public.applications where user_id=c.user_id and public.applications.id=parent;
        if not found then raise exception 'Parent unavailable' using errcode='40001'; end if;
      else
        select (v->'after'->>'company') || ' — ' || (v->'after'->>'role') into parent_label from jsonb_array_elements(output) v where (v->>'record_id')::uuid=parent;
      end if;
    end if;
    execute format('select to_jsonb(t) from public.%I t where t.id=$1 and t.user_id=$2',tab) into row_data using id,c.user_id;
    if op->>'action'='update' then
      if row_data is null or (row_data->>'revision')::integer<>expected or (entity in ('round','task','contact') and (row_data->>'application_id')::uuid<>parent) then raise exception 'Source changed or unavailable' using errcode='40001'; end if;
      select jsonb_object_agg(k,row_data->k) into before_data from jsonb_object_keys(defaults) k;
      after_data:=before_data || (op->'data');
    else
      if row_data is not null then raise exception 'Record already exists' using errcode='40001'; end if;
      before_data:=null; after_data:=defaults || (op->'data');
      if entity='application' then new_apps:=array_append(new_apps,id); end if;
      if entity='round' then new_rounds:=new_rounds || jsonb_build_object(id::text,parent); end if;
    end if;
    perform rounza_private.validate_proposal_data(entity,after_data);
    if entity='task' and after_data->>'round_id' is not null then
      if (new_rounds->>(after_data->>'round_id'))::uuid is distinct from parent and not exists(select 1 from public.hiring_rounds r where r.user_id=c.user_id and r.id=(after_data->>'round_id')::uuid and r.application_id=parent) then raise exception 'Round unavailable' using errcode='40001'; end if;
    end if;
    output:=output || jsonb_build_array(op || jsonb_build_object('before',before_data,'after',after_data,'application_revision',parent_revision,'application_label',parent_label));
  end loop;
  return output;
end;
$$;

create function public.submit_ai_proposal(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.ai_connections; prior public.ai_proposals; compiled jsonb; proposal_id uuid;
begin
  select * into c from public.ai_connections where id=rounza_private.current_ai_connection() for update;
  if not found or not c.allow_proposals then raise exception 'Proposal permission required' using errcode='42501'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>220000 or
    exists(select 1 from jsonb_object_keys(payload) k where k not in ('idempotency_key','title','summary','changes')) or
    jsonb_typeof(payload->'title') is distinct from 'string' or char_length(btrim(payload->>'title')) not between 1 and 160 or
    jsonb_typeof(payload->'summary') is distinct from 'string' or char_length(btrim(payload->>'summary')) not between 1 and 2000 or
    payload->>'idempotency_key' is null then raise exception 'Invalid proposal' using errcode='22023'; end if;
  select * into prior from public.ai_proposals where connection_id=c.id and idempotency_key=(payload->>'idempotency_key')::uuid;
  if found then
    if prior.request<>payload or prior.connection_activated_at<>c.activated_at then raise exception 'Idempotency key already used' using errcode='22023'; end if;
    return prior.id;
  end if;
  if (select count(*) from public.ai_proposals where connection_id=c.id and status='pending' and expires_at>now())>=50 then raise exception 'Review pending proposals first' using errcode='22023'; end if;
  compiled:=rounza_private.compile_proposal(c,payload->'changes');
  insert into public.ai_proposals(user_id,connection_id,connection_activated_at,oauth_session_id,client_name,idempotency_key,title,summary,request,changes)
    values(c.user_id,c.id,c.activated_at,(auth.jwt()->>'session_id')::uuid,c.client_name,(payload->>'idempotency_key')::uuid,btrim(payload->>'title'),btrim(payload->>'summary'),payload,compiled) returning id into proposal_id;
  return proposal_id;
end;
$$;

-- Only status/receipts are returned to the submitting connection; never stored
-- snapshots, which could otherwise outlive a reduction in record permissions.
create function public.ai_proposal_status(proposal_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.ai_proposals; c public.ai_connections;
begin
  select * into c from public.ai_connections where id=rounza_private.current_ai_connection();
  if not found or not c.allow_proposals then raise exception 'Proposal permission required' using errcode='42501'; end if;
  select * into p from public.ai_proposals where id=proposal_id and connection_id=c.id and user_id=c.user_id and connection_activated_at=c.activated_at;
  if not found then raise exception 'Proposal unavailable' using errcode='42501'; end if;
  return jsonb_build_object('id',p.id,'status',case when p.status='pending' and p.expires_at<=now() then 'expired' else p.status end,'created_at',p.created_at,'decided_at',p.decided_at,'expires_at',p.expires_at);
end;
$$;

create function public.decide_ai_proposal(proposal_id uuid, expected_revision integer, decision text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.ai_proposals; c public.ai_connections; op jsonb; tab text; cols text; values_cols text; record_data jsonb; receipt jsonb:='[]'; rev integer;
begin
  if auth.uid() is null or auth.jwt()->>'client_id' is not null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception 'Website session required' using errcode='42501'; end if;
  -- The grant is always locked before the proposal, matching submit's lock order.
  select ac.* into c from public.ai_connections ac join public.ai_proposals ap on ap.connection_id=ac.id where ap.id=proposal_id and ap.user_id=auth.uid() for update of ac;
  select * into p from public.ai_proposals where id=proposal_id and user_id=auth.uid() for update;
  if not found then raise exception 'Proposal unavailable' using errcode='42501'; end if;
  if decision is null or decision not in ('approve','reject') then raise exception 'Invalid decision' using errcode='22023'; end if;
  if p.status=(case decision when 'approve' then 'approved' else 'rejected' end) then return p.result; end if;
  if p.status<>'pending' or expected_revision is null or p.revision<>expected_revision then raise exception 'Proposal already decided' using errcode='40001'; end if;
  if decision='reject' then
    update public.ai_proposals set status='rejected',revision=revision+1,decided_at=now() where id=p.id;
    return '[]';
  end if;
  if p.expires_at<=now() or c.revoked_at is not null or not c.allow_proposals or c.activated_at<>p.connection_activated_at then raise exception 'Connection changed or proposal expired' using errcode='40001'; end if;
  if not exists(select 1 from auth.sessions s where s.id=p.oauth_session_id and s.user_id=p.user_id and s.oauth_client_id=c.client_id and s.created_at>=c.activated_at and (s.not_after is null or s.not_after>now())) then raise exception 'OAuth session revoked' using errcode='40001'; end if;
  -- Lock source rows before validating the entire batch. Parent locks also
  -- serialize normal child edits via the existing touch-application trigger.
  perform a.id from public.applications a where a.user_id=p.user_id and a.id in
    (select (v->>'record_id')::uuid from jsonb_array_elements(p.request->'changes') v where v->>'entity'='application'
     union select (v->>'application_id')::uuid from jsonb_array_elements(p.request->'changes') v) order by a.id for update;
  for tab in select unnest(array['hiring_rounds','preparation_tasks','application_contacts','resumes']) loop
    execute format('select id from public.%I where user_id=$1 and id in (select (v->>''record_id'')::uuid from jsonb_array_elements($2) v) order by id for update',tab) using p.user_id,p.request->'changes';
  end loop;
  if rounza_private.compile_proposal(c,p.request->'changes')<>p.changes then raise exception 'Source changed' using errcode='40001'; end if;
  -- Nothing is written until every source and current permission has passed.
  for op in select * from jsonb_array_elements(p.changes) loop
    tab:=rounza_private.proposal_table(op->>'entity');
    record_data:=(op->'after') || jsonb_build_object('id',op->>'record_id','user_id',p.user_id);
    if op->>'entity' in ('round','task','contact') then record_data:=record_data || jsonb_build_object('application_id',op->>'application_id'); end if;
    if op->>'entity'='resume' and op->>'action'='create' then record_data:=record_data || '{"source":"paste"}'::jsonb; end if;
    select string_agg(format('%I',k),',' order by k),string_agg(format('r.%I',k),',' order by k) into cols,values_cols from jsonb_object_keys(record_data) k;
    if op->>'action'='create' then
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r',tab,cols,values_cols,tab) using record_data;
    else
      select string_agg(format('%I',k),',' order by k),string_agg(format('r.%I',k),',' order by k) into cols,values_cols from jsonb_object_keys(op->'after') k;
      execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) r) where id=$2 and user_id=$3',tab,cols,values_cols,tab) using record_data,(op->>'record_id')::uuid,p.user_id;
    end if;
  end loop;
  for op in select * from jsonb_array_elements(p.changes) loop
    tab:=rounza_private.proposal_table(op->>'entity');
    execute format('select revision from public.%I where id=$1 and user_id=$2',tab) into rev using (op->>'record_id')::uuid,p.user_id;
    receipt:=receipt || jsonb_build_array(jsonb_build_object('entity',op->>'entity','record_id',op->>'record_id','application_id',op->>'application_id','revision',rev));
  end loop;
  update public.ai_proposals set status='approved',revision=revision+1,decided_at=now(),result=receipt where id=p.id;
  return receipt;
end;
$$;

revoke all on function rounza_private.proposal_table(text),rounza_private.proposal_defaults(text),rounza_private.validate_proposal_data(text,jsonb),rounza_private.compile_proposal(public.ai_connections,jsonb) from public,anon,authenticated;
revoke all on function public.submit_ai_proposal(jsonb),public.ai_proposal_status(uuid),public.decide_ai_proposal(uuid,integer,text) from public,anon;
grant execute on function public.submit_ai_proposal(jsonb),public.ai_proposal_status(uuid),public.decide_ai_proposal(uuid,integer,text) to authenticated;
notify pgrst, 'reload schema';
commit;
