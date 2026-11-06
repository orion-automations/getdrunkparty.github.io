export const GAMES_CATALOG = [
  {
    id: "midnight-chaos",
    name: "Carnival of Chaos",
    description: "Verdades, sacrificios, caos, Jokers y el Gran Circo. Desliza la portada y entra a la partida.",
    status: "Disponible",
    available: true,
    cover: "./assets/games/carnival-of-chaos.png",
    route: "game",
    category: "Carnaval",
  },
  {
    id: "yo-nunca-nunca",
    name: "Yo nunca nunca",
    description: "Una experiencia para descubrir historias inesperadas.",
    status: "Bloqueado",
    available: false,
    cover: "./assets/games/yo-nunca-nunca.png",
    route: null,
    category: "Social",
  },
  {
    id: "parejas-hot",
    name: "Weekend Hearts",
    description: "Una experiencia para parejas. Su guía funcional todavía no está disponible.",
    status: "Bloqueado",
    available: false,
    cover: "./assets/games/weekend-hearts.png",
    route: null,
    category: "Parejas",
  },
  {
    id: "mas-probable",
    name: "¿Quién es más probable que...?",
    description: "Una experiencia social. Su guía funcional todavía no está disponible.",
    status: "Bloqueado",
    available: false,
    cover: "./assets/games/quien-es-mas-probable.png",
    route: null,
    category: "Social",
  },
  {
    id: "el-impostor",
    name: "The Impostor",
    description: "La guía está disponible; falta implementar y validar el flujo de juego.",
    status: "En desarrollo",
    available: false,
    cover: "./assets/games/el-impostor.png",
    route: null,
    category: "Deducción",
  },
];

export function getAvailableGame(id) {
  return GAMES_CATALOG.find((game) => game.id === id && game.available) ?? null;
}
