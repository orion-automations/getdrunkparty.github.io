# Auditoría técnica y seguridad

## Hallazgos

| Gravedad | Hallazgo | Evidencia / alcance |
|---|---|---|
| INFORMATIVO | Supabase ya está integrado en el cliente, pero el proyecto remoto aún requiere SQL/configuración y prueba de aceptación. | SDK `index.html:14-19`; cliente `js/supabase.js`; servicios `js/multiplayer-*.js`; scripts `supabase/sql/`. La instalación remota no se pudo ejecutar desde el workspace. |
| MEDIO | El cliente remoto usa autenticación anónima; borrar almacenamiento o cambiar de navegador/dispositivo pierde esa identidad recuperable. | `js/multiplayer-auth.js:3-16`; la identidad anónima no permite recuperación de cuenta. Se requiere flujo de cuenta vinculada si se necesita continuidad. |
| MEDIO | El navegador cliente consume SDK Supabase desde jsDelivr. El modo local sigue separado, pero el modo online depende de CDN/red. | `index.html:14-19`; `js/multiplayer.js:4-20`. El SDK no está fijado a un parche exacto ni precacheado. |
| INFORMATIVO | No se ha comprobado que RLS, grants, funciones RPC y publicación se hayan desplegado en el proyecto configurado. | Scripts ejecutables versionados en `supabase/sql/001`–`004`; ejecución de Dashboard y prueba de dos identidades siguen pendientes. |
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
- La clave incluida en `js/supabase.js` es la pública `anon` destinada a cliente; el acceso depende de Auth, grants, RLS y RPC. No se usa clave `service_role` en el navegador.
- Funciones SQL `SECURITY DEFINER` declaran `search_path = ''`, verifican `auth.uid()`, rol de anfitrión/membresía y limitan tamaño del snapshot; grants de ejecución se otorgan a `authenticated` (`supabase/sql/003_multiplayer_functions.sql`). La revisión de archivos no confirma que el proyecto remoto ejecute exactamente estos scripts.
- Las tablas de juego conceden solo `SELECT` directo a `authenticated`; escrituras pasan por RPC y las políticas limitan lecturas a miembros (`supabase/sql/002_multiplayer_policies.sql:44-68`). Verificar estas políticas tras aplicarlas en Dashboard.

## Calidad y mantenimiento

`js/app.js` concentra control de vistas, estado, manipulación DOM y handlers; `js/game.js` separa la lógica central. Los servicios Supabase están divididos entre auth, sala y sincronización, mientras que los callbacks/UI vuelven a app.js. El catálogo largo se concentra en un archivo de datos; cambios deben preservar IDs. CSS es modular por tema pero varios estilos se solapan en cascada.

No se actualizaron paquetes ni se ejecutaron auditorías de terceros. `package.json` no declara dependencias; no permite concluir qué versiones de Node fuera del requisito del README se usan en producción.

## Actualización fase 1

El sonido usa Web Audio después de una interacción del usuario. La integración Supabase queda registrada en [10](10_HISTORIAL_DE_MODIFICACIONES.md). No se afirma seguridad certificada ni conectividad validada en producción antes de desplegar los SQL y realizar pruebas de dos clientes.
