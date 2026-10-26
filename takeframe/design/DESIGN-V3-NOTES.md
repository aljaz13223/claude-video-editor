# Takeframe — third look ("Studio"), notes from references (2026-10-26)

Status: built (2026-10-26) as the Premium skin **Studio** — `src/skins/studio.css` + `src/ui5.js`.

## References
- `references/ref-02-takeframe-ai-dock.png` — main reference (good direction).
- `references/ref-01-circular-timeline.png` — earlier concept; only the voice-command examples and AI tool cards are worth taking.

## Take from the references
1. **AI Dock (right panel)** with tabs Edit / Generate / Enhance / Analyze and cards with a one-line description:
   Remove silences · Generate B-roll · Add captions · Match color · Improve audio (Enhance speech) · Animate text · Replace background.
   Most already exist in Takeframe (spread over tabs/menus) — the dock gathers them. When a clip is selected the dock turns into the Inspector.
2. **"Ask Claude…" bar at the bottom** with quick chips (Make it shorter · Add captions · More cinematic) and the mic button (push-to-talk → local Whisper → Claude).
3. **Voice command examples** as hints ("Cut the quiet parts", "Add subtitles", "Zoom in on this", "Add cinematic color grade", "Find the best clips", "Add music like this").
4. **Tracks with names, icons and colours**: Video, Music, Voiceover, SFX, Graphics, Subtitles; colour-coded waveforms; orange keyframe diamonds.
5. **Assets panel left**: thumbnails with duration, filter chips All / Video / Images / Audio, search.
6. Large monitor in the middle with transport + resolution switch under it.

## Change vs. the references
- Timeline stays **straight** (precise trimming, equal spacing). Depth/glow only as background; the curved look at most as an optional overview.
- No decorative film strips at the edges.
- Mic lives in the Ask Claude bar, not in the middle of the timeline.
- One navigation only: left rail for panels; top = workspaces (Edit / Motion / Sound / Color) + command search + Export.
- Glow only on the playhead and the active element; everything else calm.
- Model label shows Opus 5.5 (not "Claude 3.5").

## Build plan
- `src/studio.css` + `html.studio` class, third button in the edition switch (Lite | Premium | Studio).
- Layout grid: left rail + assets | monitor | AI Dock/Inspector; timeline full width; Ask Claude bar under the timeline.
- New: AI Dock component (cards → existing actions/Claude prompts), Ask Claude bar with chips, push-to-talk (record mic → `py/transcribe.py` → `runAI`).
- Track header pills with icons/colours per role.
