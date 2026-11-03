#!/usr/bin/env python3
"""Copy the generic, sellable parts of a video workspace into a git repo, scan them, commit and push.

Only paths listed in sync.json are copied (whitelist). Every copied text file is scanned for
  * secrets (API keys, tokens, passwords)
  * words from a private blocklist (client names, guests, phone numbers) — the blocklist file
    lives only in the workspace and is never copied.
If anything is found, nothing is committed.

  python sync.py                 # copy + scan + commit + push
  python sync.py --dry           # copy + scan, show what would change, no commit
  python sync.py --no-push       # commit locally only

sync.json (next to this script, or $CVE_SYNC):
{
  "workspace": "F:/claude system",
  "repo": "F:/claude system/_github/claude-video-editor",
  "remote": "https://github.com/<user>/<repo>.git",
  "branch": "main",
  "blocklist": "00-SISTEM/github-blocklist.txt",
  "map": { "skills/moji-skilli/motion-workflow": "skills/motion-workflow", "00-SISTEM/scripts/log.py": "tools/log.py" },
  "exclude": ["*.mp4", "*.mov", "*.wav", "*.mp3", "*.png", "*.jpg", "__pycache__", ".env", "*.log"]
}
"""
import argparse, datetime as dt, fnmatch, json, os, re, shutil, subprocess, sys
from pathlib import Path

SECRET = re.compile(r"(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|"
                    r"xox[abp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|(?i:(api[_-]?key|secret|password|token)\s*[=:]\s*['\"][^'\"]{8,}))")
TEXT = {".md", ".py", ".js", ".mjs", ".ts", ".json", ".html", ".css", ".txt", ".ps1", ".bat", ".sh", ".yml", ".yaml", ".toml"}

def git(repo, *args, check=True):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if check and r.returncode: sys.exit(f"git {' '.join(args)} failed:\n{r.stderr}")
    return r.stdout.strip()

def excluded(p, pats):
    return any(fnmatch.fnmatch(p.name, x) or x in p.parts for x in pats)

def main():
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
    ap = argparse.ArgumentParser(); ap.add_argument("--dry", action="store_true"); ap.add_argument("--no-push", action="store_true")
    ap.add_argument("-m", "--message"); a = ap.parse_args()
    cfgp = Path(os.environ.get("CVE_SYNC", Path(__file__).with_name("sync.json")))
    cfg = json.loads(cfgp.read_text(encoding="utf-8"))
    ws, repo = Path(cfg["workspace"]), Path(cfg["repo"])
    if not (repo / ".git").exists():
        repo.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", cfg["remote"], str(repo)], check=True)
    git(repo, "checkout", cfg.get("branch", "main"))
    git(repo, "pull", "--ff-only", check=False)

    block = []
    bl = ws / cfg.get("blocklist", "00-SISTEM/github-blocklist.txt")
    if bl.exists():
        block = [w.strip() for w in bl.read_text(encoding="utf-8").splitlines() if w.strip() and not w.startswith("#")]

    copied, problems = [], []
    for src, dst in cfg["map"].items():
        s, d = ws / src, repo / dst
        files = [s] if s.is_file() else [f for f in s.rglob("*") if f.is_file()]
        for f in files:
            rel = f.relative_to(s) if s.is_dir() else Path(f.name)
            if excluded(rel if s.is_dir() else f, cfg.get("exclude", [])): continue
            out = d / rel if s.is_dir() else d
            if f.suffix.lower() in TEXT:
                txt = f.read_text(encoding="utf-8", errors="ignore")
                for m in SECRET.finditer(txt): problems.append(f"SECRET  {src}/{rel}: {m.group(0)[:12]}…")
                for w in block:
                    if re.search(r"(?<!\w)" + re.escape(w) + r"(?!\w)", txt, re.I): problems.append(f"PRIVATE {src}/{rel}: '{w}'")
            copied.append((f, out))

    if problems:
        print("STOP — fix these first (nothing copied, nothing committed):"); print("\n".join(sorted(set(problems)))); sys.exit(2)
    for f, out in copied:
        out.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, out)
    git(repo, "add", "-A")
    status = git(repo, "status", "--short")
    print(f"copied {len(copied)} files"); print(status or "no changes")
    if a.dry or not status: return
    msg = a.message or f"sync {dt.datetime.now():%Y-%m-%d %H:%M}"
    git(repo, "commit", "-m", msg)
    if not a.no_push:
        r = subprocess.run(["git", "-C", str(repo), "push"], capture_output=True, text=True)
        print(r.stdout or r.stderr)
        if r.returncode: print("push failed — run `gh auth login` once on this computer, then rerun.")

if __name__ == "__main__":
    main()
