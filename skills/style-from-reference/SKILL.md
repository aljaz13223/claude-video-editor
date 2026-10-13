---
name: style-from-reference
description: Create a new claude-video-editor edit style from a reference image or video the user likes (a screenshot of a short, a frame of a reel) — analyse layout, type, colour and motion, build it as a style folder, render a preview, iterate with the user. Use when the user sends a reference and says "make it like this", "this style", "copy this look".
---

# style-from-reference

The result is a reusable style in `<proj>/styles/<new-id>/` (or `styles/` in the repo if the user wants to share it).
Never copy logos, watermarks, channel names or text from the reference — recreate the *layout and feel* only.

## 1. Analyse the reference (write it down before coding)
- **Canvas**: 9:16 or 4:5; where the video sits (full bleed, panel, letterbox) and its aspect (4:5, 4:3, 16:9, 1:1).
- **Bands / background**: colour, gradient, blur, grain.
- **Title**: position (above video, on top band, over video), lines, weight, case, accent colours, size relative to width.
- **Captions**: position (% of height), words per line, case, colours, highlight style (colour, box, scale), shadow/stroke.
- **Graphics**: where they appear (lower half, centre, full frame), what happens to the video (dim, blur, zoom).
- **Motion**: zooms (jump, push-in), transitions, how text enters.
- **Brand elements**: logo strip, watermark, name tag, end card.
Measure positions as pixels on a 1080-wide canvas (multiply the image coordinates by 1080 / image width).

## 2. Build
1. Start from the closest existing style: copy `styles/<closest>/` to `<proj>/styles/<new-id>/`.
2. Edit `style.json`: new `id`, `name`, `tagline`, `description`, `best_for`; `video` (`crop_w` from the panel aspect:
   4:5 → 576, 4:3 → 960, 16:9 → 1280; `out_w`/`out_h` = panel size), `flags`.
3. Edit `template.html` — keep the data contract (`__DATA__`, `__TOTAL__`, `__VEND__`, `__H1__`, `__H2__`,
   `{{brand}}` etc., `window.__timelines["main"]`) and the caption timing rules (no empty frames between groups).
   Change CSS positions/colours first; change animation code only where the reference demands it.
4. Write `format_4x5.css` that moves every element inside 1080x1350.

## 3. Preview and iterate
- `python cve.py build <proj> --ids <one short> --styles <new-id> --formats 9x16` → `render` → extract 3 frames
  (caption, graphic, end) and put them **side by side with the reference**. Fix the biggest difference, repeat (max 3 rounds).
- Save the best frame as `styles/<new-id>/preview.jpg` so it appears in the gallery.
- Show the user reference vs result and ask what to change. Record their corrections in the style's `README.md`.
