"""Word-level transcription with faster-whisper -> <name>.words.json ([{id,text,start,end,prob}]), .srt, .txt"""
import json, os, sys, subprocess, tempfile, wave
import numpy as np
try:  # use the OS certificate store (corporate proxies / antivirus HTTPS inspection)
    import truststore; truststore.inject_into_ssl()
except Exception:
    pass


def add_cuda_paths():
    """Windows: put pip-installed nvidia-cublas/cudnn DLLs on PATH."""
    try:
        import importlib.util
        for pkg in ("nvidia.cublas", "nvidia.cudnn"):
            spec = importlib.util.find_spec(pkg)
            for loc in (spec.submodule_search_locations if spec else []) or []:
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


def load_model(name="large-v3", cpu=False):
    add_cuda_paths()
    from faster_whisper import WhisperModel
    if not cpu:
        try:
            return WhisperModel(name, device="cuda", compute_type="float16")
        except Exception as e:
            print("GPU not available, using CPU:", e, file=sys.stderr)
    return WhisperModel(name, device="cpu", compute_type="int8")


def read_audio(path):
    wav = os.path.join(tempfile.gettempdir(), "cve_tx.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], check=True)
    with wave.open(wav, "rb") as wf:
        return np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def transcribe(inp, out_dir, lang="en", model="large-v3", cpu=False, batch=0):
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, os.path.splitext(os.path.basename(inp))[0])
    m = load_model(model, cpu)
    tr = m
    if batch:
        from faster_whisper import BatchedInferencePipeline
        tr = BatchedInferencePipeline(model=m)
    kw = {"batch_size": batch} if batch else {"condition_on_previous_text": False}
    segs, info = tr.transcribe(read_audio(inp), language=lang, word_timestamps=True, vad_filter=True,
                               vad_parameters={"min_silence_duration_ms": 300}, **kw)
    words, srt, txt, i = [], [], [], 0
    for n, s in enumerate(segs, 1):
        srt += [str(n), f"{ts(s.start)} --> {ts(s.end)}", s.text.strip(), ""]
        txt.append(f"[{s.start:7.2f} - {s.end:7.2f}] {s.text.strip()}")
        for w in (s.words or []):
            words.append({"id": f"w{i}", "text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})
            i += 1
        print(txt[-1], flush=True)
    json.dump(words, open(base + ".words.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(base + ".srt", "w", encoding="utf-8").write("\n".join(srt))
    open(base + ".txt", "w", encoding="utf-8").write("\n".join(txt))
    print(f"OK: {len(words)} words -> {base}.words.json (language {info.language})")
    return base + ".words.json"


def check_clips(folder, out_txt, lang="en", model="large-v3"):
    """Re-transcribe every cut clip so captions can be verified against what was really said."""
    import glob
    m = load_model(model)
    with open(out_txt, "w", encoding="utf-8") as out:
        for f in sorted(glob.glob(os.path.join(folder, "*.mp4"))):
            if f.endswith("_c.mp4"):
                continue
            s, _ = m.transcribe(read_audio(f), language=lang, word_timestamps=True)
            ws = [x for seg in s for x in seg.words]
            out.write(os.path.basename(f) + " | " + " ".join(f"{x.word.strip()}@{x.start:.2f}-{x.end:.2f}" for x in ws) + "\n")
            out.flush()
    print("asr ->", out_txt)
