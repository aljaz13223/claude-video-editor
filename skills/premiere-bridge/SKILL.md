---
name: premiere-bridge
description: Do the edit inside an open Adobe Premiere Pro project instead of rendering a flat MP4 — cuts, captions, emotional zooms, graphics as alpha overlays, music/SFX tracks, markers for review — through the premiere-pro MCP server, following the video-brief workflow. Use when the user says "v Premieru", "naredi na timeline", "da lahko sam popravim v Premieru", or wants an editable project.
---

# premiere-bridge

The skills decide **what** happens (video-brief, hooks-and-story, motion-inserts, sound-profiles, quality-check);
the `premiere-pro` MCP server (open source, CEP panel in Premiere) does it **on the user's timeline**, so every
layer stays editable. Never delete or overwrite the user's own sequences — always work in a new sequence.

## Setup (once per computer)
`tools/INSTALL-PREMIERE-MCP.bat` (Premiere closed) → open Premiere + a project → Window › Extensions ›
MCP for Adobe Premiere Pro (status "Running") → new Claude Code session → `verify_premiere_connection`, then
`get_capabilities`. If a tool is missing or fails, use the XML fallback below instead of guessing.

## Track layout (always the same, so the user finds things)
| Track | Content |
|---|---|
| V1 | A-roll (talking head), cut |
| V2 | b-roll / motion inserts (full or pip) |
| V3 | graphics with alpha: hook title, lower third, CTA, text-behind renders |
| C1 | captions (from SRT) |
| A1 | speech (processed: esv2 or voice_chain) |
| A2 | music (already ducked bed from sound-profiles, or raw with keyframed volume) |
| A3 | SFX |
Sequence name: `YYYY-MM-DD_<project>_<format>_claude` (e.g. `2026-11-06_nlp-bf_9x16_claude`).

## Steps
1. **Brief + plan** as in `video-brief` (format → sequence settings 1080×1920 / 1080×1350 / 1920×1080, 25/30 fps as source).
2. **Import** raw, b-roll, music, SFX and the rendered graphics into a bin `claude/<date>`.
3. **Cut**: build the edit from the plan's EDL (word-level transcript, cuts on pauses ≥ 0.4 s, speech starts ≤ 0.4 s).
   Prefer placing clip ranges (in/out) over many razor cuts.
4. **Captions**: write an SRT from the transcript (2–3 words, = spoken text) → import as caption track. Styling is done
   once in Premiere and saved as a caption style; position outside IG safe zones.
5. **Zooms**: Scale keyframes on V1 only on the plan's emotional/key lines (100 → 114–118 % in 0.45 s, hold, back in 1.1 s,
   ease in/out). Never while V2 has b-roll/insert above.
6. **Graphics**: render motion inserts / titles with HyperFrames as **MOV with alpha** (`--format mov`) and place on V2/V3
   at the plan times. Text-behind-speaker clips replace the V1 segment for their duration.
7. **Sound**: speech on A1; music on A2 at the profile level (−21 dB under speech for story-loop, −18 dB energija) with
   volume keyframes or the pre-ducked bed; SFX on A3 only on visible motion.
8. **Markers**: one marker per decision the user should check ("zoom", "insert: stat 72 %", "music break") with a note.
9. **QC**: export a 540p preview through Media Encoder (or capture frames), run `quality-check`; loudness −14 LUFS on export.
10. Save the project; log with `work-log`. The user finishes in Premiere and exports the final.

## XML fallback (no plugin / a tool fails)
Write an FCP7 XML (xmeml v5) with the same tracks: clipitems with in/out, Basic Motion scale keyframes for zooms,
audio levels, and the SRT next to it. Premiere: File › Import › the .xml → opens as a new sequence.

## Limits of the bridge (as documented by the project)
Clip speed/direction changes are not supported; reading existing caption text is unreliable; some ripple/roll/slip
operations rely on Premiere's QE DOM. Everything else falls back to the XML route.
