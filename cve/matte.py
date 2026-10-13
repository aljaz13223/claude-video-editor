"""Person matte for "text behind the speaker" styles.

Segments the speaker in assets/aroll.mp4 (MediaPipe selfie segmenter), writes
  assets/person.webm  - the same video with alpha (only the person visible), VP9 yuva420p
  assets/track.json   - head position at 10 fps (x, y of the top of the person, in video pixels)
so a template can put words between the background and the person, and let text follow the head.
"""
import json
import os
import subprocess
import urllib.request

import numpy as np

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def model_path():
    p = os.path.join(ROOT, "models", "selfie_segmenter.tflite")
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        print("downloading", MODEL_URL, flush=True)
        urllib.request.urlretrieve(MODEL_URL, p)
    return p


def make(assets_dir, fps_track=10):
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    src = os.path.join(assets_dir, "aroll.mp4")
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
        base_options=BaseOptions(model_asset_path=model_path()),
        running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
                            "-r", f"{fps}", "-i", "-", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
                            "-b:v", "6M", "-deadline", "realtime", "-cpu-used", "5", "-row-mt", "1",
                            os.path.join(assets_dir, "person.webm")], stdin=subprocess.PIPE)
    prev, track, n, step = None, [], 0, max(1, round(fps / fps_track))
    while True:
        ok, fr = cap.read()
        if not ok: break
        rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
        small = cv2.resize(rgb, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
        res = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(small)), int(n * 1000 / fps))
        m = res.confidence_masks[0].numpy_view().astype(np.float32)
        m = cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR)
        prev = m if prev is None else 0.55 * m + 0.45 * prev           # temporal smoothing, no flicker
        a = np.clip((prev - 0.35) / 0.3, 0, 1)                          # soft edge
        a = cv2.GaussianBlur(a, (0, 0), 1.6)
        if n % step == 0:
            cols = np.where(a.max(0) > 0.5)[0]; rows = np.where(a.max(1) > 0.5)[0]
            if len(cols) and len(rows):
                top = int(rows[0]); band = a[top:top + max(8, H // 6)]
                xs = np.where(band.max(0) > 0.5)[0]
                track.append([round(n / fps, 2), int(xs.mean()) if len(xs) else int(cols.mean()), top])
            else:
                track.append([round(n / fps, 2), None, None])
        enc.stdin.write(np.dstack([rgb, (a * 255).astype(np.uint8)]).tobytes())
        n += 1
    enc.stdin.close(); enc.wait(); cap.release()
    # fill gaps and smooth the head track (dead-zone feel: text follows calmly)
    last = next(([x, y] for _, x, y in track if x is not None), [W // 2, H // 3])
    for t in track:
        if t[1] is None: t[1], t[2] = last
        last = [t[1], t[2]]
    xs = np.array([t[1] for t in track], float); ys = np.array([t[2] for t in track], float)
    k = np.ones(5) / 5
    if len(xs) > 5:
        xs = np.convolve(np.pad(xs, 2, mode="edge"), k, "valid"); ys = np.convolve(np.pad(ys, 2, mode="edge"), k, "valid")
    out = {"w": W, "h": H, "pts": [[t[0], int(x), int(y)] for t, x, y in zip(track, xs, ys)]}
    json.dump(out, open(os.path.join(assets_dir, "track.json"), "w"))
    print("  matte:", n, "frames", flush=True)
    return out
