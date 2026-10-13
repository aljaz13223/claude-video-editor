---
name: talking-head-reel
description: Edit a talking-head reel / short (9:16) in the 2026 viral style — cut silences and bad takes from a word-level transcript, plan scenes with the user (captions / captions + UI / half screen / full screen), build motion graphics from a visual guide, sound-design from an SFX library. Use for "make this a viral reel", "edit my talking head", "plan the scenes", "sound design this".
---

# talking-head-reel

Bad AI edits come from bad training, not a bad model. This skill is the training: a **visual guide**
(`references/visual-guide.md`) and a **sound design guide** (`references/sound-design.md`). The user plans the scenes, you build.

## Steps
1. **Cut** — word-level transcript (`python cve.py transcribe`), remove every silence and bad take (when a sentence
   is repeated, keep the last good take), ~20 ms padding around words. Report "X s raw → Y s".
2. **Plan** — `python cve.py plan words.json planner.html --title "<name>"` and send it to the user. They choose accent
   colour, two fonts, and per line: scene type, what appears on screen, accent word → `plan.json`.
   If they say "plan it yourself": fill the plan using the psychology section of the visual guide and show it as a
   table for approval before building.
3. **Assets** — before building, say which assets you need (screenshot, logo, product photo). Fetch public ones yourself.
4. **Build** — HyperFrames (or Remotion), each scene by its type from `plan.json`, following the visual guide.
5. **Review** — contact sheet + frames at every scene: 9:16 safe zones, readable, nothing over the face. Send a preview.
6. **Sound** — follow the sound guide: list every on-screen event, place SFX from `sfx/`, music at -20 dB under speech, master -14 LUFS.
7. **Feedback** → measurable rules in the project's `EDITING-RULES.md`.

## Files
- `sfx/` — 18 synthesized effects (whoosh ×5, click ×3, sci-fi ×3, UI ×3, riser ×2, hit ×2); regenerate with `scripts/mksfx.py`.
  Replace with a licensed pack for best quality and update the tables in `sound-design.md`.
- `references/visual-guide.md`, `references/sound-design.md`

## plan.json
```json
{"style":{"accent":"#3a6ea5","font_main":"Montserrat","font_special":"Instrument Serif Italic","color_text":"#ffffff","color_accent":"#3a6ea5"},
 "lines":[{"i":0,"start":0.0,"end":2.4,"text":"...","type":"captions|captions_ui|half|full","note":"what is on screen","accent":"three mistakes"}]}
```
