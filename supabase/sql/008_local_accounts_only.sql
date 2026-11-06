-- Stop room creation from writing account/profile rows to the Supabase database.
-- Nickname and avatar remain only as room_players snapshots for active rooms.
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

-- Lock away any profiles table from older installations without deleting its rows.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'revoke all on table public.profiles from anon, authenticated';
  end if;
end;
$$;
revoke all on function public.gdp_create_room(text, text, integer, jsonb) from public, anon;
grant execute on function public.gdp_create_room(text, text, integer, jsonb) to authenticated;
