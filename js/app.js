import { CATEGORIES, TARGETS, VERSION } from "./config.js";
import {
  loadState,
  saveState,
  validateCards,
  seedState,
  parseCardImport,
  exportCardCatalog,
} from "./storage.js";
import { gameEngine } from "./game.js";
import { makeId, downloadJSON, escapeText } from "./utils.js";
import { addDrink } from "./drinks.js";
import { findManual } from "./manuals.js";
import { DICE_FACES, diceRotationTarget } from "./dice.js";
import { validateMinigameRules } from "./minigame-results.js";
import {
  closeCurrentRoom,
  connectRoom,
  disconnectRoom,
  getMultiplayerSession,
  refreshRoom,
  scheduleRoomState,
  startRoom,
  takeRoomHost,
} from "./multiplayer.js";

let state = loadState(),
  engine = gameEngine(state),
  toastTimer;
let animateCardNext = false;
let animateCardId = null;
let rolling = false;
let timerState = { remainingMs: 30000, totalMs: 30000, endsAt: null, interval: null };
let onlineMode = false;
let applyingRemoteState = false;
let localModeBackup = null;
let roomPresence = [];
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const diceFaceColor = (category) =>
  CATEGORIES[category]?.color ??
  (category === "BLOQUEADA" ? "#A5A5B4" : "#fff");
for (const face of DICE_FACES) {
  const side = document.createElement("div");
  side.className = `dice-face face-${face.surface}`;
  side.style.setProperty("--face-color", diceFaceColor(face.category));
  side.textContent = face.label;
  $("#dice-cube").append(side);
}
const blankGame = () => ({ currentIndex: 0, state: "READY", decks: {}, current: null, history: [], archives: [], rewards: [] });
function snapshotForRoom() {
  const referencedIds = new Set([
    state.game.current?.primaryCard?.cardId,
    ...(state.game.current?.auxiliaryCards ?? []).map((item) => item.cardId),
  ].filter(Boolean));
  const cards = state.cards.filter((card) => referencedIds.has(card.id));
  const manualIds = new Set(cards.map((card) => card.manualId).filter(Boolean));
  return {
    participants: structuredClone(state.participants),
    settings: structuredClone(state.settings),
    game: structuredClone(state.game),
    cards: structuredClone(cards),
    manuals: structuredClone(state.manuals.filter((manual) => manualIds.has(manual.id))),
  };
}
function roomTimerSnapshot() {
  return { endsAt: timerState.endsAt, remainingMs: timerState.remainingMs, totalMs: timerState.totalMs };
}
function canControlOnlineGame() {
  return !onlineMode || getMultiplayerSession()?.role === "host";
}
function requireOnlineHost(message = "Solo el anfitrión controla esta partida.") {
  if (canControlOnlineGame()) return true;
  notify(message);
  return false;
}
function canPlayOnlineGame() {
  const session = getMultiplayerSession();
  return !onlineMode || (session?.role === "host" && session.status === "playing");
}
function requireOnlineGame(message = "La partida online aún no está iniciada o solo el anfitrión puede controlarla.") {
  if (canPlayOnlineGame()) return true;
  notify(message);
  return false;
}
function persist() {
  if (onlineMode) {
    const session = getMultiplayerSession();
    if (!applyingRemoteState && session?.role === "host") {
      scheduleRoomState(snapshotForRoom(), roomTimerSnapshot(), handleRoomSaveError);
    }
    return;
  }
  if (!saveState(state))
    notify(
      "No se pudo guardar. Libera espacio en el navegador o exporta un respaldo.",
    );
}
function notify(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function multiplayerErrorMessage(error) {
  const message = String(error?.message ?? error ?? "");
  if (/ROOM_NOT_FOUND/i.test(message)) return "No encontramos esa sala. Revisa el código.";
  if (/ROOM_FULL/i.test(message)) return "La sala está llena.";
  if (/ROOM_CLOSED|ROOM_NOT_WAITING/i.test(message)) return "La sala ya no acepta jugadores.";
  if (/NEED_TWO_PLAYERS/i.test(message)) return "Se necesitan al menos dos jugadores para iniciar.";
  if (/HOST_REQUIRED/i.test(message)) return "Solo el anfitrión puede realizar esa acción.";
  if (/HOST_STILL_ACTIVE/i.test(message)) return "El anfitrión sigue conectado; no es necesario transferir el control.";
  if (/VERSION_CONFLICT/i.test(message)) return "La partida cambió en otro dispositivo. Se está actualizando.";
  if (/Invalid API key|JWT/i.test(message)) return "La URL y la clave de Supabase no corresponden o no son válidas.";
  if (/Anonymous|anonymous/i.test(message)) return "Activa Anonymous Sign-Ins en Supabase Authentication.";
  return message || "No se pudo completar la acción online.";
}
function handleRoomSaveError(error) {
  if (/VERSION_CONFLICT/i.test(String(error?.message ?? error))) {
    refreshRoom().catch((refreshError) => notify(multiplayerErrorMessage(refreshError)));
    return;
  }
  notify(multiplayerErrorMessage(error));
}
function enterOnlineMode() {
  if (onlineMode) return;
  const timerRemaining = timerState.endsAt ? Math.max(0, timerState.endsAt - Date.now()) : timerState.remainingMs;
  localModeBackup = {
    state,
    engine,
    timer: { remainingMs: timerRemaining, totalMs: timerState.totalMs, wasRunning: Boolean(timerState.endsAt) },
  };
  clearInterval(timerState.interval);
  timerState.interval = null;
  timerState.endsAt = null;
  state = structuredClone(state);
  state.participants = [];
  state.game = blankGame();
  engine = gameEngine(state);
  onlineMode = true;
}
function leaveOnlineMode() {
  if (!onlineMode || !localModeBackup) return;
  const resumeLocalTimer = localModeBackup.timer.wasRunning;
  clearInterval(timerState.interval);
  timerState = { remainingMs: localModeBackup.timer.remainingMs, totalMs: localModeBackup.timer.totalMs, endsAt: null, interval: null };
  state = localModeBackup.state;
  engine = localModeBackup.engine;
  localModeBackup = null;
  onlineMode = false;
  applyingRemoteState = false;
  roomPresence = [];
  renderTimer();
  if (resumeLocalTimer) startTimer();
  render();
}
function renderMultiplayerRoom(details = null) {
  const session = getMultiplayerSession();
  const panel = $("#multiplayer-room");
  panel.classList.toggle("hidden", !session);
  $("#multiplayer-create-form").classList.toggle("hidden", Boolean(session));
  $("#multiplayer-join-form").classList.toggle("hidden", Boolean(session));
  if (!session) return;
  $("#multiplayer-room-code").textContent = session.code;
  $("#multiplayer-room-status").textContent = details?.room?.status ?? session.status;
  $("#multiplayer-start").classList.toggle("hidden", session.role !== "host" || session.status !== "waiting");
  $("#multiplayer-claim-host").classList.toggle("hidden", session.role === "host" || session.status === "closed");
  $("#multiplayer-close").classList.toggle("hidden", session.role !== "host" || session.status === "closed");
  $("#multiplayer-leave").textContent = session.role === "host" ? "Transferir anfitrión y salir" : "Salir de sala";
  const playersHost = $("#multiplayer-room-players");
  playersHost.replaceChildren();
  const players = details?.players ?? state.participants.map((player) => ({
    user_id: player.id, username_snapshot: player.name, role: player.id === session.user.id ? session.role : "player", status: "joined",
  }));
  for (const player of players) {
    const item = document.createElement("li");
    const isOnline = roomPresence.some((presence) => presence.userId === player.user_id);
    item.textContent = `${player.username_snapshot}${player.role === "host" ? " · anfitrión" : ""} · ${isOnline ? "conectado" : "reconectando"}`;
    playersHost.append(item);
  }
}
function applyOnlineSnapshot(roomState, timer, version, details = null) {
  enterOnlineMode();
  applyingRemoteState = true;
  const priorPlayers = state.participants ?? [];
  if (Array.isArray(details?.players)) {
    const roomPlayers = details.players.map((player) => ({
      id: player.user_id,
      name: player.username_snapshot,
      active: true,
      preferences: {},
      avatar: player.avatar_snapshot ?? null,
    }));
    const memberIds = new Set(roomPlayers.map((player) => player.id));
    const departed = priorPlayers
      .filter((player) => !memberIds.has(player.id))
      .map((player) => ({ ...player, active: false }));
    state.participants = [...roomPlayers, ...departed];
  } else if (Array.isArray(roomState?.participants)) {
    state.participants = structuredClone(roomState.participants);
  }
  if (roomState?.game) state.game = structuredClone(roomState.game);
  if (roomState?.settings) state.settings = { ...state.settings, ...roomState.settings };
  if (Array.isArray(roomState?.cards)) {
    const remoteIds = new Set(roomState.cards.map((card) => card.id));
    state.cards = [...state.cards.filter((card) => !remoteIds.has(card.id)), ...structuredClone(roomState.cards)];
  }
  if (Array.isArray(roomState?.manuals)) {
    const remoteIds = new Set(roomState.manuals.map((manual) => manual.id));
    state.manuals = [...state.manuals.filter((manual) => !remoteIds.has(manual.id)), ...structuredClone(roomState.manuals)];
  }
  engine = gameEngine(state);
  if (timer) applySharedTimer(timer);
  applyingRemoteState = false;
  const session = getMultiplayerSession();
  $("#multiplayer-connection").textContent = session?.status === "playing" ? "Partida sincronizada" : session?.status === "closed" ? "Sala cerrada" : "Conectado";
  renderMultiplayerRoom(details);
  render();
  if ((details?.room?.status ?? session?.status) === "playing") {
    setView("game");
    $("#game-message").textContent = session?.role === "host" ? "Partida online · control del anfitrión." : "Partida online · siguiendo al anfitrión.";
  }
}
function applySharedTimer(timer) {
  const endsAt = timer.endsAt ? Number(timer.endsAt) : null;
  if (timerState.endsAt === endsAt && timerState.totalMs === Number(timer.totalMs) &&
      (endsAt || timerState.remainingMs === Number(timer.remainingMs))) return;
  clearInterval(timerState.interval);
  timerState.endsAt = endsAt;
  timerState.totalMs = Number(timer.totalMs) || 30000;
  timerState.remainingMs = endsAt
    ? Math.max(0, endsAt - Date.now())
    : Number(timer.remainingMs) || 0;
  if (endsAt) {
    timerState.interval = setInterval(() => {
      if (Date.now() >= timerState.endsAt) stopTimer(true);
      else renderTimer();
    }, 250);
  } else timerState.interval = null;
  renderTimer();
}
async function connectOnlineRoom(mode, code = "") {
  const typedName = $("#multiplayer-name").value.trim();
  const fallbackName = state.participants[state.game.currentIndex]?.name ?? state.participants.find((player) => player.active)?.name ?? "";
  const username = typedName || fallbackName;
  if (username) $("#multiplayer-name").value = username;
  const maxPlayers = Number($("#multiplayer-capacity").value);
  if (mode === "create" && (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 30))
    return notify("El máximo de jugadores debe estar entre 2 y 30.");
  const initialState = {
    participants: [],
    settings: structuredClone(state.settings),
    game: blankGame(),
    cards: [],
    manuals: [],
  };
  enterOnlineMode();
  $("#multiplayer-connection").textContent = "Conectando…";
  try {
    const connection = await connectRoom({
      mode, code, username, maxPlayers, initialState,
      onSnapshot: applyOnlineSnapshot,
      onPresence: (presence) => {
        roomPresence = presence;
        renderMultiplayerRoom();
      },
      onStatus: (status, error) => {
        $("#multiplayer-connection").textContent = status === "connected" ? "Conectado" : status === "reconnecting" ? "Reconectando…" : status === "error" ? multiplayerErrorMessage(error) : status;
      },
    });
    $("#multiplayer-name").value = connection.session.profile.username;
    renderMultiplayerRoom();
    return true;
  } catch (error) {
    leaveOnlineMode();
    $("#multiplayer-connection").textContent = "Error de conexión";
    notify(multiplayerErrorMessage(error));
    return false;
  }
}

async function leaveOnlineRoom() {
  try {
    await disconnectRoom();
  } catch (error) {
    notify(multiplayerErrorMessage(error));
  }
  leaveOnlineMode();
  $("#multiplayer-connection").textContent = "Desconectado";
  renderMultiplayerRoom();
}

$("#multiplayer-name").value = state.participants[state.game.currentIndex]?.name ?? state.participants[0]?.name ?? "";
$("#multiplayer-create-form").onsubmit = async (event) => {
  event.preventDefault();
  await connectOnlineRoom("create");
};
$("#multiplayer-join-form").onsubmit = async (event) => {
  event.preventDefault();
  await connectOnlineRoom("join", $("#multiplayer-code").value);
};
$("#multiplayer-start").onclick = async () => {
  if (!requireOnlineHost()) return;
  state.game = blankGame();
  try {
    await startRoom(snapshotForRoom());
    renderMultiplayerRoom();
    setView("game");
    scheduleRoomState(snapshotForRoom(), roomTimerSnapshot(), handleRoomSaveError);
  } catch (error) {
    notify(multiplayerErrorMessage(error));
  }
};
$("#multiplayer-claim-host").onclick = async () => {
  try {
    await takeRoomHost();
    renderMultiplayerRoom();
    renderGame();
    notify("Ahora tienes el control de la partida.");
  } catch (error) {
    notify(multiplayerErrorMessage(error));
  }
};
$("#multiplayer-leave").onclick = leaveOnlineRoom;
$("#multiplayer-close").onclick = async () => {
  if (!requireOnlineHost()) return;
  try {
    await closeCurrentRoom();
    await disconnectRoom({ voluntary: false });
    leaveOnlineMode();
    $("#multiplayer-connection").textContent = "Sala cerrada";
    renderMultiplayerRoom();
    notify("Sala cerrada.");
  } catch (error) {
    notify(multiplayerErrorMessage(error));
  }
};
const savedRoomCode = sessionStorage.getItem("gdpw.multiplayer.room");
if (savedRoomCode) {
  $("#multiplayer-code").value = savedRoomCode;
  void connectOnlineRoom("join", savedRoomCode);
}
function formatTimer(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
function renderDigitalDigits(value) {
  const patterns = {
    "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
    "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  };
  const host = $("#timer-display");
  host.replaceChildren();
  for (const character of value) {
    if (character === ":") {
      const colon = document.createElement("span");
      colon.className = "timer-colon";
      colon.textContent = ":";
      host.append(colon);
      continue;
    }
    const digit = document.createElement("span");
    digit.className = "timer-digit";
    for (const segmentName of "abcdefg") {
      const segment = document.createElement("i");
      segment.className = `segment-${segmentName}${patterns[character]?.includes(segmentName) ? " on" : ""}`;
      digit.append(segment);
    }
    host.append(digit);
  }
}
function playTimerSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return notify("Este navegador no permite el sonido del temporizador.");
  const context = new AudioContextClass();
  [0, 0.18, 0.36].forEach((offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.15);
  });
}
function renderTimer() {
  const remaining = timerState.endsAt ? timerState.endsAt - Date.now() : timerState.remainingMs;
  const formatted = formatTimer(remaining);
  renderDigitalDigits(formatted);
  $("#timer-face").style.setProperty(
    "--timer-progress",
    String(timerState.totalMs ? Math.max(0, Math.min(1, remaining / timerState.totalMs)) * 100 : 0),
  );
  $("#timer-inline-display").textContent = formatted;
  $("#timer-inline").classList.toggle("is-running", Boolean(timerState.endsAt));
  $("#timer-inline").classList.toggle("is-paused", !timerState.endsAt && timerState.remainingMs < timerState.totalMs);
  $("#timer-inline").setAttribute(
    "aria-label",
    `${timerState.endsAt ? "Temporizador en marcha" : "Abrir temporizador"}: ${formatted}`,
  );
  $("#timer-inline").style.setProperty(
    "--timer-inline-progress",
    String(timerState.totalMs ? Math.max(0, Math.min(1, remaining / timerState.totalMs)) * 100 : 0),
  );
  $("#timer-start").disabled = Boolean(timerState.endsAt);
  $("#timer-pause").disabled = !timerState.endsAt;
  $("#timer-start").setAttribute("aria-label", "Iniciar temporizador");
  $("#timer-pause").setAttribute("aria-label", "Pausar temporizador");
  const readOnly = onlineMode && !canControlOnlineGame();
  $("#timer-start").disabled = Boolean(timerState.endsAt) || readOnly;
  $("#timer-pause").disabled = !timerState.endsAt || readOnly;
  $("#timer-reset").disabled = readOnly;
  $("#timer-test-sound").disabled = readOnly;
  $$("#timer-hours, #timer-minutes, #timer-seconds").forEach((select) => { select.disabled = readOnly; });
  $$("#timer-presets .button").forEach((button) => { button.disabled = readOnly; });
}
function stopTimer(finished = false) {
  clearInterval(timerState.interval);
  timerState.interval = null;
  if (timerState.endsAt) timerState.remainingMs = Math.max(0, timerState.endsAt - Date.now());
  timerState.endsAt = null;
  if (finished) {
    timerState.remainingMs = 0;
    playTimerSound();
    notify("Tiempo terminado.");
  }
  renderTimer();
  publishSharedTimer();
}
function startTimer() {
  if (!requireOnlineHost("Solo el anfitrión controla el temporizador compartido.")) return;
  if (!timerState.remainingMs) return notify("Indica un tiempo mayor que cero.");
  timerState.endsAt = Date.now() + timerState.remainingMs;
  clearInterval(timerState.interval);
  timerState.interval = setInterval(() => {
    if (Date.now() >= timerState.endsAt) stopTimer(true);
    else renderTimer();
  }, 250);
  renderTimer();
  publishSharedTimer();
}
function setTimer(milliseconds) {
  if (!requireOnlineHost("Solo el anfitrión controla el temporizador compartido.")) return;
  stopTimer();
  timerState.totalMs = Math.max(0, milliseconds);
  timerState.remainingMs = timerState.totalMs;
  setPickerFromMilliseconds(timerState.totalMs);
  renderTimer();
  publishSharedTimer();
}
function setPickerFromMilliseconds(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  $("#timer-hours").value = String(Math.min(23, Math.floor(totalSeconds / 3600)));
  $("#timer-minutes").value = String(Math.floor((totalSeconds % 3600) / 60));
  $("#timer-seconds").value = String(totalSeconds % 60);
}
function syncTimerFromPicker() {
  if (!requireOnlineHost("Solo el anfitrión ajusta el temporizador compartido.")) return;
  if (timerState.endsAt) return;
  const duration = (
    Number($("#timer-hours").value) * 3600 +
    Number($("#timer-minutes").value) * 60 +
    Number($("#timer-seconds").value)
  ) * 1000;
  timerState.totalMs = duration;
  timerState.remainingMs = duration;
  renderTimer();
  publishSharedTimer();
}
function publishSharedTimer() {
  const session = getMultiplayerSession();
  if (onlineMode && session?.role === "host" && session.status === "playing") {
    scheduleRoomState(snapshotForRoom(), roomTimerSnapshot(), handleRoomSaveError);
  }
}
function setView(view) {
  $$(".view").forEach((el) =>
    el.classList.toggle("active", el.id === `view-${view}`),
  );
  $$(".nav-link").forEach((el) =>
    el.classList.toggle("active", el.dataset.view === view),
  );
  $("#nav").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}
function esc(text) {
  return escapeText(text);
}
function shotLabel(count) {
  const shots = Number(count);
  return `${shots} ${shots === 1 ? "Shot" : "Shots"}`;
}
function render() {
  renderGame();
  renderRewards();
  renderPlayers();
  renderCards();
  renderManuals();
  renderDrinks();
  $("#position-reversed").checked = state.settings.positionReversed;
  const readOnly = onlineMode && !canControlOnlineGame();
  $("#player-form button").disabled = onlineMode || readOnly;
  $("#player-name").disabled = onlineMode || readOnly;
  $("#position-reversed").disabled = readOnly;
  ["#view-editor", "#view-manuals", "#view-settings"].forEach((selector) => {
    $(selector).inert = readOnly;
  });
}
function renderGame() {
  const active = state.participants.filter((p) => p.active);
  const hasPlayers = active.length > 0;
  const cur = state.game.current;
  const current = cur
    ? state.participants.find((p) => p.id === cur.playerId)
    : state.participants[state.game.currentIndex];
  $("#empty-game").classList.toggle("hidden", hasPlayers);
  $("#game-layout").classList.toggle("hidden", !hasPlayers);
  $("#current-player").textContent = current?.active
    ? current.name
    : "Agrega participantes";
  const ready = state.game.state === "READY" && hasPlayers && !rolling;
  const readOnly = onlineMode && !canPlayOnlineGame();
  const digital = (state.settings.gameMode ?? "digital") === "digital";
  $("#game-mode").value = digital ? "digital" : "physical";
  const showDice = digital && hasPlayers;
  $("#dice-stage").classList.toggle("hidden", !showDice);
  cubeIsInteractive(cur, ready, digital);
  const cube = $("#dice-cube");
  const selectedFace =
    DICE_FACES.find((face) => face.id === Number(cur?.diceFace)) ??
    DICE_FACES.find((face) => face.category === cur?.category);
  if (selectedFace && cube.dataset.resultFaceId !== String(selectedFace.id)) {
    cube.dataset.face = selectedFace.category;
    cube.dataset.resultFaceId = String(selectedFace.id);
    cube.style.setProperty(
      "--face-color",
      diceFaceColor(selectedFace.category),
    );
    if (!rolling) {
      cube.dataset.rotationX = String(selectedFace.x);
      cube.dataset.rotationY = String(selectedFace.y);
      cube.style.transition = "none";
      cube.style.transform = `rotateX(${selectedFace.x}deg) rotateY(${selectedFace.y}deg)`;
      cube.offsetWidth;
      cube.style.removeProperty("transition");
    }
  }
  const choosingPhysical = !digital && ready;
  const choosingRolledCategory = digital && cur?.phase === "AWAITING_CATEGORY";
  const mainDecksVisible = digital
    ? active.length > 0
    : choosingPhysical || Boolean(cur);
  $("#category-choices").classList.toggle("hidden", !mainDecksVisible);
  $("#blocked-choice").classList.toggle("hidden", !choosingPhysical);
  $("#aux-decks").classList.toggle(
    "disabled-decks",
    !cur ||
      cur.type === "BLOCKED" ||
      state.game.state !== "RESOLVING" ||
      Boolean(cur.outcome),
  );
  $$("#category-choices [data-category]").forEach((b) => {
    const enabled =
      choosingPhysical ||
      (choosingRolledCategory && b.dataset.category === cur.category);
    b.disabled = !enabled;
    b.classList.toggle(
      "selected-deck",
      choosingRolledCategory && b.dataset.category === cur.category,
    );
  });
  $("#blocked-choice").disabled = !choosingPhysical;
  const armedMiniSelection =
    cur?.category === "MINIJUEGO" ? cur.armedSelection : null;
  const effectCategories = (cur?.pendingEffects ?? [])
    .filter((effect) => effect.type === "DRAW_AUXILIARY")
    .map((effect) => effect.category);
  const canDrawAuxiliary = Boolean(
    cur?.primaryCard &&
    cur.category !== "MINIJUEGO" &&
    cur.auxiliaryCards?.length === 0 &&
    (!cur.outcome || effectCategories.length) &&
    cur.type !== "BLOCKED" &&
    state.game.state === "RESOLVING",
  );
  $$("#aux-category-choices [data-category]").forEach((b) => {
    b.disabled = armedMiniSelection
      ? b.dataset.category !== armedMiniSelection.category
      : !(
          canDrawAuxiliary &&
          (!cur?.outcome || effectCategories.includes(b.dataset.category))
        );
    b.disabled ||= readOnly;
  });
  $$("#category-choices [data-category]").forEach((button) => { button.disabled ||= readOnly; });
  $("#blocked-choice").disabled ||= readOnly;
  $("#game-mode").disabled = readOnly || Boolean(cur) || rolling;
  $("#save-minigame-participants").disabled = readOnly;
  $("#game-message").textContent = cur
    ? cur.category === "BLOQUEADA"
      ? "Cara bloqueada · no hay acción."
      : cur.phase === "AWAITING_CATEGORY"
        ? `Resultado: ${CATEGORIES[cur.category]?.label ?? cur.category} · pulsa el mazo iluminado.`
        : cur.phase === "EMPTY"
          ? `Resultado: ${CATEGORIES[cur.category]?.label ?? cur.category} · mazo agotado.`
          : `${CATEGORIES[cur.category]?.label ?? cur.category} · turno en curso.`
    : "";
  const cardsHost = $("#turn-cards");
  const items = cur
    ? [cur.primaryCard, ...(cur.auxiliaryCards ?? [])].filter(Boolean)
    : [];
  const cardsKey = items
    .map((item) => `${item.cardId}:${(item.targetIds ?? []).join(",")}`)
    .join("|");
  if (cardsHost.dataset.cardsKey !== cardsKey) {
    const animateActiveCard = animateCardNext && cardsKey.includes(animateCardId ?? "\0");
    cardsHost.replaceChildren();
    for (const [index, item] of items.entries()) {
      const card = state.cards.find((c) => c.id === item.cardId);
      if (card)
        cardsHost.append(
          makeTurnCard(
            card,
            item,
            index === 0,
            animateCardNext && item.cardId === animateCardId,
          ),
        );
    }
    cardsHost.dataset.cardsKey = cardsKey;
    if (animateActiveCard) {
      animateCardNext = false;
      animateCardId = null;
    }
    const activeCardId = animateActiveCard
      ? animateCardId
      : state.game.current?.auxiliaryCards?.at(-1)?.cardId ?? state.game.current?.primaryCard?.cardId;
    requestAnimationFrame(() => {
      const active = cardsHost.querySelector(`[data-card-id="${CSS.escape(activeCardId ?? "")}"]`);
      if (active) {
        const hostRect = cardsHost.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const centerOffset = activeRect.left + activeRect.width / 2 - (hostRect.left + hostRect.width / 2);
        cardsHost.scrollTo({
          left: cardsHost.scrollLeft + centerOffset,
          behavior: animateActiveCard ? "smooth" : "auto",
        });
      }
      updateSliderActive(cardsHost);
    });
  }
  if (cardsHost.dataset.sliderBound !== "true") {
    cardsHost.dataset.sliderBound = "true";
    cardsHost.addEventListener("scroll", () => updateSliderActive(cardsHost), { passive: true });
  }
  cardsHost.classList.toggle("hidden", !items.length);
  const miniCard =
    cur?.primaryCard &&
    state.cards.find(
      (card) =>
        card.id === cur.primaryCard.cardId && card.categoryId === "MINIJUEGO",
    );
  $("#minigame-flow").classList.toggle(
    "hidden",
    !miniCard || state.game.state !== "RESOLVING",
  );
  if (miniCard) renderMinigameFlow(cur, miniCard);
  $("#resolve-actions").classList.toggle(
    "hidden",
    !cur ||
      state.game.state !== "RESOLVING" ||
      cur.phase === "AWAITING_CATEGORY",
  );
  const isChallenge = cur?.category === "DESAFIO";
  const isMinigame = cur?.category === "MINIJUEGO";
  const hasPenalty = (cur?.auxiliaryCards ?? []).some(
    (item) => item.category === "CASTIGO",
  );
  $("#confirm-completed").classList.toggle(
    "hidden",
    !cur ||
      cur.category === "BLOQUEADA" ||
      isChallenge ||
      isMinigame ||
      Boolean(cur.outcome),
  );
  $("#confirm-challenge").classList.toggle(
    "hidden",
    !isChallenge || isMinigame || Boolean(cur?.outcome),
  );
  $("#confirm-penalty").classList.toggle(
    "hidden",
    !isChallenge || isMinigame || !hasPenalty || Boolean(cur?.outcome),
  );
  const hasCard = items.length > 0;
  $("#confirm-alternative").classList.toggle(
    "hidden",
    !hasCard || isMinigame || Boolean(cur?.outcome),
  );
  const canFinish = Boolean(
    cur &&
    (cur.type === "BLOCKED" ||
      cur.phase === "EMPTY" ||
      (cur.outcome &&
        (!isMinigame ||
          (!cur.pendingSelections?.length && !cur.armedSelection)))),
  );
  $("#finish-turn").classList.toggle("hidden", !canFinish);
  $("#finish-turn").disabled = !canFinish;
  ["#confirm-completed", "#confirm-challenge", "#confirm-penalty", "#confirm-alternative", "#finish-turn"].forEach((selector) => {
    $(selector).disabled = readOnly || $(selector).classList.contains("hidden") || (selector === "#finish-turn" && !canFinish);
  });
  const effectMessages = (cur?.pendingEffects ?? [])
    .filter(
      (effect) =>
        effect.type === "DRAW_AUXILIARY" &&
        ["PREMIO", "CASTIGO"].includes(effect.category),
    )
    .map(
      (effect) =>
        `Efecto disponible: mazo ${CATEGORIES[effect.category].label}.`,
    );
  $("#reward-status").textContent = effectMessages.join(" ");
}

function updateSliderActive(host) {
  if (!host.children.length) return;
  const center = host.getBoundingClientRect().left + host.clientWidth / 2;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const card of host.children) {
    const rect = card.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - center);
    if (distance < nearestDistance) {
      nearest = card;
      nearestDistance = distance;
    }
  }
  for (const card of host.children) card.classList.toggle("is-active", card === nearest);
}

function cubeIsInteractive(turn, ready, digital) {
  const cube = $("#dice-cube");
  const readOnly = onlineMode && !canPlayOnlineGame();
  const canRepeatRoll = digital && turn && !turn.primaryCard && (["ROLLING", "AWAITING_CATEGORY"].includes(turn.phase) || (turn.type === "BLOCKED" && turn.phase === "RESOLVING"));
  const canReplaceMain = digital && turn?.primaryCard && ["VERDAD", "DESAFIO", "MINIJUEGO"].includes(turn.category) && !turn.outcome && !turn.minigameResult;
  cube.setAttribute("role", "button");
  cube.setAttribute("tabindex", digital && !readOnly && (ready || canRepeatRoll || canReplaceMain) ? "0" : "-1");
  cube.setAttribute("aria-label", canReplaceMain ? `Tirar el dado para extraer otra carta de ${CATEGORIES[turn.category].label}` : "Pulsa para tirar el dado");
  cube.classList.toggle("dice-clickable", digital && !readOnly && (ready || canRepeatRoll || canReplaceMain));
  $("#dice-hint").textContent = canReplaceMain
    ? `Pulsa el dado para extraer otra carta de ${CATEGORIES[turn.category].label}.`
    : canRepeatRoll
      ? "Pulsa el dado para volver a tirar."
    : ready && digital && !readOnly
        ? "Pulsa el dado para tirar."
        : "";
}

function makeSwipeRow(player, { leftLabel, rightLabel, leftAction, rightAction, status = "Desliza" }) {
  const row = document.createElement("div");
  row.className = "minigame-swipe-row";
  row.tabIndex = 0;
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", `${player.name}: ${status}`);
  const left = document.createElement("span");
  left.className = "minigame-swipe-label is-left";
  left.textContent = leftLabel;
  const name = document.createElement("strong");
  name.className = "minigame-swipe-name";
  name.textContent = player.name;
  const value = document.createElement("span");
  value.className = "minigame-swipe-value";
  value.textContent = status;
  const right = document.createElement("span");
  right.className = "minigame-swipe-label is-right";
  right.textContent = rightLabel;
  row.append(left, name, value, right);
  let startX = null;
  row.addEventListener("pointerdown", (event) => {
    if (!requireOnlineGame()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startX = event.clientX;
    row.setPointerCapture(event.pointerId);
  });
  row.addEventListener("pointerup", (event) => {
    if (!requireOnlineGame()) return;
    if (startX === null) return;
    const delta = event.clientX - startX;
    startX = null;
    if (Math.abs(delta) < 48) return;
    const action = delta < 0 ? leftAction : rightAction;
    if (action) action();
  });
  row.addEventListener("pointercancel", () => { startX = null; });
  row.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!requireOnlineGame()) return;
    event.preventDefault();
    (event.key === "ArrowLeft" ? leftAction : rightAction)?.();
  });
  return row;
}

function renderMinigameFlow(turn, card) {
  const readOnly = onlineMode && !canPlayOnlineGame();
  const participantHost = $("#minigame-participant-picker");
  const outcomeHost = $("#minigame-outcomes");
  const selectionHost = $("#minigame-selection");
  const saveParticipants = $("#save-minigame-participants");
  const recordResult = $("#record-minigame-result");
  const heading = $("#minigame-heading");
  const instructions = $("#minigame-instructions");
  participantHost.replaceChildren();
  outcomeHost.replaceChildren();
  selectionHost.replaceChildren();
  saveParticipants.classList.add("hidden");
  recordResult.classList.add("hidden");
  heading.classList.toggle("hidden", Boolean(turn.minigameResult));
  instructions.classList.toggle("hidden", Boolean(turn.minigameResult));

  const activePlayers = state.participants.filter((player) => player.active);
  const participants = (turn.participantIds ?? [])
    .map((id) => state.participants.find((player) => player.id === id))
    .filter(Boolean);
  const needsManualParticipants =
    ["PLAYER_PAIR", "MANUAL_SELECTION"].includes(card.target.mode) &&
    participants.length !== card.target.count;
  if (needsManualParticipants && !turn.minigameResult) {
    const list = document.createElement("div");
    list.className = "minigame-participant-list";
    activePlayers.forEach((player) => {
      const label = document.createElement("label");
      label.className = "minigame-participant-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "minigame-participant";
      checkbox.value = player.id;
      checkbox.checked = (turn.participantIds ?? []).includes(player.id);
      checkbox.disabled = readOnly;
      label.append(checkbox, document.createTextNode(player.name));
      list.append(label);
    });
    participantHost.append(list);
    saveParticipants.classList.remove("hidden");
    saveParticipants.disabled = readOnly || activePlayers.length < card.target.count;
  } else if (!turn.minigameResult) {
    const summary = document.createElement("p");
    summary.className = "fine-print";
    summary.textContent = participants.length
      ? `Participantes: ${participants.map((player) => player.name).join(", ")}`
      : "Agrega participantes activos para registrar este minijuego.";
    participantHost.append(summary);
  }

  if (!turn.minigameResult && participants.length && !needsManualParticipants) {
    const list = document.createElement("div");
    list.className = "minigame-outcome-list";
    const outcomes = new Map(participants.map((player) => [player.id, "NEUTRAL"]));
    participants.forEach((player) => {
      const row = makeSwipeRow(player, {
        leftLabel: "← Perdió",
        rightLabel: "Ganó →",
        status: "Sin resultado",
        leftAction: () => setOutcome(player.id, "LOSS"),
        rightAction: () => setOutcome(player.id, "WIN"),
      });
      row.dataset.result = "NEUTRAL";
      row.dataset.playerId = player.id;
      list.append(row);
    });
    function setOutcome(playerId, result) {
      outcomes.set(playerId, result);
      const row = [...list.children].find((item) => item.dataset.playerId === playerId);
      if (row) {
        row.dataset.result = result;
        row.querySelector(".minigame-swipe-value").textContent =
          result === "WIN" ? "Ganó · Premio" : result === "LOSS" ? "Perdió · Castigo" : "Sin resultado";
        row.setAttribute("aria-label", `${state.participants.find((player) => player.id === playerId)?.name}: ${row.querySelector(".minigame-swipe-value").textContent}`);
      }
    }
    outcomeHost.append(list);
    recordResult.classList.remove("hidden");
    recordResult.disabled = readOnly;
    recordResult.onclick = () => {
      if (!requireOnlineGame()) return;
      const resultList = participants.map(({ id: playerId }) => ({
        playerId,
        result: outcomes.get(playerId),
      }));
      const result = engine.recordMinigameResult(resultList);
      if (result.error)
        return notify(result.message ?? "No se pudo registrar el resultado.");
      persist();
      renderGame();
    };
  }

  if (!turn.minigameResult) return;
  const next = turn.pendingSelections?.[0];
  if (!next) {
    const used = new Set(turn.optionalSelectionsUsed ?? []);
    const optionalGroups = [
      {
        category: "PREMIO",
        label: "Premiar a un ganador",
        eligibleIds: turn.minigameResult.winners,
      },
      {
        category: "CASTIGO",
        label: "Castigar a un perdedor",
        eligibleIds: turn.minigameResult.losers,
      },
    ];
    optionalGroups.forEach(({ category, label, eligibleIds }) => {
      const eligible = eligibleIds
        .map((id) => state.participants.find((player) => player.id === id))
        .filter(Boolean);
      if (!eligible.length || used.has(category)) return;
      const group = document.createElement("div");
      group.className = "minigame-swipe-group";
      const title = document.createElement("h4");
      title.textContent = label;
      group.append(title);
      eligible.forEach((player) => {
        const isWinner = category === "PREMIO";
        const row = makeSwipeRow(player, {
          leftLabel: "← Castigo",
          rightLabel: "Premio →",
          status: "Desliza para asignar",
          leftAction: isWinner ? null : () => armOptional(category, player.id),
          rightAction: isWinner ? () => armOptional(category, player.id) : null,
        });
        row.classList.toggle("is-disabled", Boolean(turn.armedSelection));
        group.append(row);
      });
      selectionHost.append(group);
    });
    const status = document.createElement("p");
    status.className = "minigame-selection-status";
    status.textContent = turn.armedSelection
      ? `${state.participants.find((player) => player.id === turn.armedSelection.playerId)?.name ?? "Participante"}, selecciona el mazo de ${CATEGORIES[turn.armedSelection.category]?.label ?? "consecuencia"}.`
      : used.size
        ? "Puedes finalizar el turno o usar la otra consecuencia disponible."
        : "Las consecuencias son opcionales. Puedes asignar un Premio a un ganador o un Castigo a un perdedor, o finalizar el turno.";
    selectionHost.append(status);
    return;
  }
  const categoryName = CATEGORIES[next.category]?.label ?? next.category;
  const eligible = next.eligiblePlayerIds
    .map((id) => state.participants.find((player) => player.id === id))
    .filter(Boolean);
  const title = document.createElement("h4");
  title.className = "minigame-selection-title";
  title.textContent = next.playerId
    ? `Desliza para asignar ${categoryName.toLowerCase()} a ${state.participants.find((player) => player.id === next.playerId)?.name ?? "Participante"}`
    : `Desliza para asignar ${categoryName.toLowerCase()}`;
  selectionHost.append(title);
  const targets = next.playerId
    ? eligible.filter((player) => player.id === next.playerId)
    : eligible;
  targets.forEach((player) => {
    const isPrize = next.category === "PREMIO";
    const swipeRow = makeSwipeRow(player, {
      leftLabel: "← Castigo",
      rightLabel: "Premio →",
      status: turn.armedSelection ? "Selección preparada" : "Desliza para asignar",
      leftAction: isPrize || turn.armedSelection ? null : () => armQueued(player.id),
      rightAction: isPrize && !turn.armedSelection ? () => armQueued(player.id) : null,
    });
    swipeRow.classList.toggle("is-disabled", Boolean(turn.armedSelection));
    selectionHost.append(swipeRow);
  });
  const status = document.createElement("p");
  status.className = "minigame-selection-status";
  status.textContent = turn.armedSelection
    ? `${state.participants.find((player) => player.id === turn.armedSelection.playerId)?.name ?? "Participante"}, selecciona el mazo de ${categoryName}.`
    : `${turn.pendingSelections.length} selección${turn.pendingSelections.length === 1 ? "" : "es"} pendiente${turn.pendingSelections.length === 1 ? "" : "s"}.`;
  selectionHost.append(status);

  function armOptional(category, playerId) {
    const result = engine.armOptionalMinigameSelection(category, playerId);
    if (result.error) return notify("No se pudo preparar esa consecuencia.");
    persist();
    renderGame();
  }
  function armQueued(playerId) {
    const result = engine.armMinigameSelection(playerId);
    if (result.error) return notify("No se pudo preparar esa consecuencia.");
    persist();
    renderGame();
  }
}

function makeTurnCard(card, item, primary, animate) {
  const slot = document.createElement("div");
  slot.className = `card-slot${primary ? " primary-card-slot" : " auxiliary-card-slot"}`;
  let help = null;
  if (card.manualId) {
    help = document.createElement("button");
    help.type = "button";
    help.className = "help-button";
    help.textContent = "?";
    help.setAttribute("aria-label", `Abrir manual de ${card.title}`);
    help.onclick = () => openManual(card.manualId);
  }
  const area = document.createElement("div");
  area.className = "card-area";
  const playing = document.createElement("div");
  playing.className = "playing-card";
  playing.style.setProperty(
    "--card-color",
    CATEGORIES[card.categoryId]?.color ?? "#39e58c",
  );
  const back = document.createElement("div");
  back.className = "card-back";
  back.innerHTML = '<div class="cross-ribbon"><span></span></div><b>GDP</b>';
  back.querySelector("span").textContent =
    CATEGORIES[card.categoryId]?.label.toUpperCase() ?? card.categoryId;
  const front = document.createElement("article");
  front.className = "card-front";
  const category = document.createElement("div");
  category.className = "card-category";
  category.textContent =
    CATEGORIES[card.categoryId]?.label.toUpperCase() ?? card.categoryId;
  const players = document.createElement("div");
  players.className = "card-players";
  const assigned = (item.targetIds ?? [])
    .map((id) => state.participants.find((p) => p.id === id)?.name)
    .filter(Boolean);
  players.textContent = assigned.length
    ? `Participantes asignados: ${assigned.join(" · ")}`
    : (TARGETS[card.target.mode] ?? "Participación voluntaria");
  const copy = document.createElement("div");
  copy.className = "card-copy";
  const title = document.createElement("h3");
  title.textContent = card.title;
  const description = document.createElement("p");
  description.textContent = card.description;
  copy.append(title, description);
  const footer = document.createElement("div");
  footer.className = "card-footer";
  const penalty = document.createElement("span");
  penalty.textContent =
    card.penalty.enabled && card.penalty.units > 0
      ? shotLabel(card.penalty.units)
      : "";
  const fires = document.createElement("span");
  fires.setAttribute("aria-label", "Intensidad");
  fires.textContent = "🔥".repeat(card.spiceLevel);
  footer.append(penalty, fires);
  front.append(category, players, copy, footer);
  playing.append(back, front);
  area.append(playing);
  if (help) slot.append(help);
  slot.append(area);
  slot.dataset.cardId = card.id;
  if (card.durationSeconds) {
    const actions = document.createElement("div");
    actions.className = "card-inline-actions";
    const timer = document.createElement("button");
    timer.type = "button";
    timer.className = "button button-small";
    timer.textContent = `Iniciar ${card.durationSeconds}s`;
    timer.onclick = () => {
      setTimer(card.durationSeconds * 1000);
      $("#timer-dialog").showModal();
    };
    actions.append(timer);
    slot.append(actions);
  }
  const reveal = () => playing.classList.add("revealed");
  if (animate) {
    animateCardNext = false;
    animateCardId = null;
    requestAnimationFrame(() => setTimeout(reveal, 360));
  } else reveal();
  return slot;
}
function redrawCard(cardId) {
  if (!requireOnlineGame()) return;
  const active = state.cards.find((card) => card.id === cardId);
  if (!active || !["VERDAD", "DESAFIO", "MINIJUEGO"].includes(active.categoryId))
    return notify("Solo puedes repetir una carta principal.");
  const result = engine.redraw(cardId);
  if (result.error) return notify("Esta carta ya no se puede reemplazar.");
  if (result.empty) return notify("No hay otra carta habilitada en este mazo.");
  animateCardNext = true;
  animateCardId = result.card.id;
  persist();
  renderGame();
}
function renderRewards() {
  const host = $("#effects-list");
  if (!host) return;
  host.replaceChildren();
  const rewards = state.game.rewards ?? [];
  if (!rewards.some((r) => !r.used)) {
    const empty = document.createElement("li");
    empty.textContent = "Sin premios guardados.";
    host.append(empty);
  }
  rewards
    .filter((r) => !r.used)
    .forEach((reward) => {
      const li = document.createElement("li");
      const owner =
        state.participants.find((p) => p.id === reward.playerId)?.name ??
        "Participante";
      li.textContent = `${owner}: ${reward.title} · pendiente de uso manual `;
      const btn = document.createElement("button");
      btn.className = "button button-small";
      btn.textContent = "Marcar usado";
      btn.disabled = onlineMode && !canPlayOnlineGame();
      btn.onclick = () => {
        if (!requireOnlineGame()) return;
        reward.used = true;
        reward.usedAt = new Date().toISOString();
        persist();
        renderRewards();
        notify("Premio marcado como usado.");
      };
      li.append(btn);
      host.append(li);
    });
}
function renderPlayers() {
  const host = $("#players-list");
  host.replaceChildren();
  const readOnly = onlineMode;
  state.participants.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "manage-row";
    row.innerHTML = `<span class="player-number">${String(i + 1).padStart(2, "0")}</span><input aria-label="Nombre" value="${esc(p.name)}" maxlength="32"><span class="fine-print">${p.id === state.participants[state.game.currentIndex]?.id ? "Turno actual" : ""}</span><button class="button button-small button-danger" data-action="delete-player">Eliminar</button>`;
    row.querySelector("input").disabled = readOnly;
    row.querySelector("[data-action=delete-player]").disabled = readOnly;
    const saveName = () => {
      if (!requireOnlineHost()) return;
      const v = row.querySelector("input").value.trim();
      if (!v) return notify("El nombre no puede quedar vacío.");
      if (v === p.name) return;
      p.name = v;
      persist();
      render();
    };
    row.querySelector("input").onchange = saveName;
    row.querySelector("input").onblur = saveName;
    row.querySelector("[data-action=delete-player]").onclick = () => {
      if (!requireOnlineHost()) return;
      confirmAction("Eliminar participante", `¿Eliminar a ${p.name}?`, () => {
        const wasCurrent = i === state.game.currentIndex;
        state.participants.splice(i, 1);
        if (i < state.game.currentIndex) state.game.currentIndex--;
        else if (wasCurrent)
          state.game.currentIndex = Math.min(i, state.participants.length - 1);
        state.game.currentIndex = Math.max(0, state.game.currentIndex);
        persist();
        render();
      });
    };
    host.append(row);
  });
}
function populateForm(card) {
  const f = $("#card-form");
  f.reset();
  $("#form-error").textContent = "";
  $("#f-category").innerHTML = Object.entries(CATEGORIES)
    .filter(([id]) => id !== "SHOT")
    .map(([id, c]) => `<option value="${id}">${c.label}</option>`)
    .join("");
  $("#f-target").innerHTML = Object.entries(TARGETS)
    .map(([id, label]) => `<option value="${id}">${label}</option>`)
    .join("");
  $("#f-manual").innerHTML =
    '<option value="">Sin manual</option>' +
    state.manuals
      .map((m) => `<option value="${m.id}">${esc(m.title)}</option>`)
      .join("");
  const c = card ?? {
    id: makeId("CARTA"),
    categoryId: "VERDAD",
    title: "",
    description: "",
    spiceLevel: 0,
    target: { mode: "CURRENT_PLAYER", count: 1 },
    manualId: null,
    icon: { type: "glyph", value: "✦" },
    penalty: { enabled: false, units: 1 },
    enabled: true,
  };
  $("#form-heading").textContent = card ? "Editar carta" : "Nueva carta";
  $("#f-id").value = c.id;
  $("#f-id").readOnly = Boolean(card);
  $("#f-category").value = c.categoryId;
  $("#f-title").value = c.title;
  $("#f-description").value = c.description;
  $("#f-effects").value = c.effects ? JSON.stringify(c.effects, null, 2) : "";
  $("#f-spice").value = c.spiceLevel;
  $("#f-target").value = c.target.mode;
  $("#f-count").value = c.target.count ?? 1;
  $("#f-manual").value = c.manualId ?? "";
  $("#f-icon").value = c.icon?.value ?? "✦";
  $("#f-penalty-enabled").checked = c.penalty.enabled;
  $("#f-units").value = c.penalty.units;
  $("#f-enabled").checked = c.enabled;
  $("#f-duration").value = c.durationSeconds ?? "";
  updatePreview();
  $("#editor-dialog").showModal();
}
function updatePreview() {
  const cat = CATEGORIES[$("#f-category").value] ?? CATEGORIES.VERDAD,
    penalty =
      $("#f-penalty-enabled").checked && Number($("#f-units").value) > 0
        ? shotLabel($("#f-units").value)
        : "Sin penalización";
  $("#card-preview").style.setProperty("--card-color", cat.color);
  $("#card-preview").innerHTML =
    `<b>${esc($("#f-title").value || "Título de la carta")}</b><p>${esc($("#f-description").value || "La descripción aparecerá aquí.")}</p><small>${esc(penalty)} · ${"🔥".repeat(Number($("#f-spice").value)) || "Sin intensidad"}</small>`;
}
function saveCard(event) {
  event.preventDefault();
  const id = $("#f-id").value.trim(),
    old = state.cards.find((c) => c.id === id);
  let effects = null;
  try {
    effects = $("#f-effects").value.trim()
      ? JSON.parse($("#f-effects").value)
      : null;
    if (
      effects !== null &&
      (typeof effects !== "object" || Array.isArray(effects))
    )
      throw new Error("Los efectos deben ser un objeto JSON.");
  } catch (error) {
    $("#form-error").textContent =
      error instanceof SyntaxError
        ? "El JSON de efectos no es válido."
        : error.message;
    return;
  }
  const card = {
    id,
    categoryId: $("#f-category").value,
    title: $("#f-title").value.trim(),
    description: $("#f-description").value.trim(),
    icon: {
      type: "glyph",
      value: $("#f-icon").value.trim().slice(0, 8) || "✦",
    },
    spiceLevel: Number($("#f-spice").value),
    target: {
      mode: $("#f-target").value,
      count: Number($("#f-count").value),
      position: null,
    },
    penalty: {
      enabled: $("#f-penalty-enabled").checked,
      units: Number($("#f-units").value),
    },
    manualId: $("#f-manual").value || null,
    ...($("#f-duration").value ? { durationSeconds: Number($("#f-duration").value) } : {}),
    ...(effects ? { effects } : {}),
    enabled: $("#f-enabled").checked,
  };
  try {
    validateCards(
      old
        ? state.cards.map((c) => (c.id === id ? card : c))
        : [...state.cards, card],
      state.manuals,
    );
    if (old) state.cards[state.cards.indexOf(old)] = card;
    else state.cards.push(card);
    persist();
    $("#editor-dialog").close();
    renderCards();
    notify("Carta guardada.");
  } catch (e) {
    $("#form-error").textContent = e.message;
  }
}
function renderCards() {
  const filter = $("#category-filter"),
    previous = filter.value;
  filter.innerHTML =
    '<option value="">Todas las categorías</option>' +
    Object.entries(CATEGORIES)
      .filter(([id]) => id !== "SHOT")
      .map(([id, c]) => `<option value="${id}">${c.label}</option>`)
      .join("");
  filter.value = previous;
  const term = $("#card-search").value.toLocaleLowerCase(),
    cat = filter.value;
  const cards = state.cards
    .filter(
      (c) =>
        (!cat || c.categoryId === cat) &&
        (!term ||
          `${c.id} ${c.title} ${c.description}`
            .toLocaleLowerCase()
            .includes(term)),
    )
    .sort(
      (a, b) =>
        a.categoryId.localeCompare(b.categoryId) ||
        a.title.localeCompare(b.title),
    );
  $("#cards-list").replaceChildren();
  $("#cards-list").dataset.count = cards.length;
  cards.forEach((card) => {
    const row = document.createElement("article");
    row.className = `editor-card ${card.enabled ? "" : "disabled"}`;
    row.style.setProperty("--card-color", CATEGORIES[card.categoryId].color);
    row.innerHTML = `<div class="editor-card-icon">${esc(card.icon?.value ?? "✦")}</div><div class="editor-card-copy"><div class="editor-card-meta"><span>${CATEGORIES[card.categoryId].label}</span><code>${esc(card.id)}</code></div><h3>${esc(card.title)} ${card.enabled ? "" : "<small>(desactivada)</small>"}</h3><p>${esc(card.description)}</p></div><div class="card-menu"><button class="icon-button" data-action="menu" aria-label="Acciones de ${esc(card.title)}" title="Acciones">⋮</button><div class="card-menu-popover hidden"><button data-action="edit">Editar</button><button data-action="duplicate">Duplicar</button><button data-action="toggle">${card.enabled ? "Desactivar" : "Activar"}</button><button data-action="delete" class="danger">Eliminar</button></div></div>`;
    row.querySelector("[data-action=menu]").onclick = () => row.querySelector(".card-menu-popover").classList.toggle("hidden");
    row.querySelector("[data-action=edit]").onclick = () => populateForm(card);
    row.querySelector("[data-action=duplicate]").onclick = () => {
      const copy = structuredClone(card);
      copy.id = makeId(card.categoryId);
      copy.title = `${copy.title} (copia)`;
      state.cards.push(copy);
      persist();
      renderCards();
      notify("Carta duplicada.");
    };
    row.querySelector("[data-action=toggle]").onclick = () => {
      card.enabled = !card.enabled;
      persist();
      renderCards();
    };
    row.querySelector("[data-action=delete]").onclick = () =>
      confirmAction("Eliminar carta", `¿Eliminar “${card.title}”?`, () => {
        state.cards = state.cards.filter((c) => c.id !== card.id);
        Object.values(state.game.decks).forEach((d) => {
          d.order = d.order.filter((id) => id !== card.id);
        });
        persist();
        render();
      });
    $("#cards-list").append(row);
  });
}
function confirmAction(title, copy, action) {
  $("#confirm-title").textContent = title;
  $("#confirm-copy").textContent = copy;
  const dlg = $("#confirm-dialog"),
    btn = $("#confirm-action");
  btn.onclick = (e) => {
    e.preventDefault();
    action();
    dlg.close();
  };
  dlg.showModal();
}
function openManual(id) {
  const manual = findManual(state.manuals, id);
  if (!manual) {
    notify("No hay manual disponible para esta carta.");
    return;
  }
  $("#manual-title").textContent = manual.title;
  const host = $("#manual-content");
  host.replaceChildren();
  const p = document.createElement("p");
  p.textContent = manual.summary;
  host.append(p);
  const manualFields = [
    ["objective", "Objetivo"],
    ["participants", "Participantes"],
    ["materials", "Materiales"],
    ["preparation", "Preparación"],
    ["victoryCondition", "Condición de victoria"],
    ["tiebreaker", "Desempate"],
    ["duration", "Duración estimada"],
    ["resultToRecord", "Resultado a registrar"],
  ];
  const consequences = manual.details?.consequenceRules;
  if (Array.isArray(consequences) && consequences.length) {
    const details = document.createElement("p");
    details.innerHTML = "<strong>Consecuencias configuradas:</strong> ";
    const consequenceSummary = consequences
      .map((rule) => {
        const when =
          rule.when === "WIN"
            ? "ganadores"
            : rule.when === "LOSS"
              ? "perdedores"
              : "participantes";
        const howMany = rule.cardsPerRecipient
          ? `${rule.cardsPerRecipient} por persona`
          : `${rule.totalCards} en total`;
        return `${when}: ${howMany} del mazo ${CATEGORIES[rule.category]?.label ?? rule.category}`;
      })
      .join(" · ");
    details.append(document.createTextNode(consequenceSummary));
    host.append(details);
  }
  for (const [key, label] of manualFields) {
    const value = manual.details?.[key];
    if (value) {
      const detail = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      detail.append(strong, document.createTextNode(value));
      host.append(detail);
    }
  }
  if (manual.pending) {
    const badge = document.createElement("p");
    badge.className = "pending-badge";
    badge.textContent = "Reglas pendientes de configurar";
    host.append(badge);
  }
  manual.instructions.forEach((text) => {
    const line = document.createElement("p");
    line.textContent = text;
    host.append(line);
  });
  if (manual.notes) {
    const note = document.createElement("p");
    note.textContent = manual.notes;
    host.append(note);
  }
  $("#edit-open-manual").onclick = () => {
    dlgManual(manual);
  };
  $("#manual-dialog").showModal();
}
function dlgManual(manual, isNew = false) {
  $("#manual-dialog").close();
  $("#manual-editor-heading").textContent = isNew ? "Nuevo manual" : "Editar manual";
  $("#m-title").value = manual.title ?? "";
  $("#m-summary").value = manual.summary ?? "";
  $("#m-instructions").value = (manual.instructions ?? []).join("\n");
  $("#m-notes").value = manual.notes ?? "";
  $("#m-details").value = JSON.stringify(manual.details ?? {}, null, 2);
  $("#manual-form-error").textContent = "";
  const form = $("#manual-editor-form");
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const details = JSON.parse($("#m-details").value || "{}");
      if (!details || typeof details !== "object" || Array.isArray(details)) throw new Error("Los detalles deben ser un objeto JSON.");
      if (details.consequenceRules !== undefined) validateMinigameRules(details.consequenceRules);
      const title = $("#m-title").value.trim();
      if (!title) throw new Error("El título es obligatorio.");
      manual.title = title;
      manual.summary = $("#m-summary").value.trim();
      manual.instructions = $("#m-instructions").value.split("\n").map((line) => line.trim()).filter(Boolean);
      manual.notes = $("#m-notes").value.trim();
      manual.details = details;
      manual.pending = manual.instructions.length === 0;
      if (isNew) state.manuals.push(manual);
      persist();
      $("#manual-editor-dialog").close();
      renderManuals();
      notify(isNew ? "Manual creado." : "Manual actualizado.");
    } catch (error) {
      $("#manual-form-error").textContent = error.message || "No se pudo guardar el manual.";
    }
  };
  $("#manual-editor-dialog").showModal();
}
function renderManuals() {
  const host = $("#manuals-list");
  host.replaceChildren();
  state.manuals.forEach((m) => {
    const el = document.createElement("article");
    el.className = "panel manual-card";
    el.innerHTML = `<div><span class="eyebrow">${esc(m.id)}</span><h2>${esc(m.title)}</h2><p>${esc(m.summary)}</p>${m.pending ? '<span class="pending-badge">Pendiente de configurar</span>' : ""}</div><button class="button" data-edit>Editar manual</button>`;
    el.querySelector("[data-edit]").onclick = () => dlgManual(m);
    host.append(el);
  });
}
function renderDrinks() {
  const host = $("#drinks-list");
  host.replaceChildren();
  state.drinks.forEach((d) => {
    const line = document.createElement("div");
    line.className = "drink-row";
    line.innerHTML = `<span>${esc(d.name)}</span><span class="fine-print">${esc(d.unitLabel)}</span><button class="button button-small" data-edit>Editar</button><button class="button button-small" data-toggle>${d.enabled ? "Desactivar" : "Activar"}</button><button class="button button-small button-danger" data-delete>Eliminar</button>`;
    line.querySelector("[data-edit]").onclick = () => {
      const name = prompt("Nombre de la bebida o alternativa:", d.name);
      if (name === null) return;
      if (!name.trim()) return notify("El nombre no puede quedar vacío.");
      d.name = name.trim();
      const unit = prompt("Etiqueta de unidad:", d.unitLabel);
      if (unit !== null && unit.trim()) d.unitLabel = unit.trim();
      persist();
      renderDrinks();
    };
    line.querySelector("[data-toggle]").onclick = () => {
      d.enabled = !d.enabled;
      persist();
      renderDrinks();
    };
    line.querySelector("[data-delete]").onclick = () => {
      if (state.cards.some((c) => c.penalty.drinkTypeId === d.id))
        return notify(
          "No se puede eliminar: hay cartas que usan esta unidad. Puedes desactivarla o editar esas cartas.",
        );
      confirmAction("Eliminar bebida", `¿Eliminar ${d.name}?`, () => {
        state.drinks = state.drinks.filter((item) => item.id !== d.id);
        persist();
        renderDrinks();
      });
    };
    host.append(line);
  });
}

$("#nav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (btn) setView(btn.dataset.view);
});
$("#start-adding-players").onclick = () => setView("players");
$("#menu-toggle").onclick = () => $("#nav").classList.toggle("open");
$$(".close-dialog").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
const TIMER_PRESETS = [10, 15, 20, 30, 45, 60, 120, 180, 300, 420];
for (const [id, max, selected] of [
  ["timer-hours", 23, 0],
  ["timer-minutes", 59, 0],
  ["timer-seconds", 59, 30],
]) {
  const select = $(`#${id}`);
  for (let value = 0; value <= max; value++) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value).padStart(2, "0");
    option.selected = value === selected;
    select.append(option);
  }
  select.onchange = syncTimerFromPicker;
}
renderTimer();
TIMER_PRESETS.forEach((seconds) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-small";
  button.textContent = seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
  button.onclick = () => setTimer(seconds * 1000);
  $("#timer-presets").append(button);
});
$("#timer-inline").onclick = () => {
  renderTimer();
  $("#timer-dialog").showModal();
};
$("#timer-close").onclick = () => $("#timer-dialog").close();
$("#timer-start").onclick = startTimer;
$("#timer-pause").onclick = () => stopTimer();
$("#timer-reset").onclick = () => {
  stopTimer();
  timerState.remainingMs = timerState.totalMs;
  renderTimer();
  publishSharedTimer();
};
$("#timer-test-sound").onclick = playTimerSound;
function makeCategoryButton(id, category) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "category-back-button";
  button.dataset.category = id;
  button.style.setProperty("--category-color", category.color);
  button.innerHTML =
    '<span class="category-cross"></span><span class="category-name"></span>';
  button.querySelector(".category-name").textContent = category.label;
  button.onclick = () => drawCategory(id);
  return button;
}
function drawCategory(id) {
  if (!requireOnlineGame()) return;
  const result = engine.draw(id);
  if (result.error)
    return notify(
      result.error === "NO_PLAYERS"
        ? "Agrega participantes primero."
        : result.error === "AUXILIARY_ALREADY_DRAWN"
          ? "Ya elegiste un mazo auxiliar en este turno."
          : "Espera a que termine la acción actual.",
    );
  if (result.empty) {
    persist();
    renderGame();
    notify(
      `El mazo ${CATEGORIES[id]?.label ?? id} no tiene cartas habilitadas.`,
    );
    return;
  }
  if (result.card) {
    animateCardNext = true;
    animateCardId = result.card.id;
  }
  persist();
  renderGame();
}
$("#save-minigame-participants").onclick = () => {
  if (!requireOnlineGame()) return;
  const playerIds = $$(
    "#minigame-participant-picker input[name='minigame-participant']:checked",
  ).map((input) => input.value);
  const result = engine.setMinigameParticipants(playerIds);
  if (result.error)
    return notify(
      result.error === "INVALID_PARTICIPANT_COUNT"
        ? "Selecciona la cantidad de participantes indicada en la carta."
        : "Selecciona participantes activos y sin repetir.",
    );
  persist();
  renderGame();
};
for (const [id, category] of Object.entries(CATEGORIES)) {
  if (["VERDAD", "DESAFIO", "MINIJUEGO"].includes(id))
    $("#category-choices").append(makeCategoryButton(id, category));
  if (["PREMIO", "CASTIGO"].includes(id))
    $("#aux-category-choices").append(makeCategoryButton(id, category));
}
$("#blocked-choice").innerHTML =
  '<span class="category-cross"></span><span class="category-name">BLOQUEADA</span>';
$("#blocked-choice").style.setProperty("--category-color", "#a5a5b4");
$("#blocked-choice").onclick = () => drawCategory("BLOQUEADA");
$("#game-mode").onchange = (event) => {
  if (!requireOnlineGame()) { renderGame(); return; }
  if (state.game.current || rolling) {
    event.target.value = state.settings.gameMode ?? "digital";
    return notify("Termina el turno actual antes de cambiar el modo.");
  }
  state.settings.gameMode = event.target.value;
  persist();
  renderGame();
};
function startDigitalRoll(repeat = false) {
  if (!requireOnlineGame()) return;
  if (rolling) return;
  const result = repeat ? engine.rerollDigital() : engine.rollDigital();
  if (result.error)
    return notify(
      result.error === "NO_PLAYERS"
        ? "Agrega participantes primero."
        : "Espera a que termine la acción actual.",
    );
  rolling = true;
  renderGame();
  $("#dice-stage").classList.remove("hidden");
  $("#game-message").textContent = "";
  const { face } = result;
  const cube = $("#dice-cube");
  cube.dataset.face = face.category;
  cube.dataset.resultFaceId = String(face.id);
  cube.style.setProperty("--face-color", diceFaceColor(face.category));
  const currentX = Number(cube.dataset.rotationX ?? 0);
  const currentY = Number(cube.dataset.rotationY ?? 0);
  // Mantiene las seis caras visibles durante un giro 3D breve y reactivo.
  const duration = 1350;
  const targetX = diceRotationTarget(currentX, face.x, 6);
  const targetY = diceRotationTarget(currentY, face.y, 8);
  cube.style.transition = "none";
  let animationStart = null;
  const animateRoll = (timestamp) => {
    animationStart ??= timestamp;
    const progress = Math.min((timestamp - animationStart) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = currentX + (targetX - currentX) * eased;
    const y = currentY + (targetY - currentY) * eased;
    cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
    if (progress < 1) {
      requestAnimationFrame(animateRoll);
      return;
    }
    const resolved = engine.completeRoll();
    cube.dataset.rotationX = String(face.x);
    cube.dataset.rotationY = String(face.y);
    cube.style.transform = `rotateX(${face.x}deg) rotateY(${face.y}deg)`;
    cube.offsetWidth;
    cube.style.removeProperty("transition");
    rolling = false;
    persist();
    renderGame();
  };
  requestAnimationFrame(animateRoll);
}
function activateDice() {
  if (rolling) return notify("El dado está girando.");
  if (state.settings.gameMode !== "digital")
    return notify("Cambia al modo Dado digital para tirar.");
  const turn = state.game.current;
  if (!turn) return startDigitalRoll();
  if (!turn.primaryCard && (["ROLLING", "AWAITING_CATEGORY"].includes(turn.phase) || (turn.type === "BLOCKED" && turn.phase === "RESOLVING")))
    return startDigitalRoll(true);
  if (turn.primaryCard && ["VERDAD", "DESAFIO", "MINIJUEGO"].includes(turn.category) && !turn.outcome && !turn.minigameResult)
    return redrawCard(turn.primaryCard.cardId);
  notify("Termina las acciones de la carta actual antes de volver a tirar.");
}
$("#dice-cube").onclick = activateDice;
$("#dice-cube").onkeydown = (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activateDice();
  }
};
function confirmResult(result, sourceCardId) {
  if (!requireOnlineGame()) return;
  if (!engine.resolve(result, sourceCardId))
    return notify("El resultado de este turno ya fue confirmado.");
  persist();
  const hasAuxiliaryEffect = (state.game.current?.pendingEffects ?? []).some(
    (effect) => effect.type === "DRAW_AUXILIARY",
  );
  if (!hasAuxiliaryEffect) {
    const finished = engine.finishTurn();
    if (finished) {
      persist();
      render();
      return;
    }
  }
  renderGame();
}
$("#confirm-completed").onclick = () =>
  confirmResult("COMPLETED", state.game.current?.primaryCard?.cardId ?? null);
$("#confirm-challenge").onclick = () =>
  confirmResult("COMPLETED", state.game.current?.primaryCard?.cardId ?? null);
$("#confirm-alternative").onclick = () =>
  confirmResult(
    "ALTERNATIVE_SELECTED",
    state.game.current?.primaryCard?.cardId ?? null,
  );
$("#confirm-penalty").onclick = () => {
  const punishment = [...(state.game.current?.auxiliaryCards ?? [])]
    .reverse()
    .find((item) => item.category === "CASTIGO");
  confirmResult("COMPLETED", punishment?.cardId ?? null);
};
$("#finish-turn").onclick = () => {
  if (!requireOnlineGame()) return;
  if (!engine.finishTurn())
    return notify("Confirma primero el resultado del turno.");
  persist();
  renderGame();
  renderRewards();
};
$("#player-form").onsubmit = (e) => {
  e.preventDefault();
  if (!requireOnlineHost()) return;
  const input = $("#player-name"),
    name = input.value.trim();
  if (!name) return;
  state.participants.push({
    id: makeId("player"),
    name,
    active: true,
    preferences: {},
  });
  input.value = "";
  persist();
  render();
  notify(`${name} se añadió a la partida.`);
};
$("#position-reversed").onchange = (e) => {
  state.settings.positionReversed = e.target.checked;
  persist();
};
$("#card-search").oninput = renderCards;
$("#category-filter").onchange = renderCards;
$("#new-card").onclick = () => populateForm(null);
$("#new-manual").onclick = () => {
  dlgManual(
    {
      id: makeId("MANUAL"),
      title: "",
      summary: "",
      instructions: [],
      notes: "",
      pending: true,
      details: {},
    },
    true,
  );
};
[
  "#f-title",
  "#f-description",
  "#f-category",
  "#f-spice",
  "#f-units",
  "#f-penalty-enabled",
  "#f-duration",
].forEach((id) => $(id).addEventListener("input", updatePreview));
$("#card-form").onsubmit = saveCard;
$("#import-cards").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    const imported = parseCardImport(data, state.cards, state.manuals);
    state.cards.push(...imported);
    persist();
    renderCards();
    notify(`${imported.length} cartas importadas.`);
  } catch (err) {
    notify(`Importación rechazada: ${err.message}`);
  } finally {
    e.target.value = "";
  }
};
$("#export-cards").onclick = () =>
  downloadJSON("get-drunk-party-cartas.json", exportCardCatalog(state.cards));
$("#backup-export").onclick = () =>
  downloadJSON("get-drunk-party-respaldo.json", state);
$("#backup-import").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const incoming = JSON.parse(await file.text());
    if (
      !incoming ||
      incoming.version !== 1 ||
      !Array.isArray(incoming.cards) ||
      !Array.isArray(incoming.participants) ||
      !Array.isArray(incoming.manuals)
    )
      throw new Error("Estructura de respaldo no válida.");
    validateCards(incoming.cards, incoming.manuals);
    if (!Array.isArray(incoming.drinks) || !incoming.game)
      throw new Error("Faltan datos obligatorios.");
    state = incoming;
    engine = gameEngine(state);
    persist();
    render();
    notify("Respaldo restaurado.");
  } catch (err) {
    notify(`Respaldo rechazado: ${err.message}`);
  } finally {
    e.target.value = "";
  }
};
$("#drink-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    addDrink(state, $("#drink-name").value);
    $("#drink-name").value = "";
    persist();
    renderDrinks();
  } catch (err) {
    notify(err.message);
  }
};
$("#reset-game").onclick = () => {
  if (rolling)
    return notify(
      "Espera a que termine el dado antes de reiniciar la partida.",
    );
  confirmAction(
    "Reiniciar partida",
    "Se archivará el historial de la partida actual y se reiniciarán turno, mazos y premios. Se conservarán participantes, cartas, manuales y ajustes.",
    () => {
      const archive = state.game.history?.length
        ? { endedAt: new Date().toISOString(), history: structuredClone(state.game.history) }
        : null;
      state.game = {
        currentIndex: 0,
        state: "READY",
        decks: {},
        current: null,
        history: [],
        archives: [...(state.game.archives ?? []), ...(archive ? [archive] : [])].slice(-10),
        rewards: [],
      };
      engine = gameEngine(state);
      animateCardNext = false;
      animateCardId = null;
      const cube = $("#dice-cube");
      cube.dataset.rotationX = "0";
      cube.dataset.rotationY = "0";
      delete cube.dataset.face;
      cube.style.transform = "";
      cube.style.removeProperty("--face-color");
      persist();
      setView("game");
      notify("Partida reiniciada. Las cartas están disponibles de nuevo.");
    },
  );
};
$("#reset-data").onclick = () =>
  confirmAction(
    "Restaurar instalación",
    "Se sustituirán los datos locales por el catálogo inicial. Exporta un respaldo si lo necesitas.",
    () => {
      state = seedState();
      engine = gameEngine(state);
      persist();
      render();
      notify("Datos iniciales restaurados.");
    },
  );
$("#cancel-draw").onclick = () => {
  $("#empty-deck-dialog").close();
  engine.cancel();
  renderGame();
  persist();
};
$("#manage-deck").onclick = () => {
  $("#empty-deck-dialog").close();
  engine.cancel();
  setView("editor");
};
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("#install-button").classList.remove("hidden");
});
$("#install-button").onclick = async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else
    notify(
      "En Android: menú de Chrome → Instalar aplicación o Añadir a pantalla de inicio.",
    );
};
if ("serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker
    .register("./sw.js")
    .then(
      () =>
        ($("#storage-status").textContent =
          "Almacenamiento local activo. App lista para instalar cuando se sirva mediante HTTPS."),
    )
    .catch(
      () =>
        ($("#storage-status").textContent =
          "No se pudo registrar el modo offline en este origen. Usa HTTPS o localhost."),
    );
else
  $("#storage-status").textContent =
    "Service worker requiere HTTPS o localhost. No abras el HTML con file://.";
$("#app-version").textContent = VERSION;
render();
