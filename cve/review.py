"""Review tools.
timeline: editor-style review page (preview + tracks: video, captions, graphics, zoom/cuts, names, speech, music)
          with time-stamped notes you copy back to Claude.  ->  <project>/timeline.html
sheet:    contact sheet of every finished short (8 frames each)  ->  qa/sheet_N.jpg"""
import glob, json, os, subprocess
import numpy as np
from .project import TEMPLATES, ffmpeg
from .styles import load_style



def peaks(path, fps=25):
    if not os.path.exists(path): return []
    r = subprocess.run([ffmpeg(), "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], capture_output=True)
    a = np.frombuffer(r.stdout, np.float32)
    if not len(a): return []
    hop = 8000 // fps; n = len(a) // hop; p = np.abs(a[:n * hop]).reshape(n, hop).max(1)
    m = float(np.percentile(p, 99.5)) or 1.0
    return [round(float(min(1.0, x / m)), 2) for x in p]


def timeline(P, ids=()):
    data = []
    for s in P.select(ids):
        tj = P.p("build", s["id"], "timeline.json")
        if not os.path.exists(tj): continue
        T = json.load(open(tj, encoding="utf-8"))
        variants = {}
        for f in sorted(glob.glob(P.p("build", s["id"], "*", "final.mp4"))):
            var = os.path.basename(os.path.dirname(f)); st, _, fmt = var.partition("@")
            try: name = load_style(st)["name"]; full = bool(load_style(st).get("flags", {}).get("bfull"))
            except SystemExit: name, full = st, False
            variants[var] = {"src": os.path.relpath(f, P.dir).replace("\\", "/"), "label": name + (" 4:5" if fmt else " 9:16"), "full": full,
                             "look": "B" if st.startswith("cinema") else "A"}
        data.append({"id": s["id"], "name": s["name"], "hook": " ".join(T.get("hook", [])), "btitle": T.get("btitle", "").replace("*", ""),
                     "music": s.get("music", ""), "total": T["total"], "vend": T["vend"], "segs": T["segs"], "words": T["words"],
                     "gfx": T["gfx"], "comp": T.get("comp", False), "variants": variants,
                     "wsp": peaks(next(iter(glob.glob(P.p("build", s["id"], "*", "assets", "aroll.mp4"))), "")), "wmu": peaks(P.p("build", s["id"], "bed.wav"))})
    tpl = open(os.path.join(TEMPLATES, "timeline.html"), encoding="utf-8").read()
    out = P.p("timeline.html")
    open(out, "w", encoding="utf-8").write(tpl.replace("__PROJECT__", P.cfg["name"]).replace("__DATA__", json.dumps(data, ensure_ascii=False)))
    print("timeline ->", out)
    return out


def sheet(P, ids=()):
    import cv2
    rows = []
    for s in P.select(ids):
        fs = sorted(glob.glob(P.p("build", s["id"], "*", "final.mp4")))
        if not fs: continue
        p = fs[0]
        cap = cv2.VideoCapture(p); n = int(cap.get(7)); fps = cap.get(5) or 30; t = []
        for k in np.linspace(5, max(6, n - 70), 8).astype(int):
            cap.set(1, k); ok, f = cap.read()
            if ok:
                f = cv2.resize(f, (216, 384)); cv2.line(f, (108, 60), (108, 330), (0, 255, 0), 1)
                cv2.putText(f, f"{s['id']} {k / fps:.1f}", (4, 374), 0, 0.5, (0, 255, 255), 1); t.append(f)
        if t: rows.append(np.hstack(t + [np.zeros_like(t[0])] * (8 - len(t))))
    os.makedirs(P.p("qa"), exist_ok=True)
    for i in range(0, len(rows), 5):
        cv2.imwrite(P.p("qa", f"sheet_{i // 5 + 1}.jpg"), np.vstack(rows[i:i + 5]), [cv2.IMWRITE_JPEG_QUALITY, 82])
    print("contact sheets:", (len(rows) + 4) // 5, "-> qa/")
