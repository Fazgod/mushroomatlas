#!/usr/bin/env python3
"""Build the static site into dist/.

  python3 scripts/build.py            full build: pre-rendered page per language and species, sitemap
  python3 scripts/build.py --lite     no pre-rendered pages and smaller images (fits a 10 MB manual upload)

Cloudflare Pages settings (Git): build command `python3 scripts/build.py`, output directory `dist`.
"""
import json, os, shutil, sys, html, re
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DATA, DIST = (os.path.join(ROOT, p) for p in ("src", "data", "dist"))
LITE = "--lite" in sys.argv
LANGS = ["en", "de", "fr", "es", "it", "pl", "da", "sv", "lt", "ru"]
SITE = "https://mushroomatlas.eu"
TYPES = {"en": {"valgomi": "Edible", "nevalgomi": "Inedible", "nuodingi": "Poisonous", "kiti": "Other"}}

def main():
    shutil.rmtree(DIST, ignore_errors=True)
    shutil.copytree(SRC, DIST)
    os.makedirs(os.path.join(DIST, "data"))
    for f in os.listdir(DATA):
        if f.endswith(".json"):
            shutil.copy(os.path.join(DATA, f), os.path.join(DIST, "data", f))
    img_src = os.path.join(ROOT, "img-lite" if LITE and os.path.isdir(os.path.join(ROOT, "img-lite")) else "img")
    shutil.copytree(img_src, os.path.join(DIST, "img"))
    if LITE:
        print("lite build done"); return
    prerender()

def prerender():
    shell = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    base = json.load(open(os.path.join(DATA, "base.json"), encoding="utf-8"))
    urls = []
    def alts(path):
        return "".join(f'<link rel="alternate" hreflang="{l}" href="{SITE}/{l}/{path}">' for l in LANGS) + \
               f'<link rel="alternate" hreflang="x-default" href="{SITE}/en/{path}">'
    def page(lang, path, title, desc, body):
        seo = (f'<link rel="canonical" href="{SITE}/{lang}/{path}">{alts(path)}'
               f'<meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(desc)}">'
               f'<meta property="og:type" content="website"><meta property="og:url" content="{SITE}/{lang}/{path}">')
        out = shell.replace('<html lang="en">', f'<html lang="{lang}">')
        out = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title)}</title>", out, count=1)
        out = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{html.escape(desc)}">', out, count=1)
        out = out.replace("<!--SEO-->", seo).replace('<!--CONTENT--><p class="empty">Loading…</p>', body)
        d = os.path.join(DIST, lang, path); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(out)
        urls.append(f"{SITE}/{lang}/{path}")
    for lang in LANGS:
        M = json.load(open(os.path.join(DATA, f"{lang}.json"), encoding="utf-8"))
        names = {m["s"]: m["n"].get(lang) or m["n"]["en"] for m in base}
        listing = "".join(f'<li><a href="/{lang}/species/{m["s"]}">{html.escape(names[m["s"]])}</a> <i>{html.escape(m["lat"])}</i></li>' for m in base)
        page(lang, "", "Mushroom Atlas", "473 European mushroom species with photos and descriptions.", f"<h1>Mushroom Atlas</h1><ul>{listing}</ul>")
        for m in base:
            x = M.get(m["s"], {}); nm = names[m["s"]]
            desc = (" ".join(x.get("desc", [])) or x.get("features", ""))[:155]
            body = (f'<article><h1>{html.escape(nm)}</h1><p><i>{html.escape(m["lat"])}</i></p>'
                    f'<img src="/img/{m["s"]}.webp" alt="{html.escape(nm)}" width="360">'
                    f'<p>{html.escape(x.get("habitat",""))}. {html.escape(x.get("season",""))}.</p>'
                    + "".join(f"<p>{html.escape(p)}</p>" for p in x.get("desc", [])) + "</article>")
            page(lang, f"species/{m['s']}/", f"{nm} ({m['lat']}) · Mushroom Atlas", desc, body)
    open(os.path.join(DIST, "sitemap.xml"), "w").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(f"<url><loc>{u}</loc><lastmod>{date.today()}</lastmod></url>" for u in urls) + "</urlset>")
    open(os.path.join(DIST, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    print(f"full build done: {len(urls)} pages")

if __name__ == "__main__":
    main()
