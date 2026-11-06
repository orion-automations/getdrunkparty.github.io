import { drawFromDeck } from "./decks.js";
import { assignTargets } from "./participants.js";
import { DICE_FACES, rollDice } from "./dice.js";
import { ROUND_EVENTS } from "../data/round-events.js";
import { CHAIN_CHALLENGES } from "../data/chain-challenges.js";
import { POWER_CATALOG } from "../data/power-catalog.js";
import {
  buildMinigameSelectionQueue,
  validateMinigameOutcomes,
} from "./minigame-results.js";

const MAIN_CATEGORIES = new Set(["VERDAD", "DESAFIO", "MINIJUEGO", "MALDICION"]);
const AUX_CATEGORIES = new Set(["PREMIO", "CASTIGO"]);
const VALID_CATEGORIES = new Set([
  ...MAIN_CATEGORIES,
  ...AUX_CATEGORIES,
  "BLOQUEADA",
]);

function attachCard(
  state,
  turn,
  category,
  random,
  auxiliary = false,
  recipientId = null,
) {
  const draw = drawFromDeck(state.cards, category, state.game.decks, random, (state.game.cemetery ?? []).map((entry) => entry.cardId));
  if (!draw.card) return { category, empty: true, reason: draw.reason };
  const targets = assignTargets(
    draw.card.target.mode,
    state.participants,
    state.game.currentIndex,
    state.settings.positionReversed,
    random,
  );
  const item = {
    cardId: draw.card.id,
    category,
    targetIds: recipientId ? [recipientId] : targets.map((p) => p.id),
    ...(recipientId ? { playerId: recipientId } : {}),
  };
  if (auxiliary) turn.auxiliaryCards.push(item);
  else {
    turn.type = "CARD";
    turn.cardId = item.cardId;
    turn.face = category;
    turn.targetIds = item.targetIds;
    turn.primaryCard = item;
    if (category === "MINIJUEGO") turn.participantIds = [...item.targetIds];
    turn.phase = "RESOLVING";
  }
  return { category, card: draw.card, targets, auxiliary };
}

export function gameEngine(state, random = Math.random) {
  if (!["digital", "physical"].includes(state.settings.gameMode))
    state.settings.gameMode = "digital";
  state.game.auxiliaryCards ??= [];
  state.game.completedTurns ??= 0;
  state.game.completedRounds ??= 0;
  state.game.cemetery ??= [];
  state.game.roundEventHistory ??= [];
  state.game.powers ??= [];
  state.game.usedPowers ??= [];
  state.game.chain ??= null;
  // Migrate el turno de la versión anterior sin descartar la carta que estaba abierta.
  if (state.game.current) {
    state.game.current.auxiliaryCards ??= [];
    state.game.current.outcome ??= null;
    state.game.current.pendingSelections ??= [];
    state.game.current.optionalSelectionsUsed ??= [];
    state.game.current.participantIds ??=
      state.game.current.primaryCard?.targetIds ?? [];
    state.game.current.phase ??=
      state.game.state === "RESOLVING" ? "RESOLVING" : "ROLLING";
    if (state.game.current.type === "CARD" && state.game.current.cardId) {
      state.game.current.category ??= state.game.current.face;
      state.game.current.primaryCard ??= {
        cardId: state.game.current.cardId,
        category: state.game.current.face,
        targetIds: state.game.current.targetIds ?? [],
      };
    }
    if (state.game.current.type === "SHOT") {
      state.game.current.type = "BLOCKED";
      state.game.current.category = "BLOQUEADA";
      state.game.current.face = "BLOQUEADA";
      state.game.current.phase = "RESOLVING";
    }
  }
  let locked = Boolean(state.game.current || state.game.state !== "READY");
  const currentPlayer = () => state.participants[state.game.currentIndex];

  function beginTurn(category, phase = "RESOLVING") {
    if (locked || state.game.state !== "READY") return { error: "LOCKED" };
    if (!state.participants.some((p) => p.active))
      return { error: "NO_PLAYERS" };
    if (!VALID_CATEGORIES.has(category)) return { error: "INVALID_CATEGORY" };
    const turn = {
      type: category === "BLOQUEADA" ? "BLOCKED" : "TURN",
      face: category,
      category,
      playerId: currentPlayer()?.id,
      primaryCard: null,
      auxiliaryCards: [],
      discardedCards: [],
      participantIds: [],
      minigameResult: null,
      pendingSelections: [],
      optionalSelectionsUsed: [],
      armedSelection: null,
      outcome: null,
      phase,
      startedAt: new Date().toISOString(),
    };
    state.game.current = turn;
    state.game.lastFace = category;
    state.game.state = phase === "ROLLING" ? "ROLLING" : "RESOLVING";
    locked = true;
    return turn;
  }

  function drawMain(category) {
    const turn = beginTurn(category);
    if (turn.error) return turn;
    if (category === "BLOQUEADA") return { category, blocked: true };
    const result = attachCard(state, turn, category, random);
    if (result.empty) turn.phase = "EMPTY";
    return result;
  }

  return {
    get locked() {
      return locked;
    },
    rollDigital() {
      const face = state.game.activeRoundEvent?.effect === "destiny"
        ? DICE_FACES.find((entry) => entry.category === "MALDICION")
        : rollDice(random);
      const result = beginTurn(face.category, "ROLLING");
      if (result.error) return result;
      // La misma cara elegida gobierna el resultado visual y el mazo posterior.
      state.game.current.diceFace = face.id;
      state.game.current.face = face.category;
      state.game.lastFace = face.category;
      return { face };
    },
    rerollDigital() {
      const turn = state.game.current;
      if (
        !turn ||
        state.settings.gameMode !== "digital" ||
        turn.primaryCard ||
        !(
          ["ROLLING", "AWAITING_CATEGORY"].includes(turn.phase) ||
          (turn.type === "BLOCKED" && turn.phase === "RESOLVING")
        )
      )
        return { error: "LOCKED" };
      state.game.current = null;
      state.game.state = "READY";
      locked = false;
      return this.rollDigital();
    },
    completeRoll() {
      const turn = state.game.current;
      if (!turn || state.game.state !== "ROLLING" || turn.phase !== "ROLLING")
        return { error: "LOCKED" };
      if (turn.category === "BLOQUEADA") {
        turn.type = "BLOCKED";
        turn.phase = "RESOLVING";
        state.game.state = "RESOLVING";
        return { category: turn.category, blocked: true };
      }
      // El dado solo determina la categoría. El jugador revela la carta
      // pulsando el reverso del mazo que quedó habilitado.
      turn.phase = "AWAITING_CATEGORY";
      state.game.state = "RESOLVING";
      return { category: turn.category, awaitingCategory: true };
    },
    setMinigameParticipants(playerIds) {
      const turn = state.game.current;
      const card =
        turn?.primaryCard &&
        state.cards.find((item) => item.id === turn.primaryCard.cardId);
      if (!turn || card?.categoryId !== "MINIJUEGO" || turn.minigameResult)
        return { error: "LOCKED" };
      if (
        !Array.isArray(playerIds) ||
        new Set(playerIds).size !== playerIds.length
      )
        return { error: "INVALID_PARTICIPANTS" };
      const eligible = new Set(
        state.participants
          .filter((player) => player.active)
          .map((player) => player.id),
      );
      if (!playerIds.length || playerIds.some((id) => !eligible.has(id)))
        return { error: "INVALID_PARTICIPANTS" };
      if (
        ["PLAYER_PAIR", "MANUAL_SELECTION"].includes(card.target.mode) &&
        playerIds.length !== card.target.count
      )
        return { error: "INVALID_PARTICIPANT_COUNT" };
      if (
        card.target.mode === "ALL_PLAYERS" &&
        playerIds.length !== eligible.size
      )
        return { error: "INVALID_PARTICIPANT_COUNT" };
      turn.participantIds = [...playerIds];
      turn.primaryCard.targetIds = [...playerIds];
      return { participantIds: turn.participantIds };
    },
    recordMinigameResult(outcomes) {
      const turn = state.game.current;
      const card =
        turn?.primaryCard &&
        state.cards.find((item) => item.id === turn.primaryCard.cardId);
      if (
        !turn ||
        card?.categoryId !== "MINIJUEGO" ||
        turn.minigameResult ||
        turn.outcome
      )
        return { error: "LOCKED" };
      const participants = (turn.participantIds ?? [])
        .map((id) => state.participants.find((player) => player.id === id))
        .filter(Boolean);
      try {
        validateMinigameOutcomes(participants, outcomes);
        const manual = state.manuals.find((item) => item.id === card.manualId);
        const rules = manual?.details?.consequenceRules ?? [];
        const pendingSelections = buildMinigameSelectionQueue(
          rules,
          participants,
          outcomes,
        );
        for (const effect of normalizeEffects(card.effects?.onCompleted)) {
          if (
            effect.type === "DRAW_AUXILIARY" &&
            AUX_CATEGORIES.has(effect.category)
          ) {
            pendingSelections.push({
              category: effect.category,
              playerId: turn.playerId,
              eligiblePlayerIds: [turn.playerId],
              ruleIndex: null,
            });
          }
        }
        turn.pendingEffects = normalizeEffects(card.effects?.onCompleted);
        const recordedAt = new Date().toISOString();
        turn.minigameResult = {
          participantIds: participants.map((player) => player.id),
          winners: outcomes
            .filter((item) => item.result === "WIN")
            .map((item) => item.playerId),
          losers: outcomes
            .filter((item) => item.result === "LOSS")
            .map((item) => item.playerId),
          neutral: outcomes
            .filter((item) => item.result === "NEUTRAL")
            .map((item) => item.playerId),
          recordedAt,
        };
        turn.pendingSelections = pendingSelections;
        turn.outcome = {
          result: "MINIGAME_RECORDED",
          sourceCardId: turn.primaryCard.cardId,
          at: recordedAt,
        };
        turn.phase = "CONFIRMED";
        return {
          result: turn.minigameResult,
          pendingSelections: pendingSelections.length,
        };
      } catch (error) {
        return { error: "INVALID_MINIGAME_RESULT", message: error.message };
      }
    },
    armMinigameSelection(playerId) {
      const turn = state.game.current;
      const next = turn?.pendingSelections?.[0];
      if (!turn?.minigameResult || !next || turn.armedSelection)
        return { error: "LOCKED" };
      if (!next.eligiblePlayerIds.includes(playerId))
        return { error: "INVALID_RECIPIENT" };
      turn.armedSelection = {
        playerId,
        category: next.category,
        ruleIndex: next.ruleIndex,
      };
      return { category: next.category, playerId };
    },
    armOptionalMinigameSelection(category, playerId) {
      const turn = state.game.current;
      if (
        !turn?.minigameResult ||
        turn.pendingSelections?.length ||
        turn.armedSelection
      )
        return { error: "LOCKED" };
      if (
        !AUX_CATEGORIES.has(category) ||
        !playerId ||
        (category === "PREMIO" &&
          !turn.minigameResult.winners.includes(playerId)) ||
        (category === "CASTIGO" &&
          !turn.minigameResult.losers.includes(playerId))
      )
        return { error: "INVALID_RECIPIENT" };
      turn.optionalSelectionsUsed ??= [];
      if (turn.optionalSelectionsUsed.includes(category))
        return { error: "ALREADY_USED" };
      turn.armedSelection = {
        playerId,
        category,
        ruleIndex: null,
        optional: true,
      };
      return { category, playerId };
    },
    draw(category) {
      if (state.game.current && state.game.state === "RESOLVING") {
        if (state.game.current.type === "BLOCKED") return { error: "LOCKED" };
        const turn = state.game.current;
        if (category === "CASTIGO" && turn.shieldArmed) {
          turn.shieldArmed = false;
          turn.powerMessage = "El Escudo violeta canceló el castigo.";
          state.game.powers = state.game.powers.filter((power) => power.id !== turn.shieldPowerId);
          state.game.usedPowers.unshift({ key: "shield", playerId: turn.playerId, at: new Date().toISOString() });
          return { category, blocked: true, shielded: true };
        }
        if (turn.category === "MINIJUEGO" && turn.minigameResult) {
          const next = turn.pendingSelections?.[0];
          const armed = turn.armedSelection;
          if (armed?.optional) {
            if (!AUX_CATEGORIES.has(category))
              return { error: "SELECTION_NOT_ARMED" };
            const eligibleIds =
              category === "PREMIO"
                ? turn.minigameResult.winners
                : turn.minigameResult.losers;
            if (
              next ||
              armed.category !== category ||
              !eligibleIds.includes(armed.playerId) ||
              turn.optionalSelectionsUsed?.includes(category)
            )
              return { error: "SELECTION_NOT_ARMED" };
            const result = attachCard(
              state,
              turn,
              category,
              random,
              true,
              armed.playerId,
            );
            if (result.empty) return result;
            turn.optionalSelectionsUsed ??= [];
            turn.optionalSelectionsUsed.push(category);
            turn.armedSelection = null;
            return result;
          }
          if (
            !next ||
            !armed ||
            armed.category !== category ||
            next.category !== category ||
            !next.eligiblePlayerIds.includes(armed.playerId)
          )
            return { error: "SELECTION_NOT_ARMED" };
          const result = attachCard(
            state,
            turn,
            category,
            random,
            true,
            armed.playerId,
          );
          if (result.empty) return result;
          turn.pendingSelections.shift();
          turn.armedSelection = null;
          return result;
        }
        if (turn.phase === "AWAITING_CATEGORY") {
          if (!MAIN_CATEGORIES.has(category) || category !== turn.category)
            return { error: "LOCKED" };
          const result = attachCard(state, turn, category, random);
          if (result.empty) turn.phase = "EMPTY";
          return result;
        }
        if (!AUX_CATEGORIES.has(category)) return { error: "LOCKED" };
        const effectAllowsDraw = (turn.pendingEffects ?? []).some(
          (effect) =>
            effect.type === "DRAW_AUXILIARY" && effect.category === category,
        );
        if (
          !turn.primaryCard ||
          (turn.outcome && !effectAllowsDraw) ||
          turn.auxiliaryCards.length > 0
        )
          return { error: "AUXILIARY_ALREADY_DRAWN" };
        const result = attachCard(state, turn, category, random, true);
        if (!result.empty) turn.phase = "RESOLVING";
        return result;
      }
      if (MAIN_CATEGORIES.has(category) || category === "BLOQUEADA")
        return drawMain(category);
      return { error: "INVALID_CATEGORY" };
    },
    redraw(cardId) {
      const turn = state.game.current;
      if (!turn || turn.outcome || turn.phase === "AWAITING_CATEGORY")
        return { error: "LOCKED" };
      const item = [turn.primaryCard, ...(turn.auxiliaryCards ?? [])].find(
        (candidate) => candidate?.cardId === cardId,
      );
      if (!item || !MAIN_CATEGORIES.has(item.category))
        return { error: "INVALID_CARD" };
      const draw = drawFromDeck(state.cards, item.category, state.game.decks, random, (state.game.cemetery ?? []).map((entry) => entry.cardId));
      if (!draw.card) return { category: item.category, empty: true, reason: draw.reason };
      const targets = item.playerId
        ? [item.playerId]
        : assignTargets(
            draw.card.target.mode,
            state.participants,
            state.game.currentIndex,
            state.settings.positionReversed,
            random,
          ).map((player) => player.id);
      turn.discardedCards ??= [];
      turn.discardedCards.push({ cardId: item.cardId, category: item.category, playerId: item.playerId ?? turn.playerId });
      item.cardId = draw.card.id;
      item.targetIds = targets;
      if (item === turn.primaryCard) {
        turn.cardId = item.cardId;
        turn.targetIds = targets;
        if (item.category === "MINIJUEGO") {
          turn.participantIds = [...targets];
          turn.minigameResult = null;
          turn.pendingSelections = [];
          turn.armedSelection = null;
        }
      }
      return { category: item.category, card: draw.card, item };
    },
    activatePower(powerId) {
      const turn = state.game.current;
      if (!turn || turn.playerId !== currentPlayer()?.id) return { error: "NOT_ACTIVE_TURN" };
      const power = state.game.powers.find((item) => item.id === powerId && item.playerId === turn.playerId);
      const definition = power && POWER_CATALOG.find((item) => item.id === power.key);
      if (!power || !definition) return { error: "POWER_NOT_FOUND" };
      if (power.key === "shield") {
        if (turn.outcome || turn.auxiliaryCards?.some((item) => item.category === "CASTIGO")) return { error: "POWER_TIMING" };
        turn.shieldArmed = true;
        turn.shieldPowerId = power.id;
      } else if (power.key === "redraw") {
        if (!turn.primaryCard || turn.outcome) return { error: "POWER_TIMING" };
        const auxiliary = turn.auxiliaryCards?.at(-1);
        if (auxiliary) {
        const replacement = drawFromDeck(state.cards, auxiliary.category, state.game.decks, random, (state.game.cemetery ?? []).map((entry) => entry.cardId));
          if (!replacement.card) return { error: "POWER_FAILED" };
        turn.discardedCards ??= [];
        turn.discardedCards.push({ cardId: auxiliary.cardId, category: auxiliary.category, playerId: auxiliary.playerId ?? turn.playerId });
          auxiliary.cardId = replacement.card.id;
        } else {
          if (!MAIN_CATEGORIES.has(turn.category)) return { error: "POWER_TIMING" };
          const changed = this.redraw(turn.primaryCard.cardId);
          if (!changed.card) return { error: "POWER_FAILED" };
        }
      } else if (power.key === "pass") {
        if (!turn.primaryCard || turn.outcome || turn.category !== "DESAFIO") return { error: "POWER_TIMING" };
        turn.outcome = { result: "ALTERNATIVE_SELECTED", sourceCardId: turn.primaryCard.cardId, at: new Date().toISOString(), powerId: power.id };
        turn.phase = "CONFIRMED";
      }
      state.game.powers = state.game.powers.filter((item) => item.id !== power.id);
      state.game.usedPowers.unshift({ key: power.key, label: power.label, playerId: turn.playerId, at: new Date().toISOString() });
      if (power.key === "pass" && !this.finishTurn()) return { error: "POWER_FAILED" };
      return { power: definition, resolved: power.key === "pass" };
    },
    grantPower(playerId, key, source = "card") {
      const definition = POWER_CATALOG.find((item) => item.id === key);
      if (!definition || !state.participants.some((player) => player.id === playerId)) return { error: "INVALID_POWER" };
      const id = `power_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      state.game.powers.unshift({ id, key, label: definition.label, playerId, source, createdAt: new Date().toISOString() });
      return { id, key, playerId };
    },
    startChain(random = Math.random) {
      if (state.game.chain || state.game.current) return { error: "LOCKED" };
      const participants = state.participants.filter((player) => player.active);
      if (participants.length < 2) return { error: "NEED_TWO_PLAYERS" };
      const prompt = CHAIN_CHALLENGES[Math.floor(random() * CHAIN_CHALLENGES.length)];
      const starter = participants.find((player) => player.id === currentPlayer()?.id) ?? participants[0];
      state.game.chain = { id: `chain_${Date.now()}`, challengeId: prompt.id, playerIds: participants.map((player) => player.id), starterId: starter.id, activePlayerId: starter.id, visited: [], maxLinks: Math.min(prompt.maxLinks, participants.length), status: "active", startedAt: new Date().toISOString() };
      return { chain: state.game.chain, prompt };
    },
    continueChain() {
      const chain = state.game.chain;
      if (!chain || chain.status !== "active") return { error: "NO_ACTIVE_CHAIN" };
      chain.visited.push({ playerId: chain.activePlayerId, result: "CONTINUED", at: new Date().toISOString() });
      const next = chain.playerIds.find((id) => !chain.visited.some((entry) => entry.playerId === id));
      if (!next || chain.visited.length >= chain.maxLinks) return this.finishChain("LIMIT_REACHED");
      chain.activePlayerId = next;
      return { activePlayerId: next };
    },
    finishChain(reason = "VOLUNTARY") {
      const chain = state.game.chain;
      if (!chain) return { error: "NO_ACTIVE_CHAIN" };
      if (chain.status === "active" && !chain.visited.some((entry) => entry.playerId === chain.activePlayerId)) chain.visited.push({ playerId: chain.activePlayerId, result: reason === "VOLUNTARY" ? "CLOSED" : "CONTINUED", at: new Date().toISOString() });
      chain.status = "finished";
      chain.finishedAt = new Date().toISOString();
      chain.finishReason = reason;
      state.game.chain = null;
      state.game.chainHistory ??= [];
      state.game.chainHistory.unshift(chain);
      state.game.chainHistory = state.game.chainHistory.slice(0, 10);
      return { finished: true };
    },
    resolve(result, sourceCardId = null) {
      const turn = state.game.current;
      if (
        !locked ||
        state.game.state !== "RESOLVING" ||
        !turn ||
        turn.outcome ||
        turn.category === "MINIJUEGO"
      )
        return false;
      turn.outcome = { result, sourceCardId, at: new Date().toISOString() };
      turn.phase = "CONFIRMED";
      const resolvedItem = sourceCardId
        ? [turn.primaryCard, ...turn.auxiliaryCards].find(
            (item) => item?.cardId === sourceCardId,
          )
        : turn.primaryCard;
      const resolvedCard =
        resolvedItem &&
        state.cards.find((card) => card.id === resolvedItem.cardId);
      const trigger = result === "COMPLETED" ? "onCompleted" : "onNotCompleted";
      turn.pendingEffects = normalizeEffects(resolvedCard?.effects?.[trigger]);
      return true;
    },
    finishTurn() {
      const turn = state.game.current;
      if (!locked || state.game.state !== "RESOLVING" || !turn) return false;
      if (!turn.outcome && turn.type !== "BLOCKED" && turn.phase !== "EMPTY")
        return false;
      if (
        turn.category === "MINIJUEGO" &&
        (turn.pendingSelections?.length || turn.armedSelection)
      )
        return false;
      const player = state.participants.find((p) => p.id === turn.playerId);
      const chosen = turn.outcome?.sourceCardId
        ? [turn.primaryCard, ...turn.auxiliaryCards].find(
            (item) => item?.cardId === turn.outcome.sourceCardId,
          )
        : turn.primaryCard;
      const card = chosen
        ? state.cards.find((c) => c.id === chosen.cardId)
        : null;
      const blocked = turn.type === "BLOCKED";
      state.game.cemetery ??= [];
      for (const item of [...(turn.discardedCards ?? []), turn.primaryCard, ...(turn.auxiliaryCards ?? [])]) {
        if (!item?.cardId) continue;
        const drawn = state.cards.find((entry) => entry.id === item.cardId);
        if (!drawn) continue;
        state.game.cemetery.unshift({
          cardId: drawn.id,
          title: drawn.title,
          category: item.category ?? drawn.categoryId,
          playerId: item.playerId ?? turn.playerId,
          playerName: state.participants.find((entry) => entry.id === (item.playerId ?? turn.playerId))?.name ?? player?.name ?? "Participante",
          drawnAt: new Date().toISOString(),
        });
      }
      state.game.history.unshift({
        at: new Date().toISOString(),
        playerName: player?.name ?? "Participante",
        type: blocked ? "BLOCKED" : card ? "CARD" : "TURN",
        title: blocked ? "Cara bloqueada" : (card?.title ?? "Mazo agotado"),
        category: turn.category,
        result: blocked
          ? "NO_ACTION"
          : turn.minigameResult
            ? "MINIGAME"
            : (turn.outcome?.result ?? "EMPTY"),
        ...(turn.minigameResult
          ? {
              participants: turn.minigameResult.participantIds,
              winners: turn.minigameResult.winners,
              losers: turn.minigameResult.losers,
              neutral: turn.minigameResult.neutral,
              consequenceCards: turn.auxiliaryCards.map((item) => ({
                cardId: item.cardId,
                category: item.category,
                playerId: item.playerId ?? null,
              })),
            }
          : {}),
      });
      state.game.history = state.game.history.slice(0, 20);
      if (
        card?.categoryId === "PREMIO" &&
        turn.outcome?.result === "COMPLETED"
      ) {
        state.game.rewards ??= [];
        state.game.rewards.unshift({
          id: `reward_${Date.now()}_${state.game.rewards.length}`,
          cardId: card.id,
          title: card.title,
          playerId: turn.playerId,
          used: false,
          createdAt: new Date().toISOString(),
        });
      }
      if (turn.minigameResult) {
        for (const item of turn.auxiliaryCards) {
          const consequence = state.cards.find((c) => c.id === item.cardId);
          if (consequence?.categoryId !== "PREMIO") continue;
          state.game.rewards ??= [];
          const ownerId = item.playerId ?? turn.playerId;
          state.game.rewards.unshift({
            id: `reward_${Date.now()}_${state.game.rewards.length}`,
            cardId: consequence.id,
            title: consequence.title,
            playerId: ownerId,
            used: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
      for (const effect of turn.pendingEffects ?? []) {
        if (effect.type === "GRANT_POWER" && POWER_CATALOG.some((power) => power.id === effect.key)) {
          this.grantPower(turn.playerId, effect.key, card?.id ?? "card");
          continue;
        }
        if (effect.type !== "GRANT_REWARD" || !effect.key || !effect.label)
          continue;
        state.game.rewards ??= [];
        state.game.rewards.unshift({
          id: `reward_${Date.now()}_${state.game.rewards.length}`,
          cardId: card?.id ?? null,
          effectKey: effect.key,
          title: effect.label,
          playerId: turn.playerId,
          used: false,
          createdAt: new Date().toISOString(),
        });
      }
      if (turn.minigameResult) {
        for (const item of turn.auxiliaryCards ?? []) {
          const awardedCard = state.cards.find((entry) => entry.id === item.cardId);
          if (awardedCard?.categoryId !== "PREMIO") continue;
          for (const effect of normalizeEffects(awardedCard.effects?.onCompleted)) {
            if (effect.type === "GRANT_POWER" && POWER_CATALOG.some((power) => power.id === effect.key)) {
              this.grantPower(item.playerId ?? turn.playerId, effect.key, awardedCard.id);
            }
          }
        }
      }
      state.game.completedTurns += 1;
      const reverseOrder = state.game.activeRoundEvent?.effect === "reverse_order";
      const activeIndexes = state.participants.map((player, index) => player.active ? index : -1).filter((index) => index >= 0);
      const position = Math.max(0, activeIndexes.indexOf(state.game.currentIndex));
      const direction = reverseOrder && activeIndexes.length > 1 ? -1 : 1;
      const nextPosition = activeIndexes.length ? (position + direction + activeIndexes.length) % activeIndexes.length : 0;
      const roundCompleted = activeIndexes.length > 0 && nextPosition === 0 && (position !== 0 || activeIndexes.length === 1);
      if (roundCompleted) state.game.completedRounds += 1;
      applyRoundProgress(state, this, roundCompleted);
      state.game.currentIndex = activeIndexes[nextPosition] ?? 0;
      state.game.current = null;
      state.game.state = "READY";
      locked = false;
      return true;
    },
    // Compatibilidad con la acción antigua; ahora solo registra y nunca avanza.
    startShot() {
      return { error: "INVALID_CATEGORY" };
    },
    cancel() {
      const turn = state.game.current;
      if (!turn) return false;
      for (const item of [...(turn.discardedCards ?? []), turn.primaryCard, ...turn.auxiliaryCards]) {
        const deck = item && state.game.decks[item.category];
        if (deck) deck.index = Math.max(0, deck.index - 1);
      }
      state.game.current = null;
      state.game.state = "READY";
      locked = false;
      return true;
    },
  };
}

function applyRoundProgress(state, engine, roundCompleted) {
  const completedRounds = state.game.completedRounds;
  let activeEvent = state.game.activeRoundEvent;
  if (activeEvent && ["grant_pass", "grant_redraw", "grant_shield"].includes(activeEvent.effect)) {
    const key = activeEvent.effect === "grant_pass" ? "pass" : activeEvent.effect === "grant_redraw" ? "redraw" : "shield";
    activeEvent.participantGrants ??= [];
    if (!activeEvent.participantGrants.includes(state.game.current?.playerId)) {
      activeEvent.participantGrants.push(state.game.current?.playerId);
      engine.grantPower(state.game.current?.playerId, key, activeEvent.id);
    }
  }
  if (activeEvent) {
    activeEvent.turnsRemaining -= 1;
    if (activeEvent.turnsRemaining <= 0) {
      closeRoundEvent(state, activeEvent);
      state.game.activeRoundEvent = null;
    }
  }
  if (roundCompleted && completedRounds > 0 && completedRounds % 5 === 0) {
    const event = ROUND_EVENTS[(completedRounds / 5 - 1) % ROUND_EVENTS.length];
    activeEvent = {
      ...event,
      turnsRemaining: event.durationTurns,
      eventRound: completedRounds / 5,
      participantGrants: [],
    };
    if (event.effect === "horrors" || event.effect === "destiny") activateSpecialEventDeck(state, activeEvent);
    state.game.activeRoundEvent = activeEvent;
    const { savedEnabledStates, savedDecks, ...historyEvent } = activeEvent;
    state.game.roundEventHistory.unshift({ ...historyEvent, status: "active", activatedAt: new Date().toISOString() });
    state.game.roundEventHistory = state.game.roundEventHistory.slice(0, 20);
  }
}

function closeRoundEvent(state, event) {
  restoreEventDecks(state, event);
  const entry = state.game.roundEventHistory.find((item) => item.id === event.id && item.status === "active");
  if (entry) Object.assign(entry, { status: "completed", completedAt: new Date().toISOString(), turnsRemaining: 0 });
  else state.game.roundEventHistory.unshift({ ...event, status: "completed", completedAt: new Date().toISOString(), turnsRemaining: 0 });
}

function activateSpecialEventDeck(state, event) {
  const eligible = state.cards.filter((card) => ["normal", "horrors", "curse"].includes(card.collection));
  event.savedEnabledStates = Object.fromEntries(eligible.map((card) => [card.id, card.enabled]));
  event.savedDecks = structuredClone(state.game.decks);
  eligible.forEach((card) => {
    card.enabled = event.effect === "horrors"
      ? card.collection === "horrors"
      : card.id.startsWith("CC_DESTINO_");
  });
  state.game.decks = {};
}

function restoreEventDecks(state, event) {
  if (!event?.savedEnabledStates) return;
  state.cards.forEach((card) => {
    if (Object.hasOwn(event.savedEnabledStates, card.id)) {
      card.enabled = event.savedEnabledStates[card.id];
    }
  });
  event.savedEnabledStates = null;
  state.game.decks = event.savedDecks ?? {};
  event.savedDecks = null;
}

function normalizeEffects(effects) {
  if (effects === undefined || effects === null) return [];
  return Array.isArray(effects) ? effects : [effects];
}
