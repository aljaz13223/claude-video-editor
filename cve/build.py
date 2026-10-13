"""Build HyperFrames compositions for every short:
  A   = classic 9:16 (hook title, 4:5 face-tracked panel, karaoke captions, cards, brand strip, end card)
  B   = cinematic 9:16 (black bars, one-line title with accent words, 4:3 video, white captions, name under video,
        optional full-frame graphics over a blurred video when the short has "bfull": true)
  45  = 4:5 (1080x1350) feed versions of A and B for Instagram / Facebook (they crop 9:16 to 4:5 in the feed)
Outputs build/<id>, build_b/<id>, build_45a/<id>, build_45b/<id> with index.html + assets/."""
import difflib, glob, json, os, re, shutil, subprocess
from .project import ROOT, TEMPLATES, fill, ffmpeg, hf_project_files


def norm(t): return re.sub(r"[^\w]", "", t.lower())


def align(ws, text, off, A):
    """Map the corrected caption text onto transcript word timings; interpolate words the ASR missed."""
    toks = text.split(); o = [norm(w["text"]) for w in ws]; c = [norm(t) for t in toks]
    sm = difflib.SequenceMatcher(None, o, c, autojunk=False); tm = [None] * len(toks)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size): tm[blk.b + k] = (ws[blk.a + k]["start"], ws[blk.a + k]["end"])
    s0, e0 = ws[0]["start"], ws[-1]["end"]
    for i in range(len(toks)):
        if tm[i] is None:
            pv = next((tm[j][1] for j in range(i - 1, -1, -1) if tm[j]), s0)
            nx = next((tm[j][0] for j in range(i + 1, len(toks)) if tm[j]), e0)
            k0 = k1 = i
            while k0 > 0 and tm[k0 - 1] is None: k0 -= 1
            while k1 < len(toks) - 1 and tm[k1 + 1] is None: k1 += 1
            n = k1 - k0 + 1; d = (nx - pv) / max(n, 1)
            for j in range(k0, k1 + 1): tm[j] = (pv + d * (j - k0), pv + d * (j - k0 + 1))
    return [{"t": t, "s": round(a - A + off, 3), "e": round(b - A + off, 3)} for t, (a, b) in zip(toks, tm)]


def timeline(P, s):
    host, hrole = P.cfg.get("host", ""), P.cfg.get("host_role", "host")
    segs, words, off = [], [], 0.0
    for i, g in enumerate(s["segs"]):
        m = s["meta"][str(i)]; d = m["B"] - m["A"]
        W = json.load(open(P.words_file(g[0]), encoding="utf-8"))
        ws = [w for w in W if m["A"] - 0.02 <= w["start"] < m["B"] - 0.05]
        txt = s.get("txt", [None] * len(s["segs"]))[i] or " ".join(w["text"].strip() for w in ws)
        words += align(ws, txt, off, m["A"])
        who = g[3] if len(g) > 3 else s.get("who", ""); role = g[4] if len(g) > 4 else s.get("role", "")
        if not s.get("comp") and len(s["segs"]) > 1 and i == 0 and host and len(g) <= 3:
            who, role = host, hrole            # single-guest short that opens with the host's question
        segs.append({"i": i, "start": round(off, 3), "dur": round(d, 3), "who": who, "role": role, "cx": s["cx"][i]})
        off += d
    gfx = []
    for trig, title, sub in s.get("gfx", []):
        hit = next((w for w in words if norm(w["t"]).startswith(norm(trig))), None)
        if hit: gfx.append({"t": round(hit["s"], 2), "title": title, "sub": sub})
        else: print(f"  ! graphic trigger '{trig}' not found in {s['id']}")
    return {"total": round(off + P.cfg["end_card_seconds"], 3), "vend": round(off, 3), "segs": segs, "words": words,
            "gfx": gfx, "hook": s.get("hook", ["", ""]), "comp": bool(s.get("comp")), "host": host,
            "btitle": s.get("btitle", ""), "bfull": bool(s.get("bfull"))}


def concat(P, inputs, vf, out):
    ins, fc = [], ""
    for k, (src, x0) in enumerate(inputs):
        ins += ["-i", src]
        fc += f"[{k}:v]{vf.format(x0=x0)},setsar=1,fps=30[v{k}];[{k}:a]anull[a{k}];"
    fc += "".join(f"[v{k}][a{k}]" for k in range(len(inputs))) + f"concat=n={len(inputs)}:v=1:a=1[v][a]"
    subprocess.run([ffmpeg(), "-nostdin", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out], check=True)


def xexpr(s, i, half, maxx):
    x0 = str(int(min(max(s["cx"][i] - half, 0), maxx)))
    for t0, t1, cx in reversed(s.get("cxs", {}).get(str(i), [])):
        x0 = f"if(between(t,{t0},{t1}),{int(min(max(cx - half, 0), maxx))},{x0})"
    return x0


def write(P, dst, tpl_name, D, extra=None):
    os.makedirs(dst + "/assets", exist_ok=True); hf_project_files(dst, os.path.basename(dst))
    shutil.copy(P.logo_path(), dst + "/assets/logo.svg")
    h = fill(open(os.path.join(TEMPLATES, tpl_name), encoding="utf-8").read(), P.vars())
    h = h.replace("__TOTAL__", str(D["total"])).replace("__VEND__", str(D["vend"])).replace("__DATA__", json.dumps(D, ensure_ascii=False))
    h = h.replace("__H1__", D["hook"][0]).replace("__H2__", D["hook"][1] if len(D["hook"]) > 1 else "")
    if extra: h = extra(h)
    local = os.path.join(ROOT, "vendor", "gsap.min.js")   # optional offline copy (see README)
    if os.path.exists(local):
        shutil.copy(local, dst + "/assets/gsap.min.js")
        h = re.sub(r'https://cdn\.jsdelivr\.net/npm/gsap@[\d.]+/dist/gsap\.min\.js', "assets/gsap.min.js", h)
    open(dst + "/index.html", "w", encoding="utf-8").write(h)


def to45(h, css_file):
    css = open(os.path.join(TEMPLATES, css_file), encoding="utf-8").read()
    h = h.replace('content="width=1080, height=1920"', 'content="width=1080, height=1350"').replace('data-height="1920"', 'data-height="1350"')
    return h.replace("</head>", "<style>\n" + css + "\n</style>\n</head>", 1)


def run(P, ids=(), variants=("A", "B", "45"), reuse_video=False):
    for s in P.select(ids):
        D = timeline(P, s); sid = s["id"]
        A = P.p("build", sid); os.makedirs(A + "/assets", exist_ok=True)
        json.dump(D, open(A + "/timeline.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        want_b = "B" in variants and s.get("variants", ["A", "B"]).count("B")
        # A: face-tracked 4:5 panel (seg/<id>_<i>_c.mp4 from `cve crop`, else static crop at cx)
        if not (reuse_video and os.path.exists(A + "/assets/aroll.mp4")):
            inp = []
            for g in D["segs"]:
                c = P.p("seg", f"{sid}_{g['i']}_c.mp4")
                inp.append((c, "0") if os.path.exists(c) else (P.p("seg", f"{sid}_{g['i']}.mp4"), xexpr(s, g["i"], 288, 704)))
            concat(P, inp, "crop=576:720:x='{x0}':y=0,scale=1080:1350:flags=lanczos,eq=contrast=1.04:saturation=1.06", A + "/assets/aroll.mp4")
        write(P, A, "short_a.html", D)
        if "45" in variants: write(P, P.p("build_45a", sid), "short_a.html", D, lambda h: to45(h, "fmt45_a.css")); _copy_assets(A, P.p("build_45a", sid))
        if want_b:
            B = P.p("build_b", sid); os.makedirs(B + "/assets", exist_ok=True)
            if not (reuse_video and os.path.exists(B + "/assets/aroll.mp4")):
                inp = [(P.p("seg", f"{sid}_{g['i']}.mp4"), xexpr(s, g["i"], 480, 320)) for g in D["segs"]]
                concat(P, inp, "crop=960:720:x='{x0}':y=0,scale=1080:810:flags=lanczos,eq=contrast=1.06:saturation=1.04:brightness=-0.01", B + "/assets/aroll.mp4")
            write(P, B, "short_b.html", D)
            if "45" in variants: write(P, P.p("build_45b", sid), "short_b.html", D, lambda h: to45(h, "fmt45_b.css")); _copy_assets(B, P.p("build_45b", sid))
        print(sid, "built", f"{D['total']}s", "graphics:", [g["title"] for g in D["gfx"]], flush=True)


def _copy_assets(src, dst):
    os.makedirs(dst + "/assets", exist_ok=True)
    for a in glob.glob(src + "/assets/*"):
        if os.path.basename(a) != "logo.svg": shutil.copy(a, dst + "/assets/")
