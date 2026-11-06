// Carnival: 1% Maldición, 19% Caos y 40% para cada mazo principal.
export const DICE_FACES = Object.freeze([
  {
    id: 1,
    surface: "front",
    category: "MALDICION",
    label: "MALDICIÓN",
    weight: 1,
    x: 0,
    y: 0,
  },
  {
    id: 2,
    surface: "back",
    category: "MINIJUEGO",
    label: "CAOS",
    weight: 19,
    x: 0,
    y: 180,
  },
  {
    id: 3,
    surface: "right",
    category: "VERDAD",
    label: "PECADOS",
    weight: 20,
    x: 0,
    y: -90,
  },
  {
    id: 4,
    surface: "left",
    category: "VERDAD",
    label: "PECADOS",
    weight: 20,
    x: 0,
    y: 90,
  },
  {
    id: 5,
    surface: "top",
    category: "DESAFIO",
    label: "SACRIFICIO",
    weight: 20,
    x: -90,
    y: 0,
  },
  {
    id: 6,
    surface: "bottom",
    category: "DESAFIO",
    label: "SACRIFICIO",
    weight: 20,
    x: 90,
    y: 0,
  },
]);

export function rollDice(random = Math.random) {
  const value = Math.min(Math.max(random(), 0), 1 - Number.EPSILON) * 100;
  let boundary = 0;
  for (const face of DICE_FACES) {
    boundary += face.weight;
    if (value < boundary) return face;
  }
  return DICE_FACES.at(-1);
}

export function diceRotationTarget(currentAngle, desiredAngle, fullSpins = 6) {
  const current = Number(currentAngle) || 0;
  const currentOrientation = ((current % 360) + 360) % 360;
  const desiredOrientation = ((desiredAngle % 360) + 360) % 360;
  const adjustment =
    ((desiredOrientation - currentOrientation + 540) % 360) - 180;
  // The caller can vary spins per axis while preserving the selected orientation.
  return current + 360 * fullSpins + adjustment;
}

export function categoryProbabilities() {
  return DICE_FACES.reduce((totals, face) => {
    totals[face.category] = (totals[face.category] ?? 0) + face.weight;
    return totals;
  }, {});
}
