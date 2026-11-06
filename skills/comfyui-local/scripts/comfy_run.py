#!/usr/bin/env python3
"""Run a ComfyUI workflow (API format JSON) on the local ComfyUI server and save the outputs.

  python comfy_run.py workflow_api.json --out outdir [--set 6.text="a red car at sunset"] [--set 3.seed=42] [--host 127.0.0.1:8188]

--set NODE_ID.INPUT=VALUE overrides an input of a node (numbers are parsed, everything else is text).
Export a workflow in ComfyUI with  Workflow > Export (API).  No credits: everything runs on the local GPU.
"""
import argparse, json, os, time, urllib.parse, urllib.request, uuid

def call(host, path, data=None):
    req = urllib.request.Request(f"http://{host}{path}", data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("workflow"); ap.add_argument("--out", default="comfy_out")
    ap.add_argument("--set", action="append", default=[]); ap.add_argument("--host", default="127.0.0.1:8188")
    ap.add_argument("--timeout", type=int, default=1800)
    a = ap.parse_args()
    wf = json.load(open(a.workflow, encoding="utf-8"))
    for s in a.set:
        key, val = s.split("=", 1); node, inp = key.split(".", 1)
        try: val = json.loads(val)
        except Exception: pass
        wf[node]["inputs"][inp] = val
    cid = str(uuid.uuid4())
    pid = call(a.host, "/prompt", {"prompt": wf, "client_id": cid})["prompt_id"]
    print("queued", pid)
    t0 = time.time()
    while time.time() - t0 < a.timeout:
        h = call(a.host, f"/history/{pid}")
        if pid in h:
            os.makedirs(a.out, exist_ok=True); n = 0
            for node_out in h[pid]["outputs"].values():
                for kind in ("images", "gifs", "videos", "audio"):
                    for f in node_out.get(kind, []):
                        q = urllib.parse.urlencode({"filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": f.get("type", "output")})
                        data = urllib.request.urlopen(f"http://{a.host}/view?{q}", timeout=120).read()
                        open(os.path.join(a.out, f["filename"]), "wb").write(data); n += 1
            print(f"done in {time.time() - t0:.0f}s, {n} file(s) -> {a.out}"); return
        time.sleep(2)
    raise SystemExit("timeout")

if __name__ == "__main__":
    main()
