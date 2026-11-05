"""Transkripcija z besednimi časovnimi žigi (faster-whisper), privzeto slovenščina.
Uporaba:  py -3.12 transcribe.py <video_ali_audio> [--lang sl] [--model large-v3] [--out MAPA]
Izhod:    <ime>.words.json (HyperFrames format [{id,text,start,end}]), <ime>.srt, <ime>.txt (s časi po segmentih)
"""
import argparse, json, os, sys, subprocess, tempfile
try:  # Windows cert store (antivirus/omrežje prestreže HTTPS)
    import truststore; truststore.inject_into_ssl()
except Exception:
    pass

def add_cuda_paths():
    # pip paketi nvidia-cublas-cu12 / nvidia-cudnn-cu12 -> DLL-ji na PATH (Windows)
    try:
        import importlib.util
        for pkg in ("nvidia.cublas", "nvidia.cudnn"):
            spec = importlib.util.find_spec(pkg)
            if spec and spec.submodule_search_locations:
                for loc in spec.submodule_search_locations:
                    b = os.path.join(loc, "bin")
                    if os.path.isdir(b):
                        os.environ["PATH"] = b + os.pathsep + os.environ["PATH"]
                        if hasattr(os, "add_dll_directory"):
                            os.add_dll_directory(b)
    except Exception:
        pass

def ts(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int((s % 1) * 1000):03}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--lang", default="sl")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--out", default=None)
    ap.add_argument("--cpu", action="store_true")
    ap.add_argument("--batch", type=int, default=0, help="batched inference (npr. 8) — 3-5x hitreje")
    a = ap.parse_args()
    add_cuda_paths()
    from faster_whisper import WhisperModel

    out = a.out or os.path.dirname(os.path.abspath(a.input))
    os.makedirs(out, exist_ok=True)
    base = os.path.join(out, os.path.splitext(os.path.basename(a.input))[0])

    wav = os.path.join(tempfile.gettempdir(), "tx_tmp.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], check=True)

    model = None
    if not a.cpu:
        try:
            model = WhisperModel(a.model, device="cuda", compute_type="float16")
        except Exception as e:
            print("GPU ni na voljo, uporabljam CPU:", e, file=sys.stderr)
    if model is None:
        model = WhisperModel(a.model, device="cpu", compute_type="int8")

    import wave, numpy as np
    with wave.open(wav, "rb") as wf:
        audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    tr = model
    if a.batch:
        from faster_whisper import BatchedInferencePipeline
        tr = BatchedInferencePipeline(model=model)
    kw = {"batch_size": a.batch} if a.batch else {"condition_on_previous_text": False}
    segs, info = tr.transcribe(audio, language=a.lang, word_timestamps=True,
                                  vad_filter=True, vad_parameters={"min_silence_duration_ms": 300}, **kw)
    words, srt, txt, i = [], [], [], 0
    for n, s in enumerate(segs, 1):
        srt += [str(n), f"{ts(s.start)} --> {ts(s.end)}", s.text.strip(), ""]
        txt.append(f"[{s.start:7.2f} - {s.end:7.2f}] {s.text.strip()}")
        for w in (s.words or []):
            words.append({"id": f"w{i}", "text": w.word.strip(), "start": round(w.start, 3),
                          "end": round(w.end, 3), "prob": round(w.probability, 3)})
            i += 1
        print(txt[-1], flush=True)
    json.dump(words, open(base + ".words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(base + ".srt", "w", encoding="utf-8").write("\n".join(srt))
    open(base + ".txt", "w", encoding="utf-8").write("\n".join(txt))
    print(f"\nOK: {len(words)} besed -> {base}.words.json / .srt / .txt  (jezik {info.language})")

if __name__ == "__main__":
    main()
