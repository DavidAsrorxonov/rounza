begin;

-- All portal fields (including name, URL, username and notes) are inside the
-- authenticated ciphertext. Only IDs, relationships, versions and dates are public
-- to the account's server. No passphrase, recovery secret or plaintext key column.
create table public.credential_vaults (
  id uuid primary key,
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  version integer not null check (version = 1),
  kdf text not null check (kdf = 'argon2id'),
  memory_kib integer not null check (memory_kib = 65536),
  iterations integer not null check (iterations = 3),
  parallelism integer not null check (parallelism = 4),
  salt text not null check (salt ~ '^[A-Za-z0-9+/]{22}==$'),
  passphrase_nonce text not null check (passphrase_nonce ~ '^[A-Za-z0-9+/]{16}$'),
  passphrase_wrapped_key text not null check (passphrase_wrapped_key ~ '^[A-Za-z0-9+/]{64}$'),
  recovery_nonce text not null check (recovery_nonce ~ '^[A-Za-z0-9+/]{16}$'),
  recovery_wrapped_key text not null check (recovery_wrapped_key ~ '^[A-Za-z0-9+/]{64}$'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.portal_accounts (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  vault_id uuid not null,
  version integer not null check (version = 1),
  nonce text not null check (nonce ~ '^[A-Za-z0-9+/]{16}$'),
  ciphertext text not null check (char_length(ciphertext) between 24 and 87384 and char_length(ciphertext) % 4 = 0 and ciphertext ~ '^[A-Za-z0-9+/]+={0,2}$'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, vault_id, user_id),
  foreign key (vault_id, user_id) references public.credential_vaults(id, user_id) on delete cascade
);
create table public.application_portals (
  application_id uuid not null,
  portal_id uuid not null,
  vault_id uuid not null,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (application_id, portal_id),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade,
  foreign key (portal_id, vault_id, user_id) references public.portal_accounts(id, vault_id, user_id) on delete cascade
);
create index portals_owner_updated on public.portal_accounts(user_id, updated_at desc, id);
create index application_portals_owner on public.application_portals(user_id, application_id, portal_id);
create index application_portals_portal on public.application_portals(portal_id, vault_id, user_id);

create function public.validate_vault_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.user_id) is distinct from (old.id, old.user_id) then
      raise exception 'Vault identity cannot change' using errcode = '23514';
    end if;
    if tg_table_name = 'portal_accounts' then
      if new.vault_id <> old.vault_id then raise exception 'Vault cannot change' using errcode = '23514'; end if;
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
revoke all on function public.validate_vault_record() from public, anon, authenticated;

do $$ declare tab text; begin
  foreach tab in array array['credential_vaults','portal_accounts','application_portals'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public, anon, authenticated', tab);
    execute format('grant select, insert, delete on public.%I to authenticated', tab);
    execute format('grant all on public.%I to service_role', tab);
    execute format('create policy read_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tab);
    execute format('create policy insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tab);
    execute format('create policy delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', tab);
    if tab <> 'application_portals' then
      execute format('grant update on public.%I to authenticated', tab);
      execute format('create policy update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tab);
      execute format('create trigger validate_record before insert or update on public.%I for each row execute function public.validate_vault_record()', tab);
    end if;
  end loop;
end $$;

create function public.create_portal_account(p_id uuid, p_vault_id uuid, p_nonce text, p_ciphertext text, p_application_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.portal_accounts(id, user_id, vault_id, version, nonce, ciphertext)
  values (p_id, auth.uid(), p_vault_id, 1, p_nonce, p_ciphertext);
  if p_application_id is not null then
    insert into public.application_portals(application_id, portal_id, vault_id, user_id)
    values (p_application_id, p_id, p_vault_id, auth.uid());
  end if;
  return p_id;
end;
$$;
revoke all on function public.create_portal_account(uuid,uuid,text,text,uuid) from public, anon;
grant execute on function public.create_portal_account(uuid,uuid,text,text,uuid) to authenticated;

create function public.list_portal_accounts(p_application_id uuid default null)
returns setof public.portal_accounts language sql stable security invoker set search_path = '' as $$
  select p.* from public.portal_accounts p
  where p.user_id = (select auth.uid()) and (p_application_id is null or exists (
    select 1 from public.application_portals l where l.portal_id = p.id and l.vault_id = p.vault_id
    and l.user_id = p.user_id and l.application_id = p_application_id
  ));
$$;
revoke all on function public.list_portal_accounts(uuid) from public, anon;
grant execute on function public.list_portal_accounts(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
