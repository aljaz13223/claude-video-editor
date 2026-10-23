"""Takeframe stem separation with Demucs: speech/vocals vs. everything else.
Usage: python stems.py media outdir  -> outdir/vocals.wav, outdir/no_vocals.wav
"""
import json, os, subprocess, sys, shutil, tempfile

def main():
    src, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, 'in.wav')
        subprocess.run([os.environ.get('FFMPEG', 'ffmpeg'), '-y', '-loglevel', 'error', '-i', src, '-vn', '-ac', '2', '-ar', '44100', wav], check=True)
        subprocess.run([sys.executable, '-m', 'demucs', '--two-stems', 'vocals', '-n', 'htdemucs', '-o', td, wav], check=True)
        d = os.path.join(td, 'htdemucs', 'in')
        for f in ('vocals.wav', 'no_vocals.wav'):
            shutil.move(os.path.join(d, f), os.path.join(outdir, f))
    print(json.dumps({'vocals': os.path.join(outdir, 'vocals.wav'), 'music': os.path.join(outdir, 'no_vocals.wav')}))

if __name__ == '__main__':
    main()
