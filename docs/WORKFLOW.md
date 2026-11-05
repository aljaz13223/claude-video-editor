# Workflow — right edit first time, minimum credits

```
0 BRIEF → 1 CUT → 2 PLAN (approved) → 3 STILLS → 4 PREVIEW 540p → 5 FINAL + LOG + GIT
```

| Step | Skill | Output | Why it saves credits |
|---|---|---|---|
| 0 Brief | `video-brief` | `brief.json` — format/resolution, graphics theme + amount, sound profile, zoom/b-roll, versions | one message instead of ten; client presets ("same as last time") |
| 1 Cut | `talking-head-reel` / `cve cut` | word-level cut, silences out (30 ms pad), cuts only on pauses ≥ 0.4 s | scripted, no model time |
| 2 Plan | `video-brief` | `plan.md`: time · spoken · on screen · zoom · sound | nothing is built until the plan is approved |
| 3 Stills | `edit-review` | 4–6 frames at graphic/zoom/cut times | look before rendering |
| 4 Preview | — | one format, 540p, one version; all notes in one round | one cheap render |
| 5 Final | `edit-review`, `work-log`, `github-sync` | all formats, −14 LUFS; notes → measurable rules; day log; generic code to git | re-render only what changed |

## Sound profiles
`story-loop` (one emotion per section, −21 dB under speech, music break before the key line) ·
`energija` (one upbeat track, −18 dB, soft SFX on graphics) · `brez-glasbe` · `tonalni` (drone + in-key risers/hits).

## Planning rules
Announce → face, describe → show. One visual idea per sentence. Graphics ≥ 3 s, never overlapping.
Speaker on camera whenever they talk. Zoom only on emotional/key lines (1.14–1.18×), never during b-roll.
Nothing waits empty, but no zoom on every sentence.

## Keep it lean
- Session start: read the project's `STANJE.md` and the top of the day log only.
- Cheaper model for mechanical steps, strongest model for plan and review.
- Few installed skills — every installed skill description is loaded into every session.
- Paid AI generation only after storyboard + price + explicit yes.

## Day log
`work-log/scripts/log.py "what was done" --proj <project> --out <result>` → `00-SISTEM/dnevnik/YYYY-MM/YYYY-MM-DD.md`,
`<project>/LOG.md`, one-line index in `00-SISTEM/DNEVNIK.md`. `--today`, `--day`, `--week`, `--find`.

## Publishing
`github-sync/scripts/sync.py` copies only whitelisted generic paths, blocks secrets and private names, then commits and pushes.
