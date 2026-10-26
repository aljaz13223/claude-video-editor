// Takeframe UI part 6: Premium skin "Studio Arc" — the curved timeline from Aljaž's concept.
// The timeline is bent with an SVG displacement filter (purely visual); pointer events are
// re-mapped through the same curve so clicking, dragging and dropping still hit what you see.
// Extras: centred playhead with time bubble, film strips at the sides, mic orb, curve + zoom sliders,
// a card with the current asset to drop at the playhead.
'use strict';

const isArc = () => document.documentElement.classList.contains('premium') && curSkin === 'arc';
let arcA = 46;            // curve depth in px (left slider; 0 = flat)
try { arcA = +(localStorage.getItem('tf.arc') ?? 46); } catch {}

// ---------- filter ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const bendSvg = document.createElementNS(SVGNS, 'svg');
bendSvg.setAttribute('width', 0); bendSvg.setAttribute('height', 0); bendSvg.style.cssText = 'position:absolute;width:0;height:0';
bendSvg.innerHTML = `<defs><filter id="tfBend" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
  <feImage id="tfBendMap" preserveAspectRatio="none" x="0" y="0" result="m"/>
  <feDisplacementMap id="tfBendDisp" in="SourceGraphic" in2="m" scale="92" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
document.body.appendChild(bendSvg);
(() => { // parabolic map: R = 0.5 (no x shift); G = u²/2 → centre sampled A px higher = content sits lower
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 4; const g = cv.getContext('2d'); const im = g.createImageData(512, 4);
  for (let x = 0; x < 512; x++) { const u = (x / 511) * 2 - 1; const G = Math.round(255 * Math.min(1, u * u) / 2); for (let y = 0; y < 4; y++) { const i = (y * 512 + x) * 4; im.data[i] = 128; im.data[i + 1] = G; im.data[i + 2] = 0; im.data[i + 3] = 255; } }
  g.putImageData(im, 0, 0); $('#tfBendMap').setAttribute('href', cv.toDataURL());
})();
function sizeBend() {
  const tb = $('.tl-body'); if (!tb) return; const w = tb.clientWidth, h = tb.clientHeight;
  const f = $('#tfBend'); f.setAttribute('x', 0); f.setAttribute('y', 0); f.setAttribute('width', w); f.setAttribute('height', h + arcA + 4);
  const m = $('#tfBendMap'); m.setAttribute('width', w); m.setAttribute('height', h + arcA + 4);
  $('#tfBendDisp').setAttribute('scale', 2 * arcA);
  tb.style.filter = isArc() && arcA > 0 ? 'url(#tfBend)' : '';
  $('#timeline').style.paddingBottom = isArc() ? (78 + arcA) + 'px' : '';
}
new ResizeObserver(() => isArc() && sizeBend()).observe(document.querySelector('.tl-body'));

// ---------- pointer re-mapping ----------
// a point drawn at (x, yv) comes from (x, yv - A·(1-u²))
function arcDy(clientX) { const tb = $('.tl-body').getBoundingClientRect(); const u = Math.max(-1, Math.min(1, ((clientX - tb.left) - tb.width / 2) / (tb.width / 2))); return arcA * (1 - u * u); }
let arcDispatching = false, arcLastX = 0;
addEventListener('pointermove', e => { arcLastX = e.clientX; }, true);
for (const type of ['pointerdown', 'contextmenu', 'dblclick']) {
  $('.tl-body').addEventListener(type, e => {
    if (!isArc() || !arcA || !e.isTrusted || arcDispatching) return;
    const y2 = e.clientY - arcDy(e.clientX); const tgt = document.elementFromPoint(e.clientX, y2);
    if (!tgt || !$('.tl-body').contains(tgt)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const Ctor = type === 'pointerdown' ? PointerEvent : MouseEvent;
    const ev = new Ctor(type, { bubbles: true, cancelable: true, clientX: e.clientX, clientY: y2, button: e.button, buttons: e.buttons, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true, detail: e.detail });
    arcDispatching = true; try { tgt.dispatchEvent(ev); } finally { arcDispatching = false; }
  }, true);
}
const _laneAt6 = laneAt;
laneAt = function (clientY) { return _laneAt6(isArc() && !arcDispatching ? clientY - arcDy(arcLastX) : clientY); };
const _laneDrop6 = laneDrop;
laneDrop = function (e, tr, ln) {
  if (isArc() && arcA) { const id = _laneAt6(e.clientY - arcDy(e.clientX)); const t2 = id && P.tracks.find(t => t.id === id); if (t2) tr = t2; }
  return _laneDrop6(e, tr, ln);
};

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
  <div class="arc-slider l" title="Curve — slide down to flatten the timeline"><span>+</span><input type="range" id="arcCurve" min="0" max="90" value="${arcA}"><span>−</span></div>
  <div class="arc-slider r" title="Zoom"><span>+</span><input type="range" id="arcZoom" min="10" max="400" value="60"><span>−</span></div>
  <div class="arc-orb"><div class="wv l">${'<i></i>'.repeat(22)}</div><button id="arcMic" title="Hold to talk (Ctrl+Space)"><i></i></button><div class="wv r">${'<i></i>'.repeat(22)}</div></div>
  <div class="arc-card" id="arcCard"></div>`);
$('#arcCurve').oninput = e => { arcA = +e.target.value; try { localStorage.setItem('tf.arc', arcA); } catch {} sizeBend(); };
$('#arcZoom').oninput = e => { pps = +e.target.value; $('#tZoom').value = pps; renderTimeline(); ensureVisible(); };
$('#arcMic').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startVoice(); });
function fillStrips() {
  if (!isArc() || !P) return;
  const th = P.media.filter(m => m.thumbUrl && (m.type === 'video' || m.type === 'image')).map(m => m.thumbUrl);
  const pick = i => th.length ? th[i % th.length] : '';
  for (const [id, off] of [['#arcStripL', 0], ['#arcStripR', 3]]) $(id).innerHTML = Array.from({ length: 9 }, (_, i) => `<span style="${pick(i + off) ? `background-image:url('${pick(i + off)}')` : ''}"></span>`).join('');
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
