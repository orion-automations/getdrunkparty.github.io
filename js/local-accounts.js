const SESSION_KEY = "zevyra.local.account.session";

function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return value?.accessToken && value?.user ? value : null;
  } catch {
    return null;
  }
}

function saveSession(payload) {
  const value = { accessToken: payload.access_token, user: payload.user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value.user;
}

async function request(path, method = "GET", body = null, accessToken = readSession()?.accessToken) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("No se pudo conectar con la base SQLite local. Abre la app desde npm run serve.");
  }
  let result = {};
  try { result = await response.json(); } catch { /* handled below */ }
  if (!response.ok || result.ok === false) {
    const error = new Error(result.message || `La base local respondió ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export function getCachedLocalAccount() {
  return readSession()?.user ?? null;
}

export function hasLocalAccountSession() {
  return Boolean(readSession()?.accessToken);
}

export async function getLocalAccount() {
  const session = readSession();
  if (!session) return null;
  try {
    const result = await request("/api/users/me", "GET", null, session.accessToken);
    const next = { ...session, user: result.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return result.user;
  } catch (error) {
    if (error.status === 401) localStorage.removeItem(SESSION_KEY);
    throw error;
  }
}

export async function registerLocalAccount(username, password, avatar = null) {
  const result = await request("/api/users/register", "POST", { username, password, avatar }, null);
  return saveSession(result);
}

export async function signInLocalAccount(username, password) {
  const result = await request("/api/users/login", "POST", { username, password }, null);
  return saveSession(result);
}

export async function updateLocalAccount(username, avatar = null) {
  const session = readSession();
  if (!session) return null;
  const result = await request("/api/users/me", "PUT", { username, avatar }, session.accessToken);
  const next = { ...session, user: result.user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return result.user;
}

export async function signOutLocalAccount() {
  const session = readSession();
  if (session) {
    try { await request("/api/users/session", "DELETE", null, session.accessToken); }
    catch { /* remove the local token even if the server is already stopped */ }
    localStorage.removeItem(SESSION_KEY);
  }
}
