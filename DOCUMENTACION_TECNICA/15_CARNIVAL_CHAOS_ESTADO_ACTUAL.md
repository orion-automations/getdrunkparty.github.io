# Carnival of Chaos — estado actual e implementación

**Actualizado:** 2026-11-08 · **Versión:** 2.3.23 · **Estado:** acceso persistente local, cuenta IndexedDB para GitHub Pages y salas online vía Supabase.

Este es el documento vigente para la aplicación. Los documentos 01–14 conservan antecedentes e iteraciones anteriores; si una decisión difiere, prevalece esta versión y el código citado.

## Resumen actual

- Carnival of Chaos está disponible; los otros juegos siguen bloqueados hasta tener una implementación (`js/games-catalog.js:1-24`). Se conserva `GAME_ID = "midnight-chaos"` para los datos existentes (`js/config.js:1-3`).
- El inicio dibuja la portada activa al centro y deja las vecinas a los lados; el gesto táctil, Pointer Events y flechas del teclado cambian selección (`index.html:136-145`, `js/app.js:1306-1369, 2870-2898`, `css/platform.css:921-976, 1002-1019`).
- El dado conserva seis caras con pesos 1/19/40/40 (`js/dice.js:2-57`); el cubo DOM usa esas seis caras (`js/app.js:154-164`) y `animateDiceRoll()` realiza un único giro 3D con `requestAnimationFrame`, 4 s y seis/ocho vueltas por eje. Al terminar normaliza los ángulos a la orientación exacta de la cara seleccionada (`js/app.js:3059-3100`).
- `finishTurn()` cuenta una ronda cuando el siguiente índice activo vuelve al inicio del orden; `applyRoundProgress()` activa eventos en múltiplos de cinco rondas completas (`js/game.js:558-704, 724-758`).
- `drawCategory()` delega el robo a `engine.draw()`, que utiliza `drawFromDeck()`; `finishTurn()` lleva cartas normales al cementerio y agrupa cinco fragmentos antes de trasladarlos (`js/app.js:2979-3004`, `js/game.js:558-603`, `js/decks.js:2-36`).
- La interfaz local y online comparte `renderGame()`; los botones de resultado pasan por `confirmResult()`, que exige rol anfitrión en línea (`js/app.js:185-195, 1542-1612, 3119-3168`; SQL `supabase/sql/007_host_confirms_turns.sql`).
- El catálogo fuente contiene 414 cartas y 24 manuales. Los mazos se llaman Bufones y Arlequines; `CATALOG_VERSION` es 11. Las migraciones 9–11 limpian penalizaciones antiguas, normalizan Jokers y actualizan cartas/manuales ya guardados (`data/carnival-catalog.js`, `data/initial-cards.js:1-6`, `js/config.js:4-11`, `js/storage.js:9, 242-317`).
- Los seis mazos son botones hijos de `#all-decks-grid`; `makeCategoryButton()` crea icono/nombre y `renderGame()` aplica habilitación de mazos auxiliares (`index.html:345`, `js/app.js:1542-1612, 2964-3021`, `css/platform.css:474-476`). En móvil, la regla del último elemento solo se aplica a `.category-choices`, de modo que Arlequines ocupa la sexta celda normal del grid, sin expandirse (`css/dashboard-categories.css:229-230`).
- El dado conserva una única animación 3D por `requestAnimationFrame`: restaura el recorrido de respaldo de 4 s con 6/8 giros por eje (`copia_de_seguridad/js/app.js:849-872`), respeta movimiento reducido y normaliza al final a `face.x/face.y`. No se combina con una transición CSS adicional ni acumula grados de giro (`js/app.js:3059-3100`; `css/dice.css:26-36`).
- Las cuentas personales usan SQLite al correr Node local y IndexedDB al publicar como web estática. La cuenta de GitHub Pages solo existe en ese navegador; Supabase se usa para salas online y copias de nickname/avatar en el roster activo.
- `js/local-accounts.js:1-46` detecta la API local por su cabecera `X-Zevyra-Local-Accounts: sqlite-v1` (o una respuesta 401 reconocida del servidor anterior); las respuestas genéricas 404/405 JSON ya no seleccionan SQLite. El hash de la cuenta está en IndexedDB/SQLite; el estado de sesión va a `localStorage`.
- El header y el logo del pasaporte/marca de agua intercambian entre `assets/branding/zevyra-mode-dark.png` y `zevyra-mode-light.png` al resolver el tema (`index.html:77,153-156`, `js/app.js:1370-1378`). Las fuentes originales se conservan en `assets/LOgos sin fondo /`.

## Flujos funcionales trazables

### Inicio y biblioteca

`index.html → js/games-catalog.js → js/app.js → css/platform.css → assets/games/`

El marcado presenta `CIRCUS ZEVYRA` y debajo “JUEGOS DISPONIBLES” (`index.html:99-114`). `renderHomeGameStack()` crea las tarjetas desde `GAMES_CATALOG`, pone portada, título y estado; `selectHomeGame()` cambia el índice (`js/app.js:1123-1174`). Los eventos Pointer y teclado procesan el gesto horizontal (`js/app.js:2766-2783`). La carta activa queda centrada; ambas cartas vecinas comparten tamaño base, se escalan al 90%, se alinean al centro vertical y se oscurecen (`css/platform.css:921-976`). La imagen llena el marco sin deformarse mediante `object-fit: cover` (`css/platform.css:969-976`).

`renderGameLibrary()` y `renderHomeGameStack()` consumen el mismo catálogo. El acceso solo navega al juego si `available` es `true` (`js/app.js:1080-1121, 1123-1164`; `js/games-catalog.js:1-24`).

### Turno, dado, mazos y cartas

`index.html → js/app.js → js/game.js → js/dice.js / js/decks.js → js/storage.js`

`renderGame()` actualiza el jugador actual, el estado del dado y la visibilidad de los mazos (`js/app.js:1250-1309`). El cubo visual se construye con las seis caras de `DICE_FACES`; al tirar, `rollDice()` selecciona según pesos, y el motor conserva la cara/categoría resultante (`js/app.js:77-82, 1250-1289`; `js/dice.js:2-66`; `js/game.js:124-150`). `drawCategory()` solicita la carta al motor; la extracción consulta los IDs del cementerio y evita repetirlos (`js/app.js:2693-2718`; `js/game.js:20-40, 400-430`; `js/decks.js:2-36`). `makeTurnCard()` dibuja el reverso temático por categoría, el diamante de Fragmento y la cantidad de shots disponible (`js/app.js:1160-1164, 1860-1944`; `css/platform.css:485-489`).

Los seis mazos comparten una cuadrícula responsive: tres columnas en pantallas amplias y dos hasta 580 px. Arlequines mantiene la misma anchura de una celda que el resto (`index.html:221`; `css/platform.css:474-476`; `css/dashboard-categories.css:229-230`). Las categorías siguen guardando sus IDs históricos; `js/config.js:4-11` define etiquetas e iconos. La migración v9 quita las seis penalizaciones heredadas `MC_PENALTY_001`–`006`; la v10 cambia la nomenclatura Joker en el estado local persistido (`js/storage.js:237-276`).

### Rondas y eventos

`js/game.js → data/round-events.js → js/app.js`

`finishTurn()` incrementa los turnos individuales y reconoce la vuelta completa cuando el próximo participante activo es el primero de la lista activa (`js/game.js:664-675`). `applyRoundProgress()` activa un nuevo evento en cada múltiplo de cinco rondas completas; `turnsRemaining` baja al cerrar cada turno (`js/game.js:698-725`). El encabezado refleja `completedRounds` (`index.html:61-70`, `js/app.js:1209-1215`).

### Cementerio

`js/app.js → js/game.js → js/decks.js`

El botón fijo con icono de vórtice abre una lista de solo lectura (`index.html:486-497`). Al cerrar un turno, el motor registra carta principal, auxiliares y descartes con categoría y participante (`js/game.js:545-578`). Antes de retirar el turno, la interfaz anima las cartas hasta el botón (`js/app.js:1186-1207, 2870-2881`), y CSS mantiene el vórtice girando (`css/platform.css:498-505`). `drawFromDeck()` descarta los IDs enterrados; si el mazo solo contiene cartas usadas, informa que se reinicie la partida (`js/decks.js:2-36`, `js/app.js:2689-2705`). Reiniciar vacía cementerio y mazos de una vez, preservando participantes y catálogo (`js/app.js:2989-3023`).

### Perfil y avatar Big Smile

`index.html → js/app.js → js/multiplayer.js → js/local-accounts.js → (GitHub Pages: IndexedDB; Node local: server.mjs → database/local_users.py → database/001_users.sql → database/zevyra.sqlite)`

El acceso inicial bloquea la interfaz con `#auth-gate`. Sus pestañas llaman a `setAuthenticationMode()` y el formulario envía exclusivamente nickname y contraseña a `authenticateProfile()` (`index.html:82-97`; `js/app.js:748-786`; `css/platform.css:1023-1053`). `initializeAccountAccess()` valida la sesión guardada al arrancar; el token y perfil público se conservan en `localStorage` (`js/app.js:1061-1079`; `js/local-accounts.js:1-63`). El token local permanece válido hasta cerrar sesión; la inicialización extiende las sesiones existentes (`database/local_users.py:24-25, 35-50, 148-157, 200-212`). Al cerrar sesión, `#account-logout` revoca el token y vuelve a abrir el acceso (`index.html:189`; `js/app.js:787-803`).

Después del acceso, `#view-profile` contiene solo el Pasaporte Zevyra: banner, avatar editable, nickname, UID alineado a la izquierda y selector de nacionalidad (`index.html:116-189`). `updateProfileCard()` rellena la tarjeta desde el usuario autenticado; al cambiar nacionalidad, la interfaz guarda el código de país en la cuenta (`js/app.js:87-120, 805-815`). El editor Big Smile sigue permitiendo ajustar el avatar (`js/app.js:2640-2738`).

`js/local-accounts.js` selecciona el backend al consultar `api/users/me` relativo a la ruta de la app. En local, `server.mjs` identifica su API con una cabecera y enruta esos endpoints a `database/local_users.py`; el UID usa el prefijo `zevy` y seis caracteres. En Pages, `openBrowserDatabase()` crea un almacén IndexedDB con índices únicos; `registerInBrowser()` crea el UID y deriva hash PBKDF2. No hay API SQLite en Pages, y un nick allí solo es único dentro de ese almacenamiento local.

### Salas online

`js/app.js → js/multiplayer.js → js/multiplayer-auth.js (identidad anónima) → js/multiplayer-rooms.js → Supabase`

El modo multijugador usa una identidad anónima técnica de Supabase para permisos y sincronización. El cliente envía nickname/avatar solo a RPC de sala, que los conserva como snapshot en `room_players`; no envía la contraseña ni el UID de cuenta local (`js/multiplayer.js`; `supabase/sql/003_multiplayer_functions.sql`). La migración 008 bloquea el perfil persistente legado en instalaciones antiguas sin borrar sus filas (`supabase/sql/008_local_accounts_only.sql`).

### Tema, ajustes y PWA

El botón de apariencia recorre Sistema → Oscuro → Claro (`js/app.js:1134-1152, 2616-2620`). Las reglas del tema claro sustituyen fondos, texto, dado, reversos, cartas y controles por superficies claras; también elimina el círculo decorativo detrás del juego (`css/platform.css:512-555, 466`). El editor de manuales pasa de dos columnas en escritorio a una columna en móvil (`index.html:592-607`; `css/platform.css:506-510, 573-574`). El menú de carta conserva un panel opaco y táctil en móvil (`css/platform.css:482-484, 496-497`). El service worker deja fuera de caché las respuestas privadas de `/api/` (`sw.js:103-112`).

Los controles de Ajustes agrupan penalizaciones, reinicio, respaldo y aplicación (`index.html:461-485`). El botón de reinicio actúa inmediatamente, sin diálogo adicional (`js/app.js:3290-3327`). Instalar y buscar actualizaciones se conectan a `beforeinstallprompt` y al service worker (`js/app.js:3400-3475`; `sw.js:1-30`). La versión visible, metadata del paquete, configuración y caché PWA son 2.3.23 (`index.html:563`, `package.json:3`, `js/config.js:1`, `sw.js:1-3`).

## Datos y migraciones

El catálogo fuente se clona desde `data/carnival-catalog.js` a `data/initial-cards.js` y `data/initial-manuals.js`; `js/storage.js` inicializa estado nuevo y migra estado existente. La versión actual es `CATALOG_VERSION = 10` (`js/storage.js:1-17`). La migración 9 elimina las seis cartas de penalización antiguas y actualiza nombres Horror; la 10 modifica nombres de Joker en todo el estado persistido (`js/storage.js:237-276`). Las categorías del motor conservan los identificadores anteriores (`js/config.js:4-11`) para evitar romper guardados.

## Bases de datos y límites

El esquema SQLite local está en `database/001_users.sql`; `database/local_users.py` lo ejecuta al primer acceso del modo Node y reconstruye el archivo `database/zevyra.sqlite` si se elimina. Ese modo requiere `npm run serve` y Python 3. GitHub Pages usa IndexedDB y no ejecuta esa API. Supabase se conserva para el backend de salas; el orden de migraciones se describe en `supabase/README.md`. En proyectos existentes hay que ejecutar 008 para desactivar los perfiles persistentes antiguos. No se eliminaron filas históricas del proyecto remoto.

## Despliegue estático de cuentas y multijugador

GitHub Pages solo sirve los archivos estáticos: no puede arrancar `server.mjs`, Python ni SQLite. En ese hosting el registro/login opera sobre IndexedDB; el perfil y su sesión se conservan en el mismo navegador. Para permitir cuentas sincronizadas entre dispositivos se necesitaría un backend de cuentas; las tablas SQLite de `database/` no se suben a Supabase ni sustituyen ese backend. Las salas online son independientes: Supabase Auth anónimo, RPC, RLS, tablas y Realtime deben estar habilitados y las migraciones 001–008 aplicadas; 009 configura el borrado programado opcional descrito en `supabase/README.md`.

## Optimización de apertura aplicada

La auditoría fuente encontró cinco portadas PNG de 2.2–2.6 MB, alrededor de 3.3 MB en logos heredados, precache de recursos históricos y red comprobada antes de servir la caché. No se midieron LCP ni tiempos de apertura reales en el navegador, así que estas cantidades describen archivos y estrategia de código, no una mejora cronometrada.

- Las portadas de `assets/games/` permanecen intactas: no se editaron, recomprimieron, renombraron ni reemplazaron. `renderHomeGameStack()` prioriza la imagen central y solicita las laterales cuando el hilo queda ocioso; al deslizar, la nueva portada central recibe prioridad alta (`js/app.js:1295-1356`). `renderGameLibrary()` usa `loading="lazy"`, `decoding="async"` y prioridad baja, y la vista Juegos solo crea esas tarjetas cuando se abre (`js/app.js:1247-1294, 1496-1498`).
- `render()` construye el juego, participantes, cartas, manuales y bebidas solo cuando su vista está activa; así no monta las 414 filas del editor al entrar a Inicio (`js/app.js:1481-1538`). Las exportaciones `INITIAL_CARDS` e `INITIAL_MANUALS` comparten las matrices canónicas durante la carga de módulos; el estado persistido recibe copias con `structuredClone` al sembrarse o migrarse (`data/initial-cards.js:1-6`, `data/initial-manuals.js:1-4`, `js/storage.js:15-18`). El catálogo de 414 cartas continúa formando parte del grafo de módulos inicial; dividirlo en carga asíncrona no se hizo porque `loadState()` y las migraciones son síncronas.
- La instalación PWA precarga el shell, sus módulos y los iconos de instalación, pero ya no precarga portadas, logos heredados de gran tamaño ni `pdf-catalog.js`/`additional-challenges.js` que no se necesitan para iniciar la aplicación (`sw.js:1-49`). Los logos temáticos actuales se conservan en el shell. El tamaño de cada portada original no cambia.
- `sw.js` entrega primero recursos guardados mientras consulta la red en segundo plano; las imágenes tienen una caché runtime aparte y se conservan por versión. La caché privada `/api/` se excluye (`sw.js:1-129`). Las hojas de Material Symbols se cargan sin bloquear el análisis de HTML, con fallback `noscript` (`index.html:40-57`). `assets/icons/favicon.svg` y `icon.svg` apuntan al logo temático actual en lugar de descargar la imagen heredada de casi 1 MB.
- El precache actualizado se instala con solicitudes `cache: "reload"`; el shell versionado se reemplaza al activar la siguiente versión (`sw.js:51-88`). Los cambios de service worker se prueban en la primera carga con conexión; las imágenes todavía no visitadas necesitan conexión una vez.

La limitación pendiente es que el catálogo de 414 cartas todavía se importa síncronamente, y no hay medición visual o de laboratorio después del cambio. La optimización reduce descargas ajenas a la pantalla inicial y evita esperar a la red cuando ya hay caché; no se afirma cuánto baja el tiempo hasta el primer pintado sin medir en GitHub Pages.

El antiguo falso positivo de API estaba en el detector del cliente: cualquier JSON o respuesta 200 era aceptada como API, así que servidores estáticos con 405 JSON podían mandar al formulario hacia `/api/users/register` y devolver 405. Ahora el servidor Node marca sus respuestas con `X-Zevyra-Local-Accounts: sqlite-v1`; en ausencia de esa señal, el cliente usa IndexedDB, excepto por el 401 de compatibilidad de la versión anterior.

## Verificación de esta actualización

- La regla que expandía el último botón en móviles ahora queda limitada al grupo `.category-choices`; no alcanza a `#all-decks-grid`, así que Arlequines entra en la sexta celda sin abarcar ambas columnas. El giro se restauró al patrón de respaldo en RAF y se asienta en los ángulos canónicos de la cara para prevenir acumulación. Las imágenes de portada no se modificaron.
- `node --check` pasó para `js/app.js`, `js/dice.js`, `js/config.js` y `sw.js`; `package.json` se analizó correctamente. `npm test` reporta 34/39 aprobadas; las cinco fallas existentes son de catálogos/progresión de eventos, una expectativa de migración antigua y agotamiento de mazo (`tests/core.test.js:34-74,141-152,193-198`). Ninguna cubre el grid ni la animación.
- Se abrió `http://localhost:8000/#game`; la vista se detuvo en la selección de modalidad, por lo que no se verificó visualmente el dado ni el grid de mazos en esta sesión.
- No se publicó a GitHub Pages ni se aplicaron migraciones remotas. No se tocaron las portadas ni se hicieron mediciones del tiempo de apertura.
