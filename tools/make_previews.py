"""Regenerate the reference image of every style: builds a demo project with a synthetic presenter clip
(no real person, no third-party footage), renders each style in 9:16 and saves styles/<id>/preview.jpg.
   python tools/make_previews.py            (needs ffmpeg, Node/npx and Pillow)"""
import json, math, os, random, shutil, subprocess, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from cve.project import Project
from cve.styles import all_styles
from cve import cut, build, music, render

DEMO = os.path.join(ROOT, "examples", "demo")
LINE = ("The biggest paradox of our time is simple. We are more connected than ever, "
        "and we are lonelier than ever. Real change starts when you put the phone down.")


def presenter(path, seconds=12, W=1280, H=720, FPS=30):
    from PIL import Image, ImageDraw, ImageFilter
    random.seed(3)
    y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
    a = np.zeros((H, W, 3), np.float32); a[..., 0] = 28 + 40 * (1 - y) + 20 * x; a[..., 1] = 40 + 50 * (1 - y) + 10 * x; a[..., 2] = 58 + 60 * (1 - y)
    bg = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(bg, "RGBA")
    for _ in range(26):
        cx, cy, r = random.randint(0, W), random.randint(0, int(H * 0.6)), random.randint(14, 46)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=random.choice([(255, 190, 120), (255, 220, 170), (140, 200, 255)]) + (random.randint(40, 90),))
    bg = bg.filter(ImageFilter.GaussianBlur(10)); d = ImageDraw.Draw(bg, "RGBA")
    d.rectangle([0, 560, W, H], fill=(52, 38, 30, 255)); d.rectangle([0, 556, W, 566], fill=(90, 68, 52, 255))
    d.rectangle([90, 250, 330, 262], fill=(80, 60, 46, 255)); d.ellipse([140, 170, 230, 255], fill=(60, 110, 70, 255)); d.rectangle([170, 230, 200, 255], fill=(150, 110, 80, 255))
    bg = bg.filter(ImageFilter.GaussianBlur(2))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-f", "lavfi", "-i", f"sine=f=180:d={seconds}", "-af", "volume='0.3*(0.6+0.4*sin(2*PI*t*4))':eval=frame",
                          "-shortest", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", path], stdin=subprocess.PIPE)
    for k in range(FPS * seconds):
        t = k / FPS; im = bg.copy(); d = ImageDraw.Draw(im, "RGBA")
        sx = 640 + 10 * math.sin(t * 0.9); sy = 6 * math.sin(t * 1.7)
        d.rounded_rectangle([sx - 230, 430 + sy, sx + 230, 760], radius=120, fill=(70, 82, 96, 255))
        d.polygon([(sx - 60, 430 + sy), (sx + 60, 430 + sy), (sx, 500 + sy)], fill=(225, 225, 220, 255))
        d.rectangle([sx - 38, 360 + sy, sx + 38, 440 + sy], fill=(196, 150, 122, 255))
        hx = sx + 6 * math.sin(t * 1.3); hy = 250 + sy + 4 * math.sin(t * 2.1)
        d.ellipse([hx - 92, hy - 120, hx + 92, hy + 118], fill=(205, 160, 130, 255))
        d.chord([hx - 98, hy - 132, hx + 98, hy + 40], 180, 360, fill=(58, 44, 36, 255))
        for ex in (-34, 34):
            d.ellipse([hx + ex - 9, hy - 8, hx + ex + 9, hy + 6], fill=(40, 32, 28, 255)); d.rectangle([hx + ex - 20, hy - 30, hx + ex + 20, hy - 24], fill=(58, 44, 36, 255))
        mo = 6 + 8 * abs(math.sin(t * 9)) * (0.5 + 0.5 * math.sin(t * 1.1))
        d.ellipse([hx - 24, hy + 52 - mo / 2, hx + 24, hy + 52 + mo / 2], fill=(110, 50, 50, 255))
        d.line([(1100, 0), (930, 330), (800, 420)], fill=(30, 30, 32, 255), width=12); d.rounded_rectangle([760, 400, 830, 470], radius=30, fill=(28, 28, 30, 255))
        gy = 520 + 30 * math.sin(t * 1.6); d.ellipse([sx - 300, gy - 40, sx - 220, gy + 40], fill=(200, 156, 126, 255))
        p.stdin.write(np.asarray(im).tobytes())
    p.stdin.close(); p.wait()


def main():
    if os.path.exists(DEMO): shutil.rmtree(DEMO)
    for sub in ("raw", "transcripts", "music", "final"): os.makedirs(os.path.join(DEMO, sub))
    presenter(os.path.join(DEMO, "raw", "demo-episode.mp4"))
    words, t = [], 0.6
    for i, w in enumerate(LINE.split()):
        words.append({"id": f"w{i}", "text": w, "start": round(t, 2), "end": round(t + 0.32, 2)}); t += 0.4 + (0.25 if w.endswith(".") else 0)
    json.dump(words, open(os.path.join(DEMO, "transcripts", "demo-episode.words.json"), "w"))
    json.dump({"name": "Demo Show", "language": "en", "host": "The Host",
               "brand": {"name": "yourshow.com", "tagline": "THE PODCAST", "end_line": "Full conversation on"}},
              open(os.path.join(DEMO, "project.json"), "w"), indent=2)
    styles = list(all_styles())
    gfx = [["paradox", "THE BIGGEST PARADOX", ""], ["lonelier", "MORE CONNECTED, MORE ALONE", "and it is getting worse"]]
    json.dump([{"id": "s01", "name": "demo", "hook": ["THE BIGGEST PARADOX", "OF OUR TIME"], "btitle": "The biggest *PARADOX* of our *TIME.*",
                "who": "Dr. Sample Guest", "role": "researcher", "segs": [["demo-episode", 0.5, t + 0.2]], "gfx": gfx, "cx": [640], "styles": styles}],
              open(os.path.join(DEMO, "shorts.json"), "w"), indent=1)
    P = Project(DEMO)
    cut.run(P); build.run(P, formats=("9x16",)); music.run(P); render.run(P, formats=("9x16",))
    T = json.load(open(P.p("build", "s01", "timeline.json")))
    g2 = T["gfx"][1]["t"] if len(T["gfx"]) > 1 else 4.0
    for sid, st in all_styles().items():
        f = P.p("build", "s01", sid, "final.mp4")
        if not os.path.exists(f): print("no render for", sid); continue
        at = g2 + 1.1 if (st.get("flags", {}).get("bfull") or sid == "clean-podcast") else T["words"][6]["s"] + 0.2
        out = os.path.join(st["_dir"], st.get("preview", "preview.jpg"))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at:.2f}", "-i", f, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "3", out], check=True)
        print("preview ->", out)


if __name__ == "__main__":
    main()
