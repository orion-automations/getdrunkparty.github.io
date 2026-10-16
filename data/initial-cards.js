const defs = {
  VERDAD: [
    ['primera-impresion','Primera impresión','¿Qué impresión tuviste de la persona a tu derecha cuando la conociste?',1,'CURRENT_PLAYER',1],
    ['confesion-divertida','Confesión divertida','Cuenta una situación vergonzosa que ahora te parezca graciosa.',1,'CURRENT_PLAYER',1],
    ['secreto-inocente','Secreto inocente','Comparte un dato curioso sobre ti que pocas personas conozcan.',1,'CURRENT_PLAYER',1],
    ['cita-ideal','Cita ideal','Describe tu cita ideal en tres frases.',2,'CURRENT_PLAYER',1],
    ['atraccion','Atracción','¿Qué cualidad te parece más atractiva en otra persona?',2,'CURRENT_PLAYER',1],
    ['momento-incomodo','Momento incómodo','Cuenta una ocasión en la que intentaste impresionar a alguien y salió mal.',2,'CURRENT_PLAYER',1],
    ['pregunta-del-grupo','Pregunta del grupo','El grupo puede hacerte una pregunta que tú eliges responder voluntariamente.',2,'CURRENT_PLAYER',1],
    ['primera-cita','Primera cita','¿Qué detalle puede hacerte perder el interés en una cita?',3,'CURRENT_PLAYER',1],
    ['romance-ficticio','Romance ficticio','Elige dos personajes ficticios que formarían una pareja inesperada y explica por qué.',2,'CURRENT_PLAYER',1],
    ['pregunta-atrevida','Pregunta atrevida','Cuenta una anécdota romántica que te sientas cómodo compartiendo.',3,'CURRENT_PLAYER',1]
  ],
  DESAFIO: [
    ['imitacion','Imitación','Imita a un personaje conocido durante 15 segundos para que el grupo lo adivine.',1,'CURRENT_PLAYER',1],
    ['baile-improvisado','Baile improvisado','Baila durante 20 segundos sin música; el grupo elige el estilo.',1,'CURRENT_PLAYER',1],
    ['elogio-sincero','Elogio sincero','Dile algo positivo y sincero a la persona de tu derecha.',1,'RIGHT_PLAYER',1],
    ['voz-de-locutor','Voz de locutor','Presenta al siguiente participante como si fuera una estrella mundial.',1,'CURRENT_PLAYER',1],
    ['mirada-seria','Mirada seria','Intenta mantener la cara seria durante 20 segundos mientras otra persona intenta hacerte reír.',2,'PLAYER_PAIR',1],
    ['escena-romantica','Escena romántica','Representa una escena romántica ficticia con otra persona, únicamente si ambas aceptan.',3,'PLAYER_PAIR',1],
    ['declaracion-absurda','Declaración absurda','Declárale tu amor a un objeto durante 15 segundos.',1,'CURRENT_PLAYER',1],
    ['pasarela','Pasarela','Haz un desfile de moda improvisado.',2,'CURRENT_PLAYER',1],
    ['dueto','Dueto','Canta un fragmento de una canción con otra persona que acepte participar.',2,'PLAYER_PAIR',1],
    ['reto-de-grupo','Reto de grupo','Propón una pose grupal e invita a quienes quieran participar.',2,'ALL_PLAYERS',1]
  ],
  MINIJUEGO: [
    ['semana-inglesa','Semana inglesa','Jueguen Semana inglesa siguiendo el manual del grupo.',3,'ALL_PLAYERS',null,'MANUAL_SEMANA_INGLESA'],
    ['mimica-relampago','Mímica relámpago','Una persona representa una palabra mediante gestos y el grupo intenta adivinarla.',1,'ALL_PLAYERS',null,'MANUAL_MIMICA'],
    ['palabras-encadenadas','Palabras encadenadas','Cada persona dice una palabra relacionada con la anterior sin repetir las ya usadas.',1,'ALL_PLAYERS',null,'MANUAL_PALABRAS'],
    ['dos-verdades-ficticias','Dos verdades ficticias','Cada participante inventa dos afirmaciones y el grupo decide cuál resulta más creíble.',2,'ALL_PLAYERS',null,'MANUAL_DOS_VERDADES'],
    ['duelo-de-canciones','Duelo de canciones','Dos participantes voluntarios cantan fragmentos relacionados con un tema elegido.',2,'PLAYER_PAIR',null,'MANUAL_DUELO_CANCIONES'],
    ['historia-colectiva','Historia colectiva','Cada participante añade una frase para construir una historia entre todos.',1,'ALL_PLAYERS',null,'MANUAL_HISTORIA'],
    ['adivina-el-personaje','Adivina el personaje','Una persona piensa en un personaje y las demás hacen preguntas que puedan responderse con sí o no.',1,'ALL_PLAYERS',null,'MANUAL_PERSONAJE'],
    ['categorias','Categorías','Se elige una categoría y cada persona dice un elemento sin repetir los anteriores.',1,'ALL_PLAYERS',null,'MANUAL_CATEGORIAS'],
    ['escena-improvisada','Escena improvisada','Dos personas voluntarias representan una escena absurda sugerida por el grupo.',2,'PLAYER_PAIR',null,'MANUAL_IMPROVISACION'],
    ['doblaje-improvisado','Doblaje improvisado','Dos participantes inventan diálogos para una escena imaginaria.',2,'PLAYER_PAIR',null,'MANUAL_DOBLAJE']
  ],
  PREMIO: [
    ['salvoconducto','Salvoconducto','Obtén un pase para omitir voluntariamente una carta futura sin penalización.',1,'CURRENT_PLAYER',null],
    ['elegir-cancion','Elegir canción','Elige la siguiente canción de la fiesta. (Se marca como usada manualmente.)',1,'CURRENT_PLAYER',null],
    ['cambia-de-turno','Cambia de turno','Puedes intercambiar el siguiente turno con otra persona que acepte.',1,'PLAYER_PAIR',null],
    ['pregunta-libre','Pregunta libre','Elige a alguien que acepte responder una pregunta inventada por ti.',2,'PLAYER_PAIR',null],
    ['poder-de-veto','Poder de veto','Guarda un comodín para vetar voluntariamente una carta futura.',2,'CURRENT_PLAYER',null],
    ['elige-categoria','Elige categoría','En tu próximo turno puedes solicitar otra categoría disponible.',2,'CURRENT_PLAYER',null],
    ['turno-protegido','Turno protegido','Guarda una protección para omitir una carta futura sin penalización.',1,'CURRENT_PLAYER',null],
    ['reto-compartido','Reto compartido','Invita a alguien a realizar una actividad contigo; ambas personas deben aceptar.',2,'PLAYER_PAIR',null],
    ['director-de-escena','Director de escena','Elige una escena ficticia para que dos voluntarios la representen.',2,'PLAYER_PAIR',null],
    ['comodin','Comodín','Guarda la posibilidad de sustituir una carta futura por otra de la misma categoría.',2,'CURRENT_PLAYER',null]
  ],
  CASTIGO: [
    ['rima-improvisada','Rima improvisada','Inventa una rima corta usando el nombre de alguien.',1,'CURRENT_PLAYER',1],
    ['acento-inventado','Acento inventado','Habla con un acento ficticio durante tu siguiente intervención.',1,'CURRENT_PLAYER',1],
    ['estatua','Estatua','Mantén una pose graciosa mientras el grupo cuenta hasta diez.',1,'CURRENT_PLAYER',1],
    ['elogios','Elogios','Di algo positivo sobre tres personas del grupo.',1,'CURRENT_PLAYER',1],
    ['anuncio-comercial','Anuncio comercial','Vende un objeto de la habitación como si fuera un producto revolucionario.',2,'CURRENT_PLAYER',1],
    ['presentador','Presentador','Presenta al siguiente participante como si estuvieras en un programa de televisión.',1,'CURRENT_PLAYER',1],
    ['cancion-inventada','Canción inventada','Crea una canción de dos versos sobre la fiesta.',2,'CURRENT_PLAYER',1],
    ['historia-dramatica','Historia dramática','Cuenta una situación cotidiana como si fuera una tragedia épica.',2,'CURRENT_PLAYER',1],
    ['cambio-de-personaje','Cambio de personaje','Interpreta un personaje ficticio durante tu siguiente intervención.',2,'CURRENT_PLAYER',1],
    ['aplauso-final','Aplauso final','Dirige un aplauso exagerado para el grupo.',1,'ALL_PLAYERS',1]
  ]
};
export const INITIAL_CARDS = Object.entries(defs).flatMap(([categoryId, rows]) => rows.map(([slug,title,description,spiceLevel,targetMode,units,manualId]) => ({
  id: `${categoryId}_${slug.replaceAll('-','_').toUpperCase()}`, categoryId, title, description,
  icon: { type: 'glyph', value: categoryId === 'VERDAD' ? '◉' : categoryId === 'DESAFIO' ? '✦' : categoryId === 'MINIJUEGO' ? '🎲' : categoryId === 'PREMIO' ? '★' : '⚡' },
  spiceLevel, target: { mode: targetMode, count: targetMode === 'PLAYER_PAIR' ? 2 : targetMode === 'ALL_PLAYERS' ? 0 : 1, position: null },
  penalty: { enabled: units !== null, units: units ?? 0, drinkTypeId: 'NORMAL' }, manualId: manualId ?? null, enabled: true
})));
