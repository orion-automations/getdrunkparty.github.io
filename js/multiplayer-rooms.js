import { supabase } from "./supabase.js";

function unwrap(data) {
  return Array.isArray(data) ? data[0] : data;
}

export async function createRoom(username, avatar, maxPlayers, initialState) {
  const { data, error } = await supabase.rpc("gdp_create_room", {
    p_username: username,
    p_avatar: avatar,
    p_max_players: maxPlayers,
    p_initial_state: initialState,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function joinRoom(code, username, avatar) {
  const { data, error } = await supabase.rpc("gdp_join_room", {
    p_code: String(code ?? "").trim().toUpperCase(),
    p_username: username,
    p_avatar: avatar,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function readRoom(roomId) {
  const [roomResult, playersResult, gameResult] = await Promise.all([
    supabase.from("rooms").select("id, code, host_id, status, max_players, expires_at").eq("id", roomId).single(),
    supabase.from("room_players").select("user_id, username_snapshot, avatar_snapshot, role, status, joined_at, last_seen_at").eq("room_id", roomId).neq("status", "left").order("joined_at"),
    supabase.from("game_states").select("state, timer, version, updated_at").eq("room_id", roomId).single(),
  ]);
  for (const result of [roomResult, playersResult, gameResult]) {
    if (result.error) throw result.error;
  }
  return {
    room: roomResult.data,
    players: playersResult.data ?? [],
    gameState: gameResult.data,
  };
}

export async function beginRoomGame(roomId, expectedVersion, state) {
  const { data, error } = await supabase.rpc("gdp_start_game", {
    p_room_id: roomId,
    p_expected_version: expectedVersion,
    p_state: state,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function saveRoomGame(roomId, expectedVersion, state, timer) {
  const { data, error } = await supabase.rpc("gdp_save_game_state", {
    p_room_id: roomId,
    p_expected_version: expectedVersion,
    p_state: state,
    p_timer: timer,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function leaveRoom(roomId) {
  const { data, error } = await supabase.rpc("gdp_leave_room", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function touchRoom(roomId) {
  const { error } = await supabase.rpc("gdp_touch_room", {
    p_room_id: roomId,
  });
  if (error) throw error;
}

export async function claimHost(roomId) {
  const { data, error } = await supabase.rpc("gdp_claim_host", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return unwrap(data);
}

export async function closeRoom(roomId) {
  const { data, error } = await supabase.rpc("gdp_close_room", {
    p_room_id: roomId,
  });
  if (error) throw error;
  return unwrap(data);
}
