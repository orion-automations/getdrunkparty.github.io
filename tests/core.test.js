import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CARDS } from '../data/initial-cards.js';
import { INITIAL_MANUALS } from '../data/initial-manuals.js';
import { drawFromDeck } from '../js/decks.js';
import { nextIndex, assignTargets } from '../js/participants.js';
import { validateCards, seedState, isValidState, parseCardImport, exportCardCatalog, loadState, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../js/storage.js';
import { gameEngine } from '../js/game.js';
import { DICE_FACES, rollDice, categoryProbabilities, diceRotationTarget } from '../js/dice.js';
import { validateMinigameRules } from '../js/minigame-results.js';
import { MIDNIGHT_CARDS } from '../data/midnight-catalog.js';
import { ROUND_EVENTS } from '../data/round-events.js';
import { CHAIN_CHALLENGES } from '../data/chain-challenges.js';
import { POWER_CATALOG } from '../data/power-catalog.js';
import { PDF_CARDS } from '../data/pdf-catalog.js';
import { CARNIVAL_CARDS } from '../data/carnival-catalog.js';
import { GAME_ID, GAME_NAME } from '../js/config.js';

test('Carnival of Chaos conserva la identidad interna de juego sin migrar los datos existentes', () => {
  assert.equal(GAME_NAME, 'Carnival of Chaos');
  assert.equal(GAME_ID, 'midnight-chaos');
  assert.equal(seedState().gameId, GAME_ID);
});

test('catálogo Carnival importa el PDF completo y conserva categorías históricas compatibles', () => {
  assert.equal(INITIAL_CARDS.length, CARNIVAL_CARDS.length);
  assert.equal(new Set(INITIAL_CARDS.map((c) => c.id)).size, CARNIVAL_CARDS.length);
  assert.deepEqual(Object.fromEntries(['VERDAD','DESAFIO','MINIJUEGO','MALDICION','PREMIO','CASTIGO'].map((category) => [category, INITIAL_CARDS.filter((c) => c.categoryId === category).length])), { VERDAD: 115, DESAFIO: 127, MINIJUEGO: 24, MALDICION: 78, PREMIO: 35, CASTIGO: 35 });
  assert.equal(validateCards(INITIAL_CARDS, INITIAL_MANUALS), true);
  assert.ok(INITIAL_CARDS.every((card) => /^CC_/.test(card.id)));
  assert.equal(INITIAL_CARDS.filter((card) => card.collection === 'horrors' && card.enabled).length, 0);
});

test('los catálogos de eventos, poderes y cadenas tienen IDs únicos y reglas explícitas', () => {
  for (const catalog of [ROUND_EVENTS, POWER_CATALOG, CHAIN_CHALLENGES]) assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length);
  assert.equal(ROUND_EVENTS.length, 22);
  assert.ok(ROUND_EVENTS.every((event) => event.durationTurns === 5 && event.activation && event.completion && event.effect));
  assert.ok(POWER_CATALOG.every((power) => power.timing && power.duration && power.effect && power.cancel));
  assert.ok(CHAIN_CHALLENGES.every((chain) => chain.maxLinks >= 2 && chain.maxLinks <= 6 && chain.consent));
});

test('Circo el Destino fuerza Maldición y roba opciones sin repetir durante el evento', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  state.game.completedTurns = 109;
  const engine = gameEngine(state, () => .5);
  const trigger = engine.draw('VERDAD').card;
  engine.resolve('COMPLETED', trigger.id);
  engine.finishTurn();
  assert.equal(state.game.activeRoundEvent.effect, 'destiny');
  assert.ok(state.cards.filter((card) => card.id.startsWith('CC_DESTINO_')).every((card) => card.enabled));
  const drawn = [];
  for (let index = 0; index < 5; index++) {
    assert.equal(engine.rollDigital().face.category, 'MALDICION');
    engine.completeRoll();
    const result = engine.draw('MALDICION');
    assert.ok(result.card?.id.startsWith('CC_DESTINO_'));
    drawn.push(result.card.id);
    engine.resolve('COMPLETED', result.card.id);
    engine.finishTurn();
  }
  assert.equal(new Set(drawn).size, 5);
  assert.ok(state.cards.filter((card) => card.id.startsWith('CC_DESTINO_')).every((card) => card.enabled));
});

test('eventos de ronda se activan cada cinco turnos y el estado continúa tras recargar', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }, { id: 'q', name: 'B', active: true }];
  const engine = gameEngine(state, () => .1);
  const complete = () => { const card = engine.draw('VERDAD').card; assert.ok(card); assert.equal(engine.resolve('COMPLETED', card.id), true); assert.equal(engine.finishTurn(), true); };
  for (let index = 0; index < 5; index++) complete();
  assert.equal(state.game.completedTurns, 5);
  assert.equal(state.game.activeRoundEvent.eventRound, 1);
  assert.equal(state.game.activeRoundEvent.turnsRemaining, 5);
  const persisted = JSON.parse(JSON.stringify(state));
  const reloadedEngine = gameEngine(persisted);
  for (let index = 0; index < 5; index++) {
    const card = reloadedEngine.draw('VERDAD').card;
    reloadedEngine.resolve('COMPLETED', card.id);
    reloadedEngine.finishTurn();
  }
  assert.equal(persisted.game.completedTurns, 10);
  assert.equal(persisted.game.activeRoundEvent.eventRound, 2);
  assert.equal(persisted.game.activeRoundEvent.effect, 'horrors');
  assert.equal(persisted.game.roundEventHistory.filter((event) => event.status === 'active').length, 1);
  assert.equal(persisted.game.roundEventHistory.filter((event) => event.status === 'completed').length, 1);
  assert.ok(persisted.cards.filter((card) => card.collection === 'horrors').every((card) => card.enabled));
  assert.ok(persisted.cards.filter((card) => card.collection === 'normal').every((card) => !card.enabled));
  for (let index = 0; index < 5; index++) {
    const card = reloadedEngine.draw('VERDAD').card;
    assert.ok(card?.collection === 'horrors');
    reloadedEngine.resolve('COMPLETED', card.id);
    reloadedEngine.finishTurn();
  }
  assert.equal(persisted.game.completedTurns, 15);
  assert.notEqual(persisted.game.activeRoundEvent.effect, 'horrors');
  assert.ok(persisted.cards.filter((card) => card.collection === 'horrors').every((card) => !card.enabled));
  assert.ok(persisted.cards.filter((card) => card.collection === 'normal').every((card) => card.enabled));
});

test('inventario de poder persiste, activa una alternativa y consume una sola vez', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const engine = gameEngine(state, () => .1);
  const granted = engine.grantPower('p', 'pass');
  assert.ok(granted.id);
  const turn = engine.draw('DESAFIO');
  assert.equal(engine.activatePower(granted.id).resolved, true);
  assert.equal(state.game.current, null);
  assert.equal(state.game.completedTurns, 1);
  assert.equal(state.game.powers.length, 0);
  assert.equal(state.game.usedPowers.length, 1);
});

test('premio de minijuego concede el poder asociado a quien recibe la carta', () => {
  const { state, engine, record } = makeMinigame(1, [{ when: 'WIN', category: 'PREMIO', recipients: 'WINNERS', cardsPerRecipient: 1 }]);
  for (const card of state.cards.filter((item) => item.categoryId === 'PREMIO')) {
    card.effects = { onCompleted: [{ type: 'GRANT_POWER', key: 'shield', label: 'Escudo violeta' }] };
  }
  assert.equal(record(['WIN']).pendingSelections, 1);
  assert.equal(engine.armMinigameSelection('p1').category, 'PREMIO');
  assert.ok(engine.draw('PREMIO').card);
  assert.equal(engine.finishTurn(), true);
  assert.equal(state.game.powers.length, 1);
  assert.equal(state.game.powers[0].playerId, 'p1');
  assert.equal(state.game.powers[0].key, 'shield');
});

test('reto encadenado asigna pasos, respeta límite y guarda historial', () => {
  const state = seedState();
  state.participants = ['a','b','c'].map((id) => ({ id, name: id, active: true }));
  const engine = gameEngine(state, () => 0);
  assert.equal(engine.startChain().chain.activePlayerId, 'a');
  assert.equal(engine.continueChain().activePlayerId, 'b');
  assert.equal(engine.continueChain().activePlayerId, 'c');
  assert.equal(engine.continueChain().finished, true);
  assert.equal(state.game.chain, null);
  assert.equal(state.game.chainHistory[0].visited.length, 3);
});

test('migración 6 conserva cartas personalizadas y archiva desactivadas las cartas fuente antiguas', () => {
  const originalStorage = globalThis.localStorage;
  let saved = '';
  const state = seedState();
  const legacy = structuredClone(PDF_CARDS[0]);
  const custom = { ...structuredClone(INITIAL_CARDS[0]), id: 'CUSTOM_001', title: 'Mi carta editada' };
  state.catalogVersion = 5;
  state.cards = [legacy, custom];
  globalThis.localStorage = { getItem: () => JSON.stringify(state), setItem: (_key, value) => { saved = value; } };
  try {
    const migrated = loadState();
    assert.equal(migrated.catalogVersion, 8);
    assert.equal(migrated.cards.find((card) => card.id === legacy.id).enabled, false);
    assert.equal(migrated.cards.find((card) => card.id === custom.id).title, 'Mi carta editada');
    assert.ok(migrated.cards.some((card) => card.id === 'CC_PECADO_001'));
    assert.ok(JSON.parse(saved).cards.some((card) => card.id === custom.id));
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('los datos locales se separan por juego y migran sin borrar la clave anterior', () => {
  const originalStorage = globalThis.localStorage;
  const legacyState = seedState();
  let writtenKey = null;
  globalThis.localStorage = {
    getItem: (key) => key === LEGACY_STORAGE_KEY ? JSON.stringify(legacyState) : null,
    setItem: (key) => { writtenKey = key; },
  };
  try {
    const loaded = loadState();
    assert.equal(loaded.gameId, GAME_ID);
    assert.equal(writtenKey, STORAGE_KEY);
    assert.notEqual(STORAGE_KEY, LEGACY_STORAGE_KEY);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('escudo violeta consume el poder para evitar una carta auxiliar de castigo', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const engine = gameEngine(state, () => .1);
  const shield = engine.grantPower('p', 'shield');
  engine.draw('DESAFIO');
  assert.equal(engine.activatePower(shield.id).power.id, 'shield');
  assert.equal(engine.draw('CASTIGO').shielded, true);
  assert.equal(state.game.powers.length, 0);
  assert.equal(state.game.usedPowers[0].key, 'shield');
});
test('mazos agotan antes de repetirse, conservan ciclos separados y evitan última repetición', () => {
  const cards = INITIAL_CARDS.filter((c) => c.categoryId === 'VERDAD').slice(0, 3), decks = {};
  const ids = Array.from({ length: 3 }, () => drawFromDeck(cards, 'VERDAD', decks, () => .3).card.id);
  assert.equal(new Set(ids).size, 3);
  assert.equal(decks.DESAFIO, undefined);
  const next = drawFromDeck(cards, 'VERDAD', decks, () => .01).card.id;
  assert.notEqual(next, ids.at(-1));
});
test('mazo agotado se informa y no selecciona carta', () => assert.equal(drawFromDeck([], 'VERDAD', {}).reason, 'EMPTY'));
test('avance circular y parejas sin asignar al azar', () => {
  assert.equal(nextIndex(2, 3), 0);
  const players = [{ id: 'a', active: true }, { id: 'b', active: true }];
  assert.deepEqual(assignTargets('PLAYER_PAIR', players, 0), []);
});
test('las seis caras respetan la distribución 1/19/40/40 de Carnival', () => {
  assert.equal(DICE_FACES.length, 6);
  assert.deepEqual(categoryProbabilities(), { MALDICION: 1, MINIJUEGO: 19, VERDAD: 40, DESAFIO: 40 });
  const counts = {};
  for (let i = 0; i < 200; i++) {
    const face = rollDice(() => (i + .25) / 200);
    counts[face.category] = (counts[face.category] ?? 0) + 1;
  }
  assert.deepEqual(counts, { MALDICION: 2, MINIJUEGO: 38, VERDAD: 80, DESAFIO: 80 });
});
test('cada lanzamiento suma giros completos y termina en la orientación de la cara elegida', () => {
  for (const target of [-90, 0, 90, 180]) {
    const angle = diceRotationTarget(1170, target);
    assert.ok(angle - 1170 >= 900);
    assert.equal(((angle % 360) + 360) % 360, ((target % 360) + 360) % 360);
  }
});
test('permite volver a tirar antes de revelar una carta y descarta el resultado anterior', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const values = [0, .99];
  const engine = gameEngine(state, () => values.shift());
  assert.equal(engine.rollDigital().face.category, 'MALDICION');
  const reroll = engine.rerollDigital();
  assert.equal(reroll.face.category, 'DESAFIO');
  assert.equal(state.game.current.primaryCard, null);
  assert.equal(engine.completeRoll().awaitingCategory, true);
});
test('sustituir una carta conserva la categoría y consume otra carta del mismo ciclo', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  state.cards = state.cards.filter((card) => card.categoryId === 'VERDAD').slice(0, 3);
  const engine = gameEngine(state, () => .2);
  const first = engine.draw('VERDAD').card;
  const replacement = engine.redraw(first.id);
  assert.ok(replacement.card);
  assert.equal(replacement.card.categoryId, 'VERDAD');
  assert.notEqual(replacement.card.id, first.id);
  assert.equal(state.game.current.primaryCard.cardId, replacement.card.id);
});
test('verdad registra resultado y el turno avanza una sola vez al finalizar explícitamente', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }, { id: 'q', name: 'B', active: true }];
  const engine = gameEngine(state, () => .01);
  const draw = engine.draw('VERDAD');
  assert.ok(draw.card);
  assert.equal(state.game.current.playerId, 'p');
  assert.equal(engine.draw('DESAFIO').error, 'LOCKED');
  assert.equal(engine.resolve('COMPLETED', draw.card.id), true);
  assert.equal(state.game.currentIndex, 0);
  assert.equal(engine.finishTurn(), true);
  assert.equal(engine.finishTurn(), false);
  assert.equal(state.game.currentIndex, 1);
  assert.equal(state.game.history.length, 1);
});
test('se roba castigo durante el desafío sin cerrar ni reemplazar la carta principal', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }, { id: 'q', name: 'B', active: true }];
  const engine = gameEngine(state, () => .2);
  const challenge = engine.draw('DESAFIO');
  const mainId = state.game.current.primaryCard.cardId;
  const punishment = engine.draw('CASTIGO');
  assert.ok(challenge.card && punishment.card);
  assert.equal(punishment.auxiliary, true);
  assert.equal(state.game.current.primaryCard.cardId, mainId);
  assert.equal(state.game.current.auxiliaryCards.length, 1);
  assert.equal(engine.finishTurn(), false);
  assert.equal(engine.resolve('COMPLETED', punishment.card.id), true);
  assert.equal(engine.finishTurn(), true);
  assert.equal(state.game.currentIndex, 1);
});
test('solo permite un mazo auxiliar por turno y el premio no reemplaza la carta principal', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const engine = gameEngine(state, () => .5);
  const main = engine.draw('VERDAD');
  const mainId = state.game.current.primaryCard.cardId;
  const reward = engine.draw('PREMIO');
  const punishment = engine.draw('CASTIGO');
  assert.ok(main.card && reward.card);
  assert.equal(punishment.error, 'AUXILIARY_ALREADY_DRAWN');
  assert.equal(state.game.current.primaryCard.cardId, mainId);
  assert.equal(state.game.current.auxiliaryCards.length, 1);
  assert.equal(engine.resolve('COMPLETED', reward.card.id), true);
  assert.equal(engine.finishTurn(), true);
  assert.equal(state.game.rewards[0].cardId, reward.card.id);
});
test('efectos JSON explícitos ofrecen mazo auxiliar y registran una ventaja sin comparar texto de carta', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const engine = gameEngine(state, () => .4);
  const main = engine.draw('VERDAD');
  main.card.effects = { onCompleted: [
    { type: 'DRAW_AUXILIARY', category: 'PREMIO' },
    { type: 'GRANT_REWARD', key: 'protection', label: 'Protección futura' },
  ] };
  assert.equal(engine.resolve('COMPLETED', main.card.id), true);
  assert.equal(state.game.current.pendingEffects.length, 2);
  const reward = engine.draw('PREMIO');
  assert.ok(reward.card);
  assert.equal(engine.finishTurn(), true);
  assert.ok(state.game.rewards.some((item) => item.effectKey === 'protection' && item.title === 'Protección futura'));
});
test('el mazo físico bloqueado no roba cartas ni añade penalizaciones', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }, { id: 'q', name: 'B', active: true }];
  const before = structuredClone(state.game.decks);
  state.settings.gameMode = 'physical';
  const engine = gameEngine(state);
  const roll = engine.draw('BLOQUEADA');
  assert.equal(roll.category, 'BLOQUEADA');
  assert.equal(roll.blocked, true);
  assert.equal(state.game.current.primaryCard, null);
  assert.equal(engine.draw('PREMIO').error, 'LOCKED');
  assert.deepEqual(state.game.decks, before);
  assert.equal(engine.finishTurn(), true);
  assert.equal(state.game.history[0].result, 'NO_ACTION');
  assert.equal(state.game.currentIndex, 1);
});
test('el dado determina el minijuego y espera que se pulse su mazo antes de revelar carta', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const engine = gameEngine(state, () => .15);
  const roll = engine.rollDigital();
  assert.equal(roll.face.category, 'MINIJUEGO');
  const result = engine.completeRoll();
  assert.equal(result.category, 'MINIJUEGO');
  assert.equal(result.awaitingCategory, true);
  assert.equal(state.game.current.phase, 'AWAITING_CATEGORY');
  assert.equal(state.game.current.primaryCard, null);
  assert.equal(engine.draw('VERDAD').error, 'LOCKED');
  const revealed = engine.draw('MINIJUEGO');
  assert.ok(revealed.card.manualId);
  assert.ok(state.manuals.find((m) => m.id === revealed.card.manualId));
});
test('estado guardado conserva cartas principales y auxiliares durante recarga', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const engine = gameEngine(state, () => .4);
  const main = engine.draw('DESAFIO');
  const aux = engine.draw('CASTIGO');
  const reloaded = JSON.parse(JSON.stringify(state));
  const engineAfterReload = gameEngine(reloaded);
  assert.equal(reloaded.game.current.primaryCard.cardId, main.card.id);
  assert.equal(reloaded.game.current.auxiliaryCards[0].cardId, aux.card.id);
  assert.equal(engineAfterReload.finishTurn(), false);
});
test('migra una carta activa de la versión anterior sin eliminarla', () => {
  const state = seedState();
  state.participants = [{ id: 'p', name: 'A', active: true }];
  const card = state.cards.find((item) => item.categoryId === 'VERDAD');
  state.game.current = { type: 'CARD', face: 'VERDAD', cardId: card.id, targetIds: ['p'], playerId: 'p' };
  state.game.state = 'RESOLVING';
  gameEngine(state);
  assert.equal(state.game.current.primaryCard.cardId, card.id);
  assert.deepEqual(state.game.current.auxiliaryCards, []);
});
test('validación de estado y efectos opcionales del catálogo', () => {
  const state = seedState();
  assert.equal(isValidState(state), true);
  assert.equal(isValidState({}), false);
  assert.throws(() => validateCards([INITIAL_CARDS[0], INITIAL_CARDS[0]], INITIAL_MANUALS));
  const withEffects = structuredClone(INITIAL_CARDS[0]);
  withEffects.effects = { trigger: 'COMPLETED', action: 'PREMIO' };
  assert.equal(validateCards([withEffects], INITIAL_MANUALS), true);
  withEffects.effects = [];
  assert.throws(() => validateCards([withEffects], INITIAL_MANUALS));
});
test('exportar e importar catálogo conserva opcionales, valida el lote y rechaza duplicados', () => {
  const source = structuredClone(INITIAL_CARDS.slice(0, 2));
  source[0].effects = { onCompleted: [{ type: 'DRAW_AUXILIARY', category: 'PREMIO' }] };
  const exported = exportCardCatalog(source);
  const imported = parseCardImport(JSON.parse(JSON.stringify(exported)), [], INITIAL_MANUALS);
  assert.deepEqual(imported, source);
  assert.throws(() => parseCardImport(exported, [source[0]], INITIAL_MANUALS), /ya existe/);
  assert.throws(() => parseCardImport([source[0], source[0]], [], INITIAL_MANUALS), /repetido/);
  assert.throws(() => parseCardImport([{ ...source[1], categoryId: 'INVENTADA' }], [], INITIAL_MANUALS), /Categoría inválida/);
  assert.throws(() => parseCardImport({ version: 2, cards: source }, [], INITIAL_MANUALS), /versión/);
});

function makeMinigame(count, consequenceRules, mode = 'ALL_PLAYERS', targetCount = 0) {
  const state = seedState();
  state.participants = Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Jugador ${index + 1}`, active: true }));
  const minigame = structuredClone(INITIAL_CARDS.find((card) => card.categoryId === 'MINIJUEGO'));
  minigame.target = { mode, count: targetCount || (mode === 'ALL_PLAYERS' ? 0 : 1), position: null };
  state.cards = [minigame, ...INITIAL_CARDS.filter((card) => ['PREMIO', 'CASTIGO'].includes(card.categoryId))];
  const manual = state.manuals.find((item) => item.id === minigame.manualId);
  manual.details = { ...(manual.details ?? {}), consequenceRules };
  const engine = gameEngine(state, () => .37);
  const draw = engine.draw('MINIJUEGO');
  assert.ok(draw.card);
  if (mode !== 'ALL_PLAYERS') assert.equal(engine.setMinigameParticipants(state.participants.slice(0, targetCount).map((player) => player.id)).error, undefined);
  return { state, engine, draw, record: (statuses) => engine.recordMinigameResult(state.participants.slice(0, statuses.length).map((player, index) => ({ playerId: player.id, result: statuses[index] }))) };
}

test('minijuego individual: una pérdida crea un castigo para esa persona', () => {
  const { state, engine, record } = makeMinigame(1, [{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1 }]);
  assert.equal(record(['LOSS']).pendingSelections, 1);
  assert.equal(state.game.current.pendingSelections[0].playerId, 'p1');
  assert.equal(engine.armMinigameSelection('p1').category, 'CASTIGO');
  assert.ok(engine.draw('CASTIGO').card);
  assert.equal(state.game.current.auxiliaryCards[0].playerId, 'p1');
  assert.equal(engine.finishTurn(), true);
});

test('minijuego individual: una victoria crea un premio para esa persona', () => {
  const { state, engine, record } = makeMinigame(1, [{ when: 'WIN', category: 'PREMIO', recipients: 'WINNERS', cardsPerRecipient: 1 }]);
  assert.equal(record(['WIN']).pendingSelections, 1);
  assert.equal(engine.armMinigameSelection('p1').category, 'PREMIO');
  assert.ok(engine.draw('PREMIO').card);
  assert.equal(engine.finishTurn(), true);
  assert.equal(state.game.rewards[0].playerId, 'p1');
});

test('dos personas pierden y cada una recibe su propia selección de castigo', () => {
  const { state, engine, record } = makeMinigame(2, [{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1 }]);
  assert.equal(record(['LOSS', 'LOSS']).pendingSelections, 2);
  for (const id of ['p1', 'p2']) {
    assert.equal(engine.armMinigameSelection(id).category, 'CASTIGO');
    assert.ok(engine.draw('CASTIGO').card);
  }
  assert.deepEqual(state.game.current.auxiliaryCards.map((item) => item.playerId), ['p1', 'p2']);
  assert.equal(engine.finishTurn(), true);
});

test('dos personas ganan y cada una recibe su propio premio', () => {
  const { state, engine, record } = makeMinigame(2, [{ when: 'WIN', category: 'PREMIO', recipients: 'WINNERS', cardsPerRecipient: 1 }]);
  assert.equal(record(['WIN', 'WIN']).pendingSelections, 2);
  for (const id of ['p1', 'p2']) {
    engine.armMinigameSelection(id);
    assert.ok(engine.draw('PREMIO').card);
  }
  assert.deepEqual(state.game.current.auxiliaryCards.map((item) => item.playerId), ['p1', 'p2']);
  assert.equal(engine.finishTurn(), true);
  assert.deepEqual(state.game.rewards.map((reward) => reward.playerId), ['p2', 'p1']);
});

test('tres participantes con una persona perdedora solo generan un castigo', () => {
  const { state, record } = makeMinigame(3, [{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1 }]);
  assert.equal(record(['WIN', 'LOSS', 'WIN']).pendingSelections, 1);
  assert.equal(state.game.current.pendingSelections[0].playerId, 'p2');
});

test('cuatro participantes con dos perdedores generan dos castigos individuales', () => {
  const { state, record } = makeMinigame(4, [{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1 }]);
  assert.equal(record(['WIN', 'LOSS', 'LOSS', 'WIN']).pendingSelections, 2);
  assert.deepEqual(state.game.current.pendingSelections.map((item) => item.playerId), ['p2', 'p3']);
});

test('regla especial de equipo permite una cantidad total y asignar el destinatario entre ganadores', () => {
  const { state, engine, record } = makeMinigame(4, [{ when: 'WIN', category: 'PREMIO', recipients: 'WINNERS', totalCards: 1 }]);
  assert.equal(record(['WIN', 'WIN', 'LOSS', 'LOSS']).pendingSelections, 1);
  assert.deepEqual(state.game.current.pendingSelections[0].eligiblePlayerIds, ['p1', 'p2']);
  assert.equal(engine.armMinigameSelection('p3').error, 'INVALID_RECIPIENT');
  assert.equal(engine.armMinigameSelection('p2').category, 'PREMIO');
  assert.ok(engine.draw('PREMIO').card);
  assert.equal(state.game.current.auxiliaryCards[0].playerId, 'p2');
});

test('minijuego sin reglas de premio o castigo termina sin selecciones', () => {
  const { state, engine, record } = makeMinigame(3, []);
  assert.equal(record(['NEUTRAL', 'NEUTRAL', 'NEUTRAL']).pendingSelections, 0);
  assert.equal(engine.finishTurn(), true);
  assert.equal(state.game.history[0].result, 'MINIGAME');
  assert.deepEqual(state.game.history[0].neutral, ['p1', 'p2', 'p3']);
});

test('no permite terminar antes de registrar resultado ni mientras falten selecciones', () => {
  const { engine, record } = makeMinigame(2, [{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1 }]);
  assert.equal(engine.finishTurn(), false);
  assert.equal(record(['LOSS', 'WIN']).pendingSelections, 1);
  assert.equal(engine.finishTurn(), false);
});

test('pulsaciones repetidas no duplican una selección del minijuego', () => {
  const { state, engine, record } = makeMinigame(2, [{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1 }]);
  record(['LOSS', 'LOSS']);
  assert.equal(engine.draw('CASTIGO').error, 'SELECTION_NOT_ARMED');
  assert.equal(engine.armMinigameSelection('p1').category, 'CASTIGO');
  assert.equal(engine.armMinigameSelection('p1').error, 'LOCKED');
  assert.ok(engine.draw('CASTIGO').card);
  assert.equal(engine.draw('CASTIGO').error, 'SELECTION_NOT_ARMED');
  assert.equal(state.game.current.auxiliaryCards.length, 1);
  assert.equal(state.game.current.pendingSelections.length, 1);
});

test('valida configuración de reglas sin aceptar cantidades ambiguas o destinatarios incompatibles', () => {
  assert.equal(validateMinigameRules([{ when: 'ANY', category: 'CASTIGO', recipients: 'LOSERS', totalCards: 2 }]), true);
  assert.throws(() => validateMinigameRules([{ when: 'LOSS', category: 'CASTIGO', recipients: 'LOSERS', cardsPerRecipient: 1, totalCards: 2 }]), /solo cardsPerRecipient o totalCards/);
  assert.throws(() => validateMinigameRules([{ when: 'LOSS', category: 'PREMIO', recipients: 'WINNERS', cardsPerRecipient: 1 }]), /no coincide/);
});
