const card = (id, categoryId, title, description, mode = "CURRENT_PLAYER", spiceLevel = 1, effects = undefined, manualId = null) => ({
  id: `MC_${id}`, categoryId, title, description,
  icon: { type: "glyph", value: categoryId === "VERDAD" ? "◉" : categoryId === "DESAFIO" ? "✦" : categoryId === "MINIJUEGO" ? "◇" : categoryId === "PREMIO" ? "★" : "⚡" },
  spiceLevel, target: { mode, count: mode === "PLAYER_PAIR" ? 2 : mode === "ALL_PLAYERS" ? 0 : 1, position: null },
  penalty: { enabled: false, units: 0, drinkTypeId: "ALTERNATIVE" }, manualId, enabled: true,
  ...(effects ? { effects } : {}),
});

export const MIDNIGHT_CARDS = [
  card("TRUTH_001", "VERDAD", "La versión que guardas", "¿Qué parte de tu personalidad casi nunca muestras en un grupo?"),
  card("TRUTH_002", "VERDAD", "Un sí inesperado", "¿A qué plan dijiste que sí por impulso y terminó siendo una gran historia?"),
  card("TRUTH_003", "VERDAD", "La primera impresión", "¿Qué impresión equivocada tuviste de alguien presente y qué la cambió?", "ALL_PLAYERS"),
  card("TRUTH_004", "VERDAD", "Talento secreto", "¿Qué habilidad rara te gustaría poder demostrar ahora?"),
  card("TRUTH_005", "VERDAD", "Mensaje pendiente", "¿Qué conversación llevas tiempo queriendo iniciar, sin decir nombres?"),
  card("TRUTH_006", "VERDAD", "Giro de guion", "¿Qué decisión pequeña cambió mucho tu camino?"),
  card("TRUTH_007", "VERDAD", "La canción exacta", "¿Qué canción describe tu semana y qué parte de la letra te representa?"),
  card("TRUTH_008", "VERDAD", "Modo incógnito", "¿Qué gusto tuyo suele sorprender a los demás?"),
  card("TRUTH_009", "VERDAD", "Una disculpa", "¿Qué gesto te cuesta reconocer cuando te equivocas?"),
  card("TRUTH_010", "VERDAD", "Próxima aventura", "¿Qué experiencia te gustaría probar este año si puedes cambiar de opinión en cualquier momento?"),

  card("DARE_001", "DESAFIO", "Tráiler dramático", "Presenta los próximos diez segundos de tu vida como el tráiler de una película. Puedes pasar sin penalización."),
  card("DARE_002", "DESAFIO", "Doblaje inesperado", "Elige una escena cotidiana y hazle un doblaje de narrador épico. Puedes elegir una alternativa."),
  card("DARE_003", "DESAFIO", "Estatua de portada", "Crea una pose de portada de álbum durante cinco segundos; sin contacto físico requerido."),
  card("DARE_004", "DESAFIO", "Brindis sin bebida", "Inventa un brindis de una frase dedicado a una cualidad del grupo; no hace falta tener bebida."),
  card("DARE_005", "DESAFIO", "Cambio de género", "Cuenta cómo termina una película conocida como si fuera una comedia romántica."),
  card("DARE_006", "DESAFIO", "Objeto protagonista", "Elige un objeto cercano e inventa en veinte segundos su historia de origen."),
  card("DARE_007", "DESAFIO", "Pasarela lunar", "Cruza el espacio disponible como si caminaras en gravedad cero; también puedes narrarlo sentado."),
  card("DARE_008", "DESAFIO", "Doble personaje", "Interpreta una conversación de diez segundos entre tu yo de hoy y tu yo del futuro."),
  card("DARE_009", "DESAFIO", "Aplauso de película", "Dirige un aplauso de final de película para el grupo, con banda sonora vocal opcional."),
  card("DARE_010", "DESAFIO", "Anuncio imposible", "Vende durante quince segundos un objeto cotidiano como si fuera tecnología del futuro."),

  card("GAME_001", "MINIJUEGO", "Palabra prohibida", "Durante una ronda, el grupo elige una palabra común. Quien la diga primero recibe el foco de la siguiente pregunta.", "ALL_PLAYERS", 1, undefined, "MC_MANUAL_WORD"),
  card("GAME_002", "MINIJUEGO", "Historia de tres pistas", "El grupo construye una historia: cada persona añade una frase y debe reutilizar un detalle anterior.", "ALL_PLAYERS", 1, undefined, "MC_MANUAL_STORY"),
  card("GAME_003", "MINIJUEGO", "Mímica en cadena", "Una persona representa una acción cotidiana y la siguiente continúa la escena sin explicar lo anterior.", "PLAYER_PAIR", 1, undefined, "MC_MANUAL_MIME"),
  card("GAME_004", "MINIJUEGO", "Categoría relámpago", "El grupo elige una categoría. En orden, cada quien dice un ejemplo distinto; se detiene cuando alguien prefiere pasar.", "ALL_PLAYERS", 1, undefined, "MC_MANUAL_CATEGORY"),
  card("GAME_005", "MINIJUEGO", "Banda sonora muda", "Una persona tararea una melodía sin palabras. El grupo intenta adivinarla en tres intentos.", "PLAYER_PAIR", 1, undefined, "MC_MANUAL_TUNE"),
  card("GAME_006", "MINIJUEGO", "Dos verdades inventadas", "Cada persona dice tres frases sobre un personaje ficticio; el grupo adivina cuál fue inventada.", "ALL_PLAYERS", 1, undefined, "MC_MANUAL_BLUFF"),
  card("GAME_007", "MINIJUEGO", "Rima de medianoche", "El grupo escoge una palabra inicial y crea una cadena de rimas; se puede pasar sin consecuencia.", "ALL_PLAYERS", 1, undefined, "MC_MANUAL_RHYME"),
  card("GAME_008", "MINIJUEGO", "Escena congelada", "Dos personas voluntarias crean una escena inmóvil. El grupo propone un título y un contexto.", "PLAYER_PAIR", 1, undefined, "MC_MANUAL_FREEZE"),

  card("PRIZE_001", "PREMIO", "Escudo violeta", "Guarda este escudo para cancelar una carta de castigo dirigida a ti. Se consume al usarlo.", "CURRENT_PLAYER", 1, { onCompleted: [{ type: "GRANT_POWER", key: "shield", label: "Escudo violeta" }] }),
  card("PRIZE_002", "PREMIO", "Reescritura", "Guarda el poder de cambiar una carta principal por otra de la misma categoría.", "CURRENT_PLAYER", 1, { onCompleted: [{ type: "GRANT_POWER", key: "redraw", label: "Reescritura" }] }),
  card("PRIZE_003", "PREMIO", "Pase libre", "Guarda una alternativa para cerrar una carta de desafío sin penalización.", "CURRENT_PLAYER", 1, { onCompleted: [{ type: "GRANT_POWER", key: "pass", label: "Pase libre" }] }),
  card("PRIZE_004", "PREMIO", "Pausa violeta", "Guarda una alternativa para cerrar una carta de desafío sin penalización.", "CURRENT_PLAYER", 1, { onCompleted: [{ type: "GRANT_POWER", key: "pass", label: "Pausa violeta" }] }),
  card("PRIZE_005", "PREMIO", "Pausa segura", "Obtén un poder de pausa: úsalo para terminar tu turno actual y dejar la carta sin consecuencia.", "CURRENT_PLAYER", 1, { onCompleted: [{ type: "GRANT_POWER", key: "pass", label: "Pausa segura" }] }),
  card("PRIZE_006", "PREMIO", "Doble posibilidad", "Guarda una reescritura para una carta de verdad o desafío.", "CURRENT_PLAYER", 1, { onCompleted: [{ type: "GRANT_POWER", key: "redraw", label: "Doble posibilidad" }] }),
];

export const MIDNIGHT_MANUALS = [
  { id: "MC_MANUAL_WORD", title: "Palabra prohibida", summary: "Una ronda breve de atención." , instructions: ["El grupo acuerda una palabra cotidiana.", "Durante la siguiente ronda, cualquiera puede señalar cuando la escucha.", "La persona señalada elige una pregunta o pasa; no hay penalización."], notes: "Eviten palabras que una persona no quiera tratar." },
  { id: "MC_MANUAL_STORY", title: "Historia de tres pistas", summary: "Construcción colectiva de una historia." , instructions: ["La primera persona inicia con una frase.", "Cada participante agrega una frase y un detalle del relato previo.", "El grupo decide un final cuando todos participaron."], notes: "Se puede pasar y retomar el turno al final." },
  { id: "MC_MANUAL_MIME", title: "Mímica en cadena", summary: "Escena improvisada y voluntaria." , instructions: ["Dos personas voluntarias eligen acciones neutras.", "La primera inicia una escena con gestos.", "La segunda la continúa sin contacto físico."], notes: "Narrar en lugar de actuar también cuenta." },
  { id: "MC_MANUAL_CATEGORY", title: "Categoría relámpago", summary: "Ronda rápida de asociación." , instructions: ["El grupo acuerda una categoría.", "Por turnos, cada quien ofrece un ejemplo nuevo.", "Cualquiera puede pasar; se cierra cuando el grupo lo decida."], notes: "No se puntúa ni se aplican consecuencias." },
  { id: "MC_MANUAL_TUNE", title: "Banda sonora muda", summary: "Adivina una melodía sin presión." , instructions: ["Elige una canción que puedas tararear.", "El grupo tiene tres intentos.", "Quien tararea puede pasar o elegir otra canción."], notes: "No se usan grabaciones ni se pide publicar contenido." },
  { id: "MC_MANUAL_BLUFF", title: "Dos verdades inventadas", summary: "Adivina un detalle ficticio." , instructions: ["Piensa en un personaje inventado.", "Di dos datos ciertos sobre ese personaje y uno falso.", "El grupo vota cuál cree que es falso."], notes: "No hace falta revelar datos personales." },
  { id: "MC_MANUAL_RHYME", title: "Rima de medianoche", summary: "Cadena de palabras rimadas." , instructions: ["El grupo propone una palabra inicial.", "Cada participante aporta una rima diferente.", "Se puede pasar y cerrar la cadena cuando el grupo quiera."], notes: "No hay eliminación ni castigo por pasar." },
  { id: "MC_MANUAL_FREEZE", title: "Escena congelada", summary: "Improvisación estática en pareja voluntaria." , instructions: ["Dos personas voluntarias acuerdan una escena sin contacto.", "Mantienen una pose cómoda durante unos segundos.", "El grupo inventa un título y contexto."], notes: "Cualquier persona puede narrar la escena en vez de posar." },
];
