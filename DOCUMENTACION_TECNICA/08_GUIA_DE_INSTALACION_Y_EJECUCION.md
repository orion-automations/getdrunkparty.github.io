# Guía de instalación y ejecución

## Requisitos observados

- Node.js 18 o superior según `README.md`; npm disponible para scripts.
- Navegador moderno con ES modules; HTTPS o `localhost` para service worker/PWA.
- No hay dependencias npm declaradas; el modo online descarga `@supabase/supabase-js@2` desde CDN con `async` (`index.html:14-19`). El modo local no importa el cliente Supabase ni exige cuenta.

## Servidor local

Desde raíz, el script declarado es `npm run serve` (`package.json:8-11`) y ejecuta `node server.mjs`. Servidor usa `PORT` si está definido y 8080 por defecto, escucha en `0.0.0.0` (`server.mjs:38-40`); navegador local en `http://localhost:8080`. No abrir con `file://`: app usa módulos y service worker condicionado por origen.

## Pruebas automatizadas

`npm test` ejecuta `node --test tests/*.test.js`. En esta revisión terminó correctamente; la salida de Node reporta un archivo de pruebas aprobado. No hay comando build, lint o deploy declarado en `package.json`.

## PWA

Para instalación real y offline, publicar archivos estáticos en hosting HTTPS; el proyecto no contiene configuración de proveedor o pipeline de despliegue. En carga inicial, navegador registra `./sw.js` y precachea `SHELL`. Después probar con red, cerrar y abrir offline. README detalla Android por Wi-Fi y menú de instalación; HTTP por IP local sirve para desarrollo y no habilita instalación PWA estándar en Chrome.

## Archivos que componen la entrega

Servir la raíz conservando estructura/rutas. `index.html`, `js/`, `data/`, `css/`, `assets/icons/`, `manifest.json` y `sw.js` son necesarios. `server.mjs` solo se necesita para el servidor Node local. PDFs no están en lista de caché del SW.

No se inventan pasos de despliegue: hosting, dominio, TLS, cabeceras y pipeline no están configurados en el repositorio inspeccionado.

## Actualización fase 1

No se requieren paquetes ni configuración nuevos para las mejoras locales. El temporizador usa APIs estándar del navegador; activa el audio mediante “Probar sonido” o “Iniciar” antes de esperar la alerta final.

## Configurar el modo multijugador

1. En Supabase Dashboard habilita **Authentication → Sign In / Providers → Anonymous**.
2. En **SQL Editor**, ejecuta cada archivo completo en este orden: `supabase/sql/001_multiplayer_schema.sql`, `002_multiplayer_policies.sql`, `003_multiplayer_functions.sql` y `004_multiplayer_realtime.sql`.
3. Comprueba tablas/RLS/publicación con las consultas en `supabase/README.md`.
4. Sirve la app en HTTPS o `localhost`. En **Participantes → Multijugador**, crea una sala, comparte el código y únete desde otro dispositivo o perfil de navegador con identidad anónima distinta.
5. Inicia desde el host y verifica que el segundo cliente reciba jugador actual, dado/carta y temporizador. Este paso debe hacerse en sesión real; la comprobación de sintaxis o pruebas del motor no prueban Realtime.

La URL y clave pública del proyecto ya están en `js/supabase.js`; no uses claves secretas en cliente. Si cambia el proyecto, actualiza solo la URL y la clave `anon`. La identidad anónima se guarda en el navegador y no puede recuperarse al borrar los datos del sitio o cambiar de dispositivo. Para salas online el SDK requiere internet, aunque el modo local permanece disponible offline.
