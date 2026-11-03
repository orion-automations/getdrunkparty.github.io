# Índice maestro — documentación técnica

Esta carpeta documenta el código observado de Get Drunk Party Web, versión declarada 1.5.0. Las rutas y líneas se refieren a archivos del proyecto y deben contrastarse si cambian.

| Documento | Contenido |
|---|---|
| [01 — Ficha técnica general](01_FICHA_TECNICA_GENERAL.md) | Resumen, stack, alcance, estructura y límites. |
| [02 — Arquitectura y funcionamiento](02_ARQUITECTURA_Y_FUNCIONAMIENTO.md) | Diagramas Mermaid y recorridos técnicos trazables. |
| [03 — Inventario completo de archivos](03_INVENTARIO_COMPLETO_DE_ARCHIVOS.md) | Archivo por archivo: responsabilidad, relaciones y estado. |
| [04 — Documentación funcional](04_DOCUMENTACION_FUNCIONAL.md) | Flujos de partida, edición, minijuegos, datos y PWA. |
| [05 — Bases de datos e integraciones](05_BASES_DE_DATOS_E_INTEGRACIONES.md) | Esquema local, migraciones, JSON, APIs y caché. |
| [06 — Auditoría técnica y seguridad](06_AUDITORIA_TECNICA_Y_SEGURIDAD.md) | Hallazgos clasificados, evidencia y límites. |
| [07 — Estado actual y transferencia](07_ESTADO_ACTUAL_Y_TRANSFERENCIA.md) | Clasificación de funcionalidades, riesgos y orden de familiarización. |
| [08 — Instalación y ejecución](08_GUIA_DE_INSTALACION_Y_EJECUCION.md) | Requisitos, comandos declarados y operación de PWA. |
| [10 — Historial de modificaciones](10_HISTORIAL_DE_MODIFICACIONES.md) | Cambios implementados desde la auditoría, pruebas y pendientes. |

## Mapa rápido de trazabilidad

- Entrada y vistas: `index.html` → `js/app.js`.
- Estado: `js/app.js` → `js/storage.js` → `localStorage`.
- Salas online: `index.html` → `js/app.js` → `js/multiplayer.js` → `js/multiplayer-auth.js` / `js/multiplayer-rooms.js` / `js/multiplayer-sync.js` → `js/supabase.js` → Supabase.
- SQL/RLS/Realtime: `supabase/sql/001` → `002` → `003` → `004`; guía de ejecución: `supabase/README.md`.
- Catálogo: `js/storage.js` → `data/initial-cards.js` → `data/pdf-catalog.js` + `data/additional-challenges.js`.
- Turno: `js/app.js` → `js/game.js` → `js/dice.js` / `js/decks.js` / `js/participants.js` / `js/minigame-results.js` → `js/storage.js`.
- PWA: `index.html` → `manifest.json`; `js/app.js` → `sw.js` → Cache Storage.
- Desarrollo local: `package.json` → `server.mjs`.

No se modificó el código fuente para producir esta documentación. Se inspeccionaron archivos propios de app y pruebas; los dos PDFs solo fueron reconocidos como binarios presentes, sin análisis semántico completo.
