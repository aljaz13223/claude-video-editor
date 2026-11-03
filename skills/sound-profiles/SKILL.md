---
name: sound-profiles
description: Choose and mix the sound of an edit — music profile (story loop, energy, no music, tonal), levels under speech, music breaks, when SFX are allowed and which, loudness targets. Use for "dodaj glasbo", "sound design", "muzika je preglasna", choosing a track, or any mix/loudness question.
---

# sound-profiles

Priority in a talking video: **speech > music > effects**. Effects are emphasis, not decoration.

## Profiles (pick one in the brief)
| Profile | Music | Levels (music) | SFX | Use for |
|---|---|---|---|---|
| `story-loop` | one emotion per section (curious, warm, momentum, tension, melancholy). Change the loop only when the story changes; same key across loops, a related key (e.g. A-minor → D-minor) for a different voice/idea, then back. | −21 dB under speech, −14 dB in pauses | none, or tonal (in key) and buried | interviews, podcasts, testimonials, documentaries |
| `energija` | one upbeat track, cuts and graphics land on downbeats | −18 dB under speech | soft click/whoosh on graphics only | ads, event invites, product |
| `brez-glasbe` | room tone | — | none | serious, emotional, confessional statements |
| `tonalni` | drone + tonal risers/hits on key words | −21 dB | tonal only | premium minimal style |

## Rules
- **Music break**: drop the music 0.5–1 s before the most important line, bring it back after. Silence is a choice.
- Music follows the words: speed/energy of the loop may rise with the content ("faster" → faster loop); a quiet hit on the one key word.
- **Story loop shape**: 16 bars, first 8 = one element, last 8 = add one thing. Loop as long as the feeling holds.
- Duck under speech with a smooth envelope (attack ~0.15 s, release ~0.4 s); never fade the last spoken word.
- **SFX**: only on visible motion (graphic in/out, number lands, tick). Start too quiet, not too loud. Vary files. No laser/zap/
  "funny" or culturally-coded sounds; no whoosh on every cut. Riser → whoosh for a real transition only.
- Spectrum: lows = weight (rare), mids = body, highs = clicks/texture (tactile). Contrast parts: mids/highs first, low hits later.
- Rights: royalty-free or licensed only; log every track per client and never reuse the same track for the same client.
- **Master**: −14 LUFS integrated, true peak ≤ −1 dBTP, measured on the delivered file (stereo). Two-pass loudnorm.

## Check
- Listen at the 3 loudest music moments: is every word clearly on top? If in doubt, music −3 dB.
- `ffmpeg -i final.mp4 -af ebur128=peak=true -f null -` → I ≈ −14, TP ≤ −1.
