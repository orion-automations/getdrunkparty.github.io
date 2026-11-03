# Ficha técnica general — Midnight Chaos / ZEVYRA Games

## Resumen ejecutivo

Aplicación de juego de cartas para navegador, en español, mobile-first, servida como archivos estáticos. Interfaz en HTML/CSS y lógica en JavaScript nativo con módulos ES. El modo local persiste en `localStorage`; la fase online añade Supabase Auth anónimo, PostgreSQL y Realtime para salas compartidas. El servidor incluido (`server.mjs`) sigue sirviendo archivos y no implementa una API propia.

## Ficha

| Campo | Estado observado |
|---|---|
| Nombre | Midnight Chaos (`js/config.js:2-3`); plataforma ZEVYRA Games (`manifest.json:3-5`) |
| Versión declarada | 1.8.0 (`js/config.js:1`, `package.json:3`, `sw.js:2`) |
| Tipo | SPA multipantalla cliente, PWA instalable |
| Entrada | `index.html:591` carga `js/app.js` como módulo |
| Stack | HTML, CSS, JavaScript ES modules, Node.js para servidor local |
| Paquetes externos | Ningún paquete npm; SDK de Supabase v2 desde CDN al abrir la app (`index.html:14-19`) |
| Persistencia | `localStorage`, clave por juego `zevyra.midnight-chaos.data.v1`, con lectura/migración desde `gdpw.data.v1` (`js/storage.js:8-11,92-198`) |
| Catálogo inicial | 40 cartas originales y manuales (`data/midnight-catalog.js:9-65`; `data/initial-cards.js:1-3`) |
| Pruebas | `node:test`, `tests/core.test.js`; `npm test` pasó. No cubre Supabase remoto ni sesión UI entre dispositivos |
| Git | Existe `.git`; al revisar el espacio de trabajo los archivos de la app aparecían sin seguimiento, así que el estado previo no está descrito como base versionada |
| Despliegue | Servidor simple `server.mjs`, o hosting de archivos HTTPS; no se encontró pipeline de build/deploy |

## Funcionalidades principales

- Juego de turnos con dado digital o selección manual (dado físico), cinco mazos y cara bloqueada.
- Participantes, orientación de turnos y selección de parejas por el grupo.
- Editor, importación/exportación de cartas JSON, manuales, bebidas y respaldo completo.
- Reglas configurables de consecuencias para minijuegos.
- PWA con manifiesto, instalación y caché offline de shell.

Estas funcionalidades se verifican en el código de `js/app.js`, `js/game.js` y `js/storage.js`; el detalle y recorridos están en [02](02_ARQUITECTURA_Y_FUNCIONAMIENTO.md) y [04](04_DOCUMENTACION_FUNCIONAL.md).

## Estructura

```text
.
├── index.html
├── js/                 # interfaz, reglas de juego, almacenamiento y utilidades
├── data/               # catálogo y migraciones versionadas
├── css/                # estilos globales y específicos
├── assets/icons/       # iconos PWA
├── tests/              # pruebas del núcleo
├── server.mjs          # servidor estático local
├── sw.js               # service worker
├── manifest.json       # metadatos instalables
├── package.json
├── README.md
├── Cartas Get Drunk Party.pdf (archivo fuente)
└── Get Drunk Party Web.pdf (documento fuente)
```

## Límites de la auditoría

Se inspeccionaron todos los archivos propios de código/configuración listados, estilos, HTML, pruebas, catálogo y migraciones. PDF e imágenes se trataron como binarios; se registraron nombres y dimensiones de iconos, sin lectura semántica completa de PDFs ni píxeles. No se hicieron llamadas externas ni se inspeccionó un despliegue alojado. Las pruebas cubren lógica de núcleo, no una sesión completa de navegador, instalación HTTPS ni modo offline real.

## Actualización fase 1 (2026-11-02)

Se añadieron mejoras locales: repetición desde el cubo, slider conjunto de cartas extraídas, temporizador, formulario completo de manuales, guardado automático de nombres e historial archivado.

## Multijugador online (fase Supabase)

La vista **Participantes** contiene el panel de crear/unirse a una sala (`index.html:224-246`). `js/app.js` gestiona aislamiento/restauración del estado local, controles de anfitrión, snapshots y flujo de sala; `js/multiplayer.js` conecta los servicios y sesión; `js/multiplayer-auth.js`, `js/multiplayer-rooms.js` y `js/multiplayer-sync.js` implementan identidad, RPC/lecturas y Realtime. SQL, RLS y guía están en `supabase/sql/` y `supabase/README.md`.

La integración está implementada en archivos, pero su funcionamiento productivo aún depende de ejecutar los cuatro SQL en el Dashboard, habilitar Anonymous Sign-Ins y completar una prueba en dos perfiles/dispositivos. No se afirma que esas acciones externas ya se hayan realizado.
