# Bases de datos e integraciones

## Persistencia local

La app conserva persistencia local en `window.localStorage`, clave `zevyra.midnight-chaos.data.v1` (`js/storage.js:8-11,201-208`). `loadState()` lee primero la clave propia y, si falta, importa `gdpw.data.v1` a la clave nueva sin eliminar la anterior (`js/storage.js:91-200`). Online utiliza Supabase configurado en `js/supabase.js`, con identidad anónima y tablas remotas. `js/app.js` mantiene el estado de sala separado del objeto local y retorna a este al salir. Ningún servicio remoto migra o sincroniza automáticamente el catálogo/historial local completo.

### Datos mantenidos

- Cartas: ID, categoría, texto, icono glyph, intensidad, target, penalty, manualId, enabled y opcional effects.
- Manuales: manuales originales de Midnight Chaos más registros editados/creados; campos base y `details` opcional, incluidas reglas de consecuencias.
- Bebidas/unidades: ID, nombre, etiqueta, enabled.
- Participantes: ID, nombre, active, preferences.
- Ajustes: reversa de posiciones, modo digital/físico.
- Partida: índice actual, estado, mazos, turno, historial, recompensas, contador/evento de ronda, inventario e historial de poderes, reto encadenado e historial de cadenas.

El esquema se inicializa en `storage.js:12-35`; validación estructural en `37-82`, validación de carta en `180-246`.

## Carga y migraciones

`loadState()` crea seed cuando faltan ambas claves; para datos heredados incorpora el estado a la clave nueva, archiva las cartas PDF desactivándolas y agrega Midnight Chaos por ID sin reemplazar cartas personalizadas (`storage.js:91-200`). La versión de catálogo es 6. `data/catalog-migrations.js` retiene listas de IDs para las migraciones anteriores.

## Catálogo original y documentos fuente

`data/midnight-catalog.js` define 40 cartas y sus manuales originales; `data/initial-cards.js` y `data/initial-manuals.js` exponen los catálogos iniciales. `data/pdf-catalog.js` y `data/additional-challenges.js` se conservan como fuentes archivadas, ya no se combinan con el catálogo inicial. La auditoría de similitud de los binarios fuente no se declara completa.

## APIs / servicios externos

La integración Supabase se separa en `js/multiplayer-auth.js` (identidad y perfil), `js/multiplayer-rooms.js` (lecturas/RPCs), `js/multiplayer-sync.js` (Postgres Changes y Presence), coordinados por `js/multiplayer.js`. `js/supabase.js` recibe la URL y clave pública `anon` del proyecto. El SDK v2 se carga desde CDN con `async` en `index.html:14-19`, y los módulos que lo importan se cargan dinámicamente desde `multiplayer.js` solo al iniciar conexión. El servidor `server.mjs` sigue sirviendo archivos; no tiene endpoint de aplicación.

### Tablas remotas

| Tabla | Uso | RLS/lectura |
|---|---|---|
| `profiles` | Nickname, avatar, UID público de ocho caracteres y color de banner por `auth.users.id`. | Cada usuario lee/escribe su propio perfil; las salas comparten copias de nickname/avatar. |
| `rooms` | Código, host, estado, límite y vencimiento de sala. | Lectura solo de miembros. Creación/mutación por RPC. |
| `room_players` | Roster, rol, avatar/nombre y heartbeat. | Lectura solo de miembros. Mutación por RPC. |
| `game_states` | Snapshot JSON de partida, temporizador y versión optimista. | Lectura solo de miembros. El participante activo guarda el estado del juego; el host actualiza por separado el temporizador, todo por RPC versionada. |

El esquema base está en `supabase/sql/001_multiplayer_schema.sql`; `database/001_player_profiles.sql` agrega `public_uid`, `banner_color` y las políticas RLS del perfil antes de `supabase/sql/002_multiplayer_policies.sql`. Después siguen RPCs de sala en 003, publicación en 004, diagnóstico/unión en 005, acciones de turno/perfil/temporizador en 006 y confirmación del anfitrión en 007. El orden y el procedimiento para una instalación existente están en `supabase/README.md`.

### Persistencia y sincronización

El participante actual serializa estado por `snapshotForRoom()` (`js/app.js`); `scheduleRoomAction()` → `actRoomTurn()` → `gdp_act_turn` bloquea sala/estado, valida usuario/turno/versión y actualiza atómicamente. El host puede cambiar solo temporizador por `scheduleRoomTimer()` → `saveSharedTimer()` → `gdp_save_shared_timer`. Los otros clientes reciben la fila por Postgres Changes y `applyOnlineSnapshot()` la renderiza (`js/multiplayer-sync.js`, `js/app.js`). `gdp_save_game_state` queda revocada a clientes autenticados por 006 para impedir escritura alternativa del snapshot. Presence informa conexiones, no es estado persistente.

El estado online comienza desde un juego vacío y miembros de la sala; no importa participantes ni mazos del estado local al juego online. El modo local permanece intacto al cambiar de modo. Las escrituras directas continúan revocadas; los cambios del juego pasan por RPC del participante activo y las acciones del lobby continúan restringidas al host.

## Import/export

JSON de cartas: array o `{version:1,cards:[...]}`; IDs, categorías, required fields, targets, iconos, penalizaciones, effects y references a manual se validan (`storage.js:180-295`). Las cartas extra se clonan y anexan. Respaldo completo tiene validación menos estricta que `isValidState`: requiere versión 1, listas cards/participants/manuals, drinks y game, luego valida cartas y reemplaza estado (`app.js:1186-1207`). Importación no ejecuta el JSON como código.

## Cache Storage PWA

El SW precachea recursos de shell bajo `zevyra-shell-1.8.0` (`sw.js:1-2`); incluye los módulos JavaScript y catálogos nuevos, pero no el SDK CDN. Para GET del mismo origen intenta red y usa caché como alternativa; `localStorage` permanece separado de Cache Storage. Crear o unirse a una sala requiere internet y el SDK.

## Actualización Fase 2

La migración 006 agrega RPCs para que el participante activo escriba turnos con versión esperada, actualice nickname asociado a salas y el anfitrión escriba únicamente el temporizador. No se ejecutó contra Supabase remoto; verificar dos sesiones/dispositivos sigue pendiente. El RPC limita quién escribe y evita conflicto de versión, pero recibe un snapshot completo y no valida toda acción/regla semántica del motor en servidor.
