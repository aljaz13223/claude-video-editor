---
name: style-training
description: Teach Claude a whole editing style from many references (10–20 videos or a board of screenshots) and turn it into a reusable skill with a reference library — principles, design tokens, animation logic, where animations sit relative to the script. Use for "nauči se ta stil", "train a style", "make a skill from these videos". For one screenshot/reel use style-from-reference instead.
---

# style-training

Bad AI edits come from bad training, not a bad model. The style lives in two places: **design** (what it looks like)
and **logic** (when and why each element appears). Train both.

## 1. Collect (user + Claude)
- 10–20 of the best videos in ONE consistent style (mixed styles = mush). Download only what the user has the right to study.
- Optional board: ~100 screenshots of scenes the user likes, grouped by scene type.

## 2. Analyse — write `style/<id>/ANALYSIS.md`
For every video: word-level transcript + frames at every visual change (scene detect, 1 frame/s contact sheet). For every scene:
- **placement**: what was being said when it appeared (announce/describe/number/list/quote/emotion), how long it stayed;
- **design**: layout, fonts (main + accent), sizes on a 1080 canvas, colours (hex), textures, edges, what happens to the speaker;
- **animation**: entry/exit, duration, easing, camera move.
Group scenes into 6–10 **principles** (e.g. caption design, b-roll + text, line + text, graph, quote, illustration).

### Measure, don't describe ("editing style is just rules")
For each reference video compute and table: number of distinct layouts; average shot length (s); caption change
interval (e.g. 0.333 s); words per caption; % of time the face is on screen; zooms per minute; graphics per minute;
music level under speech; SFX per minute; hook length (s); cut style (jump / J-cut / match on eye-trace).
Averages across 10–30 videos become the numbers in the style's SKILL.md. "Edit like X" without these numbers fails.

## 3. Package — `skills/<id>/`
- `SKILL.md`: the principles as rules with numbers (sizes, durations, colours as tokens on top, ban list).
- `references/`: one folder per principle with 3–10 example frames + keyframe sheet + a note "used when …".
- Templates: implement each principle as a scene (see `motion-inserts` for the scene contract) — tokens at the top, never hard-coded elsewhere.

Package the rules as a numbered SOP (≈12 steps: cut → layout → captions → zooms → graphics → b-roll → sound → QC)
so every edit follows the same order.

## 4. Test before trusting
1. Style test: 3 still frames from 3 lines of a real script → user approves look.
2. Animation test: animate one of them → user approves motion.
3. Real edit with the `video-brief` plan: Claude *recommends* a scene per line from the reference library, the user chooses.
   (AI planning alone is not creative enough — the human plan is the 15 minutes that matter most.)
4. First draft ≈ 60–70 %. Collect concrete notes ("text design in scene 1", "bad cut at 0:24"), fix, then sound last.

## 5. Grow the style
After each video: "keep the animation from scene X, leave everything else" → add it to the style's references.
Every correction becomes a rule in the style's SKILL.md. Reference adjectives are useless — describe *how* it is made
(masked text, slow camera, long holds).
