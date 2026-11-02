# Ficha técnica general — Get Drunk Party Web

## Resumen ejecutivo

Aplicación de juego de cartas para navegador, en español, mobile-first, servida como archivos estáticos. Interfaz en HTML/CSS y lógica en JavaScript nativo con módulos ES. No hay backend de aplicación, cuentas, ni llamadas HTTP externas en el código inspeccionado. El servidor incluido (`server.mjs`) sirve archivos; el navegador conserva catálogo, participantes y partida en `localStorage`.

## Ficha

| Campo | Estado observado |
|---|---|
| Nombre | Get Drunk Party Web; manifest: Get Drunk Party (`manifest.json:1-4`) |
| Versión declarada | 1.4.4 (`js/config.js:1`, `sw.js:2`) |
| Tipo | SPA multipantalla cliente, PWA instalable |
| Entrada | `index.html:474` carga `js/app.js` como módulo |
| Stack | HTML, CSS, JavaScript ES modules, Node.js para servidor local |
| Paquetes externos | Ninguno declarado (`package.json:1-13`) |
| Persistencia | `localStorage`, clave `gdpw.data.v1` (`js/storage.js:11,84-178`) |
| Catálogo inicial | `data/pdf-catalog.js` combinado con 67 cartas adicionales (`data/initial-cards.js:1-7`; `data/additional-challenges.js:92-120`) |
| Pruebas | `node:test`, `tests/core.test.js`; ejecución en esta auditoría: 1 archivo aprobado, 28 subpruebas incluidas |
| Git | No hay repositorio Git detectable en la carpeta raíz (`git rev-parse` falla); no es posible documentar rama o cambios locales |
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
├── Cartas Get Drunk Party.pdf
└── Get Drunk Party Web.pdf
```

## Límites de la auditoría

Se inspeccionaron todos los archivos propios de código/configuración listados, estilos, HTML, pruebas, catálogo y migraciones. PDF e imágenes se trataron como binarios; se registraron nombres y dimensiones de iconos, sin lectura semántica completa de PDFs ni píxeles. No se hicieron llamadas externas ni se inspeccionó un despliegue alojado. Las pruebas cubren lógica de núcleo, no una sesión completa de navegador, instalación HTTPS ni modo offline real.

## Actualización fase 1 (2026-11-02)

Se añadieron mejoras locales: repetición desde el cubo, slider conjunto de cartas extraídas, temporizador, formulario completo de manuales, guardado automático de nombres e historial archivado. El modo online no está implementado.
