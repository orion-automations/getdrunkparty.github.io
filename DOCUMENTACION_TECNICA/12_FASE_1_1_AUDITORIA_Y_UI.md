# Fase 1.1 — Auditoría de unión, navegación móvil y perfiles

Fecha: 2026-11-02  
Versión de aplicación: 1.6.1

## Hallazgo de la auditoría local

El flujo inspeccionado es `index.html → js/app.js:connectOnlineRoom() → js/multiplayer.js:connectRoom() → js/multiplayer-auth.js:ensureAnonymousIdentity()/saveProfile() → js/multiplayer-rooms.js:joinRoom() → RPC gdp_join_room`.

`js/multiplayer-rooms.js:joinRoom()` ya convierte el código a mayúsculas y quita espacios externos. En `supabase/sql/003_multiplayer_functions.sql:gdp_join_room`, la búsqueda se ejecuta en una función `SECURITY DEFINER` mediante `public.rooms.code`, así que la consulta inicial no depende de una política pública SELECT ni necesita desactivar RLS. La función bloquea la fila de sala (`FOR UPDATE`), lo cual serializa la comprobación del último cupo. Auth anónimo se crea antes de la RPC.

No se pudo comprobar el estado desplegado del Dashboard ni crear/unir una sala en Supabase desde este entorno. Por eso no se atribuye el fallo observado a RLS ni se declara resuelto el caso de un código nuevo válido. La causa local comprobable de mensajes confusos es que 003 devolvía `ROOM_NOT_FOUND` tanto para una sala ausente como para una sala vencida, y el cliente no diferenciaba permisos, sesión, estado/caché de función ni errores de conexión.

## Corrección SQL preparada

`supabase/sql/005_room_join_diagnostics.sql` reemplaza únicamente `gdp_join_room`; no altera tablas, datos ni políticas. Normaliza minúsculas y cualquier espacio, rechaza formatos ajenos al alfabeto/seis caracteres del proyecto, distingue `ROOM_NOT_FOUND`, `ROOM_EXPIRED`, `ROOM_CLOSED`, `ROOM_IN_PROGRESS` y `ROOM_FULL`, mantiene el lock de sala para aforo e idempotencia por miembro, y limita `EXECUTE` a `authenticated`.

**Paso manual:** en Supabase Dashboard → SQL Editor, ejecutar completo `supabase/sql/005_room_join_diagnostics.sql`. No volver a ejecutar 001–004. La migración no se ha marcado aplicada porque no se pudo acceder al Dashboard.

## Mensajes y diagnóstico del cliente

`js/app.js:multiplayerErrorMessage()` traduce códigos conocidos a mensajes separados. `logMultiplayerError()` registra fase, código Supabase y mensaje saneado en consola; elimina cadenas con aspecto de JWT. `connectOnlineRoom()` registra el fallo de creación/unión antes de restaurar el estado local. `joinRoom()` elimina espacios internos y normaliza el código antes de enviar la RPC.

## Interfaz aplicada desde las anotaciones

- `index.html` deja cinco accesos principales y un acceso de perfil en la barra persistente; tienen iconos con etiquetas accesibles y sin texto visible. El menú de hamburguesa conserva Cartas, Manuales y Ajustes.
- Inicio conserva la marca, bienvenida y dos acciones de icono para explorar juegos o unirse a partida. Se retiraron el juego destacado, actividad reciente y novedades.
- Juegos usa tarjetas verticales en dos columnas también en móvil. La tarjeta disponible abre al pulsar cualquier zona; las próximas no son botones. El candado ahora tiene contorno e indicador diagonal visibles.
- La selección Local/Online son dos tarjetas-botón sin botones anidados.
- Copiar sala es un control de dos cuadrados junto al código.
- El encabezado muestra solamente “ZEVYRA Games” sobre negro.
- `PLAYER_AVATARS` proporciona emojis para participantes locales y para el nickname multijugador. El avatar local se persiste en cada participante y el último avatar/nombre online queda en el almacenamiento local del navegador y en el perfil Supabase. El roster y turno muestran el emoji.

## Recursos de marca y PWA

`assets/brand/zevyra-emblem.png` es la fuente original. Las variantes ahora incluyen favicon SVG/ICO/16/32, apple-touch-icon 180, iconos 192/512 y pares maskable 192/512. Los SVG solo incrustan la referencia a la imagen raster; no simulan vectorizarla. `manifest.json` declara ZEVYRA Games y el Service Worker `zevyra-shell-1.6.1` incluye todos los archivos gráficos.

## Pendiente crítico: acciones de invitados

Los invitados siguen bloqueados por `canPlayOnlineGame()` y las RPC de guardado siguen siendo exclusivas del host. No existe aún una cola de comandos con validación de actor/turno/versión en servidor. No se modificaron reglas, RLS ni RPC de estado para conceder escrituras amplias. Esta fase no debe declararse completa hasta añadir una migración de acciones, conectarla con el motor y probar acciones concurrentes entre dos sesiones.

## Pruebas y límites

- Pendiente aplicar la migración 005 y confirmar desde Dashboard la función desplegada y el contenido de `rooms` para el código reportado.
- Pendiente crear sala y unirse desde dos identidades separadas, probar código con espacios/minúsculas, aforo, sala expirada/cerrada y recibir cambios Realtime.
- Pendiente probar UI en navegador. La recarga `file://` fue bloqueada y este entorno denegó el enlace del servidor a `0.0.0.0:8080` (`EPERM`).
- La validación automatizada de JavaScript/HTML y la suite se anotarán al finalizar la fase local.

## Ajustes visuales y de modalidad posteriores

- El acceso “Unirse a una partida” de Inicio abre ahora la vista Partida/modalidades, no el lobby directamente. Inicio ocupa la pantalla y genera una animación apilada con el catálogo entero; no presenta el texto “Bienvenido”.
- Las tarjetas Local y Online ya no llevan emojis decorativos. Al elegir Local, la app desconecta cualquier sala activa y restaura el respaldo local antes de cambiar de vista, evitando aplicar las restricciones online a las acciones locales.
- `renderPlayers()` inserta número, avatar, selector, nombre, turno y botón en una cuadrícula con seis columnas en escritorio y cinco en móvil (el turno se oculta en el ancho móvil). Así el botón Eliminar conserva su ancho y no crea desbordamiento horizontal.
- Después de estos ajustes, `npm test` y `node --check` de todos los módulos JavaScript y `sw.js` pasan; el documento HTML no contiene IDs duplicados. La interfaz aún no pudo inspeccionarse en el navegador por el bloqueo del servidor local.
