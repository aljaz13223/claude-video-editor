---
name: pick-a-style
description: Let the user choose how their video will be edited — show the claude-video-editor style catalog with reference images and ask which style(s) to use. Use before building shorts when no style is set, or when the user asks "what styles are there", "show me options", "which look should I use".
---

# pick-a-style

1. `python cve.py styles` — read the catalog (id, name, tagline, best for).
2. `python cve.py gallery <proj>/styles.html` — a page with every style's reference image. Show it to the user
   (open it, send it as a file, or publish it as a page — whatever the surface supports) so they **see** the options.
3. Ask one question with the styles as options. Put your recommendation first, chosen from the content:
   - interview / advice / several guests → `clean-podcast`
   - emotional, thoughtful, quote-like moments → `cinema-bars`
   - compilations or clips with numbers and named ideas → `cinema-bars-fullframe`
   Mention they can pick two (e.g. one main style for every short, a second for half of the package), or send a
   reference image to get a new style (`style-from-reference`).
4. Save the answer: project default in `project.json` → `"styles": [...]`, or per short in `shorts.json` → `"styles"`.
5. Continue with `podcast-to-shorts`.

When options are shown as a question with previews, use each style's `preview.jpg` (in `styles/<id>/`) as the preview.
