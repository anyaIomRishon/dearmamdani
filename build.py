"""Builds the Dear Mamdani site from content/ into HTML pages at the repository root.

Run:  python3 build.py
- content/pages/<name>.html  -> <name>.html (index.html is the home page)
- content/letters/<slug>.html -> letters/<slug>.html, listed newest first on letters/index.html
  Each letter starts with a header block:
    <!--
    title: Let robotaxis drive NYC
    date: 2026-11-12
    summary: One or two sentences for the letters list and the home page.
    topics: Transportation, Safety
    sign: https://forms.gle/...   (optional: shows a "Sign the letter" box)
    -->
  Files starting with "_" are skipped (content/letters/_template.html is the starting point for new letters).
Set PREVIEW = False at launch to remove the preview banner and let search engines index the site.
"""
import html, pathlib, re, datetime

PREVIEW = True
SITE = "Dear Mamdani"
TAGLINE = "Weekly letters and a monthly scorecard from New Yorkers"
SUBSTACK = "https://wethemiddle.substack.com"
ROOT = pathlib.Path(__file__).parent
NAV = [("agenda.html", "Our agenda"), ("letters/index.html", "Letters"), ("scorecard.html", "Scorecard"),
       ("take-action.html", "Take action"), ("get-in-touch.html", "Get in touch"), ("about.html", "About")]

def meta_block(text):
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text

def page(title, body, path, description="", extra_head="", scripts=""):
    depth = path.count("/")
    rel = "../" * depth
    current = ' aria-current="page"'
    nav = "".join(f'<a href="{rel}{href}"{current if href == path else ""}>{label}</a>' for href, label in NAV)
    robots = '<meta name="robots" content="noindex">' if PREVIEW else ""
    banner = '<div class="preview">Preview — this site is not launched yet. Figures and wording may change.</div>' if PREVIEW else ""
    full_title = SITE if title == SITE else f"{title} · {SITE}"
    year = datetime.date.today().year
    return f"""<!doctype html>
<html lang="en" data-root="{rel}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(full_title)}</title>
<meta name="description" content="{html.escape(description or TAGLINE)}">
{robots}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;700;800;900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<link rel="stylesheet" href="{rel}assets/site.css">
{extra_head}
</head>
<body>
{banner}
<header class="site-head"><div class="wrap">
  <a class="brand" href="{rel}index.html"><b>Dear <em>Mamdani</em></b><span>{TAGLINE}</span><span class="indep">Independent · Not affiliated with the Mayor or his campaign</span></a>
  <nav class="nav" aria-label="Main">{nav}<a class="btn" href="{rel}index.html#subscribe">Subscribe</a></nav>
</div></header>
<main><div class="wrap">
{body}
</div></main>
<footer class="site-foot"><div class="wrap">
  <span>© {year} {SITE}, an independent citizens\u2019 project. Not affiliated with Mayor Mamdani, his campaign or City Hall. Data from public sources, cited on every figure.</span>
  <span><a href="{rel}about.html#corrections">Corrections</a> · <a href="{SUBSTACK}">We, the Middle on Substack</a></span>
</div></footer>
{scripts.replace("{rel}", rel)}
</body>
</html>
"""

def build():
    letters = []
    for f in sorted((ROOT / "content" / "letters").glob("*.html")):
        if f.name.startswith("_"):
            continue
        meta, body = meta_block(f.read_text())
        slug = f.stem
        meta["slug"] = slug
        letters.append(meta)
        sign = ""
        if meta.get("sign"):
            sign = f'<aside class="do"><h2>Sign the letter</h2><p>Add your name to this letter. We deliver it to the Mayor\'s office with the number of New Yorkers who signed.</p><a class="btn" href="{html.escape(meta["sign"])}">Sign the letter</a></aside>'
        date = datetime.date.fromisoformat(meta.get("date", "2026-01-01")).strftime("%B %-d, %Y")
        head = f'<p class="eyebrow">{html.escape(meta.get("topics", "Letter"))} · {date}</p><h1>{html.escape(meta.get("title", slug))}</h1>'
        out = page(meta.get("title", slug), f'<article class="letter">{head}{body}{sign}</article>', f"letters/{slug}.html", meta.get("summary", ""))
        (ROOT / "letters" / f"{slug}.html").write_text(out)
    letters.sort(key=lambda m: m.get("date", ""), reverse=True)

    if letters:
        items = "".join(
            f'<article class="card"><p class="eyebrow">{html.escape(m.get("topics", ""))} · {datetime.date.fromisoformat(m["date"]).strftime("%b %-d, %Y")}</p>'
            f'<h2><a href="{m["slug"]}.html">{html.escape(m.get("title", ""))}</a></h2><p>{html.escape(m.get("summary", ""))}</p></article>' for m in letters)
        listing = f'<div class="grid">{items}</div>'
        latest = letters[0]
        latest_html = (f'<p class="eyebrow">This week\'s letter</p><h2><a href="letters/{latest["slug"]}.html">{html.escape(latest.get("title", ""))}</a></h2>'
                       f'<p>{html.escape(latest.get("summary", ""))}</p><a class="btn" href="letters/{latest["slug"]}.html">Read the letter</a>')
    else:
        listing = '<div class="card empty"><h2>The first letter is on its way</h2><p>Subscribe to get it in your inbox the day it goes out.</p><a class="btn" href="../index.html#subscribe">Subscribe</a></div>'
        latest_html = '<p class="eyebrow">This week\'s letter</p><h2>The first letter is on its way</h2><p>Every week, one letter to the Mayor on one issue that shapes life in New York: what the problem is, what the data says, and what you can do about it.</p><a class="btn" href="#subscribe">Get it by email</a>'
    (ROOT / "letters" / "index.html").write_text(page("Letters", f'<p class="eyebrow">Letters</p><h1>Letters to the Mayor</h1><p class="lede">One letter a week, one issue at a time. Each one ends with what you can do.</p>{listing}', "letters/index.html"))

    for f in sorted((ROOT / "content" / "pages").glob("*.html")):
        meta, body = meta_block(f.read_text())
        body = body.replace("{{latest_letter}}", latest_html).replace("{{substack}}", SUBSTACK)
        scripts = '<script src="{rel}assets/scorecard.js" defer></script>' if meta.get("scorecard") == "yes" else ""
        name = f.stem + ".html"
        (ROOT / name).write_text(page(meta.get("title", SITE), body, name, meta.get("description", ""), scripts=scripts))
    print("built", len(letters), "letters")

if __name__ == "__main__":
    build()
