// Sign in (Google / email magic link) and account page
import { signInGoogle, signInEmail, currentUser, getProfile, listMyFinds, photoUrl } from "../supabase.js";

export function login(ctx) {
  const T = ctx.L;
  ctx.title = T.loginTitle;
  if (currentUser()) { ctx.go(ctx.url("account"), true); return ""; }
  setTimeout(() => {
    document.querySelector("#g-btn")?.addEventListener("click", () => signInGoogle(ctx.lang));
    document.querySelector("#mailform")?.addEventListener("submit", async ev => {
      ev.preventDefault();
      const email = document.querySelector("#l-email").value.trim(), msg = document.querySelector("#l-msg");
      const { error } = await signInEmail(email, ctx.lang);
      msg.textContent = error ? "Error: " + error.message : T.linkSent;
    });
  });
  return `<section class="pagehead narrow auth"><h1>${T.loginTitle}</h1><p>${T.loginLead}</p>
    ${!ctx.backendReady ? `<div class="notice">${T.backendSoon}</div>` : `
    <button class="btn google" id="g-btn"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-4-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>${T.google}</button>
    <div class="or"><span>·</span></div>
    <form id="mailform" class="form"><input id="l-email" type="email" required placeholder="${ctx.esc(T.emailPh)}" autocomplete="email"><button class="btn ghost">${T.sendLink}</button><p id="l-msg" class="hint" role="status"></p></form>`}
  </section>`;
}

export async function account(ctx, _arg, app) {
  const T = ctx.L, e = ctx.esc, u = currentUser();
  ctx.title = T.accTitle;
  if (!u) { ctx.go(ctx.url("login"), true); return ""; }
  app.innerHTML = `<p class="empty">${T.loading}</p>`;
  const [p, finds] = await Promise.all([getProfile(), listMyFinds()]);
  const plan = p?.plan || "free";
  return `<section class="pagehead narrow"><h1>${T.accTitle}</h1>
    <p>${e(u.user_metadata?.full_name || u.email)} · ${e(u.email || "")}</p>
    <p><b>${T.accPlan}:</b> ${T.plan[plan]?.n || plan} · <a href="${ctx.url("plans")}" data-link>${T.pricing} →</a></p>
    <button class="btn small ghost" data-signout>${T.signOut}</button></section>
    <div class="sh"><h2>${T.accFinds}</h2><span class="eyebrow">${finds.length}</span></div>
    ${finds.length ? `<div class="grid">${finds.map(f => { const m = ctx.BY[f.species_slug]; return `<div class="card"><div class="ph"><img loading="lazy" src="${photoUrl(f.photo_path)}" alt=""></div><div class="bd"><h3>${e(m ? ctx.nm(m) : (f.species_guess || "?"))}</h3><div class="lat">${new Date(f.observed_at || f.created_at).toLocaleDateString(ctx.lang)} · ${T.addVis[f.visibility]}</div></div></div>`; }).join("")}</div>`
      : `<p class="empty">${T.accNone} <a href="${ctx.url("add")}" data-link>+ ${T.add}</a></p>`}`;
}
