// Takeframe UI part 6: Premium skin "Studio Arc" — the round timeline from Aljaž's concept.
// The flat timeline stays in place (invisible) and handles editing; a canvas draws it as rings, and pointer
// events are re-mapped through the same geometry so clicking, dragging and dropping hit what you see.
// Extras: centred playhead with time bubble, film strips at the sides, mic orb, curve + zoom sliders,
// a card with the current asset to drop at the playhead.
'use strict';

const isArc = () => document.documentElement.classList.contains('premium') && curSkin === 'arc';
let arcA = 150;           // how far the ends of the top row fall, px (left slider; 0 = flat)
try { const v = localStorage.getItem('tf.arc2'); if (v != null) arcA = +v; } catch {}

// ---------- polar layout ----------
// The timeline is laid on a circle whose centre sits below it: the top row (ruler) is the outer ring,
// lower tracks are inner rings, every row ends on the same radial line. Source x = arc length on the top ring,
// source y = distance in from the top ring. The normal (flat) timeline stays underneath, invisible, and takes
// the clicks; what you see is drawn as vectors on a canvas at screen resolution, so it stays sharp.
const arcG = { on: false, w: 0, h: 0, H: 0, R: 0, cx: 0, th: 0 };
function arcSrcLocal(X, Y) { // output (visual) point → source point, in .tl-body coordinates
  const dx = X - arcG.cx, dy = arcG.R - Y; const r = Math.hypot(dx, dy), th = Math.atan2(dx, dy);
  return [arcG.cx + th * arcG.R, arcG.R - r];
}
const arcAng = sx => (sx - arcG.cx) / arcG.R;
function arcFwd(sx, sy) { const t = arcAng(sx), r = arcG.R - sy; return [arcG.cx + r * Math.sin(t), arcG.R - r * Math.cos(t), t]; }
const arcCv = document.createElement('canvas'); arcCv.id = 'arcCv'; $('#timeline').appendChild(arcCv);
const arcCtx = arcCv.getContext('2d');
let arcDirty = true;
function sizeBend() {
  const tb = $('.tl-body'); if (!tb) return;
  const on = isArc() && arcA > 0; arcG.on = on; tb.classList.toggle('arc-on', on); arcCv.style.display = on ? 'block' : 'none';
  if (!on) { $('#timeline').style.paddingBottom = ''; return; }
  const w = tb.clientWidth, h = tb.clientHeight; if (w < 50 || h < 20) return;
  const s = Math.min(arcA, w * .3); const R = (w * w / 4 + s * s) / (2 * s); const th = (w / 2) / R;
  const rIn = Math.max(R - h, 1); const H = Math.ceil(Math.max(R * (1 - Math.cos(th)), R - rIn * Math.cos(th), h)) + 8;
  Object.assign(arcG, { w, h, H, R, cx: w / 2, th });
  $('#timeline').style.paddingBottom = Math.max(H - h + 10, 92) + 'px';
  const dpr = devicePixelRatio || 1;
  arcCv.style.left = tb.offsetLeft + 'px'; arcCv.style.top = tb.offsetTop + 'px'; arcCv.style.width = w + 'px'; arcCv.style.height = H + 'px';
  if (arcCv.width !== Math.round(w * dpr) || arcCv.height !== Math.round(H * dpr)) { arcCv.width = Math.round(w * dpr); arcCv.height = Math.round(H * dpr); }
  arcDirty = true; placeArcStrips();
}

// ---------- vector renderer ----------
const arcImgs = new Map(), arcPeaks = new Map();
function arcImg(url) { let im = arcImgs.get(url); if (!im) { im = new Image(); im.onload = () => { arcDirty = true; }; im.src = url; arcImgs.set(url, im); } return im.complete && im.naturalWidth ? im : null; }
function arcPk(m) { if (arcPeaks.has(m.url)) return arcPeaks.get(m.url); arcPeaks.set(m.url, null); peaksFor(m).then(pk => { arcPeaks.set(m.url, pk); arcDirty = true; }); return null; }
function sector(g, l, t, r, b, rad = 0) { // annular sector for the source rect l..r × t..b
  const R = arcG.R, cx = arcG.cx, a0 = arcAng(l) - Math.PI / 2, a1 = arcAng(r) - Math.PI / 2;
  g.beginPath();
  if (rad > 0 && r - l > 2 * rad && b - t > 2 * rad) {
    const ro = R - t, ri = R - b, da0 = rad / ro, da1 = rad / ri;
    g.arc(cx, R, ro, a0 + da0, a1 - da0);
    { const [x, y] = arcFwd(r, t + rad); g.arcTo(...arcFwd(r, t).slice(0, 2), x, y, rad); }
    { const [x, y] = arcFwd(r, b - rad); g.lineTo(x, y); }
    { const [x, y] = arcFwd(r - rad * R / ri, b); g.arcTo(...arcFwd(r, b).slice(0, 2), x, y, rad); }
    g.arc(cx, R, ri, a1 - da1, a0 + da1, true);
    { const [x, y] = arcFwd(l, b - rad); g.arcTo(...arcFwd(l, b).slice(0, 2), x, y, rad); }
    { const [x, y] = arcFwd(l, t + rad); g.lineTo(x, y); }
    { const [x, y] = arcFwd(l + rad * R / ro, t); g.arcTo(...arcFwd(l, t).slice(0, 2), x, y, rad); }
  } else { g.arc(cx, R, R - t, a0, a1); g.arc(cx, R, Math.max(1, R - b), a1, a0, true); }
  g.closePath();
}
function radial(g, x, t, b) { const [x0, y0] = arcFwd(x, t), [x1, y1] = arcFwd(x, b); g.moveTo(x0, y0); g.lineTo(x1, y1); }
function arcText(g, str, sx, sy, maxW) { // text that follows the ring; sy = baseline
  let x = sx; const end = sx + maxW; const ell = g.measureText('…').width;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]; const w = g.measureText(ch).width;
    if (x + w > end - (i < str.length - 1 ? ell : 0) && x + w > end - ell) { if (i) { const [X, Y, t] = arcFwd(x + ell / 2, sy); g.save(); g.translate(X, Y); g.rotate(t); g.fillText('…', -ell / 2, 0); g.restore(); } return; }
    const [X, Y, t] = arcFwd(x + w / 2, sy); g.save(); g.translate(X, Y); g.rotate(t); g.fillText(ch, -w / 2, 0); g.restore(); x += w;
  }
}
function boxAt(g, r, fn) { const [X, Y, t] = arcFwd((r.l + r.r) / 2, (r.t + r.b) / 2); g.save(); g.translate(X, Y); g.rotate(t); fn(r.r - r.l, r.b - r.t); g.restore(); }
function mixHex(a, b, t) { const p = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? [61, 123, 255] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }; const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function drawArc() {
  arcDirty = false; if (!arcG.on || !P) return;
  const g = arcCtx, dpr = arcCv.width / arcG.w; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, arcG.w, arcG.H);
  const tb = $('.tl-body'), TB = tb.getBoundingClientRect();
  const rel = e => { const b = e.getBoundingClientRect(); return { l: b.left - TB.left, t: b.top - TB.top, r: b.right - TB.left, b: b.bottom - TB.top }; };
  const lw = $('#lanesWrap'); const V = rel(lw); V.r = V.l + lw.clientWidth; V.b = V.t + lw.clientHeight;
  const ruler = rel($('#ruler'));
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace';
  const sans = getComputedStyle(document.body).fontFamily;
  // --- lanes area ---
  g.save(); sector(g, V.l, V.t, V.r, V.b); g.clip();
  // backdrop
  sector(g, V.l, V.t, V.r, V.b); const bg = g.createRadialGradient(arcG.cx, arcG.R, arcG.R - V.b, arcG.cx, arcG.R, arcG.R - V.t);
  bg.addColorStop(0, 'rgba(14,24,48,.55)'); bg.addColorStop(1, 'rgba(18,30,60,.35)'); g.fillStyle = bg; g.fill();
  // ruler
  sector(g, V.l, ruler.t, V.r, ruler.b); g.fillStyle = 'rgba(10,18,38,.85)'; g.fill();
  g.beginPath(); for (const k of $$('#ruler .tk')) { const r = rel(k); if (r.l < V.l - 2 || r.l > V.r + 2) continue; radial(g, r.l, ruler.b - (k.classList.contains('big') ? 9 : 4), ruler.b); } g.strokeStyle = 'rgba(150,180,240,.5)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#8ea2cc'; g.font = `500 10px ${mono}`;
  for (const k of $$('#ruler .lb')) { const r = rel(k); if (r.r < V.l || r.l > V.r) continue; arcText(g, k.textContent, r.l + 3, ruler.t + 12, 80); }
  for (const k of $$('#ruler .io')) { const r = rel(k); sector(g, r.l, ruler.t, r.r, ruler.b); g.fillStyle = 'rgba(61,139,255,.18)'; g.fill(); }
  for (const k of $$('#ruler .mk, #ruler .note-pin')) { const r = rel(k); sector(g, r.l, ruler.t + 2, Math.max(r.r, r.l + 6), ruler.b - 2, 2); g.fillStyle = k.style.background || '#ffb547'; g.fill(); }
  // lanes
  for (const ln of $$('#lanes .lane')) {
    const L = rel(ln); if (L.b < V.t || L.t > V.b) continue; const tc = getComputedStyle(ln).getPropertyValue('--tc').trim() || '#3d7bff';
    if (ln.classList.contains('drop')) { sector(g, V.l, L.t, V.r, L.b); g.fillStyle = 'rgba(61,139,255,.16)'; g.fill(); }
    g.beginPath(); g.arc(arcG.cx, arcG.R, arcG.R - L.b, arcAng(V.l) - Math.PI / 2, arcAng(V.r) - Math.PI / 2); g.strokeStyle = 'rgba(120,160,255,.08)'; g.lineWidth = 1; g.stroke();
    g.beginPath(); for (const gb of ln.querySelectorAll('.gridbar')) radial(g, rel(gb).l, L.t, L.b); g.strokeStyle = 'rgba(255,181,71,.18)'; g.stroke();
    for (const ce of ln.querySelectorAll('.clip')) {
      const C = rel(ce); if (C.r < V.l || C.l > V.r) continue; const c = P.clips.find(x => x.id === ce.dataset.id); if (!c) continue;
      const m = TF.mediaOf(P, c); const isSel = ce.classList.contains('sel'); const dark = /subs|sfx/.test(ln.dataset.role || '');
      g.save(); g.globalAlpha = ce.classList.contains('off') || ce.classList.contains('muted') ? .45 : 1;
      sector(g, C.l + .5, C.t + 1.5, C.r - .5, C.b - 1.5, 7);
      if (isSel) { g.shadowColor = tc; g.shadowBlur = 16; }
      const gr = g.createRadialGradient(arcG.cx, arcG.R, arcG.R - C.b, arcG.cx, arcG.R, arcG.R - C.t); gr.addColorStop(0, mixHex(tc, '#000000', .28)); gr.addColorStop(1, mixHex(tc, '#ffffff', .12));
      g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
      g.lineWidth = isSel ? 2 : 1; g.strokeStyle = isSel ? '#fff' : 'rgba(255,255,255,.35)'; g.stroke();
      g.save(); sector(g, C.l + .5, C.t + 1.5, C.r - .5, C.b - 1.5, 7); g.clip();
      // thumbnails
      const film = ce.querySelector('.film');
      if (film && m && m.thumbUrl) { const im = arcImg(m.thumbUrl); const F = rel(film); if (im && F.b - F.t > 6) { const fh = F.b - F.t, tw = fh * im.naturalWidth / im.naturalHeight; g.globalAlpha *= .8; for (let x = Math.max(F.l, V.l - tw - ((Math.max(F.l, V.l - tw) - F.l) % tw)); x < Math.min(F.r, V.r); x += tw) boxAt(g, { l: x, r: x + tw, t: F.t, b: F.b }, (w, h) => g.drawImage(im, -w / 2, -h / 2, w + .6, h)); g.globalAlpha /= .8; } }
      // waveform
      const wv = ce.querySelector('canvas.wave');
      if (wv && m) { const pk = arcPk(m); if (pk) { const W = rel(wv); const gain = Math.pow(10, (c.volume || 0) / 20); const wh = W.b - W.t; g.beginPath();
        for (let x = Math.max(W.l, V.l); x < Math.min(W.r, V.r); x += 1.5) { const st = (c.in || 0) + ((x - C.l) / pps) * (c.speed || 1); const v = Math.min(1, (pk[Math.floor(st * 100)] || 0) * gain); if (v > .01) radial(g, x, W.b - v * wh, W.b); }
        g.strokeStyle = 'rgba(255,255,255,.78)'; g.lineWidth = 1.2; g.stroke(); } }
      // transition / fades / keyframes
      for (const t of ce.querySelectorAll('.tr')) { const r = rel(t); sector(g, r.l, C.t, r.r, C.b); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); }
      for (const f of ce.querySelectorAll('.fade')) { const r = rel(f); sector(g, r.l, C.t, r.r, C.b); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); }
      // name
      const cn = ce.querySelector('.cn'); const bd = ce.querySelector('.bdg'); const bdw = bd ? rel(bd).r - rel(bd).l + 6 : 0;
      g.fillStyle = dark ? '#1b1406' : '#fff'; g.font = `600 11px ${sans}`;
      if (cn && C.r - C.l > 18) arcText(g, cn.textContent, Math.max(C.l + 7, V.l + 4), C.t + 14, Math.min(C.r, V.r) - Math.max(C.l + 7, V.l + 4) - bdw - 4);
      g.restore();
      for (const k of ce.querySelectorAll('.kfd')) boxAt(g, rel(k), (w, h) => { g.rotate(Math.PI / 4); g.fillStyle = '#ff9a2e'; g.fillRect(-3, -3, 6, 6); });
      for (const sp of ce.querySelectorAll('.bdg span')) { const r = rel(sp); if (r.r < V.l || r.l > V.r) continue; const cs = getComputedStyle(sp); boxAt(g, r, (w, h) => { rr(g, -w / 2, -h / 2, w, h, 3); g.fillStyle = cs.backgroundColor; g.fill(); g.fillStyle = cs.color; g.font = `600 8.5px ${mono}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sp.textContent, 0, .5); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }); }
      g.restore();
    }
  }
  // snap line + playhead
  const sn = $('.snapline'); if (sn) { g.beginPath(); radial(g, rel(sn).l, ruler.t, V.b); g.strokeStyle = '#ffd400'; g.lineWidth = 1; g.stroke(); }
  const ph = $('#playhead'); const px = rel(ph).l;
  if (px >= V.l - 1 && px <= V.r + 1) {
    g.beginPath(); radial(g, px, ruler.t, Math.min(V.b, rel($('#lanes')).b)); g.strokeStyle = '#7fb6ff'; g.lineWidth = 1.5; g.shadowColor = '#3d8bff'; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
  }
  g.restore();
  if (px >= V.l - 1 && px <= V.r + 1) { // time bubble on top of everything
    const tc = fmt(T, P.fps); g.font = `600 10.5px ${mono}`; const tw = g.measureText(tc).width + 18;
    boxAt(g, { l: px - tw / 2, r: px + tw / 2, t: ruler.t - 1, b: ruler.t + 17 }, (w, h) => { rr(g, -w / 2, -h / 2, w, h, h / 2); g.fillStyle = '#0d1a36'; g.shadowColor = 'rgba(61,139,255,.8)'; g.shadowBlur = 12; g.fill(); g.shadowBlur = 0; g.strokeStyle = '#5fa2ff'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#e6f0ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tc, 0, .5); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; });
    const [dx, dy] = arcFwd(px, ruler.b + 2); g.beginPath(); g.arc(dx, dy, 4, 0, 7); g.fillStyle = '#9cc8ff'; g.shadowColor = '#3d8bff'; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
  }
  // --- track heads ---
  const HD = rel($('#heads'));
  g.save(); sector(g, HD.l, V.t, HD.r, V.b); g.clip();
  for (const hd of $$('#heads .head')) {
    const r = rel(hd); if (r.b < V.t || r.t > V.b) continue; const tc = getComputedStyle(hd).getPropertyValue('--tc').trim() || '#3d7bff';
    const sp = hd.querySelector('span'); if (sp) { const S = rel(sp); boxAt(g, S, (w, h) => {
      rr(g, -w / 2, -h / 2, w, h, 10); g.fillStyle = 'rgba(12,22,44,.92)'; g.fill(); g.strokeStyle = 'rgba(120,160,255,.22)'; g.lineWidth = 1; g.stroke();
      const d = Math.min(16, h - 8); rr(g, -w / 2 + 4, -d / 2, d, d, 5); g.fillStyle = tc; g.fill();
      g.fillStyle = '#e8eefc'; g.font = `600 11.5px ${sans}`; g.textBaseline = 'middle'; g.fillText(sp.textContent, -w / 2 + d + 10, .5, w - d - 14); g.textBaseline = 'alphabetic'; }); }
    for (const b of hd.querySelectorAll('button')) boxAt(g, rel(b), (w, h) => { rr(g, -w / 2, -h / 2, w, h, 4); g.fillStyle = b.classList.contains('on') ? '#3d8bff' : 'rgba(255,255,255,.05)'; g.fill(); g.fillStyle = b.classList.contains('on') ? '#fff' : 'rgba(200,215,245,.55)'; g.font = `600 9px ${mono}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.textContent, 0, .5); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; });
  }
  g.restore();
}
(function arcLoop() { if (arcDirty && isArc()) { try { drawArc(); } catch (e) { console.warn('arc draw', e); } } requestAnimationFrame(arcLoop); })();
new MutationObserver(() => { arcDirty = true; }).observe($('.tl-body'), { subtree: true, childList: true, attributes: true, characterData: true });
$('#lanesWrap').addEventListener('scroll', () => { arcDirty = true; }, true);
$('#heads').addEventListener('scroll', () => { arcDirty = true; });
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
  <div class="arc-orb"><div class="wv l">${'<i></i>'.repeat(16)}</div><button id="arcMic" title="Hold to talk (Ctrl+Space)"><i></i></button><div class="wv r">${'<i></i>'.repeat(16)}</div></div>
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
applySkin = function (id, persist) { _applySkin6(id, persist); setTimeout(() => { sizeBend(); if (isArc()) { fillStrips(); fillCard(); ensureVisible(); } }, 30); };
const _applyEdition6 = applyEdition;
applyEdition = function (ed, persist) { _applyEdition6(ed, persist); setTimeout(sizeBend, 40); };
const _enterEditor6 = enterEditor;
enterEditor = function (p) { _enterEditor6(p); setTimeout(() => { sizeBend(); fillStrips(); fillCard(); }, 100); };
if (typeof selectFile === 'function') { const _sf6 = selectFile; selectFile = async function (p) { await _sf6(p); fillCard(); }; }
