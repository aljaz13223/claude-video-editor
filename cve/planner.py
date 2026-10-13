"""Scene planner: words.json -> planner.html. Top: accent colour, two fonts, text colours. Each script line gets a scene
type (captions / captions + UI / half screen / full screen), a note of what appears on screen and an accent word.
"Save plan.json" downloads the plan Claude builds from.   cve plan <words.json> [--title "Video name"]"""
import json, html, re


def run(src, out, title="Edit plan"):
    W = json.load(open(src, encoding="utf-8"))
    if isinstance(W, dict): W = W.get("words") or W.get("segments") or []

    lines, cur = [], []
    for w in W:
        cur.append(w)
        txt = w["text"].strip()
        if re.search(r"[.!?…]$", txt) or (len(cur) >= 16 and re.search(r"[,;:]$", txt)) or len(cur) >= 22:
            lines.append(cur); cur = []
    if cur: lines.append(cur)
    rows = [{"i": n, "start": round(l[0]["start"], 2), "end": round(l[-1]["end"], 2),
             "text": " ".join(x["text"].strip() for x in l)} for n, l in enumerate(lines)]

    page = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>__TITLE__</title>
    <style>
    :root{--bg:#f6f5f2;--card:#fff;--ink:#1d1d1f;--mut:#6b6b70;--line:#e3e1dc;--acc:#3a6ea5}
    @media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1d1d20;--ink:#ececee;--mut:#9a9aa2;--line:#2c2c31}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
    header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
    h1{font-size:18px;margin:0 12px 0 0}
    label{font-size:12px;color:var(--mut);display:flex;flex-direction:column;gap:3px}
    input,select,textarea{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 8px}
    input[type=color]{padding:2px;width:48px;height:34px}
    button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:9px 14px;background:var(--acc);color:#fff;cursor:pointer}
    button.sec{background:transparent;color:var(--ink);border:1px solid var(--line)}
    main{max-width:1200px;margin:0 auto;padding:16px 20px 80px}
    .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}
    .t{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
    .txt{font-size:16px;margin-top:4px}
    .ctl{display:flex;flex-direction:column;gap:8px}
    .types{display:flex;gap:6px;flex-wrap:wrap}
    .types button{background:transparent;color:var(--ink);border:1px solid var(--line);font-weight:500;padding:6px 10px;font-size:13px}
    .types button.on{background:var(--acc);border-color:var(--acc);color:#fff}
    textarea{min-height:58px;resize:vertical;width:100%}
    .legend{font-size:13px;color:var(--mut);margin:4px 0 14px}
    .stat{margin-left:auto;font-size:13px;color:var(--mut)}
    @media (max-width:760px){.row{grid-template-columns:1fr}header{position:static}}
    </style></head><body>
    <header>
    <h1>__TITLE__</h1>
    <label>Accent colour<input type="color" id="acc" value="#3a6ea5"></label>
    <label>Main font<select id="f1"><option>Montserrat</option><option>Inter</option><option>Poppins</option><option>DM Sans</option><option>Manrope</option></select></label>
    <label>Special-word font<select id="f2"><option>Instrument Serif Italic</option><option>Playfair Display Italic</option><option>Caveat</option><option>Dancing Script</option></select></label>
    <label>Text colour<input type="color" id="c1" value="#ffffff"></label>
    <label>Accent text colour<input type="color" id="c2" value="#3a6ea5"></label>
    <span class="stat" id="stat"></span>
    <button class="sec" id="copy">Copy</button><button id="save">Save plan.json</button>
    </header>
    <main>
    <p class="legend"><b>Captions</b> = speaker + captions · <b>Captions + UI</b> = small animation in the lower half, background dims and blurs · <b>Half screen</b> = animation on top, speaker below · <b>Full screen</b> = animation takes over. Save full screen for the biggest moments.</p>
    <div id="rows"></div>
    </main>
    <script>
    const ROWS=__ROWS__;
    const TYPES=[["captions","Captions"],["captions_ui","Captions + UI"],["half","Half screen"],["full","Full screen"]];
    const KEY="cve-planner:"+document.title;
    let st={}; try{st=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
    const plan=st.rows||ROWS.map(r=>({type:"captions",note:"",accent:""}));
    const $=id=>document.getElementById(id);
    ["acc","f1","f2","c1","c2"].forEach(k=>{if(st[k])$(k).value=st[k];$(k).oninput=()=>{if(k==="acc")document.documentElement.style.setProperty("--acc",$(k).value);persist()}});
    document.documentElement.style.setProperty("--acc",$("acc").value);
    const fmt=s=>{const m=Math.floor(s/60);return m+":"+(s%60).toFixed(1).padStart(4,"0")};
    const box=$("rows");
    ROWS.forEach((r,i)=>{
      const d=document.createElement("div");d.className="row";
      d.innerHTML=`<div><div class="t">#${i+1} · ${fmt(r.start)}–${fmt(r.end)}</div><div class="txt"></div></div>
      <div class="ctl"><div class="types"></div><textarea placeholder="What appears on screen (animation, UI, zoom, asset …)"></textarea>
      <input placeholder="Accent word(s) for the caption">`;
      d.querySelector(".txt").textContent=r.text;
      const tb=d.querySelector(".types");
      TYPES.forEach(([v,l])=>{const b=document.createElement("button");b.textContent=l;b.className=plan[i].type===v?"on":"";
        b.onclick=()=>{plan[i].type=v;[...tb.children].forEach(x=>x.className="");b.className="on";persist()};tb.appendChild(b)});
      const ta=d.querySelector("textarea"),ip=d.querySelector("input");ta.value=plan[i].note;ip.value=plan[i].accent;
      ta.oninput=()=>{plan[i].note=ta.value;persist()};ip.oninput=()=>{plan[i].accent=ip.value;persist()};
      box.appendChild(d)});
    function data(){return{title:document.title,style:{accent:$("acc").value,font_main:$("f1").value,font_special:$("f2").value,color_text:$("c1").value,color_accent:$("c2").value},
      lines:ROWS.map((r,i)=>({...r,...plan[i]}))}}
    function persist(){const c={};TYPES.forEach(([v])=>c[v]=plan.filter(p=>p.type===v).length);
      $("stat").textContent=`${c.captions} captions · ${c.captions_ui} UI · ${c.half} half · ${c.full} full`;
      try{localStorage.setItem(KEY,JSON.stringify({rows:plan,acc:$("acc").value,f1:$("f1").value,f2:$("f2").value,c1:$("c1").value,c2:$("c2").value}))}catch(e){}}
    persist();
    $("save").onclick=()=>{const b=new Blob([JSON.stringify(data(),null,1)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="plan.json";a.click()};
    $("copy").onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(data(),null,1));$("copy").textContent="Copied"}catch(e){$("copy").textContent="Failed"}setTimeout(()=>$("copy").textContent="Copy",1500)};
    </script></body></html>"""
    page = page.replace("__TITLE__", html.escape(title)).replace("__ROWS__", json.dumps(rows, ensure_ascii=False))
    open(out, "w", encoding="utf-8").write(page)
    print(f"{len(rows)} lines -> {out}")
    return out
