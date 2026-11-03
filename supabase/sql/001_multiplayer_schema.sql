-- Get Drunk Party multiplayer schema. Safe to re-run; it does not delete data.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(btrim(username)) between 1 and 32),
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references auth.users (id),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished', 'closed')),
  max_players smallint not null default 8 check (max_players between 2 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  username_snapshot text not null check (char_length(btrim(username_snapshot)) between 1 and 32),
  avatar_snapshot text,
  role text not null default 'player' check (role in ('host', 'player')),
  status text not null default 'joined' check (status in ('joined', 'disconnected', 'left')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.game_states (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  timer jsonb not null default '{"endsAt":null,"remainingMs":30000,"totalMs":30000}'::jsonb,
  version bigint not null default 0 check (version >= 0),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_status_expiration_idx
  on public.rooms (status, expires_at);
create index if not exists room_players_user_status_idx
  on public.room_players (user_id, status, joined_at);
create index if not exists room_players_room_status_idx
  on public.room_players (room_id, status, joined_at);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.game_states enable row level security;
