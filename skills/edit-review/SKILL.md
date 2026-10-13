---
name: edit-review
description: Apply review notes pasted from the claude-video-editor timeline (lines like "s03 name (9:16 B) - @ 0:07.40: ...") — fix, re-render only what changed, and record each note as a permanent measurable rule. Use whenever the user pastes timeline notes or gives timestamped feedback on rendered shorts.
---

# edit-review

1. Parse every note: short id, style and format (e.g. "Cinema Bars 4:5"), time, problem, and the bracketed context
   (caption / graphic / clip on screen at that time).
2. Find the cause in the data first (`build/<id>/timeline.json`, `shorts.json`), then in the template. Prefer fixing
   data (caption text, gfx trigger, segment times, `cx`) over template changes; change a template only when the note
   is about the look itself — and then it applies to every short, so say so.
3. Re-run the smallest step: `build --ids <id> --styles <style> --reuse-video` for overlay/caption/graphic changes, `cut --force`/`crop`
   for framing and timing, `music` for audio, then `render --ids <id> --styles <style> --formats 9x16`.
4. Verify the exact moment of each note with full-resolution frames before reporting.
5. Add one measurable rule per note to the project's `EDITING-RULES.md`:
   `- YYYY-MM-DD — <rule with numbers> — (note on <id> @ <time>)`.
6. Rebuild `timeline.html` and reply with a numbered list: note → what changed.
