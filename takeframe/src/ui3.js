// Takeframe UI part 3: guided 6-step workflow (style from references → tests → storyboard → edit)
// and automatic captions from the transcript.
'use strict';

// =====================================================================================
// AI tools handled in the renderer
// =====================================================================================
const aiToolExt = {
  set_style(input) {
    const st = Object.assign({}, input, { learnedAt: new Date().toISOString(), refs: (P.style && P.style.refs) || [] });
    H.apply({ op: 'set_meta', key: 'style', value: st }, 'claude', 'Style: ' + (input.name || 'learned'));
    setFlow('style', 'draft'); renderFlow(); switchTab('right', 'flow');
    return { project: P };
  },
  set_storyboard(input) {
    H.apply({ op: 'set_meta', key: 'storyboard', value: input.rows || [] }, 'claude', 'Storyboard (' + (input.rows || []).length + ' rows)');
    if (input.critique) H.apply({ op: 'set_meta', key: 'boardCritique', value: input.critique }, 'claude', 'Storyboard notes');
    setFlow('board', 'draft'); renderFlow(); switchTab('right', 'flow');
    return { project: P };
  },
};
// generic project field op (undoable)
TF.OPS.set_meta = (p, a) => { p[a.key] = a.value; return `${a.key} updated`; };

// =====================================================================================
// WORKFLOW PANEL
// =====================================================================================
const FLOW_STEPS = [
  ['src', 'Sources', 'Everything in one folder: script, footage, voice-over, logo.'],
  ['style', 'Style training', '15–20 reference images in ONE consistent style. Claude only describes the style — you approve it.'],
  ['test', 'Style test', 'Claude makes 3 still frames from 3 script lines. Inconsistent? Change the references, not the wording.'],
  ['anim', 'Animation test', 'Claude animates the first test frame exactly as its script line says.'],
  ['board', 'Storyboard', 'Per line: what is on screen, how it moves, what you hear. Claude drafts it, or you write it and Claude critiques.'],
  ['edit', 'Final edit', 'Claude builds the video from the approved style, script and storyboard. Then iterate clip by clip.'],
];
function setFlow(k, v) { P.workflow = Object.assign({}, P.workflow, { [k]: v }); save(); }
const flowState = k => (P.workflow || {})[k] || '';
let styleLib = [];
async function renderFlow() {
  const box = $('#flow'); if (!box || !P) return;
  const wf = P.workflow || {}; const st = P.style; const refs = (st && st.refs) || P.media.filter(m => m.ref).map(m => m.id);
  const long = P.media.filter(m => m.type === 'video' && m.duration > 120);
  const done = k => wf[k] === 'approved' || (k === 'src' && (P.sourceFolder || P.media.length));
  let h = '';
  FLOW_STEPS.forEach(([k, title, hint], i) => {
    const state = done(k) ? 'ok' : wf[k] === 'draft' ? 'draft' : '';
    h += `<section class="fs ${state}" data-k="${k}"><div class="fs-h"><span class="fs-n">${state === 'ok' ? '✓' : i + 1}</span><b>${title}</b><span class="fs-st">${state === 'ok' ? 'approved' : state === 'draft' ? 'waiting for you' : ''}</span></div><p>${hint}</p><div class="fs-b">`;
    if (k === 'src') {
      h += `<div class="fs-row">${P.sourceFolder ? `<code>${esc(P.sourceFolder)}</code>` : '<span class="muted">No folder connected.</span>'}<button class="btn sm" data-do="folder">${P.sourceFolder ? 'Change' : 'Connect'}…</button></div>`;
      if (long.length) h += `<div class="warn">${long.length} clip(s) longer than 2 min — work in chunks (set In/Out and use “Only In → Out”).</div>`;
    }
    if (k === 'style') {
      h += `<div class="refs">${refs.map(id => { const m = P.media.find(x => x.id === id); return m ? `<span style="background-image:url('${m.thumbUrl || m.url}')" title="${esc(m.name)}"></span>` : ''; }).join('')}<button class="ref-add" data-do="refs" title="Add reference images">＋</button></div>
        <div class="fs-row"><span class="muted">${refs.length} reference(s)${refs.length && refs.length < 10 ? ' · 15–20 works best' : ''}</span><button class="btn sm primary" data-do="learn" ${refs.length ? '' : 'disabled'}>✦ Learn style</button></div>`;
      if (styleLib.length) h += `<div class="fs-row"><select id="styleLib"><option value="">Use a saved style…</option>${styleLib.map((s, j) => `<option value="${j}">${esc(s.name)}</option>`).join('')}</select></div>`;
      if (st) h += `<div class="style-card"><div class="sw">${(st.palette || []).map(c => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}</div>
        <b>${esc(st.name || 'Style')}</b><div class="muted">${esc((st.fonts || []).join(' · '))}</div>
        <textarea id="styleTxt" rows="6">${esc([st.summary, st.elements && 'Elements: ' + st.elements, st.textures && 'Textures: ' + st.textures, st.motion && 'Motion: ' + st.motion, st.avoid && 'Avoid: ' + st.avoid].filter(Boolean).join('\n\n'))}</textarea>
        <div class="fs-row"><button class="btn sm" data-do="savestyle">Save to style library</button><button class="btn sm primary" data-do="ok" data-k="style">${wf.style === 'approved' ? 'Approved ✓' : 'Approve style'}</button></div></div>`;
    }
    if (k === 'test') h += `<div class="fs-row"><button class="btn sm primary" data-do="test" ${st ? '' : 'disabled'}>✦ Make 3 test frames</button><button class="btn sm" data-do="ok" data-k="test">${wf.test === 'approved' ? 'Approved ✓' : 'Approve'}</button></div>`;
    if (k === 'anim') h += `<div class="fs-row"><button class="btn sm primary" data-do="anim" ${st ? '' : 'disabled'}>✦ Animate first frame</button><button class="btn sm" data-do="ok" data-k="anim">${wf.anim === 'approved' ? 'Approved ✓' : 'Approve'}</button></div>`;
    if (k === 'board') {
      h += `<label class="fld sm"><span>Script</span><textarea id="flowScript" rows="4" placeholder="Paste the script / voice-over text">${esc(P.script || '')}</textarea></label>
        <div class="board">${(P.storyboard || []).map((r, j) => `<div class="br" data-i="${j}"><input data-f="t" value="${esc(r.t || '')}" placeholder="0:00"><textarea data-f="line" rows="2" placeholder="Script line">${esc(r.line || '')}</textarea><textarea data-f="screen" rows="2" placeholder="On screen">${esc(r.screen || '')}</textarea><textarea data-f="motion" rows="1" placeholder="Motion">${esc(r.motion || '')}</textarea><textarea data-f="sound" rows="1" placeholder="Sound">${esc(r.sound || '')}</textarea><button class="rst" data-del="${j}" title="Remove row">✕</button></div>`).join('')}</div>
        ${P.boardCritique ? `<div class="crit"><b>Claude's notes</b>${esc(P.boardCritique)}</div>` : ''}
        <div class="fs-row wrap"><button class="btn sm" data-do="row">+ Row</button><button class="btn sm primary" data-do="draft">✦ Draft from script</button><button class="btn sm" data-do="critique" ${(P.storyboard || []).length ? '' : 'disabled'}>✦ Critique mine</button><button class="btn sm" data-do="ok" data-k="board">${wf.board === 'approved' ? 'Approved ✓' : 'Approve'}</button></div>`;
    }
    if (k === 'edit') {
      const ready = wf.style === 'approved' && wf.board === 'approved';
      h += `${ready ? '' : '<div class="warn">Approve the style and the storyboard first — Claude works much better with them.</div>'}
        <div class="fs-row"><button class="btn sm primary" data-do="build">✦ Build final video</button></div>
        <p class="muted">Then select any clip and use the ✦ box to change only that part. Every note becomes a rule.</p>`;
    }
    h += '</div></section>';
  });
  box.innerHTML = h;
  // bindings
  box.querySelectorAll('[data-do]').forEach(b => b.onclick = () => flowDo(b.dataset.do, b.dataset.k));
  const sl = $('#styleLib'); if (sl) sl.onchange = () => { const s = styleLib[+sl.value]; if (s) { H.apply({ op: 'set_meta', key: 'style', value: s }, 'you', 'Style: ' + s.name); setFlow('style', 'approved'); renderFlow(); } };
  const stx = $('#styleTxt'); if (stx) stx.onchange = () => { H.apply({ op: 'set_meta', key: 'style', value: Object.assign({}, P.style, { summary: stx.value, elements: '', textures: '', motion: '', avoid: '' }) }, 'you', 'Edit style'); };
  const sc = $('#flowScript'); if (sc) sc.onchange = () => H.apply({ op: 'set_meta', key: 'script', value: sc.value }, 'you', 'Script');
  box.querySelectorAll('.br [data-f]').forEach(inp => inp.onchange = () => { const i = +inp.closest('.br').dataset.i; const rows = JSON.parse(JSON.stringify(P.storyboard)); rows[i][inp.dataset.f] = inp.value; H.apply({ op: 'set_meta', key: 'storyboard', value: rows }, 'you', 'Storyboard edit'); });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const rows = P.storyboard.filter((_, j) => j !== +b.dataset.del); H.apply({ op: 'set_meta', key: 'storyboard', value: rows }, 'you', 'Remove storyboard row'); renderFlow(); });
}
async function flowDo(what, k) {
  const ask = (text, scope) => { switchTab('right', 'claude'); runAI(text, scope || null); };
  if (what === 'folder') return $('#foldPick').click();
  if (what === 'ok') { setFlow(k, flowState(k) === 'approved' ? 'draft' : 'approved'); return renderFlow(); }
  if (what === 'refs') {
    const f = await host.invoke('pick-files'); if (!f.length) return;
    const ms = (await host.invoke('scan', { files: f })).filter(m => m.type === 'image').map(m => Object.assign(m, { ref: true }));
    if (!ms.length) return toast('Pick image files');
    H.apply({ op: 'add_media', media: ms }, 'you', `+${ms.length} style reference(s)`);
    const ids = P.media.filter(m => m.ref).map(m => m.id);
    H.apply({ op: 'set_meta', key: 'style', value: Object.assign({}, P.style || { name: 'Draft', summary: '', palette: [] }, { refs: ids }) }, 'you', 'Style references');
    return renderFlow();
  }
  if (what === 'savestyle') { if (!P.style) return; const f = await host.invoke('style-save', Object.assign({}, P.style, { refs: undefined })); styleLib = await host.invoke('style-list'); toast('Saved: ' + f, 3500); return renderFlow(); }
  const refs = (P.style && P.style.refs) || [];
  if (what === 'learn') return ask(`STEP 2 — STYLE TRAINING. Do not edit the timeline. Look at these ${refs.length} reference images with view_media: ${refs.join(', ')}. They show the visual style I want for the motion graphics and animations (their content does not matter). Describe what you understood — palette (hex), shapes and elements, textures, typography (pick fonts from the Takeframe list), how things should move, what to avoid — and save it with set_style. Then stop and wait for my approval.`);
  if (what === 'test') return ask(`STEP 3 — STYLE TEST. Using the project style, create 3 STILL frames (no animation, anim in/out 'none') from 3 different lines of the script${P.script ? '' : ' (no script yet — use 3 lines about the project)'}. Build each as layered shape + title clips, 3 s each, starting at ${(Math.ceil(TF.projectDuration(P)) + 2)} s so they do not touch the edit, and give every clip tag:"test". Then look_at the middle of each frame and stop.`);
  if (what === 'anim') return ask(`STEP 4 — ANIMATION TEST. Take the first test frame (tag:"test") and animate it exactly as its script line says — 3–5 s, every element with its own entrance, eased (expoOut/backOut), maybe one keyframed move. Keep tag:"test". look_at 4 moments, then stop.`);
  if (what === 'draft') { if (!P.script) return toast('Paste the script first'); return ask(`STEP 5 — STORYBOARD. From the script, write a storyboard with set_storyboard: one row per line or beat with time, the line, what is on screen (in the approved style), how it moves (every scene a different motion) and the sound (music hits, SFX). Text must stay readable (~1 s per word + 1 s). Hook in the first 2 s. Do not edit the timeline yet.`); }
  if (what === 'critique') return ask(`STEP 5 — STORYBOARD CRITIQUE. This is my storyboard. Critique it like a senior motion designer (pacing, readability, variety of motion, what is missing, what to cut) and return an improved version with set_storyboard, putting your notes in critique. Do not edit the timeline.`);
  if (what === 'build') return ask(`STEP 6 — FINAL EDIT. Delete every clip with tag:"test" first. Then, using the approved storyboard, the script and the approved style, create the final video on the timeline: footage, graphics, captions where useful, transitions, new music, SFX. Then look_at key frames and fix problems. Tell me what to review.`);
}
// panel refresh hooks
const _renderAll3 = renderAll; renderAll = function () { _renderAll3(); if (!$('[data-p="flow"]').classList.contains('hidden')) renderFlow(); };
$('#rightTabs [data-t="flow"]').addEventListener('click', async () => { styleLib = await host.invoke('style-list').catch(() => []); renderFlow(); });

// =====================================================================================
// AUTO CAPTIONS
// =====================================================================================
async function makeCaptions() {
  if (!P) return;
  let src = P.clips.filter(c => sel.has(c.id));
  if (!src.length) src = TF.audioClips(P, 'speech');
  src = src.filter(c => { const m = TF.mediaOf(P, c); return m && (m.type === 'audio' || m.hasAudio); });
  if (!src.length) return toast('No speech clip — select a clip with talking or put voice on A3');
  // transcribe what is missing
  for (const c of src) {
    const m = TF.mediaOf(P, c); if (m.transcript) continue;
    toast('Transcribing ' + m.name + '…', 60000);
    try { const tr = await host.invoke('transcribe', { src: m.path }); H.apply({ op: 'update_media', id: m.id, patch: { transcript: tr } }, 'you', 'Transcribe ' + m.name); }
    catch (e) { return toast(e.message, 6000); }
  }
  const ids = new Set(src.map(c => c.id));
  const words = TF.timelineWords(P).filter(w => ids.has(w.clip));
  if (!words.length) return toast('No words found in the transcript');
  // groups of max 3 words, break on punctuation or pauses
  const groups = []; let g = null;
  const WEAK = new Set(['the', 'a', 'an', 'to', 'and', 'of', 'in', 'on', 'for', 'with', 'my', 'your', 'je', 'in', 'na', 'v', 'za', 'da', 'ki', 'se', 'pa', 'z', 's', 'po', 'od', 'do']);
  for (const w of words) {
    const last = g && g.words[g.words.length - 1];
    if (!g || g.words.length >= 3 || w.s - g.e > .45 || /[.!?,:;]$/.test(last.w)) {
      const ng = { s: w.s, e: w.e, words: [] };
      // never end a caption on a weak word ("the", "in", "za") — carry it into the next one
      if (g && g.words.length > 1 && WEAK.has(last.w.toLowerCase()) && w.s - last.e < .45) { g.words.pop(); g.e = g.words[g.words.length - 1].e; ng.s = last.s; ng.words.push(last); }
      g = ng; groups.push(g);
    }
    g.words.push(w); g.e = w.e;
  }
  // hold each group until the next one (no empty frames), max +0.6 s after the last word
  groups.forEach((x, i) => { const nx = groups[i + 1]; x.end = nx && nx.s - x.e < .6 ? nx.s : x.e + .35; });
  const vertical = P.h > P.w; const size = Math.round(Math.min(P.w, P.h) * (vertical ? .075 : .06));
  let tr = P.tracks.find(t => t.kind === 'video' && t.name === 'Captions');
  const ops = [];
  if (!tr) { H.apply({ op: 'add_track', kind: 'video', name: 'Captions' }, 'you', 'Captions track'); tr = P.tracks.find(t => t.kind === 'video' && t.name === 'Captions'); }
  else ops.push({ op: 'delete_clip', ids: P.clips.filter(c => c.track === tr.id && c.tag === 'caption').map(c => c.id) });
  for (const x of groups) ops.push({ op: 'add_clip', clip: { track: tr.id, type: 'title', tag: 'caption', start: +x.s.toFixed(3), dur: +Math.max(.2, x.end - x.s).toFixed(3),
    text: x.words.map(w => w.w).join(' ').replace(/\s+([,.!?])/g, '$1'),
    style: { font: 'Archivo', size, weight: 850, stretch: 88, color: '#ffffff', bg: 'rgba(10,11,13,.82)', width: .9, lh: 1.05, tracking: -.01 },
    anim: { in: 'pop', out: 'none', inDur: .16, stagger: .035, ease: 'backOut' }, props: { y: Math.round(P.h * (vertical ? .2 : .32)) } } });
  apply(ops, `Captions (${groups.length})`);
  toast(`${groups.length} captions on ${tr.id} — select one and edit the style, Claude can restyle all`, 4000);
}
ACTIONS.push({ group: 'Audio', id: 'captions.make', label: 'Auto captions from speech', def: ['Ctrl+Shift+C'], run: makeCaptions });
ACT['captions.make'] = ACTIONS[ACTIONS.length - 1];
ACTIONS.push({ group: 'Claude', id: 'flow.open', label: 'Workflow (6 steps)', def: ['Ctrl+Shift+W'], run: () => { switchTab('right', 'flow'); $('#rightTabs [data-t="flow"]').click(); } });
ACT['flow.open'] = ACTIONS[ACTIONS.length - 1];
// button in the Audio panel
(() => { const gen = $('.musicgen'); if (!gen) return; const h = el('div', 'sec-h', 'Captions <em>from the transcript</em>'); const b = el('button', 'btn wide', '✦ Auto captions <kbd>Ctrl+Shift+C</kbd>'); b.onclick = makeCaptions; gen.after(h, b); })();
