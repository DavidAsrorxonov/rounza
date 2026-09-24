begin;

-- Old direct API clients could save URL user-info. Discard only those unsafe
-- links before adding the constraint; do not retain credentials in another field.
update public.applications set job_url = null
where job_url ~* '^https?://[^/?#]*@' or job_url like E'%\\\\%';
alter table public.applications add constraint applications_job_url_no_credentials
  check (job_url !~* '^https?://[^/?#]*@' and job_url not like E'%\\\\%');
alter table public.applications add constraint applications_id_owner unique (id, user_id);

create table public.hiring_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  application_id uuid not null,
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  kind text not null default 'Interview' check (kind in ('Interview', 'Assessment', 'Other')),
  status text not null default 'Planned' check (status in ('Planned', 'Scheduled', 'Completed', 'Cancelled')),
  position integer not null default 1 check (position between 1 and 999),
  scheduled_at timestamptz check (scheduled_at >= '0001-01-01' and scheduled_at < '10000-01-01'),
  time_zone text not null default 'UTC' check (char_length(time_zone) <= 100),
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440),
  due_on date check (due_on >= '0001-01-01' and due_on <= '9999-12-31'),
  meeting_url text check (char_length(meeting_url) <= 2048 and meeting_url ~ '^https?://[^[:space:]]+$' and meeting_url !~* '^https?://[^/?#]*@' and meeting_url not like E'%\\\\%'),
  location text not null default '' check (char_length(location) <= 300),
  people text not null default '' check (char_length(people) <= 500),
  notes text not null default '' check (char_length(notes) <= 20000),
  schedule_note text not null default '' check (char_length(schedule_note) <= 1000),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, application_id, user_id),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  check (status <> 'Scheduled' or scheduled_at is not null),
  check (status <> 'Planned' or scheduled_at is null)
);
create table public.preparation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  application_id uuid not null,
  round_id uuid,
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  due_on date check (due_on >= '0001-01-01' and due_on <= '9999-12-31'),
  completed boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 10000),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  foreign key (round_id, application_id, user_id) references public.hiring_rounds(id, application_id, user_id) on delete set null (round_id)
);
create table public.application_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  application_id uuid not null,
  name text not null check (char_length(btrim(name)) > 0 and char_length(name) <= 160),
  role text not null default '' check (char_length(role) <= 200),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 80),
  notes text not null default '' check (char_length(notes) <= 5000),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade
);
create table public.round_schedule_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  application_id uuid not null,
  round_id uuid not null,
  previous_at timestamptz,
  scheduled_at timestamptz,
  previous_due_on date,
  due_on date,
  previous_time_zone text,
  time_zone text not null,
  previous_status text,
  status text not null,
  previous_duration_minutes integer,
  duration_minutes integer not null,
  note text not null,
  created_at timestamptz not null default now(),
  foreign key (round_id, application_id, user_id) references public.hiring_rounds(id, application_id, user_id) on delete cascade
);
create index rounds_owner_application on public.hiring_rounds (user_id, application_id, position, created_at, id);
create index tasks_owner_application on public.preparation_tasks (user_id, application_id, completed, due_on, id);
create index contacts_owner_application on public.application_contacts (user_id, application_id, name, id);
create index history_owner_round on public.round_schedule_history (user_id, round_id, created_at desc, id);

-- Guard identity and force monotonically increasing revisions even for direct API writes.
create function public.validate_journey_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.user_id, new.application_id) is distinct from (old.id, old.user_id, old.application_id) then
      raise exception 'Journey identity cannot be changed' using errcode = '23514';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  else
    new.revision := 1;
    new.created_at := now();
  end if;
  new.updated_at := now();
  if tg_table_name = 'hiring_rounds' then
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
      raise exception 'Invalid time zone' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_journey_record() from public, anon, authenticated;

do $$ declare tab text; begin
  foreach tab in array array['hiring_rounds','preparation_tasks','application_contacts'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public, anon, authenticated', tab);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tab);
    execute format('grant all on public.%I to service_role', tab);
    execute format('create policy read_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tab);
    execute format('create policy insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tab);
    execute format('create policy update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tab);
    execute format('create policy delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', tab);
    execute format('create trigger validate_record before insert or update on public.%I for each row execute function public.validate_journey_record()', tab);
  end loop;
end $$;

alter table public.round_schedule_history enable row level security;
revoke all on public.round_schedule_history from public, anon, authenticated;
grant select on public.round_schedule_history to authenticated;
grant all on public.round_schedule_history to service_role;
create policy read_own on public.round_schedule_history for select to authenticated using ((select auth.uid()) = user_id);

-- Append history in the same transaction as the round. No client can insert,
-- rewrite or delete individual history entries, including via PostgREST.
create function public.record_round_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or
     (new.scheduled_at, new.due_on, new.time_zone, new.status, new.duration_minutes) is distinct from
     (old.scheduled_at, old.due_on, old.time_zone, old.status, old.duration_minutes) then
    insert into public.round_schedule_history (
      user_id, application_id, round_id, previous_at, scheduled_at,
      previous_due_on, due_on, previous_time_zone, time_zone, previous_status, status,
      previous_duration_minutes, duration_minutes, note
    ) values (
      new.user_id, new.application_id, new.id, old.scheduled_at, new.scheduled_at,
      old.due_on, new.due_on, old.time_zone, new.time_zone, old.status, new.status,
      old.duration_minutes, new.duration_minutes, new.schedule_note
    );
  end if;
  return new;
end;
$$;
revoke all on function public.record_round_schedule() from public, anon, authenticated;
create trigger record_schedule after insert or update on public.hiring_rounds
  for each row execute function public.record_round_schedule();

-- Journey activity updates the application's recency and revision too.
create function public.touch_journey_application() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.applications set updated_at = now() where id = old.application_id and user_id = old.user_id;
  else
    update public.applications set updated_at = now() where id = new.application_id and user_id = new.user_id;
  end if;
  return null;
end;
$$;
revoke all on function public.touch_journey_application() from public, anon, authenticated;
create trigger touch_application after insert or update or delete on public.hiring_rounds for each row execute function public.touch_journey_application();
create trigger touch_application after insert or update or delete on public.preparation_tasks for each row execute function public.touch_journey_application();
create trigger touch_application after insert or update or delete on public.application_contacts for each row execute function public.touch_journey_application();

-- The union is queried before pagination so reminders cover every application.
-- SECURITY INVOKER retains each table's RLS; ownership is also explicit.
create function public.next_actions(today date, day_end timestamptz, at_time timestamptz)
returns table (
  id text, user_id uuid, application_id uuid, record_id uuid, source text,
  company text, role text, title text, due_at timestamptz, due_on date,
  time_zone text, bucket integer, sort_at timestamptz
) language sql stable security invoker set search_path = '' as $$
  with items as (
    select 'task:' || t.id as id, t.user_id, t.application_id, t.id as record_id,
      'task' as source, a.company, a.role, t.title, null::timestamptz as due_at,
      t.due_on, 'UTC'::text as time_zone
    from public.preparation_tasks t join public.applications a on a.id = t.application_id and a.user_id = t.user_id
    where t.user_id = (select auth.uid()) and not t.completed and a.status in ('Saved','Applied','Interviewing')
    union all
    select 'meeting:' || r.id, r.user_id, r.application_id, r.id, 'meeting', a.company, a.role, r.title, r.scheduled_at, null::date, r.time_zone
    from public.hiring_rounds r join public.applications a on a.id = r.application_id and a.user_id = r.user_id
    where r.user_id = (select auth.uid()) and r.status = 'Scheduled' and a.status in ('Saved','Applied','Interviewing')
    union all
    select 'deadline:' || r.id, r.user_id, r.application_id, r.id, 'deadline', a.company, a.role, r.title, null::timestamptz, r.due_on, r.time_zone
    from public.hiring_rounds r join public.applications a on a.id = r.application_id and a.user_id = r.user_id
    where r.user_id = (select auth.uid()) and r.status in ('Planned','Scheduled') and r.due_on is not null and a.status in ('Saved','Applied','Interviewing')
    union all
    select 'round:' || r.id, r.user_id, r.application_id, r.id, 'round', a.company, a.role, r.title, null::timestamptz, null::date, r.time_zone
    from public.hiring_rounds r join public.applications a on a.id = r.application_id and a.user_id = r.user_id
    where r.user_id = (select auth.uid()) and r.status = 'Planned' and r.due_on is null and a.status in ('Saved','Applied','Interviewing')
  ) select *, case
    when due_at < at_time or due_on < today then 0
    when due_at < day_end or due_on = today then 1
    when due_at is not null or due_on is not null then 2
    else 3 end,
    coalesce(due_at, due_on::timestamp at time zone 'UTC', 'infinity'::timestamptz)
  from items;
$$;
revoke all on function public.next_actions(date, timestamptz, timestamptz) from public, anon;
grant execute on function public.next_actions(date, timestamptz, timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
