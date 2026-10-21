// Photo identification (suggestions only, with strong safety messaging).
// What the user sees depends on what they have left (from the server):
//   "run"  – checks from their plan, a check pack, or an earned ad unlock → normal Identify button
//   "ads"  – free user who can earn a check by watching 3 short ads
//   "none" – nothing left → explain and point to plans / check pack
import { identify, idStatus, currentUser, rewardAd } from "../supabase.js";
import { adsEnabled, watchAds } from "../ads.js";
import { card } from "./atlas.js";

export async function view(ctx, _arg, app) {
  const T = ctx.L, e = ctx.esc;
  ctx.title = T.idTitle;
  const can = ctx.backendReady && currentUser();
  const st = can ? await idStatus().catch(() => null) : null;
  const left = st ? st.planLeft + st.packLeft + st.adLeft : 0;
  const mode = !st ? "run" : left > 0 ? "run" : st.plan === "free" && st.adCanEarn && adsEnabled() ? "ads" : "none";
  const plans = `<a class="btn" href="${ctx.url("plans")}" data-link>${T.pricing}</a>`;
  const noneMsg = st && st.plan === "free" ? (adsEnabled() && !st.adCanEarn ? `${T.adLimit} ${T.idPackHint}` : `${T.idPaid} ${T.idPackHint}`) : `${T.idOut}`;

  app.innerHTML = `<section class="pagehead narrow"><h1>${T.idTitle}</h1><p>${T.idLead}</p>
    <div class="warn"><div><strong>⚠ ${T.caution}.</strong> ${T.idDisclaimer}</div></div></section>
    <div class="narrow">
    ${!can ? `<div class="notice">${ctx.backendReady ? T.needLogin : T.backendSoon}</div>${ctx.backendReady ? `<a class="btn" href="${ctx.url("login")}" data-link>${T.signIn}</a>` : ""}`
      : mode === "none" ? `<div class="notice">${noneMsg}</div>${plans}`
      : `<form id="idform" class="form"><label>${T.idPick}<input id="i-photo" type="file" accept="image/*" capture="environment" required></label>
      <img id="i-prev" class="prev" alt="" hidden>
      <button class="btn" id="i-run">${mode === "ads" ? "▶ " + T.adOffer : T.idRun}</button>
      ${mode === "ads" ? `<p class="hint">${T.adWhy}</p>` : left ? `<p class="hint">${T.idLeft(left)}</p>` : ""}
      <p id="i-msg" class="hint" role="status"></p></form>`}
    <div id="i-out"></div></div>`;
  if (!can || mode === "none") return;

  const inp = document.querySelector("#i-photo");
  inp.onchange = () => { const f = inp.files[0]; if (f) { const i = document.querySelector("#i-prev"); i.src = URL.createObjectURL(f); i.hidden = false; } };
  let needAds = mode === "ads";
  document.querySelector("#idform").onsubmit = async ev => {
    ev.preventDefault();
    const msg = document.querySelector("#i-msg"), out = document.querySelector("#i-out"), btn = document.querySelector("#i-run");
    if (!inp.files[0]) return;
    btn.disabled = true; msg.textContent = "…"; out.innerHTML = "";
    const toPlans = `<a href="${ctx.url("plans")}" data-link>${T.pricing} →</a>`;
    try {
      if (needAds) {
        const watched = await watchAds(n => { msg.textContent = T.adStep(n); });
        if (!watched) { msg.textContent = T.adNone; return; }
        const g = await rewardAd();
        if (!g.ok) { msg.innerHTML = `${g.error === "ad_limit" ? T.adLimit : g.error === "busy" ? T.idBusy : T.idDown} ${toPlans}`; return; }
        needAds = false; // the unlocked check stays available if the next step fails
        msg.textContent = "…";
      }
      const r = await identify(inp.files[0], ctx.lang);
      if (r.error === "quota" || r.error === "busy") { msg.innerHTML = `${r.error === "busy" ? T.idBusy : T.idOut} ${toPlans}`; return; }
      if (r.error) { msg.textContent = T.idDown; return; }
      msg.textContent = r.remaining ? T.idLeft(r.remaining) : "";
      if (!r.remaining && mode === "ads") btn.hidden = true;
      const byLat = Object.fromEntries(ctx.D.map(m => [m.lat.toLowerCase(), m]));
      const rows = (r.suggestions || []).slice(0, 5).map(s => {
        const m = byLat[(s.latin || "").toLowerCase()];
        return `<li class="match"><div class="pct">${Math.round((s.probability || 0) * 100)}%<small>${T.idConf}</small></div>
          ${m ? card(ctx, m) : `<div class="card"><div class="bd"><h3>${e(s.name || s.latin)}</h3><div class="lat">${e(s.latin)}</div></div></div>`}</li>`;
      }).join("");
      out.innerHTML = `<h2 class="sub">${T.idMatches}</h2><ul class="matches">${rows}</ul>`;
    } catch (err) { msg.textContent = T.idDown; }
    finally { btn.disabled = false; }
  };
}
