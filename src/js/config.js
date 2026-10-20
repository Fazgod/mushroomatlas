// Fill these in after creating the Supabase project (Project Settings → API).
// The anon key is public by design; Row Level Security in the database protects the data.
export const SUPABASE_URL = "https://yntcqutgvfepweolgrwl.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InludGNxdXRndmZlcHdlb2xncndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTYyMjMsImV4cCI6MjEwNzk5MjIyM30.DjQ8ZXkSLGobMwKCN5YiBhKd4qxkLy9IZ0S5ovn8Cp4";

export const LANGS = ["en","de","fr","es","it","pl","da","sv","lt","ru"];
export const DEFAULT_LANG = "en";
export const SITE = "https://mushroomatlas.eu";

// Free identifications per month for signed-in free users (enforced server-side too)
export const FREE_IDS_PER_MONTH = 3;

// Rewarded ads ("watch 2 ads → 1 extra photo check"). Google Ad Manager rewarded ad unit path,
// e.g. "/1234567/mushroomatlas_rewarded". Empty = feature hidden.
export const AD_UNIT_REWARDED = "";
