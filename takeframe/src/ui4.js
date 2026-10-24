// Takeframe UI part 4: focused workspaces.
// Edit = everything. Motion / Sound / Color = only the panels, tracks, effects and Inspector sections for that job.
'use strict';

const WS = {
  edit: { label: 'Edit', left: ['folder', 'media', 'fx', 'text', 'audio'], first: 'folder', fx: null, tracks: 'all', insp: null, folderType: '', tools: ['select', 'razor', 'ripple', 'text'] },
  motion: { label: 'Motion', left: ['text', 'fx', 'folder'], first: 'text', fx: ['trans', 'motion', 'tanim'], tracks: 'video', insp: ['clip', 'transform', 'text', 'anim', 'picture', 'fill', 'trans', 'project'], open: ['transform', 'text', 'anim'], folderType: 'image', tools: ['select', 'razor', 'text'] },
  sound: { label: 'Sound', left: ['audio', 'fx', 'folder'], first: 'audio', fx: ['afx', 'sfx'], tracks: 'audio', insp: ['clip', 'audio', 'project'], open: ['audio'], folderType: 'audio', tools: ['select', 'razor', 'ripple'] },
  color: { label: 'Color', left: ['fx', 'folder'], first: 'fx', fx: ['look'], tracks: 'video', insp: ['clip', 'color', 'picture', 'project'], open: ['color'], folderType: 'video', tools: ['select', 'razor'] },
};
let curWs = 'edit';
function wsAllowsFx(kind) { const w = WS[curWs]; return !w.fx || w.fx.includes(kind); }
function visibleTracks() {
  if (!P) return [];
  const w = WS[curWs];
  if (w.tracks === 'video') return P.tracks.filter(t => t.kind === 'video');
  if (w.tracks === 'audio') return [...P.tracks.filter(t => t.kind === 'video' && t.id === 'V1'), ...P.tracks.filter(t => t.kind === 'audio')]; // V1 stays as picture reference
  return P.tracks;
}
function setWorkspace(ws) {
  if (!WS[ws]) return; curWs = ws; const w = WS[ws];
  $$('#ws button').forEach(x => x.classList.toggle('on', x.dataset.ws === ws));
  document.body.className = 'ws-' + ws;
  // left tabs: only the ones for this job
  $$('#leftTabs button').forEach(b => b.classList.toggle('hidden', !w.left.includes(b.dataset.t)));
  const curLeft = ($('#leftTabs button.on') || {}).dataset; switchTab('left', curLeft && w.left.includes(curLeft.t) ? curLeft.t : w.first);
  // tools
  $$('#tools button').forEach(b => b.classList.toggle('hidden', !w.tools.includes(b.dataset.tool)));
  if (!w.tools.includes(tool)) setTool('select');
  // folder shows the right kind of files
  if (typeof foldType !== 'undefined') { foldType = w.folderType; $$('#foldType button').forEach(x => x.classList.toggle('on', x.dataset.v === foldType)); if (typeof renderFolder === 'function') renderFolder(); }
  // drop selection that is not visible here
  const vis = new Set(visibleTracks().map(t => t.id)); if (P) sel = new Set([...sel].filter(id => { const c = P.clips.find(x => x.id === id); return c && vis.has(c.track); }));
  $('.mon-h .lbl').textContent = ws === 'edit' ? 'Program' : 'Program · ' + w.label;
  $('#tlInfo').dataset.ws = w.label;
  if (P) { renderTimeline(); renderInspector(); fillEffects(); }
  setTimeout(fitStage, 0);
  try { localStorage.setItem('tf.ws', ws); } catch {}
}
// Inspector: show only this workspace's sections and open the important ones
const _renderInspector4 = renderInspector;
renderInspector = function (soft) {
  _renderInspector4(soft);
  const w = WS[curWs]; if (!w.insp) return;
  const secs = $$('#insp details.isec');
  for (const d of secs) {
    const k = d.dataset.sec; const show = w.insp.includes(k); d.classList.toggle('hidden', !show);
    if (show && w.open && w.open.includes(k) && !(soft && d.contains(document.activeElement))) d.open = true;
  }
  if (secs.length && P && sel.size === 1 && !secs.some(d => !d.classList.contains('hidden') && d.dataset.sec !== 'clip')) {
    const c = P.clips.find(x => sel.has(x.id));
    if (c && !$('#insp .ws-note')) $('#insp').insertAdjacentHTML('beforeend', `<div class="empty ws-note">Nothing to set for this clip in ${w.label}.<br>Switch to Edit (Alt+1) for everything.</div>`);
  }
};
// workspace badge in the timeline toolbar
(() => { const s = document.createElement('style'); s.textContent = `
  #tlInfo[data-ws]:not([data-ws="Edit"])::before{content:attr(data-ws) ' · ';color:var(--acc);font-weight:700}
  body.ws-sound .lane[data-track="V1"]{opacity:.55}
  body.ws-sound .head:first-child span::after{content:' · ref';color:var(--dim)}
  #leftTabs button.hidden{display:none}
`; document.head.appendChild(s); })();
// start in Edit (remember last workspace per machine)
setTimeout(() => { let ws = 'edit'; try { ws = localStorage.getItem('tf.ws') || 'edit'; } catch {} setWorkspace(ws); }, 0);
