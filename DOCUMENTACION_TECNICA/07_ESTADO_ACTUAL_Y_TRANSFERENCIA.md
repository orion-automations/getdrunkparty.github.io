# Estado actual y transferencia

> Actualización de Fase 2: consultar [13 — Fase 2](13_FASE_2_TURNOS_Y_PERFIL.md) para el nombre, catálogo, clave de almacenamiento, poderes/eventos/cadenas y rutas actuales. Esta matriz conserva verificaciones de fases anteriores; el multijugador nuevo todavía requiere aplicar 006 y validar dos sesiones.

## Matriz de estado

| Funcionalidad | Clasificación | Evidencia / límite |
|---|---|---|
| Seed, validación y persistencia local | IMPLEMENTADA Y VERIFICADA en lógica | `storage.js`; pruebas core; no se probó persistencia en navegador real |
| Sorteo/ciclo por mazo y asignación de jugadores | IMPLEMENTADA Y VERIFICADA en lógica | `decks.js`, `participants.js`; tests |
| Máquina de turnos, dado, estados y resolución | IMPLEMENTADA Y VERIFICADA en lógica | `game.js`, `dice.js`; tests |
| Identidad Midnight Chaos y catálogo inicial separado | IMPLEMENTADA Y VERIFICADA en lógica | `config.js`, `data/midnight-catalog.js`, `storage.js`; migración local conserva cartas de usuario |
| Perfil/nickname asociado a identidad y salas | IMPLEMENTADO EN REPOSITORIO; RPC NUEVA NO DESPLEGADA | `app.js`, `multiplayer.js`, migración 006 |
| Poderes, ronda por cada cinco turnos y cadenas finitas | IMPLEMENTADOS Y VERIFICADOS en lógica | `data/*-catalog.js`, `game.js`, `tests/core.test.js`; falta prueba visual y online real |
| Consecuencias configurables de minijuegos | IMPLEMENTADA Y VERIFICADA en lógica | `minigame-results.js`, `game.js`; tests |
| Editor/importación/exportación/gestión de manuales | IMPLEMENTADA, PERO NO VERIFICADA EN EJECUCIÓN DOM | Handlers en `app.js`; validadores probados parcialmente |
| UI responsive | IMPLEMENTADA, PERO NO VERIFICADA EN EJECUCIÓN | CSS y HTML presentes; no se realizó inspección visual/browser |
| Instalación PWA y offline | IMPLEMENTADA, PERO NO VERIFICADA EN EJECUCIÓN | Manifest/SW y registro presentes; requiere servir origen seguro |
| Estructura Supabase / Auth / RLS / Realtime | IMPLEMENTADA EN REPOSITORIO, CONFIGURACIÓN EXTERNA PENDIENTE | `supabase/sql/001`–`004`, `supabase/README.md`; falta aplicar SQL y habilitar Anonymous Sign-Ins en Dashboard |
| Multijugador online de extremo a extremo | IMPLEMENTACIÓN DEL TURNO POR JUGADOR EN REPOSITORIO; PENDIENTE APLICAR 006 Y VOLVER A PROBAR | `gdp_act_turn` valida identidad del jugador actual y versión; controles remotos se bloquean. El usuario reportó pruebas online previas correctas, pero esta actualización no se verificó entre dos sesiones |
| Cara BLOQUEADA | IMPLEMENTADA Y VERIFICADA en lógica | El motor inicia turno sin robo; caso test |
| Código `js/icons.js` | INACTIVA O SIN REFERENCIAS APARENTES | No hay consumidores encontrados |
| Semana inglesa | Parcial según texto de README/manual | Manual puede estar marcado pendiente; configuración concreta depende del dato. No implica regla automática |

## Limitaciones y riesgos de cambio

1. Estado local ligado a navegador/origen; borrar datos elimina catálogo editado y partida si no hay exportación.
2. `loadState()` contiene migraciones en secuencia y debe probarse con respaldos representativos antes de cambiar esquema (`storage.js:84-168`).
3. Cambiar formatos de turno afecta compatibilidad y renders; motor y UI comparten el mismo objeto mutable (`game.js:53-125`, `app.js:16-31`).
4. El índice de `challengeTexts` se alinea con `shotCounts`; reordenar/desfasar listas cambia IDs/texto/unidades (`additional-challenges.js:5-114`).
5. La versión del catálogo, versión visible y caché SW son valores separados (`additional-challenges.js`, `config.js:1`, `sw.js:2`).
6. El backend 006 comprueba miembro, usuario del turno, roster y versión; persiste el snapshot completo recibido, sin validar cada acción dentro del motor del juego (`gdp_act_turn`; documento 13).
7. Los usuarios anónimos no recuperan su identidad tras limpiar el almacenamiento del navegador; no comunicar la sesión anónima como cuenta respaldada.
6. La edición de `pdf-catalog.js` puede romper manualId o identidad estable de cartas.
7. Service worker precachea lista explícita `SHELL` y no los PDFs; al agregar módulo hay que reflejarlo en esa lista para offline.

## Orden sugerido para el equipo receptor

1. Leer `README.md` y ficha [01](01_FICHA_TECNICA_GENERAL.md).
2. Trazar el DOM en `index.html` junto con render/handlers de `js/app.js`.
3. Entender estado y migraciones en `js/storage.js` y `data/catalog-migrations.js`.
4. Leer `js/game.js`, después `decks`, `participants`, `dice` y `minigame-results`.
5. Revisar catálogo y manuales, luego CSS/PWA.
6. Antes de cambios funcionales, ejecutar `npm test`; para UI y offline realizar pruebas de navegador en origen seguro, incluido móvil.

## Áreas no verificadas

No se ejecutó una inspección visual interactiva, instalación PWA ni desconexión de red. No se comprobó compatibilidad con navegadores específicos, datos de usuarios reales, hosting publicado, análisis semántico de PDFs o ciclo de despliegue (no definido en repo). Las pruebas automatizadas sí se ejecutaron durante esta auditoría y pasaron.

## Actualización fase 1

Repetición de dado/carta, temporizador, carrusel, edición completa de manuales, guardado automático de nombres y archivado de historial están implementados localmente. La capa Supabase ya está en el repositorio, pero falta ejecutar sus scripts desde el Dashboard y comprobar crear/unirse/iniciar/sincronizar/salir con dos perfiles o dispositivos. Navegador UI y gesto/audio aún requieren prueba real.
