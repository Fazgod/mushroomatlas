// Mushroom map (Leaflet). Background: OpenFreeMap vector tiles (free, commercial use allowed, no view limits),
// drawn with MapLibre GL. Falls back to OpenStreetMap raster tiles if WebGL or the scripts are unavailable.
import { listPublicFinds, photoUrl } from "../supabase.js";
import { gbifKey, planLevel, hotspotLayer, detailNote } from "./hotspot.js";

let Lf = null;
export async function leaflet() {
  if (Lf) return Lf;
  addCss("leaflet-css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
  Lf = (await import("https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js"));
  return Lf;
}
function addCss(id, href) {
  if (document.getElementById(id)) return;
  const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
}
const loadScript = src => new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
});
const OFM_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const OFM_ATTR = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
let glP = null;
function loadGl(L) {
  glP ||= (async () => {
    addCss("maplibre-css", "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css");
    await loadScript("https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js");
    // The Leaflet plugin is a classic script that expects a global, extensible L.
    if (!window.L) window.L = Object.assign({}, L);
    await loadScript("https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js");
    if (!window.L.maplibreGL) throw new Error("plugin");
    return window.L.maplibreGL;
  })();
  return glP;
}
const hasWebGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
const osm = L => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });

// Returns a layer group right away; the background fills in when ready.
export function baseLayer(L) {
  const g = L.layerGroup();
  if (!hasWebGL()) { osm(L).addTo(g); return g; }
  loadGl(L).then(gl => gl({ style: OFM_STYLE, attribution: OFM_ATTR }).addTo(g)).catch(() => osm(L).addTo(g));
  return g;
}
const dot = (L, color) => L.divIcon({ className: "pin", html: `<span style="background:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
const COLORS = { valgomi: "#2F7A43", nevalgomi: "#8A6A12", nuodingi: "#B3261E", kiti: "#5B6670", "": "#2C5A40" };

export async function view(ctx, _arg, app) {
  const T = ctx.L, e = ctx.esc;
  const sp = new URLSearchParams(location.search).get("species");
  ctx.title = T.mapTitle;
  app.innerHTML = `<section class="pagehead"><h1>${T.mapTitle}</h1><p>${T.mapLead}</p>
    <form class="hotpick" id="hotpick"><input id="hotq" list="hotlist" placeholder="${e(T.hotPick)}" autocomplete="off" value="${sp && ctx.BY[sp] ? e(ctx.nm(ctx.BY[sp])) : ""}">
      ${sp ? `<a href="${ctx.url("map")}" data-link aria-label="✕">✕</a>` : ""}
      <datalist id="hotlist">${ctx.D.map(m => `<option value="${e(ctx.nm(m))}">${e(m.lat)}</option>`).join("")}</datalist></form>
    ${sp && ctx.BY[sp] ? `<p class="hint">${T.hotLead}</p><p class="hint" id="hotnote"></p>` : ""}</section>
    <div id="bigmap" class="bigmap"></div>
    <p class="empty" id="mapnote" hidden>${ctx.backendReady ? T.mapEmpty : T.backendSoon}</p>
    <div class="row" style="padding-block:16px 40px"><a class="btn" href="${ctx.url("add")}" data-link>+ ${T.add}</a></div>`;
  const L = await leaflet();
  const map = L.map("bigmap", { zoomControl: true }).setView([54.5, 15], 4);
  baseLayer(L).addTo(map);
  const q = document.querySelector("#hotq");
  q.onchange = () => { const m = ctx.D.find(o => ctx.nm(o) === q.value || o.lat === q.value); if (m) ctx.go(`${ctx.url("map")}?species=${m.s}`); };
  document.querySelector("#hotpick").onsubmit = ev => { ev.preventDefault(); q.onchange(); };
  if (sp && ctx.BY[sp]) {
    const [key, level] = await Promise.all([gbifKey(sp), planLevel()]);
    if (key) { hotspotLayer(L, key, level).addTo(map); document.querySelector("#hotnote").innerHTML = detailNote(ctx, level); }
  }
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
      const color = COLORS[m?.t || ""];
      // Approximate finds: a ~1 km circle (stored location is snapped to a ~1 km grid).
      // When zoomed far out the circle is too small to see, so a dot is shown instead.
      const shape = f.is_exact || map.getZoom() < 11
        ? L.marker([f.lat, f.lng], { icon: dot(L, color) })
        : L.circle([f.lat, f.lng], { radius: 1000, color, weight: 2, fillColor: color, fillOpacity: 0.18 });
      shape.addTo(layer).bindPopup(
        `<div class="pop">${f.photo_path ? `<img src="${photoUrl(f.photo_path)}" alt="">` : ""}<b>${e(name)}</b>${m ? `<br><a href="${ctx.url("species/" + m.s)}">${e(m.lat)}</a>` : ""}
         <br><small>${f.observed_at ? new Date(f.observed_at).toLocaleDateString(ctx.lang) : ""} · ${f.is_exact ? T.mapExact : T.mapApprox}</small></div>`);
    }
  }
  map.on("moveend", load);
  load();
}
