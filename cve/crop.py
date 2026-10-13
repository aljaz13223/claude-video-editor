"""Auto-reframe (like Premiere's Auto Reframe): detect shot cuts, track the speaker's face per shot with a
dead-zone + smoothing camera, write a 576x720 (4:5) crop seg/<id>_<i>_c.mp4 with the original audio.
cx in shorts.json (0..1280) tells which person to follow when several faces are visible."""
import os, subprocess, urllib.request
import numpy as np
from .project import ffmpeg, ROOT

MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
W, CW, DZ, GAIN = 1280, 576, 36, 0.07


def model_path():
    p = os.path.join(ROOT, "models", "yunet.onnx")
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        try:
            import truststore; truststore.inject_into_ssl()
        except Exception:
            pass
        print("downloading face model ->", p)
        urllib.request.urlretrieve(MODEL_URL, p)
    return p


def clampc(c): return float(min(max(c, CW / 2), W - CW / 2))


def medf(a, k):
    a = np.array(a, float)
    if len(a) < 3: return a
    h = k // 2; return np.array([np.median(a[max(0, i - h):i + h + 1]) for i in range(len(a))])


def mavg(a, k):
    if len(a) < k: return a
    p = np.pad(a, (k // 2, k // 2), mode="edge"); return np.convolve(p, np.ones(k) / k, mode="valid")


def run(P, ids=()):
    import cv2
    det = cv2.FaceDetectorYN.create(model_path(), "", (640, 360), 0.75, 0.3, 50)
    ff = ffmpeg()
    for s in P.select(ids):
        tiles = []
        for i in range(len(s["segs"])):
            src = P.p("seg", f"{s['id']}_{i}.mp4"); cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 30
            frames, G, F = [], [], {}
            while True:
                ok, f = cap.read()
                if not ok: break
                n = len(frames); frames.append(f)
                G.append(cv2.cvtColor(cv2.resize(f, (160, 90)), cv2.COLOR_BGR2GRAY).astype(np.float32))
                if n % 3 == 0:
                    _, R = det.detect(cv2.resize(f, (640, 360)))
                    F[n] = [] if R is None else [(float((r[0] + r[2] / 2) * 2), float(r[2] * 2)) for r in R if r[2] * 2 > 70]
            n = len(frames)
            d = np.array([0] + [float(np.mean(np.abs(G[k] - G[k - 1]))) for k in range(1, n)])
            cuts = [0]
            for k in range(1, n):
                if d[k] > max(14, 5 * np.median(d[max(1, k - 15):k + 15])) and k - cuts[-1] >= 8: cuts.append(k)
            cuts.append(n)
            X = np.zeros(n); ref = float(s["cx"][i]); log = []
            for a, b in zip(cuts[:-1], cuts[1:]):
                ks = sorted(k for k in F if a <= k < b and F[k])
                if not ks:
                    X[a:b] = clampc(ref); log.append(f"{a / fps:.1f}-{b / fps:.1f} no face"); continue
                cur = min(F[ks[0]], key=lambda q: abs(q[0] - ref))[0]; pk, pv = [], []
                for k in ks:
                    q = min(F[k], key=lambda q: abs(q[0] - cur))
                    if abs(q[0] - cur) < 220: cur = q[0]; pk.append(k); pv.append(q[0])
                pv = medf(pv, 7); tgt = np.interp(np.arange(a, b), pk, pv)
                c = float(np.median(tgt[:int(fps)])); cam = []
                for t in tgt:
                    e = t - c
                    if abs(e) > DZ: c += (e - np.sign(e) * DZ) * GAIN
                    cam.append(c)
                X[a:b] = [clampc(v) for v in mavg(np.array(cam), 11)]; ref = float(np.median(pv))
                log.append(f"{a / fps:.1f}-{b / fps:.1f} cx {X[a]:.0f}..{X[b - 1]:.0f}")
            out = P.p("seg", f"{s['id']}_{i}_c.mp4")
            p = subprocess.Popen([ff, "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{CW}x720", "-r", str(fps), "-i", "-",
                                  "-i", src, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-g", "30",
                                  "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", out], stdin=subprocess.PIPE)
            for k, f in enumerate(frames):
                x0 = int(round(X[k] - CW / 2)); p.stdin.write(np.ascontiguousarray(f[:, x0:x0 + CW]).tobytes())
                if k % int(fps * 1.5) == 0:
                    t = cv2.resize(f[:, x0:x0 + CW], (144, 180)); cv2.line(t, (72, 0), (72, 180), (0, 255, 0), 1); tiles.append(t)
            p.stdin.close(); p.wait()
            print(s["id"], i, "| " + " ; ".join(log), flush=True)
        if tiles:
            R = 12; rows = []
            for r in range(0, len(tiles), R):
                row = tiles[r:r + R]; row += [np.zeros_like(tiles[0])] * (R - len(row)); rows.append(np.hstack(row))
            cv2.imwrite(P.p("qa", f"track_{s['id']}.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 82])
