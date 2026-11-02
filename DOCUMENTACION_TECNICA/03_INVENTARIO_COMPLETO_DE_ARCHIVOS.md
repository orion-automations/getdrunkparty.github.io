# Inventario de archivos propios

Las líneas apuntan a los archivos del proyecto (números verificados con `nl -ba`/lectura directa durante la auditoría). “Consumido por” identifica referencias estáticas o uso observable; en archivos estáticos se refiere al documento/configuración que los enlaza. Los PDFs e imágenes son recursos binarios, por lo que no se atribuyen funciones ni líneas.

## Raíz

| Archivo | Función, relaciones y estado |
|---|---|
| `index.html` (1-476) | Documento de entrada, DOM de Partida/Participantes/Cartas/Manuales/Ajustes y diálogos. Enlaza `manifest.json`, 4 CSS y `js/app.js` (`14-31,474`). Datos de formulario entran por DOM; app escribe resultados en esos nodos. Activo y central. |
| `package.json` (1-13) | Metadatos, módulo ES, scripts `test` y `serve`; sin dependencias. Consumido por npm. |
| `README.md` (todo) | Guía de uso/edición y afirmaciones de catálogo/versiones; documento informativo, no importado en runtime. |
| `manifest.json` (1-27) | Identidad PWA, scope, orientación e iconos; enlazado por `index.html:14`, consumido por navegador/service worker. |
| `server.mjs` (1-40) | Servidor HTTP local, lee archivos de raíz y asigna MIME; ejecutado por `npm run serve`. No persiste estado. |
| `sw.js` (1-79) | Ciclo install/activate/fetch, caché shell y fallback offline; registrado por `app.js:1297`. |
| `Cartas Get Drunk Party.pdf` | Fuente documental de cartas según README; no se carga en runtime. Binario, contenido no auditado en detalle. |
| `Get Drunk Party Web.pdf` | Documento PDF presente; no referenciado por código. Propósito exacto no confirmado por el runtime. Binario no auditado en detalle. |

## JavaScript (`js/`)

| Archivo y líneas | Declaraciones / responsabilidad | Uso / estado |
|---|---|---|
| `js/app.js:1-1313` | Controlador de interfaz: `render`, `renderGame`, `renderMinigameFlow`, `makeTurnCard`, vistas de jugadores/cartas/manuales/bebidas, formularios y eventos. Importa módulos enumerados en líneas 1-15. | Importado por HTML; consumidor de todos los módulos de lógica. Activo, mayor superficie de cambio. |
| `js/config.js:1-20` | `VERSION`, mapas `CATEGORIES`, `TARGETS`. | Importado por app; activo. |
| `js/storage.js:1-295` | `seedState`, `isValidState`, `loadState`, `saveState`, `validateCards`, validación de effects, export/import y clave local. Importa catálogos/migraciones. | App importa funciones (`app.js:2-9`); activo. |
| `js/game.js:1-521` | `gameEngine`, `attachCard`, acciones de turno (roll, draw, selección/resultado minijuego, resolve/finish/cancel), normalización de efectos. Importa decks, participants, dice, minigame-results. | App y tests (`tests/core.test.js:8`); activo y central. |
| `js/decks.js:1-37` | `drawFromDeck`, `resetDeck`; filtra enabled, mantiene orden/ciclo por categoría y evita repetición consecutiva si hay más de una carta. | Game; activo. |
| `js/participants.js:1-30` | `nextIndex`, `assignTargets`; asignación circular/reversa, grupo, aleatorio, pareja voluntaria sin aleatorizar. | Game; activo. |
| `js/dice.js:1-85` | `DICE_FACES`, `rollDice`, orientación final, probabilidades agregadas. | Game y app; activo. Pesos por cara (17.5,17.5,17.5,17.5,15,15) se agrupan en 35/35/15/15. |
| `js/minigame-results.js:1-117` | Valida reglas/outcomes y genera cola con destinatarios de consecuencias. | Game y app; activo. |
| `js/utils.js:1-30` | `shuffle`, `escapeText`, `makeId`, `downloadJSON`. | Decks/app; activo. |
| `js/drinks.js:1-18` | `addDrink`; trim, rechaza vacío/duplicado, crea opción enabled. | App; activo. |
| `js/manuals.js:1-3` | `findManual`. | App; activo. |
| `js/icons.js:1-3` | `iconFor`, glifo de fallback. | No aparece importado en `js/app.js` ni otras rutas de código encontradas; sin referencias aparentes, posiblemente residual. |

## Datos (`data/`)

| Archivo | Función y relaciones |
|---|---|
| `data/pdf-catalog.js:1-7871` | Exporta `PDF_CARDS` desde línea 2 y `PDF_MANUALS` desde línea 7306. Catálogo de datos base, importado por `initial-cards.js` y `initial-manuals.js`; no lógica de UI. |
| `data/additional-challenges.js:1-120` | 67 textos emparejados por índice con `shotCounts`, IDs DESAFIO_PDF_103–169, nivel/categoría/penalización; `ADDITIONAL_CARDS` combina desafíos con lista extra vacía. Consumido por `initial-cards.js` y `storage.js`. |
| `data/initial-cards.js:1-7` | Combina y clona PDF + cartas adicionales como `INITIAL_CARDS`; importado por storage. |
| `data/initial-manuals.js:1-3` | Clona manuales PDF; importado por storage. |
| `data/catalog-migrations.js:1-66` | IDs antiguos de cartas/manuales para limpieza en migración; importado por storage. |

## CSS (`css/`)

| Archivo | Responsabilidad y relaciones |
|---|---|
| `css/styles.css:1-1108` | Tokens/base/layout/componentes globales, reglas responsive y reducción de movimiento. Enlazado por `index.html:27`. |
| `css/dashboard-categories.css:1-233` | Estilos de panel/categorías/dashboard, responsive; enlazado por `index.html:28`. |
| `css/dice.css:1-361` | Cubo, caras, rotación y escenario del dado; enlazado por `index.html:29`, manipulado por app. |
| `css/brand.css:1-331` | Paleta y marca GDP con variaciones responsive/motion; enlazado por `index.html:30`. |

## Pruebas y assets

| Archivo | Función |
|---|---|
| `tests/core.test.js:1-301` | Pruebas node:test de catálogo, mazos, targets, dado, ciclo de juego, minijuegos, migración y JSON. Importa lógica y datos, no UI DOM. Script npm test. |
| `assets/icons/icon.svg` | Marca vectorial, favicon/manifiesto y shell SW. |
| `assets/icons/icon-192.png`, `icon-512.png` | Iconos PWA, listados en manifest y SW. |
| `assets/icons/favicon-32.png`, `apple-touch-icon.png` | Iconos de navegador/iOS enlazados por HTML y precacheados. |

## Árbol observado

```text
DOCUMENTACION_TECNICA/ [nueva entrega]
assets/icons/ [5 iconos]
css/ [4 hojas]
data/ [6 módulos de datos]
js/ [12 módulos]
tests/ [1 archivo]
raíz: index.html, package.json, README.md, manifest.json, server.mjs, sw.js, 2 PDF
```

Se excluyen `.agents/`, `.aws/` y `.codex/` del inventario de aplicación: directorios de entorno/herramientas, sin importación o enlace desde aplicación. `node_modules`, dist/build/vendor no están presentes en listado inspeccionado.

## Actualización fase 1

`js/game.js` expone `rerollDigital` y `redraw`; `js/app.js` añade temporizador, carrusel, formulario de manual y menú contextual; `storage.js` valida `durationSeconds`; `tests/core.test.js` cubre las nuevas operaciones del motor.
