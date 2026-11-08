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

La base de cuentas local usa `database/001_users.sql:1-33` para crear `local_users` y `local_sessions`; `database/local_users.py:40-50` aplica el esquema y `database/local_users.py:53-130` migra esquemas existentes. `database/local_users.py:260-282` crea cuentas con hash PBKDF2 y UID `zevy` más seis caracteres aleatorios. `server.mjs:67-97` expone `/api/users/register`, `/login`, `/me` y `/session`, y bloquea la descarga directa del archivo SQLite. El nickname, el avatar y los datos de identidad se guardan en SQLite; el token y el perfil devuelto se mantienen también en `localStorage` (`js/local-accounts.js:1-15`). La contraseña no se conserva en texto legible ni se envía a Supabase.

### Registro en dos pasos, pasaporte y avatar

Recorrido de registro: `index.html:90-103` (credenciales y campos de identidad) → `js/app.js:823-896` (Stepper y validación; el paso 1 mantiene deshabilitados los campos de identidad) → `js/local-accounts.js:65-68` → `server.mjs:67-97` → `database/local_users.py:260-282` → `database/001_users.sql:7-28`. El backend devuelve el perfil con UID, avatar, nacionalidad, edad, sexo e identidad (`database/local_users.py:133-154`), y `saveSession()` lo guarda junto con el token en `localStorage` (`js/local-accounts.js:12-15`).

El pasaporte visible y sus controles están en `index.html:138-224`; `js/app.js:106-142` proyecta el perfil y su bandera, `js/app.js:915-980` alterna la edición inline y guarda cambios mediante `/api/users/me`, y `database/local_users.py:301-317` actualiza los campos en SQLite. El modo de edición revela nickname, nacionalidad, edad, sexo, identidad sexual y el botón de avatar; el UID permanece bloqueado.

El creador Big Smile vive en `index.html:684-701`. `js/app.js:332-460` consulta los metadatos de opciones del endpoint DiceBear 10.x, forma pestañas por categoría y genera miniaturas SVG; `js/app.js:2776-2833` gestiona apertura, selección y guardado. Los estilos del pasaporte y del catálogo visual están en `css/platform.css:1078-1165`. En gestión de participantes, `js/app.js:2271-2287` abre el mismo editor para el avatar individual. El lobby usa una imagen y el avatar del perfil, sin selector desplegable (`index.html:438`, `js/app.js:106-125`).

El esquema online de sala está en `supabase/sql/001_multiplayer_schema.sql`; después siguen políticas/RPC/realtime en 002–004, diagnóstico/unión en 005, acciones y alias de roster en 006, confirmación de anfitrión en 007, y `008_local_accounts_only.sql` para dejar de guardar perfiles persistentes en instalaciones antiguas. El detalle está en `supabase/README.md`.

### Persistencia y sincronización

El participante actual serializa estado por `snapshotForRoom()` (`js/app.js`); `scheduleRoomAction()` → `actRoomTurn()` → `gdp_act_turn` bloquea sala/estado, valida usuario/turno/versión y actualiza atómicamente. El host puede cambiar solo temporizador por `scheduleRoomTimer()` → `saveSharedTimer()` → `gdp_save_shared_timer`. Los otros clientes reciben la fila por Postgres Changes y `applyOnlineSnapshot()` la renderiza (`js/multiplayer-sync.js`, `js/app.js`). `gdp_save_game_state` queda revocada a clientes autenticados por 006 para impedir escritura alternativa del snapshot. Presence informa conexiones, no es estado persistente.

El estado online comienza desde un juego vacío y miembros de la sala; no importa participantes ni mazos del estado local al juego online. El modo local permanece intacto al cambiar de modo. Las escrituras directas continúan revocadas; los cambios del juego pasan por RPC del participante activo y las acciones del lobby continúan restringidas al host.

## Import/export

JSON de cartas: array o `{version:1,cards:[...]}`; IDs, categorías, required fields, targets, iconos, penalizaciones, effects y references a manual se validan (`storage.js:180-295`). Las cartas extra se clonan y anexan. Respaldo completo tiene validación menos estricta que `isValidState`: requiere versión 1, listas cards/participants/manuals, drinks y game, luego valida cartas y reemplaza estado (`app.js:1186-1207`). Importación no ejecuta el JSON como código.

## Cache Storage PWA

El SW precachea recursos de shell bajo `zevyra-shell-2.3.18` (`sw.js:1-2`); incluye los módulos JavaScript y catálogos nuevos, pero no el SDK CDN. Para GET del mismo origen intenta red y usa caché como alternativa; `localStorage` permanece separado de Cache Storage. Crear o unirse a una sala requiere internet y el SDK.

## Actualización Fase 2

La migración 006 agrega RPCs para que el participante activo escriba turnos con versión esperada, actualice nickname asociado a salas y el anfitrión escriba únicamente el temporizador. No se ejecutó contra Supabase remoto; verificar dos sesiones/dispositivos sigue pendiente. El RPC limita quién escribe y evita conflicto de versión, pero recibe un snapshot completo y no valida toda acción/regla semántica del motor en servidor.
