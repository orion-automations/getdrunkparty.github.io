-- Membership helper runs with table-owner rights so policies do not recurse.
create or replace function public.gdp_is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.room_players rp
    where rp.room_id = p_room_id
      and rp.user_id = (select auth.uid())
      and rp.status <> 'left'
  );
$$;

create or replace function public.gdp_can_access_realtime_topic()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null or realtime.topic() not like 'gdp-room:%' then
    return false;
  end if;
  begin
    v_room_id := substring(realtime.topic() from 10)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.gdp_is_room_member(v_room_id);
end;
$$;

revoke all on function public.gdp_is_room_member(uuid) from public, anon;
revoke all on function public.gdp_can_access_realtime_topic() from public, anon;
grant execute on function public.gdp_is_room_member(uuid) to authenticated;
grant execute on function public.gdp_can_access_realtime_topic() to authenticated;

revoke all on table public.rooms, public.room_players, public.game_states from anon, authenticated;
grant select on table public.rooms, public.room_players, public.game_states to authenticated;

drop policy if exists rooms_read_members on public.rooms;
create policy rooms_read_members on public.rooms
  for select to authenticated using (public.gdp_is_room_member(id));
drop policy if exists room_players_read_members on public.room_players;
create policy room_players_read_members on public.room_players
  for select to authenticated using (public.gdp_is_room_member(room_id));
drop policy if exists game_states_read_members on public.game_states;
create policy game_states_read_members on public.game_states
  for select to authenticated using (public.gdp_is_room_member(room_id));

grant select, insert on table realtime.messages to authenticated;
drop policy if exists gdp_room_presence_read on realtime.messages;
create policy gdp_room_presence_read on realtime.messages
  for select to authenticated
  using (extension = 'presence' and public.gdp_can_access_realtime_topic());
drop policy if exists gdp_room_presence_write on realtime.messages;
create policy gdp_room_presence_write on realtime.messages
  for insert to authenticated
  with check (extension = 'presence' and public.gdp_can_access_realtime_topic());
