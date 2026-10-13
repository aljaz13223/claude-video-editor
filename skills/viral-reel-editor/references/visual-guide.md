# Visual guide

The brand file wins on colours and fonts; this guide defines structure and behaviour.

## 1. Captions
- **Two fonts**: a medium sans for most words (Montserrat 600–700 / Inter / Poppins) + a **script or serif italic for special words**.
- **Two colours**: white for normal words, **one accent colour** for the word that has to pop.
- Position: **lower half**, never over the face. 9:16: text centre at ~68–72 % of the height.
- Animation: **word by word, pop-up + fade-in** (scale 0.85→1, opacity 0→1, ~120 ms, ease-out). No constant bouncing.
- Soft shadow for legibility (0 4px 18px rgba(0,0,0,.45)), no heavy strokes.
- Max 3–4 words on screen; the accent word may sit alone, 1.3× and in the special font.
- **Hook (first 2–3 s)**: speaker on screen, captions in the lower half, highlight **the one word that makes people keep watching**.

## 2. Animations (half screen / full screen)
### Four scene types
- **Text-centric** — typography is the star (big kinetic title, word written on).
- **Person-centric** — built around a person (cut-out, portrait, avatar).
- **Object-centric** — one object in the centre (product, icon, 3D object, logo).
- **Graphic-centric** — charts, UI, dashboards, timelines, sliders, loading bars.

### Building a scene
1. **Background first**: soft gradient or texture (3–5 % grain), light vignette, never pure black or white.
2. **Three-object rule**: (1) main object in the centre, (2) two supporting elements at the edges, (3) depth elements
   around the outside (blurred, smaller, lower opacity).
3. Camera: slow push-in or drift (2–4 %), never static.
4. Good examples: a cursor dragging a "beginner → professional" slider; three numbered circles filling per chapter;
   an icon that is too big and snaps 25 % smaller; a loading bar where only one segment lights up; an eye that spins
   with timeline cards sliding around it; logos orbiting and fading into a new line of text.

### Design basics
- **Everything 25 % smaller** than feels right. Huge icons and shape layers look amateur.
- **Fewer effects** — an effect is special because it is rare.
- **Muted colours** — not pure black, pure white or screaming red. Muted blue, green, warm grey, cream = premium.
- Animations use the same two fonts as the captions.

## 3. On-screen UI (captions + UI)
- Small animations while the speaker talks: card, notification, number, icon, mini chart.
- **Speaker darkens (~35 %) and blurs (~8 px)**; the animation sits in the **lower half**.
- On screen for as long as it is talked about, min 1.5 s; in 250–350 ms, out 200 ms.

## 4. Placement psychology (when you plan)
- Hook = captions (+ maybe a small UI, e.g. three circles for "three mistakes"). The face must be visible.
- **Full screen** only for the 2–4 biggest moments. Half screen for explanations with an example. Captions + UI for lists and numbers.
- A repeating element for chapters (same UI for #1, #2, #3) tells viewers where they are; show it complete at the end.
- Zoom on the face for transitional or personal lines.
- Change scene type every 3–6 s; never two full screens in a row without the speaker in between.
