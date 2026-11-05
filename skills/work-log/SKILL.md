---
name: work-log
description: Keep a day-by-day work log of every editing session (what was done, for which project, where the result is) so any session — Claude Code, chat, phone — can see what happened when. Use after every finished step or delivery, at session start ("kaj sva delala včeraj", "what did we do on the 29th"), and when the user asks to look back.
---

# work-log

Three places, written by one command (`scripts/log.py`):

| File | What | Read when |
|---|---|---|
| `00-SISTEM/dnevnik/YYYY-MM/YYYY-MM-DD.md` | full detail of that day | "kaj sva delala 29. 10." |
| `<project>/LOG.md` | history of one project | opening a project |
| `00-SISTEM/DNEVNIK.md` | one line per entry, newest on top | session start (read the top 15 lines only) |

## When to log
- After every delivery or finished step (cut done, plan approved, render done, feedback applied) — one entry each.
- When a decision is made (music chosen, style chosen, rule added).
- At session end if something is unfinished: write what is left into `<project>/STANJE.md` and log it.

## Commands
```
python log.py "7 shorts rendered, -14 LUFS" --proj 30-CLIENT/02-projekti/2026-11-03_shorts --out 30-CLIENT/03-final/shorts --kje "claude code"
python log.py --today | --day 2026-10-29 | --week | --find "guest name"
```
Write entries in the user's language, concrete: what changed, numbers (LUFS, seconds, count), path to the result.
Never log keys, passwords or private data.
