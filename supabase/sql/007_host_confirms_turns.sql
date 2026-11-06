-- Version 007: keep the active player in control of turn actions and give the host authority to confirm outcomes.
-- Migration 006 is preserved; this replaces only its action RPC implementation.
create or replace function public.gdp_act_turn(
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
  v_room_status text;
  v_version bigint;
  v_saved_state jsonb;
  v_game jsonb;
  v_turn jsonb;
  v_participant jsonb;
  v_participant_id uuid;
  v_current_index integer;
  v_saved_index integer;
  v_player_count integer;
  v_saved_ids text[];
  v_submitted_ids text[];
  v_expected_next integer;
  v_current_event text;
  v_chain_next uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select status into v_room_status from public.rooms
    where id = p_room_id for update;
  if not found or v_room_status <> 'playing' then raise exception 'ROOM_NOT_PLAYING'; end if;
  if not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_user_id and status = 'joined'
  ) then raise exception 'ROOM_MEMBERSHIP_REQUIRED'; end if;

  select version, state into v_version, v_saved_state
    from public.game_states where room_id = p_room_id for update;
  if not found then raise exception 'ROOM_STATE_MISSING'; end if;
  if v_version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;

  v_game := v_saved_state->'game';
  if coalesce(v_saved_state->>'gameId', 'midnight-chaos') is distinct from coalesce(p_state->>'gameId', 'midnight-chaos') then
    raise exception 'ROOM_GAME_MISMATCH';
  end if;
  v_turn := v_game->'current';
  if jsonb_typeof(v_turn) = 'object' and nullif(v_turn->>'playerId', '') is not null then
    v_participant_id := (v_turn->>'playerId')::uuid;
  elsif nullif(v_game->'chain'->>'activePlayerId', '') is not null then
    v_participant_id := (v_game->'chain'->>'activePlayerId')::uuid;
  else
    v_current_index := coalesce((v_game->>'currentIndex')::integer, 0);
    v_participant := coalesce(v_saved_state->'participants', '[]'::jsonb)->v_current_index;
    if v_participant is null or jsonb_typeof(v_participant) <> 'object'
      or coalesce((v_participant->>'active')::boolean, true) = false then
      raise exception 'TURN_PARTICIPANT_MISSING';
    end if;
    v_participant_id := (v_participant->>'id')::uuid;
  end if;
  if v_participant_id is distinct from v_user_id and not exists (
    select 1 from public.rooms where id = p_room_id and host_id = v_user_id
  ) then raise exception 'TURN_OWNER_REQUIRED'; end if;
  if jsonb_typeof(p_state) is distinct from 'object' or pg_column_size(p_state) > 524288 then
    raise exception 'INVALID_GAME_STATE';
  end if;
  if jsonb_typeof(p_state->'game') is distinct from 'object'
    or jsonb_typeof(p_state->'participants') is distinct from 'array' then
    raise exception 'INVALID_GAME_STATE';
  end if;

  select coalesce(array_agg(value->>'id' order by ordinality), array[]::text[])
    into v_saved_ids
    from jsonb_array_elements(coalesce(v_saved_state->'participants', '[]'::jsonb))
      with ordinality as participant(value, ordinality);
  select coalesce(array_agg(value->>'id' order by ordinality), array[]::text[])
    into v_submitted_ids
    from jsonb_array_elements(coalesce(p_state->'participants', '[]'::jsonb))
      with ordinality as participant(value, ordinality);
  if v_saved_ids is distinct from v_submitted_ids then
    raise exception 'PARTICIPANT_ROSTER_LOCKED';
  end if;

  v_saved_index := coalesce((v_game->>'currentIndex')::integer, 0);
  v_current_index := coalesce((p_state->'game'->>'currentIndex')::integer, -1);
  v_player_count := cardinality(v_saved_ids);
  if v_player_count = 0 then raise exception 'TURN_PARTICIPANT_MISSING'; end if;
  if v_current_index < 0 or v_current_index >= v_player_count then raise exception 'INVALID_TURN_TRANSITION'; end if;
  if jsonb_typeof(v_turn) = 'object' then
    if jsonb_typeof(p_state->'game'->'current') = 'object' then
      if p_state->'game'->'current'->>'playerId' is distinct from v_participant_id::text
        or v_current_index <> v_saved_index then raise exception 'INVALID_TURN_TRANSITION'; end if;
    else
      v_current_event := v_game->'activeRoundEvent'->>'effect';
      if v_current_event = 'reverse_order' then
        select coalesce(
          (select max((participant.ordinality - 1)::integer)
            from jsonb_array_elements(coalesce(v_saved_state->'participants', '[]'::jsonb))
              with ordinality as participant(value, ordinality)
            where participant.ordinality - 1 < v_saved_index
              and coalesce((participant.value->>'active')::boolean, true)),
          (select max((participant.ordinality - 1)::integer)
            from jsonb_array_elements(coalesce(v_saved_state->'participants', '[]'::jsonb))
              with ordinality as participant(value, ordinality)
            where coalesce((participant.value->>'active')::boolean, true)),
          0
        ) into v_expected_next;
      else
        v_expected_next := mod(v_saved_index + 1, v_player_count);
      end if;
      if v_current_index <> v_expected_next then raise exception 'INVALID_TURN_TRANSITION'; end if;
    end if;
  else
    if v_current_index <> v_saved_index then raise exception 'INVALID_TURN_TRANSITION'; end if;
    if jsonb_typeof(p_state->'game'->'current') = 'object'
      and p_state->'game'->'current'->>'playerId' is distinct from v_participant_id::text then
      raise exception 'INVALID_TURN_TRANSITION';
    end if;
    if nullif(v_game->'chain'->>'activePlayerId', '') is not null then
      if jsonb_typeof(p_state->'game'->'chain') = 'object' then
        select (candidate.value #>> '{}')::uuid into v_chain_next
          from jsonb_array_elements(coalesce(v_game->'chain'->'playerIds', '[]'::jsonb))
            with ordinality as candidate(value, ordinality)
          where candidate.value #>> '{}' <> v_participant_id::text
            and not exists (
              select 1 from jsonb_array_elements(coalesce(v_game->'chain'->'visited', '[]'::jsonb)) visited(value)
              where visited.value->>'playerId' = candidate.value #>> '{}'
            )
          order by candidate.ordinality limit 1;
        if p_state->'game'->'chain'->>'activePlayerId' is distinct from v_chain_next::text
          and p_state->'game'->'chain'->>'activePlayerId' is distinct from v_participant_id::text then
          raise exception 'INVALID_CHAIN_TRANSITION';
        end if;
      end if;
    elsif jsonb_typeof(p_state->'game'->'chain') = 'object'
      and p_state->'game'->'chain'->>'activePlayerId' is distinct from v_participant_id::text then
      raise exception 'INVALID_CHAIN_TRANSITION';
    end if;
  end if;

  update public.game_states set state = p_state,
    timer = coalesce(p_timer, timer), version = version + 1,
    updated_by = v_user_id, updated_at = now()
    where room_id = p_room_id returning version into v_version;
  update public.rooms set updated_at = now() where id = p_room_id;
  return jsonb_build_object('version', v_version, 'status', v_room_status);
end;
$$;


revoke all on function public.gdp_act_turn(uuid, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.gdp_act_turn(uuid, bigint, jsonb, jsonb) to authenticated;
