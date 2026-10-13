"""Style catalog. Every folder in styles/ (repo) or <project>/styles/ (your own) with a style.json is a style.

style.json
  id, name, tagline, description, best_for[], preview (image file in the folder)
  template      HTML composition (in the style folder, or a shared one in templates/)
  format_4x5    CSS that re-lays the template out for 1080x1350 (optional)
  video         crop_w (of the 1280x720 cut), out_w/out_h (panel size), face_track, grade (ffmpeg filter)
  flags         values merged into the timeline data the template reads (e.g. {"bfull": true})
"""
import json, os, glob, shutil
from .project import ROOT

SEARCH = [os.path.join(ROOT, "styles")]


def add_search_path(path):
    if os.path.isdir(path) and path not in SEARCH: SEARCH.insert(0, path)


def all_styles():
    out = {}
    for d in reversed(SEARCH):
        for f in glob.glob(os.path.join(d, "*", "style.json")):
            st = json.load(open(f, encoding="utf-8")); st["_dir"] = os.path.dirname(f); out[st["id"]] = st
    return dict(sorted(out.items(), key=lambda kv: kv[1].get("order", 99)))


def load_style(sid):
    S = all_styles()
    if sid not in S: raise SystemExit(f"Unknown style '{sid}'. Available: {', '.join(S)}")
    return S[sid]


def print_styles():
    for sid, st in all_styles().items():
        print(f"{sid:24s} {st['name']} — {st['tagline']}")
        print(f"{'':24s} best for: {', '.join(st.get('best_for', []))}")


def gallery(out_html):
    """Picker page with every style's reference image, name and description."""
    out_dir = os.path.dirname(os.path.abspath(out_html)); img_dir = os.path.join(out_dir, "style-previews"); os.makedirs(img_dir, exist_ok=True)
    cards = []
    for sid, st in all_styles().items():
        img = ""
        if st.get("preview") and os.path.exists(os.path.join(st["_dir"], st["preview"])):
            dst = os.path.join(img_dir, f"{sid}_{os.path.basename(st['preview'])}"); shutil.copy(os.path.join(st["_dir"], st["preview"]), dst)
            img = f'<img src="style-previews/{os.path.basename(dst)}" alt="{st["name"]}">'
        bf = "".join(f"<li>{b}</li>" for b in st.get("best_for", []))
        cards.append(f'''<article>{img or '<div class="ph">no preview</div>'}<div class="tx"><h2>{st["name"]}</h2><code>{sid}</code>
<p class="tg">{st["tagline"]}</p><p>{st["description"]}</p><ul>{bf}</ul></div></article>''')
    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Edit styles</title><style>
:root{{--bg:#14161b;--card:#1d2028;--ink:#e8eaef;--mut:#8b91a1;--acc:#33d6cc}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif;padding:28px}}
h1{{margin:0 0 4px;font-size:22px}} .sub{{color:var(--mut);margin:0 0 24px}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}}
article{{background:var(--card);border:1px solid #2b303c;border-radius:14px;overflow:hidden}}
img,.ph{{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;background:#000}} .ph{{display:grid;place-items:center;color:var(--mut)}}
.tx{{padding:14px 16px}} h2{{margin:0;font-size:18px}} code{{color:var(--acc);font-size:13px}} .tg{{color:var(--acc);margin:6px 0}}
ul{{color:var(--mut);padding-left:18px;margin:8px 0 0}}
</style></head><body><h1>Choose an edit style</h1><p class="sub">Tell Claude the style id (e.g. <code>cinema-bars</code>) — or send a reference image to create a new style.</p>
<main>{"".join(cards)}</main></body></html>'''
    open(out_html, "w", encoding="utf-8").write(html)
    print("gallery ->", out_html)
    return out_html
