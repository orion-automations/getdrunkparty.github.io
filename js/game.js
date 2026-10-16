import { drawFromDeck } from './decks.js';
import { assignTargets, nextIndex } from './participants.js';

const CATEGORIES = new Set(['VERDAD', 'DESAFIO', 'MINIJUEGO', 'PREMIO', 'CASTIGO']);

export function gameEngine(state, random = Math.random) {
  let locked = Boolean(state.game.current && state.game.state === 'RESOLVING');
  const currentPlayer = () => state.participants[state.game.currentIndex];
  return {
    get locked() { return locked; },
    draw(category) {
      if (locked || state.game.state !== 'READY') return { error: 'LOCKED' };
      if (!CATEGORIES.has(category)) return { error: 'INVALID_CATEGORY' };
      if (!state.participants.some(p => p.active)) return { error: 'NO_PLAYERS' };
      locked = true;
      state.game.state = 'DRAWING_CARD';
      const draw = drawFromDeck(state.cards, category, state.game.decks, random);
      if (!draw.card) {
        state.game.state = 'READY'; locked = false;
        return { category, empty: true };
      }
      const targets = assignTargets(draw.card.target.mode, state.participants, state.game.currentIndex, state.settings.positionReversed, random);
      state.game.lastFace = category;
      state.game.current = { type: 'CARD', face: category, cardId: draw.card.id, targetIds: targets.map(p => p.id), playerId: currentPlayer()?.id };
      state.game.state = 'RESOLVING';
      return { category, card: draw.card, targets };
    },
    startShot() {
      if (locked || state.game.state !== 'READY') return { error: 'LOCKED' };
      if (!state.participants.some(p => p.active)) return { error: 'NO_PLAYERS' };
      locked = true;
      state.game.lastFace = 'SHOT';
      state.game.current = { type: 'SHOT', face: 'SHOT', playerId: currentPlayer()?.id };
      state.game.state = 'RESOLVING';
      return { shot: true };
    },
    resolve(result) {
      if (!locked || state.game.state !== 'RESOLVING') return false;
      const current = state.game.current;
      if (!current) return false;
      const player = state.participants.find(p => p.id === current.playerId);
      const card = current.type === 'CARD' ? state.cards.find(c => c.id === current.cardId) : null;
      state.game.history.unshift({ at: new Date().toISOString(), playerName: player?.name ?? 'Participante', type: current.type, title: current.type === 'SHOT' ? 'Acción SHOT' : card?.title ?? 'Carta', result });
      state.game.history = state.game.history.slice(0, 20);
      if (card?.categoryId === 'PREMIO' && result === 'COMPLETED') {
        state.game.rewards ??= [];
        state.game.rewards.unshift({ id: `reward_${Date.now()}_${state.game.rewards.length}`, cardId: card.id, title: card.title, playerId: current.playerId, used: false, createdAt: new Date().toISOString() });
      }
      state.game.currentIndex = nextIndex(state.game.currentIndex, state.participants.length);
      state.game.current = null;
      state.game.state = 'READY'; locked = false;
      return true;
    },
    cancel() {
      if (state.game.state === 'RESOLVING' && state.game.current?.type === 'CARD') {
        const deck = state.game.decks[state.game.current.face];
        if (deck) deck.index = Math.max(0, deck.index - 1);
      }
      state.game.current = null; state.game.state = 'READY'; locked = false;
    }
  };
}
