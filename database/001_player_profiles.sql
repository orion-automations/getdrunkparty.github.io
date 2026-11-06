-- ZEVYRA player identity data for Supabase.
-- Apply after supabase/sql/001_multiplayer_schema.sql.
-- Passwords are intentionally excluded: Supabase Auth owns credentials.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(btrim(username)) between 1 and 32),
  avatar text,
  public_uid text,
  banner_color text not null default '#311060',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists public_uid text,
  add column if not exists banner_color text not null default '#311060';

-- Backfill existing profiles with collision-checked, eight-character public IDs.
do $$
declare
  profile_row record;
  candidate text;
begin
  for profile_row in
    select id from public.profiles
    where public_uid is null or public_uid !~ '^[A-Z0-9]{8}$'
  loop
    loop
      candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when not exists (
        select 1 from public.profiles where public_uid = candidate
      );
    end loop;
    update public.profiles set public_uid = candidate where id = profile_row.id;
  end loop;
end
$$;

alter table public.profiles
  alter column public_uid set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  alter column public_uid set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_public_uid_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_public_uid_format_check
      check (public_uid ~ '^[A-Z0-9]{8}$');
  end if;
end
$$;

create unique index if not exists profiles_public_uid_unique_idx
  on public.profiles (public_uid);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
