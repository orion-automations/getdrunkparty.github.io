# Base de datos local de usuarios

En el servidor de desarrollo (`npm run serve`), las cuentas se guardan en **SQLite nativo** dentro del proyecto, en `database/zevyra.sqlite`. GitHub Pages no puede ejecutar Node ni SQLite; en ese despliegue, el cliente usa una base IndexedDB independiente en cada navegador. No se registran usuarios ni contraseñas en Supabase. El archivo SQLite se crea/reconstruye desde el SQL local si hace falta.

## Archivos

- `001_users.sql`: esquema SQLite de `local_users` y `local_sessions`.
- `local_users.py`: capa local que valida credenciales y ejecuta consultas con el módulo SQLite incluido en Python.
- `zevyra.sqlite`: archivo de datos local generado al usar el registro; no se debe subir a Git.

## Uso

Ejecuta `npm run serve` desde la carpeta del proyecto y abre `http://localhost:8000` (puedes cambiar el puerto con `PORT=8080 npm run serve`). En este modo el registro, inicio y edición de perfil usan `/api/users/*` de `server.mjs` y SQLite, y requieren Python 3 como `python3` (o definir `PYTHON`). En GitHub Pages la app detecta que no existe esa API y usa IndexedDB del navegador. Para abrir la base SQLite local con otra herramienta, usa `sqlite3 database/zevyra.sqlite`.

La aplicación pide solo nickname y contraseña para entrar o registrarse. La contraseña no se guarda en texto legible: SQLite conserva una sal aleatoria y un hash PBKDF2 por cuenta. El UID público nuevo usa `zevy` seguido de seis caracteres aleatorios. El perfil también guarda avatar, código de nacionalidad y las listas iniciales de cartas premio y fragmentos. Esta base es propia de la instalación y no sincroniza cuentas entre dispositivos.

Supabase permanece para el modo multijugador en tiempo real. Las salas guardan una copia del nickname/avatar en `room_players` mientras dura su uso; no se envían la contraseña, la tabla de cuentas ni el UID de cuenta. En GitHub Pages, reinstalar el navegador o borrar sus datos puede eliminar la cuenta IndexedDB; no equivale a una cuenta sincronizada y recuperable en la nube.
