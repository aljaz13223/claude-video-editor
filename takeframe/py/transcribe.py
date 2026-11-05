"""Takeframe transcription with faster-whisper (local).
Usage: python transcribe.py media out.json [--model large-v3] [--lang sl]
Output: {"language", "segments":[{"start","end","text","words":[{"w","s","e"}]}]}
"""
import argparse, json, os, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--model', default=os.environ.get('TAKEFRAME_WHISPER', 'large-v3'))
    ap.add_argument('--lang', default=None)
    a = ap.parse_args()
    # CUDA libraries (cuBLAS/cuDNN) ship inside the PyTorch wheel; let CTranslate2 find them on Windows
    try:
        import importlib.util
        spec = importlib.util.find_spec('torch')
        if spec and spec.origin:
            lib = os.path.join(os.path.dirname(spec.origin), 'lib')
            if os.path.isdir(lib):
                os.environ['PATH'] = lib + os.pathsep + os.environ.get('PATH', '')
                if hasattr(os, 'add_dll_directory'): os.add_dll_directory(lib)
    except Exception:
        pass
    from faster_whisper import WhisperModel
    # decode with ffmpeg ourselves (newer PyAV releases break faster-whisper's own decoder)
    import subprocess, numpy as np
    raw = subprocess.run([os.environ.get('FFMPEG', 'ffmpeg'), '-v', 'error', '-i', a.src, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, dtype=np.float32)
    def run(device):
        if device == 'cuda': m = WhisperModel(a.model, device='cuda', compute_type='float16')
        else: m = WhisperModel(a.model if a.model != 'large-v3' else 'medium', device='cpu', compute_type='int8')
        segs, info = m.transcribe(audio, language=a.lang, word_timestamps=True, vad_filter=True)
        return list(segs), info
    try: segs, info = run('cuda')
    except Exception as ex:
        print('GPU transcription failed, using CPU:', ex, file=sys.stderr)
        segs, info = run('cpu')
    out = {'language': info.language, 'segments': []}
    for s in segs:
        out['segments'].append({'start': round(s.start, 3), 'end': round(s.end, 3), 'text': s.text.strip(),
                                'words': [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)} for w in (s.words or [])]})
    json.dump(out, open(a.dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({'language': info.language, 'segments': len(out['segments'])}))

if __name__ == '__main__':
    main()
