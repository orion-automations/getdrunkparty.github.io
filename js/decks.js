import { shuffle } from './utils.js';
export function drawFromDeck(cards, category, decks, random = Math.random) {
  const eligible = cards.filter(card => card.categoryId === category && card.enabled);
  if (!eligible.length) return { card: null, reason: 'EMPTY' };
  let deck = decks[category] ?? { order: [], index: 0, lastId: null };
  const liveIds = new Set(eligible.map(card => card.id));
  let order = deck.order.filter(id => liveIds.has(id));
  const usedCount = Math.min(deck.index, order.length);
  if (order.length < eligible.length) order = [...order, ...shuffle(eligible.map(c=>c.id).filter(id=>!order.includes(id)), random)];
  if (deck.index >= order.length || !order.length) {
    order = shuffle(eligible.map(c=>c.id), random);
    if (order.length > 1 && order[0] === deck.lastId) { const swap = 1 + Math.floor(random()*(order.length-1)); [order[0],order[swap]]=[order[swap],order[0]]; }
    deck = { order, index: 0, lastId: deck.lastId };
  } else deck = { ...deck, order };
  const id = deck.order[deck.index];
  const card = eligible.find(c=>c.id===id);
  decks[category] = { ...deck, index: deck.index+1, lastId: id };
  return { card, reason: null };
}
export function resetDeck(decks, category) { delete decks[category]; }
