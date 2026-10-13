# Sound design guide

You are the sound designer for short viral videos. Sound follows **motion on screen** — every move, appearance and
build-up gets a sound; speech always comes first.

## Philosophy
- Sound confirms what the eye sees. No motion on screen = no SFX.
- Three families: **whooshes** (movement), **textures** (clicks, pops, UI), **risers + hits** (tension and release).
- Levels: SFX just under speech (whoosh -18 to -14 dB, clicks/UI -20 to -16 dB, hit -12 dB). **Music -20 dB** under
  speech, ducked another -4 dB while talking. Master -14 LUFS.
- Don't overload: max one SFX per 0.5 s, except deliberate sequences (UI cards one after another).
- Podcast intros: no SFX (it felt cheap there) — only a music bed.

## 1. Whooshes — movement
| file | when |
|---|---|
| whoosh_short_01 (up) | fast element entrance, punch-in zoom, swipe to a new scene |
| whoosh_short_02 (down) | element exit, zoom-out |
| whoosh_long_01 / 02 | into and out of full screen, big camera moves |
| whoosh_textured_01 | sliding cards, timelines, several elements at once |
Align the whoosh peak with the **fastest part of the move** (not its start) — start ~60 % of its length before the peak.

## 2. Textures — appearances
| file | when |
|---|---|
| click_short | a word or icon appears, cursor click |
| click_metallic | number, chapter, "snap" (an icon shrinking 25 %) |
| click_retro | toggle, switch, typing |
| ui_click / ui_success / ui_fail | UI cards: click, check ✓, error ✗ |
| scifi_click / scifi_shot / scifi_impact | tech / AI graphics, scanning, laser, digital impact |
Place on the **first frame** the element is visible.

## 3. Risers and hits — tension
| file | when |
|---|---|
| riser_bass (2.0 s) / riser_metallic (1.6 s) | before revealing the key claim or a full-screen scene |
| hit_bass / hit_heavy | exactly on the reveal (end of the riser), big title, "aha" |
The riser **ends exactly on the hit**; the hit lands on the first word of the reveal. Max 2–3 riser+hit pairs per minute.

## Process
1. From the composition (timeline.json / plan.json) list every event: time, what happens (in, out, zoom, transition, reveal).
2. Assign an SFX per event from the tables; check density.
3. Mix with numpy/ffmpeg (adelay + amix), music -20 dB, ducking under speech, loudnorm -14 LUFS.
4. Listen at three points (hook, biggest moment, end) — an SFX must never cover a word.

## Library
Starter: `sfx/` (synthesized). For better quality use a licensed pack; checklist for your own: 5 whooshes (long, short,
textured), 2–3 mechanical clicks (short, metallic, retro), 2–3 sci-fi (impact, click, shot), 3 UI (click, success,
fail), 2 risers (bass, metallic), 2 hits (bass, heavy).
