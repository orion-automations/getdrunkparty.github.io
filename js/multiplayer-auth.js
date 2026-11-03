import { supabase } from "./supabase.js";

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
