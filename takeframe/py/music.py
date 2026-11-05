"""Takeframe music generator - royalty-free music synthesized from scratch.

Every call can produce a different track: style, key, progression and seed vary.
Usage:
  python music.py --style auto --dur 20 --out track.wav [--bpm 0] [--seed 0] [--log GLASBA-DNEVNIK.md] [--project name]
Writes track.wav (48 kHz stereo) and track.json (bpm, bar times, drop/break times, style).
--style auto picks a style that is not yet listed in the log file.
"""
import argparse, json, os, re, sys, wave, datetime
import numpy as np
from scipy.signal import butter, sosfilt, lfilter, fftconvolve

SR = 48000

def n2f(n): return 440.0 * 2 ** ((n - 69) / 12)
def T(d): return np.arange(max(1, int(d * SR))) / SR
def _f(kind, f, x, order=2):
    f = np.clip(f, 20, SR / 2 - 100)
    return sosfilt(butter(order, f, kind, fs=SR, output='sos'), x)
def lpf(x, f, o=2): return _f('low', f, x, o)
def hpf(x, f, o=2): return _f('high', f, x, o)
def bpf(x, lo, hi): return _f('band', [lo, hi], x, 2)
def env(t, a=.005, d=.3, s=0.0, r=None, length=None):
    e = np.minimum(1, t / max(a, 1e-4))
    dec = s + (1 - s) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))
    e = e * dec
    if r and length:
        e *= np.clip((length - t) / r, 0, 1)
    return e

class Synth:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
    def noise(self, n): return self.rng.standard_normal(n)
    # ---------- drums ----------
    def kick(self, kind='punch'):
        if kind == '808':
            t = T(1.1); f = 45 + 90 * np.exp(-t * 40)
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
            return np.tanh(s * 2.2) * .8
        if kind == 'dnb':
            t = T(.28); f = 55 + 160 * np.exp(-t * 55)
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
            click = hpf(self.noise(len(t)), 3000) * np.exp(-t * 300) * .3
            return s + click
        if kind == 'soft':
            t = T(.35); f = 50 + 70 * np.exp(-t * 25)
            return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * .9
        t = T(.45); f = 48 + 120 * np.exp(-t * 32)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
        click = hpf(self.noise(len(t)), 2500) * np.exp(-t * 250) * .25
        return np.tanh((s + click) * 1.4)
    def snare(self, tone=190, snap=1.0):
        t = T(.32)
        n = bpf(self.noise(len(t)), 1500, 9000) * np.exp(-t * 16) * snap
        b = np.sin(2 * np.pi * tone * t) * np.exp(-t * 28)
        return n * .7 + b * .55
    def clap(self):
        t = T(.35); n = bpf(self.noise(len(t)), 900, 6000)
        e = np.zeros_like(t)
        for k, o in enumerate((0, .011, .022, .034)):
            e += np.where(t >= o, np.exp(-(t - o) * (120 if k < 3 else 14)), 0)
        return n * e * .6
    def rim(self):
        t = T(.08); return (np.sin(2 * np.pi * 820 * t) + .5 * bpf(self.noise(len(t)), 2000, 6000)) * np.exp(-t * 70) * .5
    def hat(self, open_=False):
        d = .32 if open_ else .05
        t = T(d); n = hpf(self.noise(len(t)), 7500, 4)
        return n * np.exp(-t * (9 if open_ else 80)) * .35
    def shaker(self):
        t = T(.08); return hpf(self.noise(len(t)), 5500) * np.sin(np.pi * t / .08) ** 2 * .25
    def conga(self, f=220):
        t = T(.3); ff = f * (1 + .3 * np.exp(-t * 40))
        return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 12) * .6
    def cowbell(self):
        t = T(.25); s = np.sign(np.sin(2 * np.pi * 562 * t)) + np.sign(np.sin(2 * np.pi * 845 * t))
        return bpf(s, 500, 3000) * np.exp(-t * 14) * .25
    def noise_hit(self, d=.25):
        t = T(d); return bpf(self.noise(len(t)), 300, 8000) * np.exp(-t * 20) * .5
    # ---------- tonal ----------
    def saw(self, f, d, detune=0.0, voices=1):
        t = T(d); out = np.zeros_like(t)
        for v in range(voices):
            dv = 1 + detune * (v - (voices - 1) / 2) / max(1, voices - 1) if voices > 1 else 1
            ph = (t * f * dv + self.rng.random()) % 1
            out += 2 * ph - 1
        return out / voices
    def square(self, f, d, duty=.5):
        t = T(d); ph = (t * f) % 1
        return np.where(ph < duty, 1.0, -1.0)
    def tri(self, f, d):
        t = T(d); ph = (t * f) % 1
        return 4 * np.abs(ph - .5) - 1
    def ks(self, f, d, bright=.6, decay=.996):
        N = int(d * SR); P = max(2, int(round(SR / f)))
        x = np.zeros(N); burst = lpf(self.rng.uniform(-1, 1, P), 1500 + 7000 * bright); x[:P] = burst
        a = np.zeros(P + 2); a[0] = 1; a[P] = -decay * .5; a[P + 1] = -decay * .5
        return lfilter([1], a, x)
    def piano(self, n, d=1.6, v=1):
        t = T(d); f = n2f(n); s = np.zeros_like(t)
        for h, g in ((1, 1), (2, .45), (3, .22), (4, .12), (5, .06)):
            s += g * np.sin(2 * np.pi * f * h * (1 + .0004 * h * h) * t) * np.exp(-t * (1.6 + h * .9))
        ham = hpf(self.noise(len(t)), 2000) * np.exp(-t * 200) * .05
        return (s + ham) * np.minimum(1, t / .003) * v
    def rhodes(self, n, d=1.4, v=1):
        t = T(d); f = n2f(n)
        s = np.sin(2 * np.pi * f * t + 1.3 * np.exp(-t * 5) * np.sin(2 * np.pi * f * t)) * np.exp(-t * 1.8)
        return s * np.minimum(1, t / .004) * v
    def organ(self, n, d, v=1):
        t = T(d); f = n2f(n)
        s = sum(g * np.sin(2 * np.pi * f * h * t) for h, g in ((.5, .5), (1, 1), (2, .6), (3, .3), (4, .2)))
        return s * env(t, .01, 10, 1, .05, d) * v * .4
    def pad(self, n, d, v=1, cutoff=1800):
        s = self.saw(n2f(n), d, .012, 3)
        t = T(d)
        return lpf(s, cutoff) * env(t, .35, 10, 1, .5, d) * v * .5
    def stab(self, n, d=.25, v=1, cutoff=3000):
        t = T(d); s = self.saw(n2f(n), d, .01, 2)
        return lpf(s, cutoff) * np.exp(-t * 10) * v * .5
    def pluck(self, n, d=.5, v=1):
        t = T(d); s = self.saw(n2f(n), d)
        fc = 400 + 5000 * np.exp(-t * 18)
        out = np.zeros_like(s); seg = 512
        for i in range(0, len(s), seg):
            out[i:i + seg] = lpf(s[i:i + seg], fc[i])
        return out * np.exp(-t * 6) * v * .5
    # ---------- bass ----------
    def bass(self, n, d, kind='sub', v=1):
        t = T(d); f = n2f(n)
        if kind == 'sub':
            s = np.sin(2 * np.pi * f * t) + .15 * np.sin(4 * np.pi * f * t)
            return s * env(t, .005, 10, 1, .03, d) * v * .9
        if kind == 'reese':
            s = self.saw(f, d, .02, 2); fc = 500 + 300 * np.sin(2 * np.pi * .5 * t)
            out = np.zeros_like(s); seg = 1024
            for i in range(0, len(s), seg): out[i:i + seg] = lpf(s[i:i + seg], fc[i])
            s = out
            return np.tanh(s * 1.5) * env(t, .01, 10, 1, .04, d) * v * .7
        if kind == '808':
            s = np.sin(2 * np.pi * np.cumsum(f * (1 + .5 * np.exp(-t * 30))) / SR)
            return np.tanh(s * 2) * np.exp(-t * 1.2) * env(t, .002, 10, 1, .05, d) * v * .8
        if kind == 'slap':
            s = self.saw(f, d); fc = 300 + 2500 * np.exp(-t * 25)
            out = np.zeros_like(s); seg = 256
            for i in range(0, len(s), seg): out[i:i + seg] = lpf(s[i:i + seg], fc[i])
            return out * np.exp(-t * 4) * env(t, .002, 10, 1, .02, d) * v * .9
        if kind == 'square':
            return lpf(self.square(f, d, .25), 1800) * env(t, .002, 10, 1, .02, d) * v * .35
        if kind == 'upright':
            return self.ks(f, d, .3, .993) * 1.4 * v
        s = np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) + .1 * np.sin(6 * np.pi * f * t)
        return lpf(s, 700) * np.exp(-t * 2.5) * np.minimum(1, t / .004) * v

# progressions as (degree semitone offsets of chord roots, quality)
MIN_PROGS = [[(0, 'm'), (8, 'M'), (3, 'M'), (10, 'M')], [(0, 'm'), (5, 'm'), (8, 'M'), (7, 'M')],
             [(0, 'm7'), (10, 'M'), (8, 'M7'), (7, 'm7')], [(0, 'm'), (3, 'M'), (10, 'M'), (5, 'm')],
             [(0, 'm9'), (5, 'm7'), (10, '7'), (3, 'M7')]]
MAJ_PROGS = [[(0, 'M'), (7, 'M'), (9, 'm'), (5, 'M')], [(0, 'M7'), (9, 'm7'), (2, 'm7'), (7, '7')],
             [(0, 'M'), (5, 'M'), (9, 'm'), (7, 'M')], [(5, 'M7'), (7, '7'), (4, 'm7'), (9, 'm7')],
             [(0, 'M9'), (4, 'm7'), (5, 'M7'), (7, '7')]]
Q = {'M': [0, 4, 7], 'm': [0, 3, 7], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], '7': [0, 4, 7, 10],
     'm9': [0, 3, 7, 10, 14], 'M9': [0, 4, 7, 11, 14]}

STYLES = {
    'uk-garage':   dict(name='UK garage 2-step', bpm=(130, 134), mode='min', swing=.18, kick='punch', bass='reese', chords='organ', lead='pluck'),
    'drum-and-bass': dict(name='liquid drum & bass', bpm=(172, 176), mode='min', swing=0, kick='dnb', bass='reese', chords='pad', lead='rhodes'),
    'funk-disco':  dict(name='funk / nu-disco s slap basom', bpm=(116, 122), mode='min', swing=.06, kick='punch', bass='slap', chords='stab', lead='rhodes'),
    'afrobeat':    dict(name='afrobeats', bpm=(102, 108), mode='maj', swing=.12, kick='soft', bass='sub', chords='pluck', lead='ks'),
    'piano-house': dict(name='piano house', bpm=(122, 126), mode='maj', swing=0, kick='punch', bass='sub', chords='piano', lead='piano'),
    'trap':        dict(name='melodični trap z 808', bpm=(140, 146), mode='min', swing=0, kick='808', bass='808', chords='pad', lead='pluck'),
    'chiptune':    dict(name='chiptune / 8-bit', bpm=(140, 150), mode='maj', swing=0, kick='punch', bass='square', chords='square', lead='square'),
    'bossa-nova':  dict(name='bossa nova', bpm=(128, 136), mode='maj', swing=0, kick='soft', bass='upright', chords='ks', lead='rhodes'),
    'phonk':       dict(name='phonk (cowbell + 808)', bpm=(130, 140), mode='min', swing=0, kick='808', bass='808', chords='cowbell', lead='cowbell'),
    'jazz-hop':    dict(name='jazz-hop', bpm=(86, 92), mode='min', swing=.22, kick='soft', bass='upright', chords='rhodes', lead='rhodes'),
    'indie-rock':  dict(name='indie rock (kitare + bobni)', bpm=(126, 134), mode='maj', swing=0, kick='punch', bass='bass', chords='guitar', lead='guitar'),
}

def pick_style(log_path):
    used = ''
    if log_path and os.path.exists(log_path):
        used = open(log_path, encoding='utf-8').read().lower()
        used = used.split('še neuporabljeni')[0]
    for key, st in STYLES.items():
        if key not in used and st['name'].lower() not in used:
            return key
    return list(STYLES)[np.random.default_rng().integers(len(STYLES))]

def build(style_key, dur, bpm=0, seed=0):
    st = STYLES[style_key]
    rng = np.random.default_rng(seed or None)
    seed = int(rng.integers(1, 1 << 30))
    S = Synth(seed); rng = np.random.default_rng(seed)
    bpm = bpm or int(rng.integers(st['bpm'][0], st['bpm'][1] + 1))
    bt = 60 / bpm; bar = 4 * bt
    bars = int(np.ceil(dur / bar))
    key = int(rng.integers(0, 12))
    progs = MIN_PROGS if st['mode'] == 'min' else MAJ_PROGS
    prog = progs[int(rng.integers(len(progs)))]
    base = 48 + key  # C3 + key
    N = int((bars * bar + 3) * SR)
    bus = {k: np.zeros((N, 2)) for k in ('drums', 'bass', 'music', 'send')}

    def add(name, s, t, g=1.0, pan=0.0, send=0.0):
        if t < 0: s = s[int(-t * SR):]; t = 0
        i = int(t * SR); n = min(len(s), N - i)
        if n <= 0: return
        l, r = g * (1 - pan) ** .5 * 1.0, g * (1 + pan) ** .5 * 1.0
        bus[name][i:i + n, 0] += s[:n] * l; bus[name][i:i + n, 1] += s[:n] * r
        if send:
            bus['send'][i:i + n, 0] += s[:n] * l * send; bus['send'][i:i + n, 1] += s[:n] * r * send

    sw = st['swing']
    def at(b, beat):  # bar index, beat position (float, in beats); swing on 16th offbeats
        frac = (beat * 4) % 2
        off = sw * bt / 4 if abs(frac - 1) < 1e-6 else 0
        return b * bar + beat * bt + off

    # arrangement
    brk = max(2, int(bars * .6))  # break bar
    sections = []
    for b in range(bars):
        if b < 1: sections.append('intro')
        elif b == brk and bars >= 5: sections.append('break')
        else: sections.append('full')
    kicks = []
    style = style_key

    def chord_notes(ci):
        off, q = prog[ci % len(prog)]
        root = base + off
        notes = [root + 12 + x for x in Q[q]]
        return root, notes

    for b in range(bars):
        sec = sections[b]
        root, notes = chord_notes(b)
        full = sec == 'full'
        # ---------------- drums ----------------
        if style == 'uk-garage':
            if full:
                for p in (0, 2.5): add('drums', S.kick('punch'), at(b, p), .9); kicks.append(at(b, p))
                for p in (1, 3): add('drums', S.clap(), at(b, p), .55, .05, .15)
                for p in (1.75, 3.25): add('drums', S.rim(), at(b, p), .35, .3)
            for k in range(8):
                add('drums', S.hat(k % 2 == 1 and k in (3, 7)), at(b, k / 2 + .5 if k % 2 else k / 2), .28 if k % 2 else .16, -.3)
        elif style == 'drum-and-bass':
            if full:
                for p in (0, 1.25 if b % 2 else 2.5): add('drums', S.kick('dnb'), at(b, p), .95); kicks.append(at(b, p))
                for p in (1, 3): add('drums', S.snare(210, 1.2), at(b, p), .62, 0, .2)
                add('drums', S.snare(210, .5), at(b, 3.75), .2, .2)
            for k in range(16):
                add('drums', S.hat(), at(b, k / 4), .2 if k % 2 else .12, .25)
        elif style == 'funk-disco':
            for p in range(4):
                if full or sec == 'intro': add('drums', S.kick('punch'), at(b, p), .85 if full else .4); kicks.append(at(b, p))
            if full:
                for p in (1, 3): add('drums', S.snare(200), at(b, p), .5, 0, .15)
            for k in range(8):
                add('drums', S.hat(k % 2 == 1), at(b, k / 2), .2 if k % 2 else .1, -.25)
            for k in range(16): add('drums', S.shaker(), at(b, k / 4), .18, .4)
        elif style == 'afrobeat':
            if full:
                for p in (0, 1.5, 2.5): add('drums', S.kick('soft'), at(b, p), .85); kicks.append(at(b, p))
                for p in (1.75, 3): add('drums', S.rim(), at(b, p), .45, .2)
                add('drums', S.clap(), at(b, 3), .3, 0, .2)
            for k, f in enumerate((240, 0, 320, 240, 0, 320, 240, 360)):
                if f: add('drums', S.conga(f), at(b, k / 2), .3, -.4 + .1 * k)
            for k in range(16): add('drums', S.shaker(), at(b, k / 4), .2 if k % 4 == 2 else .1, .4)
        elif style == 'piano-house':
            for p in range(4):
                if full: add('drums', S.kick('punch'), at(b, p), .9); kicks.append(at(b, p))
            if full:
                for p in (1, 3): add('drums', S.clap(), at(b, p), .5, 0, .2)
            for p in range(4): add('drums', S.hat(True), at(b, p + .5), .22 if full else .12, .3)
        elif style in ('trap', 'phonk'):
            if full:
                pts = (0, 2.75) if style == 'trap' else (0, .75, 2.5)
                for p in pts: add('drums', S.kick('808'), at(b, p), .7); kicks.append(at(b, p))
                add('drums', S.clap(), at(b, 2), .55, 0, .2)
            rolls = rng.integers(0, 4)
            for k in range(16 if style == 'trap' else 8):
                pos = k / (4 if style == 'trap' else 2)
                add('drums', S.hat(), at(b, pos), .22, .2)
                if style == 'trap' and k == 12 + rolls % 3:
                    for r in range(3): add('drums', S.hat(), at(b, pos) + r * bt / 12, .15, .2)
        elif style == 'chiptune':
            if full:
                for p in (0, 2, 2.5): add('drums', S.kick('punch'), at(b, p), .75); kicks.append(at(b, p))
                for p in (1, 3): add('drums', S.noise_hit(.15), at(b, p), .5)
            for k in range(8): add('drums', S.hat(), at(b, k / 2), .15)
        elif style == 'bossa-nova':
            for p in (0, 1.5, 2, 3.5): add('drums', S.kick('soft'), at(b, p), .45 if full else .2); kicks.append(at(b, p))
            for p in (0, .75, 1.5, 2.5, 3.25): add('drums', S.rim(), at(b, p), .3, .3)
            for k in range(8): add('drums', S.shaker(), at(b, k / 2), .18, -.4)
        elif style == 'jazz-hop':
            if full:
                for p in (0, 1.75, 2.5): add('drums', S.kick('soft'), at(b, p), .8); kicks.append(at(b, p))
                for p in (1, 3): add('drums', S.snare(180, .8), at(b, p), .45, 0, .25)
            for k in range(8): add('drums', S.hat(), at(b, k / 2), .18 if k % 2 else .1, .25)
        elif style == 'indie-rock':
            if full:
                for p in (0, 1.5, 2): add('drums', S.kick('punch'), at(b, p), .85); kicks.append(at(b, p))
                for p in (1, 3): add('drums', S.snare(185, 1.1), at(b, p), .6, 0, .3)
            for k in range(8): add('drums', S.hat(k == 7), at(b, k / 2), .2, -.2)
            if b == 0 or sec == 'full' and sections[b - 1] == 'break':
                add('drums', S.hat(True) * 2, at(b, 0), .35, .4, .4)  # crash-ish

        # ---------------- bass ----------------
        bk = st['bass']; r = root - 12 if bk in ('808', 'sub') else root
        if sec != 'break':
            if style == 'uk-garage':
                pat = [(0, 0, .75), (.75, 0, .5), (1.5, 12, .4), (2.5, 0, .75), (3.5, 7, .4)]
            elif style == 'drum-and-bass':
                pat = [(0, 0, 1.5), (2.5, 0, 1.0), (3.5, 3, .5)]
            elif style == 'funk-disco':
                pat = [(0, 0, .2), (.5, 12, .2), (.75, 0, .2), (1.5, 10, .2), (2, 0, .2), (2.5, 12, .2), (3, 7, .2), (3.5, 10, .3)]
            elif style == 'afrobeat':
                pat = [(0, 0, .6), (1.5, 0, .4), (2.5, 7, .5), (3.25, 5, .5)]
            elif style == 'piano-house':
                pat = [(p + .5, 0 if p % 2 == 0 else 12, .4) for p in range(4)]
            elif style in ('trap', 'phonk'):
                pat = [(0, 0, 1.8), (2.75, 0 if style == 'trap' else 3, 1.0)]
            elif style == 'chiptune':
                pat = [(k / 2, (0, 12, 7, 12)[k % 4], .4) for k in range(8)]
            elif style == 'bossa-nova':
                pat = [(0, 0, 1.4), (1.5, 7, .5), (2, 7, 1.4), (3.5, 0, .5)]
            elif style == 'jazz-hop':
                pat = [(0, 0, .9), (1, 3, .9), (2, 7, .9), (3, 10, .9)]
            else:
                pat = [(k / 2, 0, .45) for k in range(8)]
            if full or sec == 'intro' and style in ('bossa-nova', 'jazz-hop'):
                for p, iv, d in pat:
                    add('bass', S.bass(r + iv, d * bt, bk), at(b, p), .55)

        # ---------------- chords ----------------
        ck = st['chords']; gch = .9 if full else .7
        if ck == 'organ':
            for p, d in ((0, .4), (.75, .3), (2.25, .4), (3, .3)):
                for n in notes: add('music', S.organ(n, d * bt), at(b, p), .09 * gch, .2, .3)
        elif ck == 'pad':
            for i, n in enumerate(notes): add('music', S.pad(n, bar + .3, cutoff=2400 if full else 900), b * bar, .12, -.5 + i * .3, .5)
        elif ck == 'stab':
            for p in (.5, 1.5, 2.5, 3.25):
                for n in notes: add('music', S.stab(n, .22), at(b, p), .1 * gch, .25, .3)
        elif ck == 'pluck':
            for k, p in enumerate((0, .75, 1.5, 2.25, 3, 3.5)):
                add('music', S.pluck(notes[k % len(notes)] + 12, .4), at(b, p), .14 * gch, (-1) ** k * .4, .35)
        elif ck == 'piano':
            for p in (0, .5, 1.5, 2, 2.5, 3.5):
                for n in notes: add('music', S.piano(n, .9, .9 if p in (0, 2) else .6), at(b, p), .07 * gch, .15, .3)
        elif ck == 'square':
            for k in range(8):
                add('music', lpf(S.square(n2f(notes[k % len(notes)] + 12), bt / 2 * .9, .5), 4000) * .2, at(b, k / 2), .3 * gch, .2)
        elif ck == 'ks':
            for p, dn in ((0, 1), (1, 0), (1.5, 1), (2.5, 0), (3, 1)):
                for i, n in enumerate(notes if dn else notes[::-1]):
                    add('music', S.ks(n2f(n), 1.2, .45, .995), at(b, p) + i * .014, .1 * gch, -.3, .35)
        elif ck == 'rhodes':
            for p in (0, 2.5) if style == 'jazz-hop' else (0, 1.5, 3):
                for n in notes: add('music', S.rhodes(n, 1.6), at(b, p), .07 * gch, .2, .4)
        elif ck == 'cowbell':
            for p in (0, .75, 1.5, 2, 2.75, 3.5):
                n = notes[int(p * 4) % len(notes)] + 12
                t = T(.25); s = (np.sign(np.sin(2 * np.pi * n2f(n) * t)) + np.sign(np.sin(2 * np.pi * n2f(n) * 1.5 * t)))
                add('music', bpf(s, 400, 3500) * np.exp(-t * 12) * .25, at(b, p), .3 * gch, .1, .4)
            for i, n in enumerate(notes): add('music', S.pad(n - 12, bar, cutoff=700), b * bar, .06)
        elif ck == 'guitar':
            for k in range(8):
                for i, n in enumerate(notes[:3] + [notes[0] + 12]):
                    s = np.tanh(S.ks(n2f(n), bt / 2 * 1.1, .7, .995) * 4) * .4
                    add('music', s, at(b, k / 2) + i * .006, .12 * gch, -.45 if i % 2 else .45, .15)

        # ---------------- lead (every other bar in full sections) ----------------
        if full and b % 2 == 1:
            lk = st['lead']; scale = [0, 2, 3, 5, 7, 8, 10] if st['mode'] == 'min' else [0, 2, 4, 5, 7, 9, 11]
            motif_rng = np.random.default_rng(seed + 7)
            motif = [(p, scale[int(motif_rng.integers(0, 7))]) for p in (0, .75, 1.5, 2, 3)]
            for p, iv in motif:
                n = base + 24 + iv
                if lk == 'pluck': s = S.pluck(n, .45)
                elif lk == 'piano': s = S.piano(n, .8)
                elif lk == 'rhodes': s = S.rhodes(n, 1.0)
                elif lk == 'square': s = lpf(S.square(n2f(n), bt * .45, .25), 5000) * .25
                elif lk == 'cowbell': s = bpf(S.square(n2f(n), .2), 500, 3000) * np.exp(-T(.2) * 10) * .3
                elif lk == 'guitar': s = np.tanh(S.ks(n2f(n), .6, .8, .997) * 3) * .35
                else: s = S.ks(n2f(n), .6, .8, .996)
                add('music', s, at(b, p), .16, .15, .45)

    # risers into the break return and at the end of intro
    def riser(t_end, d):
        t = T(d); s = bpf(S.noise(len(t)), 400, 9000) * (t / d) ** 2
        add('music', s * .25, t_end - d, 1, 0, .4)
    if bars >= 5:
        riser((brk + 1) * bar, bar)
    riser(1 * bar, min(bar, 1.5))

    # sidechain: duck music + bass after each kick
    duck = np.ones(N)
    if style in ('uk-garage', 'piano-house', 'funk-disco', 'drum-and-bass', 'trap', 'phonk'):
        dl = int(.18 * SR); shape = 1 - .55 * np.exp(-np.arange(dl) / (.06 * SR))
        for kt in kicks:
            i = int(kt * SR)
            if i < N: n = min(dl, N - i); duck[i:i + n] = np.minimum(duck[i:i + n], shape[:n])
    music = bus['music'] * duck[:, None]; bassb = bus['bass'] * duck[:, None] ** .7
    # intro filter
    ib = int(bar * SR)
    music[:ib] = np.stack([lpf(music[:ib, 0], 1200), lpf(music[:ib, 1], 1200)], 1)
    # reverb send
    ir_t = T(1.6); ir = S.noise(len(ir_t)) * np.exp(-ir_t * 3.2); ir = lpf(ir, 6000); ir /= np.abs(ir).sum() ** .5 * 6
    wet = np.stack([fftconvolve(bus['send'][:, 0], ir)[:N], fftconvolve(bus['send'][:, 1], ir[::-1])[:N]], 1)
    mix = bus['drums'] * 1.0 + bassb * 1.0 + music * 1.0 + wet * .9
    mix[:, 0] = hpf(mix[:, 0], 28); mix[:, 1] = hpf(mix[:, 1], 28)
    total = int(dur * SR); mix = mix[:total]
    f = int(min(1.5, dur * .1) * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
    mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) / np.tanh(1.6) * .89
    info = dict(style=style_key, style_name=st['name'], bpm=bpm, key=['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][key] + (' mol' if st['mode'] == 'min' else ' dur'),
                seed=seed, beat=bt, bar=bar, bars=[round(i * bar, 4) for i in range(bars) if i * bar < dur],
                breaks=[round(brk * bar, 3)] if bars >= 5 else [], drops=[round(1 * bar, 3)] + ([round((brk + 1) * bar, 3)] if bars >= 5 else []),
                duration=dur)
    return mix, info

def write_wav(path, st):
    a = (np.clip(st, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--style', default='auto'); ap.add_argument('--dur', type=float, default=20)
    ap.add_argument('--bpm', type=int, default=0); ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--out', required=True); ap.add_argument('--log', default='')
    ap.add_argument('--project', default='Takeframe'); ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    if a.list:
        print(json.dumps({k: v['name'] for k, v in STYLES.items()}, ensure_ascii=False)); sys.exit()
    key = pick_style(a.log) if a.style == 'auto' else a.style
    if key not in STYLES: sys.exit(f'unknown style {key}; options: {", ".join(STYLES)}')
    mix, info = build(key, a.dur, a.bpm, a.seed)
    write_wav(a.out, mix)
    json.dump(info, open(os.path.splitext(a.out)[0] + '.json', 'w'), ensure_ascii=False, indent=1)
    if a.log and os.path.exists(a.log):
        s = open(a.log, encoding='utf-8').read()
        line = f"- {datetime.date.today()} — {a.project} — {info['style_name']} ({key}), {info['bpm']} BPM, {info['key']}, seed {info['seed']} — Takeframe music.py"
        s = re.sub(r'(Najnovejše zgoraj\.\n\n?)', lambda m: m.group(1) + line + '\n', s, count=1)
        open(a.log, 'w', encoding='utf-8').write(s)
    print(json.dumps(info, ensure_ascii=False))
