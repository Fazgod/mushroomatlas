// Plans / pricing (Stripe checkout is wired in a later step)
import { currentUser, getProfile } from "../supabase.js";
import { adsEnabled } from "../ads.js";

export async function view(ctx) {
  const T = ctx.L;
  ctx.title = T.plansTitle;
  const cur = currentUser() ? (await getProfile())?.plan || "free" : null;
  const tiers = ["free", "season", "supporter"];
  return `<section class="pagehead"><h1>${T.plansTitle}</h1><p>${T.plansLead}</p></section>
  <div class="plans">${tiers.map(k => { const p = T.plan[k]; return `<div class="plan ${k === "season" ? "featured" : ""}">
    <h3>${p.n}</h3><div class="price">${p.p}<small>${k === "free" ? "" : " " + T.perYear}</small></div>
    <ul>${p.f.concat(k === "free" && adsEnabled() ? [T.adPerk] : []).map(x => `<li>${x}</li>`).join("")}</ul>
    ${cur === k ? `<span class="badge b-valgomi">${T.current}</span>` : k === "free" ? "" : `<button class="btn" disabled title="${T.soon}">${T.choose}</button><p class="hint">${T.soon}</p>`}
  </div>`; }).join("")}</div>`;
}
