'use strict';
/* ================= math and helpers ================= */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hyp = Math.hypot;
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const v3 = (x, y, z) => ({ x, y, z });
const mix3 = (a, b, t) => v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
const off3 = (a, x, y, z) => v3(a.x + x, a.y + y, a.z + z);
const qbez3 = (a, b, c, t) => { const m = 1 - t; return v3(m * m * a.x + 2 * m * t * b.x + t * t * c.x, m * m * a.y + 2 * m * t * b.y + t * t * c.y, m * m * a.z + 2 * m * t * b.z + t * t * c.z); };
const cbez3 = (a, b, c, d, t) => { const m = 1 - t, w0 = m * m * m, w1 = 3 * m * m * t, w2 = 3 * m * t * t, w3 = t * t * t; return v3(w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y, w0 * a.z + w1 * b.z + w2 * c.z + w3 * d.z); };
function catmull3(P, t) { // t in 0..1 across the whole chain
  const n = P.length - 1, f = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
  const c = (a, b, c2, d) => 0.5 * ((2 * b) + (-a + c2) * k + (2 * a - 5 * b + 4 * c2 - d) * k * k + (-a + 3 * b - 3 * c2 + d) * k * k * k);
  return v3(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z));
}
/* camera space: x toward the patient's left (image right), y anterior (image up), z depth in mm */
const FOC = 1300;
const proj = p => { const s = FOC / p.z; return { x: 500 + p.x * s, y: 500 - p.y * s, s, z: p.z }; };
function samp(fn, n) { const o = []; for (let i = 0; i <= n; i++) { const q = proj(fn(i / n)); q.u = i / n; o.push(q); } return o; }
function at(pts, u) { const f = clamp(u, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i, a = pts[i], b = pts[i + 1]; return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s || 5, b.s || 5, k) }; }
function sub(pts, u0, u1) { const n = pts.length - 1, o = [at(pts, u0)]; for (let i = Math.ceil(u0 * n + 1e-6); i <= Math.floor(u1 * n - 1e-6); i++) o.push(pts[i]); o.push(at(pts, u1)); return o; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = clamp(t, 0, 1); return hyp(px - ax - dx * t, py - ay - dy * t); }
function polyDist(px, py, pts, i0, i1) { let d = 1e9; i0 = i0 || 0; i1 = i1 == null ? pts.length - 1 : i1; for (let i = i0; i < i1; i++) { const e = segDist(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y); if (e < d) d = e; } return d; }
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i].y > y) !== (p[j].y > y) && x < (p[j].x - p[i].x) * (y - p[i].y) / (p[j].y - p[i].y) + p[i].x) c = !c; } return c; }
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function mixHex(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
const mmss = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const $ = id => document.getElementById(id);

function noiseCanvas(n, seed) {
  const R = rng(seed), cv = document.createElement('canvas'); cv.width = cv.height = n;
  const c = cv.getContext('2d'), im = c.createImageData(n, n), d = im.data;
  const grids = [4, 8, 16, 32, 64].map(g => { const a = new Float32Array(g * g); for (let i = 0; i < a.length; i++) a[i] = R(); return { g, a }; });
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 0, amp = .5, tot = 0;
    for (const { g, a } of grids) {
      const fx = x / n * g, fy = y / n * g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const i00 = a[(y0 % g) * g + x0 % g], i10 = a[(y0 % g) * g + (x0 + 1) % g], i01 = a[((y0 + 1) % g) * g + x0 % g], i11 = a[((y0 + 1) % g) * g + (x0 + 1) % g];
      v += amp * lerp(lerp(i00, i10, sx), lerp(i01, i11, sx), sy); tot += amp; amp *= .6;
    }
    v /= tot; const k = (y * n + x) * 4, L = Math.round(clamp(128 + (v - .5) * 330, 0, 255));
    d[k] = d[k + 1] = d[k + 2] = L; d[k + 3] = 255;
  }
  c.putImageData(im, 0, 0); return cv;
}

/* ================= sound ================= */
const Snd = {
  ctx: null, on: true, nodes: {}, master: null,
  init() {
    if (this.ctx || !this.on) return;
    try { const A = window.AudioContext || window.webkitAudioContext; this.ctx = new A(); this.master = this.ctx.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx.destination); }
    catch (e) { this.ctx = null; }
  },
  set(on) { this.on = on; if (on) this.init(); if (this.master) this.master.gain.value = on ? .5 : 0; },
  noiseBuf() { if (this._nb) return this._nb; const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return this._nb = b; },
  make(name) {
    const c = this.ctx, g = c.createGain(); g.gain.value = 0; g.connect(this.master); let v = .1;
    if (name === 'seal') { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 494; o.connect(g); o.start(); v = .12; }
    else if (name === 'cut') { const o = c.createOscillator(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 660; f.type = 'lowpass'; f.frequency.value = 1400; o.connect(f); f.connect(g); o.start(); v = .06; }
    else { const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = this.noiseBuf(); s.loop = true; f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = .8; s.connect(f); f.connect(g); s.start(); v = .1; }
    return { g, v };
  },
  hold(name, active) {
    if (!this.ctx) return; let n = this.nodes[name];
    if (!n) { if (!active) return; try { n = this.nodes[name] = this.make(name); } catch (e) { return; } }
    n.g.gain.setTargetAtTime(active ? n.v : 0, this.ctx.currentTime, .025);
  },
  beep(freq, dur, vol, when, type) {
    if (!this.ctx || !this.on) return;
    try { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + (when || 0); o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || .1, t0 + .008); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + .03); } catch (e) { }
  },
  sealDone() { this.beep(660, .1, .13); this.beep(880, .16, .13, .12); },
  blade() { this.beep(190, .05, .16, 0, 'square'); this.beep(2400, .03, .05, 0, 'square'); },
  alarm() { for (let i = 0; i < 3; i++) this.beep(i === 1 ? 660 : 880, .13, .14, i * .17, 'square'); },
  ok() { this.beep(740, .09, .07); },
  tick() { this.beep(1250, .03, .06, 0, 'triangle'); },
  pulse(spo2) { this.beep(430 + (spo2 - 88) * 16, .055, .025); }
};
