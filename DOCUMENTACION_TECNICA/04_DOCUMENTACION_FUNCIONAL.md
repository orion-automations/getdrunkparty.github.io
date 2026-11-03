# Documentación funcional

## Partida y turnos

**Recorrido:** `index.html:99-194 → js/app.js:75-269,970-1119 → js/game.js:53-517 → dice.js/decks.js/participants.js → storage.js`.

1. Si no hay participantes activos, el render ofrece el estado vacío. El formulario de participantes agrega `{id,name,active,preferences}` y guarda (`app.js:1122-1136`).
2. El modo digital invoca `engine.rollDigital()`. El motor selecciona cara con `rollDice`, inicia turno bloqueado en fase ROLLING y devuelve cara; UI anima cubo por 4 s y completa roll (`game.js:126-150`; `app.js:1040-1089`). La suma agrupada es 35% verdad, 35% desafío, 15% minijuego, 15% bloqueada (`dice.js:3-85`).
3. Para cara principal, la app ofrece mazo de categoría. `drawCategory()` llama motor `draw()`, que crea turno si no existe, y roba con `attachCard`; un mazo vacío notifica y permite cancelar/gestionar. BLOQUEADA no roba (`app.js:982-1007`; `game.js:294-374`).
4. La carta presenta título, descripción, destinatarios, penalización y manual. Targets salen de participantes activos; PLAYER_PAIR devuelve vacío hasta selección voluntaria (`participants.js:4-30`).
5. Se registra resultado; solo terminar explícitamente avanza participante circularmente y graba historial (`app.js:1091-1119`; `game.js:376-497`). Cancelar libera turno y retrocede índice de mazo para cartas involucradas (`game.js:503-516`).

## Resultado y cartas auxiliares

En verdad/desafío puede seleccionarse un mazo PREMIO o CASTIGO; el motor restringe una selección auxiliar en turno normal y conserva separada la primaria (`game.js:294-374`). Los efectos explícitos de carta (`DRAW_AUXILIARY`, `GRANT_REWARD`) activan acciones sin inferir texto (`storage.js:248-274`; `game.js:376-498`). Los premios completados quedan en lista de ventajas/recompensas; UI permite marcarlos usados (`app.js:547-577`).

## Minijuegos

**Recorrido:** carta `MINIJUEGO` → manual opcional → selección de participantes → resultado WIN/LOSS/NEUTRAL por persona → `validateMinigameOutcomes()` → reglas del manual → cola de selecciones → cartas auxiliares → terminar.

`renderMinigameFlow()` controla etapas DOM (`app.js:270-475`). La validación requiere una salida única por participante y estado permitido (`minigame-results.js:94-117`). Reglas validadas aceptan when WIN/LOSS/ANY, categoría premio/castigo, destinatarios y exactamente uno de `cardsPerRecipient`/`totalCards` (`minigame-results.js:5-43`). El motor construye la cola (`game.js:185-250` vía `buildMinigameSelectionQueue`), permite asignar destinatario elegible y dibuja consecuencias (`game.js:252-293`). No hay determinación automática de ganadores. Con reglas vacías se puede terminar tras registrar resultado.

## Participantes

Formulario crea participante; lista permite activar/desactivar, modificar y eliminar con confirmación (`app.js:579-607,1122-1136`). La orientación invertida es un ajuste persistente; `assignTargets` interpreta siguiente/anterior e izquierda/derecha con el booleano `positionReversed` (`app.js:1137-1140`; `participants.js:4-30`). No se asigna pareja aleatoria.

## Catálogo de cartas

Editor permite alta/edición, categoría, título, intensidad, descripción, efectos, asignación, cantidad, manual, glifo, penalización y habilitación (`app.js:608-724`). Validación en `storage.js:180-246`. Lista ofrece búsqueda/filtro, duplicar, desactivar/reactivar y eliminar (`app.js:725-784`). El sorteo filtra `enabled`; mantiene ciclos por categoría y persistencia en estado (`decks.js:2-37`). Importación JSON agrega un lote validado; cualquier ID repetido cancela; exportación genera JSON descargable (`app.js:1165-1185`; `storage.js:277-295`).

## Manuales

Los manuales asociados se buscan por `findManual()` (`manuals.js:1-3`), se muestran en diálogo y se editan en `app.js:797-923`. Nuevos manuales se crean desde UI; `details.consequenceRules` se valida antes de guardar (`app.js:871-910`). No se deducen consecuencias automáticamente del texto.

## Bebidas / Shots

`addDrink()` limpia nombre y rechaza vacío o duplicado sin distinguir mayúsculas (`drinks.js:1-18`). Ajustes permiten editar nombre/unidad, habilitar y borrar solo si ninguna carta referencia esa bebida (`app.js:924-959`). Las penalizaciones son metadatos mostrados desde carta; el sistema no ejecuta consumo físico.

## Respaldo y reinicio

Exportación completa descarga estado actual; importación exige estructura básica, valida cartas y sustituye estado (`app.js:1184-1210`). Reiniciar partida borra turno/historial/recompensas/progreso de mazos pero conserva participantes, cartas, manuales y ajustes; restaurar instalación reemplaza con `seedState()` (`app.js:1223-1268`).

## PWA

La instalación depende de soporte del navegador y contexto seguro/localhost. Registro SW informa estado de almacenamiento y el botón de instalación usa `beforeinstallprompt` cuando el navegador lo expone; en otro caso muestra instrucciones (`app.js:1281-1306`). Offline es best-effort red primero con caché como fallback (`sw.js:56-78`).

## Actualización fase 1

El dado se puede repetir antes de revelar mazo; una carta activa puede sustituirse por otra del mismo mazo. Los minijuegos comienzan con “Sin consecuencia”. Los desafíos finalizan turno al registrar resultado. El temporizador sigue activo entre vistas y las cartas pueden declarar una duración opcional.

La acción está en el cubo: al tocarlo sin turno lanza; antes de revelar vuelve a tirar; con una carta principal de VERDAD, DESAFÍO o MINIJUEGO extrae otra del mismo mazo. Premio y castigo no tienen acción de repetición. La cara BLOQUEADA puede repetirse antes de finalizar el turno. La carta principal y las auxiliares extraídas aparecen en un slider superpuesto sin barra horizontal; la carta más cercana al centro se resalta y la última extracción se centra automáticamente.

El temporizador aparece también como cuenta compacta en la cabecera del turno. El diálogo incluye anillo de progreso, lectura de siete segmentos, selectores de horas/minutos/segundos, presets uniformes e iniciar/pausar/reiniciar; la X cierra el diálogo. Su cronometraje sigue basado en una marca de tiempo, incluso al cambiar de sección.

## Multijugador online

Desde **Participantes → Multijugador**, el jugador indica un nombre y crea una sala (2–30 plazas) o introduce un código para unirse. Supabase crea/reutiliza identidad anónima y perfil; al unirse el roster aparece en el panel. El anfitrión inicia cuando hay dos personas. La sesión online comienza separada de los datos locales y salir restaura participantes, motor y temporizador previos (`js/app.js:117-148,234-307`).

Durante la partida el host tira el dado, extrae/gestiona cartas, marca resultados y controla el temporizador. Los demás ven el snapshot actualizado y no pueden ejecutar esas acciones. El host puede cerrar la sala; al salir la autoridad pasa al miembro que lleva más tiempo en ella. Un miembro puede reclamar el control si el heartbeat del host está vencido (>90 s). No hay avatar picker en la app, por lo que el campo queda vacío por defecto.

El recorrido de conexión es `index.html:14-19,224-246 → js/app.js:243-340 → js/multiplayer.js:4-136 → auth/rooms/sync → js/supabase.js → Supabase`. El juego y temporizador se guardan en `game_states`; roster y roles se leen desde `room_players`; políticas `002` limitan lectura y RPCs `003` realizan mutaciones. Para ejecutar y verificar, sigue `supabase/README.md`; la integración online no se debe considerar probada hasta usar dos identidades de navegador y observar la actualización real.
