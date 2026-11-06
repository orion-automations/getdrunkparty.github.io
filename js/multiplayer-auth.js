import { supabase } from "./supabase.js";

function usernameEmail(username) {
  const normalized = String(username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
    throw new Error("El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.");
  }
  return `${normalized}@accounts.zevyra.invalid`;
}

export async function registerUsername(username, password, avatar = null) {
  const email = usernameEmail(username);
  if (String(password ?? "").length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: String(username).trim().slice(0, 32) } },
  });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("Supabase no inició sesión. Desactiva la confirmación por correo para usuarios con nombre y contraseña, ya que esta cuenta no usa email.");
  await saveProfile(data.user.id, username, avatar);
  return data.user;
}

export async function signInUsername(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password: String(password ?? "") });
  if (error) throw error;
  if (!data.user) throw new Error("No se pudo iniciar sesión.");
  return data.user;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentIdentity() {
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data?.user ?? null;
}

export async function ensureAnonymousIdentity() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  let user = sessionData.session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }
  if (!user) throw new Error("No se pudo crear la identidad online.");
  return user;
}

export async function saveProfile(userId, username, avatar = null) {
  const cleanName = String(username ?? "").trim().slice(0, 32);
  if (!cleanName) throw new Error("Escribe un nombre para jugar online.");
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, username: cleanName, avatar, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )
    .select("id, username, avatar, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
