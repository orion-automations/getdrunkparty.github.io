# Circus Zevyra · Carnival of Chaos

**Versión de la aplicación: 2.3.23.**

Aplicación de juegos sociales mobile-first. La plataforma se llama **Circus Zevyra** y **Carnival of Chaos** es el juego disponible. El proyecto usa HTML, CSS y JavaScript nativo, conserva el modo local y conecta el modo online a Supabase.

## Estado de Carnival

- 414 cartas integradas desde los PDF de Carnival: Pecados, Sacrificio, Caos, Jokers Bufones y Jokers Arlequines, Maldición y opciones de la Ruleta del Destino; 24 manuales de minijuego.
- Dado 3D de seis caras: 1% Maldición, 19% Caos, 40% Pecados y 40% Sacrificio.
- El Gran Circo programa 22 eventos, uno cada cinco rondas completas (cada vuelta de los participantes activos). El Circo de los Horrores activa sus mazos especiales por cinco turnos; Circo el Destino activa las opciones únicas de la ruleta durante ese evento.
- El anfitrión conserva la confirmación del resultado online. El acceso usa SQLite en el servidor local o IndexedDB cuando se despliega como web estática; el perfil conserva usuario, UID y avatar en el dispositivo.
- El acceso local solicita nickname y contraseña; tras entrar, Perfil muestra el pasaporte Zevyra con UID `zevy` más seis caracteres, avatar y bandera elegida. La sesión se conserva en este dispositivo hasta cerrar sesión.
- Los otros juegos de la biblioteca siguen bloqueados mientras no tengan una implementación terminada.

El catálogo fuente está en `data/carnival-catalog.js`; el motor y la interfaz están en `js/game.js` y `js/app.js`. El reporte técnico vigente, con rutas y líneas verificadas, está en [DOCUMENTACION_TECNICA/15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md](DOCUMENTACION_TECNICA/15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md).

## Ejecutar para probar

Requiere Node.js 18 o posterior y Python 3 para las cuentas SQLite locales. En la carpeta del proyecto:

```sh
npm run serve
```

Abre [http://localhost:8000](http://localhost:8000). No abras `index.html` con `file://`: los módulos JavaScript no arrancan desde ese esquema. El servidor escucha solo en el equipo por defecto. Para un teléfono en la misma red, inicia con `HOST=0.0.0.0 npm run serve` y abre la IPv4 privada del equipo en el teléfono.

## Pruebas y límites de despliegue

La versión publicada en GitHub Pages no puede ejecutar Node ni SQLite. El acceso usa una base IndexedDB local a ese navegador, con la contraseña derivada mediante PBKDF2; la cuenta no se sincroniza con otros dispositivos. La partida online sigue usando Supabase de forma independiente. Para sincronizar una misma cuenta entre dispositivos hace falta un servicio de cuentas en línea.

El carrusel de Inicio usa la misma huella de dos columnas que las tarjetas de Juegos y desliza la siguiente por debajo. El número de caché PWA se actualiza con la versión web para que el navegador descargue los cambios.

## Base de datos local y multijugador

`database/001_users.sql` define el esquema SQLite para `npm run serve`, y `database/local_users.py` valida usuario/contraseña y guarda el hash PBKDF2. `js/local-accounts.js` detecta la API del servidor; cuando la app se publica como archivos estáticos usa IndexedDB con el mismo perfil, validación y hash. `database/zevyra.sqlite` es privado del equipo, no se sube a Git y no se comparte con Supabase.

Supabase queda para las salas multijugador en tiempo real. Aplica las migraciones en [`supabase/README.md`](supabase/README.md), incluida 008 para dejar de escribir perfiles persistentes en proyectos existentes. Las filas temporales del roster de sala contienen nickname/avatar; no llevan la contraseña ni el UID local.

## Publicar en GitHub Pages

1. Sube los archivos de la app al repositorio; no incluyas `database/zevyra.sqlite`.
2. En GitHub, abre **Settings → Pages** y publica desde la rama/carpeta que contiene `index.html`.
3. En Supabase, permite el inicio de sesión anónimo y aplica las migraciones multijugador enumeradas en [`supabase/README.md`](supabase/README.md). El navegador solo usa la clave pública `anon`; nunca publiques una `service_role`.
4. Abre la URL HTTPS de Pages. El servidor SQLite no se ejecuta allí: las cuentas quedan en IndexedDB de ese navegador. Cada dispositivo/navegador mantiene su propia cuenta local; las salas online siguen sincronizadas por Supabase.

Para integrar otro juego desde su guía, portada y reglas, sigue [`DOCUMENTACION_TECNICA/16_GUIA_PARA_INTEGRAR_NUEVOS_JUEGOS.md`](DOCUMENTACION_TECNICA/16_GUIA_PARA_INTEGRAR_NUEVOS_JUEGOS.md).
