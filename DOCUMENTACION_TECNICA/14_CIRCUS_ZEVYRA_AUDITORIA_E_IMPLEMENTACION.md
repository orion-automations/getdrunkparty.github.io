# Circus Zevyra — auditoría de plataforma previa a Carnival

> **Documento histórico, reemplazado como estado actual.** Describe la versión 1.9.0 anterior a la integración de Carnival y contiene decisiones que ya cambiaron (por ejemplo, juego bloqueado y catálogos pendientes). Para el estado vigente de Carnival of Chaos, consultar [15 — Carnival of Chaos: estado actual e implementación](15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md).

**Estado documentado:** 2026-11-06 · **Versión declarada:** 1.9.0  
**Alcance:** fotografía histórica de la identidad y navegación de Circus Zevyra, biblioteca, apariencia, perfil, salas y guías antes de integrar Carnival. No sustituye el estado vigente del documento 15.

## Resumen del estado

- La interfaz de plataforma se llama **Circus Zevyra** y usa las portadas disponibles.
- La aplicación conserva el ID persistente `midnight-chaos` y los datos locales existentes. No se renombraron claves de almacenamiento ni tablas.
- El catálogo marca **Carnival of Chaos** y **The Impostor** como «En desarrollo». **Yo nunca nunca**, **Weekend Hearts** y **¿Quién es más probable que...?** se muestran como «Bloqueado» por falta de guía funcional o implementación suficiente.
- Las partidas desde la interfaz están deshabilitadas hasta integrar Carnival. Los datos y el motor anterior no se borraron ni se presentan como reglas terminadas de Carnival.
- Se implementaron navegación de cuatro iconos, carrusel táctil/teclado, ajustes de tema, avatar Big Smile, corrección del menú de cartas y nuevos recursos de marca/PWA.
- El reverso de las cartas dejó de superponer el emblema antiguo con una Z; ahora muestra un símbolo central por categoría, y el indicador de intensidad usa `mode_heat` sin modificar los valores de picante.
- Los tres documentos de Carnival revelan diferencias de mecánica con el motor actual. No se cambió ese motor ni se importaron cartas a su catálogo hasta modelar las seis categorías nuevas y sus efectos. El PDF de cartas se autorizó importar sin editar; queda pendiente integrarlo en el juego.
- Para online, el jugador activo controla la tirada y las interacciones de su turno. El anfitrión confirma el resultado. El cliente y la migración nueva 007 implementan esa separación; la migración todavía requiere aplicarse en el proyecto Supabase de despliegue.

## Inventario de guías y recursos revisados

| Juego / recurso | Encontrado | Evaluación de despliegue |
|---|---|---|
| Carnival of Chaos — guía funcional | `Guia de despliegue/01_CARNIVAL_OF_CHAOS/CARNIVAL OF CHAOS.pdf` (26 páginas) | Guía extensa, con reglas de turnos, seis categorías, cementerio, Jokers, eventos y Maldición Gitana. Contiene una distribución de dado que suma 172%; después se acordó adoptar la distribución válida 1/19/40/40 para una futura implementación. |
| Carnival of Chaos — cartas | `Guia de despliegue/01_CARNIVAL_OF_CHAOS/cartas/Carnival of Chaos Cards.pdf` (35 páginas) | Contiene categorías de juego y cadenas de Maldición Gitana. Se revisó el documento completo; el texto no se integró ni editó aún. |
| Carnival — portada | `Guia de despliegue/01_CARNIVAL_OF_CHAOS/Carnival_of_chaos_portada.png` | Copia de trabajo en `assets/games/carnival-of-chaos.png`; el archivo fuente se conserva. |
| Yo nunca nunca — portada | `Guia de despliegue/02_YO_NUNCA_NUNCA/yo_nunca_nunca_portada.png` | No hay guía funcional dentro de la carpeta; bloqueado. |
| Weekend Hearts — portada | `Guia de despliegue/03_WICKED_HEARTS/WICKED_HEARTS_Portada.png` | La portada está bajo carpeta/nombre Wicked Hearts; no hay guía funcional que respalde el nombre nuevo Weekend Hearts; bloqueado. Se conserva el ID `parejas-hot`. |
| ¿Quién es más probable? — portada | `Guia de despliegue/04_QUIEN_ES_MAS_PROBABLE/Quien_es_probable_portada.png` | No hay guía funcional; bloqueado. |
| The Impostor — guía y portada | `Guia de despliegue/05_EL_IMPOSTOR/Impostor.pdf` (40 páginas) y `Impostor_portada.png` | Existe una especificación, pero el juego no está implementado; en desarrollo. |
| Logotipos | `assets/icons/Nuevo_logo.png` y `assets/icons/nuevo_logo_modo_claro.png` | Copias de uso en `assets/branding/logo-dark.png` y `assets/branding/logo-light.png`; originales preservados. |

## Cambios implementados y trazabilidad

### Nombre visible e IDs

`js/config.js:1-3` declara versión 1.9.0, `GAME_NAME = "Carnival of Chaos"` y conserva `GAME_ID = "midnight-chaos"`. `tests/core.test.js:18-22` comprueba el nombre nuevo y la permanencia del ID. No se hicieron sustituciones globales. La configuración del manifiesto está en `manifest.json:2-12`.

**Flujo de presentación:** `index.html:48-69` muestra marca, barra del temporizador, navegación y menú; `js/app.js:685-696` cambia de vista, actualiza navegación y fragmento URL; `js/app.js:797-810` actualiza título, disponibilidad y vistas.

### Inicio, carrusel y catálogo

El marcado está en `index.html:71-105`: encabezado central, botones accesibles de navegación, región del carrusel y lista de juegos. `js/games-catalog.js:1-56` define nombres visibles, estado, descripción, portada y acceso. Los IDs internos permanecen. `js/app.js:698-740` construye las tarjetas de catálogo y limita el acceso a juegos disponibles; `js/app.js:741-780` dibuja y centra la portada activa; `js/app.js:2038-2078` conecta los botones, gesto horizontal, teclado y selección. El botón PLAY solo se activa cuando el catálogo marca el juego disponible.

Las imágenes de trabajo están en `assets/games/`. Las fuentes originales siguen dentro de `Guia de despliegue/`.

### Navegación y ajustes

`index.html:58-69` declara los cuatro destinos principales (Inicio/Juegos/Partida/Participantes) con Material Symbols y conserva Perfil, Online, Cartas, Manuales y Ajustes en el menú superior. `index.html:367-383` agrupa accesos de ajustes y control de apariencia; las opciones reutilizan las vistas existentes en vez de duplicar sus formularios. `js/app.js:1961-1991` conecta navegación y menú; `js/app.js:2063` aplica el cambio de tema. `css/platform.css:253-347` define carrusel, accesos, distribución móvil y variables/ajustes visuales del modo claro.

La preferencia se guarda como `zevyra.appearance` en `localStorage`; los valores admitidos son `system`, `dark` y `light`. Sistema deriva la apariencia de `prefers-color-scheme`. La marca elige el archivo oscuro o claro en `js/app.js:782-789`; el ajuste vive en `js/app.js:2079-2090`. El tratamiento de superficies del tema claro está en `css/platform.css:297-349`.

### Perfil y avatar

El perfil aparece en `index.html:91-101`. `js/app.js:143-154` genera URL segura de DiceBear Big Smile desde una semilla codificada y renderiza como imagen únicamente esa URL oficial; las demás identidades locales siguen siendo emojis. `js/app.js:426-470` conserva nickname y selección online en almacenamiento local; `js/app.js:2022-2037` permite cambiar la semilla, actualiza la vista y sincroniza el avatar si existe una sala activa. `js/multiplayer-auth.js:18-27` mantiene el avatar en el campo existente del perfil, sin migración de esquema. La lista online convierte URL de avatar en `<img>` en `js/app.js:143-154` y `js/app.js:241-253`.

La imagen Big Smile se sirve desde `https://api.dicebear.com/10.x/big-smile/svg`; su API permite usar URL directa y una semilla estable. El perfil necesita red para cargar la imagen remota. La guía no agrega cuenta recuperable ni datos de autenticación.

### Editor de cartas

`js/app.js:1747-1805` renderiza las cartas incluidas en el editor, el estado activo/inactivo y las acciones. El menú abre una sola instancia y refleja `aria-expanded` (`js/app.js:1780-1787`); Activar/Desactivar actualiza el dato, persiste y vuelve a renderizar (`js/app.js:1800-1805`). `js/decks.js:2-7` filtra las cartas por `enabled`, por lo que una carta desactivada no se extrae.

`css/styles.css:679-748` define tarjeta, menú superior derecho y reverso minimalista. `js/app.js:1457-1468` asigna el símbolo por categoría; `js/app.js:1490-1502` muestra intensidad con Material Symbol `mode_heat` y conserva `spiceLevel`. El cierre por clic exterior y Escape está en `js/app.js:2080-2089`.

### Carnival: disponibilidad y diferencias actuales

El registro Carnival no se habilita en `js/games-catalog.js:2-11`. El control modal también deshabilita ambas modalidades mientras el juego no esté disponible (`js/app.js:798-805`); la biblioteca y el botón del carrusel respetan el mismo estado. Esto evita presentar las cartas de Midnight Chaos como si fueran las cartas Carnival.

El motor aún usa las categorías VERDAD/DESAFÍO/MINIJUEGO y auxiliares PREMIO/CASTIGO (`js/config.js:4-11`, `js/dice.js:1-58`, `js/game.js:12-17`). Las cartas heredadas están en `data/initial-cards.js` y `data/midnight-catalog.js`; las categorías de Carnival son Pecados, Sacrificio, Caos Absoluto, Jokers, El Gran Circo y Maldición Gitana. Por ello, cambiar solo el peso del dado produciría resultados sin cartas/reglas compatibles y no se hizo.

**Decisiones confirmadas por el usuario para la futura integración:** eventos cada cinco turnos individuales; distribución válida 1% Maldición Gitana, 19% Caos Absoluto, 40% Pecados y 40% Sacrificio; importar el texto original del PDF de cartas sin editar; anfitrión confirma el resultado online. Todavía faltan el adaptador de categorías, cartas y efectos Carnival, cementerios/reciclaje, Jokers, fragmentos y cadenas. No se afirma que Carnival ya sea jugable.

### Turnos online y Supabase

`js/app.js:85-119` separa las acciones del jugador activo del control del anfitrión y marca una confirmación autorizada para persistencia. El jugador activo conserva los controles de tirar dado y seleccionar carta; la confirmación/cierre requiere host (`js/app.js:1020-1055`, `js/app.js:2287-2330`).

La política server-side de la migración 006 solo aceptaba al jugador activo. La nueva migración `supabase/sql/007_host_confirms_turns.sql` conserva la versión esperada, el bloqueo de sala/estado, la verificación de roster y de transición de turno, y permite el rol host en la mutación del snapshot. Las migraciones 001–006 no fueron modificadas. La interfaz habilita la confirmación al anfitrión en `js/app.js:1046-1050`; `js/app.js:2294-2333` valida el rol y persiste resolución/cierre. Hay que ejecutar 007 después de 006 en el Dashboard de Supabase antes de probar la nueva autoridad; este turno no aplicó SQL en el proyecto remoto. Orden y comprobaciones: `supabase/README.md`.

**Recorrido:** `index.html` (controles de sala) → `js/app.js` (actor, host y snapshot) → `js/multiplayer.js` → `js/multiplayer-rooms.js` / RPC `gdp_act_turn` → `supabase/sql/007_host_confirms_turns.sql` → `game_states` y Realtime existente. Las salas/suscripciones y migraciones 001–006 se preservan.

### PWA e identidad visual

`manifest.json:2-34` declara Circus Zevyra y los iconos de plataforma. Los iconos PNG/PWA de `assets/icons/` se volvieron a generar desde `assets/branding/logo-dark.png`, sin deformar la proporción; `favicon.svg`/`icon.svg` apuntan a la variante oscura. `sw.js:1-58` incrementa caché a `zevyra-shell-1.9.0` e incluye logo, portadas e iconos. Los archivos antiguos de marca permanecen como fuentes históricas, pero la cabecera y el PWA usan los logos nuevos.

## Validación realizada y límites

- `node --check js/app.js`, `js/games-catalog.js`, `js/config.js` y `sw.js`: correctos.
- `npm test`: pasó. El archivo de lógica contiene 38 subpruebas; se actualizó la expectativa de identidad visible. El conjunto sigue probando el motor heredado, no la equivalencia funcional con las reglas Carnival.
- `file` comprobó tamaños de iconos 192×192, 512×512, Apple Touch 180×180 y favicon ICO 16/32.
- El acceso visual a `http://localhost:8080/` no se pudo verificar: el proceso local terminó con `listen EPERM` en el puerto 8080. No se afirma que el carrusel, tema, avatar remoto o menú hayan pasado prueba visual.
- No se probó Supabase conectado con dos usuarios ni se aplicó la migración 007 al proyecto remoto.
- No se modificaron los textos de cartas existentes ni las migraciones 001–006.

## Próximas tareas para terminar Carnival

1. Integrar la transcripción completa de las cartas PDF sin editar, separada por las seis categorías y fragmentos.
2. Implementar un motor Carnival específico que represente cada regla sin reutilizar semántica incorrecta de las categorías heredadas.
3. Implementar dado de seis caras y pesos acordados, mazos/cementerios, reutilización y cartas imposibles.
4. Implementar eventos por cinco turnos, Jokers, Maldición Gitana, fragmentos y resolución de cadenas con persistencia local y online.
5. Aplicar y verificar SQL 007 en Supabase; probar jugador activo, host y observadores en dos dispositivos.
6. Ejecutar pruebas visuales en móvil para carrusel/tema/menú/avatar, además de pruebas online/offline y accesibilidad antes de declarar disponible.

