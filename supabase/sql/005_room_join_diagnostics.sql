-- Improve join-code normalization, room-state errors, and serialized capacity checks.
-- Keeps the existing tables and RLS policies; no data is removed.
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
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]]+', '', 'g'));
  v_room public.rooms%rowtype;
  v_existing public.room_players%rowtype;
  v_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_username, ''))) not between 1 and 32 then raise exception 'INVALID_USERNAME'; end if;
  if v_code !~ '^[A-HJ-NP-Z2-9]{6}$' then raise exception 'ROOM_CODE_INVALID'; end if;

  -- Locking the room serializes last-seat joins and duplicate membership checks.
  select * into v_room from public.rooms where code = v_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;

  select * into v_existing from public.room_players
    where room_id = v_room.id and user_id = v_user_id for update;
  if found then
    if v_existing.status = 'left' and v_room.status <> 'waiting' then
      if v_room.status in ('closed', 'finished') then raise exception 'ROOM_CLOSED'; end if;
      raise exception 'ROOM_IN_PROGRESS';
    end if;
    update public.room_players set username_snapshot = btrim(p_username),
      avatar_snapshot = p_avatar, status = 'joined', last_seen_at = now()
      where id = v_existing.id;
  else
    if v_room.status in ('closed', 'finished') then raise exception 'ROOM_CLOSED'; end if;
    if v_room.status <> 'waiting' then raise exception 'ROOM_IN_PROGRESS'; end if;
    select count(*) into v_count from public.room_players
      where room_id = v_room.id and status <> 'left';
    if v_count >= v_room.max_players then raise exception 'ROOM_FULL'; end if;
    insert into public.room_players (room_id, user_id, username_snapshot, avatar_snapshot)
      values (v_room.id, v_user_id, btrim(p_username), p_avatar);
  end if;

  return jsonb_build_object(
    'room_id', v_room.id,
    'code', v_room.code,
    'host_id', v_room.host_id,
    'role', case when v_room.host_id = v_user_id then 'host' else 'player' end,
    'status', v_room.status,
    'version', (select gs.version from public.game_states gs where gs.room_id = v_room.id)
  );
end;
$$;

revoke all on function public.gdp_join_room(text, text, text) from public, anon;
grant execute on function public.gdp_join_room(text, text, text) to authenticated;
