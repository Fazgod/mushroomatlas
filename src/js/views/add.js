// Add a find: photo + location (from EXIF GPS, phone GPS, or map tap)
import { addFind, currentUser } from "../supabase.js";
import { leaflet, baseLayer } from "./map.js";

export async function view(ctx, _arg, app) {
  const T = ctx.L, e = ctx.esc;
  ctx.title = T.addTitle;
  if (!ctx.backendReady || !currentUser()) {
    return `<section class="pagehead narrow"><h1>${T.addTitle}</h1><p>${T.addLead}</p>
      <div class="notice">${ctx.backendReady ? T.needLogin : T.backendSoon}</div>
      ${ctx.backendReady ? `<a class="btn" href="${ctx.url("login")}" data-link>${T.signIn}</a>` : ""}</section>`;
  }
  const pre = new URLSearchParams(location.search).get("species") || "";
  const opts = ctx.D.map(m => `<option value="${e(ctx.nm(m))} (${e(m.lat)})" data-s="${m.s}">`).join("");
  app.innerHTML = `<section class="pagehead narrow"><h1>${T.addTitle}</h1><p>${T.addLead}</p></section>
  <form id="addform" class="form narrow">
    <label>${T.addPhoto}<input id="f-photo" type="file" accept="image/*" capture="environment" required></label>
    <img id="f-prev" class="prev" alt="" hidden>
    <p class="hint">${T.addStrip}</p>
    <label>${T.addSpecies}<input id="f-species" list="splist" placeholder="${e(T.addSpeciesPh)}" value="${pre && ctx.BY[pre] ? e(ctx.nm(ctx.BY[pre]) + " (" + ctx.BY[pre].lat + ")") : ""}"></label>
    <datalist id="splist">${opts}</datalist>
    <div id="f-locstate" class="locstate">${T.addLocNone}</div>
    <button type="button" class="btn ghost" id="f-gps">📍 ${T.addLocGps}</button>
    <p class="hint">${T.addLocPick}</p>
    <div id="pickmap" class="pickmap"></div>
    <label>${T.addNote}<textarea id="f-note" rows="3"></textarea></label>
    <fieldset><legend class="flabel">👁</legend>${["approx", "exact", "private"].map((v, i) => `<label class="radio"><input type="radio" name="vis" value="${v}" ${i === 0 ? "checked" : ""}> ${T.addVis[v]}</label>`).join("")}</fieldset>
    <button class="btn" id="f-submit">${T.addSubmit}</button>
    <p id="f-msg" class="hint" role="status"></p>
  </form>`;
  const Lf = await leaflet();
  const map = Lf.map("pickmap").setView([54.5, 15], 4); baseLayer(Lf).addTo(map);
  let pos = null, marker = null, observed = null;
  const setPos = (lat, lng, acc, src) => {
    pos = { lat, lng, acc };
    if (!marker) marker = Lf.marker([lat, lng], { draggable: true }).addTo(map).on("dragend", ev => { const p = ev.target.getLatLng(); pos = { lat: p.lat, lng: p.lng, acc: null }; });
    else marker.setLatLng([lat, lng]);
    map.setView([lat, lng], 14);
    document.querySelector("#f-locstate").textContent = `${src} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };
  map.on("click", ev => setPos(ev.latlng.lat, ev.latlng.lng, null, "📌"));
  document.querySelector("#f-gps").onclick = () => navigator.geolocation?.getCurrentPosition(p => setPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy, "📍"), () => {}, { enableHighAccuracy: true });
  document.querySelector("#f-photo").onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const img = document.querySelector("#f-prev"); img.src = URL.createObjectURL(f); img.hidden = false;
    try {
      const exifr = await import("https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.mjs");
      const gps = await exifr.gps(f); const meta = await exifr.parse(f, ["DateTimeOriginal"]).catch(() => null);
      if (meta?.DateTimeOriginal) observed = new Date(meta.DateTimeOriginal).toISOString();
      if (gps?.latitude) setPos(gps.latitude, gps.longitude, null, T.addLocPhoto);
    } catch (_) {}
  };
  document.querySelector("#addform").onsubmit = async ev => {
    ev.preventDefault();
    const msg = document.querySelector("#f-msg"), btn = document.querySelector("#f-submit");
    const file = document.querySelector("#f-photo").files[0];
    if (!file || !pos) { msg.textContent = !file ? T.addPhoto + " ✕" : T.addLocNone; return; }
    const sv = document.querySelector("#f-species").value.trim();
    const opt = [...document.querySelectorAll("#splist option")].find(o => o.value === sv);
    btn.disabled = true; msg.textContent = "…";
    try {
      await addFind({ file, species_slug: opt?.dataset.s || null, species_guess: opt ? null : (sv || null), note: document.querySelector("#f-note").value.trim() || null,
        lat: pos.lat, lng: pos.lng, accuracy_m: pos.acc, visibility: document.querySelector("input[name=vis]:checked").value, observed_at: observed || new Date().toISOString() });
      msg.textContent = T.addSaved; setTimeout(() => ctx.go(ctx.url("map")), 900);
    } catch (err) { msg.textContent = "Error: " + (err.message || err); btn.disabled = false; }
  };
}
