"""Render compositions with HyperFrames (headless Chrome -> mp4), normalise loudness to -14 LUFS, copy to final/."""
import os, shutil, subprocess, sys
from .project import ffmpeg

ROOTS = {"A": ("build", ""), "B": ("build_b", "_B"), "A45": ("build_45a", "_4x5"), "B45": ("build_45b", "_B_4x5")}


def render_dir(P, d, log):
    cmd = f'npx --yes {P.cfg["hyperframes"]} render -o "{os.path.join(d, "render.mp4")}"'
    for attempt in (1, 2):   # a render can be cancelled if its parent shell exits; retry once
        with open(log, "w", encoding="utf-8") as lf:
            subprocess.run(cmd, cwd=d, shell=True, stdout=lf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        if os.path.exists(os.path.join(d, "render.mp4")): return True
        print("  retry", d, file=sys.stderr)
    return False


def run(P, ids=(), variants=("A", "B", "A45", "B45")):
    ff = ffmpeg(); os.makedirs(P.p("logs"), exist_ok=True)
    out = P.p(P.cfg["final_dir"]); os.makedirs(out + "/_preview", exist_ok=True)
    for n, s in enumerate(P.shorts, 1):
        if ids and s["id"] not in ids: continue
        for v in variants:
            root, suf = ROOTS[v]; d = P.p(root, s["id"])
            if not os.path.exists(d + "/index.html"): continue
            for f in ("render.mp4", "final.mp4"):
                if os.path.exists(os.path.join(d, f)): os.remove(os.path.join(d, f))
            ok = render_dir(P, d, P.p("logs", f"render_{root}_{s['id']}.log"))
            if not ok:
                print(s["id"], v, "RENDER FAILED — see logs/", flush=True); continue
            subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-i", d + "/render.mp4", "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.0:LRA=11",
                            "-ar", "48000", "-c:a", "aac", "-b:a", "256k", d + "/final.mp4"], check=True)
            name = f"{n:02d}_{s['name']}{suf}.mp4"
            shutil.copyfile(d + "/final.mp4", os.path.join(out, name))
            subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-i", d + "/final.mp4", "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "25",
                            "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k", os.path.join(out, "_preview", name)], check=True)
            print(s["id"], v, "->", name, flush=True)
