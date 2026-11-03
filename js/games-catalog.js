const zevyraCover = "./assets/brand/zevyra-emblem.png";

export const GAMES_CATALOG = [
  {
    id: "get-drunk-party",
    name: "Get Drunk Party",
    description: "Verdades, desafíos, minijuegos y cartas para jugar en grupo.",
    status: "Disponible",
    available: true,
    cover: zevyraCover,
    route: "game",
    category: "Fiesta",
  },
  {
    id: "yo-nunca-nunca",
    name: "Yo nunca nunca",
    description: "Una experiencia para descubrir historias inesperadas.",
    status: "Próximamente",
    available: false,
    cover: zevyraCover,
    route: null,
    category: "Social",
  },
  {
    id: "parejas-hot",
    name: "Juego de parejas hot",
    description: "Una experiencia para parejas llegará pronto a la biblioteca.",
    status: "Próximamente",
    available: false,
    cover: zevyraCover,
    route: null,
    category: "Parejas",
  },
  {
    id: "mas-probable",
    name: "¿Quién es más probable que...?",
    description: "El grupo decide quién encaja mejor con cada pregunta.",
    status: "Próximamente",
    available: false,
    cover: zevyraCover,
    route: null,
    category: "Social",
  },
  {
    id: "el-impostor",
    name: "El impostor",
    description: "Una experiencia de deducción social llegará pronto.",
    status: "Próximamente",
    available: false,
    cover: zevyraCover,
    route: null,
    category: "Deducción",
  },
];

export function getAvailableGame(id) {
  return GAMES_CATALOG.find((game) => game.id === id && game.available) ?? null;
}
