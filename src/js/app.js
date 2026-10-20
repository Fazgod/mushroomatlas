import { T as TB } from "./i18n-base.js";
import { T3, X, LANG_NAMES } from "./i18n-extra.js";
import { LANGS, DEFAULT_LANG } from "./config.js";
import { backendReady, sb, currentUser, onAuth, signOut } from "./supabase.js";
import * as atlas from "./views/atlas.js";
import * as mapView from "./views/map.js";
import * as addView from "./views/add.js";
import * as idView from "./views/identify.js";
import * as authView from "./views/auth.js";
import * as plansView from "./views/plans.js";

const T = { ...TB, ...T3 };
const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ё/g, "е").replace(/ł/g, "l").replace(/ß/g, "ss").replace(/ø/g, "o").replace(/æ/g, "ae");

export const ctx = {
  lang: DEFAULT_LANG, D: [], BY: {}, M: {}, A: {},
  get L() { return { ...T.en, ...X.en, ...T[ctx.lang], ...X[ctx.lang] }; },
  nm: m => m.n[ctx.lang] || m.n.en,
  coll: () => new Intl.Collator(ctx.lang),
  url: (p = "") => `/${ctx.lang}/${p}`,
  go: (path, replace) => { history[replace ? "replaceState" : "pushState"]({}, "", path); render(); },
  render: () => render(true),
  esc, norm, backendReady, user: () => currentUser(),
};

const loading = {};
export function ensureLang(l) {
  if (ctx.M[l] && ctx.A[l]) return Promise.resolve();
  if (!loading[l]) loading[l] = Promise.all([fetch(`/data/${l}.json`).then(r => r.json()), fetch(`/data/a-${l}.json`).then(r => r.json())])
    .then(([m, a]) => { ctx.M[l] = m; ctx.A[l] = a; });
  return loading[l];
}
ctx.ensureLang = ensureLang;

function parse() {
  const parts = location.pathname.split("/").filter(Boolean);
  const lang = LANGS.includes(parts[0]) ? parts[0] : null;
  return { lang, page: parts[1] || "", arg: parts[2] || "" };
}

function header() {
  const L = ctx.L, r = parse(), u = currentUser();
  const nav = [["", L.nav[0]], ["map", L.map], ["identify", L.identify], ["learn", L.nav[1]]];
  const active = p => (p === "" && (r.page === "" || r.page === "species")) || (p && r.page === p) || (p === "learn" && r.page === "article");
  $("#nav").innerHTML = nav.map(([p, x]) => `<a href="${ctx.url(p)}" data-link ${active(p) ? 'aria-current="page"' : ""}>${x}</a>`).join("");
  $("#tools").innerHTML = `
    <div class="globe">
      <button id="globeBtn" aria-haspopup="true" aria-expanded="false" aria-label="${esc(L.lang)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z"/></svg>
        <span>${ctx.lang.toUpperCase()}</span>
      </button>
      <ul id="globeMenu" role="menu" hidden>${LANGS.map(l => `<li><a role="menuitem" href="${switchLangHref(l)}" data-lang="${l}" ${l === ctx.lang ? 'aria-current="true"' : ""}><b>${l.toUpperCase()}</b> ${LANG_NAMES[l]}</a></li>`).join("")}</ul>
    </div>
    <a class="btn small" href="${ctx.url("add")}" data-link>+ ${L.add}</a>
    ${u ? `<a class="acct" href="${ctx.url("account")}" data-link title="${esc(L.account)}">${esc((u.user_metadata?.name || u.email || "?")[0].toUpperCase())}</a>`
        : `<a class="btn small ghost" href="${ctx.url("login")}" data-link>${L.signIn}</a>`}`;
  $("#foot").innerHTML = `<div><b>Mushroom Atlas</b> · ${ctx.D.length} · © ${new Date().getFullYear()} · GBIF · <a href="${ctx.url("plans")}" data-link>${L.pricing}</a> · <a href="/legal/privacy">Privacy</a> · <a href="/legal/terms">Terms</a></div><div>${L.foot} <a id="mail" href="mailto:info@mushroomatlas.eu">info@mushroomatlas.eu</a></div>`;
}
function switchLangHref(l) { const p = location.pathname.split("/"); if (LANGS.includes(p[1])) p[1] = l; else return `/${l}/`; return p.join("/") + location.search; }

let lastPath = "";
async function render(keepScroll) {
  const r = parse();
  if (!r.lang) {
    let l = (navigator.languages || []).map(x => x.slice(0, 2).toLowerCase()).find(x => LANGS.includes(x)) || DEFAULT_LANG;
    try { const s = localStorage.getItem("ma-lang"); if (LANGS.includes(s)) l = s; } catch (_) {}
    history.replaceState({}, "", `/${l}/` + location.search + location.hash); return render();
  }
  if (r.lang !== ctx.lang) { ctx.lang = r.lang; try { localStorage.setItem("ma-lang", r.lang); } catch (_) {} }
  document.cookie = `ma-lang=${ctx.lang}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  document.documentElement.lang = ctx.lang;
  header();
  const app = $("#app");
  const views = { "": atlas.home, species: atlas.species, learn: atlas.learn, article: atlas.article, map: mapView.view, add: addView.view, identify: idView.view, login: authView.login, account: authView.account, plans: plansView.view };
  const v = views[r.page] || atlas.home;
  if (!ctx.M[ctx.lang] && ["species", "article", "learn"].includes(r.page)) { app.innerHTML = `<p class="empty">${ctx.L.loading}</p>`; await ensureLang(ctx.lang); }
  const out = await v(ctx, r.arg, app);
  if (typeof out === "string") app.innerHTML = out;
  if (location.pathname !== lastPath && !keepScroll) scrollTo(0, 0);
  lastPath = location.pathname;
  document.title = ctx.title ? `${ctx.title} · Mushroom Atlas` : "Mushroom Atlas";
  ctx.title = "";
}

// Navigation & global UI
document.addEventListener("click", e => {
  const g = e.target.closest("#globeBtn");
  if (g) { const m = $("#globeMenu"); m.hidden = !m.hidden; g.setAttribute("aria-expanded", String(!m.hidden)); return; }
  if (!e.target.closest(".globe")) { const m = $("#globeMenu"); if (m && !m.hidden) m.hidden = true; }
  const a = e.target.closest("a[data-link],a[data-lang]");
  if (a && !e.metaKey && !e.ctrlKey && a.origin === location.origin) { e.preventDefault(); history.pushState({}, "", a.getAttribute("href")); render(); }
  if (e.target.closest("[data-signout]")) { signOut().then(() => ctx.go(ctx.url(""))); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { const m = $("#globeMenu"); if (m) m.hidden = true; } });
addEventListener("popstate", () => render());

(async () => {
  const lang = parse().lang || DEFAULT_LANG;
  const [base] = await Promise.all([fetch("/data/base.json").then(r => r.json()), ensureLang(lang).catch(() => {})]);
  ctx.D = base;
  base.forEach(x => { x.rg = x.eu ? x.eu.r.concat(x.eu.x.includes("ru") ? ["ru"] : []) : []; ctx.BY[x.s] = x; x._s = norm(Object.values(x.n).concat([x.alt || "", x.lat]).join(" ")); });
  if (backendReady) { await sb(); onAuth(() => render(true)); }
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
