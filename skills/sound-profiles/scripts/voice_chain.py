#!/usr/bin/env python3
"""Radio-style voice chain (the six things broadcast mics run through), as one ffmpeg filter.

  python voice_chain.py in.wav out.wav [--preset clean|radio|podcast] [--lufs -16]

1. high-pass ~90 Hz        – rumble, desk knocks, AC hum below the voice
2. downward expander       – gaps between words (fan, keyboard, breaths) get quieter
3. de-esser                – tames sharp S sounds
4. presence EQ +3.5 kHz    – clarity of words (+ a small cut of boxiness at ~300 Hz)
5. compressor              – smaller gap between quiet and loud words (steady level)
6. limiter                 – nothing clips
Then loudness to the target (default -16 LUFS for the speech stem; the final mix is normalised to -14 later).
Run it AFTER noise removal / Enhance Speech, never instead of it.
"""
import argparse, shutil, subprocess

PRESETS = {
    "clean":   dict(hp=80,  gate="agate=threshold=0.012:ratio=1.6:attack=8:release=180:range=0.4", ds="deesser=i=0.35",
                    eq="equalizer=f=300:t=q:w=1.2:g=-1.5,equalizer=f=3500:t=q:w=1.0:g=2",
                    comp="acompressor=threshold=0.125:ratio=2.5:attack=8:release=120:makeup=1.6"),
    "radio":   dict(hp=100, gate="agate=threshold=0.015:ratio=2.5:attack=5:release=150:range=0.25", ds="deesser=i=0.5",
                    eq="equalizer=f=300:t=q:w=1.2:g=-2.5,equalizer=f=3500:t=q:w=1.0:g=3.5,equalizer=f=120:t=q:w=1.0:g=1.5",
                    comp="acompressor=threshold=0.09:ratio=4:attack=5:release=90:makeup=2.2"),
    "podcast": dict(hp=90,  gate="agate=threshold=0.013:ratio=2:attack=6:release=160:range=0.3", ds="deesser=i=0.45",
                    eq="equalizer=f=300:t=q:w=1.2:g=-2,equalizer=f=3500:t=q:w=1.0:g=2.5",
                    comp="acompressor=threshold=0.1:ratio=3:attack=6:release=100:makeup=2"),
}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("inp"); ap.add_argument("out")
    ap.add_argument("--preset", default="podcast", choices=PRESETS); ap.add_argument("--lufs", type=float, default=-16)
    a = ap.parse_args(); p = PRESETS[a.preset]
    chain = ",".join([f"highpass=f={p['hp']}:poles=2", p["gate"], p["ds"], p["eq"], p["comp"],
                      "alimiter=limit=0.89:attack=3:release=50:level=false", f"loudnorm=I={a.lufs}:TP=-1.5:LRA=7"])
    ff = shutil.which("ffmpeg") or "ffmpeg"
    subprocess.run([ff, "-v", "error", "-y", "-i", a.inp, "-af", chain, "-ar", "48000", a.out], check=True)
    print("->", a.out, f"({a.preset})")

if __name__ == "__main__":
    main()
