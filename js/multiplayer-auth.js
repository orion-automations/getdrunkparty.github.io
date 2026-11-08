import { supabase } from "./supabase.js";

// Supabase identity is anonymous and exists only to authorize live room
// operations. Personal accounts use SQLite locally or IndexedDB on static hosts.
export async function ensureAnonymousIdentity() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  let user = sessionData.session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }
  if (!user) throw new Error("No se pudo crear la identidad temporal para la sala online.");
  return user;
}
