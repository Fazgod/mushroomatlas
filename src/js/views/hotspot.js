// Species hotspot maps from GBIF occurrence records.
// Only CC0 and CC BY 4.0 records are used (no "non-commercial" data, because the site sells plans).
// Detail depends on the plan: the hexagon grid is drawn by GBIF at a fixed size per tile,
// and each plan may request tiles up to a certain zoom level (beyond that Leaflet just enlarges them).
import { currentUser, getProfile } from "../supabase.js";
import { leaflet, baseLayer } from "./map.js";

export const LEVELS = {
  free: { nz: 6, hex: 18, d: "~20 km" },
  season: { nz: 10, hex: 20, d: "~1 km" },
  supporter: { nz: 12, hex: 22, d: "~250 m" },
};
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

let keysP = null;
export function gbifKey(slug) {
  keysP ||= fetch("/data/gbif.json").then(r => r.json()).catch(() => ({}));
  return keysP.then(k => k[slug] || null);
}

export async function planLevel() {
  if (!currentUser()) return "free";
  const p = await getProfile().catch(() => null);
  if (!p || !LEVELS[p.plan]) return "free";
  if (p.plan !== "free" && p.plan_expires_at && new Date(p.plan_expires_at) < new Date()) return "free";
  return p.plan;
}

export function hotspotLayer(L, key, level) {
  const lv = LEVELS[level] || LEVELS.free;
  const url = "https://api.gbif.org/v2/map/occurrence/adhoc/{z}/{x}/{y}@1x.png?srs=EPSG:3857&bin=hex"
    + `&hexPerTile=${lv.hex}&style=classic-noborder.poly&taxonKey=${key}&license=CC0_1_0&license=CC_BY_4_0`;
  return L.tileLayer(url, {
    maxNativeZoom: lv.nz, maxZoom: 18, opacity: 0.75, errorTileUrl: BLANK, className: "hotspot",
    attribution: 'Records: <a href="https://www.gbif.org" target="_blank" rel="noopener">GBIF.org</a> (CC0, CC BY 4.0)',
  });
}

// Detail line under a hotspot map: current detail + link to plans when more is available.
export function detailNote(ctx, level) {
  const T = ctx.L, lv = LEVELS[level] || LEVELS.free;
  const more = level === "supporter" ? "" : ` · <a href="${ctx.url("plans")}" data-link>${T.hotMore} →</a>`;
  return `${T.hotDetail(lv.d)}${more}`;
}

// Small hotspot map on a species page; loads Leaflet only when scrolled into view.
export function mountSpeciesHotspot(ctx, slug) {
  const box = document.querySelector("#hotmap");
  if (!box) return;
  const start = async () => {
    const [L, key, level] = await Promise.all([leaflet(), gbifKey(slug), planLevel()]);
    if (!key || !document.body.contains(box)) { box.closest("section")?.remove(); return; }
    const map = L.map(box, { scrollWheelZoom: false }).setView([54, 15], 3);
    baseLayer(L).addTo(map);
    hotspotLayer(L, key, level).addTo(map);
    document.querySelector("#hotnote").innerHTML = detailNote(ctx, level);
  };
  if (!("IntersectionObserver" in window)) return start();
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "200px" });
  io.observe(box);
}
