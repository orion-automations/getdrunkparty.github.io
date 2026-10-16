export function nextIndex(index, count) { return count ? ((index + 1) % count) : 0; }
export function assignTargets(mode, players, currentIndex, reversed = false, random = Math.random) {
  const active = players.filter(p=>p.active);
  if (!active.length) return [];
  const index = Math.max(0, active.findIndex(p=>p.id===players[currentIndex]?.id));
  const circular = offset => active[(index + offset + active.length) % active.length];
  if (mode === 'CURRENT_PLAYER') return [active[index]];
  if (mode === 'NEXT_PLAYER' || mode === 'LEFT_PLAYER') return [circular(reversed ? -1 : 1)];
  if (mode === 'PREVIOUS_PLAYER' || mode === 'RIGHT_PLAYER') return [circular(reversed ? 1 : -1)];
  if (mode === 'ALL_PLAYERS') return active;
  // A pair is always chosen by the people at the table; never assign a non-consenting partner randomly.
  if (mode === 'PLAYER_PAIR') return [];
  if (mode === 'RANDOM_PLAYER') return [active[Math.floor(random()*active.length)]];
  return [];
}
