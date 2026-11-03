import { supabase } from "./supabase.js";

export async function subscribeRoom(roomId, user, username, handlers) {
  const channel = supabase.channel(`gdp-room:${roomId}`, {
    config: { private: true, presence: { key: user.id } },
  });
  channel
    .on("postgres_changes", {
      event: "*", schema: "public", table: "game_states", filter: `room_id=eq.${roomId}`,
    }, (payload) => handlers.onGameState?.(payload.new))
    .on("postgres_changes", {
      event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}`,
    }, () => handlers.onRosterChange?.())
    .on("postgres_changes", {
      event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}`,
    }, () => handlers.onRosterChange?.())
    .on("presence", { event: "sync" }, () => {
      const presence = channel.presenceState();
      handlers.onPresence?.(Object.values(presence).flat());
    });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("La conexión en tiempo real está tardando demasiado.")), 12000);
    channel.subscribe(async (status, error) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        const { error: trackError } = await channel.track({
          userId: user.id,
          username,
          onlineAt: new Date().toISOString(),
        });
        if (trackError) reject(trackError);
        else resolve();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(timeout);
        reject(error ?? new Error(`Realtime: ${status}`));
      }
    });
  });
  return channel;
}

export async function unsubscribeRoom(channel) {
  if (channel) await supabase.removeChannel(channel);
}
