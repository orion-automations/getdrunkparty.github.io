# Fase 2 — Midnight Chaos: turno, perfil y mecánicas

## Alcance de esta entrega

El nombre seleccionado es **Midnight Chaos**, definido una sola vez en `js/config.js` como `GAME_NAME` y con el identificador de datos `GAME_ID`. Se usa en catálogo, título y vista de juego. La plataforma sigue siendo ZEVYRA Games.

La auditoría de solo lectura previa al cambio encontró: turnos online solo para anfitrión; perfil nickname limitado al formulario del lobby; catálogo inicial todavía tomado del PDF previo; y ausencia de inventario de poderes, contador/eventos de ronda y cadenas. El reverso de carta ya se había cambiado a ZEVYRA. Este documento registra lo implementado y sus límites.

Esta entrega habilita que el participante actual, sea anfitrión o invitado, juegue desde su propio dispositivo; los demás observan y no tienen controles de acción. El anfitrión conserva el control del lobby y del temporizador. También se añade perfil, un catálogo inicial propio y las primeras versiones de poderes, eventos y cadenas.

La sincronización usa el snapshot existente de `game_states`. Cada tirada guarda primero la cara elegida y la hora de inicio; los clientes reciben la misma cara, ejecutan una animación hacia ese resultado y muestran el estado de carta recibido. El giro visual no vuelve a sortear el dado.

## Recorrido del turno

1. `js/app.js`, `canPlayOnlineGame()`: compara `state.game.current.playerId` (o `participants[currentIndex]` antes del turno) con `session.user.id`.
2. `renderGame()`, `cubeIsInteractive()` y `renderMinigameFlow()`: deshabilitan el dado, categorías, selecciones y resolución en los clientes que miran. El mensaje indica quién tiene el turno.
3. `startDigitalRoll()`: genera una sola cara con el motor `js/game.js`, asigna `rollStartedAt`, guarda el estado y anima el cubo hacia esa cara. `applyOnlineSnapshot()` inicia la misma animación para los otros dispositivos cuando llega ese estado.
4. Las decisiones pasan por `persist()` → `scheduleRoomAction()` (`js/multiplayer.js`) → `actRoomTurn()` (`js/multiplayer-rooms.js`) → RPC `gdp_act_turn` (`supabase/sql/006_turn_actions_and_profile.sql`).
5. La RPC bloquea la fila de sala y estado, valida miembro, dueño del turno, roster, transición de índice y versión esperada y guarda el snapshot una sola vez. Un segundo cambio concurrente recibe `VERSION_CONFLICT`; una cuenta fuera del turno recibe `TURN_OWNER_REQUIRED`.
6. Al resolver el turno, el cliente activo guarda el siguiente `currentIndex`; al recibirse el snapshot, todos habilitan al siguiente participante.

### Mapa de trazabilidad (líneas verificadas en esta entrega)

| Comportamiento | Implementación y recorrido |
|---|---|
| Nombre/ID del juego | `js/config.js:1-3` → catálogo `js/games-catalog.js`; título visible desde `js/app.js:741-742`; pantalla vacía `index.html:112-121`. |
| Persistencia y cambio de catálogo | `js/storage.js:8-15` define clave e identidad; `loadState()` lee/migra la clave previa en `js/storage.js:92-103,170-198`; catálogo base: `data/initial-cards.js:1-3` → `data/midnight-catalog.js:9-65`. |
| Permiso del jugador actual | `canPlayOnlineGame()` / `requireOnlineGame()` en `js/app.js:92-112`; persistencia guardada en `js/app.js:114-124`; lanzamiento en `startDigitalRoll()` `js/app.js:2066-2088`. |
| Animación y estado compartido | `applyOnlineSnapshot()` reemplaza estado e inicia la animación sincronizada en `js/app.js:255-318`; envío: `js/multiplayer.js:155-178` → `js/multiplayer-rooms.js:54-63` → SQL `gdp_act_turn`, `supabase/sql/006_turn_actions_and_profile.sql:3-151`. |
| Perfil | Formulario y nickname automático: `js/app.js:339-380,437-455`; guardado remoto: `js/multiplayer.js:171-178` → `js/multiplayer-rooms.js:75-84` → `gdp_refresh_room_profile`, `supabase/sql/006_turn_actions_and_profile.sql:153-199`. |
| Poderes y efectos de premio | Datos: `data/power-catalog.js:1-5`; consumo: `activatePower()` `js/game.js:442-472`; finalización y concesión desde premios/minijuegos: `js/game.js:536-640`; controles: `js/app.js:1022-1044`. |
| Eventos cada cinco turnos | Catálogo: `data/round-events.js:1-7`; contador/aplicación/cierre: `finishTurn()` `js/game.js:641-654` y `applyRoundProgress()` `js/game.js:675-705`; animación al sincronizar: `renderRoundAndPowerState()` `js/app.js:998-1014` + `css/platform.css:41-49`. |
| Cadenas | Catálogo: `data/chain-challenges.js:1-6`; motor: `startChain()` / `continueChain()` / `finishChain()` `js/game.js:481-535`; controles y estado: `js/app.js:1047-1102`; turno remoto validado por `gdp_act_turn` según la cadena activa. |

Los rangos son específicos de la versión 1.8.0; deben recalcularse si cambian los archivos.

El temporizador conserva control de anfitrión, pero ahora usa `gdp_save_shared_timer`, que solo actualiza la columna de temporizador. La función anterior `gdp_save_game_state` pierde permiso para clientes autenticados tras aplicar la migración 006, para que no se use como vía alterna de escritura del juego.

## Perfil

- El último botón de navegación ahora es un icono SVG de usuario y abre `#view-profile`.
- `#profile-form` guarda el nickname localmente en `zevyra.profile.name`; el formulario de multijugador muestra ese valor en modo de solo lectura.
- Antes de crear o unirse a una sala, `connectOnlineRoom()` recupera el nombre local o consulta el perfil de la identidad anónima persistida. Si aún no hay nickname, solicita configurarlo en Perfil.
- La cuenta personal se guarda en SQLite local. Al cambiar nickname/avatar durante una sala, la RPC `gdp_refresh_room_profile` actualiza solo `username_snapshot`/`avatar_snapshot` en salas activas; no actualiza una tabla remota de perfiles ni cambia el UUID ni los nombres históricos ya guardados.
- El perfil muestra un fragmento del identificador anónimo de Supabase cuando la sesión está conectada. No agrega contraseña ni mecanismo de recuperación de identidad.

## Migración necesaria

Ejecutar en Supabase SQL Editor `supabase/sql/006_turn_actions_and_profile.sql`, después de 005 si 005 aún está pendiente. 006 es aditiva, no toca 001–004 y no borra datos. La aplicación nueva requiere las tres RPC que crea 006 antes de probar acciones online; iniciar sala y unirse siguen usando las funciones ya instaladas.

## Verificación realizada y límites

- `npm test`: pasó la suite existente (1 archivo).
- `node --check` en módulos JavaScript y service worker: pasó.
- No se comprobó SQL contra el proyecto remoto ni se ejecutó una partida real entre dispositivos en este entorno. Después de aplicar 006, probar dos sesiones: turno de anfitrión, turno de invitado, dado, carta principal, Premio/Castigo y resolución; intentar cada acción desde el dispositivo que no tiene el turno.

## Catálogo y migración local

- `data/midnight-catalog.js` separa los nuevos datos de cartas/manuales de la lógica. Hay 40 cartas nuevas: 10 VERDAD, 10 DESAFÍO, 8 MINIJUEGO, 6 PREMIO y 6 CASTIGO.
- El contenido nuevo es de conversación, improvisación y dinámica voluntaria; no exige alcohol, contacto físico, fotografías ni publicaciones privadas. Un desafío incluye una alternativa y los demás se pueden declinar sin penalización.
- `data/initial-cards.js` y `data/initial-manuals.js` ahora inicializan Midnight Chaos. El editor y JSON import/export siguen usando el mismo esquema y validación (`js/storage.js`).
- En `storage.js`, la migración de catálogo 6 conserva los registros fuente anteriores pero los desactiva, salvo la carta que ya esté en curso. No borra registros personalizados; agrega las nuevas cartas/manuales por ID y no reemplaza una edición existente. El catálogo anterior sigue archivado en `data/pdf-catalog.js` y `data/additional-challenges.js`.
- Importar/editar después de la migración permanece reversible desde el editor: las cartas antiguas desactivadas se pueden consultar y activar manualmente. No se ha exportado un archivo externo de respaldo; los originales siguen presentes y las cartas no se eliminan.

## Poderes, rondas y cadenas

- `data/power-catalog.js` define tres poderes con ID, descripción, momento, duración, efecto y cancelación: escudo, reescritura y pase libre. El inventario y consumo se guardan en `state.game.powers` / `usedPowers`; las cartas de premio pueden conceder poderes mediante `GRANT_POWER`, incluso si se asignaron como consecuencia de un minijuego. `js/game.js` implementa usar pase, escudo y reescritura; el escudo cancela el robo de castigo y Pase libre resuelve el desafío y avanza el turno automáticamente.
- `data/round-events.js` contiene cinco eventos y sus campos de activación, duración y cierre. `js/game.js:applyRoundProgress()` incrementa `completedTurns`; cada múltiplo de cinco finaliza el evento anterior y registra el siguiente en `activeRoundEvent` e `roundEventHistory`. Los efectos implementados son inversión de orden y concesión de Pase libre, Reescritura o Escudo. El estado se guarda localmente o viaja en el snapshot de sala. `renderRoundAndPowerState()` muestra el mismo evento recibido; `css/platform.css` anima su entrada cuando cambia el ID y respeta `prefers-reduced-motion`.
- `data/chain-challenges.js` define cuatro retos finitos, su consentimiento y límite de pasos. `startChain()`, `continueChain()` y `finishChain()` en `js/game.js` mantienen participante activo, visitados, límite y `chainHistory`. `renderChainState()` expone instrucciones y cierre; `canPlayOnlineGame()` limita cada acción al participante de la cadena.
- La interfaz muestra contador, evento e historial; inventario de poderes; cadena activa e historial inmediato. No se usa una tabla Supabase aparte: estos objetos forman parte del snapshot versionado de `game_states`.

## Identidad de datos por juego

`GAME_ID = "midnight-chaos"` se almacena en estado local y en cada snapshot inicial/remoto. `applyOnlineSnapshot()` rechaza un juego remoto cuyo ID sea distinto. `gdp_act_turn` valida que no cambie el `gameId` en una mutación. La infraestructura de sala queda compartida, pero cartas/manuales/configuración de partida se envían en el estado de la experiencia actual.

## Nombres

Opciones consideradas en el diseño: Noche Prisma, Caos de Medianoche, Afterglow, Chispa Salvaje y Ritual Violeta. **Nombre elegido por el usuario: Midnight Chaos**. Ninguno de los otros nombres debe aplicarse.

## Pendientes de la solicitud original

- `gdp_act_turn` valida turno, roster e incremento de versión, pero recibe un snapshot completo. No ejecuta el motor de juego en servidor ni verifica semánticamente cada resultado/carta/efecto. Para impedir trampas dentro del turno, la siguiente etapa requeriría RPCs de acciones tipadas o motor servidor.
- El juego de cartas implementa una selección de 40 cartas iniciales; no es todavía una revisión completa de los 377 textos fuente ni un catálogo extenso. Los antiguos se conservan desactivados para consulta; la auditoría detallada de derechos/originalidad carta por carta queda pendiente.
- Los poderes y eventos son una base jugable acotada, no cubren todos los ejemplos opcionales del encargo. Las cadenas concluyen al alcanzar límite, agotar participantes o cerrar voluntariamente. Las reglas actuales no permiten efectos sin límite.
- Falta una prueba manual de dos dispositivos tras ejecutar la migración 006. Los cambios previos de turno/perfil fueron verificados por pruebas unitarias/sintaxis, no en Supabase remoto.
