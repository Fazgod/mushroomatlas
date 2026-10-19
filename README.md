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

## Deploy (Cloudflare Pages, connected to this GitHub repo)

- Build command: `python3 scripts/build.py`
- Output directory: `dist`

## Backend setup (one time)

1. **Supabase**: create a project (region: Frankfurt/eu-central-1). SQL Editor → run `supabase/migrations/001_init.sql`.
2. Copy Project URL + anon key (Settings → API) into `src/js/config.js`.
3. **Google sign-in**: Google Cloud Console → OAuth client (Web). Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Paste client ID + secret into
   Supabase → Authentication → Providers → Google.
4. Supabase → Authentication → URL configuration: Site URL `https://mushroomatlas.eu`,
   redirect URLs `https://mushroomatlas.eu/**`.
5. **Identification**: get a mushroom.id API key from Kindwise, then
   `supabase secrets set KINDWISE_API_KEY=…` and `supabase functions deploy identify`.

## Plans

| Plan | Price | Identifications |
|---|---|---|
| Free | €0 | 5 / month |
| Season Pass | €4.99 / year | 300 / year |
| Supporter | €9.99 / year | unlimited |

Payments (Stripe Checkout + webhook that sets `profiles.plan`) are the next step.

## Privacy

- Public map shows finds on a ~1 km grid (`finds_public` view) unless the uploader chooses "exact".
- Photos are re-encoded in the browser before upload, which strips EXIF/GPS metadata.
- Identification results are suggestions only; the app always shows a safety warning.

Contact: info@mushroomatlas.eu. Distribution data: GBIF.
