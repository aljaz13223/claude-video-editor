// Takeframe UI part 5: Premium skins (Projection room, Studio, more later), AI Dock,
// "Ask Claude" bar with quick chips + push-to-talk voice, and local "Remove silences".
'use strict';

// =====================================================================================
// SKINS (Premium only). Add a skin: put skins/<id>.css (selectors html.premium.skin-<id>) and an entry here.
// =====================================================================================
const SKINS = [
  { id: 'projection', name: 'Projection room', desc: 'Dark grading suite, lit monitor' },
  { id: 'studio', name: 'Studio', desc: 'AI Dock, Ask Claude bar, colour tracks' },
  { id: 'soon', name: 'More skins soon…', disabled: true },
];
let curSkin = 'projection';
function applySkin(id, persist) {
  if (!SKINS.find(s => s.id === id && !s.disabled)) id = 'projection';
  curSkin = id;
  for (const s of SKINS) document.documentElement.classList.toggle('skin-' + s.id, s.id === id);
  $$('.skin-sel').forEach(sel => { sel.value = id; });
  if (persist) host.invoke('settings-set', { skin: id });
  const studio = isStudio();
  if (studio && P) { renderDock(); if (!sel.size) switchTab('right', 'dock'); }
  if (!studio && $('#rightTabs [data-t="dock"]').classList.contains('on')) switchTab('right', 'insp');
  renderChips(); setTimeout(() => typeof fitStage === 'function' && fitStage(), 60);
}
const isStudio = () => document.documentElement.classList.contains('premium') && curSkin === 'studio';
$$('.skin-sel').forEach(sel => {
  sel.innerHTML = SKINS.map(s => `<option value="${s.id}" ${s.disabled ? 'disabled' : ''}>${esc(s.name)}</option>`).join('');
  sel.onchange = () => applySkin(sel.value, true);
});
// premium ⇄ lite switch also has to refresh the skin classes
const _applyEdition5 = applyEdition;
applyEdition = function (ed, persist) { _applyEdition5(ed, persist); applySkin(curSkin); };
host.invoke('env').then(e => { curSkin = e.skin || 'projection'; applySkin(curSkin); }).catch(() => {});

// =====================================================================================
// AI DOCK (Studio): the AI actions in one place; turns into the Inspector when a clip is selected
// =====================================================================================
const DOCK = {
  Edit: [
    ['cut', 'Remove silences', 'Cut pauses from speech — keeps natural breaths', () => removeSilences()],
    ['short', 'Make it shorter', 'Claude tightens the edit to the strongest parts', () => askClaude('Make it shorter: keep the strongest parts, tighten pauses and repeated ideas, keep the story clear. Tell me the new length.')],
    ['best', 'Find best moments', 'Claude reads the transcript and marks the best clips', () => askClaude('Read the transcripts of all speech clips (transcribe them if needed) and put markers on the 3–5 strongest moments (hook, emotional line, clear idea) with a short note on each. Do not cut anything.')],
    ['pace', 'Cut on the beat', 'Snap cuts to the music bars', () => askClaude('Move the cuts on the picture tracks so they land on the music bars/beats (use the music media bar times). Keep text readable.')],
  ],
  Generate: [
    ['music', 'New music', 'A fresh track in a style not used before', () => runAct('audio.music')],
    ['caps', 'Add captions', 'Captions from what is said (Text panel style)', () => makeCaptions()],
    ['motion', 'Animate text', 'Claude adds motion graphics for key lines', () => askClaude('Add motion graphics for the key lines: titles and shapes in the project style, each scene a different motion, readable timing, on their own graphics tracks. Then look_at the frames.')],
    ['broll', 'Add B-roll from folder', 'Claude picks matching shots from your folder', () => askClaude('Use the connected folder / bin: find shots that illustrate what is being said and place them as B-roll on V2 over the speech, 1.2–3 s each, never over the hook. View the media first.')],
  ],
  Enhance: [
    ['audio', 'Improve audio', 'Remove noise and room, like Adobe Podcast', () => { const c = selClips()[0] || TF.audioClips(P, 'speech')[0]; if (!c) return toast('Select a clip with speech'); sel = new Set([c.id]); renderTimeline(); enhanceSel(); }],
    ['color', 'Match color', 'One consistent look across all clips', () => askClaude('Give all picture clips one consistent, natural look (match brightness, contrast, saturation and temperature with fx). Do not change the timing.')],
    ['look', 'Cinematic look', 'Warm contrast, gentle push-ins', () => askClaude('Make it more cinematic: a warm contrasty grade on picture clips, slow push-ins (anim.kb ≈ 0.05) on stills, softer transitions. Keep text readable.')],
    ['stems', 'Split voice / music', 'Separate a mixed clip into two tracks', () => { const c = selClips()[0]; if (!c) return toast('Select a clip with sound first'); focusInsp('volume'); setTimeout(() => $('#stemGo') && $('#stemGo').click(), 80); }],
  ],
  Analyze: [
    ['review', 'Review my edit', 'Honest notes: hook, pacing, readability', () => askClaude('Review this edit like a senior editor. Look at frames across the timeline. Give me the 5 most important notes (hook, pacing, readability, sound, ending) with timestamps. Do NOT change anything.')],
    ['read', 'Check readability', 'Is every text on screen long enough?', () => askClaude('Check every text/title clip: is it on screen long enough (~1 s per word + 1 s), inside the safe zone and not covering faces? List problems with timestamps; do not change anything yet.')],
    ['tr', 'Transcript', 'Transcribe the speech clips', async () => { const cs = TF.audioClips(P, 'speech'); if (!cs.length) return toast('No speech clips'); for (const c of cs) { const m = TF.mediaOf(P, c); if (m.transcript) continue; toast('Transcribing ' + m.name + '…', 60000); const tr = await host.invoke('transcribe', { src: m.path }); H.apply({ op: 'update_media', id: m.id, patch: { transcript: tr } }, 'you', 'Transcribe'); } toast('Transcript ready'); }],
    ['len', 'Length & formats', 'What to export for which platform', () => askClaude('Look at the project length and format and tell me which exports make sense (Reels/TikTok/Shorts/YouTube/feed), and anything to fix per format. Do not change anything.')],
  ],
};
const DOCK_IC = { cut: '✂', short: '⇥', best: '★', pace: '♩', music: '♫', caps: 'Cc', motion: 'A', broll: '▣', audio: '◉', color: '◐', look: '✦', stems: '⫼', review: '✎', read: 'Aa', tr: '≡', len: '⧉' };
let dockTab = 'Edit';
function renderDock() {
  const d = $('#dock'); if (!d || !P) return;
  const model = (typeof env !== 'undefined' && env && env.model || 'claude').replace('claude-', '').replace(/-(\d)-(\d)/, ' $1.$2').replace(/^\w/, c => c.toUpperCase());
  d.innerHTML = `<div class="dk-h"><b>AI Dock</b><span class="dk-model" title="${esc(env && env.model || '')}">${esc(model)}</span></div>
    <div class="dk-tabs">${Object.keys(DOCK).map(k => `<button data-k="${k}" class="${k === dockTab ? 'on' : ''}">${k}</button>`).join('')}</div>
    <div class="dk-list">${DOCK[dockTab].map(([id, t, desc], i) => `<button class="dk-card" data-i="${i}"><span class="dk-ic dk-${id}">${DOCK_IC[id] || '✦'}</span><b>${esc(t)}</b><small>${esc(desc)}</small></button>`).join('')}</div>
    <div class="dk-scope">${sel.size ? `Works on the ${sel.size} selected clip(s)` : 'Works on the whole project — select clips to limit it'}</div>`;
  d.querySelectorAll('.dk-tabs button').forEach(b => b.onclick = () => { dockTab = b.dataset.k; renderDock(); });
  d.querySelectorAll('.dk-card').forEach(b => b.onclick = () => DOCK[dockTab][+b.dataset.i][3]());
}
function askClaude(text) {
  const scope = sel.size ? selectionScope() : null;
  switchTab('right', 'claude'); runAI(text, scope);
}
// selection changes: in Studio the dock becomes the Inspector for a selected clip, and back
const _renderInspector5 = renderInspector;
renderInspector = function (soft) {
  _renderInspector5(soft);
  if (!isStudio() || soft) return;
  const onDock = $('#rightTabs [data-t="dock"]').classList.contains('on'), onInsp = $('#rightTabs [data-t="insp"]').classList.contains('on');
  if (sel.size && onDock) switchTab('right', 'insp');
  else if (!sel.size && onInsp) { switchTab('right', 'dock'); renderDock(); }
  else if (onDock) renderDock();
  renderChips();
};
$('#rightTabs [data-t="dock"]').addEventListener('click', renderDock);

// =====================================================================================
// ASK CLAUDE BAR + VOICE
// =====================================================================================
const CHIPS = ['Make it shorter', 'Add captions', 'More cinematic', 'Remove silences', 'Better hook'];
function renderChips() {
  const c = $('#abChips'); if (!c) return;
  c.innerHTML = CHIPS.map(t => `<button>${esc(t)}</button>`).join('');
  c.querySelectorAll('button').forEach(b => b.onclick = () => runChip(b.textContent));
  const sc = $('#abScope'); if (sc) sc.textContent = P && sel.size ? `${sel.size} selected` : '';
}
function runChip(t) {
  if (t === 'Add captions') return makeCaptions();
  if (t === 'Remove silences') return removeSilences();
  if (t === 'More cinematic') return DOCK.Enhance[2][3]();
  if (t === 'Make it shorter') return DOCK.Edit[1][3]();
  if (t === 'Better hook') return askClaude('Make the first 2 seconds a stronger hook: the most interesting line or image first, a bold title, a hit on the first cut. Change only the start.');
}
function sendBar() {
  const t = $('#abText').value.trim(); if (!t) return; $('#abText').value = '';
  askClaude(t);
}
$('#abSend').onclick = sendBar;
$('#abText').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); sendBar(); } if (e.key === 'Escape') e.target.blur(); });

// push-to-talk: hold the mic button (or Ctrl+Space) → local Whisper → text in the bar → send
let rec = null, recChunks = [], recStart = 0;
async function startVoice() {
  if (rec) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    rec = new MediaRecorder(stream, { mimeType: 'audio/webm' }); recChunks = []; recStart = Date.now();
    rec.ondataavailable = e => recChunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const dur = Date.now() - recStart; const blob = new Blob(recChunks, { type: 'audio/webm' }); rec = null; $('#askbar').classList.remove('rec');
      if (dur < 400) return toast('Hold the mic while you talk');
      $('#abText').value = ''; $('#abText').placeholder = 'Listening… transcribing locally';
      try {
        const r = await host.invoke('voice', { data: new Uint8Array(await blob.arrayBuffer()) });
        $('#abText').placeholder = 'Ask Claude…';
        if (!r.text) return toast('Did not catch that — try again');
        $('#abText').value = r.text; $('#abText').focus();
        if ($('#voiceAuto') ? $('#voiceAuto').checked : true) setTimeout(sendBar, 350);
      } catch (e) { $('#abText').placeholder = 'Ask Claude…'; toast(e.message.replace(/^Error invoking remote method 'voice': (Error: )?/, ''), 6000); }
    };
    rec.start(); $('#askbar').classList.add('rec');
  } catch (e) { rec = null; toast('Microphone not available: ' + e.message, 5000); }
}
function stopVoice() { if (rec && rec.state === 'recording') rec.stop(); }
$('#micBtn').addEventListener('pointerdown', e => { e.preventDefault(); startVoice(); });
addEventListener('pointerup', stopVoice);
let spaceHeld = false;
document.addEventListener('keydown', e => { if (e.ctrlKey && e.code === 'Space' && !spaceHeld && !$('#editor').classList.contains('hidden')) { e.preventDefault(); e.stopPropagation(); spaceHeld = true; startVoice(); } }, true);
document.addEventListener('keyup', e => { if (spaceHeld && (e.code === 'Space' || e.key === 'Control')) { spaceHeld = false; stopVoice(); } }, true);
ACTIONS.push({ group: 'Claude', id: 'claude.voice', label: 'Talk to Claude (hold)', def: ['Ctrl+Space'], run: () => {} }); ACT['claude.voice'] = ACTIONS[ACTIONS.length - 1];
ACTIONS.push({ group: 'Editing', id: 'edit.silences', label: 'Remove silences', def: ['Ctrl+Shift+X'], run: () => removeSilences() }); ACT['edit.silences'] = ACTIONS[ACTIONS.length - 1];

// =====================================================================================
// REMOVE SILENCES (local, from word timestamps)
// =====================================================================================
async function removeSilences(opts = {}) {
  if (!P) return;
  const gapMax = opts.gap ?? .35, pad = opts.pad ?? .08;
  let cs = P.clips.filter(c => sel.has(c.id));
  if (!cs.length) cs = TF.audioClips(P, 'speech');
  cs = cs.filter(c => { const m = TF.mediaOf(P, c); return m && (c.type === 'audio' || (c.type === 'video' && m.hasAudio)); });
  if (!cs.length) return toast('Select a clip with speech (or put voice on a Voice track)');
  for (const c of cs) {
    const m = TF.mediaOf(P, c); if (m.transcript) continue;
    toast('Transcribing ' + m.name + '…', 60000);
    try { const tr = await host.invoke('transcribe', { src: m.path }); H.apply({ op: 'update_media', id: m.id, patch: { transcript: tr } }, 'you', 'Transcribe ' + m.name); }
    catch (e) { return toast(e.message, 6000); }
  }
  let removedTotal = 0, pieces = 0; liveStart();
  try {
    // work clip by clip from the right, directly on the project, as ONE undo step
    for (const id of cs.slice().sort((a, b) => b.start - a.start).map(c => c.id)) {
      const c = P.clips.find(x => x.id === id); if (!c) continue;
      const m = TF.mediaOf(P, c); const src0 = c.in, src1 = c.in + c.dur * c.speed;
      const words = m.transcript.segments.flatMap(s => s.words || []).filter(w => w.e > src0 && w.s < src1);
      if (!words.length) continue;
      const keep = [];
      for (const w of words) { const a = Math.max(src0, w.s - pad), b = Math.min(src1, w.e + pad); const last = keep[keep.length - 1]; if (last && a - last[1] <= gapMax) last[1] = Math.max(last[1], b); else keep.push([a, b]); }
      const newDur = keep.reduce((s, [a, b]) => s + (b - a), 0) / c.speed; const removed = c.dur - newDur;
      if (removed < .15) continue;
      const end = TF.clipEnd(c), track = c.track, base = JSON.parse(JSON.stringify(c));
      TF.OPS.delete_clip(P, { id: c.id });
      // ripple: later clips on the same track move left (nearest first, so nothing overlaps)
      P.clips.filter(o => o.track === track && o.start >= end - 1e-3).sort((x, y) => x.start - y.start).forEach(o => { o.start = +(o.start - removed).toFixed(4); });
      let t = base.start;
      for (const [a, b] of keep) {
        const d = (b - a) / base.speed; const piece = JSON.parse(JSON.stringify(base)); piece.id = TF.uid(); piece.start = +t.toFixed(4); piece.in = +a.toFixed(4); piece.dur = +d.toFixed(4); piece.fadeIn = 0; piece.fadeOut = 0; delete piece.transition;
        P.clips.push(TF.normClip(piece)); t += d; pieces++;
      }
      removedTotal += removed;
    }
  } catch (e) { toast(e.message); }
  if (!pieces) { liveBefore = null; return toast('No pauses longer than ' + gapMax + ' s found'); }
  liveCommit(`Remove silences (−${removedTotal.toFixed(1)} s)`); sel = new Set(); renderAll();
  toast(`Removed ${removedTotal.toFixed(1)} s of pauses · ${pieces} pieces. Graphics on other tracks did not move — check them.`, 5000);
}
setTimeout(renderChips, 0);

// track roles for colour + icons (used by the Studio skin)
const ROLE_OF = (tr) => tr.kind === 'audio' ? (tr.role === 'music' ? 'music' : tr.role === 'speech' ? 'voice' : 'sfx') : (/caption|subtit/i.test(tr.name) ? 'subs' : tr.id === 'V1' ? 'video' : 'graphics');
const ROLE_LABEL = { video: 'Video', graphics: 'Graphics', subs: 'Subtitles', music: 'Music', voice: 'Voiceover', sfx: 'SFX' };
const _renderTimeline5 = renderTimeline;
renderTimeline = function () {
  _renderTimeline5();
  const vis = typeof visibleTracks === 'function' ? visibleTracks() : P.tracks;
  const heads = $$('#heads .head'), lanes = $$('#lanes .lane');
  vis.forEach((tr, i) => { const r = ROLE_OF(tr); if (heads[i]) { heads[i].dataset.role = r; const sp = heads[i].querySelector('span'); if (sp && isStudio()) sp.textContent = tr.name && !/^(Picture|Overlay|Graphics|Music|SFX|Voice)$/.test(tr.name) ? tr.name : ROLE_LABEL[r]; } if (lanes[i]) lanes[i].dataset.role = r; });
  renderChips();
};
