# Bases de datos e integraciones

## Persistencia local

No se encontró base de datos SQL/NoSQL, servidor API, autenticación ni almacenamiento remoto. La persistencia funcional es `window.localStorage` con clave `gdpw.data.v1` (`js/storage.js:11,84-178`). El valor JSON incluye `version`, `catalogVersion`, `cards`, `manuals`, `drinks`, `participants`, `settings` y `game` (estructura inicial `storage.js:12-35`). El scope depende del origen y navegador; no sincroniza teléfonos y borrar datos del sitio puede eliminarlo.

### Datos mantenidos

- Cartas: ID, categoría, texto, icono glyph, intensidad, target, penalty, manualId, enabled y opcional effects.
- Manuales: catálogo PDF más manuales editados/creados; campos base y `details` opcional, incluidas reglas de consecuencias.
- Bebidas/unidades: ID, nombre, etiqueta, enabled.
- Participantes: ID, nombre, active, preferences.
- Ajustes: reversa de posiciones, modo digital/físico.
- Partida: índice actual, estado, mazos (orden/índice/última carta), turno en curso, historial limitado a 20 y recompensas.

El esquema se inicializa en `storage.js:12-35`; validación estructural en `37-82`, validación de carta en `180-246`.

## Carga y migraciones

`loadState()` crea seed cuando falta clave; si estado válido aplica limpieza de IDs legados para versiones de catálogo previas, agrega cartas/manuales base faltantes, normaliza desafíos legacy y actualiza opción Shots (`storage.js:84-168`). Para incrementar adicionales, incorpora solo IDs no presentes cuando `catalogVersion` es inferior a la declarada. Guardados de migración se escriben localmente. `data/catalog-migrations.js` lista IDs removidos.

## Catálogo original y documentos fuente

`data/pdf-catalog.js` define `PDF_CARDS` y `PDF_MANUALS`; `data/initial-cards.js` combina PDF con `ADDITIONAL_CARDS`; `data/initial-manuals.js` expone manuales. `additional-challenges.js` deriva IDs/títulos 103–169 desde índice de 67 textos y `shotCounts`. Esta relación de índice exige mantener ambas listas alineadas. La documentación original informa 310 cartas base y 377 con adiciones; pruebas automatizadas incluyen aserción del catálogo (`tests/core.test.js:12-17`).

## APIs / servicios externos

No se localizaron `fetch`, XHR ni URLs de API en módulos de aplicación. `server.mjs` solo lee archivos locales y responde HTTP. Service worker usa Fetch API para pedir recursos del mismo origen y Cache Storage (`sw.js:56-78`); esto es comunicación con el propio origen, no integración de tercero. El servidor lee `PORT` si está configurado, por defecto 8080 (`server.mjs:38-40`). No se detectaron variables de credenciales/API.

## Import/export

JSON de cartas: array o `{version:1,cards:[...]}`; IDs, categorías, required fields, targets, iconos, penalizaciones, effects y references a manual se validan (`storage.js:180-295`). Las cartas extra se clonan y anexan. Respaldo completo tiene validación menos estricta que `isValidState`: requiere versión 1, listas cards/participants/manuals, drinks y game, luego valida cartas y reemplaza estado (`app.js:1186-1207`). Importación no ejecuta el JSON como código.

## Cache Storage PWA

El SW precachea recursos de shell bajo `gdpw-shell-1.4.4`; al activar elimina versiones previas con el mismo prefijo. Para GET mismo origen primero intenta red, copia respuestas exitosas a caché; al fallar responde caché o `index.html`. Datos `localStorage` están separados de caché y no son borrados por esta lógica. Los archivos PDF no figuran en SHELL.

## Actualización fase 1

Las cartas pueden guardar `durationSeconds` opcional, entero entre 1 y 3600. Las partidas nuevas conservan hasta diez archivos anteriores en `game.archives`. No se ha añadido integración remota.
