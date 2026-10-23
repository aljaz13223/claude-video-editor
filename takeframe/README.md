# Takeframe

Desktop video editor where Claude makes the edit with our skills and you fine-tune it on a real timeline.

## Start

1. `INSTALL.bat` — once. Installs Electron, the local audio engine (Python venv in `%USERPROFILE%\.takeframe`: PyTorch CUDA, Demucs, faster-whisper) and DeepFilterNet3.
2. `SET-API-KEY.bat` — once. Stores `ANTHROPIC_API_KEY` as a Windows user variable (never in code or chat). Swap the key any time by running it again.
3. `START-TAKEFRAME.bat`.

Model: `claude-opus-5-5` by default; set `TAKEFRAME_MODEL` to change it.

## What it does

- **Start screen**: new project (name, client from `BRAND.md` folders, 9:16 / 16:9 / 1:1 / 4:5, length, fps), drop files or connect a folder, tick the files to use, write what Claude should make.
- **Claude** edits with the same commands you use (every step is one undo). It reads `00-SISTEM/PRAVILA-SPLOSNA.md`, the client's `BRAND.md`, the style library and `GLASBA-DNEVNIK.md`, generates new music, places SFX on the peak, then renders real frames and fixes what it sees.
- **Fix only this part**: select clips (or set In/Out) and type in the ✦ box — Claude may only change that selection.
- **Timeline**: V/A tracks with hide, mute, solo, lock; razor, ripple, snapping (playhead, edges, markers, music bars), transitions, keyframes, markers, In/Out.
- **Workspaces**: Edit, Motion (text and animation), Sound (music generator, SFX, speech tools), Color (looks, effects).
- **Sound**: Enhance speech (DeepFilterNet3 + EQ, de-ess, compression, −16 LUFS; strength slider), Split voice/music (Demucs), Transcribe (Whisper, word timestamps), new music in 11 styles that never repeats.
- **Export** (one click, all at once): MP4 1080×1920, 720×1280, 4K vertical, 1080p, 720p, 4K UHD, 1:1, 4:5 (other aspect ratios are reframed on a blurred fill); full mix MP3/WAV; music only; speech only; SFX only; transcript TXT; captions SRT/VTT; thumbnail. Goes to the client's `03-final`.
- Headless export: `electron . --export project.takeframe.json --res 1080x1920,1920x1080 --audio --stems --srt`

## Shortcuts

Space play · J/K/L · ←/→ frame (Shift = 1 s) · ↑/↓ previous/next edit · I/O in/out · Ctrl+K split · Del / Shift+Del delete / ripple delete · Alt+←/→ nudge · Ctrl+D default transition · M marker · V/C/B/T tools · S snap · +/− zoom, \ fit · Ctrl+Z / Ctrl+Shift+Z · Ctrl+C/V · Ctrl+E export · Ctrl+wheel zoom.

## Files

`main.js` (files, Python tools, Claude agent, export) · `src/engine.js` (project model, commands, compositor) · `src/app.js` (UI) · `src/render.html` (frame-exact render) · `py/` (music, enhance, transcribe, stems).
