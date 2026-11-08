# Supabase para las salas multijugador

Supabase se usa para crear y sincronizar salas online. **No registra cuentas personales ni valida contraseñas**. En `npm run serve`, las cuentas usan `database/zevyra.sqlite`; en GitHub Pages, las cuentas se guardan en IndexedDB de ese navegador. Ninguna de esas cuentas se sincroniza con Supabase ni entre dispositivos. Para autorizar una sala, el navegador genera una identidad anónima temporal de Supabase. El nickname y el avatar se copian a `room_players` como datos de la sesión de sala.

## Requisitos

- URL y clave pública `anon` del proyecto en `js/supabase.js`. No incluyas claves `service_role` en el navegador.
- Anonymous Sign-Ins habilitado en **Authentication → Sign In / Providers → Anonymous**.
- Sitio servido por HTTP local o HTTPS; `file://` no es compatible con módulos ni Realtime.
- GitHub Pages puede servir el cliente de la app y conectarse a estas salas; habilita la autenticación anónima y confirma que las migraciones y Realtime están configurados en el mismo proyecto.

## Migraciones del proyecto Supabase

Para un proyecto nuevo, ejecuta en SQL Editor los archivos completos en este orden:

1. `sql/001_multiplayer_schema.sql` — salas, participantes e instantáneas de partida.
2. `sql/002_multiplayer_policies.sql` — RLS y autorización de Presence.
3. `sql/003_multiplayer_functions.sql` — RPC atómicas de salas; el nickname/avatar solo se insertan en la fila de sala.
4. `sql/004_multiplayer_realtime.sql` — publicación de cambios.
5. `sql/005_room_join_diagnostics.sql` — validación de códigos, expiración, estado y aforo.
6. `sql/006_turn_actions_and_profile.sql` — acciones del turno, temporizador y actualización de alias en salas activas.
7. `sql/007_host_confirms_turns.sql` — autoridad del anfitrión para confirmar/cerrar resultados.
8. `sql/008_local_accounts_only.sql` — desactiva cualquier escritura de perfil persistente que quede en proyectos anteriores.
9. `sql/009_monthly_inactive_room_cleanup.sql` — programa la eliminación mensual de salas con más de 30 días sin actividad de participantes.

Si ya aplicaste 001–007, ejecuta solo `sql/008_local_accounts_only.sql`. Esta migración no borra filas antiguas de `public.profiles`; bloquea su acceso y deja de crear registros nuevos. El archivo `database/001_users.sql` es SQLite y **no** se ejecuta en el SQL Editor de Supabase.

La migración 007 debe estar aplicada para probar la confirmación de turnos Carnival. Las salas vencen a las seis horas para nuevos ingresos. Antes de ejecutar la migración 009, habilita **Cron** desde Integrations → Cron en el Dashboard de Supabase. La limpieza conserva cualquier sala que tenga al menos un participante `joined` o `disconnected` con heartbeat en los últimos 30 días; elimina las salas inactivas con más de 30 días y sus filas dependientes. El trabajo se ejecuta el día 1 de cada mes a las 03:15 UTC. El máximo configurable es de 30 jugadores, pero no está validado frente a cuotas ni carga real.

## Verificación de las tablas online

Comprueba `rooms`, `room_players` y `game_states` con RLS habilitado:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('rooms', 'room_players', 'game_states');

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public';
```

La validación de una partida online requiere dos navegadores o dispositivos y comprobar una sala real. Que el SQL esté aplicado no demuestra por sí solo que la partida haya sido probada. En GitHub Pages la URL del sitio debe estar permitida en **Authentication → URL Configuration → Site URL / Redirect URLs** cuando el proyecto lo requiera; la autenticación anónima no debe depender de las cuentas personales de la app.

## Separación de datos

El usuario/contraseña, UID público y perfil personal se guardan localmente: SQLite en el modo Node y IndexedDB en hosting estático. En ambos casos la contraseña se convierte en un hash PBKDF2. Supabase recibe una identidad anónima técnica para permisos de sala y el nickname/avatar como instantánea de los participantes activos. La cuenta de Pages existe solo en ese navegador y no puede servir como identidad global. Los registros históricos de perfiles en proyectos anteriores no se eliminan automáticamente.
