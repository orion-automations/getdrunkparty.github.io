import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, extname, sep } from "node:path";
const root = resolve("."),
  userDatabaseScript = resolve(root, "database/local_users.py"),
  userDatabaseFile = resolve(root, "database/zevyra.sqlite"),
  mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(Object.assign(new Error("La solicitud supera el tamaño permitido."), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolveBody(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error("El cuerpo JSON no es válido."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function runLocalUserDatabase(operation, token, fields = {}) {
  return new Promise((resolveResult, reject) => {
    const python = spawn(process.env.PYTHON || "python3", [userDatabaseScript], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let errorOutput = "";
    python.stdout.setEncoding("utf8").on("data", (part) => { output += part; });
    python.stderr.setEncoding("utf8").on("data", (part) => { errorOutput += part; });
    python.on("error", (error) => reject(Object.assign(error, { status: 503 })));
    python.on("close", (code) => {
      try {
        const result = JSON.parse(output);
        resolveResult(result);
      } catch {
        reject(Object.assign(new Error(errorOutput.trim() || `SQLite local terminó con código ${code}.`), { status: 500 }));
      }
    });
    python.stdin.end(JSON.stringify({ operation, token, ...fields }));
  });
}

async function handleLocalUsers(req, res, pathname) {
  const routes = {
    "POST /api/users/register": ["register", true],
    "POST /api/users/login": ["login", true],
    "GET /api/users/me": ["me", false],
    "PUT /api/users/me": ["update", true],
    "DELETE /api/users/session": ["logout", false],
  };
  const route = routes[`${req.method} ${pathname}`];
  if (!route) {
    sendJson(res, 404, { ok: false, message: "Ruta local de usuarios no encontrada." });
    return;
  }
  try {
    const fields = route[1] ? await readJsonBody(req) : {};
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || null;
    const result = await runLocalUserDatabase(route[0], token, fields);
    sendJson(res, result.status || (result.ok ? 200 : 400), result);
  } catch (error) {
    sendJson(res, error.status || 500, { ok: false, message: error.message || "La base de datos local no respondió." });
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.startsWith("/api/users/")) {
      await handleLocalUsers(req, res, pathname);
      return;
    }
    const path = resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (path === userDatabaseFile || path.startsWith(`${userDatabaseFile}-`)) {
      res.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
const host = process.env.HOST || "127.0.0.1";
server.listen(Number(process.env.PORT) || 8000, host, () =>
  console.log(
    `Carnival of Chaos · Circus Zevyra disponible en http://${host === "0.0.0.0" ? "localhost" : host}:${server.address().port}`,
  ),
);
