# Base de datos local de usuarios

Las cuentas se guardan en **SQLite nativo** dentro del proyecto, en `database/zevyra.sqlite`. No se registran usuarios ni contraseñas en Supabase. El archivo vacío inicial ya está creado; el servidor también puede reconstruir el esquema desde el SQL si se borra.

## Archivos

- `001_users.sql`: esquema SQLite de `local_users` y `local_sessions`.
- `local_users.py`: capa local que valida credenciales y ejecuta consultas con el módulo SQLite incluido en Python.
- `zevyra.sqlite`: archivo de datos local generado al usar el registro; no se debe subir a Git.

## Uso

Ejecuta `npm run serve` desde la carpeta del proyecto y abre `http://localhost:8080`. El registro, inicio y edición de perfil pasan por los endpoints locales `/api/users/*` de `server.mjs`; requieren Python 3 accesible como `python3` (o definir `PYTHON`). Para abrir la base con otra herramienta SQLite, usa `sqlite3 database/zevyra.sqlite`.

Las contraseñas no se guardan en texto legible: SQLite conserva una sal aleatoria y un hash PBKDF2 por cuenta. El UID público se genera localmente con ocho caracteres. Esta base es propia de la instalación y no sincroniza cuentas entre dispositivos.

Supabase permanece únicamente para el modo multijugador en tiempo real. Las salas guardan una copia del nickname/avatar en `room_players` mientras dura su uso; no se envían la contraseña, la tabla de cuentas local ni su UID de cuenta.
