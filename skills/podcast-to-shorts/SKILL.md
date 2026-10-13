---
name: podcast-to-shorts
description: Turn podcast or interview episodes into a package of finished short-form videos (9:16 + 4:5) with claude-video-editor — find moments, cut, reframe, captions, graphics, music, render, review timeline. Use when the user says "make shorts from this episode", "clip this podcast", or gives timestamps to cut.
---

# podcast-to-shorts

Repo: claude-video-editor (`cve.py`). Read the repo's `CLAUDE.md` and the project's `EDITING-RULES.md` first — rules there win.

## Steps
1. Project: `python cve.py init <proj>` if it doesn't exist. Brand, host and language go in `project.json`.
2. **Style**: if the user hasn't chosen, use the `pick-a-style` skill (gallery + question) before cutting anything.
   If they send a reference image or video frame instead, use `style-from-reference`.
3. Episodes in `<proj>/raw/` → `python cve.py transcribe <proj> --all`.
4. Find moments in `transcripts/*.txt` (skip if the user gave timestamps):
   - 20–60 s, one idea, strong first sentence, ends on the strongest line; continuous answers over stitched fragments.
   - For each: `hook` (2 lines, no punctuation, ~20 chars per line), `btitle` (one line, 1–2 `*ACCENT*` words),
     `txt` (verbatim captions, spelling and names fixed), 1–3 `gfx` triggers (key word, number, named entity), `music` by mood,
     `styles` (list of style ids — e.g. the main style for all, a second style for half of the package).
   - Compilations: `"comp": true`, one segment per guest with `who`/`role`.
5. `python cve.py cut <proj>` → check `qa/<id>_<i>.jpg`, set `cx` to the speaker → `python cve.py crop <proj>` → check `qa/track_*.jpg`.
6. `python cve.py build <proj>` → `python cve.py music <proj>` → `python cve.py render <proj>`.
7. Verify (`cve verify`, `cve sheet`, frames at graphic times, loudness) before showing anything.
8. `python cve.py timeline <proj>`; tell the user where `timeline.html` is and how to send notes.

## Reporting
One short paragraph: how many shorts, which styles/formats, where the files are, anything you were unsure about.
