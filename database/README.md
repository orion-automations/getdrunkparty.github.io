# Base de datos de identidad de jugadores

El archivo 001_player_profiles.sql crea o amplía la tabla public.profiles, que la aplicación usa para sincronizar el nickname y el avatar. También guarda un public_uid único de ocho caracteres y el color del banner de identidad.

## Instalar en Supabase

En el SQL Editor del proyecto, ejecuta los archivos en este orden:

1. supabase/sql/001_multiplayer_schema.sql (si el esquema multijugador aún no está instalado).
2. database/001_player_profiles.sql.
3. Las demás migraciones pendientes en el orden indicado en supabase/README.md.

El script de perfiles se puede volver a ejecutar. Completa identificadores de ocho caracteres para los perfiles anteriores y configura RLS para que cada cuenta solo pueda leer y cambiar su propio perfil. Las salas muestran el nickname y el avatar mediante la copia de participante.

## Contraseñas y cuentas

No se crea una columna de contraseña en public.profiles. Supabase Auth valida y protege las credenciales; auth.users pertenece al servicio de autenticación. La tabla pública contiene solo los datos de perfil que la interfaz necesita. Nunca se debe guardar una contraseña legible en una tabla accesible desde el cliente.

La aplicación sigue funcionando localmente sin crear una cuenta. El UID local también tiene ocho caracteres y se guarda en este navegador; el UID de Supabase se genera al crear el perfil remoto.
