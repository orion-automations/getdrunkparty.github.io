#!/usr/bin/env python3
"""Small local SQLite account API backend used by server.mjs."""

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import time
import uuid
from pathlib import Path


HERE = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("ZEVYRA_DATABASE_PATH", HERE / "zevyra.sqlite")).resolve()
SCHEMA_PATH = HERE / "001_users.sql"
UID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PBKDF2_ITERATIONS = 310_000
SESSION_SECONDS = 30 * 24 * 60 * 60
USERNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    try:
        os.chmod(DB_PATH, 0o600)
    except OSError:
        pass
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return connection


def public_user(row):
    return {
        "id": row["id"],
        "public_uid": row["public_uid"],
        "username": row["username"],
        "avatar": row["avatar"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def issue_session(connection, user_id):
    connection.execute("DELETE FROM local_sessions WHERE expires_at <= ?", (int(time.time()),))
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("ascii")).hexdigest()
    connection.execute(
        "INSERT INTO local_sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (token_hash, user_id, int(time.time()) + SESSION_SECONDS),
    )
    row = connection.execute("SELECT * FROM local_users WHERE id = ?", (user_id,)).fetchone()
    return {"access_token": token, "user": public_user(row)}


def valid_username(value):
    username = str(value or "").strip()
    if not USERNAME_RE.fullmatch(username):
        raise ApiError(400, "El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.")
    return username


def valid_avatar(value):
    if value is None or value == "":
        return None
    avatar = str(value)
    if len(avatar) > 4096 or not avatar.startswith("https://api.dicebear.com/10.x/big-smile/svg?"):
        raise ApiError(400, "El avatar no es válido.")
    return avatar


def validate_password(value):
    password = str(value or "")
    if len(password) < 8 or len(password) > 256:
        raise ApiError(400, "La contraseña debe tener entre 8 y 256 caracteres.")
    return password


def new_uid(connection):
    while True:
        candidate = "".join(secrets.choice(UID_ALPHABET) for _ in range(8))
        exists = connection.execute(
            "SELECT 1 FROM local_users WHERE public_uid = ?", (candidate,)
        ).fetchone()
        if not exists:
            return candidate


def current_user(connection, token):
    if not token:
        raise ApiError(401, "Inicia sesión de nuevo para continuar.")
    token_hash = hashlib.sha256(str(token).encode("utf-8")).hexdigest()
    row = connection.execute(
        """SELECT u.* FROM local_sessions s
           JOIN local_users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ?""",
        (token_hash, int(time.time())),
    ).fetchone()
    if not row:
        raise ApiError(401, "La sesión local venció. Inicia sesión de nuevo.")
    return row


def handle(payload):
    operation = payload.get("operation")
    with connect_db() as connection:
        if operation == "init":
            return {"database": "SQLite", "tables": ["local_users", "local_sessions"]}

        if operation == "register":
            username = valid_username(payload.get("username"))
            password = validate_password(payload.get("password"))
            avatar = valid_avatar(payload.get("avatar"))
            salt = secrets.token_bytes(16)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
            user_id = str(uuid.uuid4())
            try:
                connection.execute(
                    """INSERT INTO local_users
                       (id, public_uid, username, avatar, password_salt, password_hash)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (user_id, new_uid(connection), username, avatar, salt.hex(), digest.hex()),
                )
            except sqlite3.IntegrityError as error:
                if "username" in str(error).lower():
                    raise ApiError(409, "Ese nickname ya está registrado en esta base local.") from error
                raise ApiError(409, "No se pudo reservar el identificador del perfil. Inténtalo otra vez.") from error
            return issue_session(connection, user_id)

        if operation == "login":
            username = valid_username(payload.get("username"))
            password = str(payload.get("password") or "")
            row = connection.execute(
                "SELECT * FROM local_users WHERE username = ? COLLATE NOCASE", (username,)
            ).fetchone()
            if not row or not password:
                raise ApiError(401, "El usuario o la contraseña no coinciden.")
            salt = bytes.fromhex(row["password_salt"])
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
            if not hmac.compare_digest(digest.hex(), row["password_hash"]):
                raise ApiError(401, "El usuario o la contraseña no coinciden.")
            return issue_session(connection, row["id"])

        if operation == "me":
            return {"user": public_user(current_user(connection, payload.get("token")))}

        if operation == "update":
            row = current_user(connection, payload.get("token"))
            username = valid_username(payload.get("username"))
            avatar = valid_avatar(payload.get("avatar"))
            try:
                connection.execute(
                    "UPDATE local_users SET username = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (username, avatar, row["id"]),
                )
            except sqlite3.IntegrityError as error:
                raise ApiError(409, "Ese nickname ya está registrado en esta base local.") from error
            updated = connection.execute("SELECT * FROM local_users WHERE id = ?", (row["id"],)).fetchone()
            return {"user": public_user(updated)}

        if operation == "logout":
            token = payload.get("token")
            if token:
                token_hash = hashlib.sha256(str(token).encode("utf-8")).hexdigest()
                connection.execute("DELETE FROM local_sessions WHERE token_hash = ?", (token_hash,))
            return {"ok": True}

    raise ApiError(404, "No existe esa operación de cuenta local.")


def main():
    try:
        payload = json.load(sys.stdin)
        result = handle(payload if isinstance(payload, dict) else {})
        print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    except ApiError as error:
        print(json.dumps({"ok": False, "status": error.status, "message": str(error)}, ensure_ascii=False))
    except Exception:
        print(json.dumps({"ok": False, "status": 500, "message": "La base de datos local no pudo completar la operación."}, ensure_ascii=False))


if __name__ == "__main__":
    main()
