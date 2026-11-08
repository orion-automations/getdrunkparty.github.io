# Guía para integrar nuevos juegos en Zevyra Games

Esta guía sirve para convertir una guía de diseño, un PDF y sus recursos visuales en una experiencia que pueda abrirse desde Inicio/Juegos, jugarse en el dispositivo y, cuando corresponda, sincronizarse por Supabase.

## 1. Lo primero: el catálogo no es el motor

`js/games-catalog.js` solo define las tarjetas de la biblioteca y del carrusel. `js/app.js` abre la ruta `game` para cualquier juego disponible, pero el motor, el catálogo de cartas, el estado local y la identidad online todavía están ligados a Carnival of Chaos mediante `GAME_ID`, `GAME_NAME`, `gameEngine()` y `snapshotForRoom()`.

Por eso, **no cambies `available: false` a `true` para publicar un juego nuevo**. Solo aparecería como disponible y después abriría el flujo de Carnival. Primero integra el motor y la interfaz del juego siguiendo esta guía; al final habilita el elemento del catálogo.

### Flujo existente

```text
index.html (#view-home / #view-games / #view-game)
  → js/app.js (renderGameLibrary / renderHomeGameStack / handlers)
  → js/games-catalog.js (nombre, portada, disponibilidad y ruta)
  → js/app.js (flujo común de modalidad)
  → js/game.js (motor actual de Carnival)
  → js/storage.js (estado y mazos actuales)
```

En modo online, el flujo actual continúa así:

```text
js/app.js (snapshotForRoom / applyOnlineSnapshot)
  → js/multiplayer.js
  → js/multiplayer-rooms.js (RPC)
  → Supabase public.rooms / room_players / game_states
  → supabase/sql/007_host_confirms_turns.sql (gdp_act_turn)
```

La biblioteca y las cartas de portada funcionan para varios elementos. La partida todavía no tiene un registro de motores intercambiables.

## 2. Archivos y responsabilidad

| Responsabilidad | Archivo existente | Archivo recomendado para un juego nuevo |
|---|---|---|
| Portadas y metadatos de biblioteca | `js/games-catalog.js` | Añadir una entrada con el ID y portada del nuevo juego. |
| Portada | `assets/games/` | `assets/games/<slug>.webp` o `.png`. |
| Catálogo de cartas actual | `data/carnival-catalog.js` | `data/<slug>/cards.js`; no anexar cartas de otro juego al catálogo de Carnival. |
| Manuales | `data/carnival-catalog.js`, `data/initial-manuals.js` | `data/<slug>/manuals.js`. |
| Estado inicial, validación y migración local | `js/storage.js` | Ampliar para crear/validar estado por juego sin migrar el catálogo equivocado. |
| Reglas/turnos actuales | `js/game.js` | `js/games/<slug>/engine.js`. |
| Interfaz y navegación | `index.html`, `js/app.js` | `js/games/<slug>/view.js` y estilos `css/games/<slug>.css`. |
| Configuración actual | `js/config.js` | Reemplazar los valores globales por una definición activa seleccionada desde la biblioteca. |
| Sincronización online | `js/multiplayer.js`, `js/multiplayer-rooms.js`, `js/multiplayer-sync.js` | Adaptar el snapshot y, si cambian permisos o reglas, añadir una migración SQL nueva. |
| Archivos disponibles sin conexión | `sw.js` | Agregar los módulos/datos/recursos estáticos nuevos a `SHELL` y cambiar `CACHE_NAME` junto con `VERSION`. |

## 3. Paso a paso

### Paso 1: convertir la guía en reglas verificables

Antes de programar, crea una ficha para el juego con:

1. Modos: local, multijugador o ambos.
2. Cómo comienza y termina una partida.
3. Qué evento avanza un turno y qué completa una ronda.
4. Acciones de cada rol: jugador activo, anfitrión y observadores.
5. Estados posibles de la partida y de cada turno.
6. Qué ocurre con abandonar, desconectarse, reiniciar o cerrar una sala.
7. Qué datos deben persistir localmente y cuáles sincronizarse.
8. Reglas de privacidad, consentimiento y límites para retos.
9. Qué recursos requieren conexión y cuáles estarán disponibles sin conexión.

Usa esos puntos como criterios de aceptación. No confundas “el botón abre” con “el juego está integrado”: deben funcionar las transiciones, los reinicios, la persistencia y las reglas online.

### Paso 2: preparar recursos y contenido

1. Optimiza la portada y guárdala en `assets/games/<slug>.webp`. Mantén una relación de aspecto uniforme y comprueba el recorte en móvil y escritorio.
2. Guarda recursos propios del juego dentro de `assets/games/<slug>/` o una carpeta equivalente; evita nombres genéricos como `portada-final2.png`.
3. Crea el catálogo de cartas en `data/<slug>/cards.js`. Cada carta necesita un ID permanente y único dentro del juego. Si se apoya en el editor genérico, conserva el contrato de `data/carnival-catalog.js`: `id`, `categoryId`, `title`, `description`, `icon`, `target`, `penalty`, `manualId`, `enabled` y, si aplica, campos como `collection` o `fragment`.
4. Crea manuales en `data/<slug>/manuals.js`. Usa IDs estables; vincula con `manualId` solo cuando la carta necesite mostrar instrucciones con el control de ayuda.
5. Añade validaciones para categorías, IDs, referencias a manuales, límites de texto y reglas del juego. `validateCards()` en `js/storage.js` es el validador compartido actual; no hagas que los requisitos exclusivos del nuevo juego alteren la validación de Carnival.

No pegues contenido del juego nuevo en `data/initial-cards.js`: este archivo es una exportación del catálogo inicial de Carnival. Mantén separados los juegos para que importar, editar o migrar uno no cambie accidentalmente los demás.

### Paso 3: crear estado y motor independientes

Crea `js/games/<slug>/engine.js` con funciones puras. Una estructura recomendada:

```js
export function createInitialState({ participants, settings }) {
  return {
    gameId: "<slug>",
    phase: "waiting",
    turnIndex: 0,
    round: 1,
    current: null,
    history: [],
  };
}

export function reduceGame(state, action, context) {
  // Validar la acción y devolver un estado nuevo; no modificar el DOM aquí.
}

export function validateGameState(state) {
  return state?.gameId === "<slug>" && Array.isArray(state.history);
}
```

Reglas para el motor:

- No acceder directamente a `document`, `localStorage` ni Supabase.
- Recibir participante actual, configuración y aleatoriedad por parámetros.
- Definir estados y acciones permitidas explícitamente.
- Mantener separadas las rondas completas, los turnos individuales y las fases de una misma acción.
- Asegurar que la misma acción aceptada produzca un estado serializable para poder enviarlo a otros clientes.
- Añadir migración de estado versionada antes de cambiar el formato después de publicar.

`js/game.js` mezcla actualmente varias reglas de Carnival y consume `data/round-events.js`, `data/chain-challenges.js`, `data/power-catalog.js`, `js/dice.js` y `js/minigame-results.js`. Un juego distinto debe importar solo los módulos que use; no agregues reglas de ese juego a `gameEngine()` por comodidad.

### Paso 4: registrar una definición jugable

El siguiente cambio de arquitectura que habilita varios motores es crear `js/games/registry.js`. Cada definición debe conectar metadatos, estado, motor e interfaz:

```js
export const GAME_DEFINITIONS = {
  "<slug>": {
    id: "<slug>",
    createInitialState,
    reduceGame,
    validateGameState,
    renderGame,
    serializeRoomState,
    applyRoomState,
  },
};
```

Después, en `js/app.js`:

1. Guarda `activeGameId` al seleccionar la tarjeta; ahora solo cambia de vista y no entrega el ID al motor.
2. Busca la definición con `activeGameId` antes de iniciar el juego.
3. Renderiza controles de modalidad y tablero usando esa definición.
4. Impide que una sala cargue un snapshot cuyo `gameId` no coincida con el juego seleccionado.
5. Limpia temporizadores, canales y listeners al salir del juego.
6. Conserva Inicio, Ajustes, Perfil y Participantes compartidos; mantén cada tablero y su estado aislados.

Mientras no exista ese registro y la selección llegue al motor, deja los nuevos títulos bloqueados. El elemento de `js/games-catalog.js` controla la tarjeta, pero no carga un motor.

### Paso 5: definir persistencia aislada

El estado actual se inicializa en `js/storage.js` mediante `seedState()`, `STORAGE_KEY` y `loadState()`. Hoy `STORAGE_KEY` deriva del `GAME_ID` fijo importado de `js/config.js` y los datos de cartas/manuales iniciales son los de Carnival.

Para soportar varios juegos:

1. Usa claves separadas, por ejemplo `zevyra.<gameId>.state.v1`.
2. Crea el estado semilla usando la definición activa y solo su catálogo.
3. Incluye el `gameId` y una versión de formato dentro del estado.
4. Valida el estado al cargar y al importar respaldos.
5. Migra únicamente datos pertenecientes a ese ID.
6. No borres ni reemplaces las partidas locales de otros juegos.

Los participantes y preferencias pueden compartirse entre juegos si es intencional; documenta claramente qué datos son globales y cuáles son específicos de cada juego.

### Paso 6: integrar la tarjeta y las rutas

Añade en `js/games-catalog.js` un objeto de esta forma:

```js
{
  id: "<slug>",
  name: "Nombre público",
  description: "Resumen breve para la tarjeta.",
  status: "En desarrollo",
  available: false,
  cover: "./assets/games/<slug>.webp",
  route: "game",
  category: "Social"
}
```

`renderGameLibrary()` dibuja la biblioteca y `renderHomeGameStack()` dibuja el carrusel en `js/app.js`; ambos leen `GAMES_CATALOG`. Si la experiencia ya está validada y su motor está conectado, cambia `status` a `Disponible` y `available` a `true`. Comprueba que su portada se haya añadido a `SHELL` en `sw.js`.

Solo añade una sección específica a `index.html` si el juego necesita una estructura realmente distinta. Si reutiliza la pantalla común, monta su componente en un contenedor de juego con nombre accesible y elimina sus listeners al abandonar la vista.

### Paso 7: sincronizar multijugador con permisos correctos

Las tablas `rooms`, `room_players` y `game_states` están definidas en `supabase/sql/001_multiplayer_schema.sql`; `game_states.state` es JSON, así que puede transportar distintos estados. La sincronización y las RPC están en `js/multiplayer.js`, `js/multiplayer-rooms.js`, `js/multiplayer-sync.js` y `supabase/sql/003_multiplayer_functions.sql`–`007_host_confirms_turns.sql`.

Antes de habilitar multijugador para un nuevo juego:

1. Incluye el ID real del juego en el estado inicial de la sala y en cada snapshot. Actualmente `snapshotForRoom()` y el estado inicial de sala usan el `GAME_ID` constante de Carnival.
2. Acepta snapshots solo cuando `gameId` coincide con la definición seleccionada; la comprobación actual también compara con el `GAME_ID` fijo.
3. Conserva control de versión para rechazar dos acciones simultáneas basadas en un estado anterior.
4. Define en servidor quién puede actuar: jugador del turno, anfitrión o ambos, según la regla documentada.
5. Si el juego tiene acciones distintas a turnos simples, crea una migración SQL nueva con una RPC propia; no debilites las políticas/RLS para resolverlo desde el cliente.
6. Valida el tamaño y la forma del snapshot en la RPC. No aceptes que un cliente cambie el roster, el rol, el ganador o las consecuencias fuera de las reglas.
7. Prueba al menos con dos navegadores: misma secuencia, reconexión, salida voluntaria, anfitrión desconectado y cambio de turno.

La RPC `gdp_act_turn` de la migración 007 comprueba pertenencia, turno, versión, IDs/orden del roster y transición del juego. No conoce todas las reglas futuras; cada juego nuevo puede necesitar su propia validación de servidor. Nunca incluyas una clave `service_role` en JavaScript.

### Paso 8: estilos, iconos y accesibilidad

- Crea `css/games/<slug>.css` y prefija clases con el ID para evitar colisiones (`.game-<slug>-...`).
- Diseña primero el ancho de 320–430 px; luego valida tablet y escritorio.
- Reutiliza variables de tema (`--surface`, `--text`, `--muted`, `--border`) para que modo claro y oscuro sigan funcionando.
- Usa texto alternativo para portadas informativas y `alt=""` para imágenes decorativas.
- Añade etiquetas para botones solo de icono, estado visible de carga/error y soporte de teclado.
- Respeta `prefers-reduced-motion` y no dependas exclusivamente del color para comunicar resultados.

### Paso 9: modo offline y publicación

`sw.js` precachea los módulos y recursos del shell. Añade todos los archivos estáticos nuevos que deban abrirse sin conexión a `SHELL`; si falta un módulo listado, la instalación del service worker puede fallar. Al publicar una versión, incrementa `VERSION` en `js/config.js` y `CACHE_NAME` en `sw.js` para reemplazar el caché anterior.

GitHub Pages sirve archivos estáticos. No ejecuta `server.mjs` ni SQLite. La app usa IndexedDB local para la cuenta del navegador y Supabase para salas; ese modo de cuenta no crea un nickname global ni sincroniza la contraseña entre dispositivos. Las salas multijugador requieren conexión y las migraciones de `supabase/sql/` aplicadas en el proyecto.

## 4. Lista de salida antes de marcar “Disponible”

- [ ] Portada y metadatos aparecen en Juegos e Inicio; el gesto táctil y teclado funcionan.
- [ ] `available` se habilita solo cuando el motor y la interfaz existen.
- [ ] Crear, guardar, cerrar y volver a abrir la partida mantiene el estado correcto.
- [ ] Un juego no lee cartas ni historial de otro.
- [ ] Los cambios de participantes y de tema no rompen el tablero.
- [ ] Las reglas de turno y ronda se cumplen con 1, 2 y varios jugadores.
- [ ] La pantalla de modalidad local/online refleja lo que el juego soporta.
- [ ] Dos clientes ven el mismo estado online; un cliente sin turno solo puede observar.
- [ ] RPC/RLS impiden acciones de usuarios no autorizados y conflictos de versión.
- [ ] Reconexión, host ausente, abandono y cierre de sala tienen estados definidos.
- [ ] Consola limpia; la primera instalación/actualización PWA descarga todos los recursos.
- [ ] Se ha probado publicación real desde GitHub Pages por HTTPS.

## 5. Referencias del código actual

- Catálogo de tarjetas: `js/games-catalog.js`, `getAvailableGame()`.
- Render de biblioteca y carrusel: `js/app.js`, `renderGameLibrary()`, `renderHomeGameStack()`, `selectHomeGame()`.
- Configuración fija del juego: `js/config.js`, `GAME_ID`, `GAME_NAME`.
- Motor actual: `js/game.js`, `gameEngine(state)`.
- Estado semilla y migraciones: `js/storage.js`, `seedState()`, `loadState()`, `isValidState()`.
- Snapshot online y chequeo del ID: `js/app.js`, `snapshotForRoom()`, `applyOnlineSnapshot()`, flujo de `connectRoom()`.
- RPC de turno: `js/multiplayer-rooms.js`, `actRoomTurn()`; SQL `supabase/sql/007_host_confirms_turns.sql`, `gdp_act_turn()`.
- Shell offline: `sw.js`, `SHELL` y `CACHE_NAME`.
