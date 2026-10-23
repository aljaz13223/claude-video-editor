// Takeframe engine: project model, commands (shared by the human and the AI), undo, and the frame compositor.
// Used by the editor window (live preview) and the hidden render window (frame-exact export).
(function (G) {
  'use strict';
  const uid = (p = 'c') => p + Math.random().toString(36).slice(2, 8);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------- easing ----------------
  const E = {
    linear: t => t,
    sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2,
    cubicOut: t => 1 - Math.pow(1 - t, 3),
    cubicInOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    expoOut: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
    expoIn: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
    expoInOut: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    backOut: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    hold: t => t < 1 ? 0 : 1,
  };
  const ease = (name, t) => (E[name] || E.cubicOut)(clamp(t, 0, 1));

  // ---------------- project ----------------
  const FORMATS = {
    '9:16': { w: 1080, h: 1920 }, '16:9': { w: 1920, h: 1080 }, '1:1': { w: 1080, h: 1080 }, '4:5': { w: 1080, h: 1350 },
  };
  function newProject({ name = 'Untitled', client = '', format = '9:16', fps = 30, duration = 20, folder = '' } = {}) {
    const f = FORMATS[format] || FORMATS['9:16'];
    return {
      app: 'Takeframe', version: 1, name, client, folder, format, w: f.w, h: f.h, fps, duration,
      tracks: [
        { id: 'V3', kind: 'video', name: 'Graphics' }, { id: 'V2', kind: 'video', name: 'Overlay' }, { id: 'V1', kind: 'video', name: 'Picture' },
        { id: 'A1', kind: 'audio', role: 'music', name: 'Music' }, { id: 'A2', kind: 'audio', role: 'sfx', name: 'SFX' }, { id: 'A3', kind: 'audio', role: 'speech', name: 'Voice' },
      ],
      trackState: {}, clips: [], media: [], markers: [], notes: [], inPoint: null, outPoint: null, music: null,
      created: new Date().toISOString(),
    };
  }
  const isVisualTrack = (p, id) => (p.tracks.find(t => t.id === id) || {}).kind === 'video';
  const trackOrder = p => p.tracks.filter(t => t.kind === 'video').map(t => t.id).reverse(); // V1 bottom first
  const clipEnd = c => c.start + c.dur;
  const mediaOf = (p, c) => p.media.find(m => m.id === c.media);

  const DEF = {
    props: { x: 0, y: 0, scale: 1, rot: 0, opacity: 1 },
    style: { font: 'Archivo', size: 96, weight: 800, color: '#ffffff', bg: '', align: 'center', case: '', tracking: 0, lh: 1.02, width: 0.86, stretch: 100, italic: false, shadow: false, stroke: '' },
    anim: { in: 'rise', out: 'fade', inDur: .6, outDur: .35, stagger: .06, ease: 'expoOut' },
  };
  function normClip(c) {
    c.id = c.id || uid();
    c.start = +c.start || 0; c.dur = Math.max(1 / 60, +c.dur || 1); c.in = +c.in || 0; c.speed = +c.speed || 1;
    c.props = Object.assign({}, DEF.props, c.props || {});
    if (c.type === 'title') { c.style = Object.assign({}, DEF.style, c.style || {}); c.anim = Object.assign({}, DEF.anim, c.anim || {}); }
    if (c.type === 'image' || c.type === 'video') { c.fit = c.fit || 'cover'; c.anim = Object.assign({ in: 'none', out: 'none', inDur: .5, outDur: .4, ease: 'expoOut', kb: 0 }, c.anim || {}); }
    if (c.type === 'shape') c.fill = c.fill || '#111';
    if (c.volume == null) c.volume = 0; // dB
    c.fadeIn = +c.fadeIn || 0; c.fadeOut = +c.fadeOut || 0; c.pan = +c.pan || 0;
    c.kf = c.kf || {}; c.fx = c.fx || {};
    return c;
  }

  // ---------------- commands (one list for human + AI) ----------------
  // Every op is a plain object {op:'name', ...args}. apply() returns a short human-readable log line.
  const OPS = {
    add_clip(p, a) {
      const c = normClip(Object.assign({}, a.clip));
      if (!p.tracks.find(t => t.id === c.track)) throw new Error('unknown track ' + c.track);
      if (a.mode === 'insert') OPS.ripple_insert(p, { track: c.track, at: c.start, dur: c.dur });
      else carve(p, c.track, c.start, clipEnd(c));
      p.clips.push(c); return `added ${c.type} "${label(p, c)}" on ${c.track} at ${c.start.toFixed(2)}s`;
    },
    update_clip(p, a) {
      const c = need(p, a.id); const patch = a.patch || {};
      for (const k of Object.keys(patch)) {
        if (['props', 'style', 'anim', 'fx', 'transition'].includes(k) && patch[k] && typeof patch[k] === 'object') c[k] = Object.assign({}, c[k] || {}, patch[k]);
        else if (k === 'kf') c.kf = Object.assign({}, c.kf, patch.kf);
        else c[k] = patch[k];
      }
      normClip(c); return `updated ${label(p, c)} (${Object.keys(patch).join(', ')})`;
    },
    delete_clip(p, a) {
      const ids = a.ids || [a.id]; const gone = p.clips.filter(c => ids.includes(c.id));
      p.clips = p.clips.filter(c => !ids.includes(c.id));
      if (a.ripple) for (const c of gone.sort((x, y) => y.start - x.start)) shiftAfter(p, c.track, c.start, -c.dur);
      return `deleted ${gone.length} clip(s)${a.ripple ? ' (ripple)' : ''}`;
    },
    move_clip(p, a) {
      const c = need(p, a.id); const s = Math.max(0, +a.start); const tr = a.track || c.track;
      const others = p.clips.filter(o => o !== c); const keep = p.clips; p.clips = others; carve(p, tr, s, s + c.dur); p.clips.push(c);
      c.start = s; c.track = tr; return `moved ${label(p, c)} to ${tr} @ ${s.toFixed(2)}s`;
    },
    trim_clip(p, a) {
      const c = need(p, a.id);
      if (a.edge === 'start') { const ns = clamp(+a.t, 0, clipEnd(c) - 1 / 30); const d = ns - c.start; c.in = Math.max(0, c.in + d * c.speed); c.dur -= d; c.start = ns; }
      else { c.dur = Math.max(1 / 30, +a.t - c.start); }
      return `trimmed ${label(p, c)} → ${c.start.toFixed(2)}–${clipEnd(c).toFixed(2)}s`;
    },
    split_clip(p, a) {
      const t = +a.t; const targets = a.id ? [need(p, a.id)] : p.clips.filter(c => c.start < t && clipEnd(c) > t && (!a.tracks || a.tracks.includes(c.track)));
      let n = 0;
      for (const c of targets) {
        if (!(c.start < t && clipEnd(c) > t)) continue;
        const b = JSON.parse(JSON.stringify(c)); b.id = uid(); const d = t - c.start;
        c.dur = d; c.fadeOut = 0; b.start = t; b.dur -= d; b.in = c.in + d * c.speed; b.fadeIn = 0; delete b.transition;
        if (c.type === 'title') { b.anim = Object.assign({}, b.anim, { in: 'none' }); c.anim = Object.assign({}, c.anim, { out: 'none' }); }
        p.clips.push(b); n++;
      }
      return `split ${n} clip(s) at ${t.toFixed(2)}s`;
    },
    ripple_insert(p, a) { shiftAfter(p, a.track, a.at, a.dur, true); return `opened ${a.dur.toFixed(2)}s gap on ${a.track}`; },
    close_gaps(p, a) {
      const tr = a.track; const cs = p.clips.filter(c => c.track === tr).sort((x, y) => x.start - y.start); let t = 0;
      for (const c of cs) { c.start = t; t = clipEnd(c); } return `closed gaps on ${tr}`;
    },
    set_transition(p, a) { const c = need(p, a.id); c.transition = a.type && a.type !== 'none' ? { type: a.type, dur: +a.dur || .4 } : null; return `transition ${a.type || 'none'} on ${label(p, c)}`; },
    set_keyframe(p, a) {
      const c = need(p, a.id); const list = (c.kf[a.prop] = c.kf[a.prop] || []); const t = +a.t;
      const i = list.findIndex(k => Math.abs(k.t - t) < 1e-3);
      const k = { t, v: +a.v, e: a.ease || 'cubicInOut' };
      if (i >= 0) list[i] = k; else list.push(k); list.sort((x, y) => x.t - y.t);
      return `keyframe ${a.prop}=${a.v} @ ${t.toFixed(2)}s on ${label(p, c)}`;
    },
    clear_keyframes(p, a) { const c = need(p, a.id); if (a.prop) delete c.kf[a.prop]; else c.kf = {}; return `cleared keyframes on ${label(p, c)}`; },
    add_track(p, a) {
      const kind = a.kind === 'audio' ? 'audio' : 'video';
      const n = p.tracks.filter(t => t.kind === kind).length + 1; const id = (kind === 'video' ? 'V' : 'A') + n;
      const t = { id, kind, name: a.name || (kind === 'video' ? 'Graphics ' + n : 'Audio ' + n) }; if (kind === 'audio') t.role = a.role || 'sfx';
      if (kind === 'video') p.tracks.unshift(t); else p.tracks.push(t);
      return `added track ${id}`;
    },
    add_marker(p, a) { p.markers.push({ id: uid('m'), t: +a.t, name: a.name || 'Marker', color: a.color || '#f5c400' }); return `marker "${a.name || 'Marker'}" @ ${(+a.t).toFixed(2)}s`; },
    delete_marker(p, a) { p.markers = p.markers.filter(m => m.id !== a.id); return 'deleted marker'; },
    set_project(p, a) {
      for (const k of ['name', 'duration', 'fps', 'client']) if (a[k] != null) p[k] = a[k];
      if (a.format && FORMATS[a.format]) { p.format = a.format; p.w = FORMATS[a.format].w; p.h = FORMATS[a.format].h; }
      return 'project settings updated';
    },
    set_track(p, a) { p.trackState[a.track] = Object.assign({}, p.trackState[a.track], a.state); return `track ${a.track}: ${JSON.stringify(a.state)}`; },
    set_in_out(p, a) { if ('in' in a) p.inPoint = a.in; if ('out' in a) p.outPoint = a.out; return `in/out ${p.inPoint ?? '–'} / ${p.outPoint ?? '–'}`; },
    add_media(p, a) { for (const m of a.media) if (!p.media.find(x => x.path === m.path)) p.media.push(Object.assign({ id: uid('m') }, m)); return `imported ${a.media.length} file(s)`; },
    update_media(p, a) { const m = p.media.find(x => x.id === a.id); if (m) Object.assign(m, a.patch); return `media ${a.id} updated`; },
    note(p, a) { p.notes.push({ t: a.t ?? null, text: a.text, by: a.by || 'claude', at: Date.now() }); return 'note added'; },
  };
  function need(p, id) { const c = p.clips.find(c => c.id === id); if (!c) throw new Error('no clip ' + id); return c; }
  function label(p, c) {
    if (c.type === 'title') return (c.text || '').slice(0, 24);
    const m = mediaOf(p, c); return m ? m.name : c.type;
  }
  // overwrite: cut away whatever overlaps [s,e) on the track
  function carve(p, track, s, e) {
    const out = [];
    for (const c of p.clips) {
      if (c.track !== track || clipEnd(c) <= s + 1e-6 || c.start >= e - 1e-6) { out.push(c); continue; }
      if (c.start < s) { const left = JSON.parse(JSON.stringify(c)); left.dur = s - c.start; out.push(left); }
      if (clipEnd(c) > e) { const right = JSON.parse(JSON.stringify(c)); right.id = uid(); const d = e - c.start; right.start = e; right.dur = clipEnd(c) - e; right.in = c.in + d * c.speed; delete right.transition; out.push(right); }
    }
    p.clips = out;
  }
  function shiftAfter(p, track, at, d, splitFirst) {
    if (splitFirst) OPS.split_clip(p, { t: at, tracks: [track] });
    for (const c of p.clips) if (c.track === track && c.start >= at - 1e-6) c.start = Math.max(0, c.start + d);
  }

  class History {
    constructor(project) { this.p = project; this.undo = []; this.redo = []; this.log = []; this.listeners = []; }
    apply(ops, by = 'you', group = '') {
      ops = Array.isArray(ops) ? ops : [ops];
      const before = JSON.stringify(this.p); const lines = [];
      try { for (const o of ops) { const f = OPS[o.op]; if (!f) throw new Error('unknown op ' + o.op); lines.push(f(this.p, o)); } }
      catch (e) { Object.assign(this.p, JSON.parse(before)); throw e; }
      this.undo.push({ before, by, group, lines }); this.redo = [];
      if (this.undo.length > 300) this.undo.shift();
      const entry = { by, group, lines, at: Date.now() }; this.log.push(entry); this.emit(entry); return lines;
    }
    doUndo() { const u = this.undo.pop(); if (!u) return null; this.redo.push({ before: JSON.stringify(this.p), by: u.by, group: u.group, lines: u.lines }); this.replace(u.before); this.emit({ by: 'you', lines: ['undo: ' + (u.group || u.lines[0])] }); return u; }
    doRedo() { const r = this.redo.pop(); if (!r) return null; this.undo.push({ before: JSON.stringify(this.p), by: r.by, group: r.group, lines: r.lines }); this.replace(r.before === undefined ? null : null); return r; }
    replace(json) { if (json) { const o = JSON.parse(json); for (const k of Object.keys(this.p)) delete this.p[k]; Object.assign(this.p, o); } }
    on(f) { this.listeners.push(f); }
    emit(e) { for (const f of this.listeners) f(e); }
  }
  // proper redo: store "after" snapshots
  History.prototype.doRedo = function () {
    const r = this.redo.pop(); if (!r) return null;
    const cur = JSON.stringify(this.p); this.replace(r.before); this.undo.push({ before: cur, by: r.by, group: r.group, lines: r.lines });
    this.emit({ by: 'you', lines: ['redo: ' + (r.group || r.lines[0])] }); return r;
  };

  // ---------------- evaluation ----------------
  function kfValue(c, prop, lt, base) {
    const list = c.kf && c.kf[prop]; if (!list || !list.length) return base;
    if (lt <= list[0].t) return list[0].v; const last = list[list.length - 1]; if (lt >= last.t) return last.v;
    for (let i = 0; i < list.length - 1; i++) { const a = list[i], b = list[i + 1]; if (lt >= a.t && lt <= b.t) return lerp(a.v, b.v, ease(a.e || 'cubicInOut', (lt - a.t) / (b.t - a.t))); }
    return base;
  }
  function propsAt(c, lt) { const o = {}; for (const k of Object.keys(DEF.props)) o[k] = kfValue(c, k, lt, c.props[k]); return o; }

  // which clips are visible at t on a visual track, including the outgoing clip during a transition
  function layersAt(p, t) {
    const out = [];
    for (const tr of trackOrder(p)) {
      const st = p.trackState[tr] || {}; if (st.hidden) continue;
      const cs = p.clips.filter(c => c.track === tr).sort((a, b) => a.start - b.start);
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (t >= c.start && t < clipEnd(c)) {
          const tr0 = c.transition; let prog = 1;
          if (tr0 && t < c.start + tr0.dur) {
            prog = (t - c.start) / tr0.dur;
            const prev = cs.slice(0, i).reverse().find(o => Math.abs(clipEnd(o) - c.start) < .05);
            if (prev) out.push({ clip: prev, lt: t - prev.start, outgoing: true, prog, tr: tr0, track: tr });
          }
          out.push({ clip: c, lt: t - c.start, prog, tr: tr0 && t < c.start + tr0.dur ? tr0 : null, track: tr });
        }
      }
    }
    return out;
  }

  // ---------------- compositor ----------------
  // stage: an element sized p.w x p.h (scaled with CSS transform by the caller). resolve(media) -> URL.
  class Compositor {
    constructor(stage, resolve) { this.stage = stage; this.resolve = resolve; this.nodes = new Map(); this.exact = false; }
    async draw(p, t, opts = {}) {
      this.exact = !!opts.exact;
      const S = this.stage; S.style.width = p.w + 'px'; S.style.height = p.h + 'px';
      const layers = layersAt(p, t); const seen = new Set(); const waits = [];
      let z = 1;
      for (const L of layers) {
        const key = L.clip.id + (L.outgoing ? ':o' : '');
        seen.add(key);
        let node = this.nodes.get(key);
        if (!node || node._type !== L.clip.type || node._sig !== sig(p, L.clip)) { if (node) node.remove(); node = this.make(p, L.clip); node._type = L.clip.type; node._sig = sig(p, L.clip); this.nodes.set(key, node); S.appendChild(node); }
        node.style.zIndex = z++;
        const w = this.paint(p, L, node, opts); if (w) waits.push(w);
      }
      for (const [k, n] of this.nodes) if (!seen.has(k)) { const v = n.querySelector('video'); if (v) v.pause(); n.remove(); this.nodes.delete(k); }
      if (this.exact) { await Promise.all(waits); if (document.fonts) await document.fonts.ready; }
      return layers;
    }
    make(p, c) {
      const n = document.createElement('div'); n.className = 'tf-layer tf-' + c.type;
      n.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 50%;will-change:transform,opacity;';
      const m = mediaOf(p, c);
      if (c.type === 'video') {
        const v = document.createElement('video'); v.src = this.resolve(m); v.muted = true; v.preload = 'auto'; v.playsInline = true;
        v.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${c.fit};`; n.appendChild(v);
      } else if (c.type === 'image') {
        const i = document.createElement('img'); i.src = this.resolve(m); i.decoding = 'sync';
        i.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${c.fit};`; n.appendChild(i);
      } else if (c.type === 'shape') {
        const s = document.createElement('div'); s.style.cssText = 'position:absolute;inset:0;'; n.appendChild(s);
      } else if (c.type === 'title') {
        const box = document.createElement('div'); box.className = 'tf-title'; n.appendChild(box); buildTitle(box, c, p);
      }
      return n;
    }
    paint(p, L, n, opts) {
      const c = L.clip, lt = L.lt, pr = propsAt(c, lt);
      let x = pr.x, y = pr.y, sc = pr.scale, rot = pr.rot, op = pr.opacity, clip = '', blur = 0;
      // clip in/out animation for picture clips
      if ((c.type === 'image' || c.type === 'video') && c.anim) {
        const a = c.anim;
        if (a.kb) { const k = lt / c.dur; sc *= 1 + a.kb * k; } // ken burns slow push
        const ki = a.in !== 'none' ? ease(a.ease, lt / a.inDur) : 1, ko = a.out !== 'none' ? ease('cubicInOut', (c.dur - lt) / a.outDur) : 1;
        if (a.in === 'fade') op *= ki; if (a.in === 'zoom') { sc *= lerp(1.18, 1, ki); op *= Math.min(1, ki * 2); }
        if (a.in === 'slide-up') y += (1 - ki) * p.h * .25, op *= Math.min(1, ki * 3);
        if (a.out === 'fade') op *= ko;
      }
      // transitions
      if (L.tr) {
        const tp = ease('cubicInOut', L.prog), ty = L.tr.type, inc = !L.outgoing;
        if (ty === 'crossfade') { if (inc) op *= tp; }
        else if (ty === 'dip') { if (L.outgoing) op *= clamp(1 - tp * 2, 0, 1); else op *= clamp(tp * 2 - 1, 0, 1); }
        else if (ty === 'push-left') x += (inc ? 1 - tp : -tp) * p.w;
        else if (ty === 'push-up') y += (inc ? 1 - tp : -tp) * p.h;
        else if (ty === 'slide') { if (inc) x += (1 - ease('expoOut', L.prog)) * p.w; else x -= ease('expoOut', L.prog) * p.w * .3; }
        else if (ty === 'zoom') { if (inc) { sc *= lerp(1.6, 1, ease('expoOut', L.prog)); op *= tp; } else { sc *= lerp(1, .85, tp); } }
        else if (ty === 'wipe') { if (inc) clip = `inset(0 ${(1 - tp) * 100}% 0 0)`; }
        else if (ty === 'iris') { if (inc) clip = `circle(${tp * 75}% at 50% 50%)`; }
        else if (ty === 'blur') { if (inc) { op *= tp; blur = (1 - tp) * 30; } else blur = tp * 30; }
        else if (ty === 'whip') { const k = inc ? 1 - ease('expoOut', L.prog) : ease('expoIn', L.prog); x += (inc ? 1 : -1) * k * p.w; blur = k * 40; }
      }
      const fx = c.fx || {}; const filt = [];
      if (fx.brightness != null) filt.push(`brightness(${fx.brightness})`); if (fx.contrast != null) filt.push(`contrast(${fx.contrast})`);
      if (fx.saturate != null) filt.push(`saturate(${fx.saturate})`); if (fx.hue) filt.push(`hue-rotate(${fx.hue}deg)`);
      if (fx.grayscale) filt.push(`grayscale(${fx.grayscale})`); if (fx.sepia) filt.push(`sepia(${fx.sepia})`);
      if (fx.blur || blur) filt.push(`blur(${(fx.blur || 0) + blur}px)`);
      if (fx.temp) filt.push(`sepia(${Math.max(0, fx.temp) * .3}) hue-rotate(${-fx.temp * 8}deg)`);
      n.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg) scale(${sc})`;
      n.style.opacity = clamp(op, 0, 1); n.style.filter = filt.join(' '); n.style.clipPath = clip;
      n.style.mixBlendMode = c.blend || 'normal';
      if (c.type === 'shape') paintShape(n.firstChild, c, lt, p);
      if (c.type === 'title') paintTitle(n.firstChild, c, lt, p);
      if (c.type === 'video') return this.seekVideo(n.firstChild, c, lt, opts);
      if (c.type === 'image' && this.exact) { const img = n.firstChild; if (!img.complete) return new Promise(r => { img.onload = img.onerror = r; }); }
      return null;
    }
    seekVideo(v, c, lt, opts) {
      const target = c.in + lt * c.speed;
      if (opts.playing) {
        v.playbackRate = c.speed;
        if (Math.abs(v.currentTime - target) > .25) v.currentTime = target;
        if (v.paused) v.play().catch(() => {});
        return null;
      }
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) < 1 / 120 && v.readyState >= 2) return null;
      return new Promise(res => {
        const done = () => { v.removeEventListener('seeked', done); requestAnimationFrame(() => res()); };
        const go = () => { v.addEventListener('seeked', done); v.currentTime = target; };
        if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
        setTimeout(res, this.exact ? 4000 : 500);
      });
    }
  }
  function sig(p, c) {
    if (c.type === 'title') return JSON.stringify([c.text, c.style, c.anim.in, c.anim.out]);
    if (c.type === 'video' || c.type === 'image') { const m = mediaOf(p, c); return (m ? m.path : '') + c.fit; }
    return '';
  }

  function paintShape(el, c, lt, p) {
    const f = c.fill || '#000';
    if (typeof f === 'string') { el.style.background = f; return; }
    if (f.kind === 'gradient') { const ang = (f.angle || 160) + (f.spin || 0) * lt; el.style.background = `linear-gradient(${ang}deg, ${f.stops.join(',')})`; }
    else if (f.kind === 'radial') { const px = 50 + 20 * Math.sin(lt * (f.drift || 0)), py = 40 + 15 * Math.cos(lt * (f.drift || 0) * .7); el.style.background = `radial-gradient(circle at ${px}% ${py}%, ${f.stops.join(',')})`; }
    else if (f.kind === 'grid') {
      const s = f.size || 90, off = (lt * (f.speed || 20)) % s;
      el.style.background = `${f.bg || '#0b0b0c'}`; el.style.backgroundImage = `linear-gradient(${f.line || 'rgba(255,255,255,.07)'} 1px, transparent 1px), linear-gradient(90deg, ${f.line || 'rgba(255,255,255,.07)'} 1px, transparent 1px)`;
      el.style.backgroundSize = `${s}px ${s}px`; el.style.backgroundPosition = `0 ${off}px, ${off}px 0`;
    } else if (f.kind === 'bar') {
      el.style.background = 'transparent';
      if (!el.firstChild) { const b = document.createElement('div'); b.style.cssText = 'position:absolute;'; el.appendChild(b); }
      const b = el.firstChild, k = ease(f.ease || 'expoOut', lt / (f.inDur || .5)), ko = f.outDur ? ease('cubicInOut', (c.dur - lt) / f.outDur) : 1;
      b.style.background = f.color || '#fff'; b.style.left = (f.x ?? .1) * p.w + 'px'; b.style.top = (f.y ?? .5) * p.h + 'px';
      b.style.width = (f.w ?? .8) * p.w * k * ko + 'px'; b.style.height = (f.h ?? 12) + 'px'; b.style.borderRadius = (f.r || 0) + 'px';
    } else if (f.kind === 'circle') {
      el.style.background = 'transparent';
      if (!el.firstChild) { const b = document.createElement('div'); b.style.cssText = 'position:absolute;border-radius:50%;'; el.appendChild(b); }
      const b = el.firstChild, k = ease(f.ease || 'backOut', lt / (f.inDur || .6)), d = (f.d ?? .5) * p.w * k;
      b.style.background = f.color || '#fff'; b.style.width = b.style.height = d + 'px';
      b.style.left = (f.x ?? .5) * p.w - d / 2 + 'px'; b.style.top = (f.y ?? .5) * p.h - d / 2 + 'px';
      b.style.border = f.ring ? `${f.ring}px solid ${f.color}` : ''; if (f.ring) b.style.background = 'transparent';
    }
  }

  // titles: split into words / letters once, animate per unit each frame
  function buildTitle(box, c, p) {
    const s = c.style; box.innerHTML = '';
    box.style.cssText = `position:absolute;left:${(1 - s.width) / 2 * 100}%;width:${s.width * 100}%;top:0;height:100%;display:flex;flex-direction:column;justify-content:center;` +
      `align-items:${s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center'};text-align:${s.align};` +
      `font-family:'${s.font}',sans-serif;font-size:${s.size}px;font-weight:${s.weight};color:${s.color};line-height:${s.lh};letter-spacing:${s.tracking}em;` +
      `font-stretch:${s.stretch}%;font-style:${s.italic ? 'italic' : 'normal'};text-transform:${s.case === 'upper' ? 'uppercase' : s.case === 'lower' ? 'lowercase' : 'none'};` +
      (s.shadow ? 'text-shadow:0 6px 30px rgba(0,0,0,.45);' : '') + (s.stroke ? `-webkit-text-stroke:${s.stroke};` : '');
    const vpos = c.props && c.props.vpos; if (vpos) box.style.justifyContent = vpos;
    const lines = String(c.text || '').split('\n'); const units = [];
    const letters = ['type', 'split', 'scramble'].includes(c.anim.in);
    lines.forEach(line => {
      const ln = document.createElement('div'); ln.style.cssText = 'display:block;white-space:nowrap;';
      if (s.bg) { ln.style.background = s.bg; ln.style.padding = '.08em .28em'; ln.style.margin = '.04em 0'; ln.style.display = 'inline-block'; }
      const words = line.split(' ');
      words.forEach((w, wi) => {
        const mask = document.createElement('span'); mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.14em;margin-bottom:-.14em;';
        const inner = document.createElement('span'); inner.style.cssText = 'display:inline-block;will-change:transform,opacity;';
        if (letters) { for (const ch of w) { const l = document.createElement('span'); l.textContent = ch; l.style.display = 'inline-block'; inner.appendChild(l); units.push(l); } }
        else { inner.textContent = w; units.push(inner); }
        mask.appendChild(inner); ln.appendChild(mask);
        if (wi < words.length - 1) ln.appendChild(document.createTextNode(' '));
      });
      box.appendChild(ln);
    });
    box._units = units;
  }
  const SCR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*';
  function paintTitle(box, c, lt, p) {
    const a = c.anim, U = box._units || [], n = U.length;
    const total = a.inDur + a.stagger * Math.max(0, n - 1);
    U.forEach((u, i) => {
      const k = a.in === 'none' ? 1 : ease(a.ease, (lt - i * a.stagger) / a.inDur);
      const ko = a.out === 'none' ? 1 : ease('cubicInOut', (c.dur - lt) / a.outDur);
      let tf = '', op = 1;
      switch (a.in) {
        case 'rise': tf = `translateY(${(1 - k) * 60}%)`; op = Math.min(1, k * 1.6); break;
        case 'mask': tf = `translateY(${(1 - k) * 110}%)`; break;
        case 'pop': tf = `scale(${lerp(.2, 1, ease('backOut', (lt - i * a.stagger) / a.inDur))})`; op = Math.min(1, k * 3); break;
        case 'blur': op = k; u.style.filter = `blur(${(1 - k) * 18}px)`; break;
        case 'type': op = lt >= i * a.stagger ? 1 : 0; break;
        case 'split': tf = `translateX(${(1 - k) * (i - n / 2) * 18}px)`; op = k; break;
        case 'slide': tf = `translateX(${(1 - k) * -40}%)`; op = k; break;
        case 'scramble': { const done = lt >= i * a.stagger + a.inDur * .6; if (!u._ch) u._ch = u.textContent; u.textContent = done || u._ch === ' ' ? u._ch : SCR[Math.floor((lt * 30 + i * 7)) % SCR.length]; op = lt >= i * a.stagger * .5 ? 1 : 0; break; }
        case 'fade': op = k; break;
      }
      if (a.out === 'fade') op *= ko;
      else if (a.out === 'drop') { tf += ` translateY(${(1 - ko) * 110}%)`; }
      else if (a.out === 'blur') { op *= ko; u.style.filter = `blur(${(1 - ko) * 14}px)`; }
      u.style.transform = tf; u.style.opacity = op;
    });
    box._total = total;
  }

  // ---------------- audio plan (for export & preview) ----------------
  function audioClips(p, role) {
    const st = p.trackState || {};
    const anySolo = Object.values(st).some(s => s.solo);
    return p.clips.filter(c => {
      const tr = p.tracks.find(t => t.id === c.track); if (!tr) return false;
      const s = st[c.track] || {}; if (s.mute || (anySolo && !s.solo)) return false;
      if (tr.kind === 'audio') return !role || tr.role === role;
      if (c.type === 'video' && !c.muteAudio) { const m = mediaOf(p, c); return m && m.hasAudio && (!role || (c.audioRole || 'speech') === role); }
      return false;
    });
  }

  // ---------------- transcript helpers ----------------
  function timelineWords(p) {
    const words = [];
    for (const c of p.clips) {
      const m = mediaOf(p, c); if (!m || !m.transcript) continue;
      const tr = p.tracks.find(t => t.id === c.track); if (!tr) continue;
      if (!(c.type === 'video' || c.type === 'audio')) continue;
      for (const s of m.transcript.segments) for (const w of s.words || []) {
        const tl = c.start + (w.s - c.in) / c.speed, te = c.start + (w.e - c.in) / c.speed;
        if (tl >= c.start - .01 && te <= clipEnd(c) + .01) words.push({ w: w.w, s: tl, e: te, clip: c.id });
      }
    }
    return words.sort((a, b) => a.s - b.s);
  }
  const ts = (t, sep = ',') => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t) % 60, ms = Math.round((t % 1) * 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms).padStart(3, '0')}`; };
  function cues(words, maxWords = 7, maxGap = .6) {
    const out = []; let cur = null;
    for (const w of words) {
      if (!cur || cur.words.length >= maxWords || w.s - cur.e > maxGap || /[.!?]$/.test(cur.words[cur.words.length - 1].w)) { cur = { s: w.s, e: w.e, words: [] }; out.push(cur); }
      cur.words.push(w); cur.e = w.e;
    }
    return out.map(c => ({ s: c.s, e: c.e, text: c.words.map(w => w.w).join(' ') }));
  }
  function toSRT(words) { return cues(words).map((c, i) => `${i + 1}\n${ts(c.s)} --> ${ts(c.e)}\n${c.text}\n`).join('\n'); }
  function toVTT(words) { return 'WEBVTT\n\n' + cues(words).map(c => `${ts(c.s, '.')} --> ${ts(c.e, '.')}\n${c.text}\n`).join('\n'); }
  function toTXT(words) { return cues(words, 40, 1.2).map(c => `[${ts(c.s).slice(3, 8)}] ${c.text}`).join('\n'); }

  G.TF = { uid, clamp, ease, E, FORMATS, newProject, normClip, OPS, History, layersAt, propsAt, Compositor, audioClips, timelineWords, toSRT, toVTT, toTXT, clipEnd, mediaOf, trackOrder, isVisualTrack };
})(typeof window !== 'undefined' ? window : globalThis);
