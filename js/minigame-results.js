const STATUSES = new Set(['WIN', 'LOSS', 'NEUTRAL']);
const RECIPIENTS = new Set(['WINNERS', 'LOSERS', 'PARTICIPANTS', 'GROUP']);
const CATEGORIES = new Set(['PREMIO', 'CASTIGO']);

export function validateMinigameRules(rules) {
  if (!Array.isArray(rules)) throw new Error('consequenceRules debe ser una lista.');
  if (rules.length > 20) throw new Error('Un manual puede tener hasta 20 reglas de consecuencias.');
  rules.forEach((rule, index) => {
    const prefix = `Regla ${index + 1}: `;
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`${prefix}debe ser un objeto.`);
    if (!STATUSES.has(rule.when) && rule.when !== 'ANY') throw new Error(`${prefix}when debe ser WIN, LOSS o ANY.`);
    if (!CATEGORIES.has(rule.category)) throw new Error(`${prefix}category debe ser PREMIO o CASTIGO.`);
    if (!RECIPIENTS.has(rule.recipients)) throw new Error(`${prefix}recipients debe ser WINNERS, LOSERS, PARTICIPANTS o GROUP.`);
    if ((rule.recipients === 'WINNERS' && rule.when === 'LOSS') || (rule.recipients === 'LOSERS' && rule.when === 'WIN')) throw new Error(`${prefix}when no coincide con recipients.`);
    const perRecipient = rule.cardsPerRecipient;
    const total = rule.totalCards;
    if ((perRecipient === undefined) === (total === undefined)) throw new Error(`${prefix}define solo cardsPerRecipient o totalCards.`);
    if (perRecipient !== undefined && (!Number.isInteger(perRecipient) || perRecipient < 1 || perRecipient > 10)) throw new Error(`${prefix}cardsPerRecipient debe estar entre 1 y 10.`);
    if (total !== undefined && (!Number.isInteger(total) || total < 1 || total > 30)) throw new Error(`${prefix}totalCards debe estar entre 1 y 30.`);
  });
  return true;
}

export function buildMinigameSelectionQueue(rules, participants, outcomes) {
  validateMinigameRules(rules);
  const byId = new Map(participants.map((player) => [player.id, player]));
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.playerId, outcome.result]));
  const queue = [];
  for (const rule of rules) {
    const eligible = participants.filter((player) => {
      const result = outcomeById.get(player.id);
      if (rule.recipients === 'GROUP' || rule.recipients === 'PARTICIPANTS') return rule.when === 'ANY' || rule.when === result;
      if (rule.recipients === 'WINNERS') return result === 'WIN' && (rule.when === 'ANY' || rule.when === 'WIN');
      if (rule.recipients === 'LOSERS') return result === 'LOSS' && (rule.when === 'ANY' || rule.when === 'LOSS');
      return false;
    });
    if (rule.totalCards !== undefined) {
      for (let index = 0; index < rule.totalCards && eligible.length; index++) {
        queue.push({ category: rule.category, playerId: null, eligiblePlayerIds: eligible.map((player) => player.id), ruleIndex: rules.indexOf(rule) });
      }
    } else {
      for (const player of eligible) {
        for (let index = 0; index < rule.cardsPerRecipient; index++) {
          queue.push({ category: rule.category, playerId: player.id, eligiblePlayerIds: [player.id], ruleIndex: rules.indexOf(rule) });
        }
      }
    }
  }
  if (queue.length > 100) throw new Error('La regla genera más de 100 selecciones para este resultado.');
  return queue;
}

export function validateMinigameOutcomes(participants, outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length !== participants.length) throw new Error('Registra el resultado de cada participante del minijuego.');
  const expected = new Set(participants.map((player) => player.id));
  const seen = new Set();
  for (const outcome of outcomes) {
    if (!outcome || !expected.has(outcome.playerId) || seen.has(outcome.playerId)) throw new Error('El resultado contiene participantes inválidos o repetidos.');
    if (!STATUSES.has(outcome.result)) throw new Error('Cada participante debe quedar como ganador, perdedor o neutral.');
    seen.add(outcome.playerId);
  }
  return true;
}
