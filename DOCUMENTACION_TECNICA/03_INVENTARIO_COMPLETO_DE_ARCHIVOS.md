# Inventario de archivos propios

> Este inventario conserva el detalle de una auditoría anterior a la Fase 2. Para las responsabilidades actuales de catálogo, estado, turnos, poderes, rondas, cadenas y RPC, consulte [13 — Fase 2](13_FASE_2_TURNOS_Y_PERFIL.md), que actualiza y prevalece sobre las filas históricas de versiones previas.

Las líneas apuntan a los archivos del proyecto (números verificados con `nl -ba`/lectura directa durante la auditoría). “Consumido por” identifica referencias estáticas o uso observable; en archivos estáticos se refiere al documento/configuración que los enlaza. Los PDFs e imágenes son recursos binarios, por lo que no se atribuyen funciones ni líneas.

## Raíz

| Archivo | Función, relaciones y estado |
|---|---|
| `index.html` | Documento de entrada, DOM de Partida/Participantes/Cartas/Manuales/Ajustes y diálogos. Declara SDK Supabase async y el panel de salas; inicia `js/app.js` como módulo. |
| `package.json` | Metadatos versión 1.5.0, módulo ES, scripts `test` y `serve`; sin dependencia npm. Consumido por npm. |
| `README.md` (todo) | Guía de uso/edición y afirmaciones de catálogo/versiones; documento informativo, no importado en runtime. |
| `manifest.json` (1-27) | Identidad PWA, scope, orientación e iconos; enlazado por `index.html:14`, consumido por navegador/service worker. |
| `server.mjs` (1-40) | Servidor HTTP local, lee archivos de raíz y asigna MIME; ejecutado por `npm run serve`. No persiste estado. |
| `sw.js` | Ciclo install/activate/fetch, caché shell v1.5.0, incluye módulos online; registrado por `app.js`. SDK CDN no se precachea. |
| `Cartas Get Drunk Party.pdf` | Fuente documental de cartas según README; no se carga en runtime. Binario, contenido no auditado en detalle. |
| `Get Drunk Party Web.pdf` | Documento PDF presente; no referenciado por código. Propósito exacto no confirmado por el runtime. Binario no auditado en detalle. |

## JavaScript (`js/`)

| Archivo y líneas | Declaraciones / responsabilidad | Uso / estado |
|---|---|---|
| `js/app.js` | Controlador de interfaz y estado; render, guardas de host, aislamiento/restauración local, snapshot, temporizador sincronizado, eventos de sala. Importa `multiplayer.js`. | Importado por HTML; cliente de lógica de juego y orquestador de UI online. |
| `js/supabase.js` | Crea cliente SDK v2 desde URL del proyecto + clave pública `anon`; expone `window.gdpSupabase`. | Importado dinámicamente por los servicios Auth/RPC/Realtime tras cargar el SDK. |
| `js/multiplayer.js` | `waitForSdk`, `services`, `connectRoom`, `startRoom`, `scheduleRoomState`, `refreshRoom`, `disconnectRoom`, `takeRoomHost`, `closeCurrentRoom`. | Importado por `app.js`; coordina módulos online y callbacks de snapshot/estado. |
| `js/multiplayer-auth.js` | `ensureAnonymousIdentity`, `saveProfile`, `getProfile`. | Importa cliente de `supabase.js`; usa Supabase Auth anónimo y tabla profiles. |
| `js/multiplayer-rooms.js` | `createRoom`, `joinRoom`, `readRoom`, `beginRoomGame`, `saveRoomGame`, `leaveRoom`, `touchRoom`, `claimHost`, `closeRoom`. | Importa cliente Supabase; consume RPCs y tablas en Supabase. |
| `js/multiplayer-sync.js` | `subscribeRoom`, `unsubscribeRoom`; Postgres Changes y Presence. | Importa cliente Supabase; `multiplayer.js` consume el canal. |
| `js/config.js:1-20` | `VERSION`, mapas `CATEGORIES`, `TARGETS`. | Importado por app; activo. |
| `js/storage.js:1-295` | `seedState`, `isValidState`, `loadState`, `saveState`, `validateCards`, validación de effects, export/import y clave local. Importa catálogos/migraciones. | App importa funciones (`app.js:2-9`); activo. |
| `js/game.js:1-521` | `gameEngine`, `attachCard`, acciones de turno (roll, draw, selección/resultado minijuego, resolve/finish/cancel), normalización de efectos. Importa decks, participants, dice, minigame-results. | App y tests (`tests/core.test.js:8`); activo y central. |
| `js/decks.js:1-37` | `drawFromDeck`, `resetDeck`; filtra enabled, mantiene orden/ciclo por categoría y evita repetición consecutiva si hay más de una carta. | Game; activo. |
| `js/participants.js:1-30` | `nextIndex`, `assignTargets`; asignación circular/reversa, grupo, aleatorio, pareja voluntaria sin aleatorizar. | Game; activo. |
| `js/dice.js:1-85` | `DICE_FACES`, `rollDice`, orientación final, probabilidades agregadas. | Game y app; activo. Pesos por cara (17.5,17.5,17.5,17.5,15,15) se agrupan en 35/35/15/15. |
| `js/minigame-results.js:1-117` | Valida reglas/outcomes y genera cola con destinatarios de consecuencias. | Game y app; activo. |
| `js/utils.js:1-30` | `shuffle`, `escapeText`, `makeId`, `downloadJSON`. | Decks/app; activo. |
| `js/drinks.js:1-18` | `addDrink`; trim, rechaza vacío/duplicado, crea opción enabled. | App; activo. |
| `js/manuals.js:1-3` | `findManual`. | App; activo. |
| `js/icons.js:1-3` | `iconFor`, glifo de fallback. | No aparece importado en `js/app.js` ni otras rutas de código encontradas; sin referencias aparentes, posiblemente residual. |

## Datos (`data/`)

| Archivo | Función y relaciones |
|---|---|
| `data/pdf-catalog.js:1-7871` | Exporta `PDF_CARDS` desde línea 2 y `PDF_MANUALS` desde línea 7306. Catálogo de datos base, importado por `initial-cards.js` y `initial-manuals.js`; no lógica de UI. |
| `data/additional-challenges.js:1-120` | 67 textos emparejados por índice con `shotCounts`, IDs DESAFIO_PDF_103–169, nivel/categoría/penalización; `ADDITIONAL_CARDS` combina desafíos con lista extra vacía. Consumido por `initial-cards.js` y `storage.js`. |
| `data/initial-cards.js:1-7` | Combina y clona PDF + cartas adicionales como `INITIAL_CARDS`; importado por storage. |
| `data/initial-manuals.js:1-3` | Clona manuales PDF; importado por storage. |
| `data/catalog-migrations.js:1-66` | IDs antiguos de cartas/manuales para limpieza en migración; importado por storage. |

## CSS (`css/`)

| Archivo | Responsabilidad y relaciones |
|---|---|
| `css/styles.css:1-1108` | Tokens/base/layout/componentes globales, reglas responsive y reducción de movimiento. Enlazado por `index.html:27`. |
| `css/dashboard-categories.css:1-233` | Estilos de panel/categorías/dashboard, responsive; enlazado por `index.html:28`. |
| `css/dice.css:1-361` | Cubo, caras, rotación y escenario del dado; enlazado por `index.html:29`, manipulado por app. |
| `css/brand.css:1-331` | Paleta y marca GDP con variaciones responsive/motion; enlazado por `index.html:30`. |

## Pruebas y assets

| Archivo | Función |
|---|---|
| `tests/core.test.js` | Pruebas node:test de catálogo, mazos, targets, dado, ciclo de juego, minijuegos, migración y JSON. Aún no incluye prueba de integración Supabase ni navegador. |
| `supabase/sql/001_multiplayer_schema.sql` | Tablas `profiles`, `rooms`, `room_players`, `game_states`, índices y RLS habilitado. |
| `database/001_player_profiles.sql` | Añade UID público de ocho caracteres, color de banner, backfill y políticas RLS para perfiles; no almacena contraseñas. |
| `database/README.md` | Orden de aplicación de la tabla de perfiles y explicación de Supabase Auth. |
| `supabase/sql/002_multiplayer_policies.sql` | Grants mínimos, helpers y políticas RLS de lectura de miembros y Presence privada. |
| `supabase/sql/003_multiplayer_functions.sql` | RPC transaccionales de crear/unirse/iniciar/guardar/heartbeat/salir/transferir/cerrar sala. |
| `supabase/sql/004_multiplayer_realtime.sql` | Replica identity y publicación de tablas de sala/estado. |
| `supabase/README.md` | Orden de despliegue SQL, requisitos del proyecto, comprobaciones y límites. |
| `assets/brand/zevyra-emblem.png` | Imagen fuente original del logo proporcionado por el usuario, usada en encabezado, hero y catálogo. |
| `assets/icons/icon.svg`, `favicon.svg` | Contenedores SVG livianos que muestran la imagen raster original; no vectorizan ni reinterpretan la ilustración. El favicon se enlaza en HTML y ambos SVG se precachean. |
| `assets/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32x32.png` | Variantes raster para PWA, iOS y navegador; listadas en manifest/HTML y SW. |
| `js/games-catalog.js` | Datos del catálogo ZEVYRA (juego disponible y experiencias próximas), importados por `app.js`. |
| `css/platform.css` | Estilos de marca y vistas Inicio/Juegos, selector de modalidad, lobby y responsive. Enlazado desde `index.html`. |

## Árbol observado

```text
DOCUMENTACION_TECNICA/ [nueva entrega]
assets/icons/ [5 iconos]
css/ [4 hojas]
data/ [6 módulos de datos]
js/ [17 módulos]
supabase/sql/ [4 scripts SQL]
tests/ [1 archivo]
raíz: index.html, package.json, README.md, manifest.json, server.mjs, sw.js, 2 PDF
```

Se excluyen `.agents/`, `.aws/` y `.codex/` del inventario de aplicación: directorios de entorno/herramientas, sin importación o enlace desde aplicación. `node_modules`, dist/build/vendor no están presentes en listado inspeccionado.

## Actualización fase 1

`js/game.js` expone `rerollDigital` y `redraw`; `js/app.js` añade temporizador, carrusel, formulario de manual y menú contextual; `storage.js` valida `durationSeconds`; `tests/core.test.js` cubre las nuevas operaciones del motor.

## Actualización multijugador (fase Supabase)

La ruta funcional de conexión está en `index.html` → `js/app.js` → `js/multiplayer.js` → `js/multiplayer-auth.js` / `js/multiplayer-rooms.js` / `js/multiplayer-sync.js` → `js/supabase.js` → Supabase. `js/app.js` mantiene separados el estado local y el remoto; en juego, la RPC 006 da permiso de escritura al participante actual y el resto observa. El host mantiene control del lobby y temporizador. El uso de esta actualización queda pendiente de aplicar 006 y probar dos identidades de navegador.
