// Runs on Cloudflare for the bare domain ("/") only.
// Picks the visitor's language: saved choice (cookie) → country → browser language → English.
const LANGS = ["en", "de", "fr", "es", "it", "pl", "da", "sv", "lt", "ru"];
const BY_COUNTRY = {
  DE: "de", AT: "de", CH: "de", LI: "de",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  ES: "es", AD: "es",
  IT: "it", SM: "it", VA: "it",
  PL: "pl",
  DK: "da", GL: "da", FO: "da",
  SE: "sv", AX: "sv",
  LT: "lt",
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru",
};

function fromCookie(header) {
  const m = /(?:^|;\s*)ma-lang=([a-z]{2})/.exec(header || "");
  return m && LANGS.includes(m[1]) ? m[1] : null;
}

function fromAcceptLanguage(header) {
  for (const part of (header || "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (LANGS.includes(code)) return code;
  }
  return null;
}

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const country = request.cf && request.cf.country;
  const lang =
    fromCookie(request.headers.get("Cookie")) ||
    BY_COUNTRY[country] ||
    fromAcceptLanguage(request.headers.get("Accept-Language")) ||
    "en";
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/${lang}/${url.search}`,
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Accept-Language",
    },
  });
}
