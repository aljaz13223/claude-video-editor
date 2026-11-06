---
name: comfyui-local
description: Generate images, b-roll clips, upscales and background removals locally with ComfyUI on the user's own GPU — no credits. Use when a video needs a still, an illustration, a short b-roll shot, an upscale or a cut-out and stock/own footage does not fit, or when the user says "ComfyUI", "generiraj sliko/posnetek lokalno", "brez kreditov".
---

# comfyui-local

ComfyUI runs on the user's PC (portable build, `F:\ComfyUI`), server on `127.0.0.1:8188`. Claude submits workflows
through the HTTP API with `scripts/comfy_run.py` — nothing leaves the machine and no paid credits are used.

## Start
`F:\claude system\tools\START-COMFYUI.bat` (opens the server; the browser UI at http://127.0.0.1:8188 is optional).
Check: `curl http://127.0.0.1:8188/system_stats` answers.

## Run a workflow
1. In the UI: build/load a workflow → Workflow › **Export (API)** → save to `F:\claude system\00-SISTEM\comfy-workflows\<name>.json`.
2. `python comfy_run.py <name>.json --out <project>\comfy --set 6.text="..." --set 3.seed=123`
3. Outputs land in `--out`; log the prompt + seed next to them (`prompts.txt`) so a shot can be regenerated exactly.

## What fits an 8 GB GPU (RTX 3070 Ti laptop)
| Job | Model family (pick the smallest that looks good) | Notes |
|---|---|---|
| stills / illustrations | SDXL fine-tunes (~6.5 GB), Flux schnell GGUF Q4 + fp8 text encoder | 1024 px, then upscale |
| short b-roll (2–5 s) | LTX-Video 2B, Wan 2.x 1.3B / 5B (with offload) | 480–720p, slow; render overnight for many shots |
| image → video | same video models with a start frame | camera + one movement, like the AI b-roll rules |
| upscale | Real-ESRGAN x2/x4 | for stills and b-roll |
| cut-out | RMBG / BiRefNet | logos, products, people for graphics |
Download models only after the user picks a use — each is several GB. Keep them under `F:\ComfyUI\...\models\`.

## Rules (same as for any AI media)
- Own photos/footage first, stock second, generated last. Never generated text inside images — text is always code.
- Never generate real people's faces or brand logos; no imitation of a specific artist's or brand's look.
- Every generated shot goes inside a graphic or as b-roll, never pretending to be real footage of a client's event.
- Storyboard first, then batch-generate (overnight if many); keep seeds.
