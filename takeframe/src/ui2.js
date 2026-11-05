// Takeframe UI part 2: command registry + rebindable shortcuts, command palette, context menus,
// folder browser panel, labelled effects library, clip badges and inspector decorations.
'use strict';

// =====================================================================================
// COMMANDS
// =====================================================================================
const nudgeSel = d => { if (!sel.size) return; apply([...sel].map(id => { const c = P.clips.find(x => x.id === id); return { op: 'move_clip', id, start: c.start + d }; }), 'Nudge'); };
const selClips = () => P.clips.filter(c => sel.has(c.id));
const focusInsp = f => { switchTab('right', 'insp'); renderInspector(); setTimeout(() => { const i = $(`#insp [data-f="${f}"]`); if (i) { i.closest('details').open = true; i.focus(); i.select(); } }, 30); };
function setSpeed(v) { const cs = selClips().filter(c => c.type === 'video' || c.type === 'audio'); if (!cs.length) return toast('Select video or audio clips'); apply(cs.map(c => ({ op: 'update_clip', id: c.id, patch: { speed: v, dur: c.dur * c.speed / v } })), `Speed ${Math.round(v * 100)}%`); }
function duplicateSel() { const cs = selClips(); if (!cs.length) return; const end = Math.max(...cs.map(TF.clipEnd)), s0 = Math.min(...cs.map(c => c.start)); apply(cs.map(c => ({ op: 'add_clip', clip: Object.assign(JSON.parse(JSON.stringify(c)), { id: TF.uid(), start: end + c.start - s0 }) })), 'Duplicate'); }
function toggleEnable() { const cs = selClips(); if (!cs.length) return; const v = !cs.every(c => c.disabled); apply(cs.map(c => ({ op: 'update_clip', id: c.id, patch: { disabled: v } })), v ? 'Disable clip' : 'Enable clip'); }
function pasteAt(t, track) { if (!clipboard || !clipboard.length) return toast('Clipboard is empty'); const s0 = Math.min(...clipboard.map(c => c.start)); apply(clipboard.map(c => ({ op: 'add_clip', clip: Object.assign({}, JSON.parse(JSON.stringify(c)), { id: TF.uid(), start: t + c.start - s0, track: track && kindOk(track, c) && clipboard.length === 1 ? track : c.track }) })), 'Paste'); }
async function enhanceSel() { const c = selClips()[0]; const m = c && TF.mediaOf(P, c); if (!m || !(m.type === 'audio' || m.hasAudio)) return toast('Select a clip with sound'); focusInsp('volume'); setTimeout(() => $('#enhGo') && $('#enhGo').click(), 80); }

const ACTIONS = [
  // group, id, label, default keys, run
  ['Playback', 'play.toggle', 'Play / pause', ['Space'], () => play()],
  ['Playback', 'play.forward', 'Play forward', ['L'], () => { if (!playing) play(); }],
  ['Playback', 'play.stop', 'Stop', ['K'], () => { if (playing) stop(); }],
  ['Playback', 'play.back', 'Jump back 1 s', ['J'], () => seek(T - 1)],
  ['Playback', 'nav.prevFrame', 'Previous frame', ['ArrowLeft'], () => seek(T - 1 / P.fps)],
  ['Playback', 'nav.nextFrame', 'Next frame', ['ArrowRight'], () => seek(T + 1 / P.fps)],
  ['Playback', 'nav.back1', 'Back 1 second', ['Shift+ArrowLeft'], () => seek(T - 1)],
  ['Playback', 'nav.fwd1', 'Forward 1 second', ['Shift+ArrowRight'], () => seek(T + 1)],
  ['Playback', 'nav.prevEdit', 'Previous edit point', ['ArrowUp'], () => { const p = editPoints().filter(x => x < T - 1e-3).pop(); if (p != null) seek(p); }],
  ['Playback', 'nav.nextEdit', 'Next edit point', ['ArrowDown'], () => { const p = editPoints().find(x => x > T + 1e-3); if (p != null) seek(p); }],
  ['Playback', 'nav.start', 'Go to start', ['Home'], () => seek(0)],
  ['Playback', 'nav.end', 'Go to end', ['End'], () => seek(rangeEnd())],
  ['Playback', 'play.loop', 'Loop on / off', ['Ctrl+L'], () => $('#bLoop').click()],
  ['Marking', 'mark.in', 'Mark In', ['I'], () => apply({ op: 'set_in_out', in: T }, 'Mark in')],
  ['Marking', 'mark.out', 'Mark Out', ['O'], () => apply({ op: 'set_in_out', out: T }, 'Mark out')],
  ['Marking', 'mark.clear', 'Clear In and Out', ['Alt+X'], () => apply({ op: 'set_in_out', in: null, out: null }, 'Clear in/out')],
  ['Marking', 'edit.marker', 'Add marker', ['M'], () => apply({ op: 'add_marker', t: T, name: 'Marker ' + (P.markers.length + 1) }, 'Marker')],
  ['Tools', 'tool.select', 'Selection tool', ['V'], () => setTool('select')],
  ['Tools', 'tool.razor', 'Razor tool', ['C'], () => setTool('razor')],
  ['Tools', 'tool.ripple', 'Ripple edit tool', ['B'], () => setTool('ripple')],
  ['Tools', 'tool.text', 'Type tool', ['T'], () => setTool('text')],
  ['Editing', 'edit.split', 'Split at playhead', ['Ctrl+K'], () => splitAtPlayhead()],
  ['Editing', 'edit.splitAll', 'Split all tracks at playhead', ['Ctrl+Shift+K'], () => apply({ op: 'split_clip', t: T }, 'Split all')],
  ['Editing', 'edit.delete', 'Delete', ['Delete', 'Backspace'], () => delSel(false)],
  ['Editing', 'edit.rippleDelete', 'Ripple delete (close the gap)', ['Shift+Delete', 'Shift+Backspace'], () => delSel(true)],
  ['Editing', 'edit.copy', 'Copy', ['Ctrl+C'], () => { clipboard = selClips().map(c => JSON.parse(JSON.stringify(c))); toast(`Copied ${clipboard.length}`); }],
  ['Editing', 'edit.cut', 'Cut', ['Ctrl+X'], () => { clipboard = selClips().map(c => JSON.parse(JSON.stringify(c))); delSel(false); }],
  ['Editing', 'edit.paste', 'Paste at playhead', ['Ctrl+V'], () => pasteAt(T)],
  ['Editing', 'edit.duplicate', 'Duplicate after itself', ['Ctrl+Shift+D'], duplicateSel],
  ['Editing', 'edit.selectAll', 'Select all', ['Ctrl+A'], () => { sel = new Set(P.clips.map(c => c.id)); renderTimeline(); renderInspector(); }],
  ['Editing', 'edit.deselect', 'Deselect', ['Escape'], () => { sel = new Set(); renderTimeline(); renderInspector(); }],
  ['Editing', 'edit.nudgeL', 'Nudge left 1 frame', ['Alt+ArrowLeft'], () => nudgeSel(-1 / P.fps)],
  ['Editing', 'edit.nudgeR', 'Nudge right 1 frame', ['Alt+ArrowRight'], () => nudgeSel(1 / P.fps)],
  ['Editing', 'edit.nudgeL5', 'Nudge left 5 frames', ['Alt+Shift+ArrowLeft'], () => nudgeSel(-5 / P.fps)],
  ['Editing', 'edit.nudgeR5', 'Nudge right 5 frames', ['Alt+Shift+ArrowRight'], () => nudgeSel(5 / P.fps)],
  ['Editing', 'edit.enable', 'Enable / disable clip', ['Shift+E'], toggleEnable],
  ['Editing', 'edit.closeGaps', 'Close gaps on selected track', ['Alt+G'], () => { const c = selClips()[0]; apply({ op: 'close_gaps', track: c ? c.track : 'V1' }, 'Close gaps'); }],
  ['Effects', 'edit.transition', 'Apply default transition (crossfade)', ['Ctrl+D'], () => { if (!sel.size) return toast('Select the clip the transition leads into'); apply([...sel].map(id => ({ op: 'set_transition', id, type: 'crossfade', dur: .4 })), 'Default transition'); }],
  ['Effects', 'edit.speed', 'Speed / duration…', ['Ctrl+R'], () => focusInsp('speed')],
  ['Effects', 'speed.50', 'Speed 50 %', [], () => setSpeed(.5)],
  ['Effects', 'speed.100', 'Speed 100 %', [], () => setSpeed(1)],
  ['Effects', 'speed.200', 'Speed 200 %', [], () => setSpeed(2)],
  ['Effects', 'fx.clear', 'Remove all effects from selection', ['Ctrl+Alt+R'], () => { if (!sel.size) return; apply([...sel].map(id => ({ op: 'update_clip', id, patch: { fx: { brightness: 1, contrast: 1, saturate: 1, temp: 0, hue: 0, grayscale: 0, sepia: 0, blur: 0 }, kf: {}, transition: null } })), 'Remove effects'); }],
  ['Audio', 'audio.enhance', 'Enhance speech on selected clip', ['Ctrl+Shift+E'], enhanceSel],
  ['Audio', 'audio.mute', 'Mute / unmute clip audio', ['Shift+M'], () => { const cs = selClips(); if (!cs.length) return; const v = !cs.every(c => c.muteAudio || c.volume <= -60); apply(cs.map(c => c.type === 'video' ? { op: 'update_clip', id: c.id, patch: { muteAudio: v } } : { op: 'update_clip', id: c.id, patch: { volume: v ? -60 : 0 } }), v ? 'Mute audio' : 'Unmute audio'); }],
  ['Audio', 'audio.music', 'Generate new music', ['Ctrl+Shift+M'], () => { switchTab('left', 'audio'); $('#musGo').click(); }],
  ['Claude', 'claude.ask', 'Ask Claude about the selection', ['Ctrl+J'], () => { if (!sel.size) { switchTab('right', 'claude'); $('#chatText').focus(); return; } placeAsk(); $('#askText').focus(); }],
  ['Claude', 'claude.panel', 'Open Claude panel', ['Ctrl+Shift+J'], () => { switchTab('right', 'claude'); $('#chatText').focus(); }],
  ['View', 'view.zoomIn', 'Zoom in timeline', ['=', '+'], () => { pps = Math.min(400, pps * 1.25); $('#tZoom').value = pps; renderTimeline(); }],
  ['View', 'view.zoomOut', 'Zoom out timeline', ['-'], () => { pps = Math.max(10, pps / 1.25); $('#tZoom').value = pps; renderTimeline(); }],
  ['View', 'view.zoomFit', 'Fit timeline to window', ['\\'], () => { pps = Math.max(10, ($('#lanesWrap').clientWidth - 40) / Math.max(1, rangeEnd())); $('#tZoom').value = pps; renderTimeline(); }],
  ['View', 'view.snap', 'Snapping on / off', ['S'], () => { snapOn = !snapOn; $('#tSnap').classList.toggle('on', snapOn); toast('Snap ' + (snapOn ? 'on' : 'off'), 900); }],
  ['View', 'view.bars', 'Show music bars', ['Shift+B'], () => { barsOn = !barsOn; $('#tBeats').classList.toggle('on', barsOn); renderTimeline(); }],
  ['View', 'view.safe', 'Safe zone overlay', ['Shift+S'], () => $('#tSafe').click()],
  ['Panels', 'panel.folder', 'Folder panel', ['Shift+1'], () => switchTab('left', 'folder')],
  ['Panels', 'panel.bin', 'Bin panel', ['Shift+2'], () => switchTab('left', 'media')],
  ['Panels', 'panel.fx', 'Effects panel', ['Shift+3'], () => { switchTab('left', 'fx'); $('#fxSearch').focus(); }],
  ['Panels', 'panel.text', 'Text panel', ['Shift+4'], () => switchTab('left', 'text')],
  ['Panels', 'panel.audio', 'Audio panel', ['Shift+5'], () => switchTab('left', 'audio')],
  ['Panels', 'panel.insp', 'Inspector', ['Shift+6'], () => switchTab('right', 'insp')],
  ['Panels', 'panel.hist', 'History', ['Shift+7'], () => switchTab('right', 'hist')],
  ['Panels', 'ws.edit', 'Workspace: Edit', ['Alt+1'], () => $('#ws [data-ws=edit]').click()],
  ['Panels', 'ws.motion', 'Workspace: Motion', ['Alt+2'], () => $('#ws [data-ws=motion]').click()],
  ['Panels', 'ws.sound', 'Workspace: Sound', ['Alt+3'], () => $('#ws [data-ws=sound]').click()],
  ['Panels', 'ws.color', 'Workspace: Color', ['Alt+4'], () => $('#ws [data-ws=color]').click()],
  ['Project', 'app.undo', 'Undo', ['Ctrl+Z'], () => H.doUndo()],
  ['Project', 'app.redo', 'Redo', ['Ctrl+Shift+Z', 'Ctrl+Y'], () => H.doRedo()],
  ['Project', 'app.save', 'Save', ['Ctrl+S'], () => { save(); toast('Saved', 900); }],
  ['Project', 'app.export', 'Export…', ['Ctrl+E'], () => openExport()],
  ['Project', 'app.import', 'Import files to bin…', ['Ctrl+I'], () => $('#binAdd').click()],
  ['Project', 'track.addVideo', 'Add video track', [], () => apply({ op: 'add_track', kind: 'video' }, 'Add video track')],
  ['Project', 'track.addAudio', 'Add audio track', [], () => apply({ op: 'add_track', kind: 'audio', role: 'sfx' }, 'Add audio track')],
  ['Project', 'app.palette', 'Command palette', ['Ctrl+P', 'Ctrl+Shift+P'], () => openPalette()],
  ['Project', 'app.shortcuts', 'Keyboard shortcuts…', ['?', 'Ctrl+/'], () => openKeys()],
  ['Project', 'app.home', 'Back to projects', [], () => $('#btnHome').click()],
].map(([group, id, label, keys, run]) => ({ group, id, label, def: keys, run }));
const ACT = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
let keymap = {}; // id -> [combo]
const keysOf = id => keymap[id] || ACT[id].def;
let comboMap = new Map();
function rebuildCombos() { comboMap = new Map(); for (const a of ACTIONS) for (const k of keysOf(a.id)) comboMap.set(k, a.id); paintKbds(); }
function comboOf(e) {
  const k = e.key; if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(k)) return null;
  let key, sym = false;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3); else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (k === ' ') key = 'Space'; else if (k.length === 1) { key = k; sym = true; } else key = k;
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey && !sym ? 'Shift+' : '') + key;
}
const prettyKey = k => k.replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('Backspace', '⌫').replace('Delete', 'Del').replace('Escape', 'Esc');
const keyParts = k => k === '+' ? ['+'] : k.endsWith('++') ? [...k.slice(0, -2).split('+'), '+'] : k.split('+');
const kbdHTML = k => keyParts(k).map(p => `<kbd>${esc(prettyKey(p))}</kbd>`).join('');
function paintKbds() { $$('kbd[data-act]').forEach(kb => { const k = keysOf(kb.dataset.act)[0]; kb.textContent = k ? prettyKey(k) : ''; kb.style.display = k ? '' : 'none'; }); }
function runAct(id) { const a = ACT[id]; if (!a) return; if (!P && !id.startsWith('app.')) return; try { a.run(); } catch (e) { console.error(e); toast(e.message); } }

document.addEventListener('keydown', e => {
  if ($('#editor').classList.contains('hidden')) return;
  if (keyCapture) return; // shortcuts dialog is recording
  if ($('#palDlg').open || $('#exportDlg').open || $('#keysDlg').open) return;
  const ae = document.activeElement || {}; const tag = ae.tagName;
  const combo = comboOf(e); if (!combo) return;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape') { ae.blur(); return; }
    if (!/^Ctrl\+(S|E|P|Z|Y|Shift\+Z|J|Shift\+P)$/.test(combo)) return; // let fields type normally
    if (/^Ctrl\+(Z|Y|Shift\+Z)$/.test(combo)) return;
  }
  if (ae.closest && ae.closest('#foldList') && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) return; // folder list handles these
  const id = comboMap.get(combo); if (!id) return;
  e.preventDefault(); hideMenu(); runAct(id);
});
$$('[data-run]').forEach(b => b.addEventListener('click', () => runAct(b.dataset.run)));
$$('#tools button').forEach(b => b.title += ` (${keysOf('tool.' + b.dataset.tool)[0]})`);

// ---------------- command palette ----------------
let palItems = [], palIdx = 0;
function paletteEntries() {
  const out = ACTIONS.map(a => ({ label: a.label, group: a.group, keys: keysOf(a.id), run: () => runAct(a.id) }));
  for (const t of Object.keys(FX_INFO.trans)) out.push({ label: 'Transition: ' + t, group: 'Effects', keys: [], run: () => applyTo('trans', t) });
  for (const t of Object.keys(FX_INFO.looks)) out.push({ label: 'Look: ' + t, group: 'Effects', keys: [], run: () => applyTo('look', t) });
  for (const t of Object.keys(FX_INFO.motion)) out.push({ label: 'Picture motion: ' + t, group: 'Effects', keys: [], run: () => applyTo('motion', t) });
  for (const t of Object.keys(FX_INFO.tanim)) out.push({ label: 'Text animation: ' + t, group: 'Effects', keys: [], run: () => applyTo('tanim', t) });
  for (const pr of TITLE_PRESETS) out.push({ label: 'Add title: ' + pr.n, group: 'Text', keys: [], run: () => addTitle(pr, T) });
  return out;
}
function openPalette() { if (!P) return; $('#palIn').value = ''; renderPalette(); $('#palDlg').showModal(); $('#palIn').focus(); }
function renderPalette() {
  const q = $('#palIn').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  palItems = paletteEntries().filter(x => q.every(w => (x.label + ' ' + x.group).toLowerCase().includes(w))).slice(0, 60); palIdx = 0; drawPalette();
}
function drawPalette() {
  const L = $('#palList'); L.innerHTML = '';
  palItems.forEach((x, i) => { const d = el('div', 'pal-i' + (i === palIdx ? ' on' : ''), `<span class="pg">${esc(x.group)}</span><b>${esc(x.label)}</b><span class="pk">${x.keys[0] ? kbdHTML(x.keys[0]) : ''}</span>`); d.onmouseenter = () => { palIdx = i; drawPalette(); }; d.onclick = () => runPal(i); L.appendChild(d); });
  const on = L.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function runPal(i) { const x = palItems[i]; $('#palDlg').close(); if (x) setTimeout(() => x.run(), 10); }
$('#palIn').oninput = renderPalette;
$('#palIn').onkeydown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); palIdx = Math.min(palItems.length - 1, palIdx + 1); drawPalette(); } else if (e.key === 'ArrowUp') { e.preventDefault(); palIdx = Math.max(0, palIdx - 1); drawPalette(); } else if (e.key === 'Enter') { e.preventDefault(); runPal(palIdx); } };
$('#palDlg').addEventListener('click', e => { if (e.target === $('#palDlg')) $('#palDlg').close(); });

// ---------------- shortcuts dialog (rebindable) ----------------
let keyCapture = null;
function openKeys() { $('#keysSearch').value = ''; renderKeys(); $('#keysDlg').showModal(); }
function renderKeys() {
  const q = $('#keysSearch').value.toLowerCase(); const L = $('#keysList'); L.innerHTML = '';
  const groups = [...new Set(ACTIONS.map(a => a.group))];
  for (const g of groups) {
    const acts = ACTIONS.filter(a => a.group === g && (!q || a.label.toLowerCase().includes(q) || keysOf(a.id).join(' ').toLowerCase().includes(q))); if (!acts.length) continue;
    const box = el('div', 'kg', `<h3>${esc(g)}</h3>`);
    for (const a of acts) {
      const r = el('div', 'kr' + (keymap[a.id] ? ' custom' : ''), `<span>${esc(a.label)}</span>`); const ks = el('span', 'kk');
      keysOf(a.id).forEach((k, i) => { const b = el('button', 'kbtn', kbdHTML(k)); b.title = 'Click and press new keys'; b.onclick = () => capture(a.id, i, b); ks.appendChild(b); });
      const add = el('button', 'kbtn add', '+'); add.title = 'Add another shortcut'; add.onclick = () => capture(a.id, keysOf(a.id).length, add); ks.appendChild(add);
      r.appendChild(ks); box.appendChild(r);
    }
    L.appendChild(box);
  }
}
function capture(id, idx, btn) {
  if (keyCapture) return; btn.innerHTML = '<em>press keys…</em>'; btn.classList.add('rec');
  keyCapture = e => {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') return done(null);
    if (e.key === 'Backspace' && !e.shiftKey && !e.ctrlKey && !e.altKey) return done('');
    const c = comboOf(e); if (c) done(c);
  };
  const done = c => {
    window.removeEventListener('keydown', keyCapture, true); keyCapture = null;
    if (c != null) {
      const list = [...keysOf(id)];
      if (c === '') list.splice(idx, 1); else {
        const other = comboMap.get(c); if (other && other !== id) { keymap[other] = keysOf(other).filter(k => k !== c); toast(`${prettyKey(c)} removed from “${ACT[other].label}”`, 3000); }
        list[idx] = c;
      }
      keymap[id] = [...new Set(list.filter(Boolean))]; host.invoke('keymap-set', keymap); rebuildCombos();
    }
    renderKeys();
  };
  window.addEventListener('keydown', keyCapture, true);
}
$('#keysSearch').oninput = renderKeys;
$('#keysClose').onclick = () => $('#keysDlg').close();
$('#keysReset').onclick = () => { keymap = {}; host.invoke('keymap-set', keymap); rebuildCombos(); renderKeys(); toast('Shortcuts reset'); };

// ---------------- context menus ----------------
function showMenu(e, items) {
  const m = $('#ctx'); m.innerHTML = '';
  for (const it of items) {
    if (it === '-') { m.appendChild(el('div', 'sep')); continue; }
    if (it.h) { m.appendChild(el('div', 'mh', esc(it.h))); continue; }
    const keys = it.act ? keysOf(it.act) : []; const d = el('div', 'mi' + (it.disabled ? ' dis' : ''), `<span>${esc(it.label || ACT[it.act].label)}</span><span class="pk">${keys[0] ? kbdHTML(keys[0]) : ''}</span>`);
    d.onclick = () => { hideMenu(); if (it.disabled) return; it.run ? it.run() : runAct(it.act); }; m.appendChild(d);
  }
  m.classList.remove('hidden'); const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 6) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - r.height - 6) + 'px';
}
function hideMenu() { $('#ctx').classList.add('hidden'); }
addEventListener('pointerdown', e => { if (!e.target.closest('#ctx')) hideMenu(); }, true);
addEventListener('blur', hideMenu);
function clipMenu(e, c) {
  const m = TF.mediaOf(P, c); const hasSound = c.type === 'audio' || (m && m.hasAudio); const pic = c.type === 'video' || c.type === 'image';
  showMenu(e, [
    { h: `${c.type} · ${c.track} · ${fmtS(c.start)}–${fmtS(TF.clipEnd(c))}` },
    { act: 'claude.ask', label: '✦ Ask Claude to change only this' },
    '-', { act: 'edit.cut' }, { act: 'edit.copy' }, { act: 'edit.paste' }, { act: 'edit.duplicate' },
    '-', { act: 'edit.split' }, { act: 'edit.delete' }, { act: 'edit.rippleDelete' }, { act: 'edit.enable', label: c.disabled ? 'Enable clip' : 'Disable clip' },
    '-', { h: 'Effects' }, { act: 'edit.transition', label: 'Crossfade into this clip' },
    { label: 'Remove transition', disabled: !c.transition, run: () => apply({ op: 'set_transition', id: c.id, type: 'none' }, 'Remove transition') },
    ...(c.type === 'video' || c.type === 'audio' ? [{ act: 'speed.50' }, { act: 'speed.100' }, { act: 'speed.200' }, { act: 'edit.speed' }] : []),
    ...(pic ? [{ label: 'Push-in (Ken Burns)', run: () => applyTo('motion', 'Push-in') }] : []),
    { act: 'fx.clear' },
    ...(hasSound ? ['-', { h: 'Audio' }, { act: 'audio.enhance' }, { act: 'audio.mute' }] : []),
    '-', ...(m ? [{ label: 'Show file in Explorer', run: () => host.invoke('reveal', m.path) }] : []), { label: 'Properties (Inspector)', run: () => switchTab('right', 'insp') },
  ]);
}
function laneMenu(e, track, t) {
  if (!track) return; const tr = P.tracks.find(x => x.id === track);
  const f = foldSel && foldItems.find(x => x.path === foldSel && !x.isDir);
  showMenu(e, [
    { h: `${track} · ${fmtS(t)}` },
    { label: 'Paste here', disabled: !clipboard || !clipboard.length, run: () => pasteAt(t, track) },
    ...(f ? [{ label: `Place “${f.name}” here`, run: () => placeFile(f.path, t, track) }] : []),
    ...(tr.kind === 'video' ? [{ label: 'Add text here', run: () => addTitle(TITLE_PRESETS[0], t, track) }] : []),
    { label: 'Move playhead here', run: () => seek(t) },
    { act: 'edit.marker', label: 'Add marker at playhead' },
    '-', { label: `Close gaps on ${track}`, run: () => apply({ op: 'close_gaps', track }, 'Close gaps') },
    { act: 'track.addVideo' }, { act: 'track.addAudio' },
  ]);
}

// =====================================================================================
// FOLDER PANEL
// =====================================================================================
let foldDir = null, foldItems = [], foldSel = null, foldType = '', foldView = 'list';
const infoCache = new Map();
const TYPE_IC = { video: '▶', image: '▣', audio: '♪' };
async function openFolderPanel(dir) {
  if (!dir) return renderFolder();
  try { foldDir = dir; foldItems = await host.invoke('list-dir', dir); } catch (e) { foldItems = []; toast('Cannot read folder: ' + e.message); }
  renderFolder();
}
function fileInfo(path) { if (!infoCache.has(path)) infoCache.set(path, host.invoke('file-info', path).catch(() => null)); return infoCache.get(path); }
let foldIO = null;
function renderFolder() {
  const L = $('#foldList'); if (!L) return; L.innerHTML = ''; L.className = 'fold-list ' + foldView; L.tabIndex = 0;
  const root = P && P.sourceFolder;
  if (!foldDir) { L.innerHTML = `<div class="fold-empty"><b>No folder connected</b><span>Connect the folder with your footage. Its files show here and you drag them onto the timeline.</span><button class="btn primary" id="foldConnect">Connect folder…</button></div>`; $('#foldConnect').onclick = () => $('#foldPick').click(); $('#foldCrumb').textContent = ''; return; }
  // breadcrumb relative to the connected root
  const parts = foldDir.split(/[\\/]/).filter(Boolean); const rootParts = root ? root.split(/[\\/]/).filter(Boolean) : parts.slice(0, -1);
  const crumb = $('#foldCrumb'); crumb.innerHTML = ''; const startI = Math.max(0, Math.min(rootParts.length - 1, parts.length - 1));
  for (let i = startI; i < parts.length; i++) { const p = (foldDir.startsWith('/') ? '/' : '') + parts.slice(0, i + 1).join(SEP) + (i === 0 && /:$/.test(parts[0]) ? SEP : ''); const b = el('button', '', esc(parts[i])); b.onclick = () => openFolderPanel(p); crumb.appendChild(b); if (i < parts.length - 1) crumb.appendChild(el('span', '', '›')); }
  crumb.scrollLeft = 1e6;
  const q = ($('#foldSearch').value || '').toLowerCase(); const used = new Set(P ? P.media.filter(m => P.clips.some(c => c.media === m.id)).map(m => m.path) : []);
  const items = foldItems.filter(x => (x.isDir || !foldType || x.type === foldType) && (!q || x.name.toLowerCase().includes(q)));
  if (!items.length) L.innerHTML = '<div class="muted" style="padding:14px 6px">No media files here.</div>';
  if (foldIO) foldIO.disconnect();
  foldIO = new IntersectionObserver(ents => { for (const en of ents) if (en.isIntersecting) { foldIO.unobserve(en.target); hydrate(en.target); } }, { root: L });
  for (const x of items) {
    const d = el('div', 'fi ' + (x.isDir ? 'dir' : x.type) + (x.path === foldSel ? ' on' : '') + (used.has(x.path) ? ' used' : ''));
    d.dataset.path = x.path;
    if (x.isDir) { d.innerHTML = `<span class="fic">▸</span><span class="fth dirth"></span><span class="fnm">${esc(x.name)}</span><span class="fmt"></span>`; d.onclick = () => openFolderPanel(x.path); }
    else {
      d.innerHTML = `<span class="fic t-${x.type}">${TYPE_IC[x.type]}</span><span class="fth"></span><span class="fnm" title="${esc(x.name)}">${esc(x.name)}</span><span class="fmt">${x.type === 'image' ? 'IMG' : ''}</span>`;
      d.draggable = true; d.ondragstart = e => { e.dataTransfer.setData('tf/file', x.path); e.dataTransfer.effectAllowed = 'copy'; };
      d.onclick = () => selectFile(x.path); d.ondblclick = () => placeFile(x.path, T);
      d.oncontextmenu = e => { e.preventDefault(); selectFile(x.path); showMenu(e, [{ h: x.name }, { label: 'Place at playhead', run: () => placeFile(x.path, T) }, { label: 'Add to bin only', run: async () => { await ensureMedia(x.path); toast('Added to bin'); } }, { label: 'Show in Explorer', run: () => host.invoke('reveal', x.path) }]); };
      foldIO.observe(d);
    }
    L.appendChild(d);
  }
}
async function hydrate(d) {
  const info = await fileInfo(d.dataset.path); if (!info) return;
  const th = d.querySelector('.fth'); if (th && info.thumbUrl) th.style.backgroundImage = `url('${info.thumbUrl}')`;
  const mt = d.querySelector('.fmt'); if (mt) mt.textContent = info.type === 'image' ? `${info.w || ''}×${info.h || ''}` : fmtS(info.duration || 0);
}
async function selectFile(path) {
  foldSel = path; $$('#foldList .fi').forEach(x => x.classList.toggle('on', x.dataset.path === path));
  const info = await fileInfo(path); const pv = $('#foldPrev'); if (!info) { pv.innerHTML = '<div class="muted">Cannot read this file.</div>'; return; }
  const media = info.type === 'image' ? `<img src="${info.url}">` : info.type === 'video' ? `<video src="${info.url}" controls preload="metadata"></video>` : `<div class="aw" style="background-image:url('${info.thumbUrl}')"></div><audio src="${info.url}" controls preload="metadata"></audio>`;
  pv.innerHTML = `${media}<div class="pv-meta"><b>${esc(info.name)}</b><span>${info.type}${info.duration ? ' · ' + fmtS(info.duration) : ''}${info.w ? ' · ' + info.w + '×' + info.h : ''}${info.fps && info.type === 'video' ? ' · ' + Math.round(info.fps) + ' fps' : ''}${info.hasAudio && info.type === 'video' ? ' · sound' : ''}</span></div>
    <div class="pv-btns"><button class="btn sm primary" id="pvPlace">Place at playhead <kbd>Enter</kbd></button><button class="btn sm" id="pvBin">Add to bin</button></div>`;
  $('#pvPlace').onclick = () => placeFile(path, T); $('#pvBin').onclick = async () => { await ensureMedia(path); toast('Added to bin'); };
}
async function ensureMedia(path) {
  let m = P.media.find(x => x.path === path); if (m) return m;
  const info = await fileInfo(path); if (!info) throw new Error('cannot read ' + path);
  H.apply({ op: 'add_media', media: [Object.assign({}, info)] }, 'you', 'Import ' + info.name);
  return P.media.find(x => x.path === path);
}
function freeTrack(kind, t, dur, prefer) {
  const ids = P.tracks.filter(x => x.kind === kind).map(x => x.id); const order = kind === 'video' ? ids.slice().reverse() : ids; // V1 first, A1 first
  if (prefer && ids.includes(prefer)) order.unshift(prefer);
  for (const id of order) if (!locked(id) && !P.clips.some(c => c.track === id && c.start < t + dur - 1e-3 && TF.clipEnd(c) > t + 1e-3)) return id;
  return prefer && ids.includes(prefer) ? prefer : order[0];
}
async function placeFile(path, t, track) {
  try {
    const m = await ensureMedia(path); const kind = m.type === 'audio' ? 'audio' : 'video';
    const dur = m.type === 'image' ? 3 : Math.max(.2, m.duration || 3);
    let tr = track && kindOk(track, { type: m.type === 'audio' ? 'audio' : m.type }) ? track : freeTrack(kind, t, dur, kind === 'audio' ? (m.duration > 20 ? 'A1' : 'A2') : 'V1');
    insertMedia(m, tr, t); const nc = P.clips[P.clips.length - 1]; if (nc) { sel = new Set([nc.id]); renderTimeline(); renderInspector(); }
    renderFolder();
  } catch (e) { toast(e.message, 4000); }
}
$('#foldUp').onclick = () => { if (!foldDir) return; const p = foldDir.replace(/[\\/][^\\/]+[\\/]?$/, ''); if (p && p !== foldDir) openFolderPanel(/:$/.test(p) ? p + SEP : p); };
$('#foldPick').onclick = async () => { const d = await host.invoke('pick-folder', foldDir || env.root); if (d) { if (P) { P.sourceFolder = d; save(); } openFolderPanel(d); } };
$('#foldRefresh').onclick = () => { infoCache.clear(); openFolderPanel(foldDir); };
$('#foldSearch').oninput = renderFolder;
$$('#foldType button').forEach(b => b.onclick = () => { foldType = b.dataset.v; $$('#foldType button').forEach(x => x.classList.toggle('on', x === b)); renderFolder(); });
$$('.fold-view button').forEach(b => b.onclick = () => { foldView = b.dataset.v; $$('.fold-view button').forEach(x => x.classList.toggle('on', x === b)); renderFolder(); });
$('#foldList').addEventListener('keydown', e => {
  const files = $$('#foldList .fi'); const i = files.findIndex(x => x.dataset.path === foldSel);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = files[Math.max(0, Math.min(files.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; if (n) { if (n.classList.contains('dir')) { foldSel = n.dataset.path; files.forEach(x => x.classList.toggle('on', x === n)); } else selectFile(n.dataset.path); n.scrollIntoView({ block: 'nearest' }); } }
  if (e.key === 'Enter' && foldSel) { e.preventDefault(); const it = foldItems.find(x => x.path === foldSel); if (it && it.isDir) openFolderPanel(it.path); else placeFile(foldSel, T); }
  if (e.key === 'Backspace') { e.preventDefault(); $('#foldUp').click(); }
});

// =====================================================================================
// EFFECTS LIBRARY (labelled)
// =====================================================================================
const FX_INFO = {
  trans: {
    crossfade: ['Crossfade', 'Blends from the previous clip', 'tr-x'], dip: ['Dip to black', 'Fades out and in through black', 'tr-dip'],
    'push-left': ['Push left', 'New clip pushes the old one off to the left', 'tr-pl'], 'push-up': ['Push up', 'New clip pushes the old one up', 'tr-pu'],
    slide: ['Slide over', 'New clip slides in on top', 'tr-sl'], zoom: ['Zoom in', 'New clip zooms in from large', 'tr-z'],
    wipe: ['Wipe', 'Hard edge wipes left to right', 'tr-w'], iris: ['Iris', 'Opens as a growing circle', 'tr-i'],
    blur: ['Blur dissolve', 'Soft blur between the two clips', 'tr-b'], whip: ['Whip pan', 'Fast pan with motion blur', 'tr-wh'],
  },
  looks: {
    Warm: ['Warm', 'Golden, a little more colour', 'linear-gradient(135deg,#f0a25a,#7a3d1c)'], Cool: ['Cool', 'Blue shadows, crisp', 'linear-gradient(135deg,#7fb6ff,#1b2e57)'],
    Punchy: ['Punchy', 'More contrast and saturation', 'linear-gradient(135deg,#ff3d6e,#ffd23d)'], Mono: ['Mono', 'Black and white with contrast', 'linear-gradient(135deg,#f2f2f2,#111)'],
    Faded: ['Faded', 'Lifted, soft, film-like', 'linear-gradient(135deg,#c9c1b4,#6f6a63)'], Night: ['Night', 'Darker and cooler', 'linear-gradient(135deg,#2c3a66,#070a14)'],
    Reset: ['Reset colour', 'Back to the original', 'repeating-linear-gradient(45deg,#2a2f36 0 6px,#1a1d22 6px 12px)'],
  },
  motion: { 'Push-in': ['Push-in', 'Slow Ken Burns zoom over the clip'], 'Zoom in': ['Zoom in', 'Starts big, settles to 100 %'], 'Fade in': ['Fade in', 'Fades up from transparent'], 'Fade out': ['Fade out', 'Fades away at the end'], 'Slide up': ['Slide up', 'Rises in from below'], 'No motion': ['No motion', 'Removes picture motion'] },
  tanim: { rise: ['Rise', 'Words rise and fade in'], mask: ['Mask reveal', 'Words slide up out of a hidden line'], pop: ['Pop', 'Words scale in with a bounce'], blur: ['Blur in', 'Words sharpen from a blur'], type: ['Typewriter', 'Letters appear one by one'], split: ['Split', 'Letters fly together'], slide: ['Slide', 'Words slide in from the left'], scramble: ['Scramble', 'Letters decode like a terminal'], fade: ['Fade', 'Simple fade in'], none: ['None', 'No animation'] },
};
const FX_BASE = { brightness: 1, contrast: 1, saturate: 1, temp: 0, hue: 0, grayscale: 0 };
function dropPreset(id, look, motion, tanim) { const k = look ? 'look' : motion ? 'motion' : 'tanim'; applyTo(k, look || motion || tanim, [id]); }
function applyTo(kind, name, ids) {
  ids = ids || [...sel]; const cs = P.clips.filter(c => ids.includes(c.id));
  if (!cs.length) return toast('Select a clip first — or drag the effect onto it');
  if (kind === 'trans') return apply(cs.map(c => ({ op: 'set_transition', id: c.id, type: name, dur: .4 })), 'Transition ' + name);
  if (kind === 'look') { const ok = cs.filter(c => c.type !== 'audio'); return apply(ok.map(c => ({ op: 'update_clip', id: c.id, patch: { fx: Object.assign({}, FX_BASE, LOOKS[name]) } })), 'Look ' + name); }
  if (kind === 'motion') { const ok = cs.filter(c => c.type === 'image' || c.type === 'video'); if (!ok.length) return toast('Picture motion works on video and photo clips'); return apply(ok.map(c => ({ op: 'update_clip', id: c.id, patch: { anim: MOTION[name] } })), name); }
  if (kind === 'afx') {
    const ok = cs.filter(c => { const m = TF.mediaOf(P, c); return c.type === 'audio' || (m && m.hasAudio); }); if (!ok.length) return toast('Audio effects work on clips with sound');
    const fx = AFX[name]; if (fx.run) return fx.run(ok);
    return apply(ok.map(c => ({ op: 'update_clip', id: c.id, patch: fx.patch(c) })), fx.label);
  }
  if (kind === 'tanim') { const ok = cs.filter(c => c.type === 'title'); if (!ok.length) return toast('Text animations work on text clips'); return apply(ok.map(c => ({ op: 'update_clip', id: c.id, patch: { anim: { in: name } } })), 'Text ' + name); }
}
function fillEffects() {
  const q = ($('#fxSearch').value || '').toLowerCase(); const box = $('#fxPanel'); box.innerHTML = '';
  const sect = (title, hint, kind, entries, card) => {
    if (typeof wsAllowsFx === 'function' && !wsAllowsFx(kind)) return;
    const list = Object.entries(entries).filter(([k, v]) => !q || (k + v[0] + v[1]).toLowerCase().includes(q)); if (!list.length) return;
    const s = el('div', 'fx-sec', `<div class="sec-h">${title} <em>${hint}</em></div>`); const g = el('div', 'fx-grid');
    for (const [k, v] of list) { const c = card(k, v); c.draggable = true; c.ondragstart = e => e.dataTransfer.setData('tf/' + kind, k); c.onclick = () => applyTo(kind, k); c.title = v[1] + ' — click to apply to selected clips, or drag onto a clip'; g.appendChild(c); }
    s.appendChild(g); box.appendChild(s);
  };
  sect('Transitions', 'drop on the clip it leads into', 'trans', FX_INFO.trans, (k, v) => el('div', 'fxc', `<span class="fx-ic ${v[2]}"><i></i><i></i></span><b>${v[0]}</b><small>${v[1]}</small>`));
  sect('Color looks', 'video & photos', 'look', FX_INFO.looks, (k, v) => el('div', 'fxc', `<span class="fx-sw" style="background:${v[2]}"></span><b>${v[0]}</b><small>${v[1]}</small>`));
  sect('Picture motion', 'video & photos', 'motion', FX_INFO.motion, (k, v) => el('div', 'fxc', `<span class="fx-ic mo"><i></i></span><b>${v[0]}</b><small>${v[1]}</small>`));
  sect('Text animation', 'text clips', 'tanim', FX_INFO.tanim, (k, v) => el('div', 'fxc', `<span class="fx-ic ta">Aa</span><b>${v[0]}</b><small>${v[1]}</small>`));
  sect('Audio effects', 'clips with sound', 'afx', Object.fromEntries(Object.entries(AFX).map(([k, v]) => [k, [v.label, v.desc]])), (k, v) => el('div', 'fxc', `<span class="fx-ic au">${AFX[k].ic}</span><b>${v[0]}</b><small>${v[1]}</small>`));
  if (typeof SFX_LIB !== 'undefined' && SFX_LIB.length && (typeof wsAllowsFx !== 'function' || wsAllowsFx('sfx'))) { const s = el('div', 'fx-sec', '<div class="sec-h">Sound effects <em>drag onto an audio track</em></div>'); const holder = el('div', 'sfx-tree'); s.appendChild(holder); box.appendChild(s); renderSfxTree(holder, q); }
}
$('#fxSearch').oninput = fillEffects;

// =====================================================================================
// CLIP BADGES + INSPECTOR MARKING
// =====================================================================================
const PROP_DEF = { x: 0, y: 0, scale: 1, rot: 0, opacity: 1 };
const FX_DEF = { brightness: 1, contrast: 1, saturate: 1, temp: 0, hue: 0, grayscale: 0, blur: 0, sepia: 0 };
function activeFx(c) { return Object.entries(c.fx || {}).filter(([k, v]) => FX_DEF[k] != null && Math.abs(v - FX_DEF[k]) > 1e-3).map(([k]) => k); }
function clipBadges(c, m) {
  const b = [];
  if (c.disabled) b.push(['off', 'OFF', 'Clip is disabled (Shift+E)']);
  if (c.transition) b.push(['tr', '⇢ ' + c.transition.type, 'Transition in: ' + c.transition.type]);
  const fx = activeFx(c); if (fx.length) b.push(['fx', 'fx ' + fx.length, 'Effects: ' + fx.join(', ')]);
  const kf = Object.values(c.kf || {}).reduce((a, l) => a + l.length, 0); if (kf) b.push(['kf', '◆ ' + kf, 'Keyframes: ' + Object.keys(c.kf).join(', ')]);
  if (c.speed && c.speed !== 1) b.push(['sp', Math.round(c.speed * 100) + '%', 'Speed']);
  if ((c.type === 'image' || c.type === 'video') && c.anim && (c.anim.kb || c.anim.in !== 'none' || c.anim.out !== 'none')) b.push(['mo', 'motion', `Picture motion: ${[c.anim.kb ? 'push-in' : '', c.anim.in !== 'none' ? c.anim.in : '', c.anim.out !== 'none' ? c.anim.out + ' out' : ''].filter(Boolean).join(', ')}`]);
  if (c.type === 'title' && c.anim) b.push(['ta', c.anim.in, 'Text animation: ' + c.anim.in + ' / ' + c.anim.out]);
  if (m && m.enhanced && c.useEnhanced !== false) b.push(['en', 'ENH', 'Enhanced speech']);
  if (c.volume && c.type !== 'title' && c.type !== 'shape' && c.type !== 'image') b.push(['vo', (c.volume > 0 ? '+' : '') + c.volume + ' dB', 'Clip gain']);
  if (c.muteAudio) b.push(['mu', 'muted', 'Clip audio muted']);
  if (c.fadeIn || c.fadeOut) b.push(['fa', 'fade', `Fade in ${c.fadeIn || 0}s · out ${c.fadeOut || 0}s`]);
  if (!b.length) return '';
  return `<div class="bdg">${b.map(([k, t, tip]) => `<span class="b-${k}" title="${esc(tip)}">${esc(t)}</span>`).join('')}</div>`;
}
const META = {
  start: ['s', 'Where the clip starts on the timeline'], dur: ['s', 'How long the clip lasts'], in: ['s', 'Where playback starts inside the source file'], speed: ['×', '1 = normal speed, 2 = twice as fast'],
  x: ['px', 'Horizontal position (0 = centre)', 0], y: ['px', 'Vertical position (0 = centre)', 0], scale: ['×', '1 = 100 %', 1], rot: ['°', 'Rotation', 0], opacity: ['', '0 = invisible, 1 = solid', 1],
  brightness: ['×', 'Exposure; 1 = original', 1], contrast: ['×', 'Contrast; 1 = original', 1], saturate: ['×', 'Colour amount; 0 = grey', 1], temp: ['', 'Warm (+) or cool (−)', 0], hue: ['°', 'Shift all colours', 0], grayscale: ['', 'Black and white amount', 0], blur: ['px', 'Soft focus', 0],
  volume: ['dB', 'Clip gain; 0 = original, −60 = silent', 0], pan: ['', 'Left (−1) to right (+1)', 0], fadeIn: ['s', 'Audio fade in', 0], fadeOut: ['s', 'Audio fade out', 0],
  size: ['px', 'Font size'], weight: ['', '100 thin – 900 black'], tracking: ['em', 'Letter spacing'], lh: ['×', 'Line height'], width: ['', 'Text box width (share of frame)'], stretch: ['%', 'Font width (Archivo: 62–125)'],
  inDur: ['s', 'Length of the in-animation'], outDur: ['s', 'Length of the out-animation'], stagger: ['s', 'Delay between words or letters'], kb: ['', 'Slow push-in amount, e.g. 0.06'],
};
function decorateInspector() {
  const c = P && P.clips.find(x => sel.has(x.id)); if (!c || sel.size !== 1) return;
  for (const r of $$('#insp .prow')) {
    const inp = r.querySelector('input,select,textarea'); if (!inp) continue;
    const key = inp.dataset.f || inp.dataset.p || inp.dataset.x || inp.dataset.s || inp.dataset.a; const meta = META[key]; if (!meta) continue;
    const lab = r.querySelector('label'); lab.title = meta[1];
    if (meta[0] && inp.type === 'number' && !r.querySelector('.unit')) { const u = el('span', 'unit', meta[0]); inp.after(u); r.classList.add('has-unit'); }
    let def = meta[2], cur;
    if (inp.dataset.p) { cur = (c.kf[key] || []).length ? null : c.props[key]; if ((c.kf[key] || []).length) r.classList.add('mod'); }
    else if (inp.dataset.x) cur = (c.fx || {})[key] ?? FX_DEF[key];
    else if (inp.dataset.f && def != null) cur = c[key] ?? def;
    if (def != null && cur != null && Math.abs(cur - def) > 1e-4) r.classList.add('mod');
    if (r.classList.contains('mod') && def != null) {
      const rb = el('button', 'rst', '↺'); rb.title = 'Reset to ' + def;
      rb.onclick = () => {
        if (inp.dataset.p) apply([{ op: 'clear_keyframes', id: c.id, prop: key }, { op: 'update_clip', id: c.id, patch: { props: { [key]: def } } }], 'Reset ' + key);
        else if (inp.dataset.x) apply({ op: 'update_clip', id: c.id, patch: { fx: { [key]: def } } }, 'Reset ' + key);
        else apply({ op: 'update_clip', id: c.id, patch: { [key]: def } }, 'Reset ' + key);
      };
      lab.appendChild(rb);
    }
  }
  for (const d of $$('#insp details.isec')) { const n = d.querySelectorAll('.prow.mod').length; if (n) d.querySelector('summary').insertAdjacentHTML('beforeend', `<span class="act-n">${n} changed</span>`); }
}
const _renderInspector = renderInspector;
renderInspector = function (soft) { _renderInspector(soft); if (!(soft && document.activeElement && $('#insp').contains(document.activeElement))) decorateInspector(); };

// =====================================================================================
// BOOT
// =====================================================================================
(async () => {
  try { keymap = await host.invoke('keymap-get') || {}; } catch { keymap = {}; }
  rebuildCombos(); bindStart(); initStart(); fillLeft();
})();
