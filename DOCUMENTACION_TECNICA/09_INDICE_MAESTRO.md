# Índice maestro — documentación técnica

Esta carpeta conserva el historial técnico de ZEVYRA Games / Midnight Chaos. El estado vigente de Circus Zevyra, versión 1.9.0, está en [14 — Auditoría e implementación Circus Zevyra](14_CIRCUS_ZEVYRA_AUDITORIA_E_IMPLEMENTACION.md); sus rutas y líneas deben contrastarse si cambian.

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
| [13 — Fase 2: turnos y perfil](13_FASE_2_TURNOS_Y_PERFIL.md) | Acciones del participante activo, animación sincronizada, nickname y migración 006. |
| [14 — Circus Zevyra: auditoría e implementación](14_CIRCUS_ZEVYRA_AUDITORIA_E_IMPLEMENTACION.md) | Estado actual de identidad, navegación, biblioteca, tema, perfil, roles online, PDFs, implementación y pruebas. |
| [10 — Historial de modificaciones](10_HISTORIAL_DE_MODIFICACIONES.md) | Cambios implementados desde la auditoría, pruebas y pendientes. |

## Mapa rápido de trazabilidad

- Entrada y vistas: `index.html` → `js/app.js`.
- Estado Midnight Chaos: `js/app.js` → `js/storage.js` → `localStorage: zevyra.midnight-chaos.data.v1`; la clave anterior `gdpw.data.v1` se importa sin borrarse.
- Salas online: `index.html` → `js/app.js` → `js/multiplayer.js` → `js/multiplayer-auth.js` / `js/multiplayer-rooms.js` / `js/multiplayer-sync.js` → `js/supabase.js` → Supabase.
- SQL/RLS/Realtime: `supabase/sql/001` → `002` → `003` → `004` → `005` → `006`; guía de ejecución: `supabase/README.md`.
- Catálogo: `js/storage.js` → `data/initial-cards.js` / `data/initial-manuals.js` → `data/midnight-catalog.js`; archivos anteriores quedan como archivo y migración 6 reversible.
- Sistemas de partida: `js/game.js` → `data/power-catalog.js` / `data/round-events.js` / `data/chain-challenges.js`.
- Turno: `js/app.js` → `js/game.js` → `js/dice.js` / `js/decks.js` / `js/participants.js` / `js/minigame-results.js` → `js/storage.js`.
- PWA: `index.html` → `manifest.json`; `js/app.js` → `sw.js` → Cache Storage.
- Desarrollo local: `package.json` → `server.mjs`.

Los documentos 01–13 son registros históricos; si contradicen el estado posterior, se debe usar el informe 14. Las pruebas de la lógica heredada siguen documentadas en `13_FASE_2_TURNOS_Y_PERFIL.md` y `10_HISTORIAL_DE_MODIFICACIONES.md`.
