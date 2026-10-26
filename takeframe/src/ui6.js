// Takeframe UI part 6: Premium skin "Studio Arc" — the curved timeline from Aljaž's concept.
// The timeline is bent with an SVG displacement filter (purely visual); pointer events are
// re-mapped through the same curve so clicking, dragging and dropping still hit what you see.
// Extras: centred playhead with time bubble, film strips at the sides, mic orb, curve + zoom sliders,
// a card with the current asset to drop at the playhead.
'use strict';

const isArc = () => document.documentElement.classList.contains('premium') && curSkin === 'arc';
let arcA = 150;           // how far the ends of the top row fall, px (left slider; 0 = flat)
try { const v = localStorage.getItem('tf.arc2'); if (v != null) arcA = +v; } catch {}

// ---------- polar warp ----------
// The timeline is wrapped onto a circle whose centre sits below it: the top row (ruler) is the outer ring,
// lower tracks are inner rings, every row ends on the same radial line. Source x = arc length on the top ring,
// source y = distance in from the top ring. feDisplacementMap gets, for every output pixel, the offset to its source.
const SVGNS = 'http://www.w3.org/2000/svg';
const bendSvg = document.createElementNS(SVGNS, 'svg');
bendSvg.setAttribute('width', 0); bendSvg.setAttribute('height', 0); bendSvg.style.cssText = 'position:absolute;width:0;height:0';
bendSvg.innerHTML = `<defs><filter id="tfBend" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
  <feImage id="tfBendMap" preserveAspectRatio="none" x="0" y="0" result="m"/>
  <feDisplacementMap id="tfBendDisp" in="SourceGraphic" in2="m" scale="100" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
document.body.appendChild(bendSvg);
const arcG = { on: false, w: 0, h: 0, H: 0, R: 0, cx: 0, th: 0 };
function arcSrcLocal(X, Y) { // output (visual) point → source point, in .tl-body coordinates
  const dx = X - arcG.cx, dy = arcG.R - Y; const r = Math.hypot(dx, dy), th = Math.atan2(dx, dy);
  return [arcG.cx + th * arcG.R, arcG.R - r];
}
let arcKey = '';
function sizeBend() {
  const tb = $('.tl-body'); if (!tb) return;
  const on = isArc() && arcA > 0; arcG.on = on;
  if (!on) { tb.style.filter = ''; $('#timeline').style.paddingBottom = ''; $('#timeline').style.removeProperty('--arc-th'); return; }
  const w = tb.clientWidth, h = tb.clientHeight; if (w < 50 || h < 20) return;
  const s = Math.min(arcA, w * .3); const R = (w * w / 4 + s * s) / (2 * s); const th = (w / 2) / R;
  const rIn = Math.max(R - h, 1); const H = Math.ceil(Math.max(R * (1 - Math.cos(th)), R - rIn * Math.cos(th), h)) + 4;
  Object.assign(arcG, { w, h, H, R, cx: w / 2, th });
  $('#timeline').style.paddingBottom = Math.max(H - h + 10, 92) + 'px';
  $('#timeline').style.setProperty('--arc-th', th + 'rad');
  const key = [w, h, s].join('x');
  if (key !== arcKey) {
    arcKey = key;
    const k = .5, mw = Math.ceil(w * k), mh = Math.ceil(H * k); const D = new Float32Array(mw * mh * 2); let mx = 1;
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const X = (i + .5) / k, Y = (j + .5) / k; const [sx, sy] = arcSrcLocal(X, Y); const o = (j * mw + i) * 2;
      D[o] = sx - X; D[o + 1] = sy - Y; mx = Math.max(mx, Math.abs(D[o]), Math.abs(D[o + 1]));
    }
    const S = Math.ceil(mx * 2 + 4); const cv = document.createElement('canvas'); cv.width = mw; cv.height = mh;
    const g = cv.getContext('2d'); const im = g.createImageData(mw, mh);
    for (let n = 0; n < mw * mh; n++) { im.data[n * 4] = Math.round((D[n * 2] / S + .5) * 255); im.data[n * 4 + 1] = Math.round((D[n * 2 + 1] / S + .5) * 255); im.data[n * 4 + 2] = 0; im.data[n * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    const m = $('#tfBendMap'); m.setAttribute('href', cv.toDataURL()); m.setAttribute('width', w); m.setAttribute('height', H);
    const f = $('#tfBend'); f.setAttribute('x', 0); f.setAttribute('y', 0); f.setAttribute('width', w); f.setAttribute('height', H);
    $('#tfBendDisp').setAttribute('scale', S);
  }
  tb.style.filter = 'url(#tfBend)';
  placeArcStrips();
}
new ResizeObserver(() => isArc() && sizeBend()).observe(document.querySelector('.tl-body'));

// ---------- pointer re-mapping ----------
// The filter only moves pixels, so every click / drag / drop is sent on to what is drawn under the cursor.
function arcSrc(cx, cy) { const r = $('.tl-body').getBoundingClientRect(); const [x, y] = arcSrcLocal(cx - r.left, cy - r.top); return { x: x + r.left, y: y + r.top, inside: x >= 0 && x <= arcG.w && y >= 0 && y <= arcG.h }; }
function arcHit(e) { // is this event on the bent timeline?
  if (!arcG.on || !e.isTrusted) return false;
  const tb = $('.tl-body'); const t = e.target;
  if (!(t === $('#timeline') || (t instanceof Node && tb.contains(t)))) return false;
  const r = tb.getBoundingClientRect(); const X = e.clientX - r.left, Y = e.clientY - r.top;
  return X >= 0 && X <= arcG.w && Y >= 0 && Y <= arcG.H;
}
function arcSend(e, type, tgt, p) {
  const Ctor = /^pointer/.test(type) ? PointerEvent : MouseEvent;
  const ev = new Ctor(type, { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, screenX: e.screenX, screenY: e.screenY, button: e.button, buttons: e.buttons, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true, detail: e.detail, width: 1, height: 1, pressure: e.pressure });
  ev.tfArc = true; tgt.dispatchEvent(ev); return ev;
}
let arcDrag = null;
for (const type of ['pointerdown', 'click', 'dblclick', 'contextmenu']) {
  addEventListener(type, e => {
    if (!arcHit(e)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const p = arcSrc(e.clientX, e.clientY); if (!p.inside) return;
    const tgt = document.elementFromPoint(p.x, p.y); if (!tgt || !$('.tl-body').contains(tgt)) return;
    if (type === 'pointerdown') { arcDrag = e.pointerId; if (document.activeElement && document.activeElement.blur && !tgt.closest('input,select,textarea')) document.activeElement.blur(); }
    if ((type === 'click' || type === 'dblclick') && tgt.closest('input,select,textarea')) tgt.closest('input,select,textarea').focus();
    arcSend(e, type, tgt, p);
  }, true);
}
for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
  addEventListener(type, e => {
    if (!arcG.on || !e.isTrusted) return;
    if (arcDrag !== null && e.pointerId === arcDrag) {
      e.stopImmediatePropagation();
      arcSend(e, type, e.target === window || !(e.target instanceof Node) ? document.body : e.target, arcSrc(e.clientX, e.clientY));
      if (type !== 'pointermove') arcDrag = null;
    } else if (type === 'pointermove' && arcHit(e)) { // hover: show the cursor of what is drawn here (trim handles etc.)
      const p = arcSrc(e.clientX, e.clientY); const t = p.inside && document.elementFromPoint(p.x, p.y);
      $('.tl-body').style.cursor = t ? getComputedStyle(t).cursor : 'default';
    }
  }, true);
}
// drag & drop from Folder / Bin / Effects onto the bent lanes
function arcLaneAt(e) { const p = arcSrc(e.clientX, e.clientY); if (!p.inside) return null; const t = document.elementFromPoint(p.x, p.y); const ln = t && t.closest && t.closest('.lane'); return ln ? { ln, t, p } : null; }
addEventListener('dragover', e => {
  if (!arcHit(e)) return; e.stopImmediatePropagation(); const hit = arcLaneAt(e);
  $$('.lane.drop').forEach(x => x !== (hit && hit.ln) && x.classList.remove('drop'));
  if (hit) { e.preventDefault(); hit.ln.classList.add('drop'); }
}, true);
addEventListener('drop', e => {
  if (!arcHit(e)) return; e.stopImmediatePropagation(); e.preventDefault(); const hit = arcLaneAt(e);
  $$('.lane.drop').forEach(x => x.classList.remove('drop'));
  if (!hit) return; const tr = P.tracks.find(t => t.id === hit.ln.dataset.track); if (!tr) return;
  laneDrop({ clientX: hit.p.x, clientY: hit.p.y, target: hit.t, dataTransfer: e.dataTransfer, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, preventDefault() {} }, tr, hit.ln);
}, true);
addEventListener('wheel', e => {
  if (!arcHit(e)) return; e.stopImmediatePropagation();
  const lw = $('#lanesWrap');
  if (e.ctrlKey || e.altKey) { const p = arcSrc(e.clientX, e.clientY); e.preventDefault(); lw.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, deltaY: e.deltaY, deltaX: e.deltaX, ctrlKey: e.ctrlKey, altKey: e.altKey })); return; }
  e.preventDefault(); if (e.shiftKey) lw.scrollLeft += e.deltaY || e.deltaX; else { lw.scrollTop += e.deltaY; lw.scrollLeft += e.deltaX; $('#heads').scrollTop = lw.scrollTop; }
}, { capture: true, passive: false });
addEventListener('dragend', () => $$('.lane.drop').forEach(x => x.classList.remove('drop')));

// film frames that carry on around the ring past both ends (decoration)
function placeArcStrips() {
  const tl = $('#timeline'), tb = $('.tl-body'); if (!arcG.on || !tl) return;
  const tr = tl.getBoundingClientRect(), br = tb.getBoundingClientRect(); const ox = br.left - tr.left, oy = br.top - tr.top;
  // a reel running down beside each end of the ring, parallel to the end line and bending inwards
  const step = 50;
  for (const [id, sg] of [['#arcStripL', -1], ['#arcStripR', 1]]) {
    const th = arcG.th; let X = arcG.cx + sg * arcG.R * Math.sin(th), Y = arcG.R * (1 - Math.cos(th));
    X += sg * Math.cos(th) * 66; Y += Math.sin(th) * 66;               // step outwards from the end of the top row
    $$(id + ' span').forEach((f, i) => {
      const al = th + i * .02; const d = i ? step : 24;
      X += -sg * Math.sin(al) * d; Y += Math.cos(al) * d;
      f.style.left = (ox + X) + 'px'; f.style.top = (oy + Y) + 'px';
      f.style.transform = `translate(-50%,-50%) rotate(${sg * al}rad)`; f.style.opacity = Math.max(.2, .9 - i * .1);
    });
  }
}
// ---------- centred playhead (moves the timeline under it) ----------
const _follow6 = follow, _ensure6 = ensureVisible;
follow = function () { if (!isArc()) return _follow6(); const lw = $('#lanesWrap'); lw.scrollLeft = Math.max(0, T * pps - lw.clientWidth / 2); };
ensureVisible = function () { if (!isArc()) return _ensure6(); if (typeof edgeDrag !== 'undefined' && edgeDrag) return; const lw = $('#lanesWrap'); lw.scrollLeft = Math.max(0, T * pps - lw.clientWidth / 2); };
const _placePlayhead6 = placePlayhead;
placePlayhead = function () { _placePlayhead6(); const ph = $('#playhead'); if (ph && P && ph.firstElementChild) ph.firstElementChild.dataset.tc = fmt(T, P.fps); };

// ---------- extras: strips, orb, sliders, asset card ----------
const tlEl = $('#timeline');
tlEl.insertAdjacentHTML('beforeend', `
  <div class="arc-strip l" id="arcStripL"></div><div class="arc-strip r" id="arcStripR"></div>
  <div class="arc-slider l" title="Curve — slide down to flatten the timeline"><span>+</span><input type="range" id="arcCurve" min="0" max="260" value="${arcA}"><span>−</span></div>
  <div class="arc-slider r" title="Zoom"><span>+</span><input type="range" id="arcZoom" min="10" max="400" value="60"><span>−</span></div>
  <div class="arc-orb"><div class="wv l">${'<i></i>'.repeat(22)}</div><button id="arcMic" title="Hold to talk (Ctrl+Space)"><i></i></button><div class="wv r">${'<i></i>'.repeat(22)}</div></div>
  <div class="arc-card" id="arcCard"></div>`);
$('#arcCurve').oninput = e => { arcA = +e.target.value; try { localStorage.setItem('tf.arc2', arcA); } catch {} sizeBend(); };
$('#arcZoom').oninput = e => { pps = +e.target.value; $('#tZoom').value = pps; renderTimeline(); ensureVisible(); };
$('#arcMic').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startVoice(); });
function fillStrips() {
  if (!isArc() || !P) return;
  const th = P.media.filter(m => m.thumbUrl && (m.type === 'video' || m.type === 'image')).map(m => m.thumbUrl);
  const pick = i => th.length ? th[i % th.length] : '';
  for (const [id, off] of [['#arcStripL', 0], ['#arcStripR', 3]]) $(id).innerHTML = Array.from({ length: 7 }, (_, i) => `<span style="${pick(i + off) ? `background-image:url('${pick(i + off)}')` : ''}"></span>`).join(''); placeArcStrips();
}
function fillCard() {
  const c = $('#arcCard'); if (!c || !P) return;
  const clip = P.clips.find(x => sel.has(x.id)); const fm = typeof foldSel !== 'undefined' && foldSel && foldItems.find(x => x.path === foldSel && !x.isDir);
  const m = clip ? TF.mediaOf(P, clip) : fm ? (P.media.find(x => x.path === fm.path) || fm) : null;
  if (!m) { c.innerHTML = `<div class="ac-empty">Pick a file in Folder<br>or a clip to reuse</div>`; return; }
  const dur = m.duration ? fmtS(m.duration) : m.type === 'image' ? 'image' : '';
  c.innerHTML = `<span class="ac-th" style="background-image:url('${m.thumbUrl || ''}')"><b>${m.type === 'audio' ? '♪' : m.type === 'image' ? '▣' : '▶'} ${esc(dur)}</b></span><button id="arcAdd" title="Place at the playhead">+</button>`;
  $('#arcAdd').onclick = () => { if (fm && !clip) placeFile(fm.path, T); else if (m.id) insertMedia(m, m.type === 'audio' ? (clip ? clip.track : 'A2') : (clip ? clip.track : 'V1'), T); };
}
// wave bars react to recording
setInterval(() => { if (!isArc()) return; const rec = $('#askbar').classList.contains('rec'); $$('.arc-orb .wv i').forEach((b, i) => { const n = rec ? .25 + Math.random() * .75 : .18 + .12 * Math.abs(Math.sin(Date.now() / 900 + i * .5)); b.style.transform = `scaleY(${n})`; }); $('.arc-orb').classList.toggle('rec', rec); }, 110);

// hook into renders + skin changes
const _renderTimeline6 = renderTimeline;
renderTimeline = function () { _renderTimeline6(); if (isArc()) { fillCard(); $('#arcZoom').value = pps; } };
const _renderInspector6 = renderInspector;
renderInspector = function (soft) { _renderInspector6(soft); if (isArc()) fillCard(); };
const _applySkin6 = applySkin;
applySkin = function (id, persist) { _applySkin6(id, persist); setTimeout(() => { sizeBend(); if (isArc()) { fillStrips(); fillCard(); ensureVisible(); } else $('.tl-body').style.filter = ''; }, 30); };
const _applyEdition6 = applyEdition;
applyEdition = function (ed, persist) { _applyEdition6(ed, persist); setTimeout(sizeBend, 40); };
const _enterEditor6 = enterEditor;
enterEditor = function (p) { _enterEditor6(p); setTimeout(() => { sizeBend(); fillStrips(); fillCard(); }, 100); };
if (typeof selectFile === 'function') { const _sf6 = selectFile; selectFile = async function (p) { await _sf6(p); fillCard(); }; }
