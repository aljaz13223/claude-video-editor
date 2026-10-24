// Takeframe renderer: start screen, editor UI, timeline, inspector, Claude panel, export dialog.
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (t, fps = 30) => { t = Math.max(0, t); const f = Math.floor((t % 1) * fps + 1e-6); const s = Math.floor(t) % 60, m = Math.floor(t / 60) % 60, h = Math.floor(t / 3600); return [h, m, s, f].map(x => String(x).padStart(2, '0')).join(':'); };
const fmtS = t => t < 60 ? t.toFixed(t < 10 ? 2 : 1) + 's' : Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const toast = (m, ms = 2400) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms); };
const safeName = s => String(s || 'project').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'project';
const SEP = navigator.platform.startsWith('Win') ? '\\' : '/';

let env = null, P = null, H = null, comp = null;
let sel = new Set(), T = 0, playing = false, pps = 60, tool = 'select', snapOn = true, barsOn = false, loopOn = false;
let aiBusy = false, aiMessages = [], aiTouched = new Set(), scopeMode = 'project', clipboard = null;

// =====================================================================================
// START SCREEN
// =====================================================================================
let srcItems = [], connectedFolder = null, pickedFiles = [];
const RES_PRESETS = [
  ['1080x1920', '9:16', 'Reels · TikTok · Shorts'], ['1920x1080', '16:9', 'YouTube · 1080p'], ['3840x2160', '16:9', '4K UHD'], ['1080x1080', '1:1', 'Square feed'],
  ['1080x1350', '4:5', 'Feed portrait'], ['2160x3840', '9:16', '4K vertical'], ['1280x720', '16:9', '720p · light'], ['custom', 'Custom', 'any size']];
let resSel = '1080x1920';
async function initStart() {
  env = await host.invoke('env');
  const chips = [
    [env.apiKey, 'Claude API', env.apiKey ? `${env.model}` : 'ANTHROPIC_API_KEY is not set — run SET-API-KEY.bat'],
    [env.python, 'Audio engine', env.python ? 'local: DeepFilterNet · Whisper · Demucs' : 'run INSTALL.bat'],
    [env.ffmpeg, 'FFmpeg', env.ffmpeg ? 'ok' : 'install ffmpeg (winget install Gyan.FFmpeg)'],
    [!!env.gpu, env.gpu ? env.gpu.replace('NVIDIA GeForce ', '') : 'GPU', env.gpu ? 'CUDA' : 'no NVIDIA GPU found — audio tools run on CPU'],
  ];
  $('#env').innerHTML = chips.map(([ok, n, tip]) => `<span class="chip ${ok ? 'ok' : 'bad'}" title="${esc(tip)}"><i></i>${esc(n)}</span>`).join('');
  $('#npClient').innerHTML = '<option value="">— none —</option>' + env.clients.map(c => `<option>${esc(c)}</option>`).join('');
  const rec = $('#recent');
  if (env.recent.length) {
    rec.innerHTML = '';
    for (const r of env.recent.slice(0, 8)) {
      const d = el('div', 'rec', `<b>${esc(r.name)}</b><span>${esc(r.client || '')} ${esc(r.format || '')}</span>`);
      d.onclick = () => openProjectFile(r.file); rec.appendChild(d);
    }
  }
  renderRes(); setTimeout(() => $('#btnFolder').focus(), 50);
}
function renderRes() {
  const g = $('#resGrid'); g.innerHTML = '';
  for (const [k, ar, lab] of RES_PRESETS) {
    const [w, h] = k === 'custom' ? [1, 1] : k.split('x').map(Number); const sc = 26 / Math.max(w, h);
    const b = el('button', 'res' + (k === resSel ? ' on' : ''));
    b.innerHTML = `<span class="res-ic">${k === 'custom' ? '<i class="dash"></i>' : `<i style="width:${Math.round(w * sc)}px;height:${Math.round(h * sc)}px"></i>`}</span><b>${k === 'custom' ? 'Custom' : w + ' × ' + h}</b><small>${ar} · ${lab}</small>`;
    b.onclick = () => { resSel = k; renderRes(); };
    g.appendChild(b);
  }
  $('#resCustom').classList.toggle('on', resSel === 'custom');
}
function setFolder(d) {
  connectedFolder = d; $('#folderPath').textContent = d || 'No folder selected'; $('#drop').classList.toggle('has', !!d);
  if (d) host.invoke('list-dir', d).then(l => { const f = l.filter(x => !x.isDir), dirs = l.filter(x => x.isDir); $('#folderInfo').textContent = `${f.length} media file(s)${dirs.length ? ` · ${dirs.length} subfolder(s)` : ''}${pickedFiles.length ? ` · +${pickedFiles.length} single file(s)` : ''}`; }).catch(() => {});
}
function bindStart() {
  $('#btnFolder').onclick = async () => { const d = await host.invoke('pick-folder', connectedFolder || env.root); if (d) setFolder(d); };
  $('#btnFiles').onclick = async e => { e.preventDefault(); const f = await host.invoke('pick-files'); if (f.length) { pickedFiles = [...new Set([...pickedFiles, ...f])]; setFolder(connectedFolder); if (!connectedFolder) { $('#folderPath').textContent = `${pickedFiles.length} file(s) selected`; $('#drop').classList.add('has'); } } };
  const drop = $('#drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = async e => {
    e.preventDefault(); drop.classList.remove('over'); const paths = [...e.dataTransfer.files].map(f => host.pathOf(f)).filter(Boolean);
    for (const p of paths) { const l = await host.invoke('list-dir', p).catch(() => null); if (l) { setFolder(p); } else pickedFiles.push(p); }
    if (!connectedFolder && pickedFiles.length) { $('#folderPath').textContent = `${pickedFiles.length} file(s) selected`; $('#drop').classList.add('has'); }
  };
  $('#resW').onchange = $('#resH').onchange = () => { resSel = 'custom'; renderRes(); };
  $('#btnEmpty').onclick = () => createProject(false);
  $('#btnCreate').onclick = () => createProject(true);
  $('#btnOpen').onclick = () => openProjectFile(null);
  $('#btnDemo').onclick = () => openProjectFile(env.root + SEP + 'takeframe-projects' + SEP + 'Takeframe Launch' + SEP + 'project.takeframe.json');
  document.addEventListener('keydown', e => { if (!$('#start').classList.contains('hidden') && e.key === 'Enter' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); createProject(false); } });
}
async function createProject(withClaude) {
  const [w, h] = resSel === 'custom' ? [+$('#resW').value || 1080, +$('#resH').value || 1920] : resSel.split('x').map(Number);
  const base = connectedFolder ? connectedFolder.split(/[\\/]/).filter(Boolean).pop() : '';
  const name = $('#npName').value.trim() || base || 'Untitled ' + new Date().toISOString().slice(5, 16).replace('T', ' ');
  const client = $('#npClient').value;
  const p = TF.newProject({ name, client, w, h, fps: +$('#npFps').value, duration: withClaude ? (+$('#npDur').value || 30) : 30, autoDuration: !withClaude });
  const date = new Date().toISOString().slice(0, 10);
  p.folder = client ? [env.root, client, '02-projekti', `${date}_${safeName(name)}`].join(SEP) : [env.root, 'takeframe-projects', safeName(name)].join(SEP);
  p.sourceFolder = connectedFolder;
  toast(withClaude ? 'Reading your files for Claude…' : 'Opening…');
  const files = [...pickedFiles]; const args = { files };
  if (withClaude && connectedFolder) args.folder = connectedFolder;
  p.media = (files.length || args.folder) ? (await host.invoke('scan', args)).map(m => Object.assign({ id: TF.uid('m') }, m)) : [];
  const prompt = $('#npPrompt').value.trim(); pickedFiles = [];
  enterEditor(p);
  if (!withClaude) return;
  if (!env.apiKey) { toast('Set ANTHROPIC_API_KEY first (SET-API-KEY.bat).', 5000); return; }
  const list = p.media.map(m => `- ${m.id}: ${m.name} (${m.type}${m.duration ? ', ' + m.duration.toFixed(1) + ' s' : ''})`).join('\n');
  const ask = (prompt || `Make a ${p.duration} s ${p.w}×${p.h} video from these files.`) +
    `\n\nThe bin has ${p.media.length} file(s):\n${list || '(none — create everything with graphics and generated music)'}` +
    `\n\nBuild the complete edit now: pick the right files, plan a storyboard, generate new music, add graphics, transitions and SFX, then check rendered frames and fix problems.`;
  switchTab('right', 'claude'); runAI(ask, null);
}
async function openProjectFile(file) {
  const p = await host.invoke('project-open', file).catch(e => { toast('Cannot open: ' + e.message); return null; });
  if (p) enterEditor(p);
}

// =====================================================================================
// EDITOR
// =====================================================================================
function enterEditor(p) {
  P = p; for (const c of P.clips) TF.normClip(c);
  H = new TF.History(P); H.on(onChange);
  sel = new Set(); T = 0; aiMessages = [];
  $('#start').classList.add('hidden'); $('#editor').classList.remove('hidden');
  comp = new TF.Compositor($('#stage'), m => m ? m.url : '');
  $('#stage').innerHTML = '';
  $('#pName').value = P.name; updateMeta();
  renderAll(); fitStage(); save();
  if (P.sourceFolder) { switchTab('left', 'folder'); openFolderPanel(P.sourceFolder); } else { switchTab('left', P.media.length ? 'media' : 'folder'); renderFolder(); }
  $('#chatLog').innerHTML = ''; chatMsg('ai', `Project “${P.name}” — ${P.format}, ${P.duration}s. Tell me what to make, or select a clip on the timeline and ask me to change only that part.`);
}
function updateMeta() { const d = TF.projectDuration(P); $('#pMeta').textContent = `${P.w}×${P.h} · ${P.format} · ${P.fps} fps · ${fmtS(d)}${P.autoDuration ? ' (auto)' : ''}${P.client ? ' · ' + P.client : ''}`; $('#tcDur').textContent = fmt(d, P.fps); }
function onChange(entry) {
  if (entry.by === 'claude') { aiTouched = new Set(entry.ids || []); }
  P = H.p; renderAll(); save(); renderHistory();
}
function renderAll() { renderBin(); renderTimeline(); renderInspector(); drawFrame(); updateMeta(); renderScope(); }
let saveT = null;
function save() { $('#saved').textContent = 'Saving…'; clearTimeout(saveT); saveT = setTimeout(async () => { try { await host.invoke('project-save', P); $('#saved').textContent = 'Saved'; } catch (e) { $('#saved').textContent = 'Save failed'; } }, 600); }
function apply(ops, label) { try { H.apply(ops, 'you', label); return true; } catch (e) { toast(e.message); return false; } }

// direct (live) edits from the inspector: mutate, redraw, then commit one undo step on change
let liveBefore = null;
function liveStart() { if (!liveBefore) liveBefore = JSON.stringify(P); }
function liveCommit(label) {
  if (!liveBefore) return; const before = liveBefore; liveBefore = null; if (before === JSON.stringify(P)) return;
  H.undo.push({ before, by: 'you', group: label, lines: [label] }); H.redo = []; H.log.push({ by: 'you', group: label, lines: [label], at: Date.now() });
  renderTimeline(); renderHistory(); save();
}

// ---------------- monitor ----------------
let drawing = false, drawAgain = false;
async function drawFrame() {
  if (!P) return;
  if (drawing) { drawAgain = true; return; } drawing = true;
  try { await comp.draw(P, T, { playing }); } catch (e) { console.error(e); }
  drawing = false; $('#tc').textContent = fmt(T, P.fps); placePlayhead();
  const L = TF.layersAt(P, T); $('#monInfo').textContent = L.length ? L.filter(l => !l.outgoing).map(l => l.clip.track).join(' · ') : '';
  if (drawAgain) { drawAgain = false; drawFrame(); }
}
function fitStage() {
  if (!P) return; const vp = $('#viewport'), w = vp.clientWidth, h = vp.clientHeight;
  const z = $('#monZoom').value; const s = z === 'fit' ? Math.min(w / P.w, h / P.h) * .94 : +z;
  const sw = $('#stageWrap'); sw.style.width = P.w + 'px'; sw.style.height = P.h + 'px';
  sw.style.transform = `scale(${s})`; sw.style.left = (w - P.w * s) / 2 + 'px'; sw.style.top = (h - P.h * s) / 2 + 'px';
}
new ResizeObserver(() => fitStage()).observe(document.getElementById('viewport'));

// ---------------- playback + audio preview ----------------
let raf = 0, t0 = 0, T0 = 0; const audioEls = new Map();
function rangeEnd() { return P.outPoint != null ? P.outPoint : P.autoDuration ? TF.projectDuration(P) : Math.max(P.duration, ...P.clips.map(TF.clipEnd), 0); }
function play() {
  if (playing) return stop();
  if (T >= rangeEnd() - 1 / P.fps) T = P.inPoint ?? 0;
  playing = true; t0 = performance.now(); T0 = T; $('#bPlay').textContent = '❚❚';
  const tick = () => {
    if (!playing) return;
    T = T0 + (performance.now() - t0) / 1000;
    if (T >= rangeEnd()) { if (loopOn) { T = P.inPoint ?? 0; t0 = performance.now(); T0 = T; } else { T = rangeEnd(); stop(); drawFrame(); return; } }
    drawFrame(); syncAudio(); follow(); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function stop() { playing = false; cancelAnimationFrame(raf); $('#bPlay').textContent = '▶'; for (const a of audioEls.values()) a.pause(); for (const v of $$('#stage video')) v.pause(); drawFrame(); }
function syncAudio() {
  const live = new Set();
  for (const c of TF.audioClips(P)) {
    if (T < c.start || T >= TF.clipEnd(c)) continue;
    const m = TF.mediaOf(P, c); if (!m) continue; live.add(c.id);
    let a = audioEls.get(c.id); const url = (m.enhancedUrl && c.useEnhanced !== false) ? m.enhancedUrl : m.url;
    if (!a || a._url !== url) { if (a) a.pause(); a = new Audio(url); a._url = url; a.preload = 'auto'; audioEls.set(c.id, a); }
    const lt = T - c.start; let g = Math.pow(10, (c.volume || 0) / 20);
    if (c.fadeIn && lt < c.fadeIn) g *= lt / c.fadeIn; if (c.fadeOut && c.dur - lt < c.fadeOut) g *= (c.dur - lt) / c.fadeOut;
    a.volume = Math.max(0, Math.min(1, g)); a.playbackRate = c.speed;
    const target = c.in + lt * c.speed;
    if (a.paused) { a.currentTime = target; a.play().catch(() => {}); } else if (Math.abs(a.currentTime - target) > .2) a.currentTime = target;
  }
  for (const [id, a] of audioEls) if (!live.has(id) && !a.paused) a.pause();
}
function seek(t) { T = Math.max(0, Math.min(t, rangeEnd() + 30)); if (playing) { t0 = performance.now(); T0 = T; syncAudio(); } drawFrame(); renderInspector(true); }
function follow() { const lw = $('#lanesWrap'); const x = T * pps; if (x > lw.scrollLeft + lw.clientWidth - 40) lw.scrollLeft = x - 80; }

// ---------------- bin ----------------
function renderBin() {
  const q = ($('#binSearch').value || '').toLowerCase(); const bin = $('#bin'); bin.innerHTML = '';
  const used = new Set(P.clips.map(c => c.media));
  for (const m of P.media) {
    if (q && !m.name.toLowerCase().includes(q)) continue;
    const d = el('div', `bi ${m.type}${used.has(m.id) ? ' used' : ''}`);
    d.innerHTML = `<div class="th" style="background-image:url('${m.thumbUrl || ''}')"></div><div class="nm" title="${esc(m.path)}">${esc(m.name)}</div>
      <div class="mt">${m.type.toUpperCase()}${m.duration ? ' · ' + fmtS(m.duration) : ''}${m.w ? ' · ' + m.w + '×' + m.h : ''}${m.enhanced ? ' · ENH' : ''}${m.transcript ? ' · TXT' : ''}</div>`;
    d.draggable = true; d.ondragstart = e => { e.dataTransfer.setData('tf/media', m.id); e.dataTransfer.effectAllowed = 'copy'; };
    d.ondblclick = () => insertMedia(m, m.type === 'audio' ? (m.music ? 'A1' : 'A2') : 'V1', T);
    bin.appendChild(d);
  }
  if (!P.media.length) bin.innerHTML = '<div class="muted" style="grid-column:1/-1;padding:20px 4px">Import files or connect a folder.</div>';
}
function insertMedia(m, track, at) {
  const dur = m.type === 'image' ? 3 : Math.max(.2, m.duration || 3);
  const clip = { track, type: m.type === 'audio' ? 'audio' : m.type, media: m.id, start: at, dur };
  if (m.music) clip.volume = -4;
  apply({ op: 'add_clip', clip }, 'Add ' + m.name);
}
async function importToBin(args) {
  const ms = await host.invoke('scan', args);
  if (ms.length) apply({ op: 'add_media', media: ms }, `Import ${ms.length} file(s)`);
}

// ---------------- timeline ----------------
const trackH = tr => { const snd = document.body.classList.contains('ws-sound'); const k = P.tracks.find(t => t.id === tr); const nv = P.tracks.filter(t => t.kind === 'video').length; return k.kind === 'video' ? (snd ? 34 : nv > 4 ? 38 : 56) : (snd ? 70 : 42); };
function tlWidth() { return (Math.max(P.autoDuration ? 30 : P.duration, ...P.clips.map(TF.clipEnd), 0) + 20) * pps; }
function renderTimeline() {
  const heads = $('#heads'), lanes = $('#lanes'); heads.innerHTML = ''; lanes.innerHTML = '';
  const W = tlWidth(); lanes.style.width = W + 'px';
  const bars = musicBars();
  for (const tr of P.tracks) {
    const st = P.trackState[tr.id] || {}; const h = trackH(tr.id);
    const hd = el('div', 'head'); hd.style.height = h + 'px';
    hd.innerHTML = `<b>${tr.id}</b><span>${esc(tr.name)}</span>` + (tr.kind === 'video' ? `<button class="${st.hidden ? 'on' : ''}" data-k="hidden" title="Hide">H</button>` : `<button class="mute ${st.mute ? 'on' : ''}" data-k="mute" title="Mute">M</button><button class="${st.solo ? 'on' : ''}" data-k="solo" title="Solo">S</button>`) + `<button class="${st.lock ? 'on' : ''}" data-k="lock" title="Lock">L</button>`;
    hd.querySelectorAll('button').forEach(b => b.onclick = () => apply({ op: 'set_track', track: tr.id, state: { [b.dataset.k]: !st[b.dataset.k] } }, `${tr.id} ${b.dataset.k}`));
    heads.appendChild(hd);
    const ln = el('div', 'lane'); ln.style.height = h + 'px'; ln.dataset.track = tr.id;
    if (barsOn) for (const b of bars) { const g = el('div', 'gridbar'); g.style.left = b * pps + 'px'; ln.appendChild(g); }
    for (const c of P.clips.filter(c => c.track === tr.id)) ln.appendChild(clipEl(c, tr, st));
    ln.ondragover = e => { e.preventDefault(); ln.classList.add('drop'); };
    ln.ondragleave = () => ln.classList.remove('drop');
    ln.ondrop = e => laneDrop(e, tr, ln);
    lanes.appendChild(ln);
  }
  renderRuler(); placePlayhead(); placeAsk();
  $('#tlInfo').textContent = `${P.clips.length} clips · ${sel.size ? sel.size + ' selected' : 'nothing selected'}`;
}
function clipEl(c, tr, st) {
  const m = TF.mediaOf(P, c); const role = tr.role || '';
  const d = el('div', `clip ${c.type} ${role}${sel.has(c.id) ? ' sel' : ''}${aiTouched.has(c.id) ? ' claude' : ''}${st.mute || c.muteAudio && c.type === 'audio' ? ' muted' : ''}`);
  d.style.left = c.start * pps + 'px'; d.style.width = Math.max(3, c.dur * pps) + 'px'; d.dataset.id = c.id;
  const name = c.type === 'title' ? '<b>T</b> ' + esc((c.text || '').replace(/\n/g, ' ')) : c.type === 'shape' ? '■ ' + esc(typeof c.fill === 'string' ? c.fill : c.fill.kind) : esc(m ? m.name : '?');
  d.innerHTML = `<div class="cn">${name}</div>${clipBadges(c, m)}`;
  if (c.disabled) d.classList.add('off');
  if ((c.type === 'video' || c.type === 'image') && m && m.thumbUrl) { const f = el('div', 'film'); f.style.backgroundImage = `url('${m.thumbUrl}')`; d.appendChild(f); }
  if (c.type === 'audio' || (c.type === 'video' && m && m.hasAudio && trackH(tr.id) > 50)) drawWave(d, c, m);
  if (c.transition) { const t = el('div', 'tr'); t.style.width = Math.min(c.dur, c.transition.dur) * pps + 'px'; t.title = c.transition.type; d.appendChild(t); }
  for (const [prop, list] of Object.entries(c.kf || {})) for (const k of list) { const kd = el('div', 'kfd'); kd.style.left = k.t * pps + 'px'; kd.title = `${prop} ${k.v}`; d.appendChild(kd); }
  if (c.fadeIn) { const f = el('div', 'fade'); f.style.cssText = `left:0;width:${c.fadeIn * pps}px;background:linear-gradient(to top right,rgba(0,0,0,.45) 50%,transparent 51%)`; d.appendChild(f); }
  if (c.fadeOut) { const f = el('div', 'fade'); f.style.cssText = `right:0;width:${c.fadeOut * pps}px;background:linear-gradient(to top left,rgba(0,0,0,.45) 50%,transparent 51%)`; d.appendChild(f); }
  d.appendChild(el('div', 'h l')); d.appendChild(el('div', 'h r'));
  d.onpointerdown = e => clipDown(e, c, d);
  d.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); if (!sel.has(c.id)) { sel = new Set([c.id]); renderTimeline(); renderInspector(); } clipMenu(e, c); };
  return d;
}
const peaksCache = new Map();
async function peaksFor(m) {
  if (peaksCache.has(m.url)) return peaksCache.get(m.url);
  const pr = (async () => {
    if (m.size > 250e6) return null;
    const buf = await (await fetch(m.enhancedUrl || m.url)).arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 8000); const ab = await ctx.decodeAudioData(buf);
    const ch = ab.getChannelData(0); const per = Math.floor(ab.sampleRate / 100); const n = Math.floor(ch.length / per); const out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let mx = 0; for (let j = i * per; j < (i + 1) * per; j += 4) { const v = Math.abs(ch[j]); if (v > mx) mx = v; } out[i] = mx; }
    return out;
  })().catch(() => null);
  peaksCache.set(m.url, pr); return pr;
}
function drawWave(d, c, m) {
  if (!m) return; const cv = el('canvas', 'wave'); d.appendChild(cv);
  peaksFor(m).then(pk => {
    if (!pk) return; const w = Math.min(4000, Math.max(4, Math.round(c.dur * pps))), h = 40; cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = 'rgba(255,255,255,.75)'; const gain = Math.pow(10, (c.volume || 0) / 20);
    for (let x = 0; x < w; x++) { const st = c.in + (x / pps) * c.speed; const i = Math.floor(st * 100); const v = Math.min(1, (pk[i] || 0) * gain); g.fillRect(x, h - v * h, 1, v * h); }
  });
}
function musicBars() {
  const out = [];
  for (const c of P.clips) { const m = TF.mediaOf(P, c); if (!m || !m.music) continue; for (const b of m.music.bars) { const t = c.start + (b - c.in) / c.speed; if (t >= c.start && t <= TF.clipEnd(c)) out.push(t); } }
  return out;
}
function renderRuler() {
  const r = $('#ruler'); r.innerHTML = ''; r.style.width = tlWidth() + 'px';
  const steps = [1 / P.fps, .1, .25, .5, 1, 2, 5, 10, 15, 30, 60, 120]; const big = steps.find(s => s * pps >= 70) || 120; const small = steps.slice().reverse().find(s => s < big && big / s <= 10 && s * pps >= 6) || big / 2;
  const W = tlWidth() / pps;
  for (let t = 0; t <= W; t += small) { const k = el('div', 'tk sm'); k.style.left = t * pps + 'px'; r.appendChild(k); }
  for (let t = 0; t <= W; t += big) { const k = el('div', 'tk big'); k.style.left = t * pps + 'px'; r.appendChild(k); const l = el('div', 'lb', big < 1 ? fmt(t, P.fps).slice(6) : fmtS(t)); l.style.left = t * pps + 'px'; r.appendChild(l); }
  if (barsOn) for (const b of musicBars()) { const k = el('div', 'bar'); k.style.left = b * pps + 'px'; r.appendChild(k); }
  if (P.inPoint != null || P.outPoint != null) { const a = P.inPoint ?? 0, b = P.outPoint ?? rangeEnd(); const io = el('div', 'io'); io.style.left = a * pps + 'px'; io.style.width = (b - a) * pps + 'px'; r.appendChild(io); }
  for (const m of P.markers) { const k = el('div', 'mk'); k.style.left = m.t * pps + 'px'; k.style.background = m.color; k.title = m.name; k.onclick = e => { e.stopPropagation(); seek(m.t); }; k.ondblclick = e => { e.stopPropagation(); apply({ op: 'delete_marker', id: m.id }, 'Delete marker'); }; r.appendChild(k); }
  for (const n of P.notes || []) if (n.t != null) { const k = el('div', 'note-pin'); k.style.left = n.t * pps + 'px'; k.title = n.text; r.appendChild(k); }
  r.onpointerdown = e => { const rect = r.getBoundingClientRect(); const go = ev => seek(snapT((ev.clientX - rect.left) / pps, null, true)); go(e); const mv = ev => go(ev); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
}
function placePlayhead() { const ph = $('#playhead'); if (ph) ph.style.left = T * pps + 'px'; }

// snapping
function snapPoints(exclude) {
  const pts = [T, 0, ...P.markers.map(m => m.t)];
  for (const c of P.clips) if (!exclude || !exclude.has(c.id)) pts.push(c.start, TF.clipEnd(c));
  if (P.inPoint != null) pts.push(P.inPoint); if (P.outPoint != null) pts.push(P.outPoint);
  return pts.concat(musicBars());
}
function snapT(t, exclude, noPlayhead) {
  if (!snapOn) return t; const px = 8 / pps; let best = t, bd = px;
  for (const p of snapPoints(exclude)) { if (noPlayhead && p === T) continue; const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
  showSnap(best !== t ? best : null); return best;
}
function showSnap(t) { let s = $('.snapline'); if (t == null) { if (s) s.remove(); return; } if (!s) { s = el('div', 'snapline'); $('#lanesWrap').appendChild(s); } s.style.left = t * pps + 'px'; }

function laneAt(clientY) { for (const ln of $$('.lane')) { const r = ln.getBoundingClientRect(); if (clientY >= r.top && clientY < r.bottom) return ln.dataset.track; } return null; }
function kindOk(trackId, c) { const tr = P.tracks.find(t => t.id === trackId); if (!tr) return false; return c.type === 'audio' ? tr.kind === 'audio' : tr.kind === 'video'; }
function locked(trackId) { return (P.trackState[trackId] || {}).lock; }

function clipDown(e, c, d) {
  if (e.button !== 0) return; e.stopPropagation();
  if (locked(c.track)) { toast(c.track + ' is locked'); return; }
  const rect = $('#lanes').getBoundingClientRect(); const tAt = ev => (ev.clientX - rect.left) / pps;
  if (tool === 'razor') { const t = snapT(tAt(e)); apply({ op: 'split_clip', id: c.id, t }, 'Razor'); showSnap(null); return; }
  if (tool === 'text') return;
  if (e.shiftKey || e.ctrlKey || e.metaKey) { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); }
  else if (!sel.has(c.id)) sel = new Set([c.id]);
  const edge = e.target.classList.contains('h') ? (e.target.classList.contains('l') ? 'start' : 'end') : null;
  const before = JSON.stringify(P); const startT = tAt(e); let moved = false;
  const group = P.clips.filter(x => sel.has(x.id)); const orig = group.map(x => ({ x, start: x.start, track: x.track, dur: x.dur, in: x.in }));
  const ripple = tool === 'ripple';
  const mv = ev => {
    const dt = tAt(ev) - startT; if (!moved && Math.abs(dt * pps) < 3 && !laneChanged(ev)) return; moved = true;
    if (edge) {
      const o = orig.find(o => o.x === c); const m = TF.mediaOf(P, c);
      if (edge === 'start') {
        let ns = snapT(o.start + dt, new Set([c.id])); const minS = c.type === 'video' || c.type === 'audio' ? o.start - o.in / c.speed : -1e9;
        ns = Math.max(0, minS, Math.min(ns, o.start + o.dur - 1 / P.fps));
        c.dur = o.dur - (ns - o.start); c.in = Math.max(0, o.in + (ns - o.start) * c.speed); if (!ripple) c.start = ns;
      } else {
        let ne = snapT(o.start + o.dur + dt, new Set([c.id])); const maxD = m && m.duration && (c.type === 'video' || c.type === 'audio') ? (m.duration - o.in) / c.speed : 1e9;
        const nd = Math.max(1 / P.fps, Math.min(ne - o.start, maxD));
        if (ripple) { const delta = nd - c.dur; for (const x of P.clips) if (x.track === c.track && x !== c && x.start >= TF.clipEnd(c) - 1e-6) x.start += delta; }
        c.dur = nd;
      }
    } else {
      const tr = laneAt(ev.clientY); let dtrack = 0;
      if (tr && tr !== c.track && group.length === 1 && kindOk(tr, c) && !locked(tr)) c.track = tr;
      let ns = Math.max(0, orig[0].start + dt); const sn = snapT(ns, sel); const se = snapT(ns + orig[0].dur, sel);
      const d0 = sn - ns, d1 = se - (ns + orig[0].dur); const adj = Math.abs(d0) <= Math.abs(d1) ? d0 : d1; const delta = ns + adj - orig[0].start;
      for (const o of orig) o.x.start = Math.max(0, o.start + delta);
    }
    renderTimeline(); drawFrame();
  };
  const laneChanged = ev => laneAt(ev.clientY) !== c.track;
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); showSnap(null);
    if (moved) {
      // resolve overlaps (overwrite) for moved clips
      if (!edge) for (const o of orig) { const x = o.x; P.clips = P.clips.filter(y => y !== x); const s = x.start; TF.OPS.add_clip(P, { clip: x }); const nx = P.clips.find(y => y.id === x.id); if (nx) nx.start = s; }
      H.undo.push({ before, by: 'you', group: edge ? 'Trim' : 'Move', lines: [edge ? `trim ${c.id}` : `move ${group.length} clip(s)`] }); H.redo = [];
      H.log.push({ by: 'you', group: edge ? 'Trim' : 'Move', lines: [edge ? 'trim' : 'move'], at: Date.now() }); save(); renderHistory();
    }
    renderTimeline(); renderInspector(); drawFrame();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
  renderTimeline(); renderInspector();
}
function lanesDown(e) {
  if (e.target.closest('.clip') || e.target.closest('.ask')) return;
  const rect = $('#lanes').getBoundingClientRect(); const t = (e.clientX - rect.left) / pps; const tr = laneAt(e.clientY);
  if (tool === 'text' && tr && P.tracks.find(x => x.id === tr).kind === 'video') { addTitle(TITLE_PRESETS[0], snapT(t), tr); setTool('select'); return; }
  sel = new Set(); seek(snapT(t, null, true)); renderTimeline(); renderInspector();
}
async function laneDrop(e, tr, ln) {
  e.preventDefault(); ln.classList.remove('drop');
  const rect = $('#lanes').getBoundingClientRect(); const t = snapT(Math.max(0, (e.clientX - rect.left) / pps)); showSnap(null);
  const mid = e.dataTransfer.getData('tf/media'), trans = e.dataTransfer.getData('tf/trans'), sfx = e.dataTransfer.getData('tf/sfx'), file = e.dataTransfer.getData('tf/file');
  const look = e.dataTransfer.getData('tf/look'), motion = e.dataTransfer.getData('tf/motion'), tanim = e.dataTransfer.getData('tf/tanim');
  const onClip = e.target.closest('.clip')?.dataset.id;
  if (file) { await placeFile(file, t, tr.id); return; }
  if (look || motion || tanim) { if (!onClip) return toast('Drop it onto a clip'); dropPreset(onClip, look, motion, tanim); return; }
  if (mid) { const m = P.media.find(x => x.id === mid); if (!m) return; const type = m.type === 'audio' ? 'audio' : m.type; if (!kindOk(tr.id, { type })) { toast(type === 'audio' ? 'Drop audio on A1–A3' : 'Drop pictures on V1–V3'); return; } insertMedia(m, tr.id, t); }
  else if (trans) { if (onClip) apply({ op: 'set_transition', id: onClip, type: trans, dur: .4 }, 'Transition ' + trans); else toast('Drop the transition onto the clip it should lead into'); }
  else if (sfx) { if (tr.kind !== 'audio') return toast('Drop SFX on an audio track'); await addSfx(JSON.parse(sfx), tr.id, t); }
  else if (e.dataTransfer.files.length) { const files = [...e.dataTransfer.files].map(f => host.pathOf(f)); const ms = await host.invoke('scan', { files }); if (!ms.length) return; apply({ op: 'add_media', media: ms }, 'Import'); const m = P.media.find(x => x.path === ms[0].path); if (m && kindOk(tr.id, { type: m.type === 'audio' ? 'audio' : m.type })) insertMedia(m, tr.id, t); }
}
async function addSfx(s, track, t) {
  let m = P.media.find(x => x.path === s.path);
  if (!m) { const ms = await host.invoke('scan', { files: [s.path] }); apply({ op: 'add_media', media: ms }, 'Import SFX'); m = P.media.find(x => x.path === s.path); }
  if (m) apply({ op: 'add_clip', clip: { track, type: 'audio', media: m.id, start: t, dur: m.duration || 1, volume: -8 } }, 'SFX ' + s.name);
}

// ask-Claude bubble over the selected clip
function placeAsk() {
  const a = $('#ask'); if (sel.size === 0 || aiBusy) { a.classList.remove('on'); return; }
  const first = P.clips.filter(c => sel.has(c.id)).sort((x, y) => x.start - y.start)[0]; if (!first) { a.classList.remove('on'); return; }
  const ln = $(`.lane[data-track="${first.track}"]`); if (!ln) return;
  a.classList.add('on'); a.style.left = Math.max(0, first.start * pps) + 'px'; a.style.top = ($('#lanesWrap').scrollTop + 0) + 'px';
}
function selectionScope() {
  const cs = P.clips.filter(c => sel.has(c.id)); if (!cs.length) return null;
  return { clips: cs.map(c => c.id), range: [Math.min(...cs.map(c => c.start)), Math.max(...cs.map(TF.clipEnd))] };
}

// ---------------- inspector ----------------
const TRANS = ['crossfade', 'dip', 'push-left', 'push-up', 'slide', 'zoom', 'wipe', 'iris', 'blur', 'whip'];
const ANIM_IN = ['rise', 'mask', 'pop', 'blur', 'type', 'split', 'slide', 'scramble', 'fade', 'none'];
const FONTS = ['Archivo', 'Anton', 'Bebas Neue', 'Unbounded', 'Space Grotesk', 'Bricolage Grotesque', 'Sora', 'Inter', 'DM Sans', 'Fraunces', 'Instrument Serif', 'Playfair Display', 'Source Serif 4', 'Caveat', 'Sansita', 'JetBrains Mono'];
function renderInspector(soft) {
  const box = $('#insp'); const cs = P ? P.clips.filter(c => sel.has(c.id)) : [];
  if (soft && document.activeElement && box.contains(document.activeElement)) return;
  if (cs.length !== 1) {
    box.innerHTML = cs.length > 1 ? `<div class="empty">${cs.length} clips selected.<br>Use the ✦ box on the timeline to ask Claude to change only these.</div>` : projectInspector();
    if (!cs.length) bindProjectInspector(); return;
  }
  const c = cs[0]; const m = TF.mediaOf(P, c); const lt = Math.max(0, Math.min(c.dur, T - c.start));
  let h = `<div class="claude-box"><div class="sec-h" style="margin:0">✦ Claude — this clip only</div><textarea id="iAsk" rows="2" placeholder="e.g. make the text bigger and pop it in on the beat"></textarea><button class="btn sm primary" id="iAskGo">Fix this clip only</button></div>`;
  h += sec('Clip', `${row('Start', num('start', c.start, .01))}${row('Duration', num('dur', c.dur, .01))}${c.type === 'video' || c.type === 'audio' ? row('Source in', num('in', c.in, .01)) + row('Speed', num('speed', c.speed, .05)) : ''}
    ${row('Track', `<select data-f="track">${P.tracks.filter(t => kindOk(t.id, c)).map(t => `<option ${t.id === c.track ? 'selected' : ''}>${t.id}</option>`).join('')}</select>`)}
    ${c.type !== 'audio' ? row('Blend', `<select data-f="blend">${['normal', 'screen', 'multiply', 'overlay', 'lighten', 'difference'].map(b => `<option ${b === (c.blend || 'normal') ? 'selected' : ''}>${b}</option>`).join('')}</select>`) : ''}`, true);
  if (c.type !== 'audio') {
    const pr = TF.propsAt(c, lt);
    h += sec('Transform · keyframes', ['x', 'y', 'scale', 'rot', 'opacity'].map(k => kfRow(c, k, { x: 'Position X', y: 'Position Y', scale: 'Scale', rot: 'Rotation', opacity: 'Opacity' }[k], pr[k], lt, k === 'scale' || k === 'opacity' ? .01 : 1)).join('') + `<div class="irow-btns"><button class="btn sm" id="kfClear">Clear keyframes</button></div>`, document.body.classList.contains('ws-motion') || true);
  }
  if (c.type === 'title') {
    const s = c.style, a = c.anim;
    h += sec('Text', `<textarea data-f="text" rows="3">${esc(c.text)}</textarea><div style="height:6px"></div>
      ${row('Font', `<select data-s="font">${FONTS.map(f => `<option ${f === s.font ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}
      ${row('Size', snum('size', s.size, 1))}${row('Weight', snum('weight', s.weight, 50))}${row('Color', `<input type="color" data-s="color" value="${toHex(s.color)}">`)}
      ${row('Box', `<input data-s="bg" value="${esc(s.bg)}" placeholder="none / #hex">`)}
      ${row('Align', `<select data-s="align">${['center', 'left', 'right'].map(x => `<option ${x === s.align ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
      ${row('Case', `<select data-s="case"><option value="">As typed</option><option value="upper" ${s.case === 'upper' ? 'selected' : ''}>UPPER</option></select>`)}
      ${row('Tracking', snum('tracking', s.tracking, .01))}${row('Line height', snum('lh', s.lh, .01))}${row('Width', snum('width', s.width, .01))}${row('Stretch %', snum('stretch', s.stretch, 1))}
      ${row('Italic', `<input type="checkbox" data-s="italic" ${s.italic ? 'checked' : ''}>`)}${row('Shadow', `<input type="checkbox" data-s="shadow" ${s.shadow ? 'checked' : ''}>`)}`, true);
    h += sec('Animation', `${row('In', `<select data-a="in">${ANIM_IN.map(x => `<option ${x === a.in ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
      ${row('Out', `<select data-a="out">${['fade', 'drop', 'blur', 'none'].map(x => `<option ${x === a.out ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
      ${row('In length', anum('inDur', a.inDur, .05))}${row('Out length', anum('outDur', a.outDur, .05))}${row('Stagger', anum('stagger', a.stagger, .01))}
      ${row('Ease', `<select data-a="ease">${['expoOut', 'backOut', 'cubicOut', 'sineInOut', 'linear'].map(x => `<option ${x === a.ease ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}`, true);
  }
  if (c.type === 'image' || c.type === 'video') {
    const a = c.anim || {};
    h += sec('Picture', `${row('Fit', `<select data-f="fit"><option ${c.fit === 'cover' ? 'selected' : ''}>cover</option><option ${c.fit === 'contain' ? 'selected' : ''}>contain</option></select>`)}
      ${row('In', `<select data-a="in">${['none', 'fade', 'zoom', 'slide-up'].map(x => `<option ${x === a.in ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
      ${row('Out', `<select data-a="out">${['none', 'fade'].map(x => `<option ${x === a.out ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
      ${row('Push-in', anum('kb', a.kb || 0, .01))}`, false);
  }
  if (c.type === 'shape') h += sec('Fill', `<textarea data-f="fill" rows="4" style="font:11px var(--mono)">${esc(typeof c.fill === 'string' ? c.fill : JSON.stringify(c.fill, null, 1))}</textarea>`, true);
  if (c.type !== 'audio') {
    const fx = c.fx || {};
    h += sec('Color & effects', [['brightness', 1, .02], ['contrast', 1, .02], ['saturate', 1, .02], ['temp', 0, .05], ['hue', 0, 1], ['grayscale', 0, .05], ['blur', 0, .5]].map(([k, d, st]) => row(k[0].toUpperCase() + k.slice(1), `<input type="number" data-x="${k}" step="${st}" value="${fx[k] ?? d}" class="scrub">`)).join(''), document.body.classList.contains('ws-color'));
    h += sec('Transition in', `${row('Type', `<select id="iTrans"><option value="none">none</option>${TRANS.map(x => `<option ${c.transition && c.transition.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}${row('Length', `<input type="number" id="iTransDur" step=".05" value="${c.transition ? c.transition.dur : .4}">`)}`, false);
  }
  if (c.type === 'audio' || (c.type === 'video' && m && m.hasAudio)) {
    const rep = m && m.enhanceReport ? `before: noise ${m.enhanceReport.before.noise_floor_db?.toFixed(1)} dB · after: ${m.enhanceReport.after.noise_floor_db?.toFixed(1)} dB · ${m.enhanceReport.engine}` : '';
    h += sec('Audio', `${row('Volume dB', num('volume', c.volume || 0, .5))}${row('Pan', num('pan', c.pan || 0, .05))}${row('Fade in', num('fadeIn', c.fadeIn, .05))}${row('Fade out', num('fadeOut', c.fadeOut, .05))}
      ${c.type === 'video' ? row('Audio is', `<select data-f="audioRole"><option value="speech">speech</option><option value="music" ${c.audioRole === 'music' ? 'selected' : ''}>music</option><option value="sfx" ${c.audioRole === 'sfx' ? 'selected' : ''}>sfx</option></select>`) + row('Mute', `<input type="checkbox" data-f="muteAudio" ${c.muteAudio ? 'checked' : ''}>`) : ''}
      <div class="sec-h">Enhance speech <em>local · like Adobe Podcast</em></div>
      ${row('Strength', `<input type="range" id="enhStr" min="0" max="100" value="${Math.round((m && m.enhanceStrength || .85) * 100)}">`)}
      <div class="irow-btns"><button class="btn sm primary" id="enhGo">${m && m.enhanced ? 'Re-enhance' : 'Enhance speech'}</button>${m && m.enhanced ? `<label><input type="checkbox" data-f="useEnhanced" ${c.useEnhanced !== false ? 'checked' : ''}> use enhanced</label>` : ''}</div>
      ${rep ? `<div class="report">${esc(rep)}</div>` : ''}
      <div class="irow-btns"><button class="btn sm" id="trGo">${m && m.transcript ? 'Re-transcribe' : 'Transcribe'}</button><button class="btn sm" id="stemGo">Split voice / music</button></div>
      ${m && m.transcript ? `<div class="report" style="max-height:140px;overflow:auto;user-select:text">${esc(m.transcript.segments.map(s => s.text).join(' '))}</div>` : ''}`, true);
  }
  if (m) h += `<div class="report">${esc(m.path)}</div>`;
  box.innerHTML = h; bindInspector(c, m);
}
const sec = (t, b, open) => `<details class="isec" ${open ? 'open' : ''}><summary>${t}</summary><div class="ib">${b}</div></details>`;
const row = (l, ctl, extra = '') => `<div class="prow ${extra ? '' : 'full'}"><label>${l}</label>${ctl}${extra}</div>`;
const num = (f, v, st) => `<input type="number" data-f="${f}" step="${st}" value="${(+v).toFixed(3).replace(/\.?0+$/, '')}" class="scrub">`;
const snum = (f, v, st) => `<input type="number" data-s="${f}" step="${st}" value="${v}">`;
const anum = (f, v, st) => `<input type="number" data-a="${f}" step="${st}" value="${v}">`;
function kfRow(c, k, label, v, lt, st) {
  const list = c.kf[k] || []; const at = list.find(q => Math.abs(q.t - lt) < 1 / P.fps / 2);
  return `<div class="prow"><label>${label}</label><input type="number" data-p="${k}" step="${st}" value="${(+v).toFixed(3).replace(/\.?0+$/, '')}" class="scrub"><button class="kfb ${at ? 'on' : list.length ? 'has' : ''}" data-kf="${k}" title="Keyframe at playhead">◆</button></div>`;
}
const toHex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff';
function bindInspector(c, m) {
  const box = $('#insp'); const lt = () => Math.max(0, Math.min(c.dur, T - c.start));
  const live = (fn, label) => e => { liveStart(); fn(e.target); TF.normClip(c); drawFrame(); if (e.type === 'change') { liveCommit(label); renderTimeline(); } };
  box.querySelectorAll('[data-f]').forEach(i => { const f = i.dataset.f; const h = live(t => {
      let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value;
      if (f === 'fill') { try { v = t.value.trim().startsWith('{') ? JSON.parse(t.value) : t.value.trim(); } catch { return; } }
      if (f === 'track') { TF.OPS.move_clip(P, { id: c.id, start: c.start, track: v }); return; }
      c[f] = v; if (f === 'text' && comp.nodes.has(c.id)) { comp.nodes.get(c.id).remove(); comp.nodes.delete(c.id); }
    }, 'Edit ' + f); i.oninput = h; i.onchange = h; });
  box.querySelectorAll('[data-s]').forEach(i => { const f = i.dataset.s; const h = live(t => { c.style[f] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? +t.value : t.value; }, 'Text ' + f); i.oninput = h; i.onchange = h; });
  box.querySelectorAll('[data-a]').forEach(i => { const f = i.dataset.a; const h = live(t => { c.anim[f] = t.type === 'number' ? +t.value : t.value; }, 'Animation ' + f); i.oninput = h; i.onchange = h; });
  box.querySelectorAll('[data-x]').forEach(i => { const f = i.dataset.x; const h = live(t => { c.fx[f] = +t.value; }, 'Effect ' + f); i.oninput = h; i.onchange = h; });
  box.querySelectorAll('[data-p]').forEach(i => { const k = i.dataset.p; const h = live(t => {
      const v = +t.value; if ((c.kf[k] || []).length) TF.OPS.set_keyframe(P, { id: c.id, prop: k, t: lt(), v }); else c.props[k] = v;
    }, 'Transform ' + k); i.oninput = h; i.onchange = h; });
  box.querySelectorAll('[data-kf]').forEach(b => b.onclick = () => { const k = b.dataset.kf; const v = TF.propsAt(c, lt())[k]; const list = c.kf[k] || []; const at = list.find(q => Math.abs(q.t - lt()) < 1 / P.fps / 2);
    if (at) { c.kf[k] = list.filter(q => q !== at); if (!c.kf[k].length) delete c.kf[k]; liveStart(); liveCommit('Remove keyframe'); }
    else apply({ op: 'set_keyframe', id: c.id, prop: k, t: lt(), v }, 'Keyframe ' + k);
    renderInspector(); renderTimeline(); });
  // scrub numbers by dragging their label
  box.querySelectorAll('.prow').forEach(r => { const lab = r.querySelector('label'), inp = r.querySelector('input[type=number]'); if (!lab || !inp) return; lab.style.cursor = 'ew-resize';
    lab.onpointerdown = e => { const x0 = e.clientX, v0 = +inp.value, st = +inp.step || 1; const mv = ev => { inp.value = +(v0 + Math.round((ev.clientX - x0) / 2) * st).toFixed(4); inp.dispatchEvent(new Event('input')); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); inp.dispatchEvent(new Event('change')); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }; });
  const kc = $('#kfClear'); if (kc) kc.onclick = () => apply({ op: 'clear_keyframes', id: c.id }, 'Clear keyframes');
  const tsel = $('#iTrans'); if (tsel) { const go = () => apply({ op: 'set_transition', id: c.id, type: tsel.value, dur: +$('#iTransDur').value || .4 }, 'Transition'); tsel.onchange = go; $('#iTransDur').onchange = go; }
  $('#iAskGo').onclick = () => { const t = $('#iAsk').value.trim(); if (t) { switchTab('right', 'claude'); runAI(t, { clips: [c.id], range: [c.start, TF.clipEnd(c)] }); } };
  const eg = $('#enhGo'); if (eg) eg.onclick = async () => {
    const s = +$('#enhStr').value / 100; eg.disabled = true; eg.textContent = 'Enhancing…';
    try { const r = await host.invoke('enhance', { src: m.path, strength: s, dir: P.folder + SEP + 'enhanced' }); apply({ op: 'update_media', id: m.id, patch: { enhanced: r.out, enhancedUrl: r.url, enhanceReport: r, enhanceStrength: s } }, 'Enhance speech'); peaksCache.delete(m.url); toast('Speech enhanced · ' + r.engine); }
    catch (e) { toast(e.message, 6000); eg.disabled = false; eg.textContent = 'Enhance speech'; }
  };
  const tg = $('#trGo'); if (tg) tg.onclick = async () => { tg.disabled = true; tg.textContent = 'Transcribing…'; try { const tr = await host.invoke('transcribe', { src: m.path }); apply({ op: 'update_media', id: m.id, patch: { transcript: tr } }, 'Transcribe'); } catch (e) { toast(e.message, 6000); tg.disabled = false; } };
  const sg = $('#stemGo'); if (sg) sg.onclick = async () => {
    sg.disabled = true; sg.textContent = 'Separating…';
    try { const r = await host.invoke('stems', { src: m.path }); const ms = await host.invoke('scan', { files: [r.vocals, r.music] });
      ms[0].name = m.name + ' · voice'; ms[1].name = m.name + ' · music';
      H.apply([{ op: 'add_media', media: ms }], 'you', 'Stems');
      const vm = P.media.find(x => x.path === ms[0].path), mm = P.media.find(x => x.path === ms[1].path);
      apply([{ op: 'add_clip', clip: { track: 'A3', type: 'audio', media: vm.id, start: c.start, in: c.in, dur: c.dur } }, { op: 'add_clip', clip: { track: 'A1', type: 'audio', media: mm.id, start: c.start, in: c.in, dur: c.dur } }, ...(c.type === 'video' ? [{ op: 'update_clip', id: c.id, patch: { muteAudio: true } }] : [{ op: 'update_clip', id: c.id, patch: { volume: -60 } }])], 'Split voice / music');
    } catch (e) { toast(e.message, 6000); sg.disabled = false; sg.textContent = 'Split voice / music'; }
  };
}
function projectInspector() {
  return sec('Project', `${row('Name', `<input id="ppName" value="${esc(P.name)}">`)}${row('Format', `<select id="ppFormat">${Object.keys(TF.FORMATS).map(f => `<option ${f === P.format ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}
    ${row('Duration', `<input id="ppDur" type="number" step="0.5" value="${TF.projectDuration(P)}" ${P.autoDuration ? 'disabled' : ''}>`)}${row('Auto length', `<label class="muted"><input type="checkbox" id="ppAuto" ${P.autoDuration ? 'checked' : ''}> ends with the last clip</label>`)}${row('Resolution', `<span class="report" style="margin:0">${P.w} × ${P.h}</span>`)}${row('FPS', `<select id="ppFps">${[24, 25, 30, 60].map(f => `<option ${f === P.fps ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}
    <div class="report">${esc(P.folder || '')}${P.sourceFolder ? '\nconnected: ' + esc(P.sourceFolder) : ''}</div>
    <div class="irow-btns">${P.sourceFolder ? '<button class="btn sm" id="ppRescan">Rescan folder</button>' : ''}<button class="btn sm" id="ppReveal">Show folder</button></div>`, true) +
    `<div class="empty">Select a clip to edit it.<br>Click a clip, then type in the ✦ box to have Claude change only that part.</div>`;
}
function bindProjectInspector() {
  $('#ppName').onchange = e => { apply({ op: 'set_project', name: e.target.value }, 'Rename'); $('#pName').value = P.name; };
  $('#ppFormat').onchange = e => { apply({ op: 'set_project', format: e.target.value }, 'Format'); comp.nodes.clear(); $('#stage').innerHTML = ''; fitStage(); drawFrame(); };
  $('#ppDur').onchange = e => apply({ op: 'set_project', duration: +e.target.value }, 'Duration');
  $('#ppAuto').onchange = e => { apply({ op: 'set_project', autoDuration: e.target.checked, duration: TF.projectDuration(P) }, 'Auto length'); renderInspector(); };
  $('#ppFps').onchange = e => apply({ op: 'set_project', fps: +e.target.value }, 'FPS');
  const rs = $('#ppRescan'); if (rs) rs.onclick = async () => { const ms = await host.invoke('scan', { folder: P.sourceFolder }); const nw = ms.filter(m => !P.media.find(x => x.path === m.path)); if (nw.length) apply({ op: 'add_media', media: nw }, `+${nw.length} new file(s)`); else toast('No new files'); };
  $('#ppReveal').onclick = () => host.invoke('open-path', P.folder);
}

// ---------------- left panel content ----------------
const LOOKS = { Warm: { temp: .45, saturate: 1.08 }, Cool: { temp: -.45, contrast: 1.04 }, Punchy: { contrast: 1.18, saturate: 1.25 }, Mono: { grayscale: 1, contrast: 1.12 }, Faded: { contrast: .88, brightness: 1.06, saturate: .8 }, Night: { brightness: .82, saturate: .85, hue: -8 }, Reset: {} };
const MOTION = { 'Push-in': { kb: .08 }, 'Zoom in': { in: 'zoom' }, 'Fade in': { in: 'fade' }, 'Fade out': { out: 'fade' }, 'Slide up': { in: 'slide-up' }, 'No motion': { in: 'none', out: 'none', kb: 0 } };
const TITLE_PRESETS = [
  { n: 'Kinetic', text: 'BIG IDEA', style: { font: 'Archivo', size: 150, weight: 900, stretch: 72, case: 'upper', tracking: -.01, lh: .9 }, anim: { in: 'mask', out: 'drop', inDur: .55, stagger: .07 } },
  { n: 'Swiss', text: 'Clear.\nSimple.', style: { font: 'Inter', size: 120, weight: 800, align: 'left', tracking: -.04, lh: .95 }, anim: { in: 'rise', out: 'fade', stagger: .08 } },
  { n: 'Editorial', text: 'A quiet\nrevolution', style: { font: 'Instrument Serif', size: 132, weight: 400, italic: true, tracking: -.02, lh: 1 }, anim: { in: 'blur', out: 'blur', inDur: .9, stagger: .1, ease: 'cubicOut' } },
  { n: 'Label box', text: 'NEW · 15 €', style: { font: 'Space Grotesk', size: 78, weight: 700, bg: '#d6ff3d', color: '#0a0b0d', case: 'upper' }, anim: { in: 'pop', out: 'fade', stagger: .04, ease: 'backOut' } },
  { n: 'Poster', text: 'ONE\nTAKE', style: { font: 'Anton', size: 260, weight: 400, case: 'upper', lh: .86 }, anim: { in: 'split', out: 'fade', inDur: .7, stagger: .03 } },
  { n: 'Mono', text: 'loading_ideas()', style: { font: 'JetBrains Mono', size: 64, weight: 500, color: '#d6ff3d' }, anim: { in: 'type', out: 'fade', stagger: .045 } },
  { n: 'Hand', text: 'see you there', style: { font: 'Caveat', size: 140, weight: 700 }, anim: { in: 'type', out: 'fade', stagger: .05 } },
  { n: 'Scramble', text: 'DECODED', style: { font: 'Unbounded', size: 110, weight: 800, case: 'upper' }, anim: { in: 'scramble', out: 'fade', inDur: .6, stagger: .06 } },
];
const SHAPES = [
  { n: 'Solid', fill: '#0f1115' }, { n: 'Gradient', fill: { kind: 'gradient', angle: 160, stops: ['#1b1f6b', '#0a0b0d'], spin: 4 } },
  { n: 'Glow', fill: { kind: 'radial', stops: ['#3a2a8f', '#0a0b0d 60%'], drift: .8 } }, { n: 'Grid', fill: { kind: 'grid', bg: '#0b0c0e', line: 'rgba(255,255,255,.08)', size: 90, speed: 30 } },
  { n: 'Bar', fill: { kind: 'bar', color: '#d6ff3d', x: .1, y: .62, w: .8, h: 14, inDur: .6 } }, { n: 'Ring', fill: { kind: 'circle', color: '#d6ff3d', x: .5, y: .5, d: .6, ring: 10, inDur: .7 } },
];
function addTitle(pr, at, track = 'V3') { const c = { track, type: 'title', start: at, dur: 3, text: pr.text, style: Object.assign({}, pr.style), anim: Object.assign({}, pr.anim) }; apply({ op: 'add_clip', clip: c }, 'Title ' + pr.n); const nc = P.clips[P.clips.length - 1]; sel = new Set([nc.id]); renderTimeline(); renderInspector(); }
async function fillLeft() {
  fillEffects();
  $('#txtPresets').innerHTML = ''; for (const pr of TITLE_PRESETS) { const b = el('div', 'pre'); b.innerHTML = `<span style="font-family:'${pr.style.font}';font-weight:${pr.style.weight};font-style:${pr.style.italic ? 'italic' : 'normal'};font-stretch:${pr.style.stretch || 100}%;font-size:15px;${pr.style.bg ? `background:${pr.style.bg};color:${pr.style.color};padding:2px 5px` : ''};${pr.style.case === 'upper' ? 'text-transform:uppercase' : ''}">${esc(pr.n)}</span>`; b.onclick = () => addTitle(pr, T); $('#txtPresets').appendChild(b); }
  $('#shapePresets').innerHTML = ''; for (const s of SHAPES) { const b = el('div', 'pre', `<span style="font-size:11px">${s.n}</span>`); const f = s.fill; b.style.background = typeof f === 'string' ? f : f.kind === 'gradient' ? `linear-gradient(${f.angle}deg,${f.stops})` : f.kind === 'radial' ? `radial-gradient(circle,${f.stops})` : '#14171b'; b.onclick = () => { const tr = s.n === 'Bar' || s.n === 'Ring' ? 'V2' : 'V1'; apply({ op: 'add_clip', clip: { track: tr, type: 'shape', start: T, dur: 3, fill: JSON.parse(JSON.stringify(f)) } }, 'Shape ' + s.n); }; $('#shapePresets').appendChild(b); }
  try { const st = await host.invoke('music-styles'); for (const [k, v] of Object.entries(st)) if (k !== 'raw') $('#musStyle').appendChild(el('option', '', esc(v))).value = k; } catch {}
  const sfx = await host.invoke('sfx-list'); const L = $('#sfxList'); L.innerHTML = sfx.length ? '' : '<div class="muted">SFX library not found.</div>';
  for (const s of sfx) { const r = el('div', 'sfx-i', `<button>▶</button><span>${esc(s.name)}</span>`); r.draggable = true; r.ondragstart = e => e.dataTransfer.setData('tf/sfx', JSON.stringify(s)); r.querySelector('button').onclick = () => new Audio(s.url).play(); r.ondblclick = () => addSfx(s, 'A2', T); L.appendChild(r); }
}
$('#musGo').onclick = async () => {
  const b = $('#musGo'); b.disabled = true; b.textContent = 'Composing…';
  try {
    const m = await host.invoke('music', { dur: +$('#musDur').value || P.duration, style: $('#musStyle').value, bpm: +$('#musBpm').value || 0, project: P.name, dir: P.folder + SEP + 'music' });
    H.apply({ op: 'add_media', media: [m] }, 'you', 'New music'); const mm = P.media.find(x => x.path === m.path);
    const a1free = !P.clips.some(c => c.track === 'A1'); apply({ op: 'add_clip', clip: { track: 'A1', type: 'audio', media: mm.id, start: a1free ? 0 : T, dur: m.duration, volume: -3 } }, 'Music: ' + m.name);
    toast(m.name + ' · ' + m.music.key); barsOn = true; $('#tBeats').classList.add('on'); renderTimeline();
  } catch (e) { toast(e.message, 6000); }
  b.disabled = false; b.textContent = 'Generate music';
};

// ---------------- Claude ----------------
function chatMsg(kind, text) { const d = el('div', 'msg ' + kind); d.textContent = text; $('#chatLog').appendChild(d); $('#chatLog').scrollTop = 1e9; return d; }
function renderScope() {
  const s = $('#scope'); if (!P) return; const n = sel.size; const io = P.inPoint != null && P.outPoint != null;
  if (scopeMode === 'selection' && !n) scopeMode = 'project'; if (scopeMode === 'inout' && !io) scopeMode = 'project';
  s.innerHTML = `<button data-s="project" class="${scopeMode === 'project' ? 'on' : ''}">Whole project</button>` + (n ? `<button data-s="selection" class="${scopeMode === 'selection' ? 'on' : ''}">Only ${n} selected</button>` : '') + (io ? `<button data-s="inout" class="${scopeMode === 'inout' ? 'on' : ''}">Only In → Out</button>` : '');
  s.querySelectorAll('button').forEach(b => b.onclick = () => { scopeMode = b.dataset.s; renderScope(); });
}
let thinkingEl = null;
async function runAI(text, scope) {
  if (aiBusy) return toast('Claude is still working'); if (!env.apiKey) return chatMsg('err', 'ANTHROPIC_API_KEY is not set. Close Takeframe, run SET-API-KEY.bat, then start Takeframe again.');
  aiBusy = true; $('#chatSend').disabled = true; $('#chatStop').disabled = false; placeAsk();
  chatMsg('you', text + (scope ? `\n— scope: ${scope.clips ? scope.clips.length + ' clip(s)' : ''} ${scope.range ? scope.range.map(fmtS).join('–') : ''}` : ''));
  thinkingEl = el('div', 'thinking', '<i></i><i></i><i></i>'); $('#chatLog').appendChild(thinkingEl);
  aiScope = scope; aiCreated = new Set();
  try { const r = await host.invoke('ai-run', { project: P, prompt: text, scope, history: aiMessages }); aiMessages = sanitizeHistory(r.messages || []); }
  catch (e) { chatMsg('err', e.message.replace(/^Error invoking remote method 'ai-run': (Error: )?/, '')); }
  aiBusy = false; $('#chatSend').disabled = false; $('#chatStop').disabled = true; if (thinkingEl) thinkingEl.remove(); thinkingEl = null; placeAsk();
}
// keep text-only history between requests (images and tool blocks are dropped to save tokens)
function sanitizeHistory(ms) {
  const out = [];
  for (const m of ms) {
    const txt = typeof m.content === 'string' ? m.content : (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (!txt.trim()) continue; if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n' + txt; else out.push({ role: m.role, content: txt });
  }
  while (out.length && out[0].role !== 'user') out.shift(); if (out.length && out[out.length - 1].role === 'user') out.pop();
  return out.slice(-12);
}
let aiScope = null, aiCreated = new Set(), tokIn = 0, tokOut = 0;
host.on('ai-event', e => {
  const log = $('#chatLog');
  const put = d => { if (thinkingEl) log.insertBefore(d, thinkingEl); else log.appendChild(d); log.scrollTop = 1e9; };
  if (e.type === 'text') { const d = el('div', 'msg ai'); d.textContent = e.text; put(d); }
  if (e.type === 'status') { const d = el('div', 'msg tool'); d.textContent = e.text; put(d); }
  if (e.type === 'tool') { const d = el('div', 'msg tool'); d.textContent = e.name === 'edit' ? `✎ ${e.input.summary || 'edit'} · ${(e.input.ops || []).length} ops` : e.name === 'look_at' ? `◎ looking at ${(e.input.times || []).map(t => t + 's').join(', ')}` : `· ${e.name}`; put(d); }
  if (e.type === 'frames') { const d = el('div', 'msg tool'); const f = el('div', 'frs'); e.urls.forEach((u, i) => { const im = el('img'); im.src = u; im.title = e.times[i] + 's'; im.onclick = () => seek(e.times[i]); f.appendChild(im); }); d.appendChild(f); put(d); }
  if (e.type === 'usage') { tokIn += (e.usage.input_tokens || 0) + (e.usage.cache_read_input_tokens || 0) + (e.usage.cache_creation_input_tokens || 0); tokOut += e.usage.output_tokens || 0; $('#aiCost').textContent = `${Math.round(tokIn / 1000)}k in · ${Math.round(tokOut / 1000)}k out`; }
});
host.on('ai-tool', (id, name, input) => {
  let reply;
  try {
    if (name === 'get_project') reply = { project: P };
    else if (name === 'add_media') { H.apply({ op: 'add_media', media: input.media }, 'claude', 'Import'); reply = { project: P }; }
    else if (name === 'edit') {
      const ops = input.ops || []; checkScope(ops, input.scope || aiScope);
      const before = new Set(P.clips.map(c => c.id));
      const lines = H.apply(ops, 'claude', input.summary || 'Claude edit');
      const now = P.clips.map(c => c.id); for (const id of now) if (!before.has(id)) aiCreated.add(id);
      aiTouched = new Set([...now.filter(id => !before.has(id)), ...ops.map(o => o.id).filter(Boolean)]);
      renderTimeline(); reply = { lines, project: P };
    }
    else if (typeof aiToolExt !== 'undefined' && aiToolExt[name]) reply = aiToolExt[name](input);
    else reply = { error: 'unknown tool ' + name, project: P };
  } catch (e) { reply = { error: e.message, project: P }; }
  host.send('ai-tool-result', id, JSON.parse(JSON.stringify(reply)));
});
function checkScope(ops, scope) {
  if (!scope || (!scope.clips && !scope.range)) return;
  const allowed = new Set([...(scope.clips || []), ...aiCreated]); const [a, b] = scope.range || [0, 1e9];
  for (const o of ops) {
    if (['note', 'update_media', 'add_marker', 'add_media'].includes(o.op)) continue;
    if (o.op === 'add_clip') { const c = o.clip || {}; if (c.start < a - .01 || c.start + (c.dur || 0) > b + .01) throw new Error(`outside scope: new clip must lie within ${a.toFixed(2)}–${b.toFixed(2)} s`); continue; }
    const ids = o.ids || (o.id ? [o.id] : []);
    if (scope.clips && ids.some(id => !allowed.has(id))) throw new Error('outside scope: you may only change clips ' + [...allowed].join(', '));
    if (!scope.clips && ids.length) for (const id of ids) { const c = P.clips.find(x => x.id === id); if (c && (TF.clipEnd(c) <= a || c.start >= b)) throw new Error('outside scope: clip ' + id + ' is outside the In–Out range'); }
    if (['set_project', 'close_gaps', 'set_track', 'ripple_insert'].includes(o.op)) throw new Error('outside scope: ' + o.op + ' changes the whole project');
  }
}
$('#chatSend').onclick = () => { const t = $('#chatText').value.trim(); if (!t) return; $('#chatText').value = ''; runAI(t, scopeMode === 'selection' ? selectionScope() : scopeMode === 'inout' ? { range: [P.inPoint, P.outPoint] } : null); };
$('#chatText').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); $('#chatSend').click(); } };
$('#chatStop').onclick = () => host.invoke('ai-stop');
$('#askGo').onclick = () => { const t = $('#askText').value.trim(); if (!t) return; $('#askText').value = ''; switchTab('right', 'claude'); runAI(t, selectionScope()); };
$('#askText').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') $('#askGo').click(); if (e.key === 'Escape') { sel = new Set(); renderTimeline(); } };

function renderHistory() {
  const h = $('#hist'); h.innerHTML = '';
  for (const e of H.log.slice().reverse().slice(0, 200)) { const d = el('div', 'he'); d.innerHTML = `<span class="by ${e.by}">${e.by}</span><b>${esc(e.group || e.lines[0])}</b><small>${esc(e.lines.slice(0, 4).join(' · '))}${e.lines.length > 4 ? ' …' : ''}</small>`; h.appendChild(d); }
}

// ---------------- export ----------------
const RES_LIST = [['1080x1920', '9:16 · 1080×1920 · Reels / TikTok / Shorts'], ['720x1280', '9:16 · 720×1280 · light'], ['2160x3840', '9:16 · 4K'], ['1920x1080', '16:9 · 1080p · YouTube'], ['1280x720', '16:9 · 720p'], ['3840x2160', '16:9 · 4K UHD'], ['1080x1080', '1:1 · feed'], ['1080x1350', '4:5 · feed portrait']];
let expDir = null;
function openExport() {
  const native = `${P.w}x${P.h}`;
  $('#expVideo').innerHTML = RES_LIST.map(([k, l]) => { const [w, h] = k.split('x').map(Number); const same = Math.abs(w / h - P.w / P.h) < .01; return `<label><input type="checkbox" value="${k}" ${k === native ? 'checked' : ''}> ${l}${same ? '' : '<small>reframed</small>'}</label>`; }).join('');
  expDir = P.client ? [env.root, P.client, '03-final'].join(SEP) : P.folder + SEP + 'export';
  $('#expDir').textContent = expDir; $('#expProg').classList.add('hidden'); $('#expGo').disabled = false;
  $('#exportDlg').showModal();
}
$('#expPick').onclick = async () => { const d = await host.invoke('pick-folder', expDir); if (d) { expDir = d; $('#expDir').textContent = d; } };
$('#expGo').onclick = async () => {
  if (playing) stop();
  const opts = { dir: expDir, video: $$('#expVideo input:checked').map(i => i.value), fps: +$('#expFps').value || 0, mp3: $('#expMp3').checked, wav: $('#expWav').checked,
    music: $('#expMusic').checked, speech: $('#expSpeech').checked, sfx: $('#expSfx').checked, audioFormat: $('#expAfmt').value,
    transcript: [['txt', '#expTxt'], ['srt', '#expSrt'], ['vtt', '#expVtt']].filter(([, s]) => $(s).checked).map(([k]) => k), thumbnail: $('#expThumb').checked,
    range: document.querySelector('input[name=rng]:checked').value === 'io' && P.inPoint != null && P.outPoint != null ? [P.inPoint, P.outPoint] : null };
  if ((opts.transcript.length) && !TF.timelineWords(P).length) { toast('No transcript yet — select a speech clip and press Transcribe.', 5000); opts.transcript = []; }
  $('#expGo').disabled = true; $('#expProg').classList.remove('hidden'); $('#expStep').textContent = 'Starting…';
  try { const r = await host.invoke('export', { project: P, opts }); $('#expStep').innerHTML = `Done — ${r.files.length} file(s) <a href="#" id="expShow" style="color:var(--acc)">show in folder</a>`; $('#expShow').onclick = e => { e.preventDefault(); host.invoke('reveal', r.files[0]); }; }
  catch (e) { $('#expStep').textContent = 'Failed: ' + e.message; }
  $('#expGo').disabled = false;
};
host.on('export-progress', m => { $('#expBar').style.width = Math.round((m.pct || 0) * 100) + '%'; $('#expStep').textContent = m.step + (m.eta ? ` · ~${m.eta}s left` : ''); });

// ---------------- UI wiring ----------------
function switchTab(side, t) { const root = side === 'left' ? '.panel.left' : '.panel.right'; $$(root + ' .tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $$(root + ' .pbody').forEach(p => p.classList.toggle('hidden', p.dataset.p !== t)); }
$$('#leftTabs button').forEach(b => b.onclick = () => switchTab('left', b.dataset.t));
$$('#rightTabs button').forEach(b => b.onclick = () => switchTab('right', b.dataset.t));
$$('#ws button').forEach(b => b.onclick = () => {
  $$('#ws button').forEach(x => x.classList.toggle('on', x === b)); document.body.className = 'ws-' + b.dataset.ws;
  if (b.dataset.ws === 'sound') switchTab('left', 'audio'); if (b.dataset.ws === 'motion') switchTab('left', 'text'); if (b.dataset.ws === 'color') switchTab('left', 'fx'); if (b.dataset.ws === 'edit') switchTab('left', 'media');
  switchTab('right', 'insp'); renderTimeline(); renderInspector(); setTimeout(fitStage, 0);
});
function setTool(t) { tool = t; $$('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); $('#lanes').style.cursor = t === 'razor' ? 'crosshair' : t === 'text' ? 'text' : ''; }
$$('#tools button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
$('#tSafe').onclick = e => { e.target.classList.toggle('on'); $('#safe').classList.toggle('on'); };
$('#monZoom').onchange = fitStage;
$('#tZoom').oninput = e => { pps = +e.target.value; renderTimeline(); };
$('#lanes').addEventListener('pointerdown', lanesDown);
$('#lanes').addEventListener('contextmenu', e => { if (e.target.closest('.clip')) return; e.preventDefault(); const r = $('#lanes').getBoundingClientRect(); laneMenu(e, laneAt(e.clientY), snapT((e.clientX - r.left) / pps)); });
$('#bPlay').onclick = play; $('#bStart').onclick = () => seek(0); $('#bEnd').onclick = () => seek(rangeEnd());
$('#bPrev').onclick = () => seek(T - 1 / P.fps); $('#bNext').onclick = () => seek(T + 1 / P.fps);
$('#bIn').onclick = () => apply({ op: 'set_in_out', in: T }, 'Mark in'); $('#bOut').onclick = () => apply({ op: 'set_in_out', out: T }, 'Mark out');
$('#bLoop').onclick = e => { loopOn = !loopOn; e.target.classList.toggle('on', loopOn); };
$('#btnUndo').onclick = () => { H.doUndo(); }; $('#btnRedo').onclick = () => { H.doRedo(); };
$('#btnExport').onclick = openExport;
$('#btnHome').onclick = () => { stop(); save(); $('#editor').classList.add('hidden'); $('#start').classList.remove('hidden'); initStart(); };
$('#pName').onchange = e => apply({ op: 'set_project', name: e.target.value }, 'Rename');
$('#binAdd').onclick = async () => { const f = await host.invoke('pick-files'); if (f.length) importToBin({ files: f }); };
$('#binFolder').onclick = async () => { const d = await host.invoke('pick-folder', env.root); if (d) { P.sourceFolder = P.sourceFolder || d; importToBin({ folder: d }); } };
$('#binSearch').oninput = renderBin;
// timeline height drag
$('#timeline').addEventListener('pointerdown', e => { const r = $('#timeline').getBoundingClientRect(); if (e.clientY - r.top > 4) return; const mv = ev => { const h = Math.max(160, Math.min(innerHeight - 260, innerHeight - ev.clientY)); $('#editor').style.setProperty('--tlh', h + 'px'); fitStage(); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
// razor preview line
$('#lanesWrap').addEventListener('pointermove', e => { let rl = $('.razor-line'); if (tool !== 'razor') { if (rl) rl.remove(); return; } if (!rl) { rl = el('div', 'razor-line'); rl.style.display = 'block'; $('#lanesWrap').appendChild(rl); } const r = $('#lanes').getBoundingClientRect(); rl.style.left = (e.clientX - r.left) + 'px'; });
$('#lanesWrap').addEventListener('scroll', () => { $('#heads').scrollTop = $('#lanesWrap').scrollTop; });
$('#lanesWrap').addEventListener('wheel', e => { if (e.ctrlKey || e.altKey) { e.preventDefault(); const r = $('#lanes').getBoundingClientRect(); const tAt = (e.clientX - r.left) / pps; pps = Math.max(10, Math.min(400, pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); $('#tZoom').value = pps; renderTimeline(); $('#lanesWrap').scrollLeft = tAt * pps - (e.clientX - $('#lanesWrap').getBoundingClientRect().left); } }, { passive: false });

function splitAtPlayhead() { const ids = sel.size ? [...sel] : null; if (ids) apply(ids.map(id => ({ op: 'split_clip', id, t: T })), 'Split'); else apply({ op: 'split_clip', t: T }, 'Split all'); }
function delSel(ripple) { if (!sel.size) return; apply({ op: 'delete_clip', ids: [...sel], ripple }, ripple ? 'Ripple delete' : 'Delete'); sel = new Set(); renderAll(); }
function editPoints() { const s = new Set([0]); for (const c of P.clips) { s.add(c.start); s.add(TF.clipEnd(c)); } return [...s].sort((a, b) => a - b); }

// boot happens at the end of ui2.js
