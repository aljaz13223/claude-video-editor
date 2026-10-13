"""Background music under speech.
Picks the part of the track that builds towards the end, loops with a crossfade if it is too short, and ducks it
relative to the measured speech level: speech_db under speech, gap_db in pauses, end_db on the end card.
Without "music" in shorts.json a soft synthesized pad is used instead; "music": "none" = speech only (add a trending sound in the app). Writes build/<id>/bed.wav and copies it into every style folder."""
import os, shutil, subprocess, wave
import numpy as np
from .project import ffmpeg

SR = 48000


def dec(path, ch):
    r = subprocess.run([ffmpeg(), "-nostdin", "-v", "error", "-i", path, "-vn", "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"], capture_output=True, check=True)
    a = np.frombuffer(r.stdout, np.float32)
    return a.reshape(-1, ch) if ch > 1 else a


def smooth(x, n):
    c = np.cumsum(np.insert(x, 0, 0)); y = (c[n:] - c[:-n]) / n
    return np.concatenate([np.full(n // 2, y[0]), y, np.full(len(x) - len(y) - n // 2, y[-1])])


def pad(total, seed):
    """Fallback: gentle chord pad + soft arpeggio (royalty free, generated)."""
    N = int(SR * total); t = np.arange(N) / SR
    progs = [[[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]],
             [[196, 246.9, 293.7], [164.8, 196, 246.9], [130.8, 164.8, 196], [146.8, 174.6, 220]]]
    P = progs[seed % 2]; beat = 60 / [88, 94][seed % 2]; bar = beat * 4; m = np.zeros(N)
    for b in range(int(total / bar) + 1):
        s = int(b * bar * SR); e = min(N, int((b + 1) * bar * SR)); tt = t[s:e] - t[s]; ch = P[b % 4]
        env = np.clip(tt / 0.5, 0, 1) * np.clip((bar - tt) / 0.6, 0.3, 1)
        for f in ch: m[s:e] += (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * env * 0.05
        for k in range(8):
            i0 = int((b * bar + k * beat / 2) * SR)
            if i0 >= N: break
            n = min(int(1.2 * SR), N - i0); tn = np.arange(n) / SR; f = ch[[0, 1, 2, 1, 0, 2, 1, 2][k]] * 2
            m[i0:i0 + n] += np.sin(2 * np.pi * f * tn) * np.exp(-tn * 3.2) * 0.05
    return np.stack([m, np.roll(m, 90)], 1)


def bed_for(P, sid, music_file, seed=0):
    import json
    import glob as _g
    D = json.load(open(P.p("build", sid, "timeline.json"), encoding="utf-8"))
    rolls = sorted(_g.glob(P.p("build", sid, "*", "assets", "aroll.mp4")))
    if not rolls: raise SystemExit(f"{sid}: run `cve build` first")
    total, vend = D["total"], D["vend"]; N = int(total * SR); hop = int(0.05 * SR)
    sp = dec(rolls[0], 1); sp = np.pad(sp, (0, max(0, N - len(sp))))[:N]
    fr = len(sp) // hop; rms = np.sqrt(np.mean(sp[:fr * hop].reshape(fr, hop) ** 2, 1) + 1e-12)
    act = rms > max(0.008, 0.18 * np.percentile(rms, 90))
    act = np.convolve(act.astype(float), np.ones(7) / 7, "same") > 0.15
    sp_rms = float(np.median(rms[act])) if act.any() else 0.05
    if music_file == "none":   # speech only — e.g. a trending sound will be added in the Instagram / TikTok app
        m = np.zeros((N, 2))
    elif music_file:
        m = dec(music_file, 2)
        mr = np.sqrt(np.mean(m.mean(1)[: len(m) // hop * hop].reshape(-1, hop) ** 2, 1) + 1e-12); Wn = int(total / 0.05)
        if len(mr) > Wn + 20:   # window whose second half is strongest (builds up), quiet start
            best, off = -1, 0
            for k in range(0, len(mr) - Wn, 10):
                seg = mr[k:k + Wn]; sc = seg[Wn // 2:].mean() - 0.5 * seg[:40].mean()
                if sc > best: best, off = sc, k
            m = m[off * hop: off * hop + N]
        while len(m) < N:
            xf = int(SR); r = np.linspace(1, 0, xf)[:, None]
            m = np.concatenate([m[:-xf], m[-xf:] * r + m[:xf] * (1 - r), m[xf:]])
    else:
        m = pad(total, seed)
    m = m[:N].astype(np.float64); m_rms = float(np.sqrt(np.mean(m ** 2)) + 1e-9)
    if music_file == "none": m_rms = 1.0
    L = P.cfg["music"]; tfr = np.arange(fr) * 0.05
    db = np.where(act, L["speech_db"], L["gap_db"]); db = np.where(tfr >= vend, L["end_db"], db)
    g = np.interp(np.arange(N) / SR, tfr, 10 ** (smooth(db, 6) / 20) * sp_rms / m_rms)
    t = np.arange(N) / SR; g *= np.clip(t / 0.8, 0, 1) * np.clip((total - t) / 1.2, 0, 1)
    out = m * g[:, None]; pk = np.max(np.abs(out))
    if pk > 0.9: out *= 0.9 / pk
    dst = P.p("build", sid, "bed.wav")
    with wave.open(dst, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
    for a in _g.glob(P.p("build", sid, "*", "assets")):
        shutil.copy(dst, os.path.join(a, "bed.wav"))
    return sp_rms


def run(P, ids=()):
    for n, s in enumerate(P.select(ids)):
        mf = "none" if s.get("music") in ("none", False) else (os.path.join(P.p(P.cfg["music_dir"]), s["music"]) if s.get("music") else None)
        if mf and mf != "none" and not os.path.exists(mf): raise SystemExit(f"music not found: {mf}")
        r = bed_for(P, s["id"], mf, n)
        print(s["id"], "music:", s.get("music", "(generated pad)"), f"speech rms {r:.3f}", flush=True)
