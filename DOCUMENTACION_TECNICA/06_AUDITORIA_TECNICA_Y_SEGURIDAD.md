# Auditoría técnica y seguridad

## Hallazgos

| Gravedad | Hallazgo | Evidencia / alcance |
|---|---|---|
| INFORMATIVO | No hay backend, login ni APIs externas detectables. | Código consultado; `rg` no encontró fetch/XHR; persistencia local en `storage.js:84-178`. No equivale a revisión de hosting/red en producción. |
| BAJO | `js/icons.js` no tiene consumidores aparentes. | La búsqueda de imports/referencias no encontró uso; confirmar si se desea retirarlo antes de eliminar. No se modifica. |
| BAJO | Fallback offline responde `index.html` para cualquier GET fallido sin coincidencia cacheada. | `sw.js:56-78`; recursos binarios/URL errónea también pueden recibir HTML. No comprobado como defecto visible en todos los navegadores. |
| MEDIO | La importación de respaldo valida forma básica y cartas, pero no ejecuta `isValidState()` sobre el objeto completo antes de asignarlo. | `app.js:1186-1207` compara estructura y llama `validateCards`, después asigna. Se recomienda prueba de entradas malformadas antes de ampliar este flujo; alcance observado, no explotación demostrada. |
| INFORMATIVO | Cobertura automatizada centrada en lógica pura; UI, PWA/HTTPS, cache real y accesibilidad no están cubiertas por `tests/core.test.js`. | Importaciones de tests (`tests/core.test.js:1-10`) y casos `12-301`; no se inspeccionó suite E2E separada. |
| INFORMATIVO | Los dos PDFs no se analizaron semánticamente en esta auditoría. | Binarios presentes; no se infieren contenidos del segundo PDF por su nombre. |

No se identificó hallazgo CRÍTICO o ALTO respaldado por el código inspeccionado. Esto no certifica seguridad global del hosting, dependencias de Node instaladas, navegador ni archivos PDF.

## Controles observados

- IDs y texto de carta se escapan en render mediante `escapeText` y/o uso de `textContent`; revisar cambios de render en `app.js` con cuidado (`utils.js:9-16`).
- Importación JSON usa `JSON.parse`, valida campos y no `eval` (`app.js:1165-1182`; `storage.js:180-295`).
- Manuales y catálogo inicial son código local bajo control del proyecto.
- Servidor verifica que la ruta resuelta permanece bajo raíz y devuelve 403 fuera de ella (`server.mjs:13-22`); excepción de lectura produce 404 genérico (`:23-36`).
- Service worker limita interceptación a GET y mismo origen (`sw.js:56-64`).
- No hay credenciales ni variables de token identificadas. `PORT` es configuración no sensible; no se revelan valores de entorno.

## Calidad y mantenimiento

`js/app.js` concentra control de vistas, estado, manipulación DOM y handlers (1313 líneas), lo cual eleva acoplamiento y costo de cambios. `js/game.js` separa la lógica central y los helpers puros tienen pruebas. El catálogo largo se concentra en un único archivo de datos (`data/pdf-catalog.js`, 7871 líneas); modificaciones deben preservar estructura y referencias de IDs. CSS es modular por tema pero varios estilos se solapan en cascada; cambios visuales requieren revisar orden de enlace (`index.html:27-30`).

No se actualizaron paquetes ni se ejecutaron auditorías de terceros. `package.json` no declara dependencias; no permite concluir qué versiones de Node fuera del requisito del README se usan en producción.

## Actualización fase 1

El sonido usa Web Audio después de una interacción del usuario. No se añadieron claves, SDKs ni llamadas externas. Las cartas sensibles o ambiguas se registran para revisión humana en [10](10_HISTORIAL_DE_MODIFICACIONES.md), sin reescritura automática.
