# Arquitectura y funcionamiento

## Arquitectura observada

```mermaid
flowchart TD
  HTML[index.html: DOM y vistas] --> APP[js/app.js: eventos, render y estado]
  APP --> STORE[js/storage.js: carga, validación y guardado]
  STORE --> INIT[data/initial-cards.js + initial-manuals.js]
  INIT --> PDF[data/pdf-catalog.js]
  INIT --> ADD[data/additional-challenges.js]
  STORE --> MIG[data/catalog-migrations.js]
  APP --> GAME[js/game.js: máquina de turnos]
  GAME --> DICE[js/dice.js]
  GAME --> DECK[js/decks.js]
  GAME --> PLAYER[js/participants.js]
  GAME --> MINI[js/minigame-results.js]
  APP --> UTILS[js/utils.js]
  APP --> MAN[js/manuals.js]
  APP --> DRINK[js/drinks.js]
  APP --> CONFIG[js/config.js]
  APP --> MP[js/multiplayer.js]
  MP --> AUTH[js/multiplayer-auth.js]
  MP --> ROOMS[js/multiplayer-rooms.js]
  MP --> SYNC[js/multiplayer-sync.js]
  AUTH --> SDK[js/supabase.js]
  ROOMS --> SDK
  SYNC --> SDK
  SDK --> SB[(Supabase Auth, PostgreSQL, Realtime)]
  HTML --> CSS[css/*.css]
  HTML --> SW[sw.js]
  SW --> CACHE[Cache Storage: shell estático]
  STORE --> LS[(localStorage: zevyra.midnight-chaos.data.v1)]
  SERVER[server.mjs opcional] --> HTML
```

## Punto de entrada y carga

`index.html:1-36` establece idioma, viewport, manifest, iconos, CSS y SDK Supabase async; `index.html:530` inicia `js/app.js` como módulo. Este importa configuración, almacenamiento, motor, utilidades, bebidas, manuales, dado, validación de minijuegos y orquestador multiplayer (`js/app.js:1-25`). Al evaluar el módulo, `loadState()` carga/crea estado y `gameEngine(state)` lo adapta (`js/app.js:27-39`); los eventos de interfaz se enlazan y `render()` actualiza las vistas (`js/app.js:1400-1948,501-515`).

## Flujo de estado y persistencia

```text
index.html → js/app.js → js/storage.js → localStorage
                         ↘ data/initial-cards.js → data/midnight-catalog.js
                         ↘ data/catalog-migrations.js
```

`seedState()` clona el catálogo de Midnight Chaos e inicializa ajustes, participantes y partida (`js/storage.js:11-42`). `loadState()` lee la clave propia y, si no existe, importa `gdpw.data.v1` a la clave nueva; la migración 6 conserva personalizadas y desactiva cartas fuente anteriores (`js/storage.js:91-200`). `persist()` conserva la ruta local hacia `saveState()` (`js/app.js:114-124`); online envía cambios por `scheduleRoomAction()` solo al participante del turno (`js/app.js:92-120`). El temporizador usa una RPC separada. El mapa actualizado de turnos, eventos, poderes, cadenas y límites está en `13_FASE_2_TURNOS_Y_PERFIL.md`.

## Flujo de partida

```text
index.html → js/app.js (evento de usuario) → js/game.js
  → js/dice.js (roll digital) / js/decks.js (robo)
  → js/participants.js (destinatarios)
  → js/minigame-results.js (resultados y cola de consecuencias)
  → app.js persist/render → js/storage.js → localStorage
```

El dado digital elige una cara y crea turno en fase `ROLLING`; `startDigitalRoll()` anima el cubo 1.35 s y después llama `completeRoll()` (`game.js:126-160`; `app.js:1635-1685`). El usuario pulsa el mazo correspondiente; `draw()` obtiene carta mediante `attachCard()`/`drawFromDeck()`, calcula destinatario y guarda carta primaria o auxiliar (`game.js:17-50,311-392`; `decks.js:2-33`; `participants.js:4-30`). El resultado se registra con `resolve()` y `finishTurn()` escribe historial/recompensas y avanza (`game.js:427-516`). Cada acción de UI persiste y renderiza.

## Recorrido de edición

`index.html` contiene formulario/lista de cartas → eventos de `app.js` → `populateForm()` (`app.js:1170`), `saveCard()` (`1227-1288`), `renderCards()` (`1289-`) → objeto `state.cards` → `persist()` → `storage.js`. La importación JSON usa `file.text()`, `JSON.parse`, `parseCardImport()`; no ejecuta el archivo como código (`app.js:1787-1813`; `storage.js:289-303`).

## PWA y servidor

`manifest.json` aporta nombre, inicio, orientación e iconos. `js/app.js:3500-3513` registra `sw.js` fuera de `file:` si existe soporte. `sw.js:1-88` precachea el shell e intercambia cachés versionadas al activar; para GET del mismo origen entrega primero la copia guardada y la revalida en segundo plano. Las imágenes usan caché runtime y `/api/` queda fuera de la estrategia. Si falta una página y no hay red, recurre a `index.html` (`sw.js:90-129`). `server.mjs` implementa el servidor HTTP Node.

## Estado, eventos y errores

Estado mutable de la vista reside en `js/app.js` y se comparte con `gameEngine`. En modo local, `persist()` guarda con `saveState()`; en online, `canPlayOnlineGame()` compara el ID autenticado con el participante actual y `persist()` envía cambios solo desde ese cliente. `enterOnlineMode()` conserva temporalmente el estado local y `leaveOnlineMode()` lo restaura. Los demás dispositivos reciben el snapshot, ven el estado y tienen los controles de turno deshabilitados. En servidor la RPC `gdp_act_turn` repite la validación de participante y versión (`supabase/sql/006_turn_actions_and_profile.sql`).

## Flujo completo de multijugador

```text
index.html (SDK async + panel Participantes)
  → js/app.js (submit Crear/Unirme y estado online aislado)
  → js/multiplayer.js (espera SDK, organiza servicios y sesión)
  → js/multiplayer-auth.js (signInAnonymously + perfil)
  → js/multiplayer-rooms.js (RPCs y lecturas protegidas)
  → Supabase PostgreSQL (rooms, room_players, game_states)
  → js/multiplayer-sync.js (Postgres Changes + Presence privada)
  → js/app.js (aplica snapshot / temporizador / render)
```

Trazabilidad: el SDK CDN se declara asíncrono en `index.html:14-19`; el panel y sus controles están en `index.html:224-246`. `connectOnlineRoom()` y los handlers de crear/unirse/iniciar/transferir/cerrar/salir están en `js/app.js:243-340`. `connectRoom()` espera el SDK, inicia identidad anónima, guarda perfil, crea/ingresa a sala, suscribe el canal, lee el snapshot y guarda el código de reconexión (`js/multiplayer.js:4-136`).

`ensureAnonymousIdentity()` y `saveProfile()` hacen la autenticación y perfil (`js/multiplayer-auth.js`). `createRoom`, `joinRoom`, `beginRoomGame`, `actRoomTurn`, `saveSharedTimer`, `refreshRoomProfile`, `leaveRoom`, `claimHost` y `closeRoom` llaman RPCs; `readRoom()` consulta sala, roster y estado (`js/multiplayer-rooms.js`). `subscribeRoom()` registra los cambios de `game_states`, `room_players`, `rooms` y Presence (`js/multiplayer-sync.js`). El cliente recibe cada snapshot por `applyOnlineSnapshot()` (`js/app.js`); el participante actual guarda por `scheduleRoomAction()` y RPC `gdp_act_turn`, mientras el host guarda solo el temporizador por `scheduleRoomTimer()` y `gdp_save_shared_timer` (migración 006).

Los scripts `supabase/sql/001`–`004` crean tablas/RLS, políticas, funciones RPC y publicación Realtime, en ese orden. La app no contiene credenciales `service_role`; el archivo `js/supabase.js` usa URL y clave pública `anon`.

## Actualización fase 1

`gameEngine` incorpora repetición del dado antes de revelar carta y sustitución de una carta por otra de la misma categoría. `app.js` contiene temporizador basado en `Date.now()` y sincroniza su hora de finalización en modo online.

En el ajuste de interfaz del 2026-11-02, el cubo pasó a ser el control para tirar/repetir. También permite reemplazar una carta principal del mismo mazo. La carta principal y las auxiliares extraídas se muestran juntas dentro de `#turn-cards`, con deslizamiento horizontal y centrado por `scroll-snap`; se quitó la sección duplicada de cartas extraídas. El motor rechaza reemplazar Premio/Castigo y permite repetir la cara BLOQUEADA mientras el turno no se haya cerrado.
