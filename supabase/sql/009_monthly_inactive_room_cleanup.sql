-- Monthly cleanup for rooms with no recent participant heartbeat.
-- A room must be at least 30 days old and have no joined/disconnected member
-- seen in the last 30 days. Deleting rooms cascades to room_players/game_states.

create index if not exists room_players_room_last_seen_idx
  on public.room_players (room_id, last_seen_at desc)
  where status in ('joined', 'disconnected');

create or replace function public.gdp_cleanup_inactive_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rooms r
  where r.created_at < now() - interval '30 days'
    and not exists (
      select 1
      from public.room_players rp
      where rp.room_id = r.id
        and rp.status in ('joined', 'disconnected')
        and rp.last_seen_at >= now() - interval '30 days'
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.gdp_cleanup_inactive_rooms() from public, anon, authenticated;

-- Enable Cron in the Supabase Dashboard before running this migration.
-- Runs at 03:15 UTC on the first day of each month.
select cron.schedule(
  'zevyra-monthly-inactive-room-cleanup',
  '15 3 1 * *',
  $$select public.gdp_cleanup_inactive_rooms();$$
);
