#!/usr/bin/env python3
"""Measure how much of a video is visually still.

  python motion_check.py video.mp4 [--from 3 --to 9] [--thresh 1.2]

Samples the video at 10 fps, 160 px wide, grey, and computes the mean absolute difference between frames.
Prints: still seconds (diff < thresh), share of the video, longest still stretch, and cuts closer than 0.3 s.
"""
import argparse, subprocess, shutil, sys
import numpy as np

def frames(path, fps, w, t0, t1):
    ff = shutil.which("ffmpeg") or "ffmpeg"
    cmd = [ff, "-loglevel", "error"] + (["-ss", str(t0)] if t0 else []) + ["-i", path] + (["-t", str(t1 - t0)] if t1 else []) + \
          ["-vf", f"fps={fps},scale={w}:-2,format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    probe = subprocess.run([ff, "-loglevel", "error", "-i", path, "-vframes", "1", "-vf", f"scale={w}:-2,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    h = len(probe) // w
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)

def main():
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
    ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--from", dest="t0", type=float, default=0)
    ap.add_argument("--to", dest="t1", type=float, default=0); ap.add_argument("--thresh", type=float, default=1.2)
    a = ap.parse_args(); fps = 10
    f = frames(a.video, fps, 160, a.t0, a.t1)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    still = d < a.thresh
    run = best = 0; best_at = 0
    for i, s in enumerate(still):
        run = run + 1 if s else 0
        if run > best: best, best_at = run, i - run + 1
    cuts = np.where(d > 25)[0] / fps + a.t0
    flashes = [round(float(c), 2) for c, n in zip(cuts, cuts[1:]) if n - c < 0.3]
    dur = len(d) / fps
    print(f"duration {dur:.1f}s | still {still.sum()/fps:.1f}s ({100*still.mean():.0f} %) | longest still {best/fps:.1f}s at {a.t0 + best_at/fps:.1f}s")
    print(f"cuts {len(cuts)} | flashes (<0.3 s between cuts): {flashes or 'none'}")

if __name__ == "__main__":
    main()
