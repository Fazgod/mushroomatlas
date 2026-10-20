// Photo identification (suggestions only, with strong safety messaging)
import { identify, currentUser, rewardAd } from "../supabase.js";
import { adsEnabled, watchTwoAds } from "../ads.js";
import { card } from "./atlas.js";
import { planLevel } from "./hotspot.js";

export async function view(ctx, _arg, app) {
  const T = ctx.L, e = ctx.esc;
  ctx.title = T.idTitle;
  const can = ctx.backendReady && currentUser();
  const free = can ? (await planLevel()) === "free" : false;
  const plansLink = `<a class="btn" href="${ctx.url("plans")}" data-link>${T.pricing}</a>`;
  app.innerHTML = `<section class="pagehead narrow"><h1>${T.idTitle}</h1><p>${T.idLead}</p>
    <div class="warn"><div><strong>⚠ ${T.caution}.</strong> ${T.idDisclaimer}</div></div></section>
    <div class="narrow">
    ${can && free && !adsEnabled() ? `<div class="notice">${T.idPaid}</div>${plansLink}` : can ? `<form id="idform" class="form"><label>${T.idPick}<input id="i-photo" type="file" accept="image/*" capture="environment" required></label>
      <img id="i-prev" class="prev" alt="" hidden><button class="btn" id="i-run">${free ? "▶ " + T.adOffer : T.idRun}</button>${free ? `<p class="hint">${T.adWhy}</p>` : ""}<p id="i-msg" class="hint" role="status"></p></form>`
      : `<div class="notice">${ctx.backendReady ? T.needLogin : T.backendSoon}</div>${ctx.backendReady ? `<a class="btn" href="${ctx.url("login")}" data-link>${T.signIn}</a>` : ""}`}
    <div id="i-out"></div></div>`;
  if (!can || (free && !adsEnabled())) return;
  const inp = document.querySelector("#i-photo");
  inp.onchange = () => { const f = inp.files[0]; if (f) { const i = document.querySelector("#i-prev"); i.src = URL.createObjectURL(f); i.hidden = false; } };
  document.querySelector("#idform").onsubmit = async ev => {
    ev.preventDefault();
    const msg = document.querySelector("#i-msg"), out = document.querySelector("#i-out"), btn = document.querySelector("#i-run");
    if (!inp.files[0]) return;
    btn.disabled = true; msg.textContent = "…"; out.innerHTML = "";
    try {
      if (free) {
        // Free users unlock each check by watching 2 rewarded ads.
        const watched = await watchTwoAds(n => { msg.textContent = T.adStep(n); });
        if (!watched) { msg.textContent = T.adNone; return; }
        const g = await rewardAd();
        if (!g.ok) { msg.innerHTML = g.error === "ad_limit" ? `${T.adLimit} <a href="${ctx.url("plans")}" data-link>${T.pricing} →</a>` : T.idDown; return; }
        msg.textContent = "…";
      }
      const r = await identify(inp.files[0], ctx.lang);
      if (r.error === "quota" || r.error === "busy") {
        msg.innerHTML = `${r.error === "busy" ? T.idBusy : free ? T.adLimit : T.idOut} <a href="${ctx.url("plans")}" data-link>${T.pricing} →</a>`;
        return;
      }
      if (r.error) { msg.textContent = T.idDown; return; }
      msg.textContent = !free && r.remaining != null ? T.idLeft(r.remaining) : "";
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
