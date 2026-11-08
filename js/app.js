import { CATEGORIES, GAME_ID, GAME_NAME, TARGETS, VERSION } from "./config.js";
import { GAMES_CATALOG } from "./games-catalog.js";
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
import { CHAIN_CHALLENGES } from "../data/chain-challenges.js";
import { POWER_CATALOG } from "../data/power-catalog.js";
import {
  closeCurrentRoom,
  connectRoom,
  disconnectRoom,
  getMultiplayerSession,
  getSavedProfile,
  getProfileIdentity,
  refreshRoom,
  saveConnectedProfile,
  saveUserProfile,
  registerProfileAccount,
  signInProfileAccount,
  signOutProfileAccount,
  scheduleRoomAction,
  scheduleRoomTimer,
  startRoom,
  takeRoomHost,
} from "./multiplayer.js";

let state = loadState(),
  engine = gameEngine(state),
  toastTimer;
let accountProfile = null;
let accountAuthenticated = false;
let authenticationMode = "login";
let registrationStep = 1;
let registrationAvatarUrl = null;
let profileEditing = false;
let profileAvatarDraft = null;
let avatarEditorContext = "profile";
state.game.fragments ??= [];
state.game.fragmentCompletions ??= 0;
let lastRenderedFragmentCompletions = state.game.fragmentCompletions;
let lastRenderedRoundEventId = state.game.activeRoundEvent?.id ?? null;
let animateCardNext = false;
let animateCardId = null;
let rolling = false;
let cemeteryAnimating = false;
let syncedRollStartedAt = null;
let timerState = { remainingMs: 30000, totalMs: 30000, endsAt: null, interval: null };
let onlineMode = false;
let authorizedTurnActionAt = 0;
let authorizedTurnActionUserId = null;
let playMode = "choose";
let applyingRemoteState = false;
let localModeBackup = null;
let roomPresence = [];
let selectedGameIndex = 0;
let homeCarouselDirection = 1;
let homeStackRenderedIndex = null;
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const diceFaceColor = (category) =>
  CATEGORIES[category]?.color ??
  (category === "BLOQUEADA" ? "#A5A5B4" : "#fff");
const AUXILIARY_DECKS = new Set(["PREMIO", "CASTIGO"]);
const PLAYER_AVATARS = Array.from({ length: 12 }, (_, index) =>
  `https://api.dicebear.com/10.x/big-smile/svg?seed=zevyra-character-${index + 1}&borderRadius=50`,
);
const savedLocalAvatar = localStorage.getItem("zevyra.local.avatar") || localStorage.getItem("zevyra.profile.avatar");
const isDicebearAvatar = (value) => typeof value === "string" && /^https:\/\/api\.dicebear\.com\/(?:7|10)\.x\/[a-z-]+\/svg\?/.test(value);
let selectedLocalAvatar = PLAYER_AVATARS.includes(savedLocalAvatar) || isDicebearAvatar(savedLocalAvatar) ? savedLocalAvatar : PLAYER_AVATARS[0];
if (!localStorage.getItem("zevyra.profile.avatarSeed")) localStorage.setItem("zevyra.profile.avatarSeed", crypto.randomUUID());
function localProfileUid() {
  try {
    const account = JSON.parse(localStorage.getItem("zevyra.local.account.session") || "null")?.user;
    if (/^zevy[A-Za-z0-9]{6}$/.test(account?.public_uid || "") || /^[A-Z0-9]{8}$/.test(account?.public_uid || "")) return account.public_uid;
  } catch { /* use this browser's guest UID */ }
  let uid = localStorage.getItem("zevyra.profile.publicUid");
  if (!uid) {
    uid = `zevy${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
    localStorage.setItem("zevyra.profile.publicUid", uid);
  }
  return uid;
}
function profileCountryFlag(code) {
  if (code === "XX") return "🌐";
  if (code === "OTHER") return "🏳️";
  if (!/^[A-Z]{2}$/.test(code || "")) return "🌐";
  return [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");
}
function initializeCountryChoices() {
  const source = $("#profile-country");
  const destination = $("#auth-country");
  if (!source || !destination) return;
  const prompt = new Option("Selecciona un país", "");
  destination.replaceChildren(prompt, ...[...source.options].filter((option) => option.value && option.value !== "XX").map((option) => option.cloneNode(true)));
}
initializeCountryChoices();
function updateProfileCard(profile) {
  if (!profile) return;
  accountProfile = profile;
  const username = profile.username || "Jugador";
  const uid = String(profile.public_uid || localProfileUid());
  const avatar = profile.avatar || profileAvatarUrl();
  const countryCode = (profile.country_code && /^[A-Z]{2}$/.test(profile.country_code)) || profile.country_code === "OTHER"
    ? profile.country_code : "XX";
  localStorage.setItem("zevyra.profile.name", username);
  localStorage.setItem("zevyra.profile.avatar", avatar);
  if (isDicebearAvatar(avatar) && avatar.includes("/big-smile/")) rememberAvatarSettings(avatar);
  $("#profile-nickname").value = username;
  $("#multiplayer-name").value = username;
  $("#profile-display-name").textContent = username;
  $("#profile-uid").textContent = `UID: #${uid}`;
  $("#profile-avatar-preview").src = avatar;
  $("#profile-avatar-preview-read").src = avatar;
  $("#nav-profile-avatar").src = avatar;
  $("#multiplayer-avatar").value = avatar;
  $("#multiplayer-avatar-preview").src = avatar;
  $("#profile-country").value = countryCode;
  $("#profile-country-flag").textContent = profileCountryFlag(countryCode);
  const countryLabel = [...$("#profile-country").options].find((option) => option.value === countryCode)?.textContent || "Sin seleccionar";
  $("#passport-country-name").textContent = countryLabel.replace(/^\S+\s*/, "");
  $("#passport-nickname-input").value = username;
  $("#passport-age-view").textContent = profile.age ? String(profile.age) : "—";
  $("#passport-age-input").value = profile.age || "";
  $("#passport-sex-view").textContent = profile.sex || "—";
  $("#passport-sex-input").value = profile.sex || "";
  $("#passport-sexual-identity-view").textContent = profile.sexual_identity || "—";
  $("#passport-sexual-identity-input").value = profile.sexual_identity || "";
  if (!$("#auth-country").value) $("#auth-country").value = countryCode === "XX" ? "" : countryCode;
  $("#auth-age").value ||= profile.age || "";
  $("#auth-sex").value ||= profile.sex || "";
  $("#auth-sexual-identity").value ||= profile.sexual_identity || "";
  $("#auth-avatar-preview").src = registrationAvatarUrl || avatar;
  if (!state.participants.length) $("#player-name").value = username;
}
function setAuthGate(open) {
  const gate = $("#auth-gate");
  gate.hidden = !open;
  [document.querySelector("header"), $("#nav"), $("#tools-nav"), $("main")].forEach((element) => {
    if (element) element.inert = open;
  });
  if (open) requestAnimationFrame(() => $("#profile-nickname").focus());
}
for (const face of DICE_FACES) {
  const side = document.createElement("div");
  side.className = `dice-face face-${face.surface}`;
  side.style.setProperty("--face-color", diceFaceColor(face.category));
  side.setAttribute("aria-hidden", "true");
  const symbol = document.createElement("span");
  symbol.className = "material-symbols-outlined dice-face-symbol";
  symbol.textContent = CATEGORIES[face.category]?.icon ?? "casino";
  side.append(symbol);
  $("#dice-cube").append(side);
}
const blankGame = () => ({ currentIndex: 0, state: "READY", decks: {}, current: null, history: [], cemetery: [], fragments: [], fragmentCompletions: 0, archives: [], rewards: [], jokerInventory: [], jokerProgress: {}, pendingJokerResolution: null, completedTurns: 0, completedRounds: 0, roundEventHistory: [], activeRoundEvent: null });
function snapshotForRoom() {
  const referencedIds = new Set([
    state.game.current?.primaryCard?.cardId,
    ...(state.game.current?.auxiliaryCards ?? []).map((item) => item.cardId),
  ].filter(Boolean));
  const cards = state.cards.filter((card) => referencedIds.has(card.id));
  const manualIds = new Set(cards.map((card) => card.manualId).filter(Boolean));
  return {
    gameId: GAME_ID,
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
  if (canControlOnlineGame()) {
    const session = onlineMode ? getMultiplayerSession() : null;
    if (session) {
      authorizedTurnActionAt = Date.now();
      authorizedTurnActionUserId = session.user.id;
    }
    return true;
  }
  notify(message);
  return false;
}
function canPlayOnlineGame() {
  const session = getMultiplayerSession();
  if (!onlineMode) return true;
  if (!session || session.status !== "playing") return false;
  const activeTurnPlayerId = state.game.chain?.activePlayerId ?? state.game.current?.playerId ?? state.participants[state.game.currentIndex]?.id;
  return activeTurnPlayerId === session.user.id;
}
function requireOnlineGame(message = "La partida online aún no está iniciada o solo el anfitrión puede controlarla.") {
  if (canPlayOnlineGame()) {
    const session = onlineMode ? getMultiplayerSession() : null;
    if (session) {
      authorizedTurnActionAt = Date.now();
      authorizedTurnActionUserId = session.user.id;
    }
    return true;
  }
  const currentName = state.game.current
    ? state.participants.find((player) => player.id === state.game.current.playerId)?.name
    : state.participants[state.game.currentIndex]?.name;
  notify(onlineMode && currentName ? `Es el turno de ${currentName}. Espera tu turno para jugar.` : message);
  return false;
}
function persist() {
  if (onlineMode) {
    const session = getMultiplayerSession();
    const recentlyAuthorized = session && authorizedTurnActionUserId === session.user.id && Date.now() - authorizedTurnActionAt < 2000;
    if (!applyingRemoteState && session?.status === "playing" && (canPlayOnlineGame() || recentlyAuthorized)) {
      scheduleRoomAction(snapshotForRoom(), roomTimerSnapshot(), handleRoomSaveError);
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
function readAvatarOptions() {
  try { return JSON.parse(localStorage.getItem("zevyra.profile.avatarOptions") || "{}"); }
  catch { return {}; }
}
function profileAvatarUrl(seed = localStorage.getItem("zevyra.profile.avatarSeed") || "zevyra-player", optionsOverride = null) {
  const params = new URLSearchParams({ seed, borderRadius: "50" });
  for (const [key, value] of Object.entries(optionsOverride ?? readAvatarOptions())) {
    if (value !== "" && value != null) params.set(key, String(value).replace(/^#/, ""));
  }
  return `https://api.dicebear.com/10.x/big-smile/svg?${params}`;
}
if (typeof selectedLocalAvatar === "string" && selectedLocalAvatar.includes("/personas/svg?")) {
  selectedLocalAvatar = profileAvatarUrl();
  localStorage.setItem("zevyra.local.avatar", selectedLocalAvatar);
}
let migratedLegacyAvatars = false;
state.participants.forEach((player, index) => {
  if (typeof player.avatar === "string" && player.avatar.includes("/personas/svg?")) {
    player.avatar = profileAvatarUrl();
    migratedLegacyAvatars = true;
  } else if (!isDicebearAvatar(player.avatar)) {
    player.avatar = PLAYER_AVATARS[index % PLAYER_AVATARS.length];
    migratedLegacyAvatars = true;
  }
});
if (migratedLegacyAvatars) saveState(state);
function rememberAvatarSettings(avatar) {
  if (!isDicebearAvatar(avatar) || !avatar.includes("/big-smile/")) return;
  try {
    const params = new URL(avatar).searchParams;
    if (params.get("seed")) localStorage.setItem("zevyra.profile.avatarSeed", params.get("seed"));
    const options = {};
    for (const [key, value] of params.entries()) {
      if (key === "seed" || key === "borderRadius") continue;
      options[key] = key.toLowerCase().includes("color") ? "#" + value.replace(/^#/, "") : value;
    }
    localStorage.setItem("zevyra.profile.avatarOptions", JSON.stringify(options));
    if (avatarDraftOptions) avatarDraftOptions = { ...options };
    $$(".avatar-option-tile").forEach((tile) => tile.classList.toggle("is-selected", options[tile.dataset.optionKey] === tile.dataset.optionValue));
  } catch { /* Keep the local avatar if an older profile URL cannot be parsed. */ }
}
function applyProfileBannerColor(color) {
  const banner = $(".player-id-banner");
  if (!banner) return;
  const safeColor = /^#[\da-f]{6}$/i.test(color || "") ? color : "#41166e";
  banner.style.setProperty("--profile-banner-color", safeColor);
}
const AVATAR_OPTION_LABELS = {
  hairVariant: "Cabello", hairColor: "Color del cabello", eyesVariant: "Ojos",
  mouthVariant: "Boca", skinColor: "Tono de piel", accessoriesVariant: "Accesorios",
  facialHairVariant: "Vello facial", eyebrowsVariant: "Cejas", backgroundColor: "Color de fondo",
};
let avatarDraftSeed = null;
let avatarDraftOptions = null;
let avatarEditingPlayerId = null;
let avatarEditorLoadPromise = null;
let avatarEditorOptionItems = [];
let avatarEditorActiveCategory = "";
function avatarOptionLabel(key) {
  if (AVATAR_OPTION_LABELS[key]) return AVATAR_OPTION_LABELS[key];
  return key.replace(/Variant$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}
function updateAvatarEditorPreview() {
  const avatar = profileAvatarUrl(avatarDraftSeed || undefined, avatarDraftOptions ?? readAvatarOptions());
  $("#avatar-editor-preview").src = avatar;
  return avatar;
}
function avatarDetailsFromUrl(avatar) {
  try {
    const url = new URL(avatar);
    if (!isDicebearAvatar(avatar)) return { seed: crypto.randomUUID(), options: {} };
    const seed = url.searchParams.get("seed") || crypto.randomUUID();
    const options = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key === "seed" || key === "borderRadius") continue;
      options[key] = key.toLowerCase().includes("color") ? `#${value.replace(/^#/, "")}` : value;
    }
    return { seed, options };
  } catch {
    return { seed: crypto.randomUUID(), options: {} };
  }
}
function setAvatarEditorOptions(options = {}) {
  avatarDraftOptions = { ...options };
  $$(".avatar-option-tile").forEach((tile) => tile.classList.toggle("is-selected", options[tile.dataset.optionKey] === tile.dataset.optionValue));
  updateAvatarEditorPreview();
}
function loadAvatarEditorOptions() {
  avatarEditorLoadPromise ??= fetchAvatarEditorOptions();
  return avatarEditorLoadPromise;
}
function avatarCategoryFor(key) {
  if (/skin/i.test(key)) return "Color de piel";
  if (/hair|facialHair/i.test(key)) return "Cabello";
  if (/eye|eyebrow|glasses/i.test(key)) return "Ojos";
  if (/mouth|expression/i.test(key)) return "Boca / expresión";
  if (/background/i.test(key)) return "Fondo";
  if (/clothing|accessor|hat/i.test(key)) return "Vestuario";
  return "Detalles";
}
function avatarPaletteFor(key) {
  if (/skin/i.test(key)) return ["#f7dfce", "#efc5a5", "#dba27d", "#bf805d", "#925b42", "#603b2e", "#38251f"];
  if (/hair/i.test(key)) return ["#211b24", "#49302a", "#815139", "#c18a52", "#e2c778", "#a63550", "#753fb1", "#3280a4"];
  if (/background/i.test(key)) return ["#261735", "#51306c", "#f2d9f3", "#f7d6e7", "#d4eafa", "#d9f0df", "#f6e5c7"];
  if (/clothing/i.test(key)) return ["#271b43", "#743c9f", "#c64282", "#df6356", "#26858a", "#4165aa", "#e2c46c", "#f2eaf6"];
  return ["#211b24", "#6d45aa", "#bd477d", "#d38845", "#4d8c7c", "#6282bd", "#f0d3aa", "#ece7f2"];
}
function avatarOptionValues(key, descriptor) {
  if (descriptor && descriptor.type === "color") return avatarPaletteFor(key);
  if (Array.isArray(descriptor && descriptor.values)) return descriptor.values;
  if (Array.isArray(descriptor && descriptor.options)) return descriptor.options;
  return [];
}
function avatarOptionName(value, index) {
  const text = String(value).replace(/^variant/i, "Modelo ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/[_-]/g, " ");
  return /^#[\da-f]{6}$/i.test(text) ? "Color " + (index + 1) : text || "Opción " + (index + 1);
}
async function fetchAvatarEditorOptions() {
  const host = $("#avatar-editor-controls");
  const saved = avatarDraftOptions ?? readAvatarOptions();
  try {
    const response = await fetch("https://api.dicebear.com/10.x/big-smile/options.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const descriptors = await response.json();
    const items = Object.entries(descriptors).flatMap(([key, descriptor]) => {
      if (["seed", "borderRadius", "radius", "size"].includes(key)) return [];
      const values = avatarOptionValues(key, descriptor);
      return values.length ? [{ key, label: avatarOptionLabel(key), category: avatarCategoryFor(key), values }] : [];
    });
    if (!items.length) throw new Error("DiceBear no devolvió opciones visuales.");
    avatarEditorOptionItems = items;
    const categories = [...new Set(items.map((item) => item.category))];
    const tabs = $("#avatar-editor-tabs");
    tabs.replaceChildren(...categories.map((category, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "avatar-editor-tab" + (index === 0 ? " is-active" : "");
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === 0));
      button.textContent = category;
      button.dataset.category = category;
      return button;
    }));
    avatarEditorActiveCategory = categories[0] || "";
    const fragment = document.createDocumentFragment();
    for (const category of categories) {
      const section = document.createElement("section");
      section.className = "avatar-option-group" + (category === avatarEditorActiveCategory ? " is-active" : "");
      section.dataset.category = category;
      for (const item of items.filter((candidate) => candidate.category === category)) {
        const group = document.createElement("div");
        group.className = "avatar-option-set";
        const heading = document.createElement("h3");
        heading.textContent = item.label;
        group.append(heading);
        const grid = document.createElement("div");
        grid.className = "avatar-option-grid";
        for (const [index, value] of item.values.entries()) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "avatar-option-tile";
          button.dataset.optionKey = item.key;
          button.dataset.optionValue = String(value);
          button.setAttribute("aria-label", item.label + ": " + avatarOptionName(value, index));
          const preview = document.createElement("img");
          preview.src = profileAvatarUrl(avatarDraftSeed || "zevyra-catalog", { ...saved, [item.key]: value });
          preview.alt = "";
          preview.loading = "lazy";
          const title = document.createElement("span");
          title.textContent = avatarOptionName(value, index);
          button.append(preview, title);
          button.classList.toggle("is-selected", saved[item.key] === value);
          grid.append(button);
        }
        group.append(grid);
        section.append(group);
      }
      fragment.append(section);
    }
    const randomize = document.createElement("button");
    randomize.type = "button";
    randomize.className = "button avatar-randomize";
    randomize.textContent = "Nuevo personaje";
    randomize.addEventListener("click", () => {
      avatarDraftSeed = crypto.randomUUID();
      updateAvatarEditorPreview();
    });
    host.replaceChildren(fragment, randomize);
    $("#avatar-editor-tabs").onclick = (event) => {
      const tab = event.target.closest(".avatar-editor-tab");
      if (!tab) return;
      avatarEditorActiveCategory = tab.dataset.category;
      $$(".avatar-editor-tab").forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      $$(".avatar-option-group").forEach((group) => group.classList.toggle("is-active", group.dataset.category === avatarEditorActiveCategory));
    };
    host.onclick = (event) => {
      const option = event.target.closest(".avatar-option-tile");
      if (!option) return;
      avatarDraftOptions = { ...(avatarDraftOptions ?? saved), [option.dataset.optionKey]: option.dataset.optionValue };
      $$(".avatar-option-tile").forEach((tile) => tile.classList.toggle("is-selected", avatarDraftOptions[tile.dataset.optionKey] === tile.dataset.optionValue));
      updateAvatarEditorPreview();
    };
    updateAvatarEditorPreview();
  } catch (error) {
    const message = document.createElement("p");
    message.className = "fine-print avatar-editor-error";
    message.textContent = "No se cargaron las opciones de DiceBear. Comprueba tu conexión y vuelve a intentarlo.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button avatar-randomize";
    retry.textContent = "Reintentar";
    retry.addEventListener("click", () => { avatarEditorLoadPromise = null; void loadAvatarEditorOptions(); });
    host.replaceChildren(message, retry);
    avatarEditorLoadPromise = null;
    console.warn("No se pudieron cargar las opciones Big Smile", error);
  }
}
function renderAvatar(target, avatar) {
  if (!target) return;
  target.replaceChildren();
  if (typeof avatar === "string" && /^https:\/\/api\.dicebear\.com\/(?:7|10)\.x\/[a-z-]+\/svg\?/.test(avatar)) {
    const image = document.createElement("img");
    image.src = avatar; image.alt = ""; image.loading = "lazy";
    target.append(image);
  } else {
    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.textContent = "person";
    target.append(icon);
  }
}
function multiplayerErrorMessage(error) {
  const message = String(error?.message ?? error ?? "");
  const code = String(error?.code ?? "");
  if (/user already registered|user_already_exists|already been registered/i.test(message)) return "Ese nickname ya está registrado.";
  if (/invalid login credentials|invalid_credentials/i.test(message)) return "El usuario o la contraseña no coinciden.";
  if (/relation .* does not exist|schema cache|rooms|room_players|game_states/i.test(message) || code === "PGRST205" || code === "42P01") return "Falta una tabla o función de las salas multijugador. Aplica las migraciones de supabase/sql/ en orden.";
  if (/ROOM_CODE_INVALID/i.test(message)) return "El código debe tener seis letras o números válidos.";
  if (/ROOM_NOT_FOUND/i.test(message)) return "No existe una sala con ese código. Revísalo e inténtalo de nuevo.";
  if (/ROOM_EXPIRED/i.test(message)) return "Esta sala venció. Pide un código nuevo al anfitrión.";
  if (/ROOM_FULL/i.test(message)) return "La sala está llena.";
  if (/ROOM_IN_PROGRESS/i.test(message)) return "La partida ya comenzó y no acepta nuevos participantes.";
  if (/ROOM_CLOSED|ROOM_NOT_WAITING/i.test(message)) return "La sala está cerrada y no acepta jugadores.";
  if (/AUTH_REQUIRED/i.test(message) || /Anonymous|anonymous/i.test(message)) return "No se pudo validar tu sesión online. Activa Anonymous Sign-Ins en Supabase.";
  if (code === "42501" || /ROOM_MEMBERSHIP_REQUIRED/i.test(message)) return "Tu sesión no tiene permiso para entrar a esta sala.";
  if (code === "PGRST202" || /could not find the function/i.test(message)) {
    return /gdp_act_turn|gdp_refresh_room_profile|gdp_save_shared_timer/i.test(message)
      ? "Supabase necesita la migración 006_turn_actions_and_profile.sql para acciones de turno y alias de sala."
      : "Supabase no tiene actualizadas las funciones de sala. Aplica la migración 005_room_join_diagnostics.sql y vuelve a intentarlo.";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return "No hay conexión con Supabase. Revisa internet e inténtalo de nuevo.";
  if (/NEED_TWO_PLAYERS/i.test(message)) return "Se necesitan al menos dos jugadores para iniciar.";
  if (/HOST_REQUIRED/i.test(message)) return "Solo el anfitrión puede realizar esa acción.";
  if (/HOST_STILL_ACTIVE/i.test(message)) return "El anfitrión sigue conectado; no es necesario transferir el control.";
  if (/VERSION_CONFLICT/i.test(message)) return "La partida cambió en otro dispositivo. Se está actualizando.";
  if (/TURN_OWNER_REQUIRED/i.test(message)) return "Solo quien tiene el turno puede realizar esta acción.";
  if (/ROOM_GAME_MISMATCH/i.test(message)) return "Esta sala pertenece a otra experiencia de ZEVYRA.";
  if (/Invalid API key|JWT/i.test(message)) return "La URL y la clave de Supabase no corresponden o no son válidas.";
  if (code === "23505") return "Esta sesión ya está registrada en la sala.";
  if (message) return `Supabase: ${message.slice(0, 180)}`;
  return "No se pudo completar la acción online. Inténtalo de nuevo.";
}
function logMultiplayerError(phase, error) {
  const message = String(error?.message ?? error ?? "").replace(/eyJ[a-zA-Z0-9._-]+/g, "[redacted]");
  console.warn("[ZEVYRA multiplayer]", { phase, code: error?.code ?? null, message });
}
function handleRoomSaveError(error) {
  if (/VERSION_CONFLICT/i.test(String(error?.message ?? error))) {
    refreshRoom().catch((refreshError) => notify(multiplayerErrorMessage(refreshError)));
    return;
  }
  notify(multiplayerErrorMessage(error));
}
function enterOnlineMode() {
  playMode = "online";
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
  if (!onlineMode) return;
  if (!localModeBackup) {
    onlineMode = false;
    applyingRemoteState = false;
    roomPresence = [];
    return;
  }
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
  $("#multiplayer-name").disabled = Boolean(session);
  $("#multiplayer-avatar").disabled = Boolean(session);
  if (!session) return;
  $("#multiplayer-name").value = session.profile.username;
  $("#multiplayer-avatar").value = session.profile.avatar || PLAYER_AVATARS[0];
  $("#multiplayer-room-code").textContent = session.code;
  const roomStatus = details?.room?.status ?? session.status;
  $("#multiplayer-room-status").textContent = roomStatus === "waiting" ? "Esperando jugadores" : roomStatus === "playing" ? "Partida en curso" : "Sala cerrada";
  $("#multiplayer-start").classList.toggle("hidden", session.role !== "host" || session.status !== "waiting");
  $("#multiplayer-claim-host").classList.toggle("hidden", session.role === "host" || session.status === "closed");
  $("#multiplayer-close").classList.toggle("hidden", session.role !== "host" || session.status === "closed");
  $("#multiplayer-leave").textContent = session.role === "host" ? "Transferir anfitrión y salir" : "Salir de sala";
  const playersHost = $("#multiplayer-room-players");
  playersHost.replaceChildren();
  const players = details?.players ?? state.participants.map((player) => ({
    user_id: player.id, username_snapshot: player.name, avatar_snapshot: player.avatar, role: player.id === session.user.id ? session.role : "player", status: "joined",
  }));
  $("#multiplayer-player-count").textContent = players.length + (players.length === 1 ? " jugador" : " jugadores");
  $("#multiplayer-start").disabled = players.length < 2;
  for (const player of players) {
    const item = document.createElement("li");
    item.className = "lobby-player-row";
    const isOnline = roomPresence.some((presence) => presence.userId === player.user_id);
    const avatar = document.createElement("span");
    avatar.className = "player-avatar";
    renderAvatar(avatar, player.avatar_snapshot);
    const detailsEl = document.createElement("span");
    detailsEl.className = "lobby-player-details";
    const name = document.createElement("strong");
    name.textContent = player.username_snapshot;
    const status = document.createElement("small");
    status.textContent = `${player.role === "host" ? "Anfitrión · " : ""}${isOnline ? "Conectado" : "En sala"}`;
    detailsEl.append(name, status);
    item.append(avatar, detailsEl);
    playersHost.append(item);
  }
}
function applyOnlineSnapshot(roomState, timer, version, details = null) {
  if (roomState?.gameId && roomState.gameId !== GAME_ID) {
    notify("Esta sala pertenece a otra experiencia de ZEVYRA.");
    return;
  }
  const oldTurn = state.game.current;
  const priorRoundEvent = state.game.activeRoundEvent;
  const oldCardIds = new Set([oldTurn?.primaryCard?.cardId, ...(oldTurn?.auxiliaryCards ?? []).map((item) => item.cardId)].filter(Boolean));
  const incomingTurn = roomState?.game?.current;
  const sessionBeforeApply = getMultiplayerSession();
  const animateIncomingRoll = Boolean(
    incomingTurn?.phase === "ROLLING" && incomingTurn.rollStartedAt &&
    incomingTurn.rollStartedAt !== oldTurn?.rollStartedAt &&
    incomingTurn.playerId !== sessionBeforeApply?.user.id
  );
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
  if (animateIncomingRoll) rolling = true;
  if (roomState?.settings) state.settings = { ...state.settings, ...roomState.settings };
  if (Array.isArray(roomState?.cards)) {
    const remoteIds = new Set(roomState.cards.map((card) => card.id));
    state.cards = [...state.cards.filter((card) => !remoteIds.has(card.id)), ...structuredClone(roomState.cards)];
  }
  if (Array.isArray(roomState?.manuals)) {
    const remoteIds = new Set(roomState.manuals.map((manual) => manual.id));
    state.manuals = [...state.manuals.filter((manual) => !remoteIds.has(manual.id)), ...structuredClone(roomState.manuals)];
  }
  syncLocalRoundEventDecks(priorRoundEvent, state.game.activeRoundEvent);
  const nextTurn = state.game.current;
  const incomingCards = [nextTurn?.primaryCard, ...(nextTurn?.auxiliaryCards ?? [])].filter((item) => item && !oldCardIds.has(item.cardId));
  if (incomingCards.length) {
    animateCardNext = true;
    animateCardId = incomingCards.at(-1).cardId;
  }
  engine = gameEngine(state);
  if (timer) applySharedTimer(timer);
  applyingRemoteState = false;
  const session = getMultiplayerSession();
  $("#multiplayer-connection").textContent = session?.status === "playing" ? "Partida sincronizada" : session?.status === "closed" ? "Sala cerrada" : "Conectado";
  renderMultiplayerRoom(details);
  render();
  if (animateIncomingRoll) {
    const face = DICE_FACES.find((item) => item.id === Number(nextTurn.diceFace));
    if (face) animateDiceRoll(face, Number(nextTurn.rollStartedAt), null, true);
    else rolling = false;
  }
  if ((details?.room?.status ?? session?.status) === "playing") {
    setView("game");
  }
}
function syncLocalRoundEventDecks(previousEvent, nextEvent) {
  if (["horrors", "destiny"].includes(nextEvent?.effect)) {
    for (const card of state.cards) {
      if (!["normal", "horrors", "curse"].includes(card.collection)) continue;
      card.enabled = nextEvent.effect === "horrors"
        ? card.collection === "horrors"
        : card.id.startsWith("CC_DESTINO_");
    }
    state.game.decks = {};
  } else if (["horrors", "destiny"].includes(previousEvent?.effect) && previousEvent.savedEnabledStates) {
    for (const card of state.cards) {
      if (card.id in previousEvent.savedEnabledStates) {
        card.enabled = previousEvent.savedEnabledStates[card.id];
      }
    }
    state.game.decks = previousEvent.savedDecks ?? {};
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
  let username = $("#profile-nickname").value.trim() || localStorage.getItem("zevyra.profile.name") || "";
  if (!username) {
    try {
      const savedProfile = await getSavedProfile();
      username = savedProfile?.username ?? "";
      if (username) {
        $("#profile-nickname").value = username;
        localStorage.setItem("zevyra.profile.name", username);
      }
    } catch (error) {
      logMultiplayerError("load-profile", error);
    }
  }
  if (!username) {
    notify("Configura tu nickname antes de entrar a una partida.");
    setView("profile");
    return false;
  }
  $("#multiplayer-name").value = username;
  const maxPlayers = Number($("#multiplayer-capacity").value);
  if (mode === "create" && (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 30))
    return notify("El máximo de jugadores debe estar entre 2 y 30.");
  const initialState = {
    gameId: GAME_ID,
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
    avatar: $("#multiplayer-avatar").value,
      onPresence: (presence) => {
        roomPresence = presence;
        renderMultiplayerRoom();
      },
      onStatus: (status, error) => {
        $("#multiplayer-connection").textContent = status === "connected" ? "Conectado" : status === "reconnecting" ? "Reconectando…" : status === "error" ? multiplayerErrorMessage(error) : status;
      },
    });
    $("#multiplayer-name").value = connection.session.profile.username;
    $("#profile-nickname").value = connection.session.profile.username;
    $("#profile-display-name").textContent = connection.session.profile.username;
    if (connection.session.profile.public_uid) $("#profile-uid").textContent = `UID: #${connection.session.profile.public_uid}`;
    localStorage.setItem("zevyra.profile.name", connection.session.profile.username);
    renderMultiplayerRoom(connection.snapshot);
    setView(connection.session.status === "playing" ? "game" : "multiplayer");
    return true;
  } catch (error) {
    logMultiplayerError(mode === "create" ? "create-room" : "join-room", error);
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
  playMode = "choose";
  $("#multiplayer-connection").textContent = "Desconectado";
  renderMultiplayerRoom();
}

const savedProfileName = localStorage.getItem("zevyra.profile.name") || "";
$("#multiplayer-name").value = savedProfileName;
$("#profile-nickname").value = savedProfileName;
$("#profile-display-name").textContent = savedProfileName || "Jugador";
$("#player-name").value = savedProfileName;
$("#profile-uid").textContent = `UID: #${localProfileUid()}`;
for (const [index, avatar] of PLAYER_AVATARS.entries()) {
  const avatarButton = document.createElement("button");
  avatarButton.type = "button";
  avatarButton.className = "avatar-choice";
  avatarButton.dataset.avatar = avatar;
  avatarButton.setAttribute("aria-label", `Elegir personaje ${index + 1}`);
  avatarButton.setAttribute("aria-pressed", String(avatar === selectedLocalAvatar));
  const avatarImage = document.createElement("img");
  avatarImage.src = avatar;
  avatarImage.alt = "";
  avatarImage.loading = "lazy";
  avatarButton.append(avatarImage);
  avatarButton.onclick = () => {
    selectedLocalAvatar = avatar;
    localStorage.setItem("zevyra.local.avatar", avatar);
    $$("#player-avatar-choices .avatar-choice").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.avatar === avatar)));
  };
  $("#player-avatar-choices").append(avatarButton);
}
const savedOnlineAvatar = localStorage.getItem("zevyra.profile.avatar");
const profileAvatarChoice = document.createElement("button");
profileAvatarChoice.type = "button";
profileAvatarChoice.className = "avatar-choice avatar-choice-profile";
profileAvatarChoice.dataset.avatar = profileAvatarUrl();
profileAvatarChoice.title = "Usar mi avatar de perfil";
profileAvatarChoice.setAttribute("aria-label", "Usar mi avatar de perfil");
const profileAvatarImage = document.createElement("img");
profileAvatarImage.src = profileAvatarChoice.dataset.avatar;
profileAvatarImage.alt = "";
profileAvatarChoice.append(profileAvatarImage);
profileAvatarChoice.onclick = () => {
  selectedLocalAvatar = profileAvatarUrl();
  localStorage.setItem("zevyra.local.avatar", selectedLocalAvatar);
  $$("#player-avatar-choices .avatar-choice").forEach((button) => button.setAttribute("aria-pressed", String(button === profileAvatarChoice)));
};
$("#player-avatar-choices").append(profileAvatarChoice);
$("#multiplayer-avatar").value = profileAvatarUrl();
$("#multiplayer-name").addEventListener("change", () => localStorage.setItem("zevyra.profile.name", $("#multiplayer-name").value.trim()));
function setRegistrationStep(step) {
  registrationStep = step === 2 ? 2 : 1;
  const isRegister = authenticationMode === "register";
  const identityEnabled = isRegister && registrationStep === 2;
  $("#auth-stepper").hidden = !isRegister;
  $("#auth-step-label").textContent = `Paso ${registrationStep} de 2`;
  $$(".auth-step-dots i").forEach((dot, index) => dot.classList.toggle("is-current", index + 1 === registrationStep));
  $("#auth-credentials-step").hidden = isRegister && registrationStep === 2;
  $("#auth-identity-step").hidden = !isRegister || registrationStep !== 2;
  $("#account-back").hidden = !isRegister || registrationStep !== 2;
  $("#account-submit").textContent = !isRegister ? "Iniciar sesión" : registrationStep === 1 ? "Continuar" : "Crear cuenta";
  $("#account-password").autocomplete = isRegister ? "new-password" : "current-password";
  $$("#auth-identity-step input, #auth-identity-step select, #auth-identity-step button").forEach((control) => {
    control.disabled = !identityEnabled;
  });
}
function setAuthenticationMode(kind) {
  authenticationMode = kind === "register" ? "register" : "login";
  const isRegister = authenticationMode === "register";
  registrationAvatarUrl = null;
  $("#account-login").classList.toggle("active", !isRegister);
  $("#account-register").classList.toggle("active", isRegister);
  $("#account-login").setAttribute("aria-selected", String(!isRegister));
  $("#account-register").setAttribute("aria-selected", String(isRegister));
  if (isRegister && !$("#auth-country").value && accountProfile?.country_code && accountProfile.country_code !== "XX") $("#auth-country").value = accountProfile.country_code;
  $("#auth-avatar-preview").src = registrationAvatarUrl || profileAvatarUrl();
  $("#auth-status").textContent = "";
  setRegistrationStep(1);
}
async function authenticateProfile(event) {
  event.preventDefault();
  if (authenticationMode === "register" && registrationStep === 1) {
    if (!$("#account-form").reportValidity()) return;
    $("#auth-status").textContent = "";
    setRegistrationStep(2);
    $("#auth-country").focus();
    return;
  }
  if (authenticationMode === "register" && !$("#account-form").reportValidity()) return;
  const username = $("#profile-nickname").value.trim();
  const password = $("#account-password").value;
  if (!username || !password) return;
  $("#account-submit").disabled = true;
  $("#auth-status").textContent = "";
  try {
    const identity = authenticationMode === "register" ? {
      age: Number($("#auth-age").value),
      sex: $("#auth-sex").value,
      sexual_identity: $("#auth-sexual-identity").value.trim(),
    } : {};
    const avatar = registrationAvatarUrl || profileAvatarUrl();
    const user = authenticationMode === "register"
      ? await registerProfileAccount(username, password, avatar, $("#auth-country").value, identity)
      : await signInProfileAccount(username, password);
    accountAuthenticated = true;
    registrationAvatarUrl = null;
    updateProfileCard(user);
    $("#account-password").value = "";
    setPassportEditMode(false);
    setAuthGate(false);
    setView("home");
    render();
    notify(authenticationMode === "register" ? "Cuenta creada." : "Sesión iniciada.");
  } catch (error) {
    logMultiplayerError(`profile-${authenticationMode}`, error);
    $("#auth-status").textContent = error.message || "No se pudo completar el acceso.";
  } finally {
    $("#account-submit").disabled = false;
  }
}
$("#account-register").onclick = () => setAuthenticationMode("register");
$("#account-login").onclick = () => setAuthenticationMode("login");
$("#account-back").onclick = () => setRegistrationStep(1);
$("#account-form").addEventListener("submit", authenticateProfile);
$("#account-logout").onclick = async () => {
  try {
    if (getMultiplayerSession()) {
      try { await disconnectRoom(); }
      catch (error) { logMultiplayerError("logout-room", error); }
    }
    await signOutProfileAccount();
    accountAuthenticated = false;
    accountProfile = null;
    onlineMode = false;
    playMode = "choose";
    $("#account-password").value = "";
    $("#auth-status").textContent = "Sesión cerrada.";
    setAuthenticationMode("login");
    setAuthGate(true);
    render();
  } catch (error) { notify(error.message || "No se pudo cerrar la cuenta local."); }
};
function setPassportEditMode(editing) {
  profileEditing = Boolean(editing);
  const card = $(".player-id-card");
  card.classList.toggle("is-editing", profileEditing);
  $$('[data-passport-edit]').forEach((control) => { control.hidden = !profileEditing; });
  $("#profile-avatar-edit").hidden = !profileEditing;
  $("#passport-edit-actions").hidden = !profileEditing;
  $("#passport-edit-toggle").setAttribute("aria-label", profileEditing ? "Cerrar edición del pasaporte" : "Editar pasaporte");
  $("#passport-edit-toggle").title = profileEditing ? "Cerrar edición" : "Editar pasaporte";
  if (profileEditing) {
    const profile = accountProfile || {};
    $("#passport-nickname-input").value = profile.username || "";
    $("#passport-age-input").value = profile.age || "";
    $("#passport-sex-input").value = profile.sex || "";
    $("#passport-sexual-identity-input").value = profile.sexual_identity || "";
    $("#profile-country").value = profile.country_code || "XX";
    profileAvatarDraft = profile.avatar || profileAvatarUrl();
  } else {
    profileAvatarDraft = null;
  }
}
function syncProfileAvatar(avatar, previousAvatar) {
  if (isDicebearAvatar(avatar)) rememberAvatarSettings(avatar);
  localStorage.setItem("zevyra.profile.avatar", avatar);
  profileAvatarChoice.dataset.avatar = avatar;
  profileAvatarImage.src = avatar;
  $("#multiplayer-avatar").value = avatar;
  $("#multiplayer-avatar-preview").src = avatar;
  if (isDicebearAvatar(selectedLocalAvatar) && (!previousAvatar || selectedLocalAvatar === previousAvatar)) {
    selectedLocalAvatar = avatar;
    localStorage.setItem("zevyra.local.avatar", avatar);
  }
  state.participants.forEach((player) => {
    if ((previousAvatar && player.avatar === previousAvatar) || (isDicebearAvatar(player.avatar) && player.avatar.includes("/personas/"))) player.avatar = avatar;
  });
  if (!onlineMode) persist();
}
$("#passport-edit-toggle").onclick = () => setPassportEditMode(!profileEditing);
$("#passport-cancel").onclick = () => { updateProfileCard(accountProfile); setPassportEditMode(false); };
$("#passport-save").onclick = async () => {
  const nickname = $("#passport-nickname-input").value.trim();
  const countryCode = $("#profile-country").value;
  const ageInput = $("#passport-age-input");
  const sex = $("#passport-sex-input").value;
  if (!nickname || !countryCode || !ageInput.value || !sex || !$("#passport-nickname-input").checkValidity() || !ageInput.checkValidity()) {
    notify("Completa nickname, nacionalidad, edad y sexo para guardar el pasaporte.");
    return;
  }
  const identity = { age: Number(ageInput.value), sex, sexual_identity: $("#passport-sexual-identity-input").value.trim() };
  const avatar = profileAvatarDraft || accountProfile?.avatar || profileAvatarUrl();
  const previousAvatar = accountProfile?.avatar || "";
  $("#passport-save").disabled = true;
  try {
    const updated = await saveUserProfile(nickname, avatar, countryCode, identity);
    if (!updated) throw new Error("Inicia sesión de nuevo para guardar los cambios.");
    if (avatar !== previousAvatar) syncProfileAvatar(avatar, previousAvatar);
    updateProfileCard(updated);
    setPassportEditMode(false);
    render();
    notify("Pasaporte actualizado.");
  } catch (error) {
    notify(error.message || "No se pudieron guardar los cambios del pasaporte.");
  } finally {
    $("#passport-save").disabled = false;
  }
};
$("#multiplayer-create-form").onsubmit = async (event) => {
  event.preventDefault();
  await connectOnlineRoom("create");
};
$("#multiplayer-join-form").onsubmit = async (event) => {
  event.preventDefault();
  const normalizedCode = $("#multiplayer-code").value.replace(/\s+/g, "").toUpperCase();
  $("#multiplayer-code").value = normalizedCode;
  await connectOnlineRoom("join", normalizedCode);
};
$("#multiplayer-start").onclick = async () => {
  if (!requireOnlineHost()) return;
  state.game = blankGame();
  try {
    await startRoom(snapshotForRoom());
    renderMultiplayerRoom();
    setView("game");
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
$("#multiplayer-copy-code").onclick = async () => {
  const code = getMultiplayerSession()?.code; 
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    notify("Código copiado.");
  } catch {
    const field = $("#multiplayer-code");
    field.value = code;
    field.focus();
    field.select();
    notify("Seleccionamos el código para que puedas copiarlo.");
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
    scheduleRoomTimer(roomTimerSnapshot(), handleRoomSaveError);
  }
}
function setView(view) {
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${view}`));
  $$("#nav .nav-link").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  $$("#tools-nav .nav-link").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  $("#tools-nav").classList.remove("open");
  $("#tools-nav").hidden = true;
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  if (view === "game" && playMode === "online" && getMultiplayerSession()?.status === "playing") playMode = "online";
  history.replaceState(null, "", view === "home" ? "#inicio" : view === "games" ? "#juegos" : `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
  if (view === "profile" && accountAuthenticated) void refreshProfileIdentity();
}
async function refreshProfileIdentity() {
  try {
    const profile = await getSavedProfile();
    if (!profile) {
      accountAuthenticated = false;
      setAuthGate(true);
      return;
    }
    accountAuthenticated = true;
    updateProfileCard(profile);
    if (profile.avatar && isDicebearAvatar(profile.avatar) && profile.avatar.includes("/big-smile/")) {
      rememberAvatarSettings(profile.avatar);
      profileAvatarChoice.dataset.avatar = profile.avatar;
      profileAvatarImage.src = profile.avatar;
      $("#multiplayer-avatar").value = profile.avatar;
      $("#multiplayer-avatar-preview").src = profile.avatar;
      localStorage.setItem("zevyra.profile.avatar", profile.avatar);
      const localAvatar = localStorage.getItem("zevyra.local.avatar");
      if (!localAvatar || isDicebearAvatar(localAvatar)) {
        selectedLocalAvatar = profile.avatar;
        localStorage.setItem("zevyra.local.avatar", profile.avatar);
        $$("#player-avatar-choices .avatar-choice").forEach((button) => button.setAttribute("aria-pressed", String(button === profileAvatarChoice)));
      }
    }
  } catch (error) {
    logMultiplayerError("profile-identity", error);
    if (!accountProfile) setAuthGate(true);
  }
}
async function initializeAccountAccess() {
  setAuthGate(true);
  setAuthenticationMode("login");
  try {
    const profile = await getSavedProfile();
    if (!profile) {
      accountAuthenticated = false;
      $("#auth-status").textContent = "";
      return;
    }
    accountAuthenticated = true;
    updateProfileCard(profile);
    setAuthGate(false);
  } catch (error) {
    accountAuthenticated = false;
    $("#auth-status").textContent = error.message || "Inicia sesión o regístrate para continuar.";
    setAuthGate(true);
  }
}
function renderGameLibrary() {
  const host = $("#games-library");
  if (!host) return;
  if (host.dataset.rendered === "true") return;
  host.replaceChildren();
  for (const game of GAMES_CATALOG) {
    const card = document.createElement("article");
    card.className = `game-card ${game.available ? "is-available" : game.status === "En desarrollo" ? "is-in-development" : "is-blocked"}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${game.name}, ${game.status}`);
    card.onclick = () => {
      if (game.available) { playMode = "choose"; setView(game.route); }
      else notify(`${game.name}: ${game.status.toLocaleLowerCase()}.`);
    };
    card.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); card.click(); }
    };
    const cover = document.createElement("div");
    cover.className = "game-card-cover-wrap";
    const image = document.createElement("img");
    image.className = "game-card-cover";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = game.cover;
    cover.append(image);
    if (!game.available) {
      const lock = document.createElement("span");
      lock.className = "game-card-lock";
      lock.setAttribute("aria-hidden", "true");
      lock.innerHTML = '<svg viewBox="0 0 32 38" aria-hidden="true"><rect x="4" y="16" width="24" height="19" rx="4"/><path d="M9 16V10a7 7 0 0 1 14 0v6M5 5l22 28"/></svg>';
      cover.append(lock);
    }
    const content = document.createElement("div");
    content.className = "game-card-content";
    const status = document.createElement("span");
    status.className = "game-status";
    status.textContent = game.status;
    const title = document.createElement("h2");
    title.textContent = game.name;
    content.append(status, title);
    card.append(cover, content);
    host.append(card);
  }
  host.dataset.rendered = "true";
}
function scheduleHomeNeighborCovers(host) {
  const loadNeighborCovers = () => {
    if (!host.closest(".view")?.classList.contains("active")) return;
    host.querySelectorAll(".home-game-card:not(.is-selected) img[data-src]").forEach((image) => {
      image.src = image.dataset.src;
      delete image.dataset.src;
    });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(loadNeighborCovers, { timeout: 1400 });
  else window.setTimeout(loadNeighborCovers, 900);
}
function renderHomeGameStack() {
  const host = $("#home-game-stack");
  if (!host) return;
  if (homeStackRenderedIndex === selectedGameIndex && host.childElementCount === 3) {
    scheduleHomeNeighborCovers(host);
    return;
  }
  host.replaceChildren();
  const selected = GAMES_CATALOG[selectedGameIndex];
  if (!selected) return;
  const previousIndex = (selectedGameIndex - 1 + GAMES_CATALOG.length) % GAMES_CATALOG.length;
  const nextIndex = (selectedGameIndex + 1) % GAMES_CATALOG.length;
  const makeCard = (game, position, index) => {
    const card = document.createElement("article");
    card.className = `home-game-card ${position}${game.available ? " is-available" : " is-blocked"}`;
    const cover = document.createElement("img");
    cover.alt = `${game.name}, portada`;
    cover.draggable = false;
    cover.decoding = "async";
    cover.loading = position === "is-selected" ? "eager" : "lazy";
    cover.fetchPriority = position === "is-selected" ? "high" : "low";
    if (position === "is-selected") {
      cover.src = game.cover;
    } else {
      cover.dataset.src = game.cover;
    }
    const coverFrame = document.createElement("div");
    coverFrame.className = "home-game-cover";
    coverFrame.append(cover);
    const copy = document.createElement("div");
    copy.className = "home-game-card-copy";
    const cardTitle = document.createElement("strong");
    cardTitle.textContent = game.name;
    const status = document.createElement("span");
    status.className = "home-game-status";
    status.textContent = game.status;
    copy.append(status, cardTitle);
    card.append(coverFrame, copy);
    card.setAttribute("aria-label", `${game.name}, ${game.status}`);
    card.setAttribute("aria-hidden", String(position !== "is-selected"));
    card.style.setProperty("--carousel-enter-x", homeCarouselDirection > 0 ? "52px" : "-52px");
    card.dataset.gameIndex = String(index);
    host.append(card);
  };
  makeCard(GAMES_CATALOG[previousIndex], "is-prev", previousIndex);
  makeCard(GAMES_CATALOG[nextIndex], "is-next", nextIndex);
  makeCard(selected, "is-selected", selectedGameIndex);
  homeStackRenderedIndex = selectedGameIndex;
  scheduleHomeNeighborCovers(host);
  $("#home-selected-game").replaceChildren();
  const description = document.createElement("p"); description.textContent = selected.description;
  $("#home-selected-game").append(description);
  $("#home-play-selected").disabled = !selected.available;
  $("#home-play-selected").textContent = selected.available ? "▶ PLAY" : selected.status.toUpperCase();
  $("#home-play-selected").setAttribute("aria-label", selected.available ? `Iniciar ${selected.name}` : `${selected.name}: ${selected.status}`);
}
function selectHomeGame(index) {
  const nextIndex = (index + GAMES_CATALOG.length) % GAMES_CATALOG.length;
  homeCarouselDirection = (nextIndex - selectedGameIndex + GAMES_CATALOG.length) % GAMES_CATALOG.length === GAMES_CATALOG.length - 1 ? -1 : 1;
  selectedGameIndex = nextIndex;
  renderHomeGameStack();
}
function applyAppearance(mode) {
  const selection = ["dark", "light", "system"].includes(mode) ? mode : "system";
  localStorage.setItem("zevyra.appearance", selection);
  const resolved = selection === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : selection;
  document.documentElement.dataset.theme = resolved;
  const logoPath = resolved === "light"
    ? "./assets/branding/zevyra-mode-light.png"
    : "./assets/branding/zevyra-mode-dark.png";
  $$(".themed-zevyra-logo").forEach((logo) => { logo.src = logoPath; });
  const themeButton = $("#appearance-cycle");
  const themeIcon = $("#appearance-icon");
  const labels = { system: "Sistema", dark: "Oscuro", light: "Claro" };
  const icons = { system: "brightness_6", dark: "dark_mode", light: "light_mode" };
  if (themeButton) {
    themeButton.setAttribute("aria-label", `Tema actual: ${labels[selection]}. Cambiar al siguiente tema.`);
    themeButton.title = `Tema: ${labels[selection]}`;
  }
  if (themeIcon) themeIcon.textContent = icons[selection];
  const appearanceLabel = $("#appearance-label");
  if (appearanceLabel) appearanceLabel.textContent = labels[selection];
}
function esc(text) {
  return escapeText(text);
}
function shotLabel(count) {
  const shots = Number(count);
  return `${shots} ${shots === 1 ? "Shot" : "Shots"}`;
}
function cardShotCount(card) {
  if (card.penalty?.enabled && Number(card.penalty.units) > 0) return Number(card.penalty.units);
  const counts = [...String(card.description ?? "").matchAll(/\b(\d+|un|una)\s+(?:shots?|copas?)\b/gi)]
    .map((match) => /^(?:un|una)$/i.test(match[1]) ? 1 : Number(match[1]));
  return counts.length ? Math.max(...counts) : 0;
}
function cardShotAlternativeCount(card) {
  const match = String(card?.description ?? "").match(/\b(?:toma|tomar)\s+(\d+|un|una)\s+(?:shots?|copas?)\b/i);
  if (!match) return 0;
  return /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
}
function renderCemetery() {
  const list = $("#cemetery-list");
  list.replaceChildren();
  const cards = state.game.cemetery ?? [];
  for (const entry of cards) {
    const card = state.cards.find((candidate) => candidate.id === entry.cardId) ?? {
      id: entry.cardId,
      title: entry.title,
      categoryId: entry.category,
      description: "",
      target: { mode: "CURRENT_PLAYER" },
      spiceLevel: 0,
    };
    const slot = makeTurnCard(card, { targetIds: [] }, true, false);
    slot.classList.add("cemetery-card-slot");
    slot.querySelector(".help-button")?.remove();
    slot.querySelector(".card-inline-actions")?.remove();
    const assignment = slot.querySelector(".card-players");
    if (assignment && entry.playerName) assignment.textContent = `Turno de ${entry.playerName}`;
    list.append(slot);
  }
}
function renderFragments() {
  const list = $("#fragments-list");
  list.replaceChildren();
  const fragments = state.game.fragments ?? [];
  $("#fragments-count").textContent = String(fragments.length);
  $("#fragments-open").setAttribute("aria-label", `Abrir fragmentos acumulados: ${fragments.length} de 5`);
  for (const entry of fragments) {
    const card = state.cards.find((candidate) => candidate.id === entry.cardId);
    if (!card) continue;
    const slot = makeTurnCard(card, { targetIds: [] }, true, false);
    slot.classList.add("cemetery-card-slot");
    slot.querySelector(".help-button")?.remove();
    slot.querySelector(".card-inline-actions")?.remove();
    const assignment = slot.querySelector(".card-players");
    if (assignment) assignment.textContent = `Obtuvo: ${entry.playerName || "Participante"}`;
    list.append(slot);
  }
}
async function animateCardsToCemetery() {
  if (cemeteryAnimating) return;
  const currentItems = [state.game.current?.primaryCard, ...(state.game.current?.auxiliaryCards ?? [])].filter(Boolean);
  const fragmentItems = currentItems.filter((item) => state.cards.find((card) => card.id === item.cardId)?.fragment);
  const completesFragments = (state.game.fragments?.length ?? 0) + fragmentItems.filter((item) => !(state.game.fragments ?? []).some((entry) => entry.cardId === item.cardId)).length >= 5;
  const slots = $$("#turn-cards .card-slot").map((slot) => {
    const card = state.cards.find((entry) => entry.id === slot.dataset.cardId);
    return { slot, fragment: Boolean(card?.fragment) };
  }).filter(({ fragment }) => !fragment || completesFragments);
  if (!slots.length) return;
  cemeteryAnimating = true;
  const destinations = new Set();
  const animations = slots.map(({ slot, fragment }, index) => {
    const destination = fragment ? $("#fragments-open") : $("#cemetery-open");
    destinations.add(destination);
    const target = destination.getBoundingClientRect();
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;
    if (!fragment) destination.classList.add("is-receiving");
    const source = slot.getBoundingClientRect();
    const dx = targetX - (source.left + source.width / 2);
    const dy = targetY - (source.top + source.height / 2);
    const baseTransform = getComputedStyle(slot).transform;
    return slot.animate([
      { transform: baseTransform, opacity: 1, filter: "brightness(1)" },
      { transform: `translate(${dx}px, ${dy}px) ${baseTransform === "none" ? "" : baseTransform} scale(.08) rotate(540deg)`, opacity: 0, filter: "brightness(1.8)" },
    ], { duration: 590, delay: index * 55, easing: "cubic-bezier(.45,0,.75,.2)", fill: "forwards" });
  });
  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  destinations.forEach((destination) => destination.classList.remove("is-receiving"));
  cemeteryAnimating = false;
}
function render() {
  document.title = `${GAME_NAME} — Circus Zevyra`;
  const appearance = localStorage.getItem("zevyra.appearance") || "system";
  applyAppearance(appearance);
  const currentRound = (state.game.completedRounds ?? 0) + 1;
  $("#header-round-count").textContent = String(currentRound);
  const gameViewIsActive = $("#view-game").classList.contains("active");
  const hasActivePlayers = state.participants.some((player) => player.active);
  const roomIsPlaying = getMultiplayerSession()?.status === "playing";
  const showGameTools = gameViewIsActive && hasActivePlayers &&
    (playMode === "local" || (playMode === "online" && roomIsPlaying));
  $("#header-rounds").classList.toggle("hidden", !showGameTools);
  $("#timer-inline").classList.toggle("hidden", !showGameTools);
  $("#cemetery-open").classList.toggle("hidden", !showGameTools);
  $("#fragments-open").classList.toggle("hidden", !showGameTools);
  const activeViewId = $(".view.active")?.id;
  if (activeViewId === "view-home") renderHomeGameStack();
  if (activeViewId === "view-games") renderGameLibrary();
  if (activeViewId === "view-game") renderFragments();
  if ((state.game.fragmentCompletions ?? 0) > lastRenderedFragmentCompletions) {
    const button = $("#fragments-open");
    button.classList.remove("is-completing");
    void button.offsetWidth;
    button.classList.add("is-completing");
    setTimeout(() => button.classList.remove("is-completing"), 1500);
    lastRenderedFragmentCompletions = state.game.fragmentCompletions;
  }
  $("#nav-profile-avatar").src = profileAvatarUrl();
  $("#app-version").textContent = VERSION;
  $("#game-name-label").textContent = GAME_NAME;
  const currentExperience = GAMES_CATALOG.find((game) => game.id === GAME_ID);
  const experienceUnavailable = !currentExperience?.available;
  $("#mode-unavailable-notice").hidden = !experienceUnavailable;
  $("#mode-unavailable-notice").textContent = experienceUnavailable ? `${GAME_NAME} todavía está en desarrollo. Las modalidades se habilitarán cuando se integren y validen sus cartas y reglas.` : "";
  $("#start-local-game").disabled = experienceUnavailable;
  $("#open-online-game").disabled = experienceUnavailable;
  $("#play-mode-screen").classList.toggle("hidden", playMode !== "choose");
  $("#gameplay-screen").classList.toggle("hidden", playMode === "choose");
  if (activeViewId === "view-game") {
    renderGame();
    renderRewards();
  }
  if (activeViewId === "view-players") renderPlayers();
  const profileSession = getMultiplayerSession();
  if (profileSession?.profile?.username) {
    $("#profile-display-name").textContent = profileSession.profile.username;
    if (profileSession.profile.public_uid) $("#profile-uid").textContent = `UID: #${profileSession.profile.public_uid}`;
  } else if (accountProfile) updateProfileCard(accountProfile);
  else $("#profile-display-name").textContent = localStorage.getItem("zevyra.profile.name") || "Jugador";
  if (activeViewId === "view-editor") renderCards();
  if (activeViewId === "view-manuals") renderManuals();
  if (activeViewId === "view-settings") renderDrinks();
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
  const pendingJoker = Boolean(state.game.pendingJokerResolution);
  const cur = state.game.current;
  const current = state.game.chain
    ? state.participants.find((p) => p.id === state.game.chain.activePlayerId)
    : cur
      ? state.participants.find((p) => p.id === cur.playerId)
      : state.participants[state.game.currentIndex];
  $("#empty-game").classList.toggle("hidden", hasPlayers);
  $("#game-layout").classList.toggle("hidden", !hasPlayers);
  $("#current-player").textContent = current?.active
    ? current.name
    : "Agrega participantes";
  renderAvatar($("#current-player-avatar"), current?.avatar || PLAYER_AVATARS[0]);
  renderRoundAndPowerState();
  renderJokerObligation();
  renderChainState();
  const ready = state.game.state === "READY" && hasPlayers && !rolling && !state.game.chain && !pendingJoker;
  const readOnly = onlineMode && !canPlayOnlineGame();
  const digital = (state.settings.gameMode ?? "digital") === "digital";
  $("#game-mode").value = digital ? "digital" : "physical";
  const showDice = digital && hasPlayers && !pendingJoker;
  $("#dice-stage").classList.toggle("hidden", !showDice);
  $("#all-decks-grid").classList.toggle("hidden", !hasPlayers || pendingJoker);
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
      cube.style.transform = `rotateX(${selectedFace.x}deg) rotateY(${selectedFace.y}deg)`;
    }
  }
  const choosingPhysical = !digital && ready;
  const choosingRolledCategory = digital && cur?.phase === "AWAITING_CATEGORY";
  const mainDecksVisible = digital
    ? active.length > 0 && !pendingJoker
    : choosingPhysical || Boolean(cur);
  $("#all-decks-grid").classList.toggle("hidden", !mainDecksVisible);
  $("#blocked-choice").classList.toggle("hidden", !choosingPhysical);
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
  $$("#all-decks-grid [data-category]").forEach((button) => {
    const category = button.dataset.category;
    const enabled = AUXILIARY_DECKS.has(category)
      ? armedMiniSelection
        ? category === armedMiniSelection.category
        : canDrawAuxiliary && (!cur?.outcome || effectCategories.includes(category))
      : choosingPhysical || (choosingRolledCategory && category === cur.category);
    button.disabled = !enabled || readOnly;
    button.classList.toggle(
      "selected-deck",
      !AUXILIARY_DECKS.has(category) && choosingRolledCategory && category === cur.category,
    );
  });
  $("#blocked-choice").disabled = !choosingPhysical || readOnly;
  $("#game-mode").disabled = readOnly || Boolean(cur) || rolling || Boolean(state.game.chain) || pendingJoker;
  $("#save-minigame-participants").disabled = readOnly;
  const gameMessage = cur
    ? cur.category === "BLOQUEADA"
      ? "Cara bloqueada · no hay acción."
      : cur.phase === "AWAITING_CATEGORY"
        ? `Resultado: ${CATEGORIES[cur.category]?.label ?? cur.category} · pulsa el mazo iluminado.`
        : cur.phase === "EMPTY"
          ? `Resultado: ${CATEGORIES[cur.category]?.label ?? cur.category} · mazo agotado.`
      : `${CATEGORIES[cur.category]?.label ?? cur.category} · turno en curso.`
    : "";
  const turnPlayer = state.game.chain
    ? state.participants.find((player) => player.id === state.game.chain.activePlayerId)
    : cur
    ? state.participants.find((player) => player.id === cur.playerId)
    : state.participants[state.game.currentIndex];
  $("#game-message").textContent = onlineMode && !canPlayOnlineGame() && turnPlayer
    ? canControlOnlineGame() ? `Turno de ${turnPlayer.name}. Como anfitrión, confirma el resultado cuando corresponda.` : `Es el turno de ${turnPlayer.name}. Espera tu turno para jugar.`
    : cur?.powerMessage || gameMessage;
  const cardsHost = $("#turn-cards");
  const items = cur
    ? [cur.primaryCard, ...(cur.auxiliaryCards ?? [])].filter(Boolean)
    : [];
  const cardsKey = items
    .map((item) => `${item.cardId}:${(item.targetIds ?? []).join(",")}`)
    .join("|");
  if (cardsHost.dataset.cardsKey !== cardsKey) {
    const animateActiveCard = animateCardNext && cardsKey.includes(animateCardId ?? "\0");
    const activeCardId = animateActiveCard
      ? animateCardId
      : state.game.current?.auxiliaryCards?.at(-1)?.cardId ?? state.game.current?.primaryCard?.cardId;
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
  const primaryCard = cur?.primaryCard && state.cards.find((card) => card.id === cur.primaryCard.cardId);
  const shotAlternativeCount = cardShotAlternativeCount(primaryCard);
  if (shotAlternativeCount) {
    let count = shotAlternativeCount;
    if (state.game.activeRoundEvent?.effect === "double_shots" && ["VERDAD", "DESAFIO"].includes(cur.category)) count *= 2;
    $("#confirm-alternative").textContent = `Toma ${shotLabel(count)}`;
  } else $("#confirm-alternative").textContent = "Pasar la carta";
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
    const hostOnly = onlineMode && !canControlOnlineGame();
    $(selector).disabled = hostOnly || $(selector).classList.contains("hidden") || (selector === "#finish-turn" && !canFinish);
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

function renderRoundAndPowerState() {
  const event = state.game.activeRoundEvent;
  const panel = $("#round-event-panel");
  const nextEventId = event?.id ?? null;
  if (nextEventId && nextEventId !== lastRenderedRoundEventId) {
    panel.classList.remove("is-revealing");
    void panel.offsetWidth;
    panel.classList.add("is-revealing");
    setTimeout(() => panel.classList.remove("is-revealing"), 1400);
  }
  lastRenderedRoundEventId = nextEventId;
  panel.classList.toggle("hidden", !event);
  if (event) {
    $("#round-event-title").textContent = `Evento de ronda ${event.eventRound}: ${event.name}`;
    $("#round-event-description").textContent = event.description;
  }
  const ownerId = state.game.chain ? null : state.game.current?.playerId ?? state.participants[state.game.currentIndex]?.id;
  const mine = (state.game.powers ?? []).filter((power) => power.playerId === ownerId);
  const powers = $("#power-inventory");
  powers.replaceChildren();
  $("#power-inventory-panel").classList.toggle("hidden", !mine.length || Boolean(state.game.pendingJokerResolution));
  for (const power of mine) {
    const definition = POWER_CATALOG.find((item) => item.id === power.key);
    if (!definition) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-small";
    button.textContent = `Usar · ${power.label}`;
    button.title = definition.description;
    button.disabled = Boolean(state.game.pendingJokerResolution) || (onlineMode && !canPlayOnlineGame());
    button.onclick = () => {
      if (!requireOnlineGame()) return;
      const result = engine.activatePower(power.id);
      if (result.error) return notify(result.error === "POWER_TIMING" ? "Ese poder no se puede usar en este momento." : "No se pudo activar el poder.");
      persist();
      renderGame();
    };
    powers.append(button);
  }
}

function renderJokerObligation() {
  const panel = $("#joker-obligation-panel");
  const entry = (state.game.jokerInventory ?? []).find(
    (joker) => joker.id === state.game.pendingJokerResolution,
  );
  panel.classList.toggle("hidden", !entry);
  if (!entry) return;
  const player = state.participants.find((participant) => participant.id === entry.playerId);
  const card = state.cards.find((candidate) => candidate.id === entry.cardId);
  $("#joker-obligation-owner").textContent = `Para ${player?.name ?? "el participante"}`;
  $("#joker-obligation-title").textContent = entry.title;
  $("#joker-obligation-description").textContent = card?.description ?? "Resuelve el Arlequín y registra su uso.";
  $("#resolve-joker-obligation").disabled = onlineMode && !canControlOnlineGame();
}

function renderChainState() {
  const chain = state.game.chain;
  const panel = $("#chain-panel");
  const prompt = CHAIN_CHALLENGES.find((item) => item.id === chain?.challengeId);
  panel.classList.toggle("hidden", !chain || !prompt);
  const start = $("#chain-start");
  start.classList.add("hidden");
  if (!chain || !prompt) return;
  $("#chain-continue").classList.remove("hidden");
  $("#chain-finish").classList.remove("hidden");
  const activePlayer = state.participants.find((player) => player.id === chain.activePlayerId);
  $("#chain-title").textContent = prompt.name;
  $("#chain-description").textContent = prompt.prompt;
  $("#chain-status").textContent = `Actúa ${activePlayer?.name ?? "el siguiente jugador"} · ${chain.visited.length}/${chain.maxLinks} pasos · ${prompt.consent}`;
  $("#chain-continue").textContent = prompt.continueLabel;
  $("#chain-finish").textContent = prompt.finishLabel;
  $("#chain-continue").disabled = onlineMode && !canPlayOnlineGame();
  $("#chain-finish").disabled = onlineMode && !canPlayOnlineGame();
}

$("#chain-start").onclick = () => {
  if (!requireOnlineGame()) return;
  const result = engine.startChain();
  if (result.error) return notify(result.error === "NEED_TWO_PLAYERS" ? "Necesitas al menos dos participantes." : "No se puede iniciar una cadena ahora.");
  persist();
  renderGame();
};
$("#chain-continue").onclick = () => {
  if (!requireOnlineGame()) return;
  const result = engine.continueChain();
  if (result.error) return notify("No se pudo continuar la cadena.");
  persist();
  renderGame();
};
$("#chain-finish").onclick = () => {
  if (!requireOnlineGame()) return;
  const result = engine.finishChain();
  if (result.error) return notify("No hay una cadena activa.");
  persist();
  renderGame();
};

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
  cube.setAttribute("tabindex", digital && !readOnly && !rolling && (ready || canRepeatRoll || canReplaceMain) ? "0" : "-1");
  cube.setAttribute("aria-label", canReplaceMain ? `Tirar el dado para extraer otra carta de ${CATEGORIES[turn.category].label}` : "Pulsa para tirar el dado");
  cube.classList.toggle("dice-clickable", digital && !readOnly && !rolling && (ready || canRepeatRoll || canReplaceMain));
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
      row.classList.toggle("is-disabled", readOnly);
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
  back.dataset.category = card.categoryId;
  const backSymbol = document.createElement("span");
  backSymbol.className = "material-symbols-outlined card-back-symbol";
  backSymbol.setAttribute("aria-hidden", "true");
  backSymbol.textContent = ({
    VERDAD: "heart_broken", DESAFIO: "skull", MINIJUEGO: "bomb", MALDICION: "sword_rose",
    PREMIO: "chess_queen", CASTIGO: "comedy_mask",
  })[card.categoryId] ?? "domino_mask";
  const backLabel = document.createElement("small");
  backLabel.textContent = CATEGORIES[card.categoryId]?.label.toUpperCase() ?? card.categoryId;
  back.append(backSymbol, backLabel);
  const front = document.createElement("article");
  front.className = "card-front";
  const category = document.createElement("div");
  category.className = "card-category";
  category.textContent =
    CATEGORIES[card.categoryId]?.label.toUpperCase() ?? card.categoryId;
  if (card.fragment) {
    const fragment = document.createElement("span");
    fragment.className = "material-symbols-outlined card-fragment-symbol";
    fragment.setAttribute("aria-label", "Fragmento");
    fragment.textContent = "diamond";
    front.append(fragment);
  }
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
  copy.append(title);
  if (card.categoryId !== "MINIJUEGO") {
    const description = document.createElement("p");
    description.textContent = card.description;
    copy.append(description);
  }
  const footer = document.createElement("div");
  footer.className = "card-footer";
  const penalty = document.createElement("span");
  const shotCount = cardShotCount(card);
  if (shotCount > 0) {
    penalty.className = "card-penalty";
    const water = document.createElement("span");
    water.className = "material-symbols-outlined";
    water.setAttribute("aria-hidden", "true");
    water.textContent = "water_medium";
    const units = document.createElement("b");
    units.textContent = String(shotCount);
    const label = document.createElement("span");
    label.textContent = "shots";
    penalty.setAttribute("aria-label", shotLabel(shotCount));
    penalty.append(water, units, label);
  }
  const fires = document.createElement("span");
  fires.className = "card-spice";
  fires.setAttribute("aria-label", `Intensidad: ${card.spiceLevel}`);
  fires.innerHTML = Array.from({ length: Math.max(0, Math.min(5, Number(card.spiceLevel) || 0)) }, () => '<span class="material-symbols-rounded spice-icon" aria-hidden="true">mode_heat</span>').join("");
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
    timer.disabled = onlineMode && !canPlayOnlineGame();
    timer.onclick = () => {
      setTimer(card.durationSeconds * 1000);
      $("#timer-dialog").showModal();
    };
    actions.append(timer);
    slot.append(actions);
  }
  const reveal = () => playing.classList.add("revealed");
  if (animate) {
    requestAnimationFrame(() => setTimeout(reveal, 360));
  } else reveal();
  return slot;
}
function redrawCard(cardId) {
  if (!requireOnlineGame()) return;
  const active = state.cards.find((card) => card.id === cardId);
  if (!active || !["VERDAD", "DESAFIO", "MINIJUEGO", "MALDICION"].includes(active.categoryId))
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
    const participantCard = document.createElement("section");
    participantCard.className = "participant-manage-card";
    const row = document.createElement("div");
    row.className = "manage-row";
    row.innerHTML = `<span class="player-number">${String(i + 1).padStart(2, "0")}</span><button class="player-avatar player-avatar-edit-control" type="button" aria-label="Editar avatar de ${esc(p.name)}"><span class="player-avatar-image"></span><span class="material-symbols-rounded player-avatar-edit-mark" aria-hidden="true">edit</span></button><input aria-label="Nombre" value="${esc(p.name)}" maxlength="32"><span class="fine-print">${p.id === state.participants[state.game.currentIndex]?.id ? "Turno actual" : ""}</span><button class="button button-small button-danger" data-action="delete-player">Eliminar</button>`;
    const avatarButton = row.querySelector(".player-avatar-edit-control");
    renderAvatar(row.querySelector(".player-avatar-image"), p.avatar || PLAYER_AVATARS[i % PLAYER_AVATARS.length]);
    avatarButton.disabled = readOnly;
    avatarButton.onclick = async () => {
      avatarEditingPlayerId = p.id;
      await openAvatarEditor("participant", p.avatar || PLAYER_AVATARS[i % PLAYER_AVATARS.length]);
    };
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
    participantCard.append(row);

    const inventory = (state.game.jokerInventory ?? []).filter((entry) => entry.playerId === p.id);
    const progress = state.game.jokerProgress?.[p.id] ?? {};
    const shelf = document.createElement("section");
    shelf.className = "player-joker-inventory";
    shelf.setAttribute("aria-label", `Jokers personales de ${p.name}`);
    const goodCount = inventory.filter((entry) => entry.category === "PREMIO" && !entry.used).length;
    const badCount = inventory.filter((entry) => entry.category === "CASTIGO" && !entry.used).length;
    const heading = document.createElement("div");
    heading.className = "player-joker-inventory-heading";
    const label = document.createElement("strong");
    label.textContent = `MAZO PERSONAL · ${goodCount} Bufones · ${badCount} Arlequines`;
    const streak = document.createElement("span");
    streak.className = "fine-print";
    streak.textContent = `Cumplidos ${Math.min(3, progress.completedStreak ?? 0)}/3 · Alternativas ${Math.min(3, progress.shotStreak ?? 0)}/3 · Pecados/Sacrificios ${progress.completedTruthOrChallengeCount ?? 0}/5`;
    heading.append(label, streak);
    shelf.append(heading);
    if (!inventory.length) {
      const empty = document.createElement("p");
      empty.className = "fine-print";
      empty.textContent = "Todavía no tiene cartas Joker personales.";
      shelf.append(empty);
    } else {
      const list = document.createElement("div");
      list.className = "player-joker-list";
      inventory.forEach((entry) => {
        const card = state.cards.find((item) => item.id === entry.cardId);
        const item = document.createElement("details");
        item.className = `player-joker-item${entry.used ? " is-used" : ""}`;
        const summary = document.createElement("summary");
        summary.textContent = `${entry.category === "PREMIO" ? "Bufón" : "Arlequín"} · ${entry.title}`;
        item.append(summary);
        if (card?.description) {
          const description = document.createElement("p");
          description.textContent = card.description;
          item.append(description);
        }
        const note = document.createElement("p");
        note.className = "fine-print";
        note.textContent = entry.used ? "Usado" : `Otorgado automáticamente: ${entry.reason}.`;
        item.append(note);
        if (!entry.used && entry.id !== state.game.pendingJokerResolution) {
          const activeInventoryOwner = state.game.current?.playerId ?? state.participants[state.game.currentIndex]?.id;
          const canUseThisJoker = !onlineMode || (canPlayOnlineGame() && activeInventoryOwner === p.id);
          const use = document.createElement("button");
          use.type = "button";
          use.className = "button button-small";
          use.textContent = "Marcar usado";
          use.disabled = !canUseThisJoker;
          use.onclick = () => {
            if (!canUseThisJoker || !requireOnlineGame()) return;
            entry.used = true;
            entry.usedAt = new Date().toISOString();
            state.game.cemetery ??= [];
            state.game.cemetery.unshift({
              cardId: entry.cardId,
              title: entry.title,
              category: entry.category,
              playerId: p.id,
              playerName: p.name,
              drawnAt: entry.grantedAt,
            });
            persist();
            renderPlayers();
            render();
          };
          item.append(use);
        }
        list.append(item);
      });
      shelf.append(list);
    }
    participantCard.append(shelf);
    host.append(participantCard);
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
    `<b>${esc($("#f-title").value || "Título de la carta")}</b><p>${esc($("#f-description").value || "La descripción aparecerá aquí.")}</p><small>${esc(penalty)} · ${Number($("#f-spice").value) ? '<span class="material-symbols-rounded spice-icon">mode_heat</span>'.repeat(Number($("#f-spice").value)) : "Sin intensidad"}</small>`;
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
    row.innerHTML = `<div class="editor-card-icon">${esc(card.icon?.value ?? "✦")}</div><div class="editor-card-copy"><div class="editor-card-meta"><span>${CATEGORIES[card.categoryId].label}</span><code>${esc(card.id)}</code></div><h3>${esc(card.title)} ${card.enabled ? "" : "<small>(desactivada)</small>"}</h3><p>${esc(card.description)}</p></div><div class="card-menu"><button class="icon-button" data-action="menu" aria-label="Acciones de ${esc(card.title)}" title="Acciones" aria-expanded="false">⋮</button><div class="card-menu-popover hidden"><button data-action="edit">Editar</button><button data-action="duplicate">Duplicar</button><button data-action="toggle">${card.enabled ? "Desactivar" : "Activar"}</button><button data-action="delete" class="danger">Eliminar</button></div></div>`;
    row.querySelector("[data-action=menu]").onclick = (event) => {
      event.stopPropagation();
      const popover = row.querySelector(".card-menu-popover");
      const opening = popover.classList.contains("hidden");
      $$(".card-menu-popover").forEach((menu) => menu.classList.add("hidden"));
      $$(".card-menu [data-action=menu]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      popover.classList.toggle("hidden", !opening);
      event.currentTarget.setAttribute("aria-expanded", String(opening));
    };
    row.querySelector(".card-menu-popover").addEventListener("click", (event) => event.stopPropagation());
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
      notify(card.enabled ? "Carta activada; vuelve a estar disponible en el mazo." : "Carta desactivada; se excluyó de las nuevas selecciones.");
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
$("#view-settings").addEventListener("click", (e) => {
  const shortcut = e.target.closest("[data-view]");
  if (shortcut) setView(shortcut.dataset.view);
});
$("#tools-nav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (btn) setView(btn.dataset.view);
});
$("#menu-toggle").onclick = () => {
  const menu = $("#tools-nav");
  menu.hidden = false;
  const open = !menu.classList.contains("open");
  menu.classList.toggle("open", open);
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
  if (!open) menu.hidden = true;
};
$("#home-browse-games").onclick = () => setView("games");
$("#home-join-game").onclick = () => { playMode = "choose"; setView("game"); };
$("#profile-avatar-preview").src = profileAvatarUrl();
$("#profile-avatar-preview-read").src = profileAvatarUrl();
$("#auth-avatar-preview").src = profileAvatarUrl();
async function openAvatarEditor(context, initialAvatar = null) {
  avatarEditorContext = context;
  if (context !== "participant") avatarEditingPlayerId = null;
  const avatar = initialAvatar || (context === "registration"
    ? registrationAvatarUrl || profileAvatarUrl()
    : context === "profile"
      ? profileAvatarDraft || accountProfile?.avatar || profileAvatarUrl()
      : profileAvatarUrl());
  const details = avatarDetailsFromUrl(avatar);
  avatarDraftSeed = details.seed;
  avatarDraftOptions = details.options;
  $("#avatar-editor-dialog").showModal();
  setAvatarEditorOptions(details.options);
  await loadAvatarEditorOptions();
  setAvatarEditorOptions(details.options);
}
$("#profile-avatar-edit").onclick = () => { if (profileEditing) void openAvatarEditor("profile"); };
$("#auth-avatar-edit").onclick = () => void openAvatarEditor("registration");
function discardAvatarEditorChanges() {
  avatarDraftSeed = null;
  avatarDraftOptions = null;
  avatarEditingPlayerId = null;
  avatarEditorContext = "profile";
  $("#avatar-editor-dialog").close();
}
$("#avatar-editor-close").onclick = discardAvatarEditorChanges;
$("#avatar-editor-cancel").onclick = discardAvatarEditorChanges;
$("#avatar-editor-dialog").addEventListener("close", () => {
  avatarDraftSeed = null;
  avatarDraftOptions = null;
  avatarEditingPlayerId = null;
  avatarEditorContext = "profile";
});
$("#avatar-editor-save").onclick = () => {
  const avatar = profileAvatarUrl(avatarDraftSeed || crypto.randomUUID(), avatarDraftOptions ?? {});
  if (avatarEditorContext === "participant" && avatarEditingPlayerId) {
    const participant = state.participants.find((player) => player.id === avatarEditingPlayerId);
    if (!participant) return notify("No se encontró ese participante.");
    participant.avatar = avatar;
    persist();
    $("#avatar-editor-dialog").close();
    render();
    notify("Avatar del participante guardado.");
    return;
  }
  if (avatarEditorContext === "registration") {
    registrationAvatarUrl = avatar;
    $("#auth-avatar-preview").src = avatar;
    $("#avatar-editor-dialog").close();
    notify("Avatar listo para tu pasaporte.");
    return;
  }
  profileAvatarDraft = avatar;
  $("#profile-avatar-preview").src = avatar;
  $("#profile-avatar-preview-read").src = avatar;
  $("#avatar-editor-dialog").close();
  notify("Avatar seleccionado. Guarda los cambios del pasaporte para conservarlo.");
};
$("#back-to-games").onclick = () => setView("games");
$("#back-to-mode-select").onclick = () => { playMode = "choose"; setView("game"); };
$("#start-local-game").onclick = async () => {
  if (getMultiplayerSession()) {
    try { await disconnectRoom(); }
    catch (error) { logMultiplayerError("leave-online-before-local", error); }
  }
  if (onlineMode) leaveOnlineMode();
  onlineMode = false;
  playMode = "local";
  setView("game");
};
$("#open-online-game").onclick = () => setView("multiplayer");
$("#multiplayer-back").onclick = () => { playMode = "choose"; setView("game"); };
$("#home-game-stack").addEventListener("click", (event) => {
  const card = event.target.closest(".home-game-card");
  if (!card) return;
  const index = Number(card.dataset.gameIndex);
  if (Number.isInteger(index) && index !== selectedGameIndex) selectHomeGame(index);
});
$("#home-play-selected").onclick = () => {
  const game = GAMES_CATALOG[selectedGameIndex];
  if (!game?.available) return;
  playMode = "choose";
  setView(game.route);
};
let carouselPointerX = null;
$("#home-game-stack").addEventListener("pointerdown", (event) => {
  carouselPointerX = event.clientX;
  if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
});
$("#home-game-stack").addEventListener("pointerup", (event) => {
  if (carouselPointerX === null) return;
  const delta = event.clientX - carouselPointerX;
  carouselPointerX = null;
  if (Math.abs(delta) > 35) {
    selectHomeGame(selectedGameIndex + (delta < 0 ? 1 : -1));
  }
});
$("#home-game-stack").addEventListener("pointercancel", () => { carouselPointerX = null; });
$("#home-game-stack").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") { event.preventDefault(); selectHomeGame(selectedGameIndex - 1); }
  if (event.key === "ArrowRight") { event.preventDefault(); selectHomeGame(selectedGameIndex + 1); }
});
$("#appearance-cycle").onclick = () => {
  const current = localStorage.getItem("zevyra.appearance") || "system";
  const next = { system: "dark", dark: "light", light: "system" }[current] || "system";
  applyAppearance(next);
};
document.addEventListener("click", (event) => {
  if (event.target.closest(".card-menu")) return;
  $$(".card-menu-popover").forEach((menu) => menu.classList.add("hidden"));
  $$(".card-menu [data-action=menu]").forEach((button) => button.setAttribute("aria-expanded", "false"));
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  $$(".card-menu-popover").forEach((menu) => menu.classList.add("hidden"));
  $$(".card-menu [data-action=menu]").forEach((button) => button.setAttribute("aria-expanded", "false"));
});
window.addEventListener("resize", () => renderHomeGameStack());
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if ((localStorage.getItem("zevyra.appearance") || "system") === "system") applyAppearance("system");
});
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
const allowedViews = new Set(["home", "games", "game", "players", "profile", "multiplayer", "editor", "manuals", "settings"]);
const requestedView = location.hash.slice(1) === "inicio" ? "home" : location.hash.slice(1) === "juegos" ? "games" : location.hash.slice(1);
setView(allowedViews.has(requestedView) ? requestedView : "home");
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
  button.setAttribute("aria-label", category.label);
  button.title = category.label;
  button.style.setProperty("--category-color", category.color);
  button.innerHTML =
    '<span class="material-symbols-outlined category-mark" aria-hidden="true"></span><span class="category-name"></span>';
  button.querySelector(".category-mark").textContent = category.icon;
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
    notify(result.reason === "EXHAUSTED"
      ? `Todas las cartas de ${CATEGORIES[id]?.label ?? id} están en el cementerio. Reinicia la partida para volver a usarlas.`
      : `El mazo ${CATEGORIES[id]?.label ?? id} no tiene cartas habilitadas.`);
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
  if (id !== "SHOT") $("#all-decks-grid").append(makeCategoryButton(id, category));
}
$("#blocked-choice").innerHTML =
  '<span class="material-symbols-outlined category-mark" aria-hidden="true">do_not_disturb_on</span><span class="category-name">BLOQUEADA</span>';
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
  const rollStartedAt = Date.now();
  state.game.current.rollStartedAt = rollStartedAt;
  persist();
  rolling = true;
  renderGame();
  const { face } = result;
  animateDiceRoll(face, rollStartedAt, () => {
    engine.completeRoll();
    rolling = false;
    syncedRollStartedAt = null;
    persist();
    renderGame();
  });
}
function animateDiceRoll(face, startedAt, onComplete = null, alreadyRolling = false) {
  if (syncedRollStartedAt === String(startedAt)) return;
  syncedRollStartedAt = String(startedAt);
  if (!alreadyRolling) rolling = true;
  const cube = $("#dice-cube");
  $("#dice-stage").classList.remove("hidden");
  cube.dataset.face = face.category;
  cube.dataset.resultFaceId = String(face.id);
  cube.style.setProperty("--face-color", diceFaceColor(face.category));
  const currentX = Number(cube.dataset.rotationX ?? 0);
  const currentY = Number(cube.dataset.rotationY ?? 0);
  // Keep the backup's single RAF-driven 3D roll and settle each result back
  // onto its canonical face angles so rotations do not accumulate over time.
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduceMotion ? 1 : 4000;
  const elapsedBeforeAnimation = Math.min(Math.max(Date.now() - Number(startedAt), 0), duration);
  const targetX = diceRotationTarget(currentX, face.x, reduceMotion ? 0 : 6);
  const targetY = diceRotationTarget(currentY, face.y, reduceMotion ? 0 : 8);
  cube.style.transition = "none";
  let animationStart = null;
  const animateRoll = (timestamp) => {
    animationStart ??= timestamp;
    const progress = Math.min((elapsedBeforeAnimation + timestamp - animationStart) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = currentX + (targetX - currentX) * eased;
    const y = currentY + (targetY - currentY) * eased;
    cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
    if (progress < 1) {
      requestAnimationFrame(animateRoll);
      return;
    }
    cube.dataset.rotationX = String(face.x);
    cube.dataset.rotationY = String(face.y);
    cube.style.transform = `rotateX(${face.x}deg) rotateY(${face.y}deg)`;
    cube.offsetWidth;
    cube.style.removeProperty("transition");
    rolling = false;
    syncedRollStartedAt = null;
    onComplete?.();
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
  if (turn.primaryCard && ["VERDAD", "DESAFIO", "MINIJUEGO", "MALDICION"].includes(turn.category) && !turn.outcome && !turn.minigameResult)
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
async function confirmResult(result, sourceCardId) {
  if (!requireOnlineHost("Solo el anfitrión puede confirmar el resultado del turno.")) return;
  if (!engine.resolve(result, sourceCardId))
    return notify("El resultado de este turno ya fue confirmado.");
  persist();
  const hasAuxiliaryEffect = (state.game.current?.pendingEffects ?? []).some(
    (effect) => effect.type === "DRAW_AUXILIARY",
  );
  if (!hasAuxiliaryEffect) {
    await animateCardsToCemetery();
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
    (() => {
      const card = state.cards.find((item) => item.id === state.game.current?.primaryCard?.cardId);
      return cardShotAlternativeCount(card) > 0
        ? "SHOTS_SELECTED"
        : "PASSED";
    })(),
    state.game.current?.primaryCard?.cardId ?? null,
  );
$("#confirm-penalty").onclick = () => {
  const punishment = [...(state.game.current?.auxiliaryCards ?? [])]
    .reverse()
    .find((item) => item.category === "CASTIGO");
  confirmResult("COMPLETED", punishment?.cardId ?? null);
};
$("#finish-turn").onclick = async () => {
  if (!requireOnlineHost("Solo el anfitrión puede cerrar el turno.")) return;
  if (cemeteryAnimating) return;
  await animateCardsToCemetery();
  if (!engine.finishTurn())
    return notify("Confirma primero el resultado del turno.");
  persist();
  render();
  renderRewards();
};
$("#cemetery-open").onclick = () => { renderCemetery(); $("#cemetery-dialog").showModal(); };
$("#resolve-joker-obligation").onclick = () => {
  if (!requireOnlineHost("Solo el anfitrión puede registrar que se resolvió el Arlequín.")) return;
  const entry = (state.game.jokerInventory ?? []).find(
    (joker) => joker.id === state.game.pendingJokerResolution,
  );
  if (!entry) return;
  entry.used = true;
  entry.usedAt = new Date().toISOString();
  entry.resolvedAt = entry.usedAt;
  const player = state.participants.find((participant) => participant.id === entry.playerId);
  state.game.cemetery ??= [];
  state.game.cemetery.unshift({
    cardId: entry.cardId,
    title: entry.title,
    category: entry.category,
    playerId: entry.playerId,
    playerName: player?.name ?? "Participante",
    drawnAt: entry.grantedAt,
  });
  state.game.pendingJokerResolution = null;
  persist();
  render();
  notify("Arlequín resuelto y enviado al cementerio.");
};
$("#cemetery-close").onclick = () => $("#cemetery-dialog").close();
$("#fragments-open").onclick = () => { renderFragments(); $("#fragments-dialog").showModal(); };
$("#fragments-close").onclick = () => $("#fragments-dialog").close();
$("#player-form").onsubmit = (e) => {
  e.preventDefault();
  if (!requireOnlineHost()) return;
  const input = $("#player-name"),
    name = input.value.trim();
  if (!name) return;
  state.participants.push({
    id: makeId("player"),
    name,
    avatar: selectedLocalAvatar,
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
  const archive = state.game.history?.length
    ? { endedAt: new Date().toISOString(), history: structuredClone(state.game.history) }
    : null;
  state.game = {
    currentIndex: 0,
    state: "READY",
    decks: {},
    current: null,
    history: [],
    cemetery: [],
    fragments: [],
    fragmentCompletions: 0,
    archives: [...(state.game.archives ?? []), ...(archive ? [archive] : [])].slice(-10),
    rewards: [],
    jokerInventory: [],
    jokerProgress: {},
    pendingJokerResolution: null,
    completedTurns: 0,
    completedRounds: 0,
    roundEventHistory: [],
    activeRoundEvent: null,
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
let appRegistration = null;
let updateRequested = false;
const installButton = $("#install-button");
const updateButton = $("#update-app-button");
const updateStatus = $("#app-update-status");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.textContent = "Instalar para jugar sin conexión";
  updateStatus.textContent =
    "Instala la aplicación desde aquí; el navegador guardará sus archivos en este dispositivo.";
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.textContent = "Aplicación instalada";
  installButton.disabled = true;
  updateStatus.textContent =
    "Aplicación instalada. Usa Buscar actualizaciones para comprobar si hay una versión nueva.";
});
installButton.onclick = async () => {
  if (!installPrompt) {
    updateStatus.textContent =
      "Este navegador no ofrece instalación automática. Abre su menú y elige Instalar aplicación o Añadir a pantalla de inicio.";
    notify("Abre el menú del navegador y elige Instalar aplicación o Añadir a pantalla de inicio.");
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  try {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    updateStatus.textContent = outcome === "accepted"
      ? "Instalación aceptada. La app quedará disponible desde la pantalla de inicio o el menú de aplicaciones."
      : "Instalación cancelada. Puedes volver a intentarlo desde este botón.";
  } catch {
    updateStatus.textContent =
      "No se pudo abrir la instalación. Usa el menú del navegador para instalar o añadir la app a la pantalla de inicio.";
  }
};

navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (!updateRequested) return;
  updateRequested = false;
  location.reload();
});

function waitForWorkerInstall(worker, timeoutMs = 15000) {
  if (["installed", "activated", "redundant"].includes(worker.state))
    return Promise.resolve(worker.state);
  return new Promise((resolve) => {
    const finish = (state) => {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", onStateChange);
      resolve(state);
    };
    const onStateChange = () => {
      if (["installed", "activated", "redundant"].includes(worker.state))
        finish(worker.state);
    };
    const timeout = setTimeout(() => finish("timeout"), timeoutMs);
    worker.addEventListener("statechange", onStateChange);
  });
}

updateButton.onclick = async () => {
  updateButton.disabled = true;
  updateStatus.textContent = "Buscando actualizaciones…";
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    updateStatus.textContent =
      "Las actualizaciones requieren abrir la app desde localhost o HTTPS, no desde un archivo HTML.";
    updateButton.disabled = false;
    return;
  }
  if (!navigator.onLine) {
    updateStatus.textContent =
      "Conéctate a internet para buscar una actualización. La versión instalada seguirá disponible sin conexión.";
    updateButton.disabled = false;
    return;
  }
  try {
    const registration = appRegistration || await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error("No hay una instalación local registrada.");
    let updateFound = false;
    const markUpdateFound = () => {
      updateFound = true;
      updateStatus.textContent = "Descargando la actualización…";
    };
    registration.addEventListener("updatefound", markUpdateFound, { once: true });
    const currentController = navigator.serviceWorker.controller;
    updateRequested = true;
    await registration.update();
    let worker = registration.installing || registration.waiting;
    if (worker) {
      updateStatus.textContent = "Descargando la actualización…";
      const workerState = await waitForWorkerInstall(worker);
      if (workerState === "redundant" || workerState === "timeout") {
        updateRequested = false;
        throw new Error("No se pudo completar la descarga de la actualización.");
      }
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        worker = registration.waiting;
      }
      if (navigator.serviceWorker.controller !== currentController) {
        updateStatus.textContent = "Actualización instalada. Recargando…";
        location.reload();
        return;
      }
      if (worker.state === "installed") {
        worker.postMessage({ type: "SKIP_WAITING" });
        updateStatus.textContent =
          "Actualización descargada. Se aplicará al activar la nueva versión.";
        return;
      }
    }
    registration.removeEventListener("updatefound", markUpdateFound);
    if (updateFound) {
      updateStatus.textContent = "Nueva versión descargada. Recargando la aplicación…";
      updateRequested = false;
      location.reload();
      return;
    }
    updateRequested = false;
    updateStatus.textContent = "Ya tienes la versión más reciente.";
  } catch (error) {
    updateRequested = false;
    updateStatus.textContent = error.message || "No se pudo buscar la actualización.";
  } finally {
    updateButton.disabled = false;
  }
};

if ("serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker
    .register("./sw.js")
    .then(async (registration) => {
      appRegistration = registration;
      await navigator.serviceWorker.ready;
      $("#storage-status").textContent =
        "Modo sin conexión listo en este dispositivo. La primera carga necesita conexión.";
    })
    .catch(() => {
      $("#storage-status").textContent =
        "No se pudo activar el modo sin conexión. Abre la app desde HTTPS o http://localhost:8000.";
    });
else
  $("#storage-status").textContent =
    "Abre la app desde localhost o HTTPS para activar la instalación y el modo sin conexión.";
$("#app-version").textContent = VERSION;
render();
void initializeAccountAccess();
