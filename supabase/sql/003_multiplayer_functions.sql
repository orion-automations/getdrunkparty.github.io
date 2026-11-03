-- All mutations that affect room membership or game state are atomic RPC calls.
create or replace function public.gdp_create_room(
  p_username text,
  p_avatar text,
  p_max_players integer,
  p_initial_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_code text;
  v_attempt integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_max_players < 2 or p_max_players > 30 then raise exception 'INVALID_CAPACITY'; end if;
  if char_length(btrim(coalesce(p_username, ''))) not between 1 and 32 then raise exception 'INVALID_USERNAME'; end if;

  insert into public.profiles (id, username, avatar, updated_at)
  values (v_user_id, btrim(p_username), p_avatar, now())
  on conflict (id) do update set username = excluded.username,
    avatar = excluded.avatar, updated_at = now();

  for v_attempt in 1..12 loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1), '')
      into v_code from generate_series(1, 6);
    insert into public.rooms (code, host_id, max_players)
      values (v_code, v_user_id, p_max_players)
      on conflict (code) do nothing returning id into v_room_id;
    exit when v_room_id is not null;
  end loop;
  if v_room_id is null then raise exception 'ROOM_CODE_RETRY'; end if;

  insert into public.room_players (room_id, user_id, username_snapshot, avatar_snapshot, role)
    values (v_room_id, v_user_id, btrim(p_username), p_avatar, 'host');
  insert into public.game_states (room_id, state, updated_by)
    values (v_room_id, coalesce(p_initial_state, '{}'::jsonb), v_user_id);

  return jsonb_build_object('room_id', v_room_id, 'code', v_code,
    'host_id', v_user_id, 'role', 'host', 'status', 'waiting', 'version', 0);
end;
$$;

create or replace function public.gdp_join_room(
  p_code text,
  p_username text,
  p_avatar text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_existing public.room_players%rowtype;
  v_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_username, ''))) not between 1 and 32 then raise exception 'INVALID_USERNAME'; end if;
  select * into v_room from public.rooms where code = upper(btrim(p_code)) for update;
  if not found or v_room.expires_at <= now() then raise exception 'ROOM_NOT_FOUND'; end if;

  select * into v_existing from public.room_players
    where room_id = v_room.id and user_id = v_user_id for update;
  if found then
    if v_existing.status = 'left' and v_room.status <> 'waiting' then raise exception 'ROOM_CLOSED'; end if;
    update public.room_players set username_snapshot = btrim(p_username),
      avatar_snapshot = p_avatar, status = 'joined', last_seen_at = now()
      where id = v_existing.id;
  else
    if v_room.status <> 'waiting' then raise exception 'ROOM_CLOSED'; end if;
    select count(*) into v_count from public.room_players
      where room_id = v_room.id and status <> 'left';
    if v_count >= v_room.max_players then raise exception 'ROOM_FULL'; end if;
    insert into public.room_players (room_id, user_id, username_snapshot, avatar_snapshot)
      values (v_room.id, v_user_id, btrim(p_username), p_avatar);
  end if;

  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code,
    'host_id', v_room.host_id,
    'role', case when v_room.host_id = v_user_id then 'host' else 'player' end,
    'status', v_room.status,
    'version', (select gs.version from public.game_states gs where gs.room_id = v_room.id));
end;
$$;

create or replace function public.gdp_start_game(
  p_room_id uuid,
  p_expected_version bigint,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_version bigint;
  v_players integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.host_id <> v_user_id then raise exception 'HOST_REQUIRED'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;
  select count(*) into v_players from public.room_players
    where room_id = p_room_id and status <> 'left';
  if v_players < 2 then raise exception 'NEED_TWO_PLAYERS'; end if;
  select version into v_version from public.game_states where room_id = p_room_id for update;
  if v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if jsonb_typeof(p_state) <> 'object' or pg_column_size(p_state) > 524288 then raise exception 'INVALID_GAME_STATE'; end if;
  update public.game_states set state = p_state, version = version + 1,
    updated_by = v_user_id, updated_at = now() where room_id = p_room_id
    returning version into v_version;
  update public.rooms set status = 'playing', updated_at = now() where id = p_room_id;
  return jsonb_build_object('version', v_version, 'status', 'playing');
end;
$$;

create or replace function public.gdp_save_game_state(
  p_room_id uuid,
  p_expected_version bigint,
  p_state jsonb,
  p_timer jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_status text;
  v_version bigint;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select host_id, status into v_host_id, v_status from public.rooms
    where id = p_room_id for update;
  if not found or v_host_id <> v_user_id then raise exception 'HOST_REQUIRED'; end if;
  if v_status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  select version into v_version from public.game_states where room_id = p_room_id for update;
  if v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if jsonb_typeof(p_state) <> 'object' or pg_column_size(p_state) > 524288 then raise exception 'INVALID_GAME_STATE'; end if;
  update public.game_states set state = p_state,
    timer = coalesce(p_timer, timer), version = version + 1,
    updated_by = v_user_id, updated_at = now()
    where room_id = p_room_id returning version into v_version;
  update public.rooms set updated_at = now() where id = p_room_id;
  return jsonb_build_object('version', v_version, 'status', v_status);
end;
$$;

create or replace function public.gdp_touch_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.room_players set last_seen_at = now(), status = 'joined'
    where room_id = p_room_id and user_id = auth.uid() and status <> 'left';
  if not found then raise exception 'ROOM_MEMBERSHIP_REQUIRED'; end if;
end;
$$;

create or replace function public.gdp_leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_new_host uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or not exists (select 1 from public.room_players where room_id = p_room_id and user_id = v_user_id and status <> 'left') then
    raise exception 'ROOM_MEMBERSHIP_REQUIRED';
  end if;
  update public.room_players set status = 'left', last_seen_at = now()
    where room_id = p_room_id and user_id = v_user_id;
  if v_room.host_id = v_user_id then
    select user_id into v_new_host from public.room_players
      where room_id = p_room_id and status <> 'left'
      order by joined_at, user_id limit 1;
    if v_new_host is null then
      update public.rooms set status = 'closed', updated_at = now() where id = p_room_id;
      return jsonb_build_object('status', 'closed');
    end if;
    update public.rooms set host_id = v_new_host, updated_at = now() where id = p_room_id;
    update public.room_players set role = case when user_id = v_new_host then 'host' else 'player' end
      where room_id = p_room_id and status <> 'left';
    return jsonb_build_object('status', 'transferred', 'host_id', v_new_host);
  end if;
  return jsonb_build_object('status', 'left');
end;
$$;

create or replace function public.gdp_claim_host(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_host_seen timestamptz;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or not exists (select 1 from public.room_players where room_id = p_room_id and user_id = v_user_id and status = 'joined') then
    raise exception 'ROOM_MEMBERSHIP_REQUIRED';
  end if;
  if v_room.host_id = v_user_id then return jsonb_build_object('host_id', v_user_id, 'status', 'already_host'); end if;
  select last_seen_at into v_host_seen from public.room_players
    where room_id = p_room_id and user_id = v_room.host_id and status <> 'left';
  if v_host_seen is not null and v_host_seen > now() - interval '90 seconds' then raise exception 'HOST_STILL_ACTIVE'; end if;
  update public.rooms set host_id = v_user_id, updated_at = now() where id = p_room_id;
  update public.room_players set role = case when user_id = v_user_id then 'host' else 'player' end
    where room_id = p_room_id and status <> 'left';
  return jsonb_build_object('host_id', v_user_id, 'status', 'transferred');
end;
$$;

create or replace function public.gdp_close_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.rooms set status = 'closed', updated_at = now()
    where id = p_room_id and host_id = v_user_id and status <> 'closed';
  if not found then raise exception 'HOST_REQUIRED'; end if;
  return jsonb_build_object('status', 'closed');
end;
$$;

revoke all on function public.gdp_create_room(text, text, integer, jsonb) from public, anon;
revoke all on function public.gdp_join_room(text, text, text) from public, anon;
revoke all on function public.gdp_start_game(uuid, bigint, jsonb) from public, anon;
revoke all on function public.gdp_save_game_state(uuid, bigint, jsonb, jsonb) from public, anon;
revoke all on function public.gdp_touch_room(uuid) from public, anon;
revoke all on function public.gdp_leave_room(uuid) from public, anon;
revoke all on function public.gdp_claim_host(uuid) from public, anon;
revoke all on function public.gdp_close_room(uuid) from public, anon;
grant execute on function public.gdp_create_room(text, text, integer, jsonb) to authenticated;
grant execute on function public.gdp_join_room(text, text, text) to authenticated;
grant execute on function public.gdp_start_game(uuid, bigint, jsonb) to authenticated;
grant execute on function public.gdp_save_game_state(uuid, bigint, jsonb, jsonb) to authenticated;
grant execute on function public.gdp_touch_room(uuid) to authenticated;
grant execute on function public.gdp_leave_room(uuid) to authenticated;
grant execute on function public.gdp_claim_host(uuid) to authenticated;
grant execute on function public.gdp_close_room(uuid) to authenticated;
