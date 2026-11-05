#!/usr/bin/env python3
"""Daily work log for a video workspace.

Writes every entry to three places so you can always look back:
  <root>/00-SISTEM/dnevnik/YYYY-MM/YYYY-MM-DD.md   one file per day (full detail)
  <project>/LOG.md                                   per-project history (if --proj given)
  <root>/00-SISTEM/DNEVNIK.md                        one-line index, newest on top

Usage
  python log.py "Rendered 7 shorts, -14 LUFS" --proj 30-CLIENT/02-projekti/2026-11-03_shorts --out 30-CLIENT/03-final/shorts
  python log.py --today                 # print today's log
  python log.py --day 2026-10-29        # print a given day
  python log.py --week                  # last 7 days, one line each
  python log.py --find "guest name"          # search every day file
  python log.py --migrate               # split an old single DNEVNIK.md into day files (once)

Root = $CVE_ROOT, or --root, or the folder two levels above this script's 00-SISTEM.
"""
import argparse, datetime as dt, os, re, sys
from pathlib import Path

def find_root(arg):
    if arg: return Path(arg)
    if os.environ.get("CVE_ROOT"): return Path(os.environ["CVE_ROOT"])
    p = Path(__file__).resolve()
    for parent in p.parents:
        if (parent / "00-SISTEM").is_dir(): return parent
    return Path.cwd()

def day_file(root, d):
    f = root / "00-SISTEM" / "dnevnik" / d.strftime("%Y-%m") / f"{d:%Y-%m-%d}.md"
    f.parent.mkdir(parents=True, exist_ok=True)
    if not f.exists():
        f.write_text(f"# Dnevnik {d:%Y-%m-%d} ({['pon','tor','sre','čet','pet','sob','ned'][d.weekday()]})\n\n", encoding="utf-8")
    return f

def append(f, text):
    with open(f, "a", encoding="utf-8") as h: h.write(text)

def prepend_index(root, line):
    idx = root / "00-SISTEM" / "DNEVNIK.md"
    head = "# DNEVNIK — indeks (podrobnosti: 00-SISTEM/dnevnik/YYYY-MM/YYYY-MM-DD.md)\n\n"
    body = idx.read_text(encoding="utf-8") if idx.exists() else head
    lines = body.splitlines(keepends=True)
    # insert after the header block (first blank line after line 1)
    i = next((k + 1 for k, l in enumerate(lines) if k > 0 and l.strip() == ""), len(lines))
    lines.insert(i, line + "\n")
    idx.write_text("".join(lines), encoding="utf-8")

def main():
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
    ap = argparse.ArgumentParser()
    ap.add_argument("msg", nargs="?")
    ap.add_argument("--proj"); ap.add_argument("--out"); ap.add_argument("--kje", default="claude")
    ap.add_argument("--root"); ap.add_argument("--today", action="store_true"); ap.add_argument("--day")
    ap.add_argument("--week", action="store_true"); ap.add_argument("--find"); ap.add_argument("--migrate", action="store_true")
    a = ap.parse_args()
    root = find_root(a.root)
    now = dt.datetime.now()

    if a.today or a.day:
        d = dt.date.fromisoformat(a.day) if a.day else now.date()
        f = day_file(root, d); print(f.read_text(encoding="utf-8")); return
    if a.week:
        for k in range(6, -1, -1):
            d = now.date() - dt.timedelta(days=k)
            f = root / "00-SISTEM" / "dnevnik" / d.strftime("%Y-%m") / f"{d:%Y-%m-%d}.md"
            if f.exists():
                heads = [l[4:].strip() for l in f.read_text(encoding="utf-8").splitlines() if l.startswith("### ")]
                print(f"{d}: " + " | ".join(heads))
        return
    if a.find:
        for f in sorted((root / "00-SISTEM" / "dnevnik").rglob("*.md")):
            for l in f.read_text(encoding="utf-8").splitlines():
                if a.find.lower() in l.lower(): print(f"{f.stem}: {l.strip()}")
        return
    if a.migrate:
        idx = root / "00-SISTEM" / "DNEVNIK.md"
        n = 0
        for l in idx.read_text(encoding="utf-8").splitlines():
            m = re.match(r"- (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))? — (.*)", l)
            if not m: continue
            d = dt.date.fromisoformat(m.group(1))
            append(day_file(root, d), f"### {m.group(2) or '--:--'} — {m.group(3)[:80]}\n{m.group(3)}\n\n"); n += 1
        print(f"migrated {n} entries"); return
    if not a.msg: ap.print_help(); sys.exit(1)

    proj = a.proj or "-"
    title = a.msg.split(".")[0][:80]
    entry = f"### {now:%H:%M} — {proj} — {title}\n- kje: {a.kje}\n- {a.msg}\n"
    if a.out: entry += f"- rezultat: `{a.out}`\n"
    entry += "\n"
    append(day_file(root, now.date()), entry)
    if a.proj:
        pl = (root / a.proj) / "LOG.md"
        if not pl.exists(): pl.parent.mkdir(parents=True, exist_ok=True); pl.write_text(f"# LOG — {a.proj}\n\n", encoding="utf-8")
        append(pl, f"- {now:%Y-%m-%d %H:%M} — {a.msg}" + (f" → `{a.out}`" if a.out else "") + "\n")
    prepend_index(root, f"- {now:%Y-%m-%d %H:%M} — [{a.kje}] — {proj} — {title}" + (f" → {a.out}" if a.out else ""))
    print("logged →", day_file(root, now.date()))

if __name__ == "__main__":
    main()
