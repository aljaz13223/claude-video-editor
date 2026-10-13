# Operating guide for Claude

You are the editor. The human directs and reviews. Work in the project folder the user names; the tools live in this repo.

## Pipeline
1. **Transcribe** every episode once: `python cve.py transcribe <proj> --all` (language from `project.json`).
2. **Find moments** (if the user didn't give timestamps): read `transcripts/*.txt`, pick 20–60 s passages that stand
   alone — a hook in the first sentence, one clear idea, an emotional or surprising line. Prefer one continuous answer
   over stitched fragments. Write them to `shorts.json` with `hook`, `btitle`, `txt` (verbatim, spelling fixed), `gfx`.
3. `python cve.py cut <proj>` → check `qa/<id>_<i>.jpg` (yellow grid = where the face is) → set `cx` if needed.
4. `python cve.py crop <proj>` → check `qa/track_<id>.jpg` (green line must sit on the speaker in every tile).
5. `python cve.py build <proj>` → `python cve.py music <proj>` → `python cve.py render <proj>`.
6. **Verify before you show anything** (below). Then `python cve.py timeline <proj>` and tell the user where it is.

## Verification loop (always)
* `python cve.py verify <proj>` — every `[CHECK]` line means captions differ from what was said. Never add words that were not spoken.
* `python cve.py sheet <proj>` and look at the sheets: face centred, captions readable and never over the face,
  titles inside the frame, nothing cut off in 4:5.
* Loudness ≈ -14 LUFS; speech always clearly on top of the music.
* Extract a few full-resolution frames at graphic and cut times and look at them before saying "done".

## Feedback loop (most important)
The user reviews in `timeline.html` and pastes notes like `s03 name (9:16 B) - @ 0:07.40: graphic too late [caption "…"]`.
1. Fix every note; re-render only what changed (`--ids`, `--styles`, `--formats`, `build --reuse-video`).
2. Turn each note into a **concrete, measurable rule** in the project's `EDITING-RULES.md`
   (`- YYYY-MM-DD — rule — (feedback on <project>)`), e.g. "captions max 3 words, never empty frames between groups",
   not "nicer captions". Rules there override defaults and `docs/EDITING-RULES.md`.
3. Show the user what you changed in one or two lines.

## Defaults that came from real feedback
See `docs/EDITING-RULES.md`. The short version: bright, natural grade; longer connected clips over fast cuts;
zoom only on emotional or key lines; graphics ≥ ~3 s and never overlapping; captions never flicker; the video edge
never moves when zooming; brand strip stays; music ducked under speech; always deliver 4:5 feed versions too.

## Don'ts
* Don't use footage with burned-in captions or third-party graphics.
* Don't quote guests on accusations against specific people or groups; prefer personal stories and general ideas.
* Don't use commercial songs unless the user confirms they have the rights.
