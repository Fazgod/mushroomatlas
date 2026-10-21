// Supabase Edge Function: mushroom photo checks.
// Secret needed: KINDWISE_API_KEY (mushroom.id by Kindwise).
//
// Where a check comes from, in this order:
//   1. the user's plan (Season Pass 40/year, Supporter 100/year)
//   2. an ad unlock (free users: 3 rewarded ads → 1 check, at most once a week)
//   3. a bought check pack (10 checks, never expire)
// Ad-unlocked checks for all free users together are capped per month by app_settings.free_monthly_budget,
// which you set from last month's ad income ÷ €0.05, so ads always pay for the checks they unlock.
//
// POST { image, lang }        → { suggestions: [{ latin, name, probability }], remaining } or { error }
// POST { action: "status" }   → { plan, planLeft, packLeft, adLeft, adCanEarn }
// POST { action: "reward" }   → { ok: true } or { error: "ad_limit" | "busy" | "not_free" }  (after 3 ads)
// Errors: "login" | "quota" | "busy" | "unavailable" | "image". Suggestions are possibilities only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Kindwise costs up to €0.05 per check, so even a fully-used plan stays below its price after VAT and card fees.
const LIMITS: Record<string, { n: number; days: number }> = {
  free: { n: 0, days: 30 },
  season: { n: 40, days: 365 },     // €4.99 → max €2.00 in checks
  supporter: { n: 100, days: 365 }, // €9.99 → max €5.00 in checks
};
// Ad completion can't be verified server-side on the web; the weekly cap and the monthly budget bound any abuse.
const AD_PER_WEEK = 1;
const DAY = 864e5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "login" }, 401);
    const body = await req.json().catch(() => ({}));
    const iso = (ms: number) => new Date(Date.now() - ms).toISOString();
    const count = async (table: string, f: (q: any) => any) => {
      const { count } = await f(admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id));
      return count ?? 0;
    };

    // Plan (expired paid plans fall back to free)
    const { data: prof } = await admin.from("profiles").select("plan, plan_expires_at").eq("id", user.id).single();
    let plan = prof?.plan ?? "free";
    if (plan !== "free" && prof?.plan_expires_at && new Date(prof.plan_expires_at) < new Date()) plan = "free";
    const lim = LIMITS[plan] ?? LIMITS.free;

    // What's left from each source
    const planUsed = lim.n ? await count("id_usage", q => q.eq("source", "plan").gte("created_at", iso(lim.days * DAY))) : 0;
    const planLeft = Math.max(0, lim.n - planUsed);
    const { data: packs } = await admin.from("check_packs").select("checks").eq("user_id", user.id);
    const packBought = (packs ?? []).reduce((a: number, p: any) => a + p.checks, 0);
    const packLeft = packBought ? Math.max(0, packBought - await count("id_usage", q => q.eq("source", "pack"))) : 0;
    let adLeft = 0, adThisWeek = 0;
    if (plan === "free") {
      const earned = await count("ad_rewards", q => q.gte("created_at", iso(30 * DAY)));
      const spent = earned ? await count("id_usage", q => q.eq("source", "ad").gte("created_at", iso(30 * DAY))) : 0;
      adLeft = Math.max(0, earned - spent);
      adThisWeek = await count("ad_rewards", q => q.gte("created_at", iso(7 * DAY)));
    }

    // Monthly budget for ad-unlocked checks (all free users together)
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "free_monthly_budget").maybeSingle();
    const budget = Number(setting?.value ?? Deno.env.get("FREE_MONTHLY_BUDGET") ?? "0");
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const budgetLeft = async () => {
      const { count: c } = await admin.from("id_usage").select("id", { count: "exact", head: true })
        .eq("source", "ad").gte("created_at", monthStart);
      return budget - (c ?? 0);
    };

    if (body.action === "status") {
      const adCanEarn = plan === "free" && adLeft === 0 && adThisWeek < AD_PER_WEEK && (await budgetLeft()) > 0;
      return json({ plan, planLeft, packLeft, adLeft, adCanEarn });
    }

    if (body.action === "reward") {
      if (plan !== "free") return json({ error: "not_free" });
      if (adThisWeek >= AD_PER_WEEK || adLeft > 0) return json({ error: "ad_limit" });
      if ((await budgetLeft()) <= 0) return json({ error: "busy" });
      await admin.from("ad_rewards").insert({ user_id: user.id });
      return json({ ok: true });
    }

    // Pick the source for this check
    let source = planLeft > 0 ? "plan" : adLeft > 0 ? "ad" : packLeft > 0 ? "pack" : "";
    if (!source) return json({ error: "quota", remaining: 0, adOk: plan === "free" && adThisWeek < AD_PER_WEEK });
    if (source === "ad" && (await budgetLeft()) <= 0) {
      if (packLeft > 0) source = "pack"; else return json({ error: "busy" });
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
      user_id: user.id, plan, source, top_latin: sugg[0]?.latin ?? null, top_probability: sugg[0]?.probability ?? null,
    });
    const remaining = planLeft + packLeft + adLeft - 1;
    return json({ suggestions: sugg, remaining: Math.max(0, remaining) });
  } catch (e) {
    console.error(e);
    return json({ error: "unavailable" }, 500);
  }
});
