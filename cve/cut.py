"""Cut each segment from the source episode, snapped to word boundaries, normalised to 1280x720 / 30 fps / -16 LUFS."""
import json, os, subprocess
from .project import ffmpeg


def snap(words, a, b):
    ws = [w for w in words if a - 0.05 <= w["start"] < b - 0.1]
    if not ws:
        raise SystemExit(f"No words between {a} and {b}")
    return max(0, ws[0]["start"] - 0.10), ws[-1]["end"] + 0.14


def run(P, ids=(), force=False):
    os.makedirs(P.p("seg"), exist_ok=True); os.makedirs(P.p("qa"), exist_ok=True)
    ff = ffmpeg()
    for s in P.select(ids):
        s.setdefault("meta", {})
        for i, g in enumerate(s["segs"]):
            key, a, b = g[0], g[1], g[2]
            W = json.load(open(P.words_file(key), encoding="utf-8"))
            A, B = snap(W, a, b)
            src = P.raw_file(key); out = P.p("seg", f"{s['id']}_{i}.mp4")
            if force or not (os.path.exists(out) and os.path.getsize(out) > 100000):
                subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-ss", f"{A:.3f}", "-i", src, "-t", f"{B - A:.3f}",
                                "-vf", "fps=30,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
                                "-af", f"loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.03,afade=t=out:st={B - A - 0.06:.3f}:d=0.06",
                                "-ar", "48000", "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-g", "30", "-c:a", "aac", "-b:a", "192k", out], check=True)
            s["meta"][str(i)] = {"A": round(A, 3), "B": round(B, 3), "src": os.path.basename(src)}
            s.setdefault("cx", [640] * len(s["segs"]))
            while len(s["cx"]) < len(s["segs"]):
                s["cx"].append(640)
            subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-ss", f"{(B - A) / 2:.2f}", "-i", out, "-frames:v", "1",
                            "-vf", "drawgrid=w=128:h=720:t=2:c=yellow@0.8,scale=640:-1", P.p("qa", f"{s['id']}_{i}.jpg")], check=True)
            print(s["id"], i, s["meta"][str(i)], flush=True)
    P.save_shorts()
