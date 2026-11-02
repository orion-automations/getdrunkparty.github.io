# Guía de instalación y ejecución

## Requisitos observados

- Node.js 18 o superior según `README.md`; npm disponible para scripts.
- Navegador moderno con ES modules; HTTPS o `localhost` para service worker/PWA.
- No hay dependencias npm declaradas (`package.json:1-13`), por lo que no se requiere build en scripts existentes.

## Servidor local

Desde raíz, el script declarado es `npm run serve` (`package.json:8-11`) y ejecuta `node server.mjs`. Servidor usa `PORT` si está definido y 8080 por defecto, escucha en `0.0.0.0` (`server.mjs:38-40`); navegador local en `http://localhost:8080`. No abrir con `file://`: app usa módulos y service worker condicionado por origen.

## Pruebas automatizadas

`npm test` ejecuta `node --test tests/*.test.js`. Durante esta auditoría el comando terminó correctamente (28 subpruebas del archivo `tests/core.test.js`). No hay comando build, lint o deploy declarado en `package.json`.

## PWA

Para instalación real y offline, publicar archivos estáticos en hosting HTTPS; el proyecto no contiene configuración de proveedor o pipeline de despliegue. En carga inicial, navegador registra `./sw.js` y precachea `SHELL`. Después probar con red, cerrar y abrir offline. README detalla Android por Wi-Fi y menú de instalación; HTTP por IP local sirve para desarrollo y no habilita instalación PWA estándar en Chrome.

## Archivos que componen la entrega

Servir la raíz conservando estructura/rutas. `index.html`, `js/`, `data/`, `css/`, `assets/icons/`, `manifest.json` y `sw.js` son necesarios. `server.mjs` solo se necesita para el servidor Node local. PDFs no están en lista de caché del SW.

No se inventan pasos de despliegue: hosting, dominio, TLS, cabeceras y pipeline no están configurados en el repositorio inspeccionado.

## Actualización fase 1

No se requieren paquetes ni configuración nuevos para las mejoras locales. El temporizador usa APIs estándar del navegador; activa el audio mediante “Probar sonido” o “Iniciar” antes de esperar la alerta final.
