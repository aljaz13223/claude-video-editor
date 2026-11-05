---
name: motion-inserts
description: Put short motion-graphic scenes INTO a talking-head video to show what the speaker says — numbers counting up, bar/line graphs, steps, before/after, quotes, key words, timelines, checklists — in full-frame, half-screen (speaker stays visible) or picture-in-picture layout. Use when the brief asks for motion graphics in a talking video, when the speaker mentions a number, a comparison, a list, a process or a quote, or when the user says "prikaži graf", "dodaj grafiko", "motion grafike v video".
---

# motion-inserts

Speakerless motion pieces (launch films, ads, logo animations) and talking-head edits use the same building blocks.
This skill brings those blocks into a talking video as **inserts**: 3–6 s scenes driven by a JSON spec, rendered with
HyperFrames, laid over the A-roll at the right moment while the speech keeps running.

## Scene types (`type`)
| type | shows | use when the speaker says … | data |
|---|---|---|---|
| `stat` | a big number counting up + label | a percentage, an amount, years | `value`, `prefix`, `suffix`, `decimals`, `title`, `sub` |
| `bar` | 2–6 bars growing, one highlighted | a comparison of amounts | `items: [{l, v, hi}]`, `suffix`, `title` |
| `line` | line graph drawn by a travelling dot, camera follows | growth / decline over time | `points`, `labels`, `end_label`, `title` |
| `steps` | numbered steps joined by a line, the current one bright | "first… then… finally", a process | `items`, `title` |
| `compare` | two cards A vs B (✕ / ✓) | before/after, wrong/right, old/new | `a: {h, items}`, `b: {h, items}`, `title` |
| `quote` | big quotation mark, words appear one by one | the key sentence, a quote | `text`, `who`, `size` |
| `linetext` | a line draws through 2–4 key words | an idea with 2–4 linked values | `words` |
| `keyword` | one huge word, small words above/below | the one word that matters | `word`, `above`, `below` |
| `timeline` | years/milestones on a line | a life or company story | `items: [{y, t}]`, `title` |
| `checklist` | items get ticked | "what you need", requirements | `items`, `title` |
Text: `*word*` = accent word (accent colour + serif italic). Max ~6 words per line, max ~12 on screen.

## Layouts (`layout`)
- `half` — graphic on top 56 %, speaker below. **Default when the speaker is emotional or it is their story** (speaker stays on camera).
- `pip` — graphic full, speaker in a circle bottom-right. For 4–6 s data scenes.
- `full` — only the graphic (speech continues). Only when the speaker *describes* something and their face adds nothing; max 6 s, then back to the face.

## Themes (`theme`)
Built in: `paper` (premium minimal: paper + ink + one blue), `paper-dark`, `dark-teal`, `swiss`, `drift`.
Brand themes (client colours/fonts) go in `themes.local.json` next to the spec — never into the public repo:
`{"brand-x": {"bg": "#fff", "fg": "#333", "acc": "#dd722a", "mut": "#777", "line": "rgba(0,0,0,.15)", "bar": "rgba(0,0,0,.12)", "card": "#f7f7f7", "sans": "'Poppins'", "serif": "'Playfair Display'", "grain": "0", "bgfx": "none"}}`.

### Text behind the speaker (`scripts/text_behind.py`)
One big word in the background, the speaker in front of it (MediaPipe person segmentation, model downloaded once).
`python text_behind.py in.mp4 out.mp4 --text "MOTION" --t0 2 --t1 5.5 --y 0.22 --size 0.16`
Rules: 1 word (max 2), top third, the head may cover at most ~30 % of the word (move `--y` up or shorten the word),
≥ 1.2 s on screen, once or twice per video — it is a signature moment, not a caption style.

### Themes from the IG references
`warm-editorial` (dark brown gradient, cream text, tan accent — editorial "how I edit" look), `audio-lab` (black,
green bars, mono labels — technical explainers), `grid-blue` (white grid paper, blue accent — tool/flow diagrams).

## Steps
1. **Pick moments from the plan** (`video-brief` plan table, column "on screen"): one insert per idea that has a number,
   comparison, list, process or quote. Typical 60 s reel: 2–4 inserts. Announce → face, describe → insert.
2. Write `inserts.json`: `format` from the brief (`[1080,1920]`, `[1080,1350]`, `[1920,1080]`), `theme`, `aroll`, and per insert
   `id`, `t` (start, seconds in the cut A-roll — start on the word, ~0.1 s before), `dur` (≥ 3 s; ~0.35 s per word shown + 1.5 s), `type`, `layout`, data.
   Use only numbers the speaker actually says. Never invent data.
3. `python scripts/inserts.py build inserts.json --out inserts`
4. `python scripts/inserts.py snap inserts` → look at the stills (start / middle / end) before rendering anything.
5. `python scripts/inserts.py render inserts [--ids i2,i4]`
6. `python scripts/inserts.py apply inserts.json inserts --aroll aroll.mp4 --dest aroll_inserts.mp4` — picture replaced in the
   insert windows, original audio kept, half/pip use the same seconds of A-roll so lips stay in sync.
   Then captions/music/brand as usual (inserts sit under the caption layer; keep captions off the graphic or hide them for `full`).

## Motion rules (built into the template)
- The camera never stops (slow push + drift on every scene); nothing waits empty — something moves every ~1 s.
- Nothing grows from 0 (start at 0.6–0.9 scale / low opacity); expo/power ease-out, never linear on what the eye follows.
- One accent colour, one hero move per scene, no glow/flare, no colour-shifting gradients.
- Never zoom the A-roll while an insert is on screen. Inserts never overlap each other or other graphics; ≥ 3 s apart.
- Sound: inserts are silent; with the `story-loop` profile add nothing, with `energija` a soft tick when a number lands.

## Adding a new scene type
Add a function to `SCENES` in `scripts/insert_template.html` (use `el()`, `px()`, `words()`, `tl` and `IN()`), add a demo
entry in `inserts.py` (`DEMO`), build + snap at 9:16, 4:5 and 16:9, and look at all three before using it.
