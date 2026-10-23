"""Takeframe speech enhancement (local, free) - aims at Adobe Podcast "Enhance" quality.

Chain: DeepFilterNet3 (noise + room removal, GPU if available)
       -> high-pass, de-mud, presence and air EQ, de-esser, gentle compression
       -> two-pass loudness normalisation (-16 LUFS speech, -1.5 dBTP)
       -> wet/dry mix by --strength (0..1) so the voice never sounds artificial.
Usage: python enhance.py in.(wav|mp4|...) out.wav [--strength 0.85] [--lufs -16] [--report]
Falls back to ffmpeg-only denoise (afftdn) when DeepFilterNet is not installed.
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf

FF = os.environ.get('FFMPEG', 'ffmpeg')

def run(args):
    p = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if p.returncode: raise RuntimeError(p.stderr[-2000:])
    return p.stderr

def to_wav(src, dst, sr=48000):
    run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', str(sr), '-c:a', 'pcm_f32le', dst])

def deepfilter_bin():
    cands = [os.environ.get('TAKEFRAME_DEEPFILTER', ''),
             os.path.join(os.path.expanduser('~'), '.takeframe', 'bin', 'deep-filter.exe' if os.name == 'nt' else 'deep-filter')]
    for c in cands:
        if c and os.path.exists(c): return c
    return None

def deepfilter_cli(exe, raw, td, atten_db, strong):
    w16 = os.path.join(td, 'in16.wav')
    run([FF, '-y', '-loglevel', 'error', '-i', raw, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', w16])
    od = os.path.join(td, 'df'); os.makedirs(od, exist_ok=True)
    args = [exe, '-D', '-a', str(int(atten_db)), '-o', od] + (['--pf'] if strong else []) + [w16]
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode: raise RuntimeError(p.stderr[-800:])
    y, _ = sf.read(os.path.join(od, 'in16.wav'), dtype='float32')
    return y

def deepfilter(x, sr, atten_db):
    from df.enhance import enhance, init_df
    import torch
    model, state, _ = init_df(log_level='ERROR')
    if sr != state.sr(): raise RuntimeError('sample rate mismatch')
    t = torch.from_numpy(x.astype(np.float32))[None]
    out = enhance(model, state, t, atten_lim_db=atten_db)
    return out[0].cpu().numpy()

def measure(path):
    e = run([FF, '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); P = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)
    return float(I[-1]) if I else None, float(P[-1]) if P else None

def noise_floor(x, sr):
    f = int(.05 * sr); n = len(x) // f
    if n < 4: return None
    r = 20 * np.log10(np.sqrt(np.mean(x[:n * f].reshape(n, f) ** 2, 1)) + 1e-9)
    r = r[r > -110]
    if len(r) < 4: return None
    return float(np.percentile(r, 10)), float(np.percentile(r, 95))

EQ = ('highpass=f=75:p=2,'
      'equalizer=f=220:t=q:w=1.1:g=-2.5,'      # mud
      'equalizer=f=3200:t=q:w=1.2:g=2.5,'      # presence / intelligibility
      'highshelf=f=9500:g=1.5,lowpass=f=17500,' # air without hiss
      'deesser=i=0.35:m=0.5:f=0.5,'
      'acompressor=threshold=-24dB:ratio=2.5:attack=8:release=120:knee=6:makeup=2,'
      'agate=mode=downward:range=0.12:threshold=0.004:ratio=2:attack=4:release=220:knee=3')  # keep pauses clean

def loudnorm(src, dst, lufs):
    e = run([FF, '-hide_banner', '-i', src, '-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'])
    m = json.loads(e[e.rindex('{'):e.rindex('}') + 1])
    af = (f"loudnorm=I={lufs}:TP=-1.5:LRA=7:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', af, '-ar', '48000', '-c:a', 'pcm_s24le', dst])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--strength', type=float, default=.85)
    ap.add_argument('--lufs', type=float, default=-16)
    ap.add_argument('--report', action='store_true')
    a = ap.parse_args()
    s = float(np.clip(a.strength, 0, 1))
    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, 'raw.wav'); to_wav(a.src, raw)
        x, sr = sf.read(raw, dtype='float32')
        engine = 'deepfilternet3'
        try:
            exe = deepfilter_bin()
            if exe:
                engine = 'deepfilternet3 (deep-filter)'
                y = deepfilter_cli(exe, raw, td, 12 + 88 * s, s >= .7)
            else:
                y = deepfilter(x, sr, atten_db=12 + 88 * s)  # strength 1 -> unlimited suppression
        except Exception as ex:
            engine = f'ffmpeg-afftdn (DeepFilterNet ni na voljo: {type(ex).__name__})'
            dn = os.path.join(td, 'dn.wav')
            run([FF, '-y', '-loglevel', 'error', '-i', raw, '-af', f'afftdn=nr={6 + 18 * s}:nf=-42:tn=1,agate=threshold=0.01:ratio=1.5', '-c:a', 'pcm_f32le', dn])
            y, _ = sf.read(dn, dtype='float32')
        n = min(len(x), len(y)); y = y[:n]; x = x[:n]
        # strength is applied through DeepFilterNet's attenuation limit; with the ffmpeg fallback blend a little dry signal back
        mixd = y if engine.startswith('deepfilternet') else y * s + x * (1 - s)
        m1 = os.path.join(td, 'm1.wav'); sf.write(m1, mixd, sr, subtype='FLOAT')
        eq = os.path.join(td, 'eq.wav')
        run([FF, '-y', '-loglevel', 'error', '-i', m1, '-af', EQ, '-c:a', 'pcm_f32le', eq])
        loudnorm(eq, a.dst, a.lufs)
        if a.report:
            o, _ = sf.read(a.dst, dtype='float32')
            nf0 = noise_floor(x, sr); nf1 = noise_floor(o if o.ndim == 1 else o.mean(1), 48000)
            print(json.dumps({'engine': engine, 'strength': s,
                              'before': {'lufs_peak': measure(raw), 'noise_floor_db': nf0[0] if nf0 else None, 'speech_db': nf0[1] if nf0 else None},
                              'after': {'lufs_peak': measure(a.dst), 'noise_floor_db': nf1[0] if nf1 else None, 'speech_db': nf1[1] if nf1 else None}},
                             ensure_ascii=False))
        else:
            print(json.dumps({'engine': engine, 'out': a.dst}))

if __name__ == '__main__':
    main()
