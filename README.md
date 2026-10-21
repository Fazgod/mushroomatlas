# Mushroom Atlas

Europe-wide mushroom atlas (mushroomatlas.eu): 473 species in 10 languages, community map of finds, photo identification and accounts.

## Structure

```
src/                 the website (no build step needed – plain ES modules)
  index.html         app shell
  css/app.css        styles
  js/app.js          router, language menu, header
  js/config.js       Supabase URL + anon key go here
  js/supabase.js     auth, finds, uploads, identification calls
  js/i18n-*.js       interface text for all languages
  js/views/          atlas (catalogue/species/articles), map, add, identify, auth, plans
  sw.js, manifest    installable app (PWA) + offline cache
data/                species & article content per language (base.json, en.json, a-en.json…)
img/                 species photos (webp)
supabase/
  migrations/001_init.sql     tables, security rules, storage bucket
  functions/identify/         photo identification edge function (quota per plan)
scripts/build.py     builds dist/ (pre-renders a page per species per language + sitemap)
scripts/serve.py     local test server
```

## Run locally

```
python3 scripts/build.py && python3 scripts/serve.py 8800   # http://localhost:8800
```

## Deploy (Cloudflare Pages project `mushroomatlas-web`, auto-deploys on every push to main)

Map backgrounds: OpenFreeMap vector tiles (free, commercial use allowed, no view limits) via MapLibre GL; falls back to OpenStreetMap raster.

- Build command: `python3 scripts/build.py`
- Output directory: `dist`

## Backend setup (one time)

1. **Supabase**: create a project (region: Frankfurt/eu-central-1). SQL Editor → run `supabase/migrations/001_init.sql`.
2. Also run `002_usage_plan.sql`, `003_ad_rewards.sql` and `004_packs_settings.sql`. Copy Project URL + anon key (Settings → API) into `src/js/config.js`.
3. **Google sign-in**: Google Cloud Console → OAuth client (Web). Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Paste client ID + secret into
   Supabase → Authentication → Providers → Google.
4. Supabase → Authentication → URL configuration: Site URL `https://mushroomatlas.eu`,
   redirect URLs `https://mushroomatlas.eu/**`.
5. **Identification**: get a mushroom.id API key from Kindwise, then
   `supabase secrets set KINDWISE_API_KEY=…` and `supabase functions deploy identify`.

## Plans

| Plan | Price | Photo checks |
|---|---|---|
| Free | €0 | 1 photo check a week after 3 rewarded ads |
| Season Pass | €4.99 / year | 40 photo checks / year |
| Supporter | €9.99 / year | 100 photo checks / year |
| Check pack | €1.99 once | 10 photo checks, no expiry |

Kindwise charges ~€0.01–0.05 per check (prepaid credits). Limits keep a fully-used plan below its price after VAT and card fees,
and ad-unlocked checks for all free users together are capped per month by `app_settings.free_monthly_budget`
(Supabase → Table Editor). Set it monthly to last month's ad income ÷ €0.05 so ads always pay for the checks they unlock.

Payments (Stripe Checkout + webhook that sets `profiles.plan`) are the next step.

## Hotspot maps

Species hotspots come from GBIF's map API (`/v2/map/occurrence/adhoc`), filtered to CC0 and CC BY 4.0 records only,
because the site sells plans and CC BY-NC data may not be used commercially. Species → GBIF keys live in `data/gbif.json`.
Detail by plan (src/js/views/hotspot.js): Free ~20 km, Season Pass ~1 km, Supporter ~250 m.
The limit is applied in the browser; the underlying records are public on GBIF anyway, so the plan pays for the tool, not secret data.

## Rewarded ads (off until configured)

Free users get no included photo checks: each check is unlocked by watching 3 rewarded ads (max 1 per week; counted in `ad_rewards`).
Until ads are configured, free users see that photo checks come with a plan.
To switch on: create a Google Ad Manager rewarded ad unit, put its path in `AD_UNIT_REWARDED` (src/js/config.js),
set up Google's consent message (Privacy & messaging) for EU visitors, and update the privacy policy to mention ads.
Run `003_ad_rewards.sql` once.

## Privacy

- Public map shows finds on a ~1 km grid (`finds_public` view) unless the uploader chooses "exact".
- Photos are re-encoded in the browser before upload, which strips EXIF/GPS metadata.
- Identification results are suggestions only; the app always shows a safety warning.

Contact: info@mushroomatlas.eu (Zoho Mail free plan, EU; MX/SPF in Cloudflare DNS). Distribution data: GBIF.
