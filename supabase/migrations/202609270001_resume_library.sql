begin;
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160 and name = btrim(name) and name ~ '[^[:space:]]'),
  body text not null check (char_length(body) between 1 and 100000 and body ~ '[^[:space:]]'),
  source text not null check (source in ('paste', 'pdf', 'docx')),
  character_count integer generated always as (char_length(body)) stored,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resumes_owner_updated on public.resumes(user_id, updated_at desc, id);
alter table public.resumes enable row level security;
revoke all on public.resumes from public, anon, authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant all on public.resumes to service_role;
create policy read_own on public.resumes for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.resumes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.resumes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.resumes for delete to authenticated using ((select auth.uid()) = user_id);
create function public.validate_resume() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.user_id) is distinct from (old.id, old.user_id) then
      raise exception 'Resume identity cannot change' using errcode = '23514';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  else
    new.revision := 1;
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_resume() from public, anon, authenticated;
create trigger validate_record before insert or update on public.resumes for each row execute function public.validate_resume();
notify pgrst, 'reload schema';
commit;
