const APP_BASE_URL = new URL("../", import.meta.url);
const APP_PATH = APP_BASE_URL.pathname.replace(/\/+$/, "") || "/";
const APP_SCOPE = `${location.host}:${APP_PATH}`;
const SESSION_KEY = `zevyra.local.account.session:${APP_SCOPE}`;
const LEGACY_SESSION_KEY = "zevyra.local.account.session";
const BROWSER_DB_NAME = `zevyra-browser-accounts:${APP_SCOPE}`;
const BROWSER_DB_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const UID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;
const VALID_SEX = new Set(["Mujer", "Hombre", "No binario", "Prefiero no decirlo"]);
let backendPromise;

function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY) || "null");
    return value?.accessToken && value?.user ? value : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

function saveSession(payload, mode) {
  const value = { accessToken: payload.access_token, user: payload.user, mode };
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value.user;
}

async function detectAccountBackend() {
  if (location.protocol === "file:" || !globalThis.fetch) return "browser";
  try {
    // The SQLite server returns 401 without a token. Static hosts return a 404/405.
    const probeUrl = new URL("api/users/me", APP_BASE_URL);
    const response = await fetch(probeUrl, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
    const serverMarker = response.headers.get("x-zevyra-local-accounts");
    if (serverMarker === "sqlite-v1") return "sqlite";
    // Keep compatibility with an already running older project server, while
    // refusing generic JSON 404/405 responses from static hosting.
    if (response.status === 401 && response.headers.get("content-type")?.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      if (/Inicia sesión de nuevo|La sesión local venció/i.test(payload?.message || "")) return "sqlite";
    }
  } catch { /* GitHub Pages and offline installations have no server API. */ }
  return "browser";
}

function accountBackend() {
  backendPromise ??= detectAccountBackend();
  return backendPromise;
}

function openBrowserDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("Este navegador no permite guardar cuentas locales."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BROWSER_DB_NAME, BROWSER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("users")) {
        const users = db.createObjectStore("users", { keyPath: "id" });
        users.createIndex("usernameKey", "usernameKey", { unique: true });
        users.createIndex("public_uid", "public_uid", { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local del navegador."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de esta app y vuelve a intentarlo."));
  });
}

async function readBrowserUser(indexName, key) {
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("users", "readonly");
    const request = transaction.objectStore("users").index(indexName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("No se pudo leer la cuenta local."));
    transaction.onabort = () => reject(transaction.error || new Error("No se pudo leer la cuenta local."));
  });
}

async function writeBrowserUser(user, operation) {
  const db = await openBrowserDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("users", "readwrite");
    transaction.objectStore("users")[operation](user);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar la cuenta local."));
    transaction.onabort = () => reject(transaction.error || new Error("No se pudo guardar la cuenta local."));
  });
}

function validateUsername(value) {
  const username = String(value || "").trim();
  if (!USERNAME_RE.test(username)) {
    throw new Error("El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.");
  }
  return username;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8 || password.length > 256) throw new Error("La contraseña debe tener entre 8 y 256 caracteres.");
  return password;
}

function validateAvatar(value) {
  if (value == null || value === "") return null;
  const avatar = String(value);
  if (avatar.length > 4096 || !/^https:\/\/api\.dicebear\.com\/(?:7|10)\.x\/big-smile\/svg\?.{1,3900}$/.test(avatar)) {
    throw new Error("El avatar seleccionado no es válido.");
  }
  return avatar;
}

function validateCountry(value) {
  const countryCode = String(value || "XX").toUpperCase();
  if (!/^(?:[A-Z]{2}|OTHER)$/.test(countryCode)) throw new Error("Selecciona una nacionalidad válida.");
  return countryCode;
}

function normalizeIdentity(identity = {}, { requireComplete = false } = {}) {
  const rawAge = identity.age;
  let age = rawAge == null || rawAge === "" ? null : Number(rawAge);
  if (age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) throw new Error("Indica una edad entre 1 y 120.");
  if (requireComplete && age === null) throw new Error("Indica una edad entre 1 y 120.");
  const sex = String(identity.sex || "").trim();
  if (sex && !VALID_SEX.has(sex)) throw new Error("Selecciona una opción de sexo válida.");
  if (requireComplete && !VALID_SEX.has(sex)) throw new Error("Selecciona una opción de sexo válida.");
  const sexual_identity = String(identity.sexual_identity || "").trim();
  if (sexual_identity.length > 80) throw new Error("La identidad sexual no puede superar 80 caracteres.");
  return { age, sex, sexual_identity };
}

function createSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, saltHex) {
  if (!globalThis.crypto?.subtle) throw new Error("El registro requiere una conexión HTTPS segura.");
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) || [], (pair) => Number.parseInt(pair, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalHash(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function createPublicUid() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const suffix = Array.from(bytes, (byte) => UID_ALPHABET[byte % UID_ALPHABET.length]).join("");
    const candidate = `zevy${suffix}`;
    if (!(await readBrowserUser("public_uid", candidate))) return candidate;
  }
  throw new Error("No se pudo reservar el UID. Inténtalo otra vez.");
}

function exposeBrowserUser(record) {
  if (!record) return null;
  const { usernameKey, passwordSalt, passwordHash, ...user } = record;
  return { ...user, cartasPremio: user.cartasPremio || [], fragmentos: user.fragmentos || [] };
}

async function registerInBrowser(username, password, avatar, countryCode, identity) {
  const normalizedName = validateUsername(username);
  const safePassword = validatePassword(password);
  const safeAvatar = validateAvatar(avatar);
  const country_code = validateCountry(countryCode);
  const details = normalizeIdentity(identity, { requireComplete: true });
  const passwordSalt = createSalt();
  const passwordHash = await hashPassword(safePassword, passwordSalt);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    public_uid: await createPublicUid(),
    username: normalizedName,
    usernameKey: normalizedName.toLowerCase(),
    avatar: safeAvatar,
    country_code,
    ...details,
    cartasPremio: [],
    fragmentos: [],
    created_at: now,
    updated_at: now,
    passwordSalt,
    passwordHash,
  };
  try {
    await writeBrowserUser(user, "add");
  } catch (error) {
    if (error?.name === "ConstraintError") throw new Error("Ese nickname ya está en uso en este navegador.");
    throw error;
  }
  return saveSession({ access_token: crypto.randomUUID(), user: exposeBrowserUser(user) }, "browser");
}

async function signInInBrowser(username, password) {
  const normalizedName = validateUsername(username);
  const safePassword = validatePassword(password);
  const record = await readBrowserUser("usernameKey", normalizedName.toLowerCase());
  if (!record) throw new Error("No hay una cuenta con ese nickname en este navegador.");
  const candidateHash = await hashPassword(safePassword, record.passwordSalt);
  if (!equalHash(candidateHash, record.passwordHash)) throw new Error("El usuario o la contraseña no coinciden.");
  return saveSession({ access_token: crypto.randomUUID(), user: exposeBrowserUser(record) }, "browser");
}

async function request(path, method = "GET", body = null, accessToken = readSession()?.accessToken) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response;
  try {
    response = await fetch(new URL(path.replace(/^\//, ""), APP_BASE_URL), { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  } catch {
    throw new Error("No se pudo conectar con el servicio local de cuentas.");
  }
  let result = {};
  try { result = await response.json(); } catch { /* handled below */ }
  if (!response.ok || result.ok === false) {
    const error = new Error(result.message || `El servicio local respondió ${response.status}.`);
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
  const mode = session.mode || await accountBackend();
  if (mode === "browser") {
    const record = await readBrowserUser("usernameKey", String(session.user.username || "").toLowerCase());
    if (record && record.id === session.user.id) {
      const user = exposeBrowserUser(record);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, mode, user }));
      return user;
    }
    // Keep existing SQLite sessions usable while the original server is unavailable.
    if (!session.mode && session.user) return session.user;
    clearSession();
    return null;
  }
  try {
    const result = await request("/api/users/me", "GET", null, session.accessToken);
    const next = { ...session, user: result.user, mode };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return result.user;
  } catch (error) {
    if (error.status === 401) clearSession();
    throw error;
  }
}

export async function registerLocalAccount(username, password, avatar = null, countryCode = "XX", identity = {}) {
  if (await accountBackend() === "browser") return registerInBrowser(username, password, avatar, countryCode, identity);
  const result = await request("/api/users/register", "POST", { username, password, avatar, country_code: countryCode, ...identity }, null);
  return saveSession(result, "sqlite");
}

export async function signInLocalAccount(username, password) {
  if (await accountBackend() === "browser") return signInInBrowser(username, password);
  const result = await request("/api/users/login", "POST", { username, password }, null);
  return saveSession(result, "sqlite");
}

export async function updateLocalAccount(username, avatar = null, countryCode = undefined, identity = {}) {
  const session = readSession();
  if (!session) return null;
  const mode = session.mode || await accountBackend();
  const normalizedName = validateUsername(username);
  const safeAvatar = validateAvatar(avatar);
  if (mode === "browser") {
    const record = await readBrowserUser("usernameKey", String(session.user.username || "").toLowerCase());
    if (!record || record.id !== session.user.id) {
      throw new Error("No se encontró esta cuenta en el almacenamiento de este navegador. Regístrala aquí para continuar.");
    }
    const next = {
      ...record,
      username: normalizedName,
      usernameKey: normalizedName.toLowerCase(),
      avatar: safeAvatar,
      country_code: countryCode === undefined ? record.country_code : validateCountry(countryCode),
      ...normalizeIdentity({
        age: Object.hasOwn(identity, "age") ? identity.age : record.age,
        sex: Object.hasOwn(identity, "sex") ? identity.sex : record.sex,
        sexual_identity: Object.hasOwn(identity, "sexual_identity") ? identity.sexual_identity : record.sexual_identity,
      }),
      updated_at: new Date().toISOString(),
    };
    try {
      await writeBrowserUser(next, "put");
    } catch (error) {
      if (error?.name === "ConstraintError") throw new Error("Ese nickname ya está en uso en este navegador.");
      throw error;
    }
    const user = exposeBrowserUser(next);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, mode, user }));
    return user;
  }
  const body = { username: normalizedName, avatar: safeAvatar };
  if (countryCode !== undefined) body.country_code = countryCode;
  for (const key of ["age", "sex", "sexual_identity"]) {
    if (Object.hasOwn(identity, key)) body[key] = identity[key];
  }
  const result = await request("/api/users/me", "PUT", body, session.accessToken);
  const next = { ...session, user: result.user, mode };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return result.user;
}

export async function signOutLocalAccount() {
  const session = readSession();
  if (session?.mode !== "browser") {
    try { await request("/api/users/session", "DELETE", null, session?.accessToken); }
    catch { /* Clear the browser session even if the local server is offline. */ }
  }
  clearSession();
}
