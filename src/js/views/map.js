// Mushroom map (OpenStreetMap via Leaflet)
import { listPublicFinds, photoUrl } from "../supabase.js";

let Lf = null;
export async function leaflet() {
  if (Lf) return Lf;
  if (!document.querySelector("#leaflet-css")) {
    const l = document.createElement("link"); l.id = "leaflet-css"; l.rel = "stylesheet";
    l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l);
  }
  Lf = (await import("https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js"));
  return Lf;
}
export function baseLayer(L) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
}
const dot = (L, color) => L.divIcon({ className: "pin", html: `<span style="background:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
const COLORS = { valgomi: "#2F7A43", nevalgomi: "#8A6A12", nuodingi: "#B3261E", kiti: "#5B6670", "": "#2C5A40" };

export async function view(ctx, _arg, app) {
  const T = ctx.L, e = ctx.esc;
  const sp = new URLSearchParams(location.search).get("species");
  ctx.title = T.mapTitle;
  app.innerHTML = `<section class="pagehead"><h1>${T.mapTitle}</h1><p>${T.mapLead}</p>
    ${sp && ctx.BY[sp] ? `<p class="chipline"><span class="chip" aria-pressed="true">${e(ctx.nm(ctx.BY[sp]))}</span> <a href="${ctx.url("map")}" data-link>✕</a></p>` : ""}</section>
    <div id="bigmap" class="bigmap"></div>
    <p class="empty" id="mapnote" hidden>${ctx.backendReady ? T.mapEmpty : T.backendSoon}</p>
    <div class="row" style="padding-block:16px 40px"><a class="btn" href="${ctx.url("add")}" data-link>+ ${T.add}</a></div>`;
  const L = await leaflet();
  const map = L.map("bigmap", { zoomControl: true }).setView([54.5, 15], 4);
  baseLayer(L).addTo(map);
  const layer = L.layerGroup().addTo(map);
  async function load() {
    const b = map.getBounds();
    const finds = await listPublicFinds({ s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() });
    layer.clearLayers();
    const shown = finds.filter(f => !sp || f.species_slug === sp);
    document.querySelector("#mapnote").hidden = shown.length > 0;
    for (const f of shown) {
      const m = ctx.BY[f.species_slug];
      const name = m ? ctx.nm(m) : (f.species_guess || "?");
      L.marker([f.lat, f.lng], { icon: dot(L, COLORS[m?.t || ""]) }).addTo(layer).bindPopup(
        `<div class="pop">${f.photo_path ? `<img src="${photoUrl(f.photo_path)}" alt="">` : ""}<b>${e(name)}</b>${m ? `<br><a href="${ctx.url("species/" + m.s)}">${e(m.lat)}</a>` : ""}
         <br><small>${f.observed_at ? new Date(f.observed_at).toLocaleDateString(ctx.lang) : ""} · ${f.is_exact ? T.mapExact : T.mapApprox}</small></div>`);
    }
  }
  map.on("moveend", load);
  load();
}
