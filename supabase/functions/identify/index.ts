// Supabase Edge Function: mushroom photo checks with per-plan limits and a monthly budget for free users.
// Secret needed: KINDWISE_API_KEY (mushroom.id by Kindwise). Optional: FREE_MONTHLY_BUDGET (default 300).
//
// Returns { suggestions: [{ latin, name, probability }], remaining }
//      or { error: "login" | "quota" | "busy" | "unavailable" | "image" }.
// POST { action: "reward" } after three rewarded ads → { ok: true } or { error: "ad_limit" | "not_free" }.
// Suggestions are possibilities only; the app always shows a safety warning.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Photo checks per user. Kindwise costs up to €0.05 per check, so the most a
// fully-used plan can cost stays well below its price after VAT and card fees.
const LIMITS: Record<string, { n: number; days: number }> = {
  free: { n: 0, days: 30 },        // free users only get checks unlocked by watching ads
  season: { n: 40, days: 365 },    // €4.99 → max €2.00 in checks
  supporter: { n: 100, days: 365 }, // €9.99 → max €5.00 in checks
};
// Rewarded ads: a free user unlocks 1 check per 3 ads, at most once every 7 days.
// Ad completion can't be verified server-side on the web, so this cap (and FREE_BUDGET) bounds any abuse
// (5 × €0.05 = €0.25 per user per month at most).
const AD_PER_WEEK = 1, AD_PER_MONTH = 5;
// All free users together can use at most this many checks per calendar month.
const FREE_BUDGET = Number(Deno.env.get("FREE_MONTHLY_BUDGET") ?? "300");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "login" }, 401);

    const { data: prof } = await admin.from("profiles").select("plan, plan_expires_at").eq("id", user.id).single();
    let plan = prof?.plan ?? "free";
    if (plan !== "free" && prof?.plan_expires_at && new Date(prof.plan_expires_at) < new Date()) plan = "free";
    const lim = { ...(LIMITS[plan] ?? LIMITS.free) };
    const body = await req.json();

    // Rewards earned in the last 30 days add to the free allowance.
    let bonus = 0;
    if (plan === "free") {
      const { count: b } = await admin.from("ad_rewards").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
      bonus = b ?? 0;
    }

    if (body.action === "reward") {
      if (plan !== "free") return json({ error: "not_free" });
      const { count: week } = await admin.from("ad_rewards").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString());
      if ((week ?? 0) >= AD_PER_WEEK || bonus >= AD_PER_MONTH) return json({ error: "ad_limit" });
      await admin.from("ad_rewards").insert({ user_id: user.id });
      return json({ ok: true });
    }
    lim.n += bonus;

    const since = new Date(Date.now() - lim.days * 864e5).toISOString();
    const { count } = await admin.from("id_usage").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", since);
    const used = count ?? 0;
    if (used >= lim.n) {
      // Tell the app whether watching ads could unlock one more check.
      const adOk = plan === "free" && bonus < AD_PER_MONTH;  // app may offer ads
      return json({ error: "quota", remaining: 0, adOk });
    }

    if (plan === "free") {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const { count: freeUsed } = await admin.from("id_usage").select("id", { count: "exact", head: true })
        .eq("plan", "free").gte("created_at", monthStart);
      if ((freeUsed ?? 0) >= FREE_BUDGET) return json({ error: "busy" });
    }

    const { image, lang } = body;
    if (!image) return json({ error: "image" }, 400);

    const key = Deno.env.get("KINDWISE_API_KEY");
    if (!key) return json({ error: "unavailable" });
    const language = /^[a-z]{2}$/.test(lang ?? "") ? lang : "en";
    const r = await fetch(`https://mushroom.kindwise.com/api/v1/identification?details=common_names&language=${language}`, {
      method: "POST",
      headers: { "Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ images: [image], similar_images: false }),
    });
    if (!r.ok) {
      console.error("kindwise", r.status, await r.text());
      return json({ error: "unavailable" });
    }
    const out = await r.json();
    const sugg = (out?.result?.classification?.suggestions ?? []).map((s: any) => ({
      latin: s.name, name: s.details?.common_names?.[0] ?? s.name, probability: s.probability,
    }));

    await admin.from("id_usage").insert({
      user_id: user.id, plan, top_latin: sugg[0]?.latin ?? null, top_probability: sugg[0]?.probability ?? null,
    });
    return json({ suggestions: sugg, remaining: Math.max(0, lim.n - used - 1) });
  } catch (e) {
    console.error(e);
    return json({ error: "unavailable" }, 500);
  }
});
