# Configuración de Supabase para Circus Zevyra · Carnival of Chaos

## Requisitos

- Proyecto Supabase existente con URL y clave pública `anon` (la pareja entregada está en `js/supabase.js`). No uses `service_role` ni secret keys en el navegador.
- Anonymous Sign-Ins habilitado en **Authentication → Sign In / Providers → Anonymous**.
- Publicar el sitio en HTTPS para sesiones persistentes y uso normal de Realtime. `file://` no es un origen de despliegue compatible.

## Perfil con usuario y contraseña

La vista **Mi perfil** permite crear e iniciar sesión con usuario y contraseña. Supabase Auth gestiona y verifica la contraseña; la aplicación no añade un campo de password a `public.profiles`. `profiles.id` es el UID privado de Auth; `profiles.public_uid` es el identificador visible de ocho caracteres. La tabla guarda nickname, avatar y color de banner.

Como Supabase Auth inicia sesión con correo o teléfono, el cliente convierte el usuario permitido (3–32 caracteres: letras minúsculas, números, `.`, `_`, `-`) en un identificador interno `usuario@accounts.zevyra.invalid`. Para esta modalidad, desactiva **Confirm email** en el proveedor Email; sin esa opción, Supabase no inicia sesión hasta una confirmación que no se puede recibir en ese dominio reservado. No hay recuperación de contraseña por correo en esta configuración. Conserva la URL del proyecto y la clave pública `anon` en `js/supabase.js`; nunca expongas claves `service_role`.

El plan Free de Supabase incluye una base Postgres de hasta 500 MB y permite dos proyectos activos; los proyectos gratuitos se pausan tras una semana de inactividad. Revisa los [límites vigentes del plan Free](https://supabase.com/pricing) antes de un despliegue público.

## Orden de instalación

En Supabase Dashboard, abre **SQL Editor → New query**. Ejecuta un archivo completo por consulta, en este orden:

1. `sql/001_multiplayer_schema.sql` — tablas e índices; habilita RLS.
2. `../database/001_player_profiles.sql` — añade UID visible de ocho caracteres, color de banner y políticas de perfil. No almacena contraseñas.
3. `sql/002_multiplayer_policies.sql` — grants mínimos, políticas RLS y autorización de Presence.
4. `sql/003_multiplayer_functions.sql` — RPC atómicas de salas, estado, heartbeat y anfitrión.
5. `sql/004_multiplayer_realtime.sql` — replica identity y publicación de cambios.
6. `sql/005_room_join_diagnostics.sql` — normaliza códigos con espacios internos, diferencia sala inexistente/vencida/cerrada/en curso y mantiene la comprobación de aforo serializada.
7. `sql/006_turn_actions_and_profile.sql` — permite escrituras de estado únicamente al participante del turno vigente, con bloqueo/versionado transaccional, y propaga cambios de nickname a las salas en las que participa la identidad autenticada.
8. `sql/007_host_confirms_turns.sql` — conserva al jugador activo como dueño de las acciones de su turno y permite que el anfitrión confirme el resultado y cierre ese turno mediante la misma RPC con control de versión.

Los scripts no eliminan tablas ni datos. Los scripts de políticas reemplazan políticas con los mismos nombres para permitir correcciones; ejecútalos con la cuenta administrativa del Dashboard. Para un proyecto existente que ya tiene el esquema multijugador, ejecuta primero `../database/001_player_profiles.sql` y luego las migraciones pendientes en orden: 005, 006 y 007. No vuelvas a correr 001–004. La migración 007 debe aplicarse antes de probar la confirmación de turnos Carnival online.

El código permite configurar de 2 a 30 integrantes por sala, pero 30 no se ha validado como capacidad real ni contra cuotas del plan gratuito. No se activa ningún producto de pago desde estos archivos. Las salas dejan de aceptar uniones cuando vencen a las seis horas; estos SQL no programan una tarea de limpieza de filas expiradas.

## Comprobaciones manuales

En **Table Editor**, confirma `profiles`, `rooms`, `room_players` y `game_states`. En **Database → Tables**, verifica RLS habilitado para cada una. En SQL Editor se puede revisar así:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'rooms', 'room_players', 'game_states');

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public';
```

Después de ejecutar los scripts, la prueba de extremo a extremo aún requiere dos navegadores/dispositivos conectados al sitio HTTPS. La app notifica errores de Auth/RPC/Realtime; que las tablas existan no demuestra por sí solo que una partida haya sido probada.

## Identidad y datos

La identidad anónima persiste en el almacenamiento del navegador. Supabase documenta que al borrar los datos, cerrar la sesión o cambiar de dispositivo, esa identidad no se puede recuperar automáticamente; el nombre/perfil no es una cuenta recuperable. El perfil genera Big Smile desde DiceBear; el editor consulta las opciones de estilo publicadas por la API, guarda una semilla estable y sincroniza la URL resultante en el campo de avatar existente. El avatar necesita internet para generarse. Los detalles del esquema y credenciales están en `../database/README.md`.

El anfitrión conserva las acciones de sala y confirma los resultados de turno. El participante activo tira el dado, elige la carta y completa los controles interactivos; la versión esperada evita sobrescrituras concurrentes. La migración 007 reconoce al anfitrión para la confirmación, valida el mismo turno activo y conserva las transiciones/index/roster del RPC. Los participantes leen el snapshot persistido con RLS y reciben cambios por Postgres Changes; Presence solo representa conexiones activas. Los datos locales se mantienen separados de los snapshots online.
