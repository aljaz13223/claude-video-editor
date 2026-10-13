"""Project configuration: project.json (brand, folders, levels) + shorts.json (what to cut)."""
import json, os, shutil, glob

DEFAULTS = {
    "name": "My Show",
    "language": "en",
    "raw_dir": "raw",                 # source episodes (mp4)
    "transcripts_dir": "transcripts", # <episode>.words.json from `cve transcribe`
    "music_dir": "music",             # background tracks (wav/mp3) you own or licensed
    "final_dir": "final",             # finished files are copied here
    "host": "",                       # host name (compilations number every guest except the host)
    "brand": {
        "name": "myshow.com",
        "tagline": "THE PODCAST",
        "end_line": "Full conversation on",
        "logo": "logo.svg",           # relative to the project folder; falls back to templates/logo.svg
        "bg": "#0b1520",              # dark background
        "accent": "#1fb8b4",          # titles, bars, rings
        "highlight": "#3ddc5a",       # active caption word
        "accent_b": "#33d6cc",        # accent for the cinematic (B) look
    },
    "music": {"speech_db": -15.0, "gap_db": -9.0, "end_db": -6.0},
    "end_card_seconds": 1.8,
    "hyperframes": "hyperframes@0.8.141",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES = os.path.join(ROOT, "templates")


def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = deep_merge(a[k], v) if isinstance(v, dict) and isinstance(a.get(k), dict) else v
    return out


def hex_rgb(h):
    h = h.lstrip("#")
    return ",".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


class Project:
    def __init__(self, path):
        self.dir = os.path.abspath(path)
        pj = os.path.join(self.dir, "project.json")
        cfg = json.load(open(pj, encoding="utf-8")) if os.path.exists(pj) else {}
        self.cfg = deep_merge(DEFAULTS, cfg)
        self.shorts_path = os.path.join(self.dir, "shorts.json")
        self.shorts = json.load(open(self.shorts_path, encoding="utf-8")) if os.path.exists(self.shorts_path) else []

    def p(self, *a):
        return os.path.join(self.dir, *a)

    def save_shorts(self):
        json.dump(self.shorts, open(self.shorts_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    def select(self, ids):
        return [s for s in self.shorts if not ids or s["id"] in ids]

    def raw_file(self, key):
        d = self.p(self.cfg["raw_dir"])
        hits = [f for f in sorted(os.listdir(d)) if key in f and f.lower().endswith((".mp4", ".mov", ".mkv"))]
        if not hits:
            raise SystemExit(f"No source video in {d} matching '{key}'")
        return os.path.join(d, hits[0])

    def words_file(self, key):
        hits = glob.glob(os.path.join(self.p(self.cfg["transcripts_dir"]), f"*{key}*.words.json"))
        if not hits:
            raise SystemExit(f"No transcript *{key}*.words.json — run `cve transcribe` first")
        return hits[0]

    def logo_path(self):
        p = self.p(self.cfg["brand"]["logo"])
        return p if os.path.exists(p) else os.path.join(TEMPLATES, "logo.svg")

    def vars(self):
        b = self.cfg["brand"]
        return {"bg": b["bg"], "bg_rgb": hex_rgb(b["bg"]), "accent": b["accent"], "accent_rgb": hex_rgb(b["accent"]),
                "highlight": b["highlight"], "accent_b": b["accent_b"], "accent_b_rgb": hex_rgb(b["accent_b"]),
                "brand": b["name"], "brand_upper": b["name"].upper(), "tagline": b["tagline"], "end_line": b["end_line"],
                "lang": self.cfg["language"]}


def fill(tpl, values):
    for k, v in values.items():
        tpl = tpl.replace("{{" + k + "}}", str(v))
    return tpl


def ffmpeg():
    f = shutil.which("ffmpeg")
    if not f:
        raise SystemExit("ffmpeg not found on PATH")
    return f


def hf_project_files(dst, name):
    """Minimal HyperFrames project files next to index.html."""
    json.dump({"$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
               "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
               "media": {"autoProxy": True}}, open(os.path.join(dst, "hyperframes.json"), "w"), indent=2)
    json.dump({"name": name, "private": True, "type": "module"}, open(os.path.join(dst, "package.json"), "w"), indent=2)
    json.dump({"id": name, "name": name}, open(os.path.join(dst, "meta.json"), "w"), indent=2)
