# Časovnica kot v montažnem programu: predogled + sledi (posnetki, napisi, grafike, zoomi, imena, govor, glasba) + opombe.
# Uporaba:  python timeline_viewer.py <mapa projekta shortov>   ->  <mapa>/timeline.html (odpri v brskalniku)
# Bere build*/<id>/timeline.json, assets/aroll.mp4 in assets/bed.wav; video poti so relativne na mapo projekta.
import json, os, sys, glob, subprocess, re
import numpy as np

P = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
os.chdir(P)
spec = json.load(open("shorts_spec.json", encoding="utf-8")) if os.path.exists("shorts_spec.json") else []
meta = {s["id"]: s for s in spec}
HERE = os.path.dirname(os.path.abspath(__file__))

def peaks(path, fps=25):
    if not os.path.exists(path): return []
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], capture_output=True)
    a = np.frombuffer(r.stdout, np.float32)
    if not len(a): return []
    hop = 8000 // fps; n = len(a) // hop
    p = np.abs(a[: n * hop]).reshape(n, hop).max(1)
    m = float(np.percentile(p, 99.5)) or 1.0
    return [round(float(min(1.0, x / m)), 2) for x in p]

VAR = [("A", "build", "9:16"), ("B", "build_b", "9:16 B"), ("A45", "build_45a", "4:5"), ("B45", "build_45b", "4:5 B")]
shorts = []
for d in sorted(glob.glob("build/s*")):
    sid = os.path.basename(d)
    tj = f"{d}/timeline.json"
    if not os.path.exists(tj): continue
    T = json.load(open(tj, encoding="utf-8"))
    s = meta.get(sid, {})
    variants = {}
    for key, root, label in VAR:
        f = f"{root}/{sid}/final.mp4"
        if os.path.exists(f):
            full = False
            ih = f"{root}/{sid}/index.html"
            if key.startswith("B") and os.path.exists(ih):
                full = '"bfull": true' in open(ih, encoding="utf-8").read()
            variants[key] = {"src": f.replace("\\", "/"), "label": label, "full": full}
    shorts.append({
        "id": sid, "name": s.get("name", sid), "hook": " ".join(T.get("hook", [])) if isinstance(T.get("hook"), list) else "",
        "btitle": s.get("btitle", "").replace("*", ""), "music": s.get("music", ""),
        "total": T["total"], "vend": T["vend"], "segs": T["segs"], "words": T["words"], "gfx": T.get("gfx", []),
        "comp": T.get("comp", False), "variants": variants,
        "wsp": peaks(f"{d}/assets/aroll.mp4"), "wmu": peaks(f"{d}/assets/bed.wav"),
    })
    print(sid, "ok", list(variants), flush=True)

tpl = open(os.path.join(HERE, "timeline_viewer.html"), encoding="utf-8").read()
html = tpl.replace("__PROJECT__", os.path.basename(P)).replace("__DATA__", json.dumps(shorts, ensure_ascii=False))
open("timeline.html", "w", encoding="utf-8").write(html)
print("->", os.path.join(P, "timeline.html"))
