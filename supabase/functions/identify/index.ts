// Supabase Edge Function: photo identification with per-plan quota.
// Deploy: supabase functions deploy identify
// Secrets: supabase secrets set KINDWISE_API_KEY=...   (mushroom.id by Kindwise)
//
// Returns { suggestions: [{ latin, name, probability }], remaining } or { error: "quota" }.
// Suggestions are possibilities only; the app always shows a safety warning.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const LIMITS: Record<string, { n: number; days: number }> = {
  free: { n: 5, days: 30 },
  season: { n: 50, days: 365 },
  supporter: { n: 150, days: 365 },
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "login" }, 401);

    const { data: prof } = await admin.from("profiles").select("plan, plan_expires_at").eq("id", user.id).single();
    let plan = prof?.plan ?? "free";
    if (plan !== "free" && prof?.plan_expires_at && new Date(prof.plan_expires_at) < new Date()) plan = "free";
    const lim = LIMITS[plan] ?? LIMITS.free;
    const since = new Date(Date.now() - lim.days * 864e5).toISOString();
    const { count } = await admin.from("id_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    const used = count ?? 0;
    if (used >= lim.n) return json({ error: "quota", remaining: 0 });

    const { image } = await req.json();
    if (!image) return json({ error: "image" }, 400);

    // Kindwise mushroom.id API (check current docs: https://mushroom.kindwise.com/docs)
    const r = await fetch("https://mushroom.kindwise.com/api/v1/identification?details=common_names", {
      method: "POST",
      headers: { "Api-Key": Deno.env.get("KINDWISE_API_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify({ images: [image], similar_images: false }),
    });
    if (!r.ok) return json({ error: "provider", status: r.status }, 502);
    const out = await r.json();
    const sugg = (out?.result?.classification?.suggestions ?? []).map((s: any) => ({
      latin: s.name, name: s.details?.common_names?.[0] ?? s.name, probability: s.probability,
    }));

    await admin.from("id_usage").insert({ user_id: user.id, top_latin: sugg[0]?.latin ?? null, top_probability: sugg[0]?.probability ?? null });
    return json({ suggestions: sugg, remaining: Math.max(0, lim.n - used - 1) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
