// Takeframe - main process: files, media probing, Python audio tools, the Claude agent and frame-exact export.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
require('./src/engine.js');
const TF = globalThis.TF;
// keep a map of our own ipc handlers so the agent can call them directly
const handlers = {};
const _handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (ch, fn) => { handlers[ch] = fn; return _handle(ch, fn); };
function ipcInvokeLocal(ch, arg) { return handlers[ch](null, arg); }

const ROOT = process.env.TAKEFRAME_ROOT || (fs.existsSync('F:\\claude system') ? 'F:\\claude system' : path.join(os.homedir(), 'Takeframe'));
const HOME_DIR = path.join(os.homedir(), '.takeframe');
const PY = process.env.TAKEFRAME_PYTHON || (process.platform === 'win32' ? path.join(HOME_DIR, 'venv', 'Scripts', 'python.exe') : path.join(HOME_DIR, 'venv', 'bin', 'python'));
const PYDIR = path.join(__dirname, 'py');
const SFX_DIR = path.join(ROOT, '00-SISTEM', 'assets', 'sfx-library');
const MUSIC_LOG = path.join(ROOT, '00-SISTEM', 'GLASBA-DNEVNIK.md');
const MODEL = process.env.TAKEFRAME_MODEL || 'claude-opus-5-5';
fs.mkdirSync(HOME_DIR, { recursive: true });
const RECENT = path.join(HOME_DIR, 'recent.json');

let win = null, renderWin = null;
const VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi|mts)$/i, IMAGE = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i, AUDIO = /\.(wav|mp3|m4a|aac|flac|ogg|opus|aif+)$/i;

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1180, minHeight: 720, backgroundColor: '#0c0d0f', title: 'Takeframe',
    autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  if (process.env.TAKEFRAME_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
}
// headless export:  electron . --export "project.takeframe.json" [--res 1080x1920,1920x1080] [--out dir] [--audio] [--stems] [--srt]
const argv = process.argv; const ai = argv.indexOf('--export');
if (ai > 0) {
  app.whenReady().then(async () => {
    const get = k => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : null; };
    try {
      const p = await handlers['project-open'](null, argv[ai + 1]);
      const opts = { video: (get('--res') || `${p.w}x${p.h}`).split(','), mp3: argv.includes('--audio'), music: argv.includes('--stems'), speech: argv.includes('--stems'),
        transcript: argv.includes('--srt') ? ['srt', 'txt'] : [], thumbnail: true, dir: get('--out') || undefined };
      const r = await handlers['export'](null, { project: p, opts });
      console.log('EXPORTED\n' + r.files.join('\n'));
    } catch (e) { console.error('EXPORT FAILED', e); process.exitCode = 1; }
    app.quit();
  });
} else app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (ai < 0) app.quit(); });

// ---------------- helpers ----------------
function sh(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, Object.assign({ windowsHide: true }, opts));
    let out = '', err = '';
    p.stdout && p.stdout.on('data', d => { out += d; opts.onOut && opts.onOut(String(d)); });
    p.stderr && p.stderr.on('data', d => { err += d; opts.onErr && opts.onErr(String(d)); });
    p.on('error', rej);
    p.on('close', code => code === 0 ? res({ out, err }) : rej(new Error(`${path.basename(cmd)} exit ${code}: ${err.slice(-1500)}`)));
    if (opts.stdin) { p.stdin.end(opts.stdin); }
  });
}
const lastJSON = s => { const i = s.lastIndexOf('\n{'); const t = (i >= 0 ? s.slice(i + 1) : s).trim(); try { return JSON.parse(t); } catch { return { raw: s.slice(-800) }; } };
async function py(script, args, onLine) {
  if (!fs.existsSync(PY)) throw new Error('Audio engine not installed. Run INSTALL-AUDIO.bat once.');
  const r = await sh(PY, [path.join(PYDIR, script), ...args], { env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }), onErr: onLine });
  return lastJSON(r.out);
}
async function probe(file) {
  const st = fs.statSync(file); const name = path.basename(file);
  const type = VIDEO.test(file) ? 'video' : IMAGE.test(file) ? 'image' : AUDIO.test(file) ? 'audio' : null;
  if (!type) return null;
  const m = { path: file, name, type, size: st.size, mtime: st.mtimeMs };
  try {
    const r = await sh('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
    const j = JSON.parse(r.out); const v = (j.streams || []).find(s => s.codec_type === 'video'); const a = (j.streams || []).find(s => s.codec_type === 'audio');
    if (v) { m.w = v.width; m.h = v.height; const rr = (v.avg_frame_rate || '0/1').split('/'); m.fps = +rr[1] ? +rr[0] / +rr[1] : 0; }
    m.hasAudio = !!a; m.duration = +(j.format && j.format.duration) || (type === 'image' ? 0 : 0);
    if (type === 'image') { m.duration = 0; m.hasAudio = false; }
  } catch (e) { m.error = String(e.message).slice(0, 200); }
  return m;
}
function walk(dir, depth = 0, out = []) {
  if (depth > 4 || out.length > 2000) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, depth + 1, out); else if (VIDEO.test(f) || IMAGE.test(f) || AUDIO.test(f)) out.push(f);
  }
  return out;
}
async function thumb(m, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const out = path.join(cacheDir, Buffer.from(m.path).toString('base64url').slice(-60) + '.jpg');
  if (fs.existsSync(out)) return out;
  if (m.type === 'audio') {
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', m.path, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=640x120:colors=#9fe870', '-frames:v', '1', out.replace('.jpg', '.png')]).catch(() => {});
    return out.replace('.jpg', '.png');
  }
  const at = m.type === 'video' ? Math.min(1, (m.duration || 2) / 3) : 0;
  await sh('ffmpeg', ['-y', '-v', 'error', '-ss', String(at), '-i', m.path, '-frames:v', '1', '-vf', 'scale=480:-2', out]).catch(() => {});
  return out;
}
function projectDir(p) { return p.folder || path.join(ROOT, 'takeframe-projects', safe(p.name)); }
const safe = s => String(s || 'project').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'project';
function finalDir(p) {
  if (p.client) { const d = path.join(ROOT, p.client, '03-final'); if (fs.existsSync(path.join(ROOT, p.client))) return d; }
  return path.join(projectDir(p), 'export');
}

// ---------------- IPC: environment, files, projects ----------------
ipcMain.handle('env', async () => {
  const has = k => !!process.env[k];
  let ff = false; try { execFileSync('ffmpeg', ['-version'], { windowsHide: true }); ff = true; } catch {}
  let gpu = ''; try { gpu = execFileSync('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], { windowsHide: true }).toString().trim(); } catch {}
  const clients = fs.existsSync(ROOT) ? fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'BRAND.md'))).map(d => d.name) : [];
  let recent = []; try { recent = JSON.parse(fs.readFileSync(RECENT, 'utf8')).filter(r => fs.existsSync(r.file)); } catch {}
  return { root: ROOT, apiKey: has('ANTHROPIC_API_KEY'), model: MODEL, python: fs.existsSync(PY), ffmpeg: ff, gpu, clients, recent, sfx: fs.existsSync(SFX_DIR) };
});
ipcMain.handle('pick-files', async () => (await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'mkv', 'webm', 'png', 'jpg', 'jpeg', 'webp', 'wav', 'mp3', 'm4a', 'flac'] }] })).filePaths);
ipcMain.handle('pick-folder', async (_, def) => (await dialog.showOpenDialog(win, { defaultPath: def || ROOT, properties: ['openDirectory'] })).filePaths[0] || null);
ipcMain.handle('scan', async (_, { files = [], folder = null, cache }) => {
  const list = [...files, ...(folder ? walk(folder) : [])];
  const out = [];
  for (const f of list) { const m = await probe(f); if (m) { m.thumb = await thumb(m, cache || path.join(HOME_DIR, 'cache')); m.url = pathToFileURL(m.path).href; m.thumbUrl = pathToFileURL(m.thumb).href; out.push(m); } }
  return out;
});
ipcMain.handle('project-save', async (_, p) => {
  const dir = projectDir(p); fs.mkdirSync(dir, { recursive: true });
  p.folder = dir; const file = path.join(dir, 'project.takeframe.json');
  fs.writeFileSync(file, JSON.stringify(p, null, 1));
  let recent = []; try { recent = JSON.parse(fs.readFileSync(RECENT, 'utf8')); } catch {}
  recent = [{ file, name: p.name, client: p.client, at: Date.now(), format: p.format }, ...recent.filter(r => r.file !== file)].slice(0, 20);
  fs.writeFileSync(RECENT, JSON.stringify(recent));
  return file;
});
ipcMain.handle('project-open', async (_, file) => {
  if (!file) { const r = await dialog.showOpenDialog(win || undefined, { defaultPath: ROOT, filters: [{ name: 'Takeframe', extensions: ['json'] }] }); file = r.filePaths[0]; }
  if (!file) return null; const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  // projects travel between machines: rebuild file URLs and missing thumbnails from the paths
  p.folder = path.dirname(file);
  for (const m of p.media || []) {
    if (fs.existsSync(m.path)) m.url = pathToFileURL(m.path).href; else m.missing = true;
    if (m.enhanced && fs.existsSync(m.enhanced)) m.enhancedUrl = pathToFileURL(m.enhanced).href;
    if (!m.missing && (!m.thumb || !fs.existsSync(m.thumb))) { m.thumb = await thumb(m, path.join(HOME_DIR, 'cache')); }
    if (m.thumb && fs.existsSync(m.thumb)) m.thumbUrl = pathToFileURL(m.thumb).href;
  }
  return p;
});
ipcMain.handle('reveal', (_, f) => shell.showItemInFolder(f));
ipcMain.handle('open-path', (_, f) => shell.openPath(f));
ipcMain.handle('file-url', (_, f) => pathToFileURL(f).href);
ipcMain.handle('sfx-list', () => sfxList());
function sfxList() {
  if (!fs.existsSync(SFX_DIR)) return [];
  return fs.readdirSync(SFX_DIR).filter(f => AUDIO.test(f)).map(f => ({ name: f.replace(/\.[^.]+$/, ''), path: path.join(SFX_DIR, f), url: pathToFileURL(path.join(SFX_DIR, f)).href }));
}

// ---------------- IPC: audio tools ----------------
ipcMain.handle('music', async (_, { dur, style = 'auto', bpm = 0, project = 'Takeframe', dir }) => {
  dir = dir || path.join(HOME_DIR, 'music'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `music_${Date.now()}.wav`);
  const info = await py('music.py', ['--style', style, '--dur', String(dur), '--bpm', String(bpm), '--out', out, '--log', MUSIC_LOG, '--project', project]);
  const m = await probe(out); m.thumb = await thumb(m, path.join(dir, '.cache')); m.url = pathToFileURL(out).href; m.thumbUrl = pathToFileURL(m.thumb).href; m.music = info;
  m.name = `${info.style_name} · ${info.bpm} BPM`;
  return m;
});
ipcMain.handle('music-styles', async () => py('music.py', ['--list', '--out', 'x']));
ipcMain.handle('enhance', async (_, { src, strength = .85, dir }) => {
  dir = dir || path.join(HOME_DIR, 'enhanced'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, path.basename(src).replace(/\.[^.]+$/, '') + `_enhanced_${Math.round(strength * 100)}.wav`);
  const r = await py('enhance.py', [src, out, '--strength', String(strength), '--report']);
  return Object.assign(r, { out, url: pathToFileURL(out).href });
});
ipcMain.handle('transcribe', async (_, { src, lang }) => {
  const out = path.join(HOME_DIR, 'transcripts', Buffer.from(src).toString('base64url').slice(-50) + '.json'); fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!fs.existsSync(out)) await py('transcribe.py', [src, out, ...(lang ? ['--lang', lang] : [])]);
  return JSON.parse(fs.readFileSync(out, 'utf8'));
});
ipcMain.handle('stems', async (_, { src }) => {
  const dir = path.join(HOME_DIR, 'stems', Buffer.from(src).toString('base64url').slice(-40));
  const r = await py('stems.py', [src, dir]);
  return { vocals: r.vocals, music: r.music, vocalsUrl: pathToFileURL(r.vocals).href, musicUrl: pathToFileURL(r.music).href };
});

// ---------------- render window (frame-exact) ----------------
async function getRenderWin(w, h) {
  if (renderWin && !renderWin.isDestroyed()) { renderWin.setContentSize(w, h); return renderWin; }
  renderWin = new BrowserWindow({ width: w, height: h, show: false, useContentSize: true, frame: false, enableLargerThanScreen: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, offscreen: true, webSecurity: false, backgroundThrottling: false } });
  renderWin.webContents.setFrameRate(60);
  await renderWin.loadFile(path.join(__dirname, 'src', 'render.html'));
  renderWin.setContentSize(w, h);
  return renderWin;
}
let rseq = 0; const rwait = new Map();
ipcMain.on('render-done', (_, id, err) => { const f = rwait.get(id); if (f) { rwait.delete(id); f(err); } });
function renderCall(rw, msg) { const id = ++rseq; return new Promise((res, rej) => { rwait.set(id, e => e ? rej(new Error(e)) : res()); rw.webContents.send('render', Object.assign({ id }, msg)); }); }
async function frames(p, times, width) {
  const scale = width ? width / p.w : 1; const w = Math.round(p.w * scale), h = Math.round(p.h * scale);
  const rw = await getRenderWin(w, h);
  await renderCall(rw, { cmd: 'load', project: p, scale });
  const out = [];
  for (const t of times) { await renderCall(rw, { cmd: 'frame', t }); const img = await rw.webContents.capturePage(); out.push(img.resize({ width: w, height: h })); }
  return out;
}
ipcMain.handle('frames', async (_, { project, times, width }) => (await frames(project, times, width || 360)).map(i => i.toDataURL()));

// ---------------- audio mix ----------------
function audioSrc(p, c) { const m = TF.mediaOf(p, c); if (!m) return null; return c.enhanced || m.enhanced && c.useEnhanced !== false && m.enhanced || m.path; }
async function mixAudio(p, role, out, range) {
  const t0 = range ? range[0] : 0, t1 = range ? range[1] : p.duration;
  const clips = TF.audioClips(p, role).filter(c => TF.clipEnd(c) > t0 && c.start < t1);
  const args = ['-y', '-v', 'error']; const parts = []; let i = 0;
  for (const c of clips) {
    const src = audioSrc(p, c); if (!src) continue;
    const off = Math.max(0, t0 - c.start), dur = Math.min(TF.clipEnd(c), t1) - Math.max(c.start, t0); if (dur <= 0) continue;
    args.push('-i', src);
    const ss = c.in + off * c.speed; const g = Math.pow(10, (c.volume || 0) / 20);
    let f = `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start=${ss.toFixed(4)}:duration=${(dur * c.speed).toFixed(4)},asetpts=PTS-STARTPTS`;
    if (c.speed !== 1) { let s = c.speed; while (s > 2) { f += ',atempo=2'; s /= 2; } while (s < .5) { f += ',atempo=0.5'; s *= 2; } f += `,atempo=${s.toFixed(4)}`; }
    f += `,volume=${g.toFixed(4)}`;
    if (c.pan) f += `,stereotools=balance_out=${Math.max(-1, Math.min(1, c.pan)).toFixed(2)}`;
    if (c.fadeIn && off < c.fadeIn) f += `,afade=t=in:st=0:d=${(c.fadeIn - off).toFixed(3)}`;
    if (c.fadeOut) f += `,afade=t=out:st=${Math.max(0, dur - c.fadeOut).toFixed(3)}:d=${c.fadeOut.toFixed(3)}`;
    const delay = Math.round((Math.max(c.start, t0) - t0) * 1000);
    f += `,adelay=${delay}|${delay}[a${i}]`; parts.push(f); i++;
  }
  const total = (t1 - t0).toFixed(3);
  if (!i) { await sh('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', total, out]); return out; }
  const mixIn = Array.from({ length: i }, (_, k) => `[a${k}]`).join('');
  // ducking: music ducks under speech when both exist in the full mix
  let graph = parts.join(';') + `;${mixIn}amix=inputs=${i}:normalize=0:dropout_transition=0,apad,atrim=duration=${total}`;
  graph += role === 'music' || role === 'sfx' ? '' : `,loudnorm=I=-14:TP=-1.5:LRA=11`;
  graph += '[out]';
  args.push('-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', out);
  await sh('ffmpeg', args); return out;
}

// ---------------- export ----------------
const RES = { '1080x1920': [1080, 1920], '720x1280': [720, 1280], '2160x3840': [2160, 3840], '1920x1080': [1920, 1080], '1280x720': [1280, 720], '3840x2160': [3840, 2160], '1080x1080': [1080, 1080], '1080x1350': [1080, 1350] };
ipcMain.handle('export', async (_, { project: p, opts }) => {
  const send = (m) => win && win.webContents.send('export-progress', m);
  const dir = opts.dir || finalDir(p); fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10); const base = path.join(dir, `${date}_${safe(p.name)}`);
  const range = opts.range || null; const written = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-')); const full = path.join(tmp, 'full.wav');
  const needFull = (opts.video || []).length || opts.mp3 || opts.wav;
  if (needFull) { send({ step: 'Mixing audio', pct: 0 }); await mixAudio(p, null, full, range); }
  if (opts.mp3) { const f = base + '_mix.mp3'; await sh('ffmpeg', ['-y', '-v', 'error', '-i', full, '-c:a', 'libmp3lame', '-b:a', '320k', f]); written.push(f); }
  if (opts.wav) { const f = base + '_mix.wav'; fs.copyFileSync(full, f); written.push(f); }
  for (const [role, flag, label] of [['music', 'music', 'music-only'], ['speech', 'speech', 'speech-only'], ['sfx', 'sfx', 'sfx-only']]) {
    if (!opts[flag]) continue; const w = path.join(tmp, role + '.wav'); await mixAudio(p, role, w, range);
    const f = `${base}_${label}.${opts.audioFormat === 'wav' ? 'wav' : 'mp3'}`;
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', w, ...(opts.audioFormat === 'wav' ? [] : ['-c:a', 'libmp3lame', '-b:a', '320k']), f]); written.push(f);
  }
  if (opts.transcript && opts.transcript.length) {
    const words = TF.timelineWords(p).filter(w => !range || (w.s >= range[0] && w.e <= range[1])).map(w => range ? Object.assign({}, w, { s: w.s - range[0], e: w.e - range[0] }) : w);
    for (const k of opts.transcript) {
      const f = `${base}_transcript.${k}`;
      if (k === 'txt') fs.writeFileSync(f, TF.toTXT(words)); if (k === 'srt') fs.writeFileSync(f, TF.toSRT(words)); if (k === 'vtt') fs.writeFileSync(f, TF.toVTT(words));
      written.push(f);
    }
  }
  if (opts.thumbnail) { const [img] = await frames(p, [opts.thumbTime || Math.min(1.5, p.duration / 3)], p.w); const f = base + '_thumbnail.png'; fs.writeFileSync(f, img.toPNG()); written.push(f); }
  // video: render frames once at native project size, then encode each resolution
  if ((opts.video || []).length) {
    const fps = opts.fps || p.fps; const t0 = range ? range[0] : 0, t1 = range ? range[1] : p.duration; const n = Math.round((t1 - t0) * fps);
    const master = path.join(tmp, 'master.mp4');
    const rw = await getRenderWin(p.w, p.h); await renderCall(rw, { cmd: 'load', project: p, scale: 1 });
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-i', full, '-map', '0:v', '-map', '1:a',
      '-vf', `scale=${p.w}:${p.h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-c:a', 'aac', '-b:a', '320k', '-shortest', master], { windowsHide: true });
    let ferr = ''; ff.stderr.on('data', d => ferr += d);
    const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg: ' + ferr.slice(-800))) : res()));
    const started = Date.now();
    for (let k = 0; k < n; k++) {
      await renderCall(rw, { cmd: 'frame', t: t0 + k / fps });
      const img = await rw.webContents.capturePage();
      const sz = img.getSize(); const buf = (sz.width !== p.w || sz.height !== p.h ? img.resize({ width: p.w, height: p.h }) : img).toPNG();
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (k % 5 === 0) { const el = (Date.now() - started) / 1000; send({ step: `Rendering frames ${k}/${n}`, pct: k / n, eta: Math.round(el / Math.max(1, k) * (n - k)) }); }
    }
    ff.stdin.end(); await done;
    for (const r of opts.video) {
      const [w, h] = RES[r] || [p.w, p.h]; const f = `${base}_${w}x${h}.mp4`; send({ step: `Encoding ${w}×${h}`, pct: 1 });
      const sameAspect = Math.abs(w / h - p.w / p.h) < .01;
      const vf = sameAspect ? `scale=${w}:${h}:flags=lanczos` :
        `split[a][b];[a]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=40:2,eq=brightness=-0.08[bg];[b]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
      await sh('ffmpeg', ['-y', '-v', 'error', '-i', master, '-filter_complex', vf + ',format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', w * h > 4e6 ? '18' : '17', '-profile:v', 'high', '-c:a', 'copy', '-movflags', '+faststart', f]);
      written.push(f);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  send({ step: 'Done', pct: 1, files: written });
  return { dir, files: written };
});

// ---------------- Claude agent ----------------
let aiAbort = null;
ipcMain.handle('ai-stop', () => { if (aiAbort) aiAbort.abort(); });
let toolSeq = 0; const toolWait = new Map();
ipcMain.on('ai-tool-result', (_, id, result) => { const f = toolWait.get(id); if (f) { toolWait.delete(id); f(result); } });
function askRenderer(name, input) { const id = ++toolSeq; return new Promise(res => { toolWait.set(id, res); win.webContents.send('ai-tool', id, name, input); }); }
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

const OPS_DOC = `
Ops for the "edit" tool (same commands the human uses; all times in seconds on the timeline):
- add_clip {clip:{track, type:'video'|'image'|'title'|'shape'|'audio', start, dur, media?, in?, speed?, props?:{x,y,scale,rot,opacity}, fit?:'cover'|'contain',
    anim?, text?, style?, fill?, volume?(dB), fadeIn?, fadeOut?, pan?(-1..1), fx?, transition?:{type,dur}, blend?}, mode?:'overwrite'|'insert'}
- update_clip {id, patch:{...any clip fields; props/style/anim/fx merge}}
- delete_clip {id | ids[], ripple?}
- move_clip {id, start, track?}     - trim_clip {id, edge:'start'|'end', t}     - split_clip {t, id?}
- close_gaps {track}   - set_transition {id, type, dur}   - set_keyframe {id, prop:'x'|'y'|'scale'|'rot'|'opacity', t(clip-local), v, ease}
- clear_keyframes {id, prop?}   - add_marker {t, name}   - set_project {duration?, format?, fps?, name?}   - set_track {track, state:{mute?,solo?,hidden?,lock?}}
- note {t, text}  (leave a short note for the human on the timeline)
- add_track {kind:'video'|'audio', role?:'music'|'sfx'|'speech'}  (new video tracks go on top: V4, V5…; a clip overwrites whatever it overlaps on its own track, so put layered graphics on separate tracks)
Tracks: V1 picture (bottom), V2 overlay, V3 graphics (top); A1 music, A2 sfx, A3 voice.
Title clip: text (use \\n for line breaks), style {font, size(px), weight, color, bg (box behind each line, '' none), align, case:'upper'|'', tracking(em), lh, width(0..1 of frame), stretch(%), italic, shadow, stroke},
  anim {in:'rise'|'mask'|'pop'|'blur'|'type'|'split'|'slide'|'scramble'|'fade'|'none', out:'fade'|'drop'|'blur'|'none', inDur, outDur, stagger, ease:'expoOut'|'backOut'|'cubicOut'|'sineInOut'}, props.y shifts it vertically (px, 0 = centre).
  Fonts: Archivo (variable width: stretch 62–125), Anton, Bebas Neue, Unbounded, Space Grotesk, Bricolage Grotesque, Sora, Inter, DM Sans, Fraunces, Instrument Serif, Playfair Display, Source Serif 4, Caveat, Sansita, JetBrains Mono.
Shape clip fill: '#hex' | {kind:'gradient', angle, stops:[..], spin} | {kind:'radial', stops, drift} | {kind:'grid', bg, line, size, speed} | {kind:'bar', color, x,y,w(0..1), h(px), inDur, outDur} | {kind:'circle', color, x, y, d(0..1 of width), ring(px)?}
Picture clips (video/image): anim {in:'none'|'fade'|'zoom'|'slide-up', out:'none'|'fade', kb: 0.06 (slow push-in amount)}, fx {brightness, contrast, saturate, hue, grayscale, sepia, blur, temp(-1..1)}.
Transitions (on the INCOMING clip, previous clip must end exactly where it starts on the same track): crossfade, dip, push-left, push-up, slide, zoom, wipe, iris, blur, whip.
Audio: music on A1 (from generate_music), SFX on A2 (files from list_sfx; align the SFX peak to the cut), voice on A3. volume is dB (music under speech -18..-22 dB).`;

function systemPrompt(p) {
  const rules = read(path.join(ROOT, '00-SISTEM', 'PRAVILA-SPLOSNA.md'));
  const brand = p.client ? read(path.join(ROOT, p.client, 'BRAND.md')) : '';
  const styles = read(path.join(ROOT, '00-SISTEM', 'stili', 'README.md'));
  const music = read(MUSIC_LOG);
  return `You are the AI editor inside Takeframe, a desktop video editor. You edit by calling tools; every edit you make appears on the human's timeline and can be undone.
Work like a senior motion designer + editor + sound designer: plan (short storyboard), build with the edit tool, then call look_at to check real rendered frames and fix problems (overlaps, text too small/large, cut-off letters, unreadable timing, empty frames).
Text must be readable: hold each text ~1 s per word + 1 s. Hook in the first 2 s. Every scene gets its own kind of motion. Cut on the music's bars/beats (generate_music returns bar times).
Always generate NEW music with generate_music (never reuse a previous track); pick a style not in the music log unless the human asks. Keep SFX quieter than music; riser → whoosh into transitions, click on text, hit on the logo.
Do not use photos the rules or brand file mark as outdated. Never invent client facts (prices, phone numbers) that are not in BRAND.md.
Reply to the human in the language they wrote in, briefly: what you did and what they might change.
${OPS_DOC}

=== SYSTEM RULES (PRAVILA-SPLOSNA.md) ===
${rules.slice(0, 20000)}
${brand ? '\n=== CLIENT BRAND (' + p.client + '/BRAND.md) ===\n' + brand.slice(0, 12000) : ''}
${styles ? '\n=== STYLE LIBRARY ===\n' + styles.slice(0, 5000) : ''}
=== MUSIC ALREADY USED (GLASBA-DNEVNIK.md) ===
${music.slice(0, 4000)}`;
}

const TOOLS = [
  { name: 'get_project', description: 'Current project: settings, tracks, all clips with ids, markers. Call before editing if unsure.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_media', description: 'All media in the project bin with type, duration, size, and transcript text if available.', input_schema: { type: 'object', properties: {} } },
  { name: 'view_media', description: 'See thumbnails of media files (up to 12 ids) to decide which to use.', input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } },
  { name: 'edit', description: 'Apply a list of edit ops to the timeline as one undoable step. Returns result lines or an error.', input_schema: { type: 'object', properties: { summary: { type: 'string', description: 'one short line for the history panel' }, ops: { type: 'array', items: { type: 'object' } } }, required: ['summary', 'ops'] } },
  { name: 'look_at', description: 'Render real frames of the timeline at the given times (max 8) and look at them.', input_schema: { type: 'object', properties: { times: { type: 'array', items: { type: 'number' } } }, required: ['times'] } },
  { name: 'generate_music', description: 'Generate a brand new royalty-free music track (adds it to the bin, returns media id, bpm, bar and drop times). style: auto (unused style) or one of uk-garage, drum-and-bass, funk-disco, afrobeat, piano-house, trap, chiptune, bossa-nova, phonk, jazz-hop, indie-rock.', input_schema: { type: 'object', properties: { duration: { type: 'number' }, style: { type: 'string' }, bpm: { type: 'number' } }, required: ['duration'] } },
  { name: 'list_sfx', description: 'Sound effects library (name, duration, peak offset in seconds: place clip start = cut time - peak).', input_schema: { type: 'object', properties: {} } },
  { name: 'add_files', description: 'Import files (absolute paths) into the bin, e.g. an SFX from list_sfx. Returns media ids.', input_schema: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } }, required: ['paths'] } },
  { name: 'enhance_speech', description: 'Local Adobe-Podcast-style speech enhancement for a media file (noise, room, EQ, loudness). Clips using it switch to the enhanced audio.', input_schema: { type: 'object', properties: { media_id: { type: 'string' }, strength: { type: 'number' } }, required: ['media_id'] } },
  { name: 'transcribe', description: 'Transcribe a video/audio media file locally (word timestamps). Needed for cutting on words or captions.', input_schema: { type: 'object', properties: { media_id: { type: 'string' } }, required: ['media_id'] } },
];
let sfxCache = null;
function peakOf(file) {
  return new Promise(res => {
    const pr = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '2000', '-f', 's16le', '-'], { windowsHide: true });
    const chunks = []; pr.stdout.on('data', d => chunks.push(d));
    pr.on('close', () => { const b = Buffer.concat(chunks); let mi = 0, mv = 0; for (let i = 0; i + 1 < b.length; i += 2) { const v = Math.abs(b.readInt16LE(i)); if (v > mv) { mv = v; mi = i / 2; } } res(+(mi / 2000).toFixed(3)); });
    pr.on('error', () => res(0));
  });
}
async function sfxInfo() {
  if (sfxCache) return sfxCache;
  const out = [];
  for (const s of sfxList()) { const m = await probe(s.path); out.push({ name: s.name, path: s.path, duration: +((m && m.duration) || 0).toFixed(3), peak: await peakOf(s.path) }); }
  return (sfxCache = out);
}

ipcMain.handle('ai-run', async (_, { project, prompt, scope, history = [] }) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set. Close Takeframe, run SET-API-KEY.bat, start again.');
  aiAbort = new AbortController();
  const emit = e => win.webContents.send('ai-event', e);
  let scopeText = '';
  if (scope && scope.clips && scope.clips.length) scopeText = `\n\nSCOPE: change ONLY these clips: ${scope.clips.join(', ')} (you may add new clips inside ${scope.range ? scope.range.map(x => x.toFixed(2)).join('–') + ' s' : 'their time span'}). Do not touch anything else.`;
  else if (scope && scope.range) scopeText = `\n\nSCOPE: change ONLY what lies between ${scope.range[0].toFixed(2)} s and ${scope.range[1].toFixed(2)} s.`;
  const messages = [...history, { role: 'user', content: prompt + scopeText }];
  let p = project;
  for (let turn = 0; turn < 40; turn++) {
    const body = { model: MODEL, max_tokens: 16000, system: [{ type: 'text', text: systemPrompt(p), cache_control: { type: 'ephemeral' } }], tools: TOOLS, messages };
    let res;
    try {
      res = await fetch(process.env.TAKEFRAME_API_URL || 'https://api.anthropic.com/v1/messages', { method: 'POST', signal: aiAbort.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
    } catch (e) { if (e.name === 'AbortError') { emit({ type: 'text', text: 'Stopped.' }); return { messages }; } throw e; }
    const j = await res.json();
    if (!res.ok) throw new Error((j.error && j.error.message) || res.statusText);
    messages.push({ role: 'assistant', content: j.content });
    if (j.usage) emit({ type: 'usage', usage: j.usage });
    const results = [];
    for (const b of j.content) {
      if (b.type === 'text' && b.text.trim()) emit({ type: 'text', text: b.text });
      if (b.type !== 'tool_use') continue;
      emit({ type: 'tool', name: b.name, input: b.input });
      let content;
      try { content = await runTool(b.name, b.input, scope, emit, () => p, np => { p = np; }); }
      catch (e) { content = [{ type: 'text', text: 'ERROR: ' + e.message }]; }
      results.push({ type: 'tool_result', tool_use_id: b.id, content });
    }
    if (!results.length || j.stop_reason !== 'tool_use') { emit({ type: 'done' }); return { messages: messages.slice(-30) }; }
    messages.push({ role: 'user', content: results });
  }
  emit({ type: 'done' }); return { messages: messages.slice(-30) };
});

async function runTool(name, input, scope, emit, getP, setP) {
  const txt = o => [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }];
  if (name === 'get_project') { const r = await askRenderer('get_project', {}); setP(r.project); return txt(compactProject(r.project)); }
  if (name === 'list_media') { const p = getP(); return txt(p.media.map(m => ({ id: m.id, name: m.name, type: m.type, duration: m.duration && +m.duration.toFixed(2), w: m.w, h: m.h, hasAudio: m.hasAudio, music: m.music ? { bpm: m.music.bpm, bars: m.music.bars, drops: m.music.drops, style: m.music.style_name } : undefined, transcript: m.transcript ? m.transcript.segments.map(s => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join('\n').slice(0, 4000) : undefined }))); }
  if (name === 'view_media') {
    const p = getP(); const out = [];
    for (const id of (input.ids || []).slice(0, 12)) {
      const m = p.media.find(x => x.id === id); if (!m || !m.thumb || !fs.existsSync(m.thumb)) continue;
      const ext = path.extname(m.thumb).slice(1).replace('jpg', 'jpeg');
      out.push({ type: 'text', text: `${id} · ${m.name}` }, { type: 'image', source: { type: 'base64', media_type: 'image/' + ext, data: fs.readFileSync(m.thumb).toString('base64') } });
    }
    return out.length ? out : txt('no thumbnails');
  }
  if (name === 'edit') {
    const r = await askRenderer('edit', { ops: input.ops, summary: input.summary, scope });
    if (r.project) setP(r.project);
    return txt(r.error ? 'ERROR: ' + r.error : r.lines.join('\n'));
  }
  if (name === 'look_at') {
    const p = (await askRenderer('get_project', {})).project; setP(p);
    const times = (input.times || []).slice(0, 8);
    const imgs = await frames(p, times, 432);
    emit({ type: 'frames', times, urls: imgs.map(i => i.toDataURL()) });
    const out = [];
    imgs.forEach((im, k) => { out.push({ type: 'text', text: `t=${times[k]}s` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.toJPEG(82).toString('base64') } }); });
    return out;
  }
  if (name === 'generate_music') {
    const p = getP(); emit({ type: 'status', text: 'Generating new music…' });
    const m = await ipcInvokeLocal('music', { dur: input.duration, style: input.style || 'auto', bpm: input.bpm || 0, project: p.name, dir: path.join(projectDir(p), 'music') });
    const r = await askRenderer('add_media', { media: [m] }); setP(r.project);
    const added = r.project.media.find(x => x.path === m.path);
    return txt({ media_id: added.id, style: m.music.style_name, bpm: m.music.bpm, key: m.music.key, bar: +m.music.bar.toFixed(4), bars: m.music.bars, drops: m.music.drops, breaks: m.music.breaks, duration: m.duration });
  }
  if (name === 'list_sfx') return txt(await sfxInfo());
  if (name === 'add_files') {
    const ms = []; for (const f of input.paths || []) { const m = await probe(f); if (m) { m.thumb = await thumb(m, path.join(HOME_DIR, 'cache')); m.url = pathToFileURL(f).href; m.thumbUrl = pathToFileURL(m.thumb).href; ms.push(m); } }
    const r = await askRenderer('add_media', { media: ms }); setP(r.project);
    return txt(ms.map(m => ({ path: m.path, id: (r.project.media.find(x => x.path === m.path) || {}).id, duration: m.duration })));
  }
  if (name === 'enhance_speech') {
    const p = getP(); const m = p.media.find(x => x.id === input.media_id); if (!m) throw new Error('no media');
    emit({ type: 'status', text: 'Enhancing speech…' });
    const r = await ipcInvokeLocal('enhance', { src: m.path, strength: input.strength ?? .85, dir: path.join(projectDir(p), 'enhanced') });
    const rr = await askRenderer('edit', { ops: [{ op: 'update_media', id: m.id, patch: { enhanced: r.out, enhancedUrl: r.url, enhanceReport: r } }], summary: 'Enhance speech: ' + m.name });
    setP(rr.project); return txt(r);
  }
  if (name === 'transcribe') {
    const p = getP(); const m = p.media.find(x => x.id === input.media_id); if (!m) throw new Error('no media');
    emit({ type: 'status', text: 'Transcribing ' + m.name + '…' });
    const tr = await ipcInvokeLocal('transcribe', { src: m.path });
    const rr = await askRenderer('edit', { ops: [{ op: 'update_media', id: m.id, patch: { transcript: tr } }], summary: 'Transcript: ' + m.name });
    setP(rr.project); return txt(tr.segments.map(s => `[${s.start.toFixed(2)}–${s.end.toFixed(2)}] ${s.text}`).join('\n').slice(0, 8000));
  }
  throw new Error('unknown tool ' + name);
}

function compactProject(p) {
  return {
    name: p.name, client: p.client, format: p.format, w: p.w, h: p.h, fps: p.fps, duration: p.duration,
    clips: p.clips.slice().sort((a, b) => a.track.localeCompare(b.track) || a.start - b.start).map(c => {
      const o = { id: c.id, track: c.track, type: c.type, start: +c.start.toFixed(3), dur: +c.dur.toFixed(3) };
      if (c.media) o.media = c.media; if (c.in) o.in = +c.in.toFixed(3); if (c.text) o.text = c.text;
      if (c.style) o.style = { font: c.style.font, size: c.style.size, color: c.style.color, bg: c.style.bg, weight: c.style.weight };
      if (c.anim) o.anim = c.anim.in + '/' + c.anim.out; if (c.transition) o.transition = c.transition;
      if (c.fill) o.fill = c.fill; if (c.volume) o.volume = c.volume; if (Object.keys(c.kf || {}).length) o.kf = c.kf;
      const pr = c.props; if (pr && (pr.x || pr.y || pr.scale !== 1 || pr.rot || pr.opacity !== 1)) o.props = pr;
      return o;
    }),
    markers: p.markers, notes: (p.notes || []).slice(-10),
  };
}
module.exports = { mixAudio };
