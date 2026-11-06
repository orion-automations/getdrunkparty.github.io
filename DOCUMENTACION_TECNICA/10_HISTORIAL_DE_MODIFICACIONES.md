# Historial de modificaciones

## 2026-11-06 — Circus Zevyra, auditoría de despliegue e interfaz 1.9.0

- Se actualizó la identidad visible a Circus Zevyra/Carnival of Chaos, conservando el ID `midnight-chaos` y sus datos históricos.
- Se añadieron las portadas que estaban en `Guia de despliegue/`, estados honestos de catálogo, carrusel gestual, navegación móvil de cuatro iconos, ajustes de tema y perfil Big Smile.
- Se corrigió la posición y cierre del menú de acciones de cartas. Las cartas desactivadas continúan fuera de las extracciones.
- Se preparó `supabase/sql/007_host_confirms_turns.sql`; no se aplicó en el proyecto remoto. Requiere ejecutarse después de 006 antes de probar turnos Carnival online.
- Se revisaron los tres PDFs disponibles. Carnival no está habilitado: el motor y las cartas heredadas no implementan sus categorías/efectos. Las decisiones de eventos, probabilidades, importación literal y rol del anfitrión quedaron registradas en [14](14_CIRCUS_ZEVYRA_AUDITORIA_E_IMPLEMENTACION.md).
- Verificación: `node --check` en los módulos editados y `npm test` (38 aprobadas); el servidor visual y Supabase online no se validaron en este entorno.

## 2026-11-02 — Fase 1 local/offline

### Archivos afectados

- `index.html`, `css/styles.css`, `js/app.js`, `js/game.js`, `js/storage.js`, `tests/core.test.js`.

### Cambios realizados

- Se sustituyeron las acciones visibles de cada carta del editor por un menú contextual de tres puntos con editar, duplicar, activar/desactivar y eliminar con confirmación.
- Se añadió `gameEngine.rerollDigital()` para repetir un dado digital antes de revelar carta y `gameEngine.redraw(cardId)` para sustituir una carta activa por otra del mismo mazo, respetando el ciclo existente.
- Los minijuegos muestran inicialmente `Sin consecuencia`; esa opción se registra como `NEUTRAL` sin obligar a modificar cada participante.
- Las cartas de premio/castigo extraídas se muestran junto con la carta principal en un único slider horizontal.
- Se incorporó un temporizador local independiente con ajustes manuales, tiempos rápidos de 10 segundos a 7 minutos, pausa/reanudación, sonido Web Audio y cálculo por marca de tiempo.
- Se añadió `durationSeconds` opcional a cartas nuevas/editadas, validado entre 1 y 3600; una carta con duración permite abrir el temporizador con ese valor.
- El nombre de participantes se persiste al cambiar o salir del campo. La nueva partida archiva hasta diez historiales anteriores en `game.archives` y reinicia el juego activo.
- Los desafíos se resuelven y finalizan automáticamente al elegir resultado. El botón de pasar fue eliminado de ese flujo.
- La edición de manuales usa ahora un formulario completo y cancelable para título, resumen, instrucciones, notas y detalles JSON.

### Pruebas ejecutadas

- `npm test`: correcto, incluyendo pruebas nuevas de repetición de dado y sustitución de carta.
- `node --check js/app.js`, `node --check js/game.js`, `node --check js/storage.js`: correcto.

### Revisión de cartas pendiente de contenido

No se modificó el contenido creativo. Requieren revisión humana por material, consentimiento, ambigüedad o repetición temática: desafíos adicionales `DESAFIO_PDF_103` a `DESAFIO_PDF_142` (hielo/antifaz), `DESAFIO_PDF_143` a `DESAFIO_PDF_169` (poses), y cartas del PDF localizadas por texto en `data/pdf-catalog.js` alrededor de líneas 3393, 3440, 3844, 3868, 4202, 4274, 4538, 4634, 4778, 4874, 5968, 5991 y manuales 7312–7725. Las duraciones se pueden cargar en el editor sin afectar las cartas existentes.

### Problemas conocidos

- No se realizó prueba visual automatizada ni prueba de audio en navegador real; el sonido depende del gesto del usuario y soporte de Web Audio.
- El slider solo presenta cartas extraídas en el turno; no muestra cartas disponibles del mazo.

## 2026-11-02 — Ajuste de interacción solicitado

- La carta principal y las cartas auxiliares extraídas comparten `#turn-cards`; deslizar centra cada tarjeta mediante `scroll-snap`.
- Se eliminó el bloque duplicado “Cartas extraídas” y los botones “Otra carta”.
- El cubo es el control de acción: sin turno tira; antes de revelar carta vuelve a tirar; con carta principal VERDAD/DESAFÍO/MINIJUEGO reemplaza por otra del mismo mazo. No repite cartas PREMIO/CASTIGO.
- El motor también rechaza reemplazar una carta auxiliar aunque se invoque fuera de la interfaz, y deja repetir una cara BLOQUEADA antes de cerrar el turno.
- El botón independiente “LANZAR DADO” ya no aparece.
- Verificación: `npm test`, `node --check js/app.js` y `node --check js/game.js` finalizaron correctamente. En navegador se confirmó que el premio extraído queda centrado, el desafío permanece a un lado y la sección/botones redundantes ya no están en el DOM.
- Versión de la aplicación, paquete y caché PWA actualizada de 1.4.4 a 1.4.5.

## 2026-11-02 — Slider superpuesto

- Las tarjetas del slider se superponen con escala reducida y menos brillo en los lados; la carta más cercana al centro recibe `is-active` y se muestra completa encima.
- El desplazamiento táctil/trackpad conserva `scroll-snap` para centrar la tarjeta elegida. Se oculta la barra de desplazamiento en Chromium y Firefox.
- Se respeta `prefers-reduced-motion`.
- La suite de motor y la comprobación de sintaxis continúan pasando. La vista visual interactiva no pudo abrirse en esta sesión porque el control de navegador está deshabilitado en Work settings.

## 2026-11-02 — Temporizador circular y controles

- Se muestra una cápsula con cuenta regresiva y progreso en la cabecera de la partida, aun cuando el diálogo del temporizador está cerrado.
- El diálogo presenta anillo circular decreciente y dígitos de siete segmentos. Horas, minutos y segundos se ajustan con selectores; los presets comparten una cuadrícula de botones iguales.
- Se reemplazaron los botones textuales por iniciar, pausar y reiniciar con iconos; cerrar ahora es una X arriba a la derecha. El sonido de prueba queda como control de icono.
- El temporizador usa tiempo de finalización (`Date.now()`); al pausar conserva restante y al reiniciar restaura la duración seleccionada.
- La versión de app/paquete/caché pasa a 1.4.6.
- Verificación: `node --check js/app.js` y `npm test` pasan. La automatización de navegador está deshabilitada por configuración Work, así que no fue posible validar visualmente los controles en esta iteración.
- Multijugador, perfiles y Supabase pertenecen a fases posteriores y no están implementados en esta fase.

## 2026-11-02 — Posición del acceso al temporizador

- Se movió `#timer-inline` fuera de `.turn-line` y se posicionó en la esquina superior derecha del panel de juego; por ello ya no modifica el centrado del encabezado TURNO ACTUAL y participante.
- En móvil se redujeron el espacio y el anillo del acceso para conservar sitio en la esquina. La estructura está en `index.html` y las reglas en `css/dashboard-categories.css`.

## 2026-11-02 — Ajustes de interfaz móvil

- El menú de acciones de cada carta del editor queda anclado arriba a la derecha de la tarjeta, y el formulario del editor de manual se apila con campos de ancho completo en móvil (`css/styles.css`).
- El carrusel móvil superpone más las cartas laterales y centra la carta seleccionada midiendo su posición visual frente al centro del contenedor (`css/dice.css`, `js/app.js`).

## 2026-11-02 — Gestos para resultados de minijuego

- En la selección de participantes, deslizar a la derecha marca ganador/premio y a la izquierda perdedor/castigo; las flechas del teclado ofrecen el mismo control. El botón de registro conserva la validación del motor (`js/app.js`, `js/game.js`, `js/minigame-results.js`).
- Después de registrar, se quitó el resumen de nombres ganadores/perdedores. Los destinatarios de consecuencias configuradas y opcionales se eligen con el mismo gesto en sus filas, y luego se toca el mazo auxiliar correspondiente (`js/app.js`).
- Los textos de orientación solo aparecen antes del registro; la interacción táctil conserva el desplazamiento vertical (`index.html`, `css/dice.css`).

## 2026-11-02 — Temporizador y dado digital

- La cápsula del temporizador se trasladó desde el panel de partida a la cabecera y sustituye el icono pequeño. Su apertura sigue usando `#timer-inline` y `renderTimer()` en `js/app.js`; se eliminó el antiguo controlador `#timer-open`, que habría detenido la carga del resto de los eventos al no existir ya ese elemento.
- El dado conserva la orientación de la cara exacta sorteada, incluidas ambas caras de VERDAD y DESAFÍO. `startDigitalRoll()` inicia el estado de giro antes de renderizar, calcula varias vueltas 3D y finaliza en la cara que corresponde al resultado (`js/app.js`, `js/dice.js`, `css/dice.css`).
- Al elegir Cumplió o Toma Shot se cierra automáticamente un turno sin efectos auxiliares pendientes; por eso el botón Finalizar turno ya no aparece como segundo paso para ese flujo (`js/app.js: confirmResult`).
- Cuando el dado no puede actuar, ahora indica el motivo en vez de ignorar el toque. La versión visible, paquete y caché PWA se actualizaron a `1.4.7`.

## 2026-11-02 — Estilo uniforme de acciones de turno

- Los botones Cumplió, Cumplió el desafío, Cumplió el castigo, Toma Shot y Finalizar turno usan el mismo estilo neutro base, sin acento verde, rosado o morado. Se quitó también el diseño móvil que agrandaba el botón primario (`index.html`, `css/styles.css`).
- La versión visible, paquete y caché PWA se actualizaron a `1.4.8`.

## 2026-11-02 — Multijugador online con Supabase

- Se añadió el SDK Supabase v2 como script `async` en `index.html` y un panel de crear/unirse a sala en la vista Participantes. El cliente se inicializa solo cuando se intenta conectar (`js/supabase.js`, `js/multiplayer.js`).
- Se implementaron Auth anónimo/perfil, RPCs de sala, lecturas del roster/estado y sincronización Postgres Changes + Presence (`js/multiplayer-auth.js`, `js/multiplayer-rooms.js`, `js/multiplayer-sync.js`). El host mantiene autoridad exclusiva sobre las mutaciones del juego; clientes invitados observan estado sincronizado.
- Se mantuvo aislado el estado local: al entrar se guarda una referencia al estado/motor local y se crea el contexto online; al salir se restaura. Snapshots incluyen participantes, ajustes, partida y cartas/manuales usados (`js/app.js:51-89,117-148,174-214`).
- Se añadieron tablas, políticas RLS, funciones SQL transaccionales y publicación Realtime en `supabase/sql/001`–`004`; guía de instalación en `supabase/README.md`.
- La integración requiere que el operador habilite Anonymous Sign-Ins y ejecute los cuatro scripts en Dashboard. No se han ejecutado esos cambios externos ni se ha completado prueba de dos dispositivos; por eso queda pendiente la aceptación online.
- La versión visible, paquete y caché PWA pasan a `1.5.0`. Se revisó sintaxis JavaScript; las pruebas automatizadas y el navegador se documentan según su resultado real al finalizar esta fase.

## 2026-11-02 — Plataforma ZEVYRA Games, fase 1

- Se incorporaron vistas Inicio y Juegos, catálogo desde `js/games-catalog.js`, selector de modalidad y acceso al lobby ya conectado a Supabase (`index.html`, `js/app.js`).
- Se instaló como logo el emblema proporcionado por el usuario y se regeneraron los tamaños PNG; `manifest.json`, `index.html` y `sw.js` apuntan a la identidad ZEVYRA.
- La versión declarada y caché del shell pasan a 1.6.0.
- `npm test` pasó (1 suite); `node --check js/app.js` pasó. El navegador no pudo recargar la ruta `file://` y el entorno bloqueó el servidor local.
- Sigue pendiente habilitar acciones de invitados mediante RPC validada y probar Supabase/Realtime entre dispositivos. Ver [`11_FASE_1_ZEVYRA_GAMES.md`](11_FASE_1_ZEVYRA_GAMES.md).

## 2026-11-02 — Fase 1.1: interfaz, perfiles emoji y diagnóstico de salas

- La barra persistente pasó a Inicio, Juegos, Partida, Jugadores, Multijugador y Perfil como iconos accesibles; el menú conserva Cartas, Manuales y Ajustes. Inicio se simplificó y catálogo/selector pasan a tarjetas seleccionables con comportamiento descrito en `12_FASE_1_1_AUDITORIA_Y_UI.md`.
- Se añadieron avatares emoji para jugadores locales y perfiles online, controles de copiar código junto al código, candado trazado y tamaños favicon/ICO/maskable. Manifest y shell PWA quedan en versión 1.6.1.
- La auditoría local encontró que 003 ya normaliza extremos, consulta en SECURITY DEFINER y serializa aforo. No pudo verificarse el despliegue Supabase; se preparó 005 para normalización amplia y errores distinguibles, sin modificar 001–004.
- Sigue pendiente aplicar 005, comprobar unión entre dos sesiones y construir acciones de invitados validadas en servidor. No se concede escritura directa ni se altera RLS.

## 2026-11-02 — Correcciones de flujo y pantalla Inicio

- Al cambiar a juego local se desconecta cualquier sala activa, se restaura el estado local respaldado y se limpia `onlineMode` antes de mostrar Partida; así los guardas online no bloquean una partida local (`js/app.js`).
- El acceso “Unirse a una partida” de Inicio ahora abre la selección de modalidad. Las tarjetas Local/Online ya no muestran emojis.
- Inicio ocupa el espacio disponible y anima tarjetas generadas desde `GAMES_CATALOG`, disponibles y próximas. Se quitó “Bienvenido”.
- La cuadrícula de participantes contempla avatar, selector emoji, nombre, turno y acción Eliminar para que el último control no se corte (`css/styles.css`).
- Verificación tras el ajuste: suite aprobada (1), sintaxis JS/SW aprobada e IDs HTML sin duplicar. No se pudo ejecutar inspección en navegador; servidor localhost sigue bloqueado por el entorno.

## 2026-11-02 — Fase 2: Midnight Chaos

- Nombre centralizado en `js/config.js` (`GAME_NAME`, `GAME_ID`) y aplicado al catálogo de juegos y título visible; `manifest.json` mantiene nombre neutral de plataforma.
- `data/midnight-catalog.js` establece 40 cartas originales y ocho manuales. La migración local 6 desactiva pero conserva cartas fuente anteriores, mantiene cartas personalizadas y añade contenido por ID sin sobreescritura. El editor sigue usando el mismo contrato.
- Se añadieron catálogos modulares de poderes, eventos y cadenas (`data/power-catalog.js`, `data/round-events.js`, `data/chain-challenges.js`) y cambios al motor (`js/game.js`) para inventario, poderes, eventos cada cinco turnos y cadenas finitas.
- `gameId` se guarda en estado local/remoto. La interfaz rechaza snapshots de otro juego; la migración 006 verifica el ID.
- Nuevas pruebas cubren catálogo, migración reversible, poderes, cadenas, contador de rondas e identidad. `npm test` pasa; falta revisión SQL en Supabase y prueba real de dos dispositivos después de aplicar 006.
- Versiones de aplicación/paquete/caché: 1.8.0. Consulte límites de motor validado en servidor y auditoría completa del catálogo en el documento 13.

## 2026-11-02 — Fase 2, turnos por jugador y perfil

- La UI calcula el dueño del turno con el ID autenticado y bloquea dado, categorías, selección de minijuego y resolución para el resto. Los mensajes indican quién debe jugar (`js/app.js`).
- La cara y hora del lanzamiento se guardan antes de animar; el snapshot dispara la misma cara en los dispositivos observadores (`js/app.js`, `js/game.js`).
- El participante activo guarda por `gdp_act_turn`, validada con bloqueo de filas y versión optimista. El host conserva el lobby y el temporizador; `gdp_save_shared_timer` no escribe el estado de juego. La migración 006 revoca el antiguo guardado completo a `authenticated`.
- Se añadió pantalla Perfil con SVG clásico, nickname local persistente y sincronización del perfil/roster en salas conectadas, conservando UUID e historial (`index.html`, `js/app.js`, `js/multiplayer.js`, `js/multiplayer-rooms.js`).
- El reverso de cartas ahora usa el emblema ZEVYRA en vez de GDP. Se bumpó la versión de app/caché a 1.7.0.
- `npm test` y `node --check` pasaron. Sin verificación SQL remota ni prueba actualizada de dos dispositivos; aplicar `supabase/sql/006_turn_actions_and_profile.sql` y seguir la prueba descrita en el documento 13.
