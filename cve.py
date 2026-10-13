#!/usr/bin/env python3
"""claude-video-editor CLI.

  python cve.py init <project>                 create a project folder with example config
  python cve.py transcribe <project> [--all | file ...] [--lang en]
  python cve.py cut|crop|build|music|render <project> [--ids s01,s02]
  python cve.py all <project> [--ids ...]      cut -> crop -> build -> music -> render -> timeline
  python cve.py verify <project>               re-transcribe cut clips and diff against captions
  python cve.py timeline|sheet <project>       review page / contact sheets
  python cve.py plan <words.json> <out.html>   scene planner for a talking-head reel
  python cve.py styles                         list edit styles
  python cve.py gallery [out.html]             style picker page with reference images
"""
import argparse, glob, json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cve.project import Project, ROOT


def ids_of(a): return [x for x in (a.ids or "").split(",") if x]


def cmd_init(a):
    d = os.path.abspath(a.project); os.makedirs(d, exist_ok=True)
    for sub in ("raw", "transcripts", "music", "final"): os.makedirs(os.path.join(d, sub), exist_ok=True)
    for f, dst in (("project.example.json", "project.json"), ("shorts.example.json", "shorts.json")):
        if not os.path.exists(os.path.join(d, dst)): shutil.copy(os.path.join(ROOT, "examples", f), os.path.join(d, dst))
    print("project ready:", d, "\n  1) put episodes in raw/  2) cve transcribe --all  3) edit shorts.json  4) cve all")


def cmd_transcribe(a):
    from cve.transcribe import transcribe
    P = Project(a.project)
    files = sorted(glob.glob(os.path.join(P.p(P.cfg["raw_dir"]), "*.mp4"))) if a.all else a.files
    for f in files:
        base = os.path.splitext(os.path.basename(f))[0]
        if os.path.exists(os.path.join(P.p(P.cfg["transcripts_dir"]), base + ".words.json")) and not a.force:
            print("skip (exists):", base); continue
        transcribe(f, P.p(P.cfg["transcripts_dir"]), a.lang or P.cfg["language"], a.model, batch=a.batch)


def cmd_verify(a):
    import difflib, re
    from cve.transcribe import check_clips
    P = Project(a.project); out = P.p("qa", "asr.txt"); os.makedirs(P.p("qa"), exist_ok=True)
    check_clips(P.p("seg"), out, P.cfg["language"])
    A = {}
    for l in open(out, encoding="utf-8"):
        n, w = l.split(" | ", 1); A[n.replace(".mp4", "")] = " ".join(re.sub(r"@[\d.]+-[\d.]+$", "", x) for x in w.split())
    norm = lambda t: [re.sub(r"[^\w]", "", x.lower()) for x in t.split()]
    for s in P.select(ids_of(a)):
        for i, t in enumerate(s.get("txt", [])):
            k = f"{s['id']}_{i}"; r = difflib.SequenceMatcher(None, norm(t), norm(A.get(k, ""))).ratio()
            print(f"[{'OK   ' if r > 0.93 else 'CHECK'}] {k} match {r:.2f}\n   CAPTION: {t}\n   ASR    : {A.get(k, '')}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    for c in ("init", "cut", "crop", "build", "music", "render", "all", "verify", "timeline", "sheet"):
        p = sp.add_parser(c); p.add_argument("project"); p.add_argument("--ids", default="")
        if c == "cut": p.add_argument("--force", action="store_true")
        if c in ("build", "all", "render"): p.add_argument("--styles", default="", help="only these style ids"); p.add_argument("--formats", default="9x16,4x5")
        if c in ("build", "all"): p.add_argument("--reuse-video", action="store_true")
    p = sp.add_parser("transcribe"); p.add_argument("project"); p.add_argument("files", nargs="*"); p.add_argument("--all", action="store_true")
    p.add_argument("--lang", default=None); p.add_argument("--model", default="large-v3"); p.add_argument("--batch", type=int, default=0); p.add_argument("--force", action="store_true")
    sp.add_parser("styles"); p = sp.add_parser("gallery"); p.add_argument("out", nargs="?", default="styles.html")
    p = sp.add_parser("plan"); p.add_argument("words"); p.add_argument("out"); p.add_argument("--title", default="Edit plan")
    a = ap.parse_args()
    if a.cmd == "init": return cmd_init(a)
    if a.cmd == "transcribe": return cmd_transcribe(a)
    if a.cmd == "plan":
        from cve.planner import run; return run(a.words, a.out, a.title)
    from cve import styles as S
    if a.cmd == "styles": return S.print_styles()
    if a.cmd == "gallery": return S.gallery(a.out)
    if a.cmd == "verify": return cmd_verify(a)
    P = Project(a.project); ids = ids_of(a); S.add_search_path(P.p("styles"))
    sts = [x for x in getattr(a, "styles", "").split(",") if x]; fmts = getattr(a, "formats", "9x16,4x5").split(",")
    from cve import cut, crop, build, music, render, review
    if a.cmd in ("cut", "all"): cut.run(P, ids, getattr(a, "force", False))
    if a.cmd in ("crop", "all"): crop.run(P, ids)
    if a.cmd in ("build", "all"): build.run(P, ids, fmts, a.reuse_video, sts)
    if a.cmd in ("music", "all"): music.run(P, ids)
    if a.cmd in ("render", "all"): render.run(P, ids, sts, fmts)
    if a.cmd in ("timeline", "all"): review.timeline(P, ids)
    if a.cmd == "sheet": review.sheet(P, ids)


if __name__ == "__main__":
    main()
