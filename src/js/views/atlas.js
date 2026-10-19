// Catalogue, species pages and articles.
const POP = ["azuolyninis-raudonvirsis","baravykas","gelsvoji-musmire","geltonasis-kazlekas","juosvazvynis-raudonvirsis","lepse","paprastoji-musmire","pusyninis-baravykas","raudonvirsis","valgomoji-voveraite"];
const TYPES = ["valgomi","nevalgomi","nuodingi","kiti"];
const FK = { rg:["N","W","C","S","E","ru"], v:["very","valuable","low"], se:["sp","su","au","wi"], h:["conif","decid","pine","spruce","oak","birch","park","meadow","wood","wet","sand"] };
const st = { type:"", group:"all", q:"", letter:"", sort:"az", limit:60, v:[], se:[], h:[], rg:[] };
let C; // ctx

const firstLetter = m => C.nm(m).trim().charAt(0).toLocaleUpperCase(C.lang);
function match(m, q, skip) {
  return (skip==="t"||!st.type||m.t===st.type)&&(st.group==="all"||m.g===st.group)&&(!q||m._s.includes(q))&&(!st.letter||firstLetter(m)===st.letter)&&
    (skip==="v"||!st.v.length||st.v.includes(m.v))&&(skip==="se"||!st.se.length||st.se.some(x=>m.se.includes(x)))&&
    (skip==="h"||!st.h.length||st.h.some(x=>m.h.includes(x)))&&(skip==="rg"||!st.rg.length||st.rg.some(x=>m.rg.includes(x)));
}
const facet = (k, val) => { const q = C.norm(st.q); return C.D.filter(m => match(m, q, k) && (k==="t"?m.t===val:k==="v"?m.v===val:m[k].includes(val))).length; };
const nActive = () => (st.type?1:0)+st.v.length+st.se.length+st.h.length+st.rg.length;
function filtered() {
  const q = C.norm(st.q), c = C.coll(), vr = {very:0,valuable:1,"":2,low:3};
  return C.D.filter(m => match(m, q)).sort((a,b) => st.sort==="val" ? (vr[a.v]-vr[b.v])||c.compare(C.nm(a),C.nm(b)) : c.compare(C.nm(a),C.nm(b)));
}

export function card(ctx, m) {
  const L = ctx.L, e = ctx.esc;
  return `<a class="card" href="${ctx.url("species/"+m.s)}" data-link><div class="ph"><img loading="lazy" src="/img/${m.s}.webp" alt="${e(ctx.nm(m))}"></div>
  <div class="bd"><h3>${e(ctx.nm(m))}</h3><div class="lat">${e(m.lat)}</div>
  <div class="badges"><span class="badge b-${m.t}">${L.types[m.t]}</span>${m.v?`<span class="badge b-val ${m.v}">${L.val[m.v]}</span>`:""}${m.w?`<span class="badge b-nuodingi">⚠ ${L.caution}</span>`:""}</div></div></a>`;
}

export function home(ctx) {
  C = ctx; const L = ctx.L, e = ctx.esc, D = ctx.D;
  const cnt = Object.fromEntries(TYPES.map(x => [x, D.filter(m => m.t===x).length]));
  const letters = [...new Set(D.map(firstLetter))].sort(ctx.coll().compare);
  const r = filtered(), on = nActive()||st.group!=="all"||st.q||st.letter;
  const chips = (k, list, label) => `<div class="frow"><span class="flabel">${label}</span><div class="chips">${list.map(x=>`<button class="chip" data-fk="${k}" data-fv="${x}" aria-pressed="${st[k].includes(x)}">${(k==="v"?L.val:k==="se"?L.se:k==="rg"?L.rg:L.h)[x]} <small>${facet(k,x)}</small></button>`).join("")}</div></div>`;
  return `<section class="hero"><div><h1>${L.h1}</h1><p>${L.lead}</p><p class="eustat"><span class="eumap" aria-hidden="true">${["N","W","C","S","E"].map(x=>`<i class="r-${x}"></i>`).join("")}</span>${L.euStat(D.filter(m=>m.eu&&m.eu.r.length===5).length,D.length)} · <a href="https://www.gbif.org" target="_blank" rel="noopener">GBIF</a></p>
   <div class="cta"><a class="btn" href="${ctx.url("identify")}" data-link>📷 ${L.identify}</a><a class="btn ghost" href="${ctx.url("map")}" data-link>🗺 ${L.map}</a></div></div>
   <div class="tally">${TYPES.map(x=>`<button data-t="${x}" aria-pressed="${st.type===x}"><b>${cnt[x]}</b><span>${L.types[x]}</span></button>`).join("")}</div></section>
  <section class="controls" id="controls">
   <div class="row"><label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="${e(L.search)}" value="${e(st.q)}" aria-label="${e(L.search)}"></label>
   <select id="grp" aria-label="${e(L.f.group)}">${Object.entries(L.groups).map(([k,v])=>`<option value="${k}" ${st.group===k?"selected":""}>${v}</option>`).join("")}</select>
   <select id="sort" aria-label="Sort">${Object.entries(L.sort).map(([k,v])=>`<option value="${k}" ${st.sort===k?"selected":""}>${v}</option>`).join("")}</select></div>
   <div class="filters">
    <div class="frow"><span class="flabel">${L.fl.t}</span><div class="chips">${TYPES.map(x=>`<button class="chip c-${x}" data-t="${x}" aria-pressed="${st.type===x}">${L.types[x]} <small>${facet("t",x)}</small></button>`).join("")}</div></div>
    ${chips("v",FK.v,L.fl.v)}${chips("se",FK.se,L.fl.se)}${chips("rg",FK.rg,L.fl.rg)}${chips("h",FK.h,L.fl.h)}
   </div>
   <div class="alpha">${letters.map(c=>`<button data-letter="${c}" aria-pressed="${st.letter===c}">${c}</button>`).join("")}</div>
   ${on?`<div class="resultline">${L.found(r.length)} <button id="clr">${L.clear}</button></div>`:""}
  </section>
  ${!on?`<div class="sh"><h2>${L.popular}</h2></div><div class="grid">${POP.map(s=>ctx.BY[s]).filter(Boolean).map(m=>card(ctx,m)).join("")}</div><div class="sh"><h2>${L.all}</h2><span class="eyebrow">${D.length}</span></div>`:""}
  <div class="grid">${r.slice(0,st.limit).map(m=>card(ctx,m)).join("")}</div>
  ${r.length?"":`<p class="empty">${L.none}</p>`}
  ${r.length>st.limit?`<div class="more"><button class="btn" id="more">${L.more} (${r.length-st.limit})</button></div>`:""}`;
}

export function species(ctx, slug) {
  C = ctx; const L = ctx.L, e = ctx.esc, m = ctx.BY[slug];
  if (!m) return home(ctx);
  const x = (ctx.M[ctx.lang] || {})[slug] || {};
  ctx.title = ctx.nm(m);
  const c = ctx.coll(), list = ctx.D.filter(o=>o.t===m.t).sort((a,b)=>c.compare(ctx.nm(a),ctx.nm(b)));
  const i = list.indexOf(m), pv = list[i-1], nx = list[i+1];
  const others = [...new Set(Object.entries(m.n).filter(([l,n])=>l!==ctx.lang&&n&&n!==ctx.nm(m)).map(([,n])=>n))].join(" · ");
  const facts = [[L.f.lat,`<i>${e(m.lat)}</i>`],[L.f.group,e(L.groups[m.g]||"")],[L.f.habitat,e(x.habitat)],[L.f.season,e(x.season)],[L.f.features,e(x.features)]].filter(f=>f[1]);
  return `<nav class="crumbs"><a href="${ctx.url("")}" data-link>${L.back}</a> › <span>${L.types[m.t]}</span></nav>
  <article class="plate"><figure><img src="/img/${m.s}.webp" alt="${e(ctx.nm(m))}"><figcaption>${L.photo}</figcaption></figure>
  <div><span class="eyebrow">${L.groups[m.g]||""}</span>
   <h1>${e(ctx.nm(m))}</h1><div class="latin">${e(m.lat)}</div><div class="alt">${e(others)}</div>
   <div class="verdict"><span class="badge b-${m.t}">${L.types[m.t]}</span>${m.v?`<span class="badge b-val ${m.v}">${L.val[m.v]}</span>`:""}${m.w?`<span class="badge b-nuodingi">⚠ ${L.caution}</span>`:""}</div>
   ${m.w?`<div class="warn"><div><strong>⚠ ${L.caution}.</strong> ${e(m.w[ctx.lang]||m.w.en)}</div></div>`:""}
   <dl class="facts">${facts.map(f=>`<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join("")}</dl>
   ${m.eu?`<section class="dist"><h2>${L.dist}</h2><div class="regions">${["N","W","C","S","E"].map(r=>`<span class="reg ${m.eu.r.includes(r)?"on":""}">${L.rg[r]}</span>`).join("")}</div>
    <p>${L.distN(m.eu.n)}${m.eu.x.length?`. ${L.also}: ${m.eu.x.map(k=>L.rg[k]).join(", ")}.`:"."}</p>
    <p class="src"><a href="https://www.gbif.org/species/search?q=${encodeURIComponent(m.lat)}" target="_blank" rel="noopener">${L.gbif} ↗</a> · ${L.ltnote}</p></section>`:""}
   <div class="prose">${(x.desc||[]).map(p=>`<p>${e(p)}</p>`).join("")}</div>
   <div class="row"><a class="btn ghost" href="${ctx.url("add")}?species=${m.s}" data-link>+ ${L.add}</a><a class="btn ghost" href="${ctx.url("map")}?species=${m.s}" data-link>🗺 ${L.map}</a></div>
   <div class="warn"><div>${L.warn}</div></div>
  </div></article>
  <div class="pn">${pv?`<a href="${ctx.url("species/"+pv.s)}" data-link><span>← ${L.prev}</span>${e(ctx.nm(pv))}</a>`:"<i></i>"}${nx?`<a href="${ctx.url("species/"+nx.s)}" data-link style="text-align:right"><span>${L.next} →</span>${e(ctx.nm(nx))}</a>`:""}</div>`;
}

export function learn(ctx) {
  C = ctx; const L = ctx.L, e = ctx.esc, arr = ctx.A[ctx.lang] || [];
  ctx.title = L.nav[1];
  const sec = (key, title) => `<div class="sh" style="margin-top:36px"><h2 style="font-size:2rem">${title}</h2></div>
   <div class="alist">${arr.map((a,i)=>({a,i})).filter(o=>o.a.u.includes(key)).map(({a,i})=>{const p=(a.blocks.find(b=>b.t==="P")||{x:""}).x;return `<a class="acard" href="${ctx.url("article/"+i)}" data-link><span class="eyebrow">${L.read} →</span><h3>${e(a.h)}</h3><p>${e(p)}</p></a>`}).join("")}</div>`;
  return sec("apie-grybus", L.about) + sec("idomu", L.fun);
}

export function article(ctx, i) {
  C = ctx; const L = ctx.L, e = ctx.esc, a = (ctx.A[ctx.lang] || [])[+i];
  if (!a) return learn(ctx);
  ctx.title = a.h;
  let html = "", inList = false;
  for (const b of a.blocks) {
    if (b.t==="LI") { if (!inList) { html+="<ul>"; inList=true; } html+=`<li>${e(b.x)}</li>`; continue; }
    if (inList) { html+="</ul>"; inList=false; }
    html += b.t==="H2"?`<h2>${e(b.x)}</h2>`:b.t==="H3"?`<h3>${e(b.x)}</h3>`:`<p>${e(b.x)}</p>`;
  }
  if (inList) html += "</ul>";
  return `<nav class="crumbs"><a href="${ctx.url("learn")}" data-link>${L.nav[1]}</a></nav><article class="article"><h1>${e(a.h)}</h1>${html}</article>`;
}

// Catalogue interactions
function rerender(keepFocus) {
  const pos = document.querySelector("#q")?.selectionStart;
  C.render();
  if (keepFocus) { const q = document.querySelector("#q"); if (q && pos != null) { q.focus(); q.setSelectionRange(pos, pos); } }
}
document.addEventListener("input", e => { if (e.target.id==="q") { st.q=e.target.value; st.limit=60; st.letter=""; rerender(true); } });
document.addEventListener("change", e => { if (e.target.id==="grp") { st.group=e.target.value; st.limit=60; rerender(); } if (e.target.id==="sort") { st.sort=e.target.value; rerender(); } });
document.addEventListener("click", e => {
  if (!C) return;
  const fk = e.target.closest("[data-fk]"); if (fk) { const a=st[fk.dataset.fk], v=fk.dataset.fv, i=a.indexOf(v); i<0?a.push(v):a.splice(i,1); st.limit=60; return rerender(); }
  const ty = e.target.closest("[data-t]"); if (ty) { st.type = st.type===ty.dataset.t?"":ty.dataset.t; st.limit=60; return rerender(); }
  const le = e.target.closest("[data-letter]"); if (le) { st.letter = st.letter===le.dataset.letter?"":le.dataset.letter; st.q=""; st.limit=60; return rerender(); }
  if (e.target.id==="more") { st.limit+=60; return rerender(); }
  if (e.target.id==="clr") { Object.assign(st,{type:"",group:"all",q:"",letter:"",limit:60,v:[],se:[],h:[],rg:[]}); return rerender(); }
});
