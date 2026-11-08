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
UID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
PBKDF2_ITERATIONS = 310_000
# Local sessions last until the user explicitly signs out. Keep an expiry column
# for database cleanup and compatibility, but set new sessions to year 9999.
SESSION_EXPIRES_AT = 253402300799
USERNAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$")
COUNTRY_CODE_RE = re.compile(r"^(?:[A-Z]{2}|OTHER)$")


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
    migrate_existing_schema(connection)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    connection.execute(
        "UPDATE local_sessions SET expires_at = ? WHERE expires_at < ?",
        (SESSION_EXPIRES_AT, SESSION_EXPIRES_AT),
    )
    return connection


def migrate_existing_schema(connection):
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'local_users'"
    ).fetchone()
    if not exists:
        return
    columns = {row[1] for row in connection.execute("PRAGMA table_info(local_users)")}
    required = {"country_code", "age", "sex", "sexual_identity", "reward_cards_json", "fragments_json"}
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version >= 3 and required.issubset(columns):
        return

    country = "COALESCE(country_code, 'XX')" if "country_code" in columns else "'XX'"
    rewards = "COALESCE(reward_cards_json, '[]')" if "reward_cards_json" in columns else "'[]'"
    fragments = "COALESCE(fragments_json, '[]')" if "fragments_json" in columns else "'[]'"
    age = "age" if "age" in columns else "NULL"
    sex = "COALESCE(sex, '')" if "sex" in columns else "''"
    sexual_identity = "COALESCE(sexual_identity, '')" if "sexual_identity" in columns else "''"
    has_sessions = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'local_sessions'"
    ).fetchone()
    copy_sessions = (
        "INSERT INTO local_sessions_v2 (token_hash, user_id, expires_at, created_at) "
        "SELECT token_hash, user_id, expires_at, created_at FROM local_sessions;"
        if has_sessions else ""
    )
    connection.execute("PRAGMA foreign_keys = OFF")
    try:
        connection.executescript(f"""
          BEGIN IMMEDIATE;
          DROP TABLE IF EXISTS local_sessions_v2;
          DROP TABLE IF EXISTS local_users_v2;
          CREATE TABLE local_users_v2 (
            id TEXT PRIMARY KEY,
            public_uid TEXT NOT NULL UNIQUE CHECK (
              (length(public_uid) = 8 AND public_uid NOT GLOB '*[^A-Z0-9]*') OR
              (length(public_uid) = 10 AND substr(public_uid, 1, 4) = 'zevy'
               AND substr(public_uid, 5) NOT GLOB '*[^A-Za-z0-9]*')
            ),
            username TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(username)) BETWEEN 3 AND 32),
            avatar TEXT,
            country_code TEXT NOT NULL DEFAULT 'XX',
            age INTEGER CHECK (age IS NULL OR age BETWEEN 1 AND 120),
            sex TEXT NOT NULL DEFAULT '',
            sexual_identity TEXT NOT NULL DEFAULT '',
            reward_cards_json TEXT NOT NULL DEFAULT '[]',
            fragments_json TEXT NOT NULL DEFAULT '[]',
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO local_users_v2 (
            id, public_uid, username, avatar, country_code, age, sex, sexual_identity,
            reward_cards_json, fragments_json, password_salt, password_hash, created_at, updated_at
          ) SELECT id, public_uid, username, avatar, {country}, {age}, {sex}, {sexual_identity}, {rewards}, {fragments},
                   password_salt, password_hash, created_at, updated_at
            FROM local_users;
          CREATE TABLE local_sessions_v2 (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES local_users_v2(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          {copy_sessions}
          DROP TABLE IF EXISTS local_sessions;
          DROP TABLE local_users;
          ALTER TABLE local_users_v2 RENAME TO local_users;
          ALTER TABLE local_sessions_v2 RENAME TO local_sessions;
          CREATE INDEX IF NOT EXISTS local_sessions_expiry_idx ON local_sessions(expires_at);
          PRAGMA user_version = 3;
          COMMIT;
        """)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.execute("PRAGMA foreign_keys = ON")


def public_user(row):
    def json_array(column):
        try:
            value = json.loads(row[column])
            return value if isinstance(value, list) else []
        except (KeyError, TypeError, json.JSONDecodeError):
            return []

    return {
        "id": row["id"],
        "public_uid": row["public_uid"],
        "username": row["username"],
        "avatar": row["avatar"],
        "country_code": row["country_code"],
        "age": row["age"],
        "sex": row["sex"],
        "sexual_identity": row["sexual_identity"],
        "cartasPremio": json_array("reward_cards_json"),
        "fragmentos": json_array("fragments_json"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def issue_session(connection, user_id):
    connection.execute("DELETE FROM local_sessions WHERE expires_at <= ?", (int(time.time()),))
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("ascii")).hexdigest()
    connection.execute(
        "INSERT INTO local_sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (token_hash, user_id, SESSION_EXPIRES_AT),
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
    if len(avatar) > 4096 or not re.fullmatch(r"https://api\.dicebear\.com/(?:7|10)\.x/big-smile/svg\?.{1,3900}", avatar):
        raise ApiError(400, "El avatar no es válido.")
    return avatar


def valid_country_code(value):
    country_code = str(value or "XX").upper()
    if not COUNTRY_CODE_RE.fullmatch(country_code):
        raise ApiError(400, "Selecciona una nacionalidad válida.")
    return country_code


def valid_age(value, required=True):
    if value is None or str(value).strip() == "":
        if required:
            raise ApiError(400, "Indica una edad entre 1 y 120.")
        return None
    try:
        age = int(value)
    except (TypeError, ValueError) as error:
        raise ApiError(400, "La edad debe ser un número entero.") from error
    if age < 1 or age > 120:
        raise ApiError(400, "La edad debe estar entre 1 y 120.")
    return age


def valid_sex(value, required=True):
    sex = str(value or "").strip()
    if not sex and not required:
        return ""
    if sex not in {"Mujer", "Hombre", "No binario", "Prefiero no decirlo"}:
        raise ApiError(400, "Selecciona una opción de sexo válida.")
    return sex


def valid_sexual_identity(value):
    identity = str(value or "").strip()
    if len(identity) > 80:
        raise ApiError(400, "La identidad sexual no puede superar 80 caracteres.")
    return identity


def validate_password(value):
    password = str(value or "")
    if len(password) < 8 or len(password) > 256:
        raise ApiError(400, "La contraseña debe tener entre 8 y 256 caracteres.")
    return password


def new_uid(connection):
    while True:
        candidate = "zevy" + "".join(secrets.choice(UID_ALPHABET) for _ in range(6))
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
            country_code = valid_country_code(payload.get("country_code"))
            age = valid_age(payload.get("age"))
            sex = valid_sex(payload.get("sex"))
            sexual_identity = valid_sexual_identity(payload.get("sexual_identity"))
            salt = secrets.token_bytes(16)
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
            user_id = str(uuid.uuid4())
            try:
                connection.execute(
                    """INSERT INTO local_users
                       (id, public_uid, username, avatar, country_code, age, sex, sexual_identity, password_salt, password_hash)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, new_uid(connection), username, avatar, country_code, age, sex, sexual_identity, salt.hex(), digest.hex()),
                )
            except sqlite3.IntegrityError as error:
                if "username" in str(error).lower():
                    raise ApiError(409, "Ese nickname ya está en uso.") from error
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
            avatar = valid_avatar(payload.get("avatar", row["avatar"]))
            country_code = valid_country_code(payload.get("country_code", row["country_code"]))
            age = valid_age(payload.get("age", row["age"]), required=False)
            sex = valid_sex(payload.get("sex", row["sex"]), required=bool(payload.get("sex", row["sex"])))
            sexual_identity = valid_sexual_identity(payload.get("sexual_identity", row["sexual_identity"]))
            try:
                connection.execute(
                    "UPDATE local_users SET username = ?, avatar = ?, country_code = ?, age = ?, sex = ?, sexual_identity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (username, avatar, country_code, age, sex, sexual_identity, row["id"]),
                )
            except sqlite3.IntegrityError as error:
                raise ApiError(409, "Ese nickname ya está en uso.") from error
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
