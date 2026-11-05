---
name: github-sync
description: Publish the generic, sellable parts of the editing system (skills, scripts, templates, docs) to GitHub — whitelist copy, secret + client-name scan, commit, push. Use after a skill/script/template changed, at the end of a work day, or when the user says "daj na github", "push", "shrani na git".
---

# github-sync

The workspace holds client footage, names and keys; the repo must never. `scripts/sync.py` copies **only whitelisted
paths** (`sync.json` → `map`), scans every text file for secrets and for words in the private blocklist
(`00-SISTEM/github-blocklist.txt`: client names, guests, phone numbers, emails), and commits only if the scan is clean.

```
python sync.py --dry        # see what would change
python sync.py -m "video-brief skill + day log"
```

Rules
- Add a path to `map` only if it is generic (works for any client). Client presets, project folders, finals, briefs,
  PRAVILA-EDITA of a client, licensed asset packs (SFX/LUT bundles) never go in.
- Examples in the repo use invented names ("example-podcast", "Guest A").
- If the scan stops: generalise the file (move client specifics into a preset that stays local), never weaken the scan.
- Commit messages say what changed for a user of the repo ("video-brief: sound profiles"), not session chatter.
- First push on a new computer needs `gh auth login` by the user — never type credentials yourself.
- Log the sync with `work-log`.
