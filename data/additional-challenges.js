// Cartas de desafío añadidas después del catálogo inicial del PDF.
// Al ampliar esta lista para una futura actualización, incrementa la versión del catálogo.
export const ADDITIONAL_CHALLENGE_CATALOG_VERSION = 5;

const challengeTexts = [
  'Pasa un hielo por el abdomen de la persona de tu izquierda usando solo la boca.',
  'Pasa un hielo por el abdomen de la persona de tu derecha usando solo la boca.',
  'Pasa un hielo por el abdomen de la persona de enfrente usando solo la boca.',
  'Pasa un hielo por el abdomen de la persona que tú elijas usando solo la boca.',
  'Pasa un hielo por el abdomen de la persona que elija el grupo usando solo la boca.',
  'Deja que la persona de tu izquierda te meta un hielo por la espalda (por dentro de la camisa).',
  'Deja que la persona de tu derecha te meta un hielo por la espalda (por dentro de la camisa).',
  'Deja que la persona de enfrente te meta un hielo por la espalda (por dentro de la camisa).',
  'Deja que la persona que elija el grupo te meta un hielo por dentro del pantalón (por la cintura).',
  'Ponte un hielo en la boca y recorre el cuello de la persona que escojas durante 15 segundos.',
  'Ponte un hielo en la boca y recorre el cuello de la persona de tu izquierda durante 15 segundos.',
  'Ponte un hielo en la boca y recorre el cuello de la persona de tu derecha durante 15 segundos.',
  'Ponte un hielo en la boca y recorre el cuello de la persona de enfrente durante 15 segundos.',
  'Ponte un hielo en la boca y recorre el cuello de la persona que elija el grupo durante 15 segundos.',
  'Deja que te pongan un hielo en la boca y recorre la clavícula y el cuello de dos personas diferentes, elegidas por el grupo, durante 10 segundos cada una.',
  'La persona que elija el grupo te coloca un hielo en el pecho o abdomen. Debes derretirlo completamente usando solo la boca y la lengua.',
  'Con los ojos vendados, pasa un hielo por el abdomen de la persona que elija el grupo usando solo la boca.',
  'Con los ojos vendados, deja que la persona que elija el grupo te meta un hielo por la espalda (por dentro de la camisa).',
  'Con los ojos vendados, deja que la persona que elija el grupo se ponga un hielo en la boca y recorra tu cuello durante 20 segundos.',
  'Con los ojos vendados, deja que la persona que elija el grupo te coloque un hielo en el pecho o abdomen. Esa persona debe derretirlo usando solo la boca.',
  'Ponte un hielo en la boca y recorre el cuello y la oreja de la persona que escojas durante 15 segundos.',
  'Deja que te pongan dos hielos, uno en cada lado de la espalda por dentro de la camisa, y aguanta 20 segundos sin sacártelos.',
  'Pasa un hielo por el abdomen y sube hasta el pecho de la persona que elija el grupo usando solo la boca.',
  'Deja que la persona que tú elijas pase un hielo por la parte interna de tus muslos usando solo las manos durante 15 segundos.',
  'Deja que la persona de enfrente te pase un hielo por toda la espalda usando solo las manos. Puede hacerlo por encima de la ropa.',
  'Deja que la persona que elija el grupo te pase un hielo por el pecho o abdomen usando solo las manos durante 20 segundos.',
  'Ponte un hielo en la boca y recorre la nuca y la zona detrás de la oreja de la persona de tu izquierda durante 15 segundos.',
  'Con los ojos vendados, deja que te metan un hielo por dentro del pantalón (por la cintura) y aguanta 15 segundos.',
  'Pasa un hielo por el abdomen de la persona que escojas usando la boca y luego sube hasta el cuello.',
  'Deja que dos personas elegidas por el grupo te coloquen un hielo cada una, una por la espalda y otra por el abdomen, al mismo tiempo.',
  'Con los ojos vendados, pasa un hielo por los brazos y hombros de la persona que elija el grupo usando solo las manos.',
  'Ponte un hielo entre la ropa y el cuerpo, en la espalda o el pecho, y baila pegado/a a la persona que escojas durante 30 segundos.',
  'Ponte un hielo en la boca y recorre la clavícula y el pecho de la persona de enfrente durante 15 segundos.',
  'Ponte un hielo en la boca y recorre la nuca y los hombros de la persona que elija el grupo durante 15 segundos.',
  'La persona que elija el grupo te coloca un hielo en el pecho o abdomen y tú eliges a alguien para que lo derrita con la boca.',
  'Deja que te pongan un hielo en el abdomen y la persona de tu derecha debe derretirlo con la boca.',
  'Con los ojos vendados, deja que la persona que elija el grupo te coloque un hielo en el pecho o abdomen y que otra persona, también elegida por el grupo, lo derrita con la boca.',
  'Imita tu posición sexual favorita con la persona que tú elijas, incluyendo movimientos.',
  'Imita tu posición sexual favorita con la persona de tu izquierda, incluyendo movimientos.',
  'Imita tu posición sexual favorita con la persona de tu derecha, incluyendo movimientos.',
  'Imita tu posición sexual favorita con la persona de enfrente, incluyendo movimientos.',
  'Imita tu posición sexual favorita en trío con las dos personas que tú elijas, incluyendo movimientos.',
  'Imita tu posición sexual favorita en trío con la persona de tu izquierda y la de tu derecha, incluyendo movimientos.',
  'Imita tu posición sexual favorita en trío con las dos personas que elija el grupo, incluyendo movimientos.',
  'Imita tu posición sexual favorita con la persona que tú elijas, pero con los ojos vendados, incluyendo movimientos.',
  'Imita tu posición sexual favorita con la persona de tu izquierda, pero con los ojos vendados, incluyendo movimientos.',
  'Imita tu posición sexual favorita con la persona que elija el grupo, pero con los ojos vendados, incluyendo movimientos.',
  'Imita tu posición sexual favorita en trío con dos personas elegidas por el grupo, pero tú con los ojos vendados, incluyendo movimientos.',
  'Imita la posición del misionero con la persona que tú elijas, incluyendo movimientos.',
  'Imita la posición de perrito con la persona de tu derecha, incluyendo movimientos.',
  'Imita la posición del 69 con la persona de tu izquierda, incluyendo movimientos.',
  'Imita la posición vaquera (tú arriba) con la persona que elija el grupo, incluyendo movimientos.',
  'Imita la posición de cucharita con la persona de enfrente, incluyendo movimientos.',
  'Imita la posición de perrito en trío con las dos personas que elija el grupo, incluyendo movimientos.',
  'Imita la posición del 69 con la persona que tú elijas, pero con los ojos vendados, incluyendo movimientos.',
  'Imita la posición vaquera con la persona de tu izquierda, pero con los ojos vendados, incluyendo movimientos.',
  'Imita la posición del misionero en trío, tú en el medio o como elijas, con dos personas del grupo, incluyendo movimientos.',
  'Imita la posición de pie, contra la pared o libre, con la persona que tú elijas, incluyendo movimientos.',
  'Imita la posición de pie contra la pared con la persona de tu derecha, incluyendo movimientos.',
  'Imita la posición de pie con la persona que elija el grupo, pero con los ojos vendados, incluyendo movimientos.',
  'Imita la posición del misionero contra la pared con la persona de tu izquierda, incluyendo movimientos.',
  'Imita la posición de perrito al borde de una silla o sofá con la persona que escojas, incluyendo movimientos.',
  'Imita la posición vaquera inversa (tú abajo) con la persona de enfrente, incluyendo movimientos.',
  'Imita la posición de cucharita sentados, uno detrás del otro, con la persona que elija el grupo, incluyendo movimientos.',
  'Imita la posición de pie en trío con las dos personas que elija el grupo, incluyendo movimientos.',
  'Imita la posición del 69 de lado con la persona que tú elijas, incluyendo movimientos.',
  'Imita cualquier posición de pie o contra la pared con la persona de tu derecha, pero ambos con los ojos vendados, incluyendo movimientos.',
];

const shotCounts = [
  // 103–112
  2, 2, 2, 2, 2, 1, 1, 1, 2, 2,
  // 113–122
  2, 2, 2, 2, 3, 2, 3, 2, 3, 3,
  // 123–132
  2, 2, 3, 2, 1, 2, 2, 3, 3, 3,
  // 133–142
  2, 2, 2, 2, 2, 2, 3, 2, 2, 2,
  // 143–152
  2, 3, 3, 3, 2, 2, 3, 3, 2, 2,
  // 153–162
  2, 2, 2, 3, 3, 3, 3, 2, 2, 3,
  // 163–169
  2, 2, 2, 2, 3, 2, 3,
];

export const ADDITIONAL_CHALLENGES = challengeTexts.map((description, index) => {
  const number = index + 103;
  return {
    id: `DESAFIO_PDF_${String(number).padStart(3, '0')}`,
    categoryId: 'DESAFIO',
    title: `Desafío ${String(number).padStart(3, '0')}`,
    description,
    icon: { type: 'glyph', value: '✦' },
    spiceLevel: 1,
    target: { mode: 'CURRENT_PLAYER', count: 1, position: null },
    penalty: { enabled: true, units: shotCounts[index], drinkTypeId: 'NORMAL' },
    manualId: null,
    enabled: true,
  };
});

// Para cartas futuras de otras categorías, agrega objetos completos en esta lista.
export const OTHER_ADDITIONAL_CARDS = [];

export const ADDITIONAL_CARDS = [...ADDITIONAL_CHALLENGES, ...OTHER_ADDITIONAL_CARDS];
