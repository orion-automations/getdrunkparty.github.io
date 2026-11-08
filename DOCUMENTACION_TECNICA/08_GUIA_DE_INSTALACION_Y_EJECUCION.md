# Guía de instalación y ejecución

## Requisitos observados

- Node.js 18 o superior según `README.md`; npm disponible para scripts.
- Navegador moderno con ES modules; HTTPS o `localhost` para service worker/PWA.
- No hay dependencias npm declaradas; el modo online descarga `@supabase/supabase-js@2` desde CDN con `async` (`index.html:14-19`). El modo local no importa el cliente Supabase ni exige cuenta.

## Servidor local

Desde raíz, `npm run serve` (`package.json:6-9`) ejecuta `node server.mjs`. El servidor usa `PORT` si está definido y 8000 por defecto (`server.mjs:122-127`); abre `http://localhost:8000`. Ese modo incluye la API de cuentas SQLite. No abras con `file://`: la app usa módulos y un service worker condicionado por origen.

## Pruebas automatizadas

`npm test` ejecuta `node --test tests/*.test.js`. No hay comando build, lint o deploy declarado en `package.json`.

## PWA

Para GitHub Pages, publica `index.html`, `js/`, `data/`, `css/`, `assets/`, `manifest.json` y `sw.js` desde una rama/carpeta de Pages con HTTPS. Pages no ejecuta `server.mjs`, Python ni SQLite: el cliente detecta que no existe la API y guarda la cuenta en IndexedDB del navegador. Las cuentas son distintas por navegador/dispositivo; no sirven para login global. Las salas online sí se comparten por Supabase y requieren conexión, Anonymous Sign-Ins y migraciones SQL 001–008 aplicadas (009 es el trabajo opcional de limpieza mensual). En carga inicial se registra `./sw.js` y precachea `SHELL`; al publicar una actualización, sube las versiones de `js/config.js` y `sw.js` juntas.

## Archivos que componen la entrega

Servir la raíz conservando estructura/rutas. `index.html`, `js/`, `data/`, `css/`, `assets/icons/`, `manifest.json` y `sw.js` son necesarios. `server.mjs` solo se necesita para el servidor Node local. PDFs no están en lista de caché del SW.

El proyecto no contiene un pipeline de publicación. Para instrucciones de GitHub Pages y Supabase, sigue `README.md` y `supabase/README.md`.

## Actualización fase 1

No se requieren paquetes ni configuración nuevos para las mejoras locales. El temporizador usa APIs estándar del navegador; activa el audio mediante “Probar sonido” o “Iniciar” antes de esperar la alerta final.

## Configurar el modo multijugador

1. En Supabase Dashboard habilita **Authentication → Sign In / Providers → Anonymous**.
2. En **SQL Editor**, para un proyecto nuevo ejecuta completos `supabase/sql/001` hasta `008` en el orden listado en `supabase/README.md` (009 es opcional y configura la limpieza mensual de salas inactivas).
3. Comprueba tablas/RLS/publicación y las URLs del sitio en Supabase con la guía `supabase/README.md`.
4. Sirve la app en HTTPS o `localhost`. En **Participantes → Multijugador**, crea una sala, comparte el código y únete desde otro dispositivo o perfil de navegador con identidad anónima distinta.
5. Inicia desde el host y verifica que el segundo cliente reciba jugador actual, dado/carta y temporizador. Este paso debe hacerse en sesión real; la comprobación de sintaxis o pruebas del motor no prueban Realtime.

La URL y clave pública `anon` del proyecto están en `js/supabase.js`; no uses claves secretas en cliente. Si cambia el proyecto, actualiza solo la URL y la clave `anon`. La identidad anónima se guarda en el navegador y puede perderse al borrar los datos del sitio o cambiar de dispositivo. Para salas online el SDK requiere internet; la partida local permanece en el dispositivo.
