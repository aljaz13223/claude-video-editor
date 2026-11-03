---
name: video-brief
description: Start every video job with a one-screen brief (format/resolution, graphics theme, sound profile, zoom, b-roll, versions, budget) and an approved edit plan BEFORE any render — the cheapest way to get the right edit first time. Use at the start of any edit ("naredi video", "nov reel", "make a short", "edit this"), when the user says "kot ponavadi" / "same as last time", or when work keeps being redone.
---

# video-brief

Most wasted credits come from building the wrong thing and re-rendering it. This skill front-loads every
decision into **two cheap checkpoints** — a brief and a plan — so the expensive part (graphics, renders) runs once.

```
0 BRIEF  →  1 CUT  →  2 PLAN (user approves)  →  3 STILLS  →  4 PREVIEW 540p  →  5 FINAL + LOG + GIT
  1 msg      script     table, no renders        4–6 frames    one look         only after "OK"
```

## 0 — Brief (one message, never a long interview)
1. If the client has a preset (`presets/<client>.json`, or `00-SISTEM/briefi/presets/` in the workspace), load it and
   show only what differs: *"Kot ponavadi za <client>: 9:16 + 4:5, stil warm-dark, glasba story-loop −21 dB, brez SFX. Kaj spremenim?"*
2. Otherwise ask **at most 4 questions in one AskUserQuestion call**, each with a recommended default:
   - **Format / resolution** — 9:16 1080×1920 (Reels/Shorts/TikTok) · 4:5 1080×1350 (FB/IG feed) · 16:9 1920×1080 (YouTube) · 1:1 1080×1080.
   - **Graphics theme** — one style from the style library (`styles/`, or `00-SISTEM/stili`) + amount: *malo* (hook + lower third + CTA) · *srednje* (+ 2–4 key-line cards) · *veliko* (scene per idea, b-roll).
   - **Sound profile** — see table below.
   - **Zoom / b-roll** — emotional zooms only · punch-in for distant camera · none; b-roll yes/no.
3. Write `brief.json` (template: `brief-template.json`) into the project folder and log it (`work-log`).

### Sound profiles
| Profile | Music | Under speech | SFX | Use for |
|---|---|---|---|---|
| `story-loop` | one emotion per section (curious, warm, momentum, melancholy); change loop when the story changes; a music break before the key line | −21 dB | none or tonal (in key) | interviews, podcasts, testimonials |
| `energija` | one upbeat track, cut on downbeats | −18 dB | soft clicks/whooshes on graphics | ads, event invites |
| `brez-glasbe` | room tone only | — | none | serious/emotional statements |
| `tonalni` | drone + tonal risers/hits on key words | −21 dB | tonal only | premium minimal style |
Never commercial songs without confirmed rights. Log every track used (no repeats per client).

## 1 — Cut
Word-level transcript, remove silences/bad takes (30 ms padding), cut only on pauses ≥ 0.4 s. Report "X s raw → Y s".

## 2 — Plan (the most important checkpoint — no renders yet)
Write `plan.md` as a table and send it; build nothing until the user approves or says "planiraj sam":

| t | spoken (verbatim) | on screen | zoom | sound |
|---|---|---|---|---|
| 0.0 | "…hook…" | face + hook title | — | loop "curious" in |
| 4.2 | "…announces point 1…" | **face** (announce = face) | — | — |
| 6.8 | "…describes it…" | **show it**: b-roll / card | — (never zoom on b-roll) | — |
| 18.5 | "…emotional line…" | face | punch-in 1.16× | music break |

Rules for proposing: announce → face, describe → show; ≤ 1 visual idea per sentence; graphics ≥ 3 s and never
overlapping; nothing waits empty (motion every ~2 s) but no zoom on every sentence; speaker always on camera when talking.

## 3 — Stills, 4 — Preview, 5 — Final
- **Stills**: snapshot 4–6 frames at graphic/zoom/cut times and look at them yourself before any render.
- **Preview**: one format, 540p/draft quality, one version. Send it. Collect *all* notes in one round.
- **Final**: render every format only after "OK"; re-render only what changed (`--ids`). Loudnorm −14 LUFS / −1 dBTP.
- Then: `work-log` entry, turn every note into a measurable rule (`EDITING-RULES.md`), `github-sync` for generic code.

## Credit savers (do these by default)
- One brief message, one plan message, one review round batched — not ten small ones.
- Never render to "see what it looks like" — stills first.
- Session start: read only the project's `STANJE.md` + last 20 lines of `LOG.md`, not the whole history.
- Mechanical steps (transcribe, render, loudnorm, logs) are scripts; Claude only plans and reviews.
- Keep the active skills folder small (every installed skill's description is loaded every session); archive the rest.
- Paid AI generation (video/image/voice): storyboard + price + explicit "yes" first.
