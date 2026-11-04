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

## SFX map (when an effect is allowed at all)
| sound | use for |
|---|---|
| click / tap | something pops up on screen (card, number, UI) |
| flash / hit | a quick cut or flash frame |
| whoosh | a real scene-to-scene transition (not every cut) |
| glitch | text that slams in (tech/AI topics only) |
| riser → hit | building tension into a reveal |
Never more than one effect per second; skip them all for `story-loop` interviews.

## Voice chain (`scripts/voice_chain.py`)
The six things broadcast mics run through, as one ffmpeg filter: high-pass ~90 Hz → downward expander (quieter gaps)
→ de-esser → presence EQ +2–3.5 dB at 3.5 kHz (−2 dB at 300 Hz) → compressor 3:1 → limiter, then loudness −16 LUFS.
`python voice_chain.py speech.wav speech_chain.wav --preset clean|podcast|radio`. Run after noise removal / Enhance
Speech, never instead of it. `clean` for already processed speech, `radio` for the warm close-mic sound.

## Check
- Listen at the 3 loudest music moments: is every word clearly on top? If in doubt, music −3 dB.
- `ffmpeg -i final.mp4 -af ebur128=peak=true -f null -` → I ≈ −14, TP ≤ −1.
