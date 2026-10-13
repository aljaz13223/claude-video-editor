"""Render compositions with HyperFrames (headless Chrome -> mp4), normalise loudness to -14 LUFS, copy to final/."""
import glob, os, shutil, subprocess, sys
from .project import ffmpeg



def render_dir(P, d, log):
    cmd = f'npx --yes {P.cfg["hyperframes"]} render -o "{os.path.join(d, "render.mp4")}"'
    for attempt in (1, 2):   # a render can be cancelled if its parent shell exits; retry once
        with open(log, "w", encoding="utf-8") as lf:
            subprocess.run(cmd, cwd=d, shell=True, stdout=lf, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        if os.path.exists(os.path.join(d, "render.mp4")): return True
        print("  retry", d, file=sys.stderr)
    return False


def run(P, ids=(), styles=(), formats=("9x16", "4x5")):
    ff = ffmpeg(); os.makedirs(P.p("logs"), exist_ok=True)
    out = P.p(P.cfg["final_dir"]); os.makedirs(out + "/_preview", exist_ok=True)
    for n, s in enumerate(P.shorts, 1):
        if ids and s["id"] not in ids: continue
        for d in sorted(glob.glob(P.p("build", s["id"], "*", "index.html"))):
            d = os.path.dirname(d); var = os.path.basename(d); st, _, fmt = var.partition("@"); fmt = fmt or "9x16"
            if (styles and st not in styles) or fmt not in formats: continue
            for f in ("render.mp4", "final.mp4"):
                if os.path.exists(os.path.join(d, f)): os.remove(os.path.join(d, f))
            if not render_dir(P, d, P.p("logs", f"render_{s['id']}_{var}.log")):
                print(s["id"], var, "RENDER FAILED — see logs/", flush=True); continue
            subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-i", d + "/render.mp4", "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.0:LRA=11",
                            "-ar", "48000", "-c:a", "aac", "-b:a", "256k", d + "/final.mp4"], check=True)
            name = f"{n:02d}_{s['name']}_{st}_{fmt}.mp4"
            shutil.copyfile(d + "/final.mp4", os.path.join(out, name))
            subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-i", d + "/final.mp4", "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "25",
                            "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k", os.path.join(out, "_preview", name)], check=True)
            print(s["id"], var, "->", name, flush=True)
