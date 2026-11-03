# Bases de datos e integraciones

## Persistencia local

La app conserva persistencia local en `window.localStorage`, clave `gdpw.data.v1` (`js/storage.js`). Online utiliza además el proyecto Supabase configurado en `js/supabase.js`, con identidad anónima y tablas remotas. `js/app.js` mantiene el estado de sala separado del objeto local y retorna a este al salir. Ningún servicio remoto migra o sincroniza automáticamente el catálogo/historial local completo.

### Datos mantenidos

- Cartas: ID, categoría, texto, icono glyph, intensidad, target, penalty, manualId, enabled y opcional effects.
- Manuales: catálogo PDF más manuales editados/creados; campos base y `details` opcional, incluidas reglas de consecuencias.
- Bebidas/unidades: ID, nombre, etiqueta, enabled.
- Participantes: ID, nombre, active, preferences.
- Ajustes: reversa de posiciones, modo digital/físico.
- Partida: índice actual, estado, mazos (orden/índice/última carta), turno en curso, historial limitado a 20 y recompensas.

El esquema se inicializa en `storage.js:12-35`; validación estructural en `37-82`, validación de carta en `180-246`.

## Carga y migraciones

`loadState()` crea seed cuando falta clave; si estado válido aplica limpieza de IDs legados para versiones de catálogo previas, agrega cartas/manuales base faltantes, normaliza desafíos legacy y actualiza opción Shots (`storage.js:84-168`). Para incrementar adicionales, incorpora solo IDs no presentes cuando `catalogVersion` es inferior a la declarada. Guardados de migración se escriben localmente. `data/catalog-migrations.js` lista IDs removidos.

## Catálogo original y documentos fuente

`data/pdf-catalog.js` define `PDF_CARDS` y `PDF_MANUALS`; `data/initial-cards.js` combina PDF con `ADDITIONAL_CARDS`; `data/initial-manuals.js` expone manuales. `additional-challenges.js` deriva IDs/títulos 103–169 desde índice de 67 textos y `shotCounts`. Esta relación de índice exige mantener ambas listas alineadas. La documentación original informa 310 cartas base y 377 con adiciones; pruebas automatizadas incluyen aserción del catálogo (`tests/core.test.js:12-17`).

## APIs / servicios externos

La integración Supabase se separa en `js/multiplayer-auth.js` (identidad y perfil), `js/multiplayer-rooms.js` (lecturas/RPCs), `js/multiplayer-sync.js` (Postgres Changes y Presence), coordinados por `js/multiplayer.js`. `js/supabase.js` recibe la URL y clave pública `anon` del proyecto. El SDK v2 se carga desde CDN con `async` en `index.html:14-19`, y los módulos que lo importan se cargan dinámicamente desde `multiplayer.js` solo al iniciar conexión. El servidor `server.mjs` sigue sirviendo archivos; no tiene endpoint de aplicación.

### Tablas remotas

| Tabla | Uso | RLS/lectura |
|---|---|---|
| `profiles` | Nombre y avatar opcional por `auth.users.id`. | Cada usuario lee/escribe su propio perfil. |
| `rooms` | Código, host, estado, límite y vencimiento de sala. | Lectura solo de miembros. Creación/mutación por RPC. |
| `room_players` | Roster, rol, avatar/nombre y heartbeat. | Lectura solo de miembros. Mutación por RPC. |
| `game_states` | Snapshot JSON de partida, temporizador y versión optimista. | Lectura solo de miembros. Mutación por RPC del host. |

El DDL está en `supabase/sql/001_multiplayer_schema.sql:2-54`; políticas/grants en `002_multiplayer_policies.sql:39-78`; RPCs en `003_multiplayer_functions.sql` (`gdp_create_room`, `gdp_join_room`, `gdp_start_game`, `gdp_save_game_state`, `gdp_leave_room`, `gdp_claim_host`, `gdp_close_room`); publicación en `004_multiplayer_realtime.sql:1-29`. El orden de instalación es 001 → 002 → 003 → 004.

### Persistencia y sincronización

El host serializa participantes, ajustes, partida y las cartas/manuales actualmente referenciados en `snapshotForRoom()` (`js/app.js:51-64`). `scheduleRoomState()` guarda con versión esperada; SQL bloquea sala/estado, verifica que el usuario sea anfitrión y aumenta `version` atómicamente (`js/multiplayer.js`, `003_multiplayer_functions.sql:gdp_save_game_state`). Los invitados reciben la fila nueva por Postgres Changes y `applyOnlineSnapshot()` actualiza su render (`js/multiplayer-sync.js`, `js/app.js:174-214`). Presence informa quién está conectado, sin convertirse en estado persistente. La lista precisa de tablas publicadas está en `004_multiplayer_realtime.sql`.

El estado online comienza desde un juego vacío y miembros de la sala; no importa participantes ni mazos del estado local al juego online. El modo local permanece intacto al cambiar de modo. El host es la única autoridad de acciones; los otros clientes observan y el SQL rechaza escrituras directas de roles cliente a las tablas de partida.

## Import/export

JSON de cartas: array o `{version:1,cards:[...]}`; IDs, categorías, required fields, targets, iconos, penalizaciones, effects y references a manual se validan (`storage.js:180-295`). Las cartas extra se clonan y anexan. Respaldo completo tiene validación menos estricta que `isValidState`: requiere versión 1, listas cards/participants/manuals, drinks y game, luego valida cartas y reemplaza estado (`app.js:1186-1207`). Importación no ejecuta el JSON como código.

## Cache Storage PWA

El SW precachea recursos de shell bajo `gdpw-shell-1.5.0`; incluye los módulos JavaScript online, pero no SDK CDN. Para GET mismo origen primero intenta red, copia respuestas exitosas a caché; al fallar responde caché o `index.html`. Datos `localStorage` están separados de caché y no son borrados por esta lógica. El modo local no importa módulos que creen conexión remota y sigue disponible offline; crear/unirse requiere internet y el SDK.

## Actualización fase 1

Las cartas pueden guardar `durationSeconds` opcional, entero entre 1 y 3600. Las partidas nuevas conservan hasta diez archivos anteriores en `game.archives`. La fase Supabase agrega salas temporales (seis horas), capacidad 2–30, sesión Auth anónima y host único. La configuración SQL no se ha ejecutado desde esta edición; integración con dos perfiles aún debe verificarse en Supabase.
