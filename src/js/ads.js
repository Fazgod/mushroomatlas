// Rewarded ads via Google Publisher Tag (Google Ad Manager). Loaded only when the user asks to watch.
import { AD_UNIT_REWARDED } from "./config.js";

export const adsEnabled = () => Boolean(AD_UNIT_REWARDED);

let gptP = null;
function loadGpt() {
  gptP ||= new Promise((res, rej) => {
    window.googletag = window.googletag || { cmd: [] };
    const s = document.createElement("script");
    s.async = true; s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    s.onload = () => res(window.googletag); s.onerror = () => rej(new Error("blocked"));
    document.head.appendChild(s);
  });
  return gptP;
}

// Shows one rewarded ad. Resolves true if the reward was granted, false if closed early or no ad was available.
function showOne() {
  return new Promise(async resolve => {
    let gt; try { gt = await loadGpt(); } catch { return resolve(false); }
    gt.cmd.push(() => {
      const slot = gt.defineOutOfPageSlot(AD_UNIT_REWARDED, gt.enums.OutOfPageFormat.REWARDED);
      if (!slot) return resolve(false); // format not supported on this page/device
      slot.addService(gt.pubads());
      let granted = false, done = false;
      const finish = ok => { if (done) return; done = true; clearTimeout(t); gt.destroySlots([slot]); resolve(ok); };
      const t = setTimeout(() => finish(false), 15000); // no ad within 15 s
      gt.pubads().addEventListener("rewardedSlotReady", e => { if (e.slot === slot) { clearTimeout(t); e.makeRewardedVisible(); } });
      gt.pubads().addEventListener("rewardedSlotGranted", e => { if (e.slot === slot) granted = true; });
      gt.pubads().addEventListener("rewardedSlotClosed", e => { if (e.slot === slot) finish(granted); });
      gt.pubads().addEventListener("slotRenderEnded", e => { if (e.slot === slot && e.isEmpty) finish(false); });
      gt.enableServices();
      gt.display(slot);
    });
  });
}

export const ADS_PER_CHECK = 3;
// Several ads in a row; onStep(n) is called before ad n (1..ADS_PER_CHECK).
export async function watchAds(onStep) {
  for (let n = 1; n <= ADS_PER_CHECK; n++) {
    onStep?.(n);
    if (!(await showOne())) return false;
  }
  return true;
}
