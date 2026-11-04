#!/usr/bin/env python3
"""Text BEHIND the speaker: big words sit in the background and the person stays in front of them.

  python text_behind.py in.mp4 out.mp4 --text "MOTION" --t0 2.0 --t1 5.5 [--y 0.30] [--size 0.22]
         [--color "#ffffff"] [--font path.ttf] [--model selfie_segmenter.tflite]

Segmentation: MediaPipe Image Segmenter (selfie_segmenter.tflite, ~250 kB). If the model file is missing it is
downloaded once from Google's model storage next to this script.
Audio is copied unchanged. Several words: run several times or pass --text "A|B" with --t0 "2|4" --t1 "4|6".
Rules: one word (max 2), 18–25 % of frame height, top third (above the head), on screen ≥ 1.2 s, never over the mouth.
"""
import argparse, os, shutil, subprocess, sys, urllib.request
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"

def segmenter(path):
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    if not os.path.exists(path):
        print("downloading segmentation model …"); urllib.request.urlretrieve(MODEL_URL, path)
    opt = vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=path),
                                       running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True)
    seg = vision.ImageSegmenter.create_from_options(opt)
    def run(frame_bgr, ts_ms):
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
        r = seg.segment_for_video(img, ts_ms)
        return r.confidence_masks[0].numpy_view().astype(np.float32)   # 1 = person
    return run

def text_layer(W, H, text, size, y, color, font):
    f = ImageFont.truetype(font, int(H * size)) if font else ImageFont.load_default(size=int(H * size))
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    bx = d.textbbox((0, 0), text, font=f); tw, th = bx[2] - bx[0], bx[3] - bx[1]
    s = min(1.0, W * 0.92 / max(tw, 1))
    if s < 1.0:
        f = ImageFont.truetype(font, int(H * size * s)) if font else ImageFont.load_default(size=int(H * size * s))
        bx = d.textbbox((0, 0), text, font=f); tw, th = bx[2] - bx[0], bx[3] - bx[1]
    d.text(((W - tw) / 2 - bx[0], H * y - th / 2 - bx[1]), text, font=f, fill=255)
    rgb = tuple(int(color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    return np.asarray(im, np.float32) / 255.0, np.array(rgb[::-1], np.float32)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("inp"); ap.add_argument("out")
    ap.add_argument("--text", required=True); ap.add_argument("--t0", required=True); ap.add_argument("--t1", required=True)
    ap.add_argument("--y", type=float, default=0.30); ap.add_argument("--size", type=float, default=0.22)
    ap.add_argument("--color", default="#ffffff"); ap.add_argument("--font", default=None)
    ap.add_argument("--model", default=os.path.join(HERE, "selfie_segmenter.tflite"))
    a = ap.parse_args()
    if not a.font:
        for c in [r"C:\Windows\Fonts\arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
            if os.path.exists(c): a.font = c; break
    texts = a.text.split("|"); t0s = [float(x) for x in a.t0.split("|")]; t1s = [float(x) for x in a.t1.split("|")]
    cap = cv2.VideoCapture(a.inp); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    layers = [text_layer(W, H, t, a.size, a.y, a.color, a.font) for t in texts]
    seg = segmenter(a.model); ff = shutil.which("ffmpeg") or "ffmpeg"
    tmp = a.out + ".video.mp4"
    p = subprocess.Popen([ff, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                          "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", tmp], stdin=subprocess.PIPE)
    prev = None; n = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        t = n / fps; n += 1
        act = [k for k in range(len(texts)) if t0s[k] - 0.3 <= t <= t1s[k] + 0.3]
        if act:
            m = seg(fr, int(t * 1000)); m = cv2.resize(m, (W, H))
            m = m if prev is None else 0.6 * m + 0.4 * prev; prev = m           # temporal smoothing
            m = cv2.GaussianBlur(m, (0, 0), 2.0)
            out = fr.astype(np.float32)
            for k in act:
                alpha_t = np.clip(min((t - t0s[k]) / 0.25, (t1s[k] - t) / 0.25), 0, 1)
                al, col = layers[k]
                al = al * alpha_t * (1 - m)                                         # behind the person
                out = out * (1 - al[..., None]) + col * al[..., None]
            fr = np.clip(out, 0, 255).astype(np.uint8)
        else:
            prev = None
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait(); cap.release()
    subprocess.run([ff, "-v", "error", "-y", "-i", tmp, "-i", a.inp, "-map", "0:v", "-map", "1:a?", "-c", "copy", "-shortest", a.out], check=True)
    os.remove(tmp); print("->", a.out)

if __name__ == "__main__":
    main()
