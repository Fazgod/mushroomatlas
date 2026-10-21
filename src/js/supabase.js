import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const backendReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let client = null;
let user = null;
const listeners = new Set();

export async function sb() {
  if (!backendReady) return null;
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
    const { data } = await client.auth.getSession();
    user = data.session?.user ?? null;
    client.auth.onAuthStateChange((_e, session) => { user = session?.user ?? null; listeners.forEach(f => f(user)); });
  }
  return client;
}
export const currentUser = () => user;
export const onAuth = f => { listeners.add(f); return () => listeners.delete(f); };

export async function signInGoogle(lang) {
  const c = await sb(); if (!c) return;
  await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/${lang}/account` } });
}
export async function signInEmail(email, lang) {
  const c = await sb(); if (!c) return { error: { message: "backend" } };
  return c.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/${lang}/account` } });
}
export async function signOut() { const c = await sb(); if (c) await c.auth.signOut(); }

export async function getProfile() {
  const c = await sb(); if (!c || !user) return null;
  const { data } = await c.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

// Public finds: approximate coordinates come from the finds_public view.
export async function listPublicFinds(bounds) {
  const c = await sb(); if (!c) return [];
  let q = c.from("finds_public").select("*").limit(1000);
  if (bounds) q = q.gte("lat", bounds.s).lte("lat", bounds.n).gte("lng", bounds.w).lte("lng", bounds.e);
  const { data } = await q; return data || [];
}
export async function listMyFinds() {
  const c = await sb(); if (!c || !user) return [];
  const { data } = await c.from("finds").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  return data || [];
}
export function photoUrl(path) {
  if (!path || !backendReady) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/finds/${path}`;
}

// Re-encode the image through a canvas: this drops EXIF (including GPS) and shrinks it.
export async function cleanImage(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
}

export async function addFind({ file, species_slug, species_guess, note, lat, lng, accuracy_m, visibility, observed_at }) {
  const c = await sb(); if (!c || !user) throw new Error("login");
  const blob = await cleanImage(file);
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const up = await c.storage.from("finds").upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { data, error } = await c.from("finds").insert({ species_slug, species_guess, note, lat, lng, accuracy_m, visibility, observed_at, photo_path: path }).select().single();
  if (error) throw error;
  return data;
}

export async function identify(file, lang) {
  const c = await sb(); if (!c || !user) throw new Error("login");
  const blob = await cleanImage(file, 1024);
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
  const { data, error } = await c.functions.invoke("identify", { body: { image: b64, lang } });
  if (error) return { error: "unavailable" };
  return data; // { suggestions:[{latin, probability}], remaining }
}

// Record two watched rewarded ads → one extra photo check (capped server-side).
export async function rewardAd() {
  const c = await sb(); if (!c || !user) throw new Error("login");
  const { data, error } = await c.functions.invoke("identify", { body: { action: "reward" } });
  if (error) return { error: "unavailable" };
  return data;
}

// What photo checks the user has left: { plan, planLeft, packLeft, adLeft, adCanEarn }
export async function idStatus() {
  const c = await sb(); if (!c || !user) throw new Error("login");
  const { data, error } = await c.functions.invoke("identify", { body: { action: "status" } });
  if (error || !data || data.error) throw new Error("status");
  return data;
}
