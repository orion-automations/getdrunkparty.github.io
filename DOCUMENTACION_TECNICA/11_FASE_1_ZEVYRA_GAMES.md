# Fase 1 — ZEVYRA Games

> Registro histórico de Fase 1. Las funciones que aquí aparecen como pendientes —acciones de invitados, perfil, nombre Midnight Chaos y catálogo original— se abordaron parcialmente en Fase 2; consulte [13 — Fase 2](13_FASE_2_TURNOS_Y_PERFIL.md) y sus límites antes de tomar esta página como estado actual.

Fecha: 2026-11-02  
Versión de código: 1.6.0

## Implementado

- `index.html` ahora presenta ZEVYRA Games, el lema THE DARK PLAYGROUND, el emblema proporcionado por el usuario y navegación principal Inicio/Juegos.
- `js/games-catalog.js` define el catálogo de cinco experiencias. `js/app.js` genera las tarjetas con `renderGameLibrary()` y el juego destacado con `renderFeaturedGame()`. Solo Get Drunk Party está disponible; los cuatro juegos futuros aparecen deshabilitados.
- El botón Jugar muestra selector entre partida local y multijugador. La modalidad local reutiliza el motor previo; el acceso online abre la interfaz existente de Supabase.
- La vista online incluye formularios de creación/unión, lobby con código copiable, estado, cantidad de personas y controles de anfitrión/participante. Usa `connectRoom()` y las RPC actuales, no crea otro cliente.
- La identidad se incorporó al manifest, favicons, iconos PWA y caché del service worker. La versión de shell y aplicación cambia a 1.6.0.
- Se conservan las migraciones 001–004 y la configuración existente de Supabase.

## Flujo de navegación

`index.html → js/app.js → js/games-catalog.js`

1. `index.html` define las vistas `home`, `games`, `game` y `multiplayer`, y carga el módulo principal.
2. `js/app.js:setView()` activa una vista y vuelve a renderizar. Inicio y Juegos son la navegación principal; el menú de herramientas conserva las pantallas avanzadas.
3. La biblioteca lee `GAMES_CATALOG`. Una experiencia disponible abre `view-game`; desde ahí el usuario elige local o online.
4. El modo local conserva el motor en `js/game.js`. El modo online entra a `view-multiplayer` y llama al módulo existente `js/multiplayer.js`.

## Flujo online actualmente disponible

`index.html → js/app.js:connectOnlineRoom() → js/multiplayer.js:connectRoom() → js/multiplayer-auth.js / js/multiplayer-rooms.js / js/multiplayer-sync.js → Supabase`

Crear/unirse y el lobby se conectan a las RPC y tablas ya configuradas. El anfitrión puede iniciar la partida. La interfaz muestra la lista de miembros recibida en la lectura de sala y se actualiza con eventos Realtime.

## Pendiente y límites conocidos

- El código online anterior solo permite al anfitrión modificar el estado del juego; los participantes invitados siguen en modo de solo lectura. La solicitud de acciones de invitados con validación servidor, turnos, control de concurrencia y migración SQL nueva queda pendiente. No se afirma que el multijugador de partida esté terminado.
- No se probó una sala con dos dispositivos ni la entrega de eventos Realtime en el proyecto Supabase. No se ejecutó ninguna migración adicional.
- La interfaz no se pudo abrir en navegador durante esta revisión: el navegador bloqueó la recarga `file://` y el entorno no permitió iniciar el servidor local (`listen EPERM`).

## Pruebas ejecutadas

- `npm test`: 1 suite aprobada, 0 fallidas.
- `node --check js/app.js`: aprobada.
- Recursos: se confirmó la imagen fuente 1254×1254 y PNG de 32×32, 192×192 y 512×512.
- Pendientes: prueba visual escritorio/móvil, manifest/instalación, modo offline, creación/unión de sala, RLS/Realtime y prueba entre dos dispositivos.

## Pasos manuales

- No hay SQL nuevo para aplicar en esta entrega; se conservan 001–004. La acción compartida de invitados requiere diseñar y aplicar una migración posterior antes de declarar completa esa parte.
- Ejecutar la app mediante un servidor HTTPS o `localhost`; `file://` no permite validar Supabase y no se pudo recargar dentro del navegador de esta sesión.
- En GitHub, publicar los archivos de esta fase cuando se revise el cambio local. No se creó copia de seguridad ni commit.

## Recurso central del reverso de cartas

El reverso visible de cartas sigue generado en `js/app.js` por `makeTurnCard()` y usa el glifo GDP. Se conserva el juego actual; sustituir ese reverso por arte ZEVYRA queda para la fase visual de cartas.
