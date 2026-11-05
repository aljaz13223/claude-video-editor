#!/usr/bin/env python3
"""Motion-graphic inserts for talking-head videos (graphs, numbers, steps, quotes ...).

Each insert is a short HyperFrames scene that shows what the speaker is talking about.
Layouts: full (graphic over the whole frame, speech continues underneath),
         half (graphic top 56 %, speaker bottom — speaker stays on camera),
         pip  (graphic full, speaker in a circle).

  python inserts.py demo  inserts.json                 # write an example spec with every scene type
  python inserts.py build inserts.json --out inserts/  # one HyperFrames project per insert
  python inserts.py render inserts/ [--ids i1,i3]      # render every project to insert.mp4
  python inserts.py snap  inserts/                     # 3 stills per insert (look before rendering)
  python inserts.py apply inserts.json inserts/ --aroll aroll.mp4 --out with_inserts.mp4

Spec (inserts.json):
{
  "format": [1080, 1920], "theme": "paper", "aroll": "aroll.mp4",
  "inserts": [ {"id": "i1", "t": 12.4, "dur": 4.0, "type": "stat", "layout": "half",
                "value": 72, "suffix": " %", "title": "ljudi *odneha*", "sub": "v prvem letu"} ]
}
Text: wrap a word in *stars* to make it the accent word (accent colour + serif italic).
Themes: built-in below; add brand themes in themes.local.json next to the spec or this script (never commit those).
"""
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
HF = os.environ.get("HYPERFRAMES", "npx --yes hyperframes@0.8.141")

THEMES = {
    # Arthur-style premium minimal: paper, ink, one blue accent
    "paper": dict(bg="#f2eee5", fg="#151515", acc="#2b55ff", mut="#6e695f", line="rgba(20,20,20,0.16)", bar="rgba(20,20,20,0.14)",
                  card="rgba(255,255,255,0.55)", sans="'Inter'", serif="'Playfair Display'", grain="0.35",
                  bgfx="radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.28), rgba(242,238,229,0) 60%)"),
    "paper-dark": dict(bg="#121212", fg="#f1ede4", acc="#4d7bff", mut="#9a958b", line="rgba(255,255,255,0.14)", bar="rgba(255,255,255,0.16)",
                  card="rgba(255,255,255,0.05)", sans="'Inter'", serif="'Playfair Display'", grain="0.25",
                  bgfx="radial-gradient(ellipse at 50% 35%, rgba(77,123,255,0.16), rgba(18,18,18,0) 60%)"),
    "dark-teal": dict(bg="#0b1520", fg="#ffffff", acc="#1fb8b4", mut="rgba(214,240,238,0.75)", line="rgba(31,184,180,0.35)", bar="rgba(255,255,255,0.16)",
                  card="rgba(22,42,56,0.9)", sans="'Poppins'", serif="'Playfair Display'", grain="0",
                  bgfx="radial-gradient(ellipse at 50% 30%, rgba(31,184,180,0.28), rgba(11,21,32,0) 60%)"),
    "swiss": dict(bg="#f4f4f2", fg="#111111", acc="#1f3bff", mut="#666666", line="rgba(0,0,0,0.2)", bar="rgba(0,0,0,0.13)",
                  card="#ffffff", sans="'Inter'", serif="'Playfair Display'", grain="0",
                  bgfx="linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px) 0 0/90px 90px"),
    "drift": dict(bg="#06071a", fg="#eef0ff", acc="#3de1d6", mut="rgba(200,205,255,0.7)", line="rgba(123,108,255,0.35)", bar="rgba(123,108,255,0.35)",
                  card="rgba(123,108,255,0.10)", sans="'Space Grotesk'", serif="'Playfair Display'", grain="0",
                  bgfx="radial-gradient(ellipse at 30% 30%, rgba(123,108,255,0.30), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(61,225,214,0.18), transparent 55%)"),
    # from IG references (2026-11-04)
    "warm-editorial": dict(bg="#1c120c", fg="#f3e6d6", acc="#e0a96d", mut="rgba(243,230,214,0.65)", line="rgba(224,169,109,0.30)", bar="rgba(243,230,214,0.16)",
                  card="rgba(255,255,255,0.06)", sans="'Inter'", serif="'Playfair Display'", grain="0.2",
                  bgfx="radial-gradient(ellipse at 50% 20%, rgba(150,90,50,0.45), rgba(28,18,12,0) 65%)"),
    "audio-lab": dict(bg="#050505", fg="#eaeaea", acc="#2bd86b", mut="#8a8a8a", line="rgba(43,216,107,0.25)", bar="rgba(255,255,255,0.12)",
                  card="#111111", sans="'Space Grotesk'", serif="'Playfair Display'", grain="0",
                  bgfx="none"),
    "grid-blue": dict(bg="#ffffff", fg="#111827", acc="#2563eb", mut="#6b7280", line="rgba(37,99,235,0.18)", bar="rgba(17,24,39,0.10)",
                  card="#ffffff", sans="'Inter'", serif="'Playfair Display'", grain="0",
                  bgfx="linear-gradient(90deg, rgba(17,24,39,0.06) 1px, transparent 1px) 0 0/64px 64px, linear-gradient(0deg, rgba(17,24,39,0.06) 1px, transparent 1px) 0 0/64px 64px"),
}

def load_themes(spec_dir):
    th = dict(THEMES)
    for p in (spec_dir / "themes.local.json", HERE / "themes.local.json"):
        if p.exists(): th.update(json.loads(p.read_text(encoding="utf-8")))
    return th

def tokens(t):
    return " ".join(f"--{k}: {v};" for k, v in t.items())

def ff():
    return shutil.which("ffmpeg") or "ffmpeg"

def build(spec_path, out):
    spec_path = Path(spec_path); spec = json.loads(spec_path.read_text(encoding="utf-8"))
    W, H = spec.get("format", [1080, 1920]); themes = load_themes(spec_path.parent)
    tpl = (HERE / "insert_template.html").read_text(encoding="utf-8")
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    for ins in spec["inserts"]:
        d = out / ins["id"]; (d / "assets").mkdir(parents=True, exist_ok=True)
        th = themes[ins.get("theme", spec.get("theme", "paper"))]
        dur = float(ins.get("dur", 4.0))
        if dur < 3.0: print(f"  ! {ins['id']}: {dur}s < 3 s — graphics need ≥ 3 s to be read")
        face = ""
        if ins.get("layout", "full") in ("half", "pip"):
            src = spec.get("aroll")
            if not src: sys.exit(f"{ins['id']}: layout {ins['layout']} needs 'aroll' in the spec")
            src = (spec_path.parent / src) if not Path(src).is_absolute() else Path(src)
            subprocess.run([ff(), "-y", "-loglevel", "error", "-ss", str(ins["t"]), "-i", str(src), "-t", str(dur), "-an",
                            "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(d / "assets" / "face.mp4")], check=True)
            face = f'<video id="face" class="clip" src="assets/face.mp4" data-start="0" data-duration="{dur}" data-track-index="1" muted playsinline></video>'
        data = dict(ins); data["dur"] = dur
        html = (tpl.replace("__W__", str(W)).replace("__H__", str(H)).replace("__DUR__", str(dur))
                   .replace("__TOKENS__", tokens(th)).replace("__FACE__", face)
                   .replace("__DATA__", json.dumps(data, ensure_ascii=False)))
        (d / "index.html").write_text(html, encoding="utf-8")
        (d / "hyperframes.json").write_text(json.dumps({"paths": {"assets": "assets"}, "media": {"autoProxy": True}}, indent=2), encoding="utf-8")
        (d / "meta.json").write_text(json.dumps({"id": ins["id"], "name": ins["id"]}), encoding="utf-8")
        (d / "package.json").write_text(json.dumps({"name": ins["id"], "private": True, "type": "module"}), encoding="utf-8")
        print(f"built {d}  [{ins['type']}, {ins.get('layout','full')}, {dur}s]")

def each(out, ids):
    for d in sorted(Path(out).iterdir()):
        if d.is_dir() and (d / "index.html").exists() and (not ids or d.name in ids): yield d

def render(out, ids):
    for d in each(out, ids):
        r = subprocess.run(f'{HF} render -o insert.mp4', cwd=d, shell=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
        print(d.name, "OK" if (d / "insert.mp4").exists() and r.returncode == 0 else "FAIL\n" + r.stdout[-800:] + r.stderr[-800:])

def snap(out, ids):
    for d in each(out, ids):
        dur = json.loads(d.joinpath("index.html").read_text(encoding="utf-8").split("const D = ", 1)[1].split(";\n", 1)[0])["dur"]
        at = ",".join(f"{x:.2f}" for x in (0.8, dur * 0.5, dur - 0.5))
        subprocess.run(f'{HF} snapshot . --at "{at}" --no-end -o stills', cwd=d, shell=True)
        print(d.name, "stills →", d / "stills")

def apply(spec_path, out, aroll, dest):
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8")); fw, fh = spec.get("format", [1080, 1920])
    pr = subprocess.run([shutil.which("ffprobe") or "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                         "-of", "csv=p=0", aroll], capture_output=True, text=True).stdout.strip().split(",")
    W, H = int(pr[0]), int(pr[1])
    if abs(W / H - fw / fh) > 0.01: print(f"  ! A-roll is {W}x{H} but the spec format is {fw}x{fh} — rebuild the inserts with format [{W},{H}]")
    inputs, chain, last = ["-i", aroll], [], "[0:v]"
    for k, ins in enumerate(spec["inserts"], 1):
        f = Path(out) / ins["id"] / "insert.mp4"
        if not f.exists(): sys.exit(f"missing {f} — render first")
        t0, dur = float(ins["t"]), float(ins.get("dur", 4.0))
        inputs += ["-itsoffset", str(t0), "-i", str(f)]
        chain.append(f"[{k}:v]scale={W}:{H},setpts=PTS[s{k}];{last}[s{k}]overlay=enable='between(t,{t0},{t0+dur})'[v{k}]")
        last = f"[v{k}]"
    cmd = [ff(), "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chain), "-map", last, "-map", "0:a?",
           "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "copy", dest]
    subprocess.run(cmd, check=True); print("→", dest)

DEMO = {
  "format": [1080, 1920], "theme": "paper", "aroll": "aroll.mp4",
  "inserts": [
    {"id": "i1", "t": 2.0, "dur": 4.0, "type": "stat", "layout": "full", "value": 72, "suffix": " %", "title": "ljudi *odneha*", "sub": "v prvem letu"},
    {"id": "i2", "t": 7.0, "dur": 4.5, "type": "bar", "layout": "full", "title": "Ure na *teden*", "suffix": " h", "items": [{"l": "2019", "v": 38}, {"l": "2022", "v": 44}, {"l": "2026", "v": 52, "hi": True}]},
    {"id": "i3", "t": 12.0, "dur": 4.5, "type": "line", "layout": "full", "title": "Rast *zaupanja*", "points": [2, 3, 3, 5, 8, 13], "labels": ["jan", "mar", "jun"], "end_label": "+550 %"},
    {"id": "i4", "t": 17.0, "dur": 5.0, "type": "steps", "layout": "full", "title": "Kako *začeti*", "items": ["Zapiši *cilj*", "Naredi prvi korak", "Ponavljaj *30 dni*"]},
    {"id": "i5", "t": 23.0, "dur": 4.0, "type": "compare", "layout": "full", "title": "Prej / *potem*", "a": {"h": "Prej", "items": ["stres", "brez plana"]}, "b": {"h": "Potem", "items": ["mir", "jasen plan"]}},
    {"id": "i6", "t": 28.0, "dur": 4.5, "type": "quote", "layout": "full", "text": "Pogum ni odsotnost *strahu*", "who": "gost"},
    {"id": "i7", "t": 33.0, "dur": 5.0, "type": "linetext", "layout": "full", "words": ["*klic*", "pogum", "*agilnost*"]},
    {"id": "i8", "t": 38.5, "dur": 3.5, "type": "keyword", "layout": "full", "above": "vse se začne z", "word": "*odločitvijo*", "below": "ne z motivacijo"},
    {"id": "i9", "t": 42.5, "dur": 5.0, "type": "timeline", "layout": "full", "title": "Moja *pot*", "items": [{"y": "2015", "t": "glasbenik"}, {"y": "2019", "t": "znanstvenik"}, {"y": "2026", "t": "podjetnik"}]},
    {"id": "i10", "t": 48.0, "dur": 4.5, "type": "checklist", "layout": "full", "title": "Kaj *potrebuješ*", "items": ["jasen cilj", "1 uro na dan", "*potrpežljivost*"]}
  ]
}

if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["demo", "build", "render", "snap", "apply"]); ap.add_argument("a")
    ap.add_argument("b", nargs="?"); ap.add_argument("--out", default="inserts"); ap.add_argument("--ids", default="")
    ap.add_argument("--aroll"); ap.add_argument("--dest", "--out-video", dest="dest", default="with_inserts.mp4")
    a = ap.parse_args(); ids = [x for x in a.ids.split(",") if x]
    if a.cmd == "demo": Path(a.a).write_text(json.dumps(DEMO, ensure_ascii=False, indent=2), encoding="utf-8"); print("→", a.a)
    elif a.cmd == "build": build(a.a, a.out)
    elif a.cmd == "render": render(a.a, ids)
    elif a.cmd == "snap": snap(a.a, ids)
    elif a.cmd == "apply": apply(a.a, a.b, a.aroll, a.dest)
