const entries = [
  ['SEMANA_INGLESA','Semana inglesa','Las reglas completas están pendientes de configurar por el creador. No se han inventado reglas.'],
  ['MIMICA','Mímica relámpago','Una persona representa una palabra solo con gestos; el grupo intenta adivinarla. Acuerden turnos y duración antes de empezar.'],
  ['PALABRAS','Palabras encadenadas','Por turnos, cada persona dice una palabra relacionada con la anterior. No repitan las palabras ya dichas. El grupo decide cuándo termina la ronda.'],
  ['DOS_VERDADES','Dos verdades ficticias','Cada participante inventa dos afirmaciones. El grupo conversa y elige cuál le parece más creíble. Mantengan todo en tono ficticio y voluntario.'],
  ['DUELO_CANCIONES','Duelo de canciones','El grupo propone un tema. Dos voluntarios cantan por turnos un fragmento relacionado; pueden sustituir el canto por tararear o pasar.'],
  ['HISTORIA','Historia colectiva','En orden, cada participante añade una frase a una historia común. Pueden parar cuando quieran y cerrar la historia entre todos.'],
  ['PERSONAJE','Adivina el personaje','Una persona piensa en un personaje. Las demás hacen preguntas que se respondan con sí o no; acuerden un límite de preguntas si lo desean.'],
  ['CATEGORIAS','Categorías','El grupo elige una categoría. En ronda, cada persona nombra un elemento distinto; se termina cuando el grupo lo decida.'],
  ['IMPROVISACION','Escena improvisada','Dos personas voluntarias interpretan una escena basada en una sugerencia ficticia del grupo. Ambas pueden rechazar o cambiar la sugerencia.'],
  ['DOBLAJE','Doblaje improvisado','Dos voluntarios inventan diálogos para una escena imaginaria. Mantengan el contenido cómodo para todos; cualquiera puede parar.']
];
export const INITIAL_MANUALS = entries.map(([key,title,notes]) => ({ id:`MANUAL_${key}`, title, summary: title === 'Semana inglesa' ? 'Manual provisional pendiente de completar.' : `Instrucciones del minijuego ${title}.`, instructions: title === 'Semana inglesa' ? [] : [notes], notes, pending: title === 'Semana inglesa' }));
