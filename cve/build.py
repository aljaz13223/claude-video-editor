"""Build HyperFrames compositions for every short in every chosen style (see styles/), in 9:16 and, when the style
supports it, 4:5 (1080x1350) for Instagram / Facebook feeds (they crop 9:16 to 4:5 and hide titles and logos).
Layout:  build/<id>/timeline.json   build/<id>/<style>/index.html   build/<id>/<style>@4x5/index.html"""
import difflib, glob, json, os, re, shutil, subprocess
from .project import ROOT, TEMPLATES, fill, ffmpeg, hf_project_files
from .styles import load_style


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
    h = fill(open(tpl_name, encoding="utf-8").read(), P.vars())
    h = h.replace("__TOTAL__", str(D["total"])).replace("__VEND__", str(D["vend"])).replace("__DATA__", json.dumps(D, ensure_ascii=False))
    h = h.replace("__H1__", D["hook"][0]).replace("__H2__", D["hook"][1] if len(D["hook"]) > 1 else "")
    if extra: h = extra(h)
    local = os.path.join(ROOT, "vendor", "gsap.min.js")   # optional offline copy (see README)
    if os.path.exists(local):
        shutil.copy(local, dst + "/assets/gsap.min.js")
        h = re.sub(r'https://cdn\.jsdelivr\.net/npm/gsap@[\d.]+/dist/gsap\.min\.js', "assets/gsap.min.js", h)
    open(dst + "/index.html", "w", encoding="utf-8").write(h)


def to45(h, css_path):
    css = open(css_path, encoding="utf-8").read()
    h = h.replace('content="width=1080, height=1920"', 'content="width=1080, height=1350"').replace('data-height="1920"', 'data-height="1350"')
    return h.replace("</head>", "<style>\n" + css + "\n</style>\n</head>", 1)


def short_styles(P, s):
    """Styles for a short: shorts.json "styles", else legacy "variants" (A/B), else project default."""
    if s.get("styles"): return s["styles"]
    if s.get("variants"):
        m = {"A": "clean-podcast", "B": "cinema-bars-fullframe" if s.get("bfull") else "cinema-bars"}
        return [m[v] for v in s["variants"] if v in m]
    return P.cfg.get("styles", ["clean-podcast"])


def run(P, ids=(), formats=("9x16", "4x5"), reuse_video=False, only_styles=()):
    for s in P.select(ids):
        D = timeline(P, s); sid = s["id"]; base = P.p("build", sid); os.makedirs(base, exist_ok=True)
        json.dump(D, open(base + "/timeline.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        made = []
        for st_id in short_styles(P, s):
            if only_styles and st_id not in only_styles: continue
            st = load_style(st_id); v = st["video"]
            out = os.path.join(base, st_id); os.makedirs(out + "/assets", exist_ok=True)
            if not (reuse_video and os.path.exists(out + "/assets/aroll.mp4")):
                inp = []
                for g in D["segs"]:
                    c = P.p("seg", f"{sid}_{g['i']}_c.mp4")
                    if v.get("face_track") and v["crop_w"] == 576 and os.path.exists(c): inp.append((c, "0"))
                    else: inp.append((P.p("seg", f"{sid}_{g['i']}.mp4"), xexpr(s, g["i"], v["crop_w"] // 2, 1280 - v["crop_w"])))
                vf = f"crop={v['crop_w']}:720:x='{{x0}}':y=0,scale={v['out_w']}:{v['out_h']}:flags=lanczos," + v.get("grade", "null")
                concat(P, inp, vf, out + "/assets/aroll.mp4")
            Dv = dict(D, **st.get("flags", {}))
            if st.get("flags", {}).get("depth"):   # text behind the speaker: person matte + head track
                tj = out + "/assets/track.json"
                if not (reuse_video and os.path.exists(tj) and os.path.exists(out + "/assets/person.webm")):
                    from . import matte
                    matte.make(out + "/assets")
                Dv["track"] = json.load(open(tj))
            tpl = os.path.join(st["_dir"], st["template"]) if os.path.exists(os.path.join(st["_dir"], st["template"])) else os.path.join(TEMPLATES, st["template"])
            if "9x16" in formats: write(P, out, tpl, Dv); made.append(st_id)
            if "4x5" in formats and st.get("format_4x5"):
                o45 = out + "@4x5"; css = os.path.join(st["_dir"], st["format_4x5"]) if os.path.exists(os.path.join(st["_dir"], st["format_4x5"])) else os.path.join(TEMPLATES, st["format_4x5"])
                write(P, o45, tpl, Dv, lambda h, c=css: to45(h, c)); _copy_assets(out, o45); made.append(st_id + "@4x5")
        print(sid, "built", f"{D['total']}s", "->", ", ".join(made), "| graphics:", [g["title"] for g in D["gfx"]], flush=True)


def _copy_assets(src, dst):
    os.makedirs(dst + "/assets", exist_ok=True)
    for a in glob.glob(src + "/assets/*"):
        if os.path.basename(a) != "logo.svg": shutil.copy(a, dst + "/assets/")
