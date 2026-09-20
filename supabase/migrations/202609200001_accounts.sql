begin;

create type public.application_status as enum (
  'Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company text not null check (char_length(company) <= 160 and char_length(btrim(company)) > 0),
  role text not null check (char_length(role) <= 200 and char_length(btrim(role)) > 0),
  status public.application_status not null default 'Saved',
  location text not null default '' check (char_length(location) <= 200),
  job_url text check (char_length(job_url) <= 2048 and job_url ~ '^https?://[^[:space:]]+$'),
  description text not null default '' check (char_length(description) <= 50000),
  notes text not null default '' check (char_length(notes) <= 20000),
  applied_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_owner_created on public.applications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.applications enable row level security;

-- Clear Supabase's possible default grants, including TRUNCATE (not covered by RLS).
revoke all on public.profiles, public.applications from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.profiles, public.applications to service_role;

create policy profiles_read_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy applications_read_own on public.applications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy applications_insert_own on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy applications_update_own on public.applications for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy applications_delete_own on public.applications for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- This is the only elevated function. Metadata supplies display text, never permissions.
create function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120));
  return new;
end;
$$;
revoke all on function public.create_user_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_user_profile();

-- Supports projects that already have test users before this migration is applied.
insert into public.profiles (id, display_name)
select id, left(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''), 120)
from auth.users on conflict (id) do nothing;

commit;
