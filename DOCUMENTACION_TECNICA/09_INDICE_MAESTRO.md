# Índice maestro — documentación técnica

Esta carpeta conserva el historial técnico de ZEVYRA Games / Carnival of Chaos. El estado vigente de Circus Zevyra y Carnival of Chaos, versión 2.3.22, está en [15 — Carnival of Chaos: estado actual e implementación](15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md). La guía para implementar juegos adicionales está en [16 — Integrar nuevos juegos](16_GUIA_PARA_INTEGRAR_NUEVOS_JUEGOS.md). Los informes 01–14 documentan fases previas.

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
| [14 — Circus Zevyra: auditoría e implementación](14_CIRCUS_ZEVYRA_AUDITORIA_E_IMPLEMENTACION.md) | Auditoría histórica anterior a la integración de Carnival. |
| [15 — Carnival of Chaos: estado actual e implementación](15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md) | Catálogo importado, dado, eventos, carrusel, tema, perfil, SQL, ejecución y trazabilidad verificada. |
| [16 — Guía para integrar nuevos juegos](16_GUIA_PARA_INTEGRAR_NUEVOS_JUEGOS.md) | Recorrido detallado de contenido, recursos, motor, interfaz, persistencia, Supabase, PWA y publicación. |
| [10 — Historial de modificaciones](10_HISTORIAL_DE_MODIFICACIONES.md) | Cambios implementados desde la auditoría, pruebas y pendientes. |

## Mapa rápido de trazabilidad

- Entrada y vistas: `index.html` → `js/app.js`.
- Estado Midnight Chaos: `js/app.js` → `js/storage.js` → `localStorage: zevyra.midnight-chaos.data.v1`; la clave anterior `gdpw.data.v1` se importa sin borrarse.
- Salas online: `index.html` → `js/app.js` → `js/multiplayer.js` → `js/multiplayer-auth.js` / `js/multiplayer-rooms.js` / `js/multiplayer-sync.js` → `js/supabase.js` → Supabase.
- Cuentas personales: `js/app.js` → `js/local-accounts.js` → (Node local: `server.mjs` → `database/local_users.py` → SQLite; GitHub Pages: IndexedDB del navegador).
- SQL/RLS/Realtime de salas: `supabase/sql/001` → `002` → `003` → `004` → `005` → `006` → `007` → `008`; guía: `supabase/README.md`.
- Catálogo vigente: `data/carnival-catalog.js` → `data/initial-cards.js` / `data/initial-manuals.js` → `js/storage.js` (migración de catálogo versión 10). `data/midnight-catalog.js` se conserva como referencia histórica.
- Sistemas de partida: `js/game.js` → `data/power-catalog.js` / `data/round-events.js` / `data/chain-challenges.js`.
- Turno: `js/app.js` → `js/game.js` → `js/dice.js` / `js/decks.js` / `js/participants.js` / `js/minigame-results.js` → `js/storage.js`.
- PWA: `index.html` → `manifest.json`; `js/app.js` → `sw.js` → Cache Storage.
- Desarrollo local: `package.json` → `server.mjs`.

Los documentos 01–14 son registros históricos; para el juego publicado se debe usar el informe 15 y, para nuevos juegos, la guía 16. La suite puede documentar lógica heredada, pero no sustituye la validación en dos clientes Supabase.
