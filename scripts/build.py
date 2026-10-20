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

OG_LOCALE = {"en": "en_GB", "de": "de_DE", "fr": "fr_FR", "es": "es_ES", "it": "it_IT", "pl": "pl_PL",
             "da": "da_DK", "sv": "sv_SE", "lt": "lt_LT", "ru": "ru_RU"}

def prerender():
    shell = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    base = json.load(open(os.path.join(DATA, "base.json"), encoding="utf-8"))
    S = json.load(open(os.path.join(DATA, "seo.json"), encoding="utf-8"))
    E = html.escape
    pages = []  # (path, langs) for the sitemap

    def href(lang, path):
        return f"{SITE}/{lang}/{path}"

    def alts(path):
        xd = f"{SITE}/" if path == "" else href("en", path)
        return "".join(f'<link rel="alternate" hreflang="{l}" href="{href(l, path)}">' for l in LANGS) + \
               f'<link rel="alternate" hreflang="x-default" href="{xd}">'

    def page(lang, path, title, desc, body, image=None, ld=None):
        url = href(lang, path)
        img = f"{SITE}{image}" if image else f"{SITE}/icon-512.png"
        seo = (f'<link rel="canonical" href="{url}">{alts(path)}'
               f'<meta property="og:site_name" content="Mushroom Atlas">'
               f'<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">'
               f'<meta property="og:type" content="{"article" if ld and ld.get("@type") == "Article" else "website"}">'
               f'<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">'
               f'<meta property="og:locale" content="{OG_LOCALE[lang]}">'
               + "".join(f'<meta property="og:locale:alternate" content="{OG_LOCALE[l]}">' for l in LANGS if l != lang)
               + f'<meta name="twitter:card" content="summary_large_image">')
        if ld:
            seo += '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace("</", "<\\/") + "</script>"
        out = shell.replace('<html lang="en">', f'<html lang="{lang}">')
        out = re.sub(r"<title>.*?</title>", f"<title>{E(title)}</title>", out, count=1)
        out = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{E(desc)}">', out, count=1)
        out = out.replace("<!--SEO-->", seo).replace('<!--CONTENT--><p class="empty">Loading…</p>', body)
        d = os.path.join(DIST, lang, path); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(out)

    def crumbs(lang, items):
        return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": href(lang, p)} for i, (n, p) in enumerate(items)]}

    articles = {l: json.load(open(os.path.join(DATA, f"a-{l}.json"), encoding="utf-8")) for l in LANGS}
    for lang in LANGS:
        s = S[lang]; T = s["types"]
        M = json.load(open(os.path.join(DATA, f"{lang}.json"), encoding="utf-8"))
        names = {m["s"]: m["n"].get(lang) or m["n"]["en"] for m in base}
        site_name = s["h1"] if s["h1"] == "Mushroom Atlas" else f'{s["h1"]} · Mushroom Atlas'

        # Home
        listing = "".join(f'<li><a href="/{lang}/species/{m["s"]}/">{E(names[m["s"]])}</a> <i>{E(m["lat"])}</i> – {E(T.get(m["t"], ""))}</li>' for m in base)
        home_title = site_name if s["h1"] != "Mushroom Atlas" else "Mushroom Atlas – European mushroom guide"
        page(lang, "", home_title, s["lead"][:158],
             f'<h1>{E(s["h1"])}</h1><p>{E(s["lead"])}</p><ul>{listing}</ul>',
             ld={"@context": "https://schema.org", "@type": "WebSite", "name": "Mushroom Atlas", "alternateName": s["h1"],
                 "url": href(lang, ""), "inLanguage": lang, "description": s["lead"]})

        # Species
        for m in base:
            x = M.get(m["s"], {}); nm = names[m["s"]]; typ = T.get(m["t"], "")
            text = " ".join(x.get("desc", [])) or x.get("features", "")
            desc = (f"{typ}. " if typ else "") + text
            desc = desc[:155].rsplit(" ", 1)[0] + "…" if len(desc) > 158 else desc
            path = f"species/{m['s']}/"
            body = (f'<article><h1>{E(nm)}</h1><p><i>{E(m["lat"])}</i> – {E(typ)}</p>'
                    f'<img src="/img/{m["s"]}.webp" alt="{E(nm)} ({E(m["lat"])})" width="340" height="340">'
                    f'<p>{E(x.get("habitat",""))}. {E(x.get("season",""))}.</p>'
                    + "".join(f"<p>{E(p)}</p>" for p in x.get("desc", [])) + "</article>")
            ld = [crumbs(lang, [(site_name, ""), (nm, path)]),
                  {"@context": "https://schema.org", "@type": "Article", "headline": f"{nm} ({m['lat']})", "inLanguage": lang,
                   "image": f"{SITE}/img/{m['s']}.webp", "about": {"@type": "Thing", "name": m["lat"], "alternateName": nm},
                   "publisher": {"@type": "Organization", "name": "Mushroom Atlas", "url": SITE}, "mainEntityOfPage": href(lang, path)}]
            title = f"{nm} ({m['lat']}) – {typ} · Mushroom Atlas" if typ else f"{nm} ({m['lat']}) · Mushroom Atlas"
            page(lang, path, title, desc, body, image=f"/img/{m['s']}.webp", ld={"@context": "https://schema.org", "@graph": [
                {k: v for k, v in g.items() if k != "@context"} for g in ld]})
            pages.append(path)

        # Learn + articles
        A = articles[lang]
        page(lang, "learn/", f'{s["nav"][1]} · Mushroom Atlas', s["lead"][:158],
             f'<h1>{E(s["nav"][1])}</h1><ul>' + "".join(f'<li><a href="/{lang}/article/{i}/">{E(a["h"])}</a></li>' for i, a in enumerate(A)) + "</ul>")
        for i, a in enumerate(A):
            path = f"article/{i}/"
            ps = [b["x"] for b in a["blocks"] if b.get("x")]
            d = " ".join(ps); d = d[:155].rsplit(" ", 1)[0] + "…" if len(d) > 158 else d
            page(lang, path, f'{a["h"]} · Mushroom Atlas', d,
                 f'<article class="article"><h1>{E(a["h"])}</h1>' + "".join(f"<p>{E(p)}</p>" for p in ps) + "</article>",
                 ld={"@context": "https://schema.org", "@type": "Article", "headline": a["h"], "inLanguage": lang,
                     "publisher": {"@type": "Organization", "name": "Mushroom Atlas", "url": SITE}, "mainEntityOfPage": href(lang, path)})

    all_paths = [""] + ["learn/"] + [f"article/{i}/" for i in range(len(articles["en"]))] + pages[:len(base)]
    today = date.today().isoformat()
    def entry(lang, path):
        links = "".join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{href(l, path)}"/>' for l in LANGS)
        return f"<url><loc>{href(lang, path)}</loc><lastmod>{today}</lastmod>{links}</url>"
    with open(os.path.join(DIST, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">')
        for path in all_paths:
            for lang in LANGS:
                f.write(entry(lang, path))
        f.write("</urlset>")
    open(os.path.join(DIST, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    print(f"full build done: {len(all_paths) * len(LANGS)} pages")

if __name__ == "__main__":
    main()
