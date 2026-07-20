#!/usr/bin/env python3
"""Build a simple static HTML documentation site from catalog + samples."""

from __future__ import annotations

import html
import json
import re
import sys
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog" / "endpoints.yaml"
LAST = ROOT / "catalog" / "last_probe.json"
SAMPLES = ROOT / "samples"
SITE = ROOT / "site"
DOCS = ROOT / "docs"

CSS = """
:root {
  --bg: #0a0a0a;
  --panel: #111111;
  --text: #f5f5f5;
  --muted: #a3a3a3;
  --accent: #e5e5e5;
  --bad: #f5a5a5;
  --ok: #c8f0c8;
  --border: rgba(255,255,255,0.1);
  --mono: "JetBrains Mono", ui-monospace, monospace;
  --sans: "IBM Plex Sans", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; font-family: var(--sans); background: var(--bg); color: var(--text);
  line-height: 1.55;
}
a { color: #ffffff; text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: var(--muted); }
header {
  padding: 1.5rem 1.25rem 1rem; border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, #151515, var(--bg));
}
header h1 { margin: 0 0 .35rem; font-size: 1.6rem; letter-spacing: -.02em; }
header p { margin: 0; color: var(--muted); max-width: 52rem; }
nav {
  display: flex; flex-wrap: wrap; gap: .75rem 1.25rem; padding: .75rem 1.25rem;
  border-bottom: 1px solid var(--border); background: var(--panel);
  position: sticky; top: 0; z-index: 2;
}
nav a { text-decoration: none; color: var(--muted); }
nav a:hover { color: var(--text); }
main { padding: 1.25rem; max-width: 960px; margin: 0 auto; }
.card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  padding: 1rem 1.1rem; margin: 0 0 1rem;
}
.card h2 { margin: 0 0 .5rem; font-size: 1.15rem; }
.meta { color: var(--muted); font-size: .92rem; }
.badge {
  display: inline-block; font-size: .75rem; padding: .15rem .45rem;
  border-radius: 999px; border: 1px solid var(--border); margin-right: .35rem;
  font-family: var(--mono);
}
.badge.ok { color: var(--ok); border-color: #356b3d; }
.badge.bad { color: var(--bad); border-color: #7a3b3b; }
.badge.cat { color: var(--accent); }
table { width: 100%; border-collapse: collapse; font-size: .92rem; }
th, td { text-align: left; padding: .45rem .4rem; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
code, pre { font-family: var(--mono); font-size: .85rem; }
pre {
  background: #050505; border: 1px solid var(--border); border-radius: 8px;
  padding: .85rem; overflow: auto; max-height: 320px;
}
footer { padding: 2rem 1.25rem; color: var(--muted); font-size: .9rem; border-top: 1px solid var(--border); }
h3 { margin: 1.2rem 0 .4rem; font-size: 1rem; }
.grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.stat { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: .85rem; }
.stat b { display: block; font-size: 1.4rem; color: #fff; }
"""


def inline(s: str) -> str:
    s = html.escape(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    return s


def md_to_html_basic(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    in_code = False
    in_ul = False
    for line in lines:
        if line.startswith("```"):
            if in_code:
                out.append("</code></pre>")
                in_code = False
            else:
                if in_ul:
                    out.append("</ul>")
                    in_ul = False
                out.append("<pre><code>")
                in_code = True
            continue
        if in_code:
            out.append(html.escape(line))
            continue
        if line.startswith("# "):
            if in_ul:
                out.append("</ul>")
                in_ul = False
            out.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.startswith("## "):
            if in_ul:
                out.append("</ul>")
                in_ul = False
            out.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("### "):
            if in_ul:
                out.append("</ul>")
                in_ul = False
            out.append(f"<h3>{html.escape(line[4:])}</h3>")
        elif line.startswith("|"):
            continue
        elif line.startswith("- "):
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline(line[2:])}</li>")
        elif line.strip() == "":
            if in_ul:
                out.append("</ul>")
                in_ul = False
        else:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            out.append(f"<p>{inline(line)}</p>")
    if in_code:
        out.append("</code></pre>")
    if in_ul:
        out.append("</ul>")
    return "\n".join(out)


def page(title: str, body: str, root: str = ".") -> str:
    nav = f"""
<nav>
  <a href="{root}/index.html">Home</a>
  <a href="{root}/endpoints/index.html">Endpoints</a>
  <a href="{root}/limitations.html">Limitations</a>
  <a href="{root}/ethics.html">Ethics</a>
  <a href="{root}/examples.html">Examples</a>
  <a href="{root}/probe.html">Last probe</a>
  <a href="{root}/changelog.html">Changelog</a>
</nav>"""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{html.escape(title)} · ikman API Docs (unofficial)</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <h1>Unofficial ikman API Docs</h1>
  <p>Live-probed documentation for <code>https://api.ikman.lk</code>. Not affiliated with ikman / Saltside.</p>
</header>
{nav}
<main>
{body}
</main>
<footer>
  MIT-licensed harness · Educational use · <a href="{root}/ethics.html">Ethics</a> ·
  Generated {datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")}
</footer>
</body>
</html>
"""


def curl_example(base: str, ep: dict, meta: dict) -> str:
    path = ep["path"].replace("{{ad_id}}", "<ad_id>")
    method = ep["method"]
    url = f"{base}{path}"
    q = ep.get("query") or {}
    rendered = {}
    for k, v in q.items():
        s = str(v)
        s = s.replace("{{category}}", str(meta.get("test_category", 409)))
        s = s.replace("{{subcategory}}", str(meta.get("test_subcategory", 415)))
        s = s.replace("{{location}}", str(meta.get("test_location", 1506)))
        s = s.replace("{{next_page_token}}", "<next_page_token>")
        rendered[k] = s
    if rendered:
        url = f"{url}?{urlencode(rendered)}"
    return (
        f"curl -sS '{url}' \\\n"
        f"  -H 'Accept: application/json' \\\n"
        f"  -H 'Application: web'"
    )


def main() -> None:
    cfg = yaml.safe_load(CATALOG.read_text(encoding="utf-8"))
    base = cfg["meta"]["base_url"]
    meta = cfg["meta"]
    probe: dict = {}
    if LAST.exists():
        probe = json.loads(LAST.read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in probe.get("results", [])}

    SITE.mkdir(parents=True, exist_ok=True)
    (SITE / "endpoints").mkdir(exist_ok=True)

    cats: dict[str, list] = defaultdict(list)
    for ep in cfg["endpoints"]:
        cats[ep.get("category", "other")].append(ep)

    stats = f"""
<div class="grid">
  <div class="stat"><b>{len(cfg['endpoints'])}</b>HTTP endpoints catalogued</div>
  <div class="stat"><b>{probe.get('passed', '—')}</b>last probe passed</div>
  <div class="stat"><b>{len(cfg.get('property_categories', {}).get('children', []))}</b>property subcategories</div>
  <div class="stat"><b>{(probe.get('probed_at') or 'not probed')[:19]}</b>last verified</div>
</div>
"""
    index_body = stats + """
<div class="card">
  <h2>What this is</h2>
  <p class="meta">Unofficial, live-probed map of ikman’s public JSON API — the same surface
  the ikman.lk web app calls. Request shapes, pagination tokens, category IDs,
  truncated samples, and hard limits (deep-page 500s, no archive).</p>
  <p class="meta">Structured like <a href="https://github.com/Cookie-Cat21/cse-api-docs">cse-api-docs</a>
  so this folder can graduate into its own docs UI / GitHub Pages site.</p>
</div>
<div class="card">
  <h2>Quick headers</h2>
  <pre><code>Accept: application/json
Application: web</code></pre>
</div>
<div class="card">
  <h2>Categories</h2>
  <ul>
"""
    for cat, eps in sorted(cats.items()):
        index_body += (
            f"<li><a href='endpoints/index.html#{html.escape(cat)}'>"
            f"<code>{html.escape(cat)}</code></a> — {len(eps)} endpoints</li>\n"
        )
    index_body += "</ul></div>"
    (SITE / "index.html").write_text(page("Home", index_body), encoding="utf-8")

    ep_index = ["<h2>Endpoint catalog</h2>"]
    for cat, eps in sorted(cats.items()):
        ep_index.append(
            f"<h3 id='{html.escape(cat)}'>{html.escape(cat)}</h3>"
            "<table><tr><th>ID</th><th>Method</th><th>Path</th><th>Probe</th></tr>"
        )
        for ep in eps:
            rid = ep["id"]
            st = by_id.get(rid, {})
            badge = (
                f"<span class='badge ok'>{st.get('status')}</span>"
                if st.get("ok")
                else (
                    f"<span class='badge bad'>{st.get('status')}</span>"
                    if st
                    else "<span class='badge'>unprobed</span>"
                )
            )
            ep_index.append(
                f"<tr><td><a href='{html.escape(rid)}.html'><code>{html.escape(rid)}</code></a></td>"
                f"<td>{html.escape(ep['method'])}</td>"
                f"<td><code>{html.escape(ep['path'])}</code></td>"
                f"<td>{badge}</td></tr>"
            )
        ep_index.append("</table>")
    (SITE / "endpoints" / "index.html").write_text(
        page("Endpoints", "\n".join(ep_index), root=".."), encoding="utf-8"
    )

    for ep in cfg["endpoints"]:
        rid = ep["id"]
        st = by_id.get(rid, {})
        sample_path = SAMPLES / f"{rid}.json"
        sample_html = "<p class='meta'>No sample yet — run <code>python3 scripts/probe.py</code>.</p>"
        if sample_path.exists():
            raw = sample_path.read_text(encoding="utf-8")
            sample_html = f"<pre><code>{html.escape(raw[:8000])}</code></pre>"

        fields = ep.get("fields") or []
        fields_html = ""
        if fields:
            fields_html = "<h3>Notable fields</h3><ul>" + "".join(
                f"<li><code>{html.escape(f.get('path',''))}</code>"
                + (f" — {html.escape(f['note'])}" if f.get("note") else "")
                + "</li>"
                for f in fields
            ) + "</ul>"

        notes = ep.get("notes") or []
        notes_html = ""
        if notes:
            notes_html = "<h3>Notes</h3><ul>" + "".join(
                f"<li>{html.escape(n)}</li>" for n in notes
            ) + "</ul>"

        body = f"""
<div class="card">
  <h2><code>{html.escape(rid)}</code></h2>
  <p>{html.escape(ep.get('summary') or '')}</p>
  <p class="meta">
    <span class="badge cat">{html.escape(ep.get('category') or '')}</span>
    <span class="badge">{html.escape(ep['method'])}</span>
    <code>{html.escape(ep['path'])}</code>
  </p>
  <p class="meta">Last probe:
    {"✅ " + str(st.get("status")) if st.get("ok") else ("❌ " + str(st.get("status") or st.get("error") or "unprobed"))}
  </p>
  <h3>curl</h3>
  <pre><code>{html.escape(curl_example(base, ep, meta))}</code></pre>
  {fields_html}
  {notes_html}
  <h3>Sample</h3>
  {sample_html}
</div>
"""
        (SITE / "endpoints" / f"{rid}.html").write_text(
            page(rid, body, root=".."), encoding="utf-8"
        )

    for name, md_file, title in [
        ("ethics", "ETHICS.md", "Ethics"),
        ("limitations", "LIMITATIONS.md", "Limitations"),
        ("changelog", "CHANGELOG.md", "Changelog"),
        ("examples", "EXAMPLES.md", "Examples"),
    ]:
        md_path = DOCS / md_file
        content = md_path.read_text(encoding="utf-8") if md_path.exists() else f"# {title}\n\nComing soon."
        (SITE / f"{name}.html").write_text(
            page(title, md_to_html_basic(content)), encoding="utf-8"
        )

    # probe page
    report_md = ROOT / "catalog" / "PROBE_REPORT.md"
    probe_body = md_to_html_basic(
        report_md.read_text(encoding="utf-8") if report_md.exists() else "# Probe\n\nNot run yet."
    )
    if LAST.exists():
        probe_body += f"<h3>last_probe.json</h3><pre><code>{html.escape(LAST.read_text(encoding='utf-8')[:6000])}</code></pre>"
    (SITE / "probe.html").write_text(page("Last probe", probe_body), encoding="utf-8")

    # property categories page snippet on endpoints index already enough
    print(f"Built site → {SITE}")


if __name__ == "__main__":
    main()
