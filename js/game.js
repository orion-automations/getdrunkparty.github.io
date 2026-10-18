import { drawFromDeck } from './decks.js';
import { assignTargets, nextIndex } from './participants.js';
import { rollDice } from './dice.js';
import { buildMinigameSelectionQueue, validateMinigameOutcomes } from './minigame-results.js';

const MAIN_CATEGORIES = new Set(['VERDAD', 'DESAFIO', 'MINIJUEGO']);
const AUX_CATEGORIES = new Set(['PREMIO', 'CASTIGO']);
const VALID_CATEGORIES = new Set([...MAIN_CATEGORIES, ...AUX_CATEGORIES, 'BLOQUEADA']);

function attachCard(state, turn, category, random, auxiliary = false, recipientId = null) {
  const draw = drawFromDeck(state.cards, category, state.game.decks, random);
  if (!draw.card) return { category, empty: true };
  const targets = assignTargets(
    draw.card.target.mode,
    state.participants,
    state.game.currentIndex,
    state.settings.positionReversed,
    random,
  );
  const item = { cardId: draw.card.id, category, targetIds: recipientId ? [recipientId] : targets.map((p) => p.id), ...(recipientId ? { playerId: recipientId } : {}) };
  if (auxiliary) turn.auxiliaryCards.push(item);
  else {
    turn.type = 'CARD';
    turn.cardId = item.cardId;
    turn.face = category;
    turn.targetIds = item.targetIds;
    turn.primaryCard = item;
    if (category === 'MINIJUEGO') turn.participantIds = [...item.targetIds];
    turn.phase = 'RESOLVING';
  }
  return { category, card: draw.card, targets, auxiliary };
}

export function gameEngine(state, random = Math.random) {
  if (!['digital', 'physical'].includes(state.settings.gameMode)) state.settings.gameMode = 'digital';
  state.game.auxiliaryCards ??= [];
  // Migrate el turno de la versión anterior sin descartar la carta que estaba abierta.
  if (state.game.current) {
    state.game.current.auxiliaryCards ??= [];
    state.game.current.outcome ??= null;
    state.game.current.pendingSelections ??= [];
    state.game.current.participantIds ??= state.game.current.primaryCard?.targetIds ?? [];
    state.game.current.phase ??= state.game.state === 'RESOLVING' ? 'RESOLVING' : 'ROLLING';
    if (state.game.current.type === 'CARD' && state.game.current.cardId) {
      state.game.current.category ??= state.game.current.face;
      state.game.current.primaryCard ??= {
        cardId: state.game.current.cardId,
        category: state.game.current.face,
        targetIds: state.game.current.targetIds ?? [],
      };
    }
    if (state.game.current.type === 'SHOT') {
      state.game.current.type = 'BLOCKED';
      state.game.current.category = 'BLOQUEADA';
      state.game.current.face = 'BLOQUEADA';
      state.game.current.phase = 'RESOLVING';
    }
  }
  let locked = Boolean(state.game.current || state.game.state !== 'READY');
  const currentPlayer = () => state.participants[state.game.currentIndex];

  function beginTurn(category, phase = 'RESOLVING') {
    if (locked || state.game.state !== 'READY') return { error: 'LOCKED' };
    if (!state.participants.some((p) => p.active)) return { error: 'NO_PLAYERS' };
    if (!VALID_CATEGORIES.has(category)) return { error: 'INVALID_CATEGORY' };
    const turn = {
      type: category === 'BLOQUEADA' ? 'BLOCKED' : 'TURN',
      face: category,
      category,
      playerId: currentPlayer()?.id,
      primaryCard: null,
      auxiliaryCards: [],
      participantIds: [],
      minigameResult: null,
      pendingSelections: [],
      armedSelection: null,
      outcome: null,
      phase,
      startedAt: new Date().toISOString(),
    };
    state.game.current = turn;
    state.game.lastFace = category;
    state.game.state = phase === 'ROLLING' ? 'ROLLING' : 'RESOLVING';
    locked = true;
    return turn;
  }

  function drawMain(category) {
    const turn = beginTurn(category);
    if (turn.error) return turn;
    if (category === 'BLOQUEADA') return { category, blocked: true };
    const result = attachCard(state, turn, category, random);
    if (result.empty) turn.phase = 'EMPTY';
    return result;
  }

  return {
    get locked() { return locked; },
    rollDigital() {
      const face = rollDice(random);
      const result = beginTurn(face.category, 'ROLLING');
      if (result.error) return result;
      // La misma cara elegida gobierna el resultado visual y el mazo posterior.
      state.game.current.diceFace = face.id;
      state.game.current.face = face.category;
      state.game.lastFace = face.category;
      return { face };
    },
    completeRoll() {
      const turn = state.game.current;
      if (!turn || state.game.state !== 'ROLLING' || turn.phase !== 'ROLLING') return { error: 'LOCKED' };
      if (turn.category === 'BLOQUEADA') {
        turn.type = 'BLOCKED';
        turn.phase = 'RESOLVING';
        state.game.state = 'RESOLVING';
        return { category: turn.category, blocked: true };
      }
      // El dado solo determina la categoría. El jugador revela la carta
      // pulsando el reverso del mazo que quedó habilitado.
      turn.phase = 'AWAITING_CATEGORY';
      state.game.state = 'RESOLVING';
      return { category: turn.category, awaitingCategory: true };
    },
    setMinigameParticipants(playerIds) {
      const turn = state.game.current;
      const card = turn?.primaryCard && state.cards.find((item) => item.id === turn.primaryCard.cardId);
      if (!turn || card?.categoryId !== 'MINIJUEGO' || turn.minigameResult) return { error: 'LOCKED' };
      if (!Array.isArray(playerIds) || new Set(playerIds).size !== playerIds.length) return { error: 'INVALID_PARTICIPANTS' };
      const eligible = new Set(state.participants.filter((player) => player.active).map((player) => player.id));
      if (!playerIds.length || playerIds.some((id) => !eligible.has(id))) return { error: 'INVALID_PARTICIPANTS' };
      if (['PLAYER_PAIR', 'MANUAL_SELECTION'].includes(card.target.mode) && playerIds.length !== card.target.count) return { error: 'INVALID_PARTICIPANT_COUNT' };
      if (card.target.mode === 'ALL_PLAYERS' && playerIds.length !== eligible.size) return { error: 'INVALID_PARTICIPANT_COUNT' };
      turn.participantIds = [...playerIds];
      turn.primaryCard.targetIds = [...playerIds];
      return { participantIds: turn.participantIds };
    },
    recordMinigameResult(outcomes) {
      const turn = state.game.current;
      const card = turn?.primaryCard && state.cards.find((item) => item.id === turn.primaryCard.cardId);
      if (!turn || card?.categoryId !== 'MINIJUEGO' || turn.minigameResult || turn.outcome) return { error: 'LOCKED' };
      const participants = (turn.participantIds ?? []).map((id) => state.participants.find((player) => player.id === id)).filter(Boolean);
      try {
        validateMinigameOutcomes(participants, outcomes);
        const manual = state.manuals.find((item) => item.id === card.manualId);
        const rules = manual?.details?.consequenceRules ?? [];
        const pendingSelections = buildMinigameSelectionQueue(rules, participants, outcomes);
        for (const effect of normalizeEffects(card.effects?.onCompleted)) {
          if (effect.type === 'DRAW_AUXILIARY' && AUX_CATEGORIES.has(effect.category)) {
            pendingSelections.push({ category: effect.category, playerId: turn.playerId, eligiblePlayerIds: [turn.playerId], ruleIndex: null });
          }
        }
        turn.pendingEffects = normalizeEffects(card.effects?.onCompleted);
        const recordedAt = new Date().toISOString();
        turn.minigameResult = {
          participantIds: participants.map((player) => player.id),
          winners: outcomes.filter((item) => item.result === 'WIN').map((item) => item.playerId),
          losers: outcomes.filter((item) => item.result === 'LOSS').map((item) => item.playerId),
          neutral: outcomes.filter((item) => item.result === 'NEUTRAL').map((item) => item.playerId),
          recordedAt,
        };
        turn.pendingSelections = pendingSelections;
        turn.outcome = { result: 'MINIGAME_RECORDED', sourceCardId: turn.primaryCard.cardId, at: recordedAt };
        turn.phase = 'CONFIRMED';
        return { result: turn.minigameResult, pendingSelections: pendingSelections.length };
      } catch (error) {
        return { error: 'INVALID_MINIGAME_RESULT', message: error.message };
      }
    },
    armMinigameSelection(playerId) {
      const turn = state.game.current;
      const next = turn?.pendingSelections?.[0];
      if (!turn?.minigameResult || !next || turn.armedSelection) return { error: 'LOCKED' };
      if (!next.eligiblePlayerIds.includes(playerId)) return { error: 'INVALID_RECIPIENT' };
      turn.armedSelection = { playerId, category: next.category, ruleIndex: next.ruleIndex };
      return { category: next.category, playerId };
    },
    draw(category) {
      if (state.game.current && state.game.state === 'RESOLVING') {
        if (state.game.current.type === 'BLOCKED') return { error: 'LOCKED' };
        const turn = state.game.current;
        if (turn.category === 'MINIJUEGO' && turn.minigameResult) {
          const next = turn.pendingSelections?.[0];
          const armed = turn.armedSelection;
          if (!next || !armed || armed.category !== category || next.category !== category || !next.eligiblePlayerIds.includes(armed.playerId)) return { error: 'SELECTION_NOT_ARMED' };
          const result = attachCard(state, turn, category, random, true, armed.playerId);
          if (result.empty) return result;
          turn.pendingSelections.shift();
          turn.armedSelection = null;
          return result;
        }
        if (turn.phase === 'AWAITING_CATEGORY') {
          if (!MAIN_CATEGORIES.has(category) || category !== turn.category) return { error: 'LOCKED' };
          const result = attachCard(state, turn, category, random);
          if (result.empty) turn.phase = 'EMPTY';
          return result;
        }
        if (!AUX_CATEGORIES.has(category)) return { error: 'LOCKED' };
        const effectAllowsDraw = (turn.pendingEffects ?? []).some((effect) => effect.type === 'DRAW_AUXILIARY' && effect.category === category);
        if (!turn.primaryCard || (turn.outcome && !effectAllowsDraw) || turn.auxiliaryCards.length > 0) return { error: 'AUXILIARY_ALREADY_DRAWN' };
        const result = attachCard(state, turn, category, random, true);
        if (!result.empty) turn.phase = 'RESOLVING';
        return result;
      }
      if (MAIN_CATEGORIES.has(category) || category === 'BLOQUEADA') return drawMain(category);
      return { error: 'INVALID_CATEGORY' };
    },
    resolve(result, sourceCardId = null) {
      const turn = state.game.current;
      if (!locked || state.game.state !== 'RESOLVING' || !turn || turn.outcome || turn.category === 'MINIJUEGO') return false;
      turn.outcome = { result, sourceCardId, at: new Date().toISOString() };
      turn.phase = 'CONFIRMED';
      const resolvedItem = sourceCardId
        ? [turn.primaryCard, ...turn.auxiliaryCards].find((item) => item?.cardId === sourceCardId)
        : turn.primaryCard;
      const resolvedCard = resolvedItem && state.cards.find((card) => card.id === resolvedItem.cardId);
      const trigger = result === 'COMPLETED' ? 'onCompleted' : 'onNotCompleted';
      turn.pendingEffects = normalizeEffects(resolvedCard?.effects?.[trigger]);
      return true;
    },
    finishTurn() {
      const turn = state.game.current;
      if (!locked || state.game.state !== 'RESOLVING' || !turn) return false;
      if (!turn.outcome && turn.type !== 'BLOCKED' && turn.phase !== 'EMPTY') return false;
      if (turn.category === 'MINIJUEGO' && turn.pendingSelections?.length) return false;
      const player = state.participants.find((p) => p.id === turn.playerId);
      const chosen = turn.outcome?.sourceCardId
        ? [turn.primaryCard, ...turn.auxiliaryCards].find((item) => item?.cardId === turn.outcome.sourceCardId)
        : turn.primaryCard;
      const card = chosen ? state.cards.find((c) => c.id === chosen.cardId) : null;
      const blocked = turn.type === 'BLOCKED';
      state.game.history.unshift({
        at: new Date().toISOString(),
        playerName: player?.name ?? 'Participante',
        type: blocked ? 'BLOCKED' : card ? 'CARD' : 'TURN',
        title: blocked ? 'Cara bloqueada' : card?.title ?? 'Mazo agotado',
        category: turn.category,
        result: blocked ? 'NO_ACTION' : turn.minigameResult ? 'MINIGAME' : turn.outcome?.result ?? 'EMPTY',
        ...(turn.minigameResult ? {
          participants: turn.minigameResult.participantIds,
          winners: turn.minigameResult.winners,
          losers: turn.minigameResult.losers,
          neutral: turn.minigameResult.neutral,
          consequenceCards: turn.auxiliaryCards.map((item) => ({ cardId: item.cardId, category: item.category, playerId: item.playerId ?? null })),
        } : {}),
      });
      state.game.history = state.game.history.slice(0, 20);
      if (card?.categoryId === 'PREMIO' && turn.outcome?.result === 'COMPLETED') {
        state.game.rewards ??= [];
        state.game.rewards.unshift({ id: `reward_${Date.now()}_${state.game.rewards.length}`, cardId: card.id, title: card.title, playerId: turn.playerId, used: false, createdAt: new Date().toISOString() });
      }
      if (turn.minigameResult) {
        for (const item of turn.auxiliaryCards) {
          const consequence = state.cards.find((c) => c.id === item.cardId);
          if (consequence?.categoryId !== 'PREMIO') continue;
          state.game.rewards ??= [];
          const ownerId = item.playerId ?? turn.playerId;
          state.game.rewards.unshift({ id: `reward_${Date.now()}_${state.game.rewards.length}`, cardId: consequence.id, title: consequence.title, playerId: ownerId, used: false, createdAt: new Date().toISOString() });
        }
      }
      for (const effect of turn.pendingEffects ?? []) {
        if (effect.type !== 'GRANT_REWARD' || !effect.key || !effect.label) continue;
        state.game.rewards ??= [];
        state.game.rewards.unshift({ id: `reward_${Date.now()}_${state.game.rewards.length}`, cardId: card?.id ?? null, effectKey: effect.key, title: effect.label, playerId: turn.playerId, used: false, createdAt: new Date().toISOString() });
      }
      state.game.currentIndex = nextIndex(state.game.currentIndex, state.participants.length);
      state.game.current = null;
      state.game.state = 'READY';
      locked = false;
      return true;
    },
    // Compatibilidad con la acción antigua; ahora solo registra y nunca avanza.
    startShot() { return { error: 'INVALID_CATEGORY' }; },
    cancel() {
      const turn = state.game.current;
      if (!turn) return false;
      for (const item of [turn.primaryCard, ...turn.auxiliaryCards]) {
        const deck = item && state.game.decks[item.category];
        if (deck) deck.index = Math.max(0, deck.index - 1);
      }
      state.game.current = null;
      state.game.state = 'READY';
      locked = false;
      return true;
    },
  };
}

function normalizeEffects(effects) {
  if (effects === undefined || effects === null) return [];
  return Array.isArray(effects) ? effects : [effects];
}
