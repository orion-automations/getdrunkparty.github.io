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

Las cuentas personales se gestionan por `js/local-accounts.js` y la API local de `server.mjs`, que delega las consultas a `database/local_users.py` y SQLite nativo. `js/multiplayer-auth.js` solo mantiene identidad anónima técnica para salas. `js/multiplayer-rooms.js` gestiona RPC/lecturas y `js/multiplayer-sync.js` gestiona Postgres Changes y Presence. El SDK v2 se carga desde CDN con `async` en `index.html:14-19`; los módulos online se importan solo al iniciar una conexión.

### Tablas remotas

| Tabla | Uso | RLS/lectura |
|---|---|---|
| `rooms` | Código, host, estado, límite y vencimiento de sala. | Lectura solo de miembros. Creación/mutación por RPC. |
| `room_players` | Roster y nickname/avatar copiados para la sesión de sala, rol y heartbeat. | Lectura solo de miembros. Mutación por RPC. |
| `game_states` | Snapshot JSON de partida, temporizador y versión optimista. | Lectura solo de miembros. El participante activo guarda el estado del juego; el host actualiza por separado el temporizador, todo por RPC versionada. |

La base de cuentas local usa `database/001_users.sql` para crear `local_users` y `local_sessions`; `database/local_users.py` aplica el esquema, verifica hashes PBKDF2 y ejecuta consultas SQLite. `server.mjs` expone `/api/users/register`, `/login`, `/me` y `/session`; bloquea la descarga directa del archivo `database/zevyra.sqlite`. No se envía la contraseña ni el UID de cuenta a Supabase.

El esquema online de sala está en `supabase/sql/001_multiplayer_schema.sql`; después siguen políticas/RPC/realtime en 002–004, diagnóstico/unión en 005, acciones y alias de roster en 006, confirmación de anfitrión en 007, y `008_local_accounts_only.sql` para dejar de guardar perfiles persistentes en instalaciones antiguas. El detalle está en `supabase/README.md`.

### Persistencia y sincronización

El participante actual serializa estado por `snapshotForRoom()` (`js/app.js`); `scheduleRoomAction()` → `actRoomTurn()` → `gdp_act_turn` bloquea sala/estado, valida usuario/turno/versión y actualiza atómicamente. El host puede cambiar solo temporizador por `scheduleRoomTimer()` → `saveSharedTimer()` → `gdp_save_shared_timer`. Los otros clientes reciben la fila por Postgres Changes y `applyOnlineSnapshot()` la renderiza (`js/multiplayer-sync.js`, `js/app.js`). `gdp_save_game_state` queda revocada a clientes autenticados por 006 para impedir escritura alternativa del snapshot. Presence informa conexiones, no es estado persistente.

El estado online comienza desde un juego vacío y miembros de la sala; no importa participantes ni mazos del estado local al juego online. El modo local permanece intacto al cambiar de modo. Las escrituras directas continúan revocadas; los cambios del juego pasan por RPC del participante activo y las acciones del lobby continúan restringidas al host.

## Import/export

JSON de cartas: array o `{version:1,cards:[...]}`; IDs, categorías, required fields, targets, iconos, penalizaciones, effects y references a manual se validan (`storage.js:180-295`). Las cartas extra se clonan y anexan. Respaldo completo tiene validación menos estricta que `isValidState`: requiere versión 1, listas cards/participants/manuals, drinks y game, luego valida cartas y reemplaza estado (`app.js:1186-1207`). Importación no ejecuta el JSON como código.

## Cache Storage PWA

El SW precachea recursos de shell bajo `zevyra-shell-1.8.0` (`sw.js:1-2`); incluye los módulos JavaScript y catálogos nuevos, pero no el SDK CDN. Para GET del mismo origen intenta red y usa caché como alternativa; `localStorage` permanece separado de Cache Storage. Crear o unirse a una sala requiere internet y el SDK.

## Actualización Fase 2

La migración 006 agrega RPCs para que el participante activo escriba turnos con versión esperada, actualice nickname asociado a salas y el anfitrión escriba únicamente el temporizador. No se ejecutó contra Supabase remoto; verificar dos sesiones/dispositivos sigue pendiente. El RPC limita quién escribe y evita conflicto de versión, pero recibe un snapshot completo y no valida toda acción/regla semántica del motor en servidor.
