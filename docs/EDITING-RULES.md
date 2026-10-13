# Editing rules learned from feedback

These are defaults distilled from many review rounds on a real interview podcast. Each line was a correction from
the person directing the edit. Keep project-specific rules in your project's own `EDITING-RULES.md`.

## Picture
- Grade must not be dark: bright, natural colour (contrast ~+10 %, saturation ~1.05), vignette barely visible.
- When zooming, the edge of the video must never move or open a gap under the title — the title band is solid and
  overlaps the video by a soft 70 px fade.
- Zoom only on emotional or key sentences: clear zoom-in (~+20 % in intros, 1.075 jump-zoom in shorts), short hold,
  slow zoom-out. No constant zooms on every clip.
- Auto-reframe with a dead zone and smoothing; never let the crop chase every head movement.

## Cutting
- Clips should be longer (6–15 s in intros) and connected into a story; avoid fast cuts between isolated sentences.
- Question → answer structure works: the host asks, the guest answers directly, then end on the strongest line.
- Skip episodes with bad audio or wide/echoing shots for single-guest shorts.

## Captions
- Text must match what was said; re-transcribe the cut clips and diff (`cve verify`). Never invent words.
- Captions never flicker: no empty frame between groups (if the pause is < 0.35 s, keep the previous group until the
  next one), the next group appears instantly (no fade, only a 0.97→1 micro-scale).
- Classic look: up to 4 words, active word highlighted. Cinematic look: up to 3 words, plain white.

## Graphics
- Motion graphics stay on screen long enough to read — about 3 s (1.6–3.2 s), never overlapping each other.
- Classic look: card in the lower half; the video behind it dims and blurs; title ~25 % smaller than feels natural;
  accent bar; two rings at the edges + soft dots for depth (three-object rule); numbers count up.
- Cinematic look, full-frame graphics: **only inside the video frame** (title and black bars stay), the same shot is
  blurred in place — no zoom, no different framing; speaker name hides; captions move below the video.
- No freeze frames or name cards that stop the video in intros unless asked.

## Sound
- Speech is always clearly on top. Music: -15 dB under speech, -9 dB in pauses, -6 dB on the end card.
- Choose the music by mood of the clip; use the part of the track that builds towards the end.
- No sound effects on podcast intros (they felt cheap); in fast reels use SFX sparingly (see `skills/talking-head-reel`).

## Branding and formats
- Keep the brand strip (logo + name + tagline) under the video in the classic look.
- Always also deliver 4:5 (1080x1350) for Instagram / Facebook feeds — they crop 9:16 to 4:5 and hide titles and logos.
- The cinematic (B) look is for part of a package, not every short.

## Intros (cold opens)
- Shorter is better (~45 s): host question → guest answer, or one important thought → end.
- Transition to black gradually with a light glitch, never an instant cut; keep the host CTA as a separate video.
