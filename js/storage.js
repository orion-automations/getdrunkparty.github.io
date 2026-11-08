import { INITIAL_CARDS } from "../data/initial-cards.js";
import { INITIAL_MANUALS } from "../data/initial-manuals.js";
import {
  REMOVED_LEGACY_CARD_IDS,
  REMOVED_LEGACY_MANUAL_IDS,
} from "../data/catalog-migrations.js";
import { POWER_CATALOG } from "../data/power-catalog.js";
import { GAME_ID } from "./config.js";
export const CATALOG_VERSION = 11;
export const STORAGE_KEY = `zevyra.${GAME_ID}.data.v1`;
export const LEGACY_STORAGE_KEY = "gdpw.data.v1";
export const seedState = () => ({
  version: 1,
  gameId: GAME_ID,
  catalogVersion: CATALOG_VERSION,
  cards: structuredClone(INITIAL_CARDS),
  manuals: structuredClone(INITIAL_MANUALS),
  drinks: [
    { id: "NORMAL", name: "Shots", unitLabel: "shot(s)", enabled: true },
    {
      id: "ALTERNATIVE",
      name: "Alternativa sin alcohol",
      unitLabel: "opción",
      enabled: true,
    },
  ],
  participants: [],
  settings: { positionReversed: false, gameMode: "digital" },
  game: {
    currentIndex: 0,
    state: "READY",
    decks: {},
    current: null,
    history: [],
    cemetery: [],
    fragments: [],
    fragmentCompletions: 0,
    archives: [],
    rewards: [],
    jokerInventory: [],
    jokerProgress: {},
    pendingJokerResolution: null,
    completedTurns: 0,
    completedRounds: 0,
    activeRoundEvent: null,
    roundEventHistory: [],
    powers: [],
    usedPowers: [],
    chain: null,
  },
});
function renameJokerTerms(value) {
  if (typeof value === "string") {
    return value
      .replaceAll("Jokers malos", "Jokers Arlequines")
      .replaceAll("Jokers buenos", "Jokers Bufones")
      .replaceAll("Joker Malo", "Joker Arlequín")
      .replaceAll("Joker Bueno", "Joker Bufón")
      .replaceAll("Joker malo", "Joker arlequín")
      .replaceAll("Joker bueno", "Joker bufón")
      .replaceAll("joker malo", "joker arlequín")
      .replaceAll("joker bueno", "joker bufón");
  }
  if (Array.isArray(value)) return value.map(renameJokerTerms);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = renameJokerTerms(value[key]);
  }
  return value;
}
export function isValidState(state) {
  try {
    if (
      !state ||
      state.version !== 1 ||
      !Array.isArray(state.cards) ||
      !Array.isArray(state.manuals) ||
      !Array.isArray(state.participants) ||
      !Array.isArray(state.drinks) ||
      !state.game ||
      !Array.isArray(state.game.history) ||
      !state.game.decks ||
      typeof state.game.decks !== "object"
    )
      return false;
    validateCards(state.cards, state.manuals);
    if (
      !state.participants.every(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          p.name.trim() &&
          typeof p.active === "boolean",
      )
    )
      return false;
    if (
      !state.drinks.every(
        (d) =>
          d &&
          typeof d.id === "string" &&
          typeof d.name === "string" &&
          typeof d.enabled === "boolean",
      )
    )
      return false;
    if (
      !Number.isInteger(state.game.currentIndex) ||
      state.game.currentIndex < 0
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export function loadState() {
  try {
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    const loadedLegacyKey = !currentRaw;
    const raw = currentRaw ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      const init = seedState();
      saveState(init);
      return init;
    }
    const parsed = JSON.parse(raw);
    if (isValidState(parsed)) {
      if ((parsed.catalogVersion ?? 0) < 4) {
        const removedCards = new Set(REMOVED_LEGACY_CARD_IDS);
        const current = parsed.game.current;
        const currentCardIds = [
          current?.primaryCard?.cardId,
          ...(current?.auxiliaryCards ?? []).map((card) => card.cardId),
        ];
        if (currentCardIds.some((id) => removedCards.has(id))) {
          parsed.game.current = null;
          parsed.game.state = "READY";
        }
        parsed.cards = parsed.cards.filter(
          (card) => !removedCards.has(card.id),
        );
        Object.values(parsed.game.decks).forEach((deck) => {
          if (Array.isArray(deck?.order))
            deck.order = deck.order.filter((id) => !removedCards.has(id));
        });
        const removedManuals = new Set(REMOVED_LEGACY_MANUAL_IDS);
        const referencedManuals = new Set(
          parsed.cards.map((card) => card.manualId).filter(Boolean),
        );
        parsed.manuals = parsed.manuals.filter(
          (manual) =>
            !removedManuals.has(manual.id) || referencedManuals.has(manual.id),
        );
        const cardIds = new Set(parsed.cards.map((card) => card.id));
        parsed.cards.push(
          ...structuredClone(
            INITIAL_CARDS.filter((card) => !cardIds.has(card.id)),
          ),
        );
        const manualIds = new Set(parsed.manuals.map((manual) => manual.id));
        parsed.manuals.push(
          ...structuredClone(
            INITIAL_MANUALS.filter((manual) => !manualIds.has(manual.id)),
          ),
        );
        const challengeCards = new Map(
          INITIAL_CARDS.filter((card) => card.categoryId === "DESAFIO").map(
            (card) => [card.id, card],
          ),
        );
        parsed.cards.forEach((card) => {
          const source = challengeCards.get(card.id);
          if (source) {
            card.description = source.description;
            card.penalty = structuredClone(source.penalty);
          }
        });
        const shotsOption = parsed.drinks.find(
          (drink) => drink.id === "NORMAL",
        );
        if (shotsOption) {
          shotsOption.name = "Shots";
          shotsOption.unitLabel = "shot(s)";
        }
        parsed.catalogVersion = 4;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 5) {
        const cardIds = new Set(parsed.cards.map((card) => card.id));
        parsed.cards.push(...structuredClone(INITIAL_CARDS.filter((card) => !cardIds.has(card.id))));
        parsed.catalogVersion = 5;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 6) {
        const liveCardIds = new Set([parsed.game.current?.primaryCard?.cardId, ...(parsed.game.current?.auxiliaryCards ?? []).map((card) => card.cardId)].filter(Boolean));
        parsed.cards.forEach((card) => {
          if (/^(VERDAD|DESAFIO|MINIJUEGO|PREMIO|CASTIGO)_PDF_/.test(card.id) || /^DESAFIO_PDF_(1[0-6][0-9]|0?[0-9]{3})$/.test(card.id)) {
            if (!liveCardIds.has(card.id)) card.enabled = false;
          }
        });
        const knownIds = new Set(parsed.cards.map((card) => card.id));
        parsed.cards.push(...structuredClone(INITIAL_CARDS.filter((card) => !knownIds.has(card.id))));
        const manualIds = new Set(parsed.manuals.map((manual) => manual.id));
        parsed.manuals.push(...structuredClone(INITIAL_MANUALS.filter((manual) => !manualIds.has(manual.id))));
        parsed.game.completedTurns ??= 0;
        parsed.game.activeRoundEvent ??= null;
        parsed.game.roundEventHistory ??= [];
        parsed.game.powers ??= [];
        parsed.game.usedPowers ??= [];
        parsed.game.chain ??= null;
        parsed.catalogVersion = 6;
        parsed.gameId ??= GAME_ID;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 7) {
        const liveCardIds = new Set([parsed.game.current?.primaryCard?.cardId, ...(parsed.game.current?.auxiliaryCards ?? []).map((card) => card.cardId)].filter(Boolean));
        const carnivalIds = new Set(INITIAL_CARDS.map((card) => card.id));
        const knownIds = new Set(parsed.cards.map((card) => card.id));
        parsed.cards.push(...structuredClone(INITIAL_CARDS.filter((card) => !knownIds.has(card.id))));
        parsed.cards.forEach((card) => {
          if (carnivalIds.has(card.id)) card.enabled = true;
          if (card.id.startsWith("MC_") && !liveCardIds.has(card.id)) card.enabled = false;
        });
        parsed.catalogVersion = 7;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 8) {
        const liveCardIds = new Set([parsed.game.current?.primaryCard?.cardId, ...(parsed.game.current?.auxiliaryCards ?? []).map((card) => card.cardId)].filter(Boolean));
        const knownIds = new Set(parsed.cards.map((card) => card.id));
        parsed.cards.push(...structuredClone(INITIAL_CARDS.filter((card) => !knownIds.has(card.id))));
        const carnivalIds = new Set(INITIAL_CARDS.map((card) => card.id));
        parsed.cards.forEach((card) => {
          if (!carnivalIds.has(card.id) || liveCardIds.has(card.id)) return;
          card.enabled = card.collection === "horrors"
            ? parsed.game.activeRoundEvent?.effect === "horrors"
            : true;
        });
        parsed.catalogVersion = 8;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 9) {
        const removedIds = new Set(Array.from({ length: 6 }, (_, index) => `MC_PENALTY_${String(index + 1).padStart(3, "0")}`));
        const current = parsed.game.current;
        const activeCardIds = [current?.primaryCard?.cardId, ...(current?.auxiliaryCards ?? []).map((card) => card.cardId)];
        if (activeCardIds.some((id) => removedIds.has(id))) {
          parsed.game.current = null;
          parsed.game.state = "READY";
        }
        parsed.cards = parsed.cards.filter((card) => !removedIds.has(card.id));
        Object.values(parsed.game.decks).forEach((deck) => {
          if (Array.isArray(deck?.order)) deck.order = deck.order.filter((id) => !removedIds.has(id));
        });
        parsed.game.cemetery = (parsed.game.cemetery ?? []).filter((entry) => !removedIds.has(entry.cardId));
        const currentCards = new Map(INITIAL_CARDS.map((card) => [card.id, card]));
        parsed.cards.forEach((card) => {
          const source = currentCards.get(card.id);
          if (source && /^Horror/.test(card.title)) card.title = source.title;
        });
        parsed.game.cemetery.forEach((entry) => {
          const source = currentCards.get(entry.cardId);
          if (source && /^Horror/.test(entry.title ?? "")) entry.title = source.title;
        });
        const currentManuals = new Map(INITIAL_MANUALS.map((manual) => [manual.id, manual]));
        parsed.manuals.forEach((manual) => {
          const source = currentManuals.get(manual.id);
          if (source && manual.id.startsWith("MANUAL_CC_HORROR_CAOS_") && /^Horror Caos/.test(manual.title)) {
            manual.title = source.title;
            manual.summary = source.summary;
          }
        });
        parsed.game.cemetery ??= [];
        parsed.game.completedRounds ??= 0;
        parsed.catalogVersion = 9;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 10) {
        renameJokerTerms(parsed);
        parsed.catalogVersion = 10;
        saveState(parsed);
      }
      if ((parsed.catalogVersion ?? 0) < 11) {
        const canonicalCards = new Map(INITIAL_CARDS.map((card) => [card.id, card]));
        const minigameManualIds = new Set(
          INITIAL_CARDS.filter((card) => card.categoryId === "MINIJUEGO")
            .map((card) => card.manualId).filter(Boolean),
        );
        parsed.cards.forEach((card) => {
          const source = canonicalCards.get(card.id);
          if (source?.categoryId === "MINIJUEGO") card.title = source.title;
        });
        const canonicalManuals = new Map(INITIAL_MANUALS.map((manual) => [manual.id, manual]));
        parsed.manuals.forEach((manual) => {
          const source = canonicalManuals.get(manual.id);
          if (!source || !minigameManualIds.has(manual.id)) return;
          manual.title = source.title;
          manual.summary = source.summary;
        });
        parsed.game.jokerInventory ??= [];
        parsed.game.jokerProgress ??= {};
        parsed.game.pendingJokerResolution ??= null;
        const oldEvent = parsed.game.activeRoundEvent;
        if (oldEvent) {
          for (const card of parsed.cards) {
            if (card.id in (oldEvent.savedEnabledStates ?? {}))
              card.enabled = oldEvent.savedEnabledStates[card.id];
          }
          if (oldEvent.savedDecks) parsed.game.decks = oldEvent.savedDecks;
          parsed.game.roundEventHistory = (parsed.game.roundEventHistory ?? []).map((entry) =>
            entry.status === "active"
              ? { ...entry, status: "cancelled", cancelledAt: new Date().toISOString() }
              : entry,
          );
          parsed.game.activeRoundEvent = null;
        }
        parsed.catalogVersion = 11;
        saveState(parsed);
      }
      parsed.gameId ??= GAME_ID;
      parsed.game.completedTurns ??= 0;
      parsed.game.completedRounds ??= 0;
      parsed.game.cemetery ??= [];
      parsed.game.fragments ??= [];
      parsed.game.fragmentCompletions ??= 0;
      parsed.game.roundEventHistory ??= [];
      parsed.game.jokerInventory ??= [];
      parsed.game.jokerProgress ??= {};
      parsed.game.pendingJokerResolution ??= null;
      parsed.game.powers ??= [];
      parsed.game.usedPowers ??= [];
      parsed.game.chain ??= null;
      if (loadedLegacyKey) saveState(parsed);
      return parsed;
    }
  } catch (error) {
    console.error("No se pudo leer el almacenamiento local", error);
  }
  return seedState();
}
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("No se pudo guardar", error);
    return false;
  }
}
export function validateCards(cards, manuals = []) {
  if (!Array.isArray(cards))
    throw new Error("El JSON debe contener una lista de cartas.");
  const ids = new Set(),
    categories = new Set([
      "VERDAD",
      "DESAFIO",
      "MINIJUEGO",
      "MALDICION",
      "PREMIO",
      "CASTIGO",
    ]),
    modes = new Set([
      "CURRENT_PLAYER",
      "RANDOM_PLAYER",
      "NEXT_PLAYER",
      "PREVIOUS_PLAYER",
      "LEFT_PLAYER",
      "RIGHT_PLAYER",
      "PLAYER_PAIR",
      "ALL_PLAYERS",
      "MANUAL_SELECTION",
    ]);
  for (const c of cards) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(c.id) ||
      ids.has(c.id)
    )
      throw new Error("Hay un ID inválido o repetido.");
    ids.add(c.id);
    if (!categories.has(c.categoryId))
      throw new Error(`Categoría inválida en ${c.id}.`);
    if (!c.title?.trim() || !c.description?.trim())
      throw new Error(`Título y descripción son obligatorios en ${c.id}.`);
    if (!Number.isInteger(c.spiceLevel) || c.spiceLevel < 0 || c.spiceLevel > 5)
      throw new Error(`Intensidad inválida en ${c.id}.`);
    if (!modes.has(c.target?.mode))
      throw new Error(`Asignación inválida en ${c.id}.`);
    if (
      !Number.isInteger(c.target.count) ||
      c.target.count < 0 ||
      c.target.count > 20
    )
      throw new Error(`Cantidad de participantes inválida en ${c.id}.`);
    if (
      !c.icon ||
      c.icon.type !== "glyph" ||
      typeof c.icon.value !== "string" ||
      c.icon.value.length > 8
    )
      throw new Error(`Icono no permitido en ${c.id}.`);
    if (
      !c.penalty ||
      typeof c.penalty.enabled !== "boolean" ||
      !Number.isFinite(c.penalty.units) ||
      c.penalty.units < 0
    )
      throw new Error(`Penalización inválida en ${c.id}.`);
    if (typeof c.enabled !== "boolean")
      throw new Error(`Estado habilitado inválido en ${c.id}.`);
    if (
      c.durationSeconds !== undefined &&
      (!Number.isInteger(c.durationSeconds) ||
        c.durationSeconds < 1 ||
        c.durationSeconds > 3600)
    )
      throw new Error(`Duración inválida en ${c.id}.`);
    if (c.effects !== undefined) validateEffects(c.effects, c.id);
    if (c.manualId && !manuals.some((m) => m.id === c.manualId))
      throw new Error(`No existe el manual de ${c.id}.`);
  }
  return true;
}

function validateEffects(effects, cardId) {
  if (!effects || typeof effects !== "object" || Array.isArray(effects))
    throw new Error(`Efectos inválidos en ${cardId}.`);
  for (const trigger of ["onCompleted", "onNotCompleted"]) {
    if (effects[trigger] === undefined) continue;
    const actions = Array.isArray(effects[trigger])
      ? effects[trigger]
      : [effects[trigger]];
    for (const action of actions) {
      if (!action || typeof action !== "object" || Array.isArray(action))
        throw new Error(`Acción de efecto inválida en ${cardId}.`);
      if (
        action.type === "DRAW_AUXILIARY" &&
        ["PREMIO", "CASTIGO"].includes(action.category)
      )
        continue;
      if (
        action.type === "GRANT_REWARD" &&
        typeof action.key === "string" &&
        action.key &&
        typeof action.label === "string" &&
        action.label
      )
        continue;
      if (action.type === "GRANT_POWER" && POWER_CATALOG.some((power) => power.id === action.key))
        continue;
      throw new Error(`Tipo o datos de efecto no reconocidos en ${cardId}.`);
    }
  }
}

export function exportCardCatalog(cards) {
  return { version: 1, cards: structuredClone(cards) };
}

export function parseCardImport(payload, existingCards = [], manuals = []) {
  if (!Array.isArray(payload) && (!payload || payload.version !== 1))
    throw new Error("La versión del catálogo JSON no es válida.");
  const cards = Array.isArray(payload) ? payload : payload?.cards;
  validateCards(cards, manuals);
  const existingIds = new Set(existingCards.map((card) => card.id));
  for (const card of cards) {
    if (existingIds.has(card.id))
      throw new Error(
        `El ID ${card.id} ya existe. No se modificó el catálogo.`,
      );
    existingIds.add(card.id);
  }
  return structuredClone(cards);
}
