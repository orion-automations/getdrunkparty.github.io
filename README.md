# Circus Zevyra · Carnival of Chaos

Aplicación de juegos sociales mobile-first. La plataforma se llama **Circus Zevyra** y **Carnival of Chaos** es el juego disponible. El proyecto usa HTML, CSS y JavaScript nativo, conserva el modo local y conecta el modo online a Supabase.

## Estado de Carnival

- 414 cartas integradas desde los PDF de Carnival: Pecados, Sacrificio, Caos, Jokers, Maldición y opciones de la Ruleta del Destino; 24 manuales de minijuego.
- Dado 3D de seis caras: 1% Maldición, 19% Caos, 40% Pecados y 40% Sacrificio.
- El Gran Circo programa 22 eventos, uno cada cinco turnos individuales. El Circo de los Horrores activa sus mazos especiales por cinco turnos; Circo el Destino activa las opciones únicas de la ruleta durante ese evento.
- El anfitrión conserva la confirmación del resultado online. El perfil permite ajustar tono de piel, ojos y boca, y muestra un UID local o el UID de Supabase.
- Los otros juegos de la biblioteca siguen bloqueados mientras no tengan una implementación terminada.

El catálogo fuente está en `data/carnival-catalog.js`; el motor y la interfaz están en `js/game.js` y `js/app.js`. El reporte técnico vigente, con rutas y líneas verificadas, está en [DOCUMENTACION_TECNICA/15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md](DOCUMENTACION_TECNICA/15_CARNIVAL_CHAOS_ESTADO_ACTUAL.md).

## Ejecutar para probar

Requiere Node.js 18 o posterior. En la carpeta del proyecto:

```sh
npm run serve
```

Abre [http://localhost:8080](http://localhost:8080). No abras `index.html` con `file://`: los módulos JavaScript no arrancan desde ese esquema. El servidor escucha solo en el equipo por defecto. Para un teléfono en la misma red, inicia con `HOST=0.0.0.0 npm run serve` y abre la IPv4 privada del equipo en el teléfono.

## Pruebas y límites de despliegue

`npm test` ejecuta las pruebas del catálogo, el dado, la migración, los eventos y el motor. También se deben probar visualmente el carrusel y el tema claro en un móvil, y la sala con dos usuarios antes de un despliegue público.

La conexión Supabase requiere las migraciones SQL del directorio `supabase/sql/` en el proyecto remoto. El estado de los archivos locales no confirma que el SQL ya esté aplicado en el Dashboard.

## Supabase y perfil

Consulta [supabase/README.md](supabase/README.md) y ejecuta las migraciones en el orden indicado. Auth gestiona las contraseñas; la tabla `profiles` guarda UID, nickname y avatar, nunca la contraseña. Para el formulario solo-usuario/contraseña, el cliente asigna al usuario un correo sintético bajo `accounts.zevyra.invalid`; requiere desactivar la confirmación por correo en Supabase y no ofrece recuperación de contraseña por email. La clave que usa el navegador debe ser la clave pública `anon`; nunca agregues una `service_role` al cliente.
