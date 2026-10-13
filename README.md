# claude-video-editor

**Turn long podcast episodes into finished, on-brand short-form videos — with Claude as the editor.**

claude-video-editor is a small, scriptable editing system built to be driven by [Claude](https://claude.com/claude-code)
(or by you from the command line). It takes raw episodes, cuts the strongest moments on word boundaries, reframes
them around the speaker, adds animated captions, motion graphics and ducked music, renders every short in several
formats, and gives you an editor-style **review timeline** where you leave time-stamped notes for the next revision.

It grew out of a real production workflow (a weekly interview podcast and client work) and encodes the rules that
came out of many rounds of feedback — see [`docs/EDITING-RULES.md`](docs/EDITING-RULES.md).

## What you get

| Step | Command | What happens |
|---|---|---|
| Transcribe | `cve transcribe <proj> --all` | faster-whisper `large-v3`, word-level timestamps, any language |
| Cut | `cve cut <proj>` | segments snapped to word boundaries, 1280x720/30 fps, loudness-normalised |
| Reframe | `cve crop <proj>` | shot-cut detection + face tracking with a dead-zone camera → smooth 4:5 crop |
| Build | `cve build <proj>` | HyperFrames compositions for every look and format |
| Music | `cve music <proj>` | picks the part of your track that builds, ducks it under speech (-15 dB), lifts it in pauses |
| Render | `cve render <proj>` | headless-Chrome render, -14 LUFS master, previews |
| Review | `cve timeline <proj>` | `timeline.html`: preview + tracks + notes you paste back to Claude |
| Verify | `cve verify <proj>` | re-transcribes every clip and diffs it against the captions |
| Plan | `cve plan words.json out.html` | scene planner for talking-head reels (captions / UI / half / full screen) |

`cve all <proj>` runs cut → crop → build → music → render → timeline.

### Looks and formats

* **A — classic 9:16**: two-line hook title, face-tracked 4:5 panel, karaoke captions (active word highlighted),
  name tags, numbered guests in compilations, lower-half graphic cards over a dimmed + blurred video, brand strip, end card.
* **B — cinematic 9:16**: black background, one-line title with accent words, full-width 4:3 video with a slow push-in,
  clean white captions, speaker name under the video; optional **full-frame graphics** inside the video frame over a
  blurred copy of the shot (`"bfull": true`).
* **4:5 feed versions of A and B** (1080x1350) — Instagram and Facebook crop 9:16 to 4:5 in the feed, which cuts off
  titles and logos; these versions keep everything inside the frame.

## Install

Requirements: Python 3.10+, Node 18+ (for `npx hyperframes`), ffmpeg on `PATH`, optionally an NVIDIA GPU for fast transcription.

```bash
git clone https://github.com/<you>/claude-video-editor
cd claude-video-editor
pip install -r requirements.txt
python cve.py init ../my-show          # creates raw/ transcripts/ music/ final/ + example config
```

Rendering uses [HyperFrames](https://github.com/heygen-com/hyperframes) through `npx` (downloaded on first use, together
with a headless Chrome). Offline / locked-down machines: put `gsap.min.js` in `vendor/` (from `npm i gsap`) and set
`PRODUCER_HEADLESS_SHELL_PATH` to an existing `chrome-headless-shell`.

## Quick start

1. Copy episodes into `my-show/raw/` and run `python cve.py transcribe ../my-show --all`.
2. Set your brand in `my-show/project.json` (name, tagline, colours, `logo.svg`, host name, language).
3. Describe the shorts in `my-show/shorts.json` — or ask Claude to find the moments (see `skills/cve-shorts`).
4. `python cve.py all ../my-show`
5. Open `my-show/timeline.html`, add notes where something is off, click **Copy notes**, paste them to Claude.

### shorts.json

```json
{
  "id": "s01", "name": "biggest-paradox",
  "hook": ["THE BIGGEST PARADOX", "OF OUR TIME"],
  "btitle": "The biggest *PARADOX* of our *TIME.*",
  "who": "Dr. Guest Name", "role": "anthropologist",
  "segs": [["episode-12", 1564.3, 1604.4]],
  "txt": ["Corrected caption text, exactly as spoken."],
  "gfx": [["paradox", "THE BIGGEST PARADOX", ""], ["epidemic", "WHO", "declared an epidemic of loneliness"]],
  "music": "calm-piano.mp3", "cx": [840], "variants": ["A", "B"]
}
```

* `segs`: `[episode-key, start, end]` (+ `who`, `role` per segment for compilations, with `"comp": true`).
* `txt`: corrected captions per segment — timings come from the transcript, wording from you.
* `gfx`: `[trigger word, title, subtitle]` — the card appears when the trigger word is spoken.
* `cx`: horizontal centre (0–1280) of the person to follow when several faces are in shot.
* `*word*` in `btitle` = accent colour in the B look.

## Using it with Claude

The repo is built to be operated by an agent. `CLAUDE.md` is the operating guide (pipeline, verification loop,
feedback loop) and `skills/` contains ready-to-install Claude skills:

* **cve-shorts** — podcast → package of shorts, end to end.
* **cve-review** — turn pasted timeline notes into fixes and new permanent rules.
* **viral-reel-editor** — talking-head reels: cut silences, plan scenes, motion graphics, sound design (with a starter SFX library).

Copy a skill folder into `~/.claude/skills/` (or your project's `.claude/skills/`).

## Notes on content and licences

The code and templates are MIT licensed. Your footage, music and logos are yours — the music folder is for tracks you
own or have licensed (commercial songs will trigger Content ID claims). The included SFX are synthesized and free to use.
HyperFrames and GSAP are fetched from npm / CDN under their own licences.
