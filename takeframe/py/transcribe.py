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
    from faster_whisper import WhisperModel
    try:
        m = WhisperModel(a.model, device='cuda', compute_type='float16')
    except Exception:
        m = WhisperModel(a.model if a.model != 'large-v3' else 'small', device='cpu', compute_type='int8')
    segs, info = m.transcribe(a.src, language=a.lang, word_timestamps=True, vad_filter=True)
    out = {'language': info.language, 'segments': []}
    for s in segs:
        out['segments'].append({'start': round(s.start, 3), 'end': round(s.end, 3), 'text': s.text.strip(),
                                'words': [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)} for w in (s.words or [])]})
    json.dump(out, open(a.dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({'language': info.language, 'segments': len(out['segments'])}))

if __name__ == '__main__':
    main()
