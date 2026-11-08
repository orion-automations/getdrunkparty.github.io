# Circus Zevyra · Carnival of Chaos

**Versión de la aplicación: 2.3.18.**

Aplicación de juegos sociales mobile-first. La plataforma se llama **Circus Zevyra** y **Carnival of Chaos** es el juego disponible. El proyecto usa HTML, CSS y JavaScript nativo, conserva el modo local y conecta el modo online a Supabase.

## Estado de Carnival

- 414 cartas integradas desde los PDF de Carnival: Pecados, Sacrificio, Caos, Jokers Bufones y Jokers Arlequines, Maldición y opciones de la Ruleta del Destino; 24 manuales de minijuego.
- Dado 3D de seis caras: 1% Maldición, 19% Caos, 40% Pecados y 40% Sacrificio.
- El Gran Circo programa 22 eventos, uno cada cinco rondas completas (cada vuelta de los participantes activos). El Circo de los Horrores activa sus mazos especiales por cinco turnos; Circo el Destino activa las opciones únicas de la ruleta durante ese evento.
- El anfitrión conserva la confirmación del resultado online. Las cuentas con usuario/contraseña y UID viven en SQLite local; los avatares Big Smile se personalizan en el perfil y para cada participante.
- El acceso local solicita nickname y contraseña; tras entrar, Perfil muestra el pasaporte Zevyra con UID `zevy` más seis caracteres, avatar y bandera elegida. La sesión se conserva en este dispositivo hasta cerrar sesión.
- Los otros juegos de la biblioteca siguen bloqueados mientras no tengan una implementación terminada.

El catálogo fuente está en `data/carnival-catalog.js`; el motor y la interfaz están en `js/game.js` y `js/app.js`. El reporte técnico vigente, con rutas y líneas verificadas, está en [DOCUMENTACION_TECNICA/15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md](DOCUMENTACION_TECNICA/15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md).

## Ejecutar para probar

Requiere Node.js 18 o posterior y Python 3 para las cuentas SQLite locales. En la carpeta del proyecto:

```sh
npm run serve
```

Abre [http://localhost:8080](http://localhost:8080). No abras `index.html` con `file://`: los módulos JavaScript no arrancan desde ese esquema. El servidor escucha solo en el equipo por defecto. Para un teléfono en la misma red, inicia con `HOST=0.0.0.0 npm run serve` y abre la IPv4 privada del equipo en el teléfono.

## Pruebas y límites de despliegue

`npm test` ejecuta las pruebas del catálogo, el dado, la migración, los eventos y el motor. La cuenta local necesita mantener el servidor Node en marcha; sus credenciales no dependen de Supabase.

El carrusel de Inicio usa la misma huella de dos columnas que las tarjetas de Juegos y desliza la siguiente por debajo. El número de caché PWA se actualiza con la versión web para que el navegador descargue los cambios.

## Base de datos local y multijugador

`database/001_users.sql` define las tablas SQLite y `database/local_users.py` valida usuario/contraseña y guarda el hash PBKDF2. El archivo vacío `database/zevyra.sqlite` ya está creado; no se sube a Git y no se comparte con Supabase. Python forma parte de la biblioteca estándar; no se requiere una cuenta de nube para crear/iniciar sesión local.

Supabase queda para las salas multijugador en tiempo real. Aplica las migraciones en [`supabase/README.md`](supabase/README.md), incluida 008 para dejar de escribir perfiles persistentes en proyectos existentes. Las filas temporales del roster de sala contienen nickname/avatar; no llevan la contraseña ni el UID SQLite.
