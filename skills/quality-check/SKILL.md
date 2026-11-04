---
name: quality-check
description: Verify an edit before showing it — stills and contact sheets, captions vs what was said, speaker on camera, no zoom on b-roll, pacing (dead time, flashes), still-time measurement, loudness — and score it like a strict senior editor. Use before saying "done", before sending a preview, and after every revision round.
---

# quality-check

Check frames, not code. Never report "done" from a log line.

## Checklist (in this order)
1. **Stills**: frames at every graphic in/out, zoom, cut, insert and the end card (`hyperframes snapshot … --at`), plus a
   1 frame/s contact sheet. Look: speaker's face centred and visible when they talk; captions readable, never over the face;
   titles inside the frame; nothing cut off in 4:5 / 16:9.
2. **Captions = speech**: re-transcribe the final cut and diff against caption text; every difference is a bug. Never add words.
3. **Rules from the brief/plan**: no zoom during b-roll/inserts; graphics ≥ 3 s and not overlapping; no b-roll in the first 3 s;
   speech starts ≤ 0.4 s; non-speaker shots covered.
4. **Pacing**: `python scripts/motion_check.py final.mp4` → seconds with no motion (aim: under 15 % of the video for motion
   pieces; talking face counts as motion), longest still stretch (> 2 s in a graphic = add movement), flashes < 0.3 s.
5. **Cuts**: frame strip ±5 frames around each cut — no jump in the middle of a word, no 1-frame flashes, lips in sync.
   **Eye-trace**: each new shot/insert should put the point of interest where the viewer's eyes were at the end of
   the previous shot (invisible cut). Check the frame pairs at every cut.
6. **Sound**: −14 LUFS / ≤ −1 dBTP measured on the delivered file; speech always on top of music.
7. **Score** 1–10 as a strict senior editor; fix the 3 worst things, re-check, max 3 rounds without the user.
   Stop when the remaining notes are things a viewer would not notice — more "improving" adds slop.

Report to the user in 2–3 lines: what was checked, what was fixed, anything they should look at themselves.
