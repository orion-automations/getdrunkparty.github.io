# Base de datos local de usuarios

Las cuentas se guardan en **SQLite nativo** dentro del proyecto, en `database/zevyra.sqlite`. No se registran usuarios ni contraseñas en Supabase. El archivo vacío inicial ya está creado; el servidor también puede reconstruir el esquema desde el SQL si se borra.

## Archivos

- `001_users.sql`: esquema SQLite de `local_users` y `local_sessions`.
- `local_users.py`: capa local que valida credenciales y ejecuta consultas con el módulo SQLite incluido en Python.
- `zevyra.sqlite`: archivo de datos local generado al usar el registro; no se debe subir a Git.

## Uso

Ejecuta `npm run serve` desde la carpeta del proyecto y abre `http://localhost:8000` (puedes cambiar el puerto con `PORT=8080 npm run serve`). El registro, inicio y edición de perfil pasan por los endpoints locales `/api/users/*` de `server.mjs`; requieren Python 3 accesible como `python3` (o definir `PYTHON`). No abras la aplicación con un servidor estático: no tiene estas rutas de API y el registro devolverá 404/405. Para abrir la base con otra herramienta SQLite, usa `sqlite3 database/zevyra.sqlite`.

La aplicación pide solo nickname y contraseña para entrar o registrarse. La contraseña no se guarda en texto legible: SQLite conserva una sal aleatoria y un hash PBKDF2 por cuenta. El UID público nuevo usa `zevy` seguido de seis caracteres aleatorios. El perfil también guarda avatar, código de nacionalidad y las listas iniciales de cartas premio y fragmentos. Esta base es propia de la instalación y no sincroniza cuentas entre dispositivos.

Supabase permanece únicamente para el modo multijugador en tiempo real. Las salas guardan una copia del nickname/avatar en `room_players` mientras dura su uso; no se envían la contraseña, la tabla de cuentas local ni su UID de cuenta.
