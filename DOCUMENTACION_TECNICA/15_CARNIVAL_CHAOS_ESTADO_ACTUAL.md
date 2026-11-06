# Carnival of Chaos — estado actual e implementación

**Actualizado:** 2026-11-06 · **Versión de aplicación:** 2.0.0 · **Estado:** integrado para pruebas locales.

Este documento es la referencia vigente. El informe 14 conserva la auditoría de Circus Zevyra previa a la integración de Carnival; los documentos 01–13 son antecedentes y pueden describir el juego anterior.

## Resumen verificable

- **Carnival of Chaos está disponible** en la biblioteca y usa el motor de turnos existente con categorías y catálogo de Carnival; conserva el identificador persistente `midnight-chaos` para mantener los datos locales y salas existentes. Esto integra Carnival sobre la arquitectura actual, no es una reescritura aislada de todo el motor.
- Se importaron **414 cartas** del catálogo fuente, con sus textos, y **24 manuales**. La migración añade IDs nuevos sin borrar cartas personalizadas y apaga por defecto las 48 cartas del evento Horrores.
- El dado de seis caras conserva la animación 3D y usa la distribución acordada: 1% Maldición, 19% Caos, 40% Pecados y 40% Sacrificio.
- El Gran Circo avanza cada cinco **turnos individuales**. El mazo de Horrores y la Ruleta del Destino sí cambian automáticamente; los demás eventos aparecen como reglas guiadas en pantalla.
- La portada de inicio se presenta en una tarjeta centrada con nombre y estado. Se cambia con gesto horizontal o con las flechas del teclado; no hay flechas de interfaz ni barra horizontal.
- El perfil muestra tarjeta de identidad, avatar circular editable y UID público de ocho caracteres. El editor usa DiceBear Big Smile; el UID local persiste en el navegador y el remoto se guarda en public.profiles.public_uid.
- La app contiene interfaz usuario/contraseña y la migración SQL local database/001_player_profiles.sql. **No se aplicó al proyecto Supabase remoto en esta tarea**; hasta entonces se muestra un UID derivado del Auth ID.

## Fuentes de Carnival

La guía de reglas está en `Guia de despliegue/01_CARNIVAL_OF_CHAOS/CARNIVAL OF CHAOS.pdf`; el PDF con las cartas está en `Guia de despliegue/01_CARNIVAL_OF_CHAOS/cartas/Carnival of Chaos Cards.pdf`. El catálogo de la app vive en `data/carnival-catalog.js`: textos de carta importados sin reescritura, con normalización de espacios propia de la extracción del PDF. La migración convierte esas entradas al modelo de la aplicación sin alterar la redacción de la carta.

La cuenta del catálogo se comprueba en `tests/core.test.js:25-32`: Pecados/VERDAD 115, Sacrificio/DESAFIO 127, Caos/MINIJUEGO 24, Maldición/MALDICION 78 (incluye 24 opciones de Ruleta del Destino), Joker bueno/PREMIO 35 y Joker malo/CASTIGO 35. Los 24 manuales se exportan junto a las cartas en el mismo módulo fuente.

Referencias de los PDF usados para esta integración:

:codex-file-citation{path="/home/orionzery/Documentos/Apps/Get Drunk Party/Guia de despliegue/01_CARNIVAL_OF_CHAOS/CARNIVAL OF CHAOS.pdf" purpose="source"}

:codex-file-citation{path="/home/orionzery/Documentos/Apps/Get Drunk Party/Guia de despliegue/01_CARNIVAL_OF_CHAOS/cartas/Carnival of Chaos Cards.pdf" purpose="source"}

## Flujos funcionales y archivos

### Inicio, biblioteca y selección de Carnival

`index.html:72-84 → js/app.js:877-908 → js/games-catalog.js:1-11 → assets/games/carnival-of-chaos.png`

`renderHomeGameStack()` toma el juego seleccionado de `GAMES_CATALOG`, crea la imagen de portada, el título y el estado, y actualiza el texto descriptivo y el control PLAY. `selectHomeGame()` cambia el índice circular. Los eventos de puntero implementan el gesto horizontal y las teclas izquierda/derecha en `js/app.js:2208-2226`. La caja que contiene la tarjeta usa `overflow: hidden` y `touch-action: pan-y` en `css/platform.css:263-271`; por eso el gesto horizontal no crea barra de desplazamiento.

`js/games-catalog.js:1-11` define Carnival como disponible (`available: true`, `route: "game"`). La biblioteca usa esos mismos datos al crear sus tarjetas en `js/app.js:834-875`; los otros juegos siguen bloqueados o en desarrollo hasta que cada uno tenga implementación propia.

### Catálogo, migración y partida

`data/carnival-catalog.js → data/initial-cards.js:1-5 / data/initial-manuals.js:1-3 → js/storage.js:1-17, 170-215 → js/app.js:1-18, 36-40 → js/game.js:1-18`

`INITIAL_CARDS` y `INITIAL_MANUALS` clonan el catálogo fuente. `seedState()` los usa al crear estado nuevo. En estado existente, la migración de catálogo versión 8 agrega IDs ausentes, conserva cartas del usuario y respeta una carta actualmente en turno; las cartas de colección `horrors` quedan desactivadas salvo cuando su evento está activo.

El juego usa IDs históricos de categoría para mantener compatibilidad: `VERDAD` representa Pecados, `DESAFIO` Sacrificio, `MINIJUEGO` Caos, `MALDICION` Maldición, `PREMIO` Joker bueno y `CASTIGO` Joker malo. `js/config.js:1-12` define las etiquetas visibles. `js/storage.js:240-262` acepta las seis categorías del catálogo. Las funciones `rollDigital()`, `drawMain()` y `completeRoll()` viven en `js/game.js:121-145` y el resto de la resolución del turno permanece en el mismo motor.

### Dado y probabilidades

`js/app.js:72-80 → js/dice.js:1-84 → js/game.js:134-144`

La interfaz crea una cara visual por cada elemento de `DICE_FACES`; `rollDice()` selecciona una cara ponderada y `rollDigital()` guarda el mismo ID/categoría en el turno, para que animación y mazo coincidan. Los pesos están verificados por `categoryProbabilities()` y por `tests/core.test.js:207-220`. Las seis caras usan las superficies `front`, `back`, `right`, `left`, `top` y `bottom`, sin reemplazar el cubo 3D.

### Eventos de El Gran Circo

`data/round-events.js:1-35 → js/game.js:677-740 → js/app.js:1206-1226`

`applyRoundProgress()` cuenta turnos individuales al completar cada turno; cada múltiplo de cinco activa el siguiente evento durante cinco turnos y registra el historial. El panel de partida muestra nombre, turnos restantes, descripción e historial. El orden cíclico de 22 eventos está en `data/round-events.js`.

En esta versión tienen efecto automático tres eventos: **Circo Borracho** duplica la cantidad de shots para las cartas de Pecados/Sacrificio que ofrecen esa alternativa (`js/app.js:1168-1174`); **El Circo de los Horrores** habilita sus cartas y deshabilita los mazos regulares durante el evento; **Circo el Destino** activa solo las opciones `CC_DESTINO_` y hace que el dado elija Maldición (`js/game.js:134-144, 718-740`). Al cerrar esos eventos se recuperan las habilitaciones y el estado de mazos anteriores.

Los otros 19 eventos muestran instrucciones para que el grupo las aplique. Aunque el motor contiene utilidades heredadas para invertir turnos y conceder poderes, esas utilidades no se enlazan a eventos de este catálogo. Por tanto, no se debe presentar aún como automatización completa de todos los efectos de la guía.

### Carrusel de portadas

`index.html:77-80 → js/app.js:1028-1068, 2416-2433 → css/platform.css:263-270, 291-294`

`renderHomeGameStack()` toma el juego seleccionado de `GAMES_CATALOG`, crea un marco de imagen `.home-game-cover` y coloca dentro la portada junto al título y estado; después actualiza la descripción y el control PLAY. El marco usa el tamaño fijo de la fila de la tarjeta, `overflow: hidden` y bordes redondeados; la imagen ocupa el marco con `object-fit: cover` sin deformarse. `selectHomeGame()` cambia el índice circular. Los eventos de puntero permiten deslizar la portada y las teclas izquierda/derecha cambian el juego. La caja usa `touch-action: pan-y` y recorta el contenido para no mostrar scrollbar. La portada de Carnival proviene de la carpeta local.
### Temporizador en tema claro

`index.html:573-590 → js/app.js:695-779, 2272-2285 → css/platform.css:329-341`

El diálogo contiene la esfera de progreso, selectores de horas/minutos/segundos, presets y controles de iniciar/pausar/reiniciar. El CSS bajo `:root[data-theme="light"]` cambia fondo, anillo, dígitos, presets y controles a superficies claras. El anillo y el contador del header comparten el progreso del mismo temporizador. El contador permanece visible en el header en todas las vistas.

### Perfil, avatares y UID

`index.html:89-115, 580-595 → js/app.js:66-72, 159-211, 225-288, 931-984, 2344-2389 → js/multiplayer.js:61-71, 198-205 → js/multiplayer-auth.js:58-89 → database/001_player_profiles.sql:5-77`

La tarjeta de identidad coloca el avatar circular con lápiz sobre un banner y muestra nickname más UID público de ocho caracteres. `localProfileUid()` genera un código local; `refreshProfileIdentity()` lee `public_uid` remoto y, antes de ejecutar la migración, deriva el código visible de ocho caracteres alfanuméricos del ID de Auth. El UUID completo solo se usa internamente.

Al abrir el editor, `fetchAvatarEditorOptions()` consulta las opciones oficiales de `big-smile/options.json` y construye controles para ojos, boca, cabello, tono de piel, accesorios y colores. La vista previa arma el URL Big Smile con la misma semilla. Guardar conserva opciones y URL, actualiza avatares locales y sincroniza con `saveConnectedProfile()` dentro de una sala o `saveUserProfile()` fuera de ella. Referencias: [estilo Big Smile](https://www.dicebear.com/styles/big-smile/) y [HTTP API de DiceBear](https://www.dicebear.com/how-to-use/http-api).

La interfaz de usuario/contraseña usa Supabase Auth. El recorrido es `index.html:106-113 → js/app.js:670-696 → js/multiplayer.js:46-71 → js/multiplayer-auth.js:3-29, 58-89 → Supabase Auth`. `database/001_player_profiles.sql` agrega `public_uid`, `banner_color` y políticas RLS. La tabla pública no guarda contraseñas. Como Auth usa email/teléfono como identificador, el cliente deriva un email sintético `usuario@accounts.zevyra.invalid`; la configuración requiere apagar la confirmación de email y no dispone de recuperación por correo. Véase `supabase/README.md:9-15`. La migración se creó en el proyecto pero aún debe ejecutarse en Dashboard para que el UID público quede persistido.
### Ejecución local y PWA

`package.json:1-9 → server.mjs:1-41 → index.html:618 → js/app.js`

El servidor local sirve los módulos como recursos HTTP. Para probar, ejecuta `npm run serve` desde la carpeta raíz y abre `http://localhost:8080`. La ruta `file://.../index.html` no es compatible con los módulos ES de este proyecto; la captura del usuario corresponde a esa ruta y por eso no prueba el carrusel actualizado. El service worker precarga ahora `data/carnival-catalog.js` con la versión de caché `zevyra-shell-2.0.1` (`sw.js:1-59`).

## Base de datos y despliegue

El SDK y la configuración cliente están en `index.html:14-20` y `js/supabase.js`; el SQL fuente está en `supabase/sql/001_multiplayer_schema.sql` y migraciones posteriores. La interfaz de perfil no necesita una clave `service_role`; el cliente solo debe usar la clave pública `anon`. No ejecuté SQL en el proyecto remoto ni consulté su Dashboard, por lo que la existencia/aplicación de tablas, políticas RLS, migración 007 y ajustes de Auth debe comprobarse en Supabase.

Supabase ofrece Postgres en su plan gratuito con límites de almacenamiento, proyectos y pausa por inactividad; esos límites pueden variar y se deben comprobar en la [página oficial de precios](https://supabase.com/pricing). La guía local de ejecución, SQL y ajustes de usuario está en `supabase/README.md`.

## Pruebas ejecutadas y límites

- `npm test`: pasa.
- `node --check` para los módulos JavaScript principales: pasa.
- La suite cubre IDs/cantidades del catálogo, compatibilidad de migración, tirada ponderada, eventos Horrores/Destino y restauración de mazos. Los escenarios están en `tests/core.test.js`.
- No se pudo inspeccionar el render final en el navegador integrado de esta sesión. La confirmación visual del gesto, la portada, el tema claro y el flujo de Auth requiere abrir la URL local y probar en móvil.
- Las interacciones de sala dependen de que el proyecto remoto ya tenga sus tablas, RPC, RLS y Realtime aplicados. La configuración del cliente no prueba por sí sola el estado remoto.
