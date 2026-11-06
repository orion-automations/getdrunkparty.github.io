let session = null;
let servicesPromise = null;

function waitForSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  const script = document.querySelector("#supabase-sdk");
  if (!script || script.dataset.failed === "true") {
    return Promise.reject(new Error("No se pudo cargar Supabase. La partida local sigue disponible."));
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Supabase no respondió. Comprueba la conexión a internet.")), 10000);
    script.addEventListener("load", () => {
      clearTimeout(timeout);
      window.supabase?.createClient
        ? resolve()
        : reject(new Error("El SDK de Supabase se descargó sin inicializar."));
    }, { once: true });
    script.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("No se pudo cargar Supabase. La partida local sigue disponible."));
    }, { once: true });
  });
}

async function services() {
  await waitForSdk();
  servicesPromise ??= Promise.all([
    import("./multiplayer-auth.js"),
    import("./multiplayer-rooms.js"),
    import("./multiplayer-sync.js"),
  ]);
  const [auth, rooms, sync] = await servicesPromise;
  return { auth, rooms, sync };
}

export function getMultiplayerSession() {
  return session;
}

export async function getSavedProfile() {
  const { auth } = await services();
  const user = await auth.ensureAnonymousIdentity();
  return auth.getProfile(user.id);
}

export async function registerProfileAccount(username, password, avatar = null) {
  const { auth } = await services();
  return auth.registerUsername(username, password, avatar);
}

export async function signInProfileAccount(username, password) {
  const { auth } = await services();
  return auth.signInUsername(username, password);
}

export async function signOutProfileAccount() {
  const { auth } = await services();
  return auth.signOutUser();
}

export async function getProfileIdentity() {
  const { auth } = await services();
  return auth.getCurrentIdentity();
}

export async function saveUserProfile(username, avatar = null) {
  const { auth } = await services();
  const user = await auth.getCurrentIdentity();
  if (!user) return null;
  return auth.saveProfile(user.id, username, avatar);
}

export async function connectRoom({ mode, code, username, avatar = null, maxPlayers = 8, initialState, onSnapshot, onPresence, onStatus }) {
  await waitForSdk();
  const { auth, rooms, sync } = await services();
  onStatus?.("Conectando…");
  const user = await auth.ensureAnonymousIdentity();
  const existingProfile = await auth.getProfile(user.id);
  const profileName = String(username ?? "").trim() || existingProfile?.username;
  if (!profileName) throw new Error("Escribe tu nombre para jugar online.");
  const profile = await auth.saveProfile(user.id, profileName, avatar ?? existingProfile?.avatar ?? null);
  let roomInfo;
  if (mode === "create") {
    roomInfo = await rooms.createRoom(profile.username, profile.avatar, maxPlayers, initialState);
  } else {
    roomInfo = await rooms.joinRoom(code, profile.username, profile.avatar);
  }
  const roomId = roomInfo.room_id ?? roomInfo.id;
  const roomCode = roomInfo.code;
  if (!roomId || !roomCode) throw new Error("Supabase no devolvió los datos de la sala.");

  session = {
    roomId,
    code: roomCode,
    user,
    profile,
    role: roomInfo.role ?? (roomInfo.host_id === user.id ? "host" : "player"),
    version: Number(roomInfo.version ?? 0),
    status: roomInfo.status ?? "waiting",
    channel: null,
    handlers: { onSnapshot, onPresence, onStatus },
  };
  try {
    session.channel = await sync.subscribeRoom(roomId, user, profile.username, {
      onGameState: (row) => {
        if (!row || Number(row.version) <= session.version) return;
        session.version = Number(row.version);
        onSnapshot?.(row.state, row.timer, session.version);
      },
      onRosterChange: async () => {
        try {
          const snapshot = await rooms.readRoom(roomId);
          session.status = snapshot.room.status;
          session.role = snapshot.room.host_id === user.id ? "host" : "player";
          session.handlers.onStatus?.("connected");
          onSnapshot?.(snapshot.gameState.state, snapshot.gameState.timer, Number(snapshot.gameState.version), snapshot);
        } catch (error) {
          session.handlers.onStatus?.("error", error);
        }
      },
      onPresence,
    });
    const snapshot = await rooms.readRoom(roomId);
    session.status = snapshot.room.status;
    session.role = snapshot.room.host_id === user.id ? "host" : "player";
    session.version = Number(snapshot.gameState.version);
    onSnapshot?.(snapshot.gameState.state, snapshot.gameState.timer, session.version, snapshot);
    onStatus?.("connected");
    session.heartbeat = setInterval(() => rooms.touchRoom(roomId).catch(() => {}), 60000);
    session.storageKey = "gdpw.multiplayer.room";
    sessionStorage.setItem(session.storageKey, roomCode);
    return { session, snapshot };
  } catch (error) {
    try { await rooms.leaveRoom(roomId); } catch {}
    await sync.unsubscribeRoom(session.channel);
    session = null;
    throw error;
  }
}

export async function startRoom(state) {
  if (!session || session.role !== "host") throw new Error("Solo el anfitrión puede iniciar la partida.");
  const { rooms } = await services();
  const result = await rooms.beginRoomGame(session.roomId, session.version, state);
  session.version = Number(result.version ?? session.version + 1);
  session.status = "playing";
  return session.version;
}

export async function takeRoomHost() {
  if (!session) throw new Error("No hay una sala conectada.");
  const { rooms } = await services();
  const result = await rooms.claimHost(session.roomId);
  await refreshRoom();
  return result;
}

export async function closeCurrentRoom() {
  if (!session || session.role !== "host") throw new Error("Solo el anfitrión puede cerrar la sala.");
  const { rooms } = await services();
  const result = await rooms.closeRoom(session.roomId);
  session.status = "closed";
  return result;
}

export function scheduleRoomTimer(timer = null, onError = () => {}) {
  if (!session || session.role !== "host" || session.status !== "playing") return;
  clearTimeout(session.timerTimeout);
  session.timerTimeout = setTimeout(async () => {
    const expected = session.version;
    try {
      const { rooms } = await services();
      const result = await rooms.saveSharedTimer(session.roomId, expected, timer);
      session.version = Number(result.version ?? expected + 1);
    } catch (error) {
      onError(error);
      session.handlers.onStatus?.("reconnecting", error);
    }
  }, 180);
}

export function scheduleRoomAction(state, timer = null, onError = () => {}) {
  if (!session || session.status !== "playing") return;
  clearTimeout(session.saveTimeout);
  session.saveTimeout = setTimeout(async () => {
    const expected = session.version;
    try {
      const { rooms } = await services();
      const result = await rooms.actRoomTurn(session.roomId, expected, state, timer);
      session.version = Number(result.version ?? expected + 1);
    } catch (error) {
      onError(error);
      session.handlers.onStatus?.("reconnecting", error);
    }
  }, 180);
}

export async function saveConnectedProfile(username, avatar = null) {
  if (!session) throw new Error("Conéctate a una sala para guardar el perfil online.");
  const { auth, rooms } = await services();
  const profile = await auth.saveProfile(session.user.id, username, avatar);
  await rooms.refreshRoomProfile(profile.username, profile.avatar);
  session.profile = profile;
  await refreshRoom();
  return profile;
}

export async function refreshRoom() {
  if (!session) return null;
  const { rooms } = await services();
  const snapshot = await rooms.readRoom(session.roomId);
  session.version = Number(snapshot.gameState.version);
  session.status = snapshot.room.status;
  session.role = snapshot.room.host_id === session.user.id ? "host" : "player";
  session.handlers.onSnapshot?.(snapshot.gameState.state, snapshot.gameState.timer, session.version, snapshot);
  return snapshot;
}

export async function disconnectRoom({ voluntary = true } = {}) {
  if (!session) return;
  const current = session;
  clearTimeout(current.saveTimeout);
  clearTimeout(current.timerTimeout);
  clearInterval(current.heartbeat);
  session = null;
  let leaveError = null;
  try {
    const { rooms, sync } = await services();
    if (voluntary) {
      try { await rooms.leaveRoom(current.roomId); }
      catch (error) { leaveError = error; }
    }
    await sync.unsubscribeRoom(current.channel);
  } finally {
    sessionStorage.removeItem(current.storageKey ?? "gdpw.multiplayer.room");
  }
  if (leaveError) throw leaveError;
}

export async function reconnectSavedRoom(options) {
  const code = sessionStorage.getItem("gdpw.multiplayer.room");
  if (!code) return null;
  return connectRoom({ ...options, mode: "join", code });
}
