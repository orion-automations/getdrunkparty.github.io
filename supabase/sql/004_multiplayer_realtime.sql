-- Subscribe to persisted snapshots and room roster changes. Presence is ephemeral.
alter table public.game_states replica identity full;
alter table public.room_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'game_states'
  ) then
    execute 'alter publication supabase_realtime add table public.game_states';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'room_players'
  ) then
    execute 'alter publication supabase_realtime add table public.room_players';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;
end;
$$;
