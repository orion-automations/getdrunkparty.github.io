# Historial de modificaciones

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
