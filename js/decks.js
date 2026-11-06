import { shuffle } from "./utils.js";
export function drawFromDeck(cards, category, decks, random = Math.random, cemeteryIds = []) {
  const buried = new Set(cemeteryIds);
  const categoryCards = cards.filter((card) => card.categoryId === category && card.enabled);
  const eligible = cards.filter(
    (card) => card.categoryId === category && card.enabled && !buried.has(card.id),
  );
  if (!eligible.length) return { card: null, reason: categoryCards.length ? "EXHAUSTED" : "EMPTY" };
  let deck = decks[category] ?? { order: [], index: 0, lastId: null };
  const oldOrder = deck.order;
  const liveIds = new Set(eligible.map((card) => card.id));
  let order = oldOrder.filter((id) => liveIds.has(id) && !buried.has(id));
  let index = Math.max(0, deck.index - oldOrder.slice(0, deck.index).filter((id) => buried.has(id) || !liveIds.has(id)).length);
  if (order.length < eligible.length)
    order = [
      ...order,
      ...shuffle(
        eligible.map((c) => c.id).filter((id) => !order.includes(id)),
        random,
      ),
    ];
  if (!order.length) {
    order = shuffle(
      eligible.map((c) => c.id),
      random,
    );
    if (order.length > 1 && order[0] === deck.lastId) {
      const swap = 1 + Math.floor(random() * (order.length - 1));
      [order[0], order[swap]] = [order[swap], order[0]];
    }
    deck = { order, index: 0, lastId: deck.lastId };
  } else if (index >= order.length) {
    return { card: null, reason: "EXHAUSTED" };
  } else deck = { ...deck, order, index };
  const id = deck.order[deck.index];
  const card = eligible.find((c) => c.id === id);
  decks[category] = { ...deck, index: deck.index + 1, lastId: id };
  return { card, reason: null };
}
export function resetDeck(decks, category) {
  delete decks[category];
}
