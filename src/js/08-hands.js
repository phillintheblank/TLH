// ---------- hand control: cameras -> hand landmarks -> gestures -> one instrument per hand ----------
// A camera follows each hand across its picture. One camera gives two directions, right and up: the hand moves a
// pointer and the instrument's tip rides the tissue under it (auto depth). A second camera that sees the hands from
// another angle (in front, higher, looking down) gives the third: the tip then follows the hand right, up and
// forward (free depth). Nothing is read from how large a hand looks.
// The video never leaves the browser: frames go straight to an in-page model and are discarded.
const HCOL = { L: '#43c6c0', R: '#f0b24a' };
const HT_PATH = { lib: './vendor/mediapipe/vision_bundle.mjs', wasm: './vendor/mediapipe/wasm', model: './models/hand_landmarker.task' };
const CAL_KEY = 'tlh.handcal.v3', TUNE_KEY = 'tlh.handtune.v1', CAM_KEY = 'tlh.cams.v1';
const CAM_NAME = ['front camera', 'second camera'];
// Gesture thresholds used when calibration is skipped, and directions for an upright webcam facing the user (its
// picture is mirrored relative to the user).
const GEST_STD = { apClosed: 0.16, apRel: 0.62, pinchOn: 0.3, pinchOff: 0.42, opnRel: 1.4, opnFlat: 1.84, flatOn: 1.68, flatOff: 1.58 };
const MV_STD = [{ r: { a: [-1, 0], at: [0, 0], m: 0 }, u: { a: [0, -1], at: [0, 0], m: 0 } }];

class OneEuro { // low-pass that follows fast motion and steadies slow motion
  constructor() { this.x = null; this.dx = 0; this.t = 0; }
  reset() { this.x = null; this.dx = 0; }
  f(x, t, minCut, beta) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const al = c => 1 / (1 + 1 / (TAU * c * dt));
    this.dx += al(1) * ((x - this.x) / dt - this.dx);
    this.x += al(minCut + beta * Math.abs(this.dx)) * (x - this.x);
    return this.x;
  }
}
// What one camera knows of one hand: where its palm is in that picture (x, y; raw and smoothed), the last position
// already acted on (lx, ly), its grip as that camera reads it, and how clearly that camera sees the grip (q).
const newView = () => ({ tSeen: -9, ever: false, on: false, age: 0, x: 0, y: 0, rawx: 0, rawy: 0, fx: new OneEuro(), fy: new OneEuro(), lx: 0, ly: 0, v: 0, tPrev: 0, ap: 1, opn: 1.4, q: 0.5, lm: null, edge: '', edgeLast: '' });
const newSlot = k => ({ key: k, c: [newView(), newView()], G: null, src: 0, ap: 1, opn: 1.4, pinch: false, flat: false, flatT: 0, unflatT: 0, clutch: false, engaged: false, px: 0, py: 0, down: false, armed: true, relT: 0, readyT: 0 });
const newCam = i => ({ i, id: '', label: '', stream: null, video: null, landmarker: null, lastVT: -1, aspect: 4 / 3, dets: [], fpsN: 0, fps: 0 });
const HT = {
  status: 'off', // off | loading | calibrating | ready | error
  msg: '', cal: null, tune: { gain: 2.0, smooth: 0.5, pinch: 0, open: 0 }, slot: { L: newSlot('L'), R: newSlot('R') },
  cams: [newCam(0), newCam(1)], n: 1, devices: [], // n: cameras in use (1 or 2)
  clock: 0, fpsT: 0, calib: null, resume: false, sim: false, simN: 1
};
const viewFresh = w => HT.clock - w.tSeen < 0.3;
const htFresh = s => viewFresh(s.c[0]) || (HT.n > 1 && viewFresh(s.c[1]));
function htResetSlots() { for (const k of ['L', 'R']) HT.slot[k] = newSlot(k); }
function htThresh() {
  const c = HT.cal || GEST_STD, kp = 1 + 0.4 * HT.tune.pinch, o = 0.14 * HT.tune.open;
  return { on: c.pinchOn * kp, off: c.pinchOff * kp, flatOn: c.flatOn - o, flatOff: c.flatOff - o };
}

// ---------- from two pictures to one movement ----------
// Solve A x = b for a small square system (Gauss-Jordan with pivoting); null when it has no steady answer.
function solveLin(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-10) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const matT = A => A[0].map((_, j) => A.map(r => r[j])), matMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
// Least-squares inverse of J (rows: what the cameras measure; columns: directions of movement). It turns measured
// travel back into movement. With one camera and three directions it gives the smallest movement that fits, so the
// direction that camera cannot see stays still.
function pinv(J) {
  const Jt = matT(J), tall = J.length >= J[0].length, N = tall ? matMul(Jt, J) : matMul(J, Jt), cols = [];
  for (let c = 0; c < N.length; c++) { const x = solveLin(N, N.map((_, i) => (i === c ? 1 : 0))); if (!x) return null; cols.push(x); }
  const Ni = matT(cols);
  return tall ? matMul(Ni, Jt) : matMul(Jt, Ni);
}
// Calibration records, for each camera, what it saw when the hand went right, up and forward: mv[camera] = { r, u, f },
// each { a: travel in the picture [x, y], at: where in the picture that was, from its centre, m: how much larger
// the hand came to look (log scale) }. A hand coming nearer a camera looks larger and, unless it is dead centre,
// also drifts outward in the picture. That drift is not sideways travel, so it is taken out: what is left (o) is the
// part of the picture travel that sideways movement would give. From these come, per camera, J (picture travel per
// unit of hand travel in each direction) and K (how much nearer the camera each direction brings the hand).
function calBuild(mv) {
  const n = mv.length, dirs = n === 2 ? ['r', 'u', 'f'] : ['r', 'u'], len = v => Math.hypot(v[0], v[1]) || 1e-6;
  const o = mv.map(v => dirs.map(d => [v[d].a[0] - v[d].at[0] * v[d].m, v[d].a[1] - v[d].at[1] * v[d].m]));
  // How far did the hand really go each time? Take the camera that saw the most of it, with the second camera's
  // picture brought to the front camera's scale by the move both saw in full (right).
  const k = n === 2 ? len(o[0][0]) / len(o[1][0]) : 1;
  let L = dirs.map((d, j) => Math.max(len(o[0][j]), n === 2 ? k * len(o[1][j]) : 0));
  if (n === 2) {
    // Better: a camera sees a movement shortened by however much of it points along its line of sight. Asking that
    // each camera's picture be a true, evenly scaled view of three movements at right angles gives the three
    // lengths directly, whatever the camera angles. Kept only when it agrees roughly with the estimate above.
    const s0 = len(o[0][0]), A = [], b = [];
    o.forEach((v, i) => {
      const c = v.map(p => [p[0] / s0, p[1] / s0]);
      A.push([...c.map(p => p[0] * p[0]), -i], [...c.map(p => p[1] * p[1]), -i], [...c.map(p => p[0] * p[1]), 0]); b.push(1 - i, 1 - i, 0);
    });
    const At = matT(A), w = solveLin(matMul(At, A), matMul(At, b.map(v => [v])).map(r => r[0]));
    if (w && w.every(v => v > 0)) { const L2 = w.slice(0, 3).map(v => s0 / Math.sqrt(v)); if (L2.every((v, j) => v > 0.7 * L[j] && v < 1.6 * L[j])) L = L2; }
  }
  const J = o.map(v => [0, 1].map(c => v.map((p, j) => p[c] / L[j]))), K = mv.map(v => dirs.map((d, j) => v[d].m / L[j]));
  const cal = { n, mv, J, K, L, right: o.map(v => [v[0][0] / len(v[0]), v[0][1] / len(v[0])]) };
  const G = pinv(J.flat()); if (!G || J.some(Ji => !pinv(Ji))) return null;
  // depth: how much of any jitter in the pictures reaches the forward direction (1 = as steady as sideways in one camera)
  cal.depthNoise = n === 2 ? Math.hypot(...G[2]) : 0;
  return cal;
}
// The matrix that turns this frame's picture travel into hand travel, for a hand at pos[i] in each camera's picture
// (null where that camera has lost it). With one camera of two, the direction it cannot see stays still.
function calSolve(cal, pos) {
  const M = [];
  pos.forEach((p, i) => { if (!p) return; const at = [p[0] - HT.cams[i].aspect / 2, p[1] - 0.5]; for (const c of [0, 1]) M.push(cal.J[i][c].map((v, j) => v + at[c] * cal.K[i][j])); });
  return pinv(M);
}
const depthView = cal => (cal.n < 2 ? '' : cal.depthNoise < 2.6 ? 'good' : cal.depthNoise < 4.2 ? 'fair' : 'poor');

// ---------- one camera's picture of a hand ----------
const _d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const PALM = [0, 1, 5, 9, 13, 17];
// lm: 21 image landmarks (x, y in 0..1); wl: 21 metric landmarks relative to the hand itself, in the camera's frame
function handFeatures(lm, wl, aspect) {
  const x = ((lm[0].x + lm[5].x + lm[17].x) / 3) * aspect, y = (lm[0].y + lm[5].y + lm[17].y) / 3; // palm centre: steady while the fingers pinch
  const size = Math.hypot((lm[0].x - lm[9].x) * aspect, lm[0].y - lm[9].y);
  const W = wl && wl.length === 21 ? wl : lm.map(p => ({ x: p.x * aspect, y: p.y, z: (p.z || 0) * aspect }));
  const palm = _d3(W[0], W[9]) || 1e-6;
  const ap = Math.min(_d3(W[4], W[8]), _d3(W[4], W[12])) / palm; // thumb tip to the nearer of index and middle tips
  let opn = 0; for (const [m, t] of [[5, 8], [9, 12], [13, 16], [17, 20]]) opn += _d3(W[t], W[0]) / (_d3(W[m], W[0]) || 1e-6);
  // How clearly this camera sees the grip: the share of the gap between thumb and fingertips that lies across its
  // picture, where it is measured, and not along its line of sight, where it is guessed. Unknown while pinched.
  const gx = (W[8].x + W[12].x) / 2 - W[4].x, gy = (W[8].y + W[12].y) / 2 - W[4].y, gz = (W[8].z + W[12].z) / 2 - W[4].z, gl = Math.hypot(gx, gy, gz);
  const q = gl > 0.25 * palm ? Math.hypot(gx, gy) / gl : null;
  // which side of the camera's view the palm is about to leave by, named as the mirrored preview shows it
  let edge = ''; const em = 0.045;
  for (const i of PALM) { const p = lm[i]; if (p.y > 1 - em) { edge = 'bottom'; break; } if (p.y < em) edge = 'top'; else if (p.x < em) edge = 'right'; else if (p.x > 1 - em) edge = 'left'; }
  return { x, y, size, ap, opn: opn / 4, q, lm, edge };
}
// Which of the hands in camera ci's picture is the left and which the right: each stays on its own track, and a
// hand with no track is placed by which side of the other (or of the picture) it is on.
function assignSlots(feats, ci) {
  const L = HT.slot.L.c[ci], R = HT.slot.R.c[ci], rt = HT.cal.right[ci], out = [];
  const pr = p => p.x * rt[0] + p.y * rt[1]; // larger = further toward the user's right
  const rec = w => HT.clock - w.tSeen < 0.6, d = (f, w) => Math.hypot(f.x - w.rawx, f.y - w.rawy);
  if (feats.length >= 2) {
    const a = feats[0], b = feats[1];
    let aL;
    if (rec(L) && rec(R)) aL = d(a, L) + d(b, R) <= d(a, R) + d(b, L); // keep each hand on its own track, even if they cross
    else if (rec(L)) aL = d(a, L) <= d(b, L);
    else if (rec(R)) aL = d(a, R) > d(b, R);
    else aL = pr(a) < pr(b);
    out.push([aL ? 'L' : 'R', a], [aL ? 'R' : 'L', b]);
  } else if (feats.length === 1) {
    const f = feats[0];
    let k;
    if (rec(L) && rec(R)) k = d(f, L) <= d(f, R) ? 'L' : 'R';
    else if (rec(L) && d(f, L) < 0.3) k = 'L';
    else if (rec(R) && d(f, R) < 0.3) k = 'R';
    else { const mid = L.ever && R.ever ? (pr({ x: L.rawx, y: L.rawy }) + pr({ x: R.rawx, y: R.rawy })) / 2 : pr({ x: HT.cams[ci].aspect / 2, y: 0.5 }); k = pr(f) < mid ? 'L' : 'R'; }
    out.push([k, f]);
  }
  return out;
}
// One tracking result from camera ci. dets: [{lm, wl}], t: seconds on any steady clock.
function htIngest(dets, t, ci) {
  const cam = HT.cams[ci || 0];
  const feats = dets.map(d => handFeatures(d.lm, d.wl, cam.aspect)).sort((a, b) => b.size - a.size).slice(0, 2);
  cam.dets = feats; cam.fpsN++;
  if (HT.calib) { calibIngest(feats, t, cam.i); return; }
  if (!HT.cal) return;
  const mc = lerp(3.2, 0.5, HT.tune.smooth);
  for (const [k, f] of assignSlots(feats, cam.i)) {
    const w = HT.slot[k].c[cam.i], back = HT.clock - w.tSeen > 0.6;
    if (back) { w.fx.reset(); w.fy.reset(); w.ap = f.ap; w.opn = f.opn; }
    const ox = w.x, oy = w.y, fdt = clamp(t - w.tPrev, 0.005, 0.2); w.tPrev = t;
    w.rawx = f.x; w.rawy = f.y; w.ever = true; w.tSeen = HT.clock; w.lm = f.lm; w.edge = f.edge; if (f.edge) w.edgeLast = f.edge;
    w.x = w.fx.f(f.x, t, mc, 5); w.y = w.fy.f(f.y, t, mc, 5);
    if (back) { w.lx = w.x; w.ly = w.y; w.v = 0; } else w.v = lerp(w.v, Math.hypot(w.x - ox, w.y - oy) / fdt, 0.4); // a view that comes back starts from where it is: no jump
    w.ap = lerp(w.ap, f.ap, 0.6); w.opn = lerp(w.opn, f.opn, 0.5); if (f.q != null) w.q = lerp(w.q, f.q, 0.3);
  }
}
// The grip is read from whichever camera sees the gap between thumb and fingertips more clearly, and changes camera
// only for a clearly better view.
function gripRead(s) {
  const fa = viewFresh(s.c[0]), fb = HT.n > 1 && viewFresh(s.c[1]);
  if (fa && fb) { if (s.c[1 - s.src].q > s.c[s.src].q + 0.15) s.src = 1 - s.src; } else s.src = fa ? 0 : 1;
  const w = s.c[s.src], th = htThresh(); s.ap = w.ap; s.opn = w.opn;
  if (!s.pinch && s.ap < th.on) s.pinch = true; else if (s.pinch && s.ap > th.off) s.pinch = false;
  s.flat = s.flat ? s.opn > th.flatOff && s.ap > th.on : s.opn > th.flatOn && s.ap > th.off; // open, flat hand = clutch
}
// Before picking: pass each engaged hand's movement to its instrument. Mapping is relative, so taking an instrument
// never makes it jump. Each camera reports how far the palm has travelled in its picture since last frame; the
// calibration turns that into travel right, up and (with two cameras) forward.
function htPointers(dt) {
  HT.clock += dt;
  const cal = HT.cal, live = HT.status === 'ready' && S.running && !S.ended, free = freeDepth(), g = HT.tune.gain * VH;
  for (const h of HANDS) {
    const s = HT.slot[h.key], seen = [viewFresh(s.c[0]), HT.n > 1 && viewFresh(s.c[1])], fresh = seen[0] || seen[1];
    // a camera's view of the hand is used once it has held for a moment: the first frames after finding a hand are rough
    const fr = seen.map((on, i) => { const w = s.c[i]; w.age = on ? w.age + dt : 0; return on && w.age > 0.1; });
    if (fresh) gripRead(s);
    if (fresh && s.flat) { s.flatT += dt; s.unflatT = 0; } else if (fresh) { s.unflatT += dt; s.flatT = 0; }
    if (!s.clutch && s.flatT > 0.1) s.clutch = true; else if (s.clutch && s.unflatT > 0.15) s.clutch = false;
    // A hand takes its instrument only after holding a steady, curled pose for a moment. That keeps a hand that is
    // reaching for the keyboard, or passing through the camera view, from grabbing the instrument on the way.
    const v = Math.max(fr[0] ? s.c[0].v : 0, fr[1] ? s.c[1].v : 0);
    s.readyT = fresh && !s.clutch && v < 0.7 ? s.readyT + dt : 0;
    const want = live && fresh && !s.clutch && (s.engaged || s.readyT > 0.35);
    if (want && !s.engaged) {
      project(h.tip, _ps);
      s.px = clamp(_ps.x, 4, VW - 4); s.py = clamp(_ps.y, 4, VH - 4); for (const w of s.c) w.on = false; s.armed = !s.pinch; s.engaged = true;
    } else if (!want) s.engaged = false;
    if (!s.engaged) { h.ptr.on = false; continue; }
    // If one camera has lost the hand, the other still moves it in the directions it can see.
    const D = []; for (let i = 0; i < HT.n; i++) { const w = s.c[i]; if (fr[i] && !w.on) { w.lx = w.x; w.ly = w.y; } w.on = fr[i]; if (fr[i]) { D.push(w.x - w.lx, w.y - w.ly); w.lx = w.x; w.ly = w.y; } else D.push(0, 0); } // a camera that finds the hand again starts from where it is: no jump
    const G = s.G = calSolve(cal, s.c.slice(0, HT.n).map((w, i) => (fr[i] ? [w.x, w.y] : null))) || s.G, Df = D.filter((_, j) => fr[j >> 1]);
    const go = r => (G && G[r] ? G[r].reduce((sum, c, j) => sum + c * Df[j], 0) * g : 0), dr = go(0), du = go(1);
    if (free) { const c = h.cmd; c.dx += dr; c.dy -= du; c.dv += go(2); c.cart = true; }
    else { s.px = clamp(s.px + dr, 4, VW - 4); s.py = clamp(s.py - du, 4, VH - 4); h.ptr.x = s.px; h.ptr.y = s.py; h.ptr.ndc.set((s.px / VW) * 2 - 1, -((s.py / VH) * 2 - 1)); }
    h.ptr.on = true;
    if (!h.grab && !h.firing && h.sub[h.inst].jaws.length) h.openGoal = 0.05 + 0.75 * clamp((s.ap - cal.apClosed) / Math.max(0.05, cal.apRel - cal.apClosed), 0, 1); // jaws follow the fingers
  }
}
// After picking: turn pinch changes into presses and releases for each hand's own instrument.
function htActions(dt) {
  for (const h of HANDS) {
    const s = HT.slot[h.key], holding = h.inst === 'grasper' && h.grab && h.grab.pull;
    if (s.engaged) {
      if (!s.pinch) s.armed = true; // a hand that comes back already pinched must relax before it can press again
      if (s.pinch && !s.down && s.armed) { s.down = true; s.armed = false; s.relT = 0; primaryDown(h); }
      else if (s.down && !s.pinch) {
        if (holding) { if (!s.flat) s.relT += dt; if (s.relT > 0.4) { s.down = false; primaryUp(h); } } // a brief pause, so opening the hand to clutch keeps the grasp
        else { s.down = false; primaryUp(h); }
      } else if (s.pinch) s.relT = 0;
    } else if (s.down && !holding) { s.down = false; primaryUp(h); } // on hold: energy stops at once; tissue in a grasper stays held
  }
}
function htRelease() { for (const h of HANDS) { const s = HT.slot[h.key]; if (s.down) { s.down = false; } if (h.firing) primaryUp(h); h.ptr.on = false; s.engaged = false; } }

// ---------- calibration ----------
// Directions: the user moves the right hand right, up and (with two cameras) forward, and every camera notes what it
// saw, so any camera placement works. Gestures: the user's own pinch, working grip and flat hand set the thresholds.
const CAL_STEPS = [
  { id: 'hands', pose: 'grip', title: 'Show both hands in your working grip', text: 'Hold each hand as if loosely holding a small ball: thumb opposite the first two fingers with a clear gap between them, ring and little fingers curled into the palm. Hold them still where you plan to work, where every camera can see both.' },
  { id: 'right', pose: 'grip', title: 'Move your right hand to the right', text: 'Slide your right hand about a hand-width to your right, then hold it still. Keep the left hand where it is.' },
  { id: 'up', pose: 'grip', title: 'Now lift that hand', text: 'Raise the same hand about a hand-width, straight up, then hold it still.' },
  { id: 'fwd', pose: 'grip', title: 'Now push it forward', text: 'Push the same hand straight away from you, about a hand-length, then hold it still. This is the direction that drives an instrument in.' },
  { id: 'pinch', pose: 'pinch', title: 'Pinch', text: 'With the right hand, bring your thumb onto your first two fingertips and hold.' },
  { id: 'grip', pose: 'grip', title: 'Relax into your working grip', text: 'Open the thumb away from the fingertips again, as if loosely holding a small ball, with the ring and little fingers still curled. Hold still.' },
  { id: 'flat', pose: 'flat', title: 'Open the hand flat', text: 'Straighten all the fingers and spread the hand. This is the clutch: it freezes that instrument until you curl the hand again.' }
];
const calSteps = () => CAL_STEPS.filter(s => s.id !== 'fwd' || HT.n === 2);
function calibStart() {
  htRelease();
  // per camera: its two hand tracks, which of them is the right hand, where it was at each stage, and the travel it saw
  const view = () => ({ tr: [null, null], seen: -9, two: false, lastT: 0, right: -1, p0: null, p1: null, p2: null, mv: {} });
  HT.calib = { i: 0, hold: 0, cam: [view(), view()], apC: 0, apR: 0, opR: 0, opF: 0, acc: [0, 0, 0], prog: 0, lastT: 0, note: '', stepT: 0, apMax: 0, src: 0 };
  HT.status = 'calibrating'; uiDirty();
}
// Follow the two hands in one camera's picture.
function calibTrack(V, feats, t) {
  const dt = clamp(t - (V.lastT || t), 0.005, 0.12); V.lastT = t;
  const upd = (tr, f) => {
    if (!tr) return { x: f.x, y: f.y, z: Math.log(f.size), v: 1, ap: f.ap, opn: f.opn, gv: 2, q: f.q == null ? 0.5 : f.q };
    // speeds are taken from the smoothed values so tracker jitter does not read as movement
    const x = lerp(tr.x, f.x, 0.5), y = lerp(tr.y, f.y, 0.5), ap = lerp(tr.ap, f.ap, 0.5), opn = lerp(tr.opn, f.opn, 0.5);
    return { x, y, ap, opn, z: lerp(tr.z, Math.log(f.size), 0.25), q: f.q == null ? tr.q : lerp(tr.q, f.q, 0.3), v: lerp(tr.v, Math.hypot(x - tr.x, y - tr.y) / dt, 0.4), gv: lerp(tr.gv, (Math.abs(ap - tr.ap) + Math.abs(opn - tr.opn)) / dt, 0.4) };
  };
  const dist = (f, tr) => Math.hypot(f.x - tr.x, f.y - tr.y), T = V.tr;
  V.two = feats.length >= 2; V.rightSeen = false;
  if (feats.length >= 2) {
    const a = feats[0], b = feats[1], straight = !T[0] || !T[1] || dist(a, T[0]) + dist(b, T[1]) <= dist(a, T[1]) + dist(b, T[0]);
    T[0] = upd(T[0], straight ? a : b); T[1] = upd(T[1], straight ? b : a); V.seen = HT.clock; V.rightSeen = true;
  } else if (feats.length === 1 && T[0] && T[1]) {
    const k = dist(feats[0], T[0]) <= dist(feats[0], T[1]) ? 0 : 1; T[k] = upd(T[k], feats[0]);
    if (V.right >= 0 && k === V.right) { V.seen = HT.clock; V.rightSeen = true; }
  }
}
function calibIngest(feats, t, ci) {
  const C = HT.calib; calibTrack(C.cam[ci], feats, t);
  if (ci !== 0) return; // the steps run on the front camera's clock and read every camera's tracks
  const dt = clamp(t - (C.lastT || t), 0.005, 0.12); C.lastT = t; C.stepT += dt;
  const steps = calSteps(), step = steps[C.i].id, views = C.cam.slice(0, HT.n), A = views[0];
  const hold0 = () => { C.hold = 0; C.prog = 0; };
  // every camera has to see both hands to begin with, and the right hand after that
  for (let i = 0; i < views.length; i++) {
    const V = views[i], ok = step === 'hands' || V.right < 0 ? V.two && HT.clock - V.seen < 0.4 : HT.clock - V.seen < 0.4;
    if (!ok) { hold0(); C.note = 'The ' + (HT.n > 1 ? CAM_NAME[i] : 'camera') + (V.tr[0] && V.tr[1] && V.right >= 0 ? ' has lost your right hand. Keep it in view.' : ' can\'t see both hands. Bring them into its view' + (i ? ', or move that camera.' : '.')); return; }
  }
  C.note = '';
  const P = tr => [tr.x, tr.y, tr.z], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]);
  // one move as a camera saw it: travel in its picture, where that was from the picture's centre, and how much larger the hand came to look
  const seen = (i, from, to) => ({ a: sub(to, from), at: [(from[0] + to[0]) / 2 - HT.cams[i].aspect / 2, (from[1] + to[1]) / 2 - 0.5], m: to[2] - from[2] });
  const advance = () => { C.i++; C.hold = 0; C.prog = 0; C.stepT = 0; C.acc = [0, 0, 0]; sfx.ok(); uiDirty(); };
  // a noisy frame drains the hold a little and does not restart it
  const holdFor = (ok, need) => { C.hold = ok ? C.hold + dt : Math.max(0, C.hold - 2 * dt); if (C.hold === 0) C.acc = [0, 0, 0]; return C.hold >= need; };
  if (step === 'hands') {
    const f = HT.cams.slice(0, HT.n).flatMap(c => c.dets);
    if (f.some(d => d.edge)) C.note = 'A hand is at the edge of a camera\'s view. Bring your hands toward the middle, or move that camera.';
    else if (f.some(d => d.opn > 1.75)) C.note = 'Curl the ring and little fingers into the palm.';
    C.prog = clamp(C.hold / 0.8, 0, 1);
    if (holdFor(views.every(V => V.tr[0].v < 0.2 && V.tr[1].v < 0.2), 0.8)) { for (const V of views) V.p0 = [P(V.tr[0]), P(V.tr[1])]; advance(); }
    return;
  }
  if (step === 'right') { // in each picture, the hand that moved is the right hand
    const mv = views.map(V => { const m = [0, 1].map(k => len(sub(P(V.tr[k]), V.p0[k]))), k = m[0] >= m[1] ? 0 : 1; return { k, m: m[k], o: m[1 - k] }; });
    const far = mv[0].m > 0.12 && mv[0].o < 0.6 * mv[0].m, both = mv.every(x => x.m > 0.03 && x.o < 0.7 * x.m);
    if (far && !both) C.note = 'The second camera did not see that move clearly. Check that it can see both hands.';
    C.prog = far && both ? 0.5 + 0.5 * clamp(C.hold / 0.5, 0, 1) : 0.5 * clamp(mv[0].m / 0.12, 0, 1);
    if (holdFor(far && both && views.every((V, i) => V.tr[mv[i].k].v < 0.2), 0.5)) { views.forEach((V, i) => { V.right = mv[i].k; V.p1 = P(V.tr[V.right]); V.mv.r = seen(i, V.p0[V.right], V.p1); }); advance(); }
    return;
  }
  if (step === 'up' || step === 'fwd') {
    // Each camera's picture is brought to a common scale by the move to the right as that camera saw it; travel is
    // then the most that any camera saw, in the front camera's picture-heights.
    // A new direction has to look clearly different, across the cameras together, from the ones already shown.
    const d = views.map(V => sub(P(V.tr[V.right]), step === 'up' ? V.p1 : V.p2));
    const stack = k => views.flatMap(V => { const s = len(V.mv.r.a) || 1e-6, v = k === 'new' ? d[views.indexOf(V)] : V.mv[k].a; return [v[0] / s, v[1] / s]; });
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), e = stack('new'), m = len(A.mv.r.a) * Math.max(...views.map((V, i) => len(d[i]) / (len(V.mv.r.a) || 1e-6)));
    let o = e.slice(); const basis = [];
    for (const k of step === 'up' ? ['r'] : ['r', 'u']) { let b = stack(k); for (const q of basis) { const c = dot(b, q); b = b.map((v, i) => v - c * q[i]); } const bl = Math.hypot(...b) || 1; b = b.map(v => v / bl); basis.push(b); const c = dot(o, b); o = o.map((v, i) => v - c * b[i]); }
    const indep = Math.hypot(...o) / (Math.hypot(...e) || 1), far = m > 0.085, ok = far && indep > (step === 'up' ? 0.5 : 0.3);
    if (far && !ok) C.note = step === 'up' ? 'That looks like the same direction as before. Lift the hand straight up.' : 'The cameras cannot tell that from the directions already shown. Push the hand straight away from you. If this keeps happening, raise the second camera or tilt it further down.';
    C.prog = ok ? 0.5 + 0.5 * clamp(C.hold / 0.5, 0, 1) : 0.5 * clamp(m / 0.085, 0, 1);
    if (holdFor(ok && views.every(V => V.tr[V.right].v < 0.2), 0.5)) { views.forEach((V, i) => { const to = P(V.tr[V.right]); if (step === 'up') { V.mv.u = seen(i, V.p1, to); V.p2 = to; } else V.mv.f = seen(i, V.p2, to); }); advance(); }
    return;
  }
  // the grip, read as it will be read later: from the camera with the clearer view of it
  if (views.length > 1 && views[1 - C.src].tr[views[1 - C.src].right].q > views[C.src].tr[views[C.src].right].q + 0.15) C.src = 1 - C.src;
  const R = views[C.src].tr[views[C.src].right], moving = Math.max(...views.map(V => V.tr[V.right].v));
  C.apMax = Math.max(C.apMax, R.ap);
  const calm = R.gv < 1.2 && moving < 0.3, mean = (v, n) => { C.acc[0] += v * dt; C.acc[1] += (n || 0) * dt; C.acc[2] += dt; };
  if (step === 'pinch') {
    const ok = R.ap < Math.min(0.45, 0.6 * Math.max(C.apMax, 0.5)) && calm;
    if (ok) mean(R.ap);
    C.prog = clamp(C.hold / 0.5, 0, 1);
    if (holdFor(ok, 0.5)) { C.apC = C.acc[0] / C.acc[2]; advance(); }
    return;
  }
  if (step === 'grip') {
    const ok = R.ap > C.apC + 0.15 && calm;
    if (ok) mean(R.ap, R.opn);
    C.prog = clamp(C.hold / 0.7, 0, 1);
    if (holdFor(ok, 0.7)) { C.apR = C.acc[0] / C.acc[2]; C.opR = C.acc[1] / C.acc[2]; advance(); }
    return;
  }
  if (step === 'flat') {
    const ok = R.opn > C.opR + 0.12 && R.ap > C.apC + 0.15 && calm;
    if (ok) mean(R.opn);
    if (!ok && C.stepT > 6) C.note = 'If your working grip was already flat, press "Start over" and curl the fingers more for the grip step.';
    C.prog = clamp(C.hold / 0.6, 0, 1);
    if (holdFor(ok, 0.6)) { C.opF = C.acc[0] / C.acc[2]; calibFinish(); }
  }
}
function calibFinish(std) { // std: skip, for one upright webcam
  const C = HT.calib;
  if (std && HT.n > 1) { camClose(HT.cams[1]); HT.n = 1; }
  let cal = null;
  if (!std && C && C.cam.slice(0, HT.n).every(V => V.mv.r && V.mv.u && (HT.n < 2 || V.mv.f))) {
    const span = Math.max(0.12, C.apR - C.apC), os = Math.max(0.12, C.opF - C.opR);
    cal = calBuild(C.cam.slice(0, HT.n).map(V => V.mv));
    if (cal) Object.assign(cal, { apClosed: C.apC, apRel: C.apC + span, pinchOn: C.apC + 0.35 * span, pinchOff: C.apC + 0.6 * span, opnRel: C.opR, opnFlat: C.opR + os, flatOn: C.opR + 0.6 * os, flatOff: C.opR + 0.42 * os, std: false });
  }
  if (!cal) { if (HT.n > 1 && !std) { calibStart(); HT.calib.note = 'Those three movements could not be told apart. Please show them again.'; return; } cal = Object.assign(calBuild(MV_STD), GEST_STD, { std: true }); }
  cal.ids = HT.cams.slice(0, cal.n).map(c => c.id);
  htUseCal(cal, true);
}
function htUseCal(cal, save) {
  HT.cal = cal; HT.calib = null; HT.status = 'ready';
  if (save) try { const o = Object.assign({}, cal); delete o.J; delete o.K; delete o.L; delete o.right; localStorage.setItem(CAL_KEY, JSON.stringify(o)); } catch (e) {}
  htResetSlots();
  $('calModal').hidden = true;
  if (HT.resume && !S.ended) S.running = true;
  HT.resume = false;
  const dv = depthView(cal);
  toast('Hand control is on' + (cal.n === 2 ? ' with two cameras: push a hand forward to drive its instrument in.' : ' with one camera: each tip follows the tissue under it.') + ' Curl your hands into the working grip to take the instruments. An open, flat hand puts that instrument on hold.', 'ok');
  if (dv === 'poor' || dv === 'fair') toast('The second camera sees ' + (dv === 'poor' ? 'very little' : 'only part') + ' of your forward movement, so depth will be ' + (dv === 'poor' ? 'jumpy' : 'less steady than it could be') + '. Raise it or tilt it further down, then recalibrate.', 'warn');
  sfx.ok(); uiDirty(true);
}
// A saved calibration is offered only for the same cameras in the same roles.
function htSavedCal() {
  try {
    const c = JSON.parse(localStorage.getItem(CAL_KEY) || 'null');
    if (!c || !c.mv || c.n !== HT.n || typeof c.pinchOn !== 'number' || !c.ids || c.ids.some((id, i) => id !== HT.cams[i].id)) return null;
    const b = calBuild(c.mv); return b ? Object.assign(c, b) : null;
  } catch (e) { return null; }
}

// ---------- cameras + model ----------
function htSetMode(on) { htRelease(); CTRL.mode = on ? 'hands' : 'mouse'; uiDirty(true); }
function htOpenCalib() {
  if (S.running) { HT.resume = true; S.running = false; }
  $('calModal').hidden = false; $('calSaved').hidden = !htSavedCal();
  calibStart();
}
const camPrefs = () => { try { return JSON.parse(localStorage.getItem(CAM_KEY) || 'null') || {}; } catch (e) { return {}; } };
async function camOpen(cam, id) {
  const base = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } };
  cam.stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign(base, id ? { deviceId: { exact: id } } : { facingMode: 'user' }), audio: false });
  const v = cam.video = $(cam.i ? 'camVideo2' : 'camVideo'), tr = cam.stream.getVideoTracks()[0]; v.srcObject = cam.stream; await v.play();
  cam.aspect = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 4 / 3; cam.id = (tr.getSettings && tr.getSettings().deviceId) || id || ''; cam.label = tr.label || '';
}
function camClose(cam) {
  if (cam.stream) { for (const t of cam.stream.getTracks()) t.stop(); cam.stream = null; }
  if (cam.video) { try { cam.video.pause(); cam.video.srcObject = null; } catch (e) {} }
  cam.dets = []; cam.lastVT = -1;
}
function htStopCamera() { for (const c of HT.cams) camClose(c); }
async function htEnable() {
  if (HT.status === 'loading' || HT.status === 'calibrating' || HT.status === 'ready') return;
  HT.status = 'loading'; HT.msg = 'Starting the camera'; uiDirty(true);
  htSetMode(true);
  if (S.running) { HT.resume = true; S.running = false; }
  $('calModal').hidden = false; $('calSaved').hidden = true;
  try {
    if (HT.sim) HT.n = HT.simN;
    else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('This browser has no camera access on this page. Open the simulator over https.'), { name: 'NoMedia' });
      const pref = camPrefs(), A = HT.cams[0], B = HT.cams[1];
      try { await camOpen(A, pref.a || ''); } catch (e) { if (!pref.a) throw e; await camOpen(A, ''); } // the remembered camera is gone: take the default
      // the list of cameras is only readable once one of them has been allowed
      HT.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || 'Camera ' + (i + 1) }));
      HT.n = 1;
      if (pref.b && pref.b !== A.id && HT.devices.some(d => d.id === pref.b)) {
        HT.msg = 'Starting the second camera'; uiDirty();
        try { await camOpen(B, pref.b); HT.n = 2; } catch (e) { camClose(B); toast('The second camera could not be opened' + (e && e.name === 'NotReadableError' ? ': another app is using it. Close it there and choose the camera again.' : '. Hand control is using one camera.'), 'warn'); }
      }
      camFillPickers();
      if (HT.status !== 'loading') { htStopCamera(); return; } // turned off while the permission prompt was open
      HT.msg = 'Loading the hand-tracking model'; uiDirty();
      const mp = await import(HT_PATH.lib), fileset = await mp.FilesetResolver.forVisionTasks(HT_PATH.wasm);
      const opts = delegate => ({ baseOptions: { modelAssetPath: HT_PATH.model, delegate }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      for (const cam of HT.cams.slice(0, HT.n)) if (!cam.landmarker) { // each camera has its own tracker: a tracker follows one video
        try { cam.landmarker = await mp.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
        catch (e) { cam.landmarker = await mp.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
      }
      if (HT.status !== 'loading') { htStopCamera(); return; } // turned off while loading
      htLoop();
    }
    $('calSaved').hidden = !htSavedCal();
    calibStart();
  } catch (e) {
    htStopCamera();
    HT.status = 'error';
    HT.msg = e && e.name === 'NotAllowedError' ? 'Camera permission was refused. Allow the camera for this page in the browser\'s address bar, then try again.'
      : e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'No camera was found on this device.'
      : e && e.name === 'NotReadableError' ? 'The camera is in use by another app. Close it there and try again.'
      : 'Hand tracking could not start: ' + ((e && e.message) || 'unknown error');
    uiDirty(true);
  }
}
function htDisable() {
  htStopCamera(); HT.calib = null; HT.status = 'off'; HT.msg = '';
  $('calModal').hidden = true; htSetMode(false);
  if (HT.resume && !S.ended) S.running = true;
  HT.resume = false; uiDirty(true);
}
let htLoopId = 0;
function htLoop() {
  const id = ++htLoopId;
  const step = () => {
    if (id !== htLoopId || !HT.cams[0].stream) return;
    for (const cam of HT.cams.slice(0, HT.n)) {
      const v = cam.video;
      if (!cam.stream || v.readyState < 2 || v.currentTime === cam.lastVT || document.hidden) continue;
      cam.lastVT = v.currentTime;
      let res = null;
      try { res = cam.landmarker.detectForVideo(v, performance.now()); } catch (e) { res = null; }
      if (res && res.landmarks) htIngest(res.landmarks.map((lm, i) => ({ lm, wl: res.worldLandmarks && res.worldLandmarks[i] })), performance.now() / 1000, cam.i);
    }
    requestAnimationFrame(step);
  };
  step();
}
// The two camera choosers in the setup screen. Changing either restarts hand control with that choice.
function camFillPickers() {
  const A = $('camSelA'), B = $('camSelB'), opt = (v, t, sel) => { const o = document.createElement('option'); o.value = v; o.textContent = t; o.selected = sel; return o; };
  A.textContent = ''; B.textContent = '';
  for (const d of HT.devices) A.appendChild(opt(d.id, d.label, d.id === HT.cams[0].id));
  B.appendChild(opt('', 'None: one camera, automatic depth', HT.n < 2));
  for (const d of HT.devices) if (d.id !== HT.cams[0].id) B.appendChild(opt(d.id, d.label, HT.n === 2 && d.id === HT.cams[1].id));
  $('camHint').textContent = HT.n === 2 ? 'Put the second camera in front of you, higher than your hands and tilted down at them, and switch off any auto-framing in its own app.'
    : HT.devices.length > 1 ? 'With one camera the tip follows the tissue under it. Choose a second camera for hand control of depth.' : 'With one camera the tip follows the tissue under it. Plug in a second camera for hand control of depth.';
}
function camChoose() {
  const a = $('camSelA').value, b = $('camSelB').value;
  try { localStorage.setItem(CAM_KEY, JSON.stringify({ a, b: b === a ? '' : b })); } catch (e) {}
  const resume = HT.resume; htStopCamera(); HT.calib = null; HT.cal = null; HT.status = 'off'; htEnable().then(() => { HT.resume = HT.resume || resume; });
}

// ---------- panel, previews, calibration screen ----------
const HAND_BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function drawPreview(cv, cam) {
  const r = cv.getBoundingClientRect(); if (r.width < 4) return;
  const pr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(r.width * pr), H = Math.round(r.height * pr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#05080a'; c.fillRect(0, 0, W, H);
  // shown mirrored, like a mirror: your right hand appears on the right
  if (cam.video && cam.video.readyState >= 2) { c.save(); c.translate(W, 0); c.scale(-1, 1); c.globalAlpha = 0.85; c.drawImage(cam.video, 0, 0, W, H); c.restore(); }
  const col = f => {
    if (HT.calib) { const V = HT.calib.cam[cam.i], T = V.tr, k = T[0] && T[1] ? (Math.hypot(f.x - T[0].x, f.y - T[0].y) <= Math.hypot(f.x - T[1].x, f.y - T[1].y) ? 0 : 1) : -1; return V.right >= 0 ? (k === V.right ? HCOL.R : HCOL.L) : '#dfe8ec'; }
    for (const k of ['L', 'R']) if (HT.slot[k].c[cam.i].lm === f.lm) return HCOL[k]; return '#dfe8ec';
  };
  for (const f of cam.dets) {
    const X = p => (1 - p.x) * W, Y = p => p.y * H; c.strokeStyle = c.fillStyle = col(f); c.lineWidth = 1.5 * pr;
    c.beginPath(); for (const [a, b] of HAND_BONES) { c.moveTo(X(f.lm[a]), Y(f.lm[a])); c.lineTo(X(f.lm[b]), Y(f.lm[b])); } c.stroke();
    // the grip as the tracker reads it: thumb tip, first two fingertips, and the gap between them
    const near = Math.hypot(f.lm[4].x - f.lm[8].x, f.lm[4].y - f.lm[8].y) <= Math.hypot(f.lm[4].x - f.lm[12].x, f.lm[4].y - f.lm[12].y) ? 8 : 12;
    c.strokeStyle = c.fillStyle = '#ffffff'; c.lineWidth = 1.2 * pr; c.beginPath(); c.moveTo(X(f.lm[4]), Y(f.lm[4])); c.lineTo(X(f.lm[near]), Y(f.lm[near])); c.stroke();
    for (const i of [4, 8, 12]) { c.beginPath(); c.arc(X(f.lm[i]), Y(f.lm[i]), 3.2 * pr, 0, TAU); c.fill(); }
    if (f.edge) { // a bar along the side of the view this hand is about to leave by
      c.fillStyle = '#f0b24a'; const t = 4 * pr;
      if (f.edge === 'bottom') c.fillRect(0, H - t, W, t); else if (f.edge === 'top') c.fillRect(0, 0, W, t); else if (f.edge === 'left') c.fillRect(0, 0, t, H); else c.fillRect(W - t, 0, t, H);
    }
  }
  if (HT.n > 1) { c.fillStyle = 'rgba(5,8,10,0.7)'; c.fillRect(0, 0, 112 * pr, 18 * pr); c.fillStyle = '#dfe8ec'; c.font = '500 ' + 10.5 * pr + 'px "IBM Plex Sans", system-ui, sans-serif'; c.fillText(cam.i ? 'Second camera' : 'Front camera', 6 * pr, 12.5 * pr); }
}
// A small drawing of the pose a calibration step asks for: a right hand, palm toward the camera.
const POSE = (() => {
  const base = { 0: [0.5, 0.95], 5: [0.4, 0.58], 9: [0.5, 0.55], 13: [0.59, 0.58], 17: [0.67, 0.64] };
  const open = Object.assign({ 1: [0.38, 0.86], 2: [0.28, 0.74], 3: [0.21, 0.62], 4: [0.16, 0.5], 6: [0.37, 0.42], 7: [0.36, 0.31], 8: [0.35, 0.21], 10: [0.5, 0.38], 11: [0.5, 0.26], 12: [0.5, 0.15],
    14: [0.61, 0.43], 15: [0.62, 0.32], 16: [0.63, 0.23], 18: [0.71, 0.52], 19: [0.73, 0.44], 20: [0.75, 0.37] }, base);
  const curled = { 14: [0.62, 0.48], 15: [0.6, 0.56], 16: [0.57, 0.63], 18: [0.7, 0.56], 19: [0.67, 0.62], 20: [0.64, 0.68] };
  const grip = Object.assign({ 1: [0.38, 0.85], 2: [0.28, 0.75], 3: [0.24, 0.62], 4: [0.27, 0.5], 6: [0.38, 0.44], 7: [0.4, 0.35], 8: [0.43, 0.29], 10: [0.5, 0.4], 11: [0.51, 0.31], 12: [0.53, 0.26] }, curled, base);
  const pinch = Object.assign({ 1: [0.38, 0.85], 2: [0.3, 0.73], 3: [0.33, 0.58], 4: [0.42, 0.4], 6: [0.39, 0.45], 7: [0.42, 0.38], 8: [0.45, 0.35], 10: [0.5, 0.42], 11: [0.5, 0.36], 12: [0.49, 0.335] }, curled, base);
  return { grip, pinch, flat: open };
})();
function drawPose(cv, name) {
  const r = cv.getBoundingClientRect(); if (r.width < 4) return;
  const pr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(r.width * pr), H = Math.round(r.height * pr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const P = POSE[name] || POSE.grip, S0 = Math.min(W, H) * 1.12, ox = (W - S0) / 2 + S0 * 0.04, oy = (H - S0) / 2 - S0 * 0.06, X = i => ox + P[i][0] * S0, Y = i => oy + P[i][1] * S0;
  c.lineCap = c.lineJoin = 'round';
  c.fillStyle = 'rgba(240,178,74,0.22)'; c.beginPath(); [0, 1, 5, 9, 13, 17].forEach((i, k) => (k ? c.lineTo(X(i), Y(i)) : c.moveTo(X(i), Y(i)))); c.closePath(); c.fill();
  const work = name === 'flat' ? [] : [[1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12]];
  for (const [a, b] of HAND_BONES) {
    const hot = work.some(w => w[0] === a && w[1] === b);
    c.strokeStyle = hot || name === 'flat' ? '#f0b24a' : 'rgba(240,178,74,0.5)'; c.lineWidth = (hot || name === 'flat' ? 6 : 5) * pr;
    c.beginPath(); c.moveTo(X(a), Y(a)); c.lineTo(X(b), Y(b)); c.stroke();
  }
  if (name !== 'flat') {
    c.fillStyle = '#ffffff'; for (const i of [4, 8, 12]) { c.beginPath(); c.arc(X(i), Y(i), 3.6 * pr, 0, TAU); c.fill(); }
    if (name === 'grip') { c.setLineDash([3 * pr, 3 * pr]); c.strokeStyle = '#ffffff'; c.lineWidth = 1.4 * pr; c.beginPath(); c.moveTo(X(4), Y(4)); c.lineTo(X(8), Y(8)); c.stroke(); c.setLineDash([]); }
  }
}
// What a camera is losing, for the line shown over the picture: a hand at the edge of a view, or gone from one.
function htWarning(k) {
  const s = HT.slot[k], nm = k === 'L' ? 'Left' : 'Right';
  for (let i = 0; i < HT.n; i++) {
    const w = s.c[i], of = HT.n > 1 ? 'the ' + CAM_NAME[i] + '\'s view' : 'the camera\'s view';
    if (!viewFresh(w) && w.ever) return nm + ' hand has left ' + of + (w.edgeLast ? ' at the ' + w.edgeLast : '') + (HT.n > 1 && htFresh(s) ? ': it moves only as the other camera sees it' : '. Bring it back in.');
    if (viewFresh(w) && w.edge) return nm + ' hand is at the ' + w.edge + ' edge of ' + of;
  }
  return '';
}
let htUiT = 0;
function htRenderUI(dt, time) {
  HT.fpsT += dt; if (HT.fpsT >= 1) { for (const c of HT.cams) { c.fps = Math.round(c.fpsN / HT.fpsT); c.fpsN = 0; } HT.fpsT = 0; }
  htUiT -= dt; if (htUiT > 0) return; htUiT = 0.066;
  const st = HT.status, on = st !== 'off', two = HT.n > 1;
  $('btnHands').classList.toggle('on', on); $('btnHands').setAttribute('aria-pressed', on ? 'true' : 'false');
  $('htOn').hidden = on && st !== 'error'; $('htOff').hidden = !on; $('htRecal').hidden = st !== 'ready'; $('htLive').hidden = st !== 'ready';
  const dv = HT.cal ? depthView(HT.cal) : '';
  const line = st === 'off' ? 'Off. The mouse controls the instruments.' : st === 'loading' ? HT.msg + '…' : st === 'error' ? HT.msg : st === 'calibrating' ? 'Calibrating'
    : 'On, ' + (two ? 'two cameras (depth view ' + dv + ')' : 'one camera' + (HT.cal.std ? ', standard webcam settings' : '')) + ' · tracking ' + HT.cams.slice(0, HT.n).map(c => c.fps).join(' and ') + ' fps';
  if ($('htStatus').textContent !== line) $('htStatus').textContent = line;
  $('htStatus').className = 'ht-status' + (st === 'error' ? ' err' : '');
  if (st === 'ready') {
    for (const k of ['L', 'R']) {
      const s = HT.slot[k], e = $('ht' + k), warn = htWarning(k), txt = !htFresh(s) ? 'no hand' : s.clutch ? 'on hold' : !s.engaged ? 'ready' : warn ? (/has left/.test(warn) ? 'one camera only' : 'near the edge of view') : s.pinch ? 'pinched' : 'tracking';
      e.textContent = (k === 'L' ? 'Left: ' : 'Right: ') + txt; e.className = 'chip ' + (!htFresh(s) ? 'no' : s.clutch || warn ? '' : 'ok');
    }
    $('camPrev2').hidden = !two; drawPreview($('camPrev'), HT.cams[0]); if (two) drawPreview($('camPrev2'), HT.cams[1]);
  }
  if (st === 'calibrating' || st === 'loading' || st === 'error') {
    const C = HT.calib, steps = calSteps(), cs = C ? steps[C.i] : null;
    $('calTitle').textContent = st === 'loading' ? 'Getting ready' : st === 'error' ? 'Hand control could not start' : cs.title;
    $('calText').textContent = st === 'loading' ? HT.msg + '… The first load takes a few seconds.' : st === 'error' ? HT.msg : cs.text;
    $('calNote').textContent = C ? C.note : '';
    $('calBar').style.width = (C ? Math.round(C.prog * 100) : 0) + '%';
    $('calCount').textContent = C ? 'Step ' + (C.i + 1) + ' of ' + steps.length : '';
    $('calStd').hidden = st !== 'calibrating' || two; $('calRedo').hidden = st !== 'calibrating' || !C || C.i === 0; $('calRetry').hidden = st !== 'error';
    if (st !== 'calibrating') $('calSaved').hidden = true;
    $('calCanvas2').hidden = !two; $('calSheet').classList.toggle('two', two); drawPreview($('calCanvas'), HT.cams[0]); if (two) drawPreview($('calCanvas2'), HT.cams[1]);
    $('calPoseWrap').hidden = !cs || st !== 'calibrating';
    if (cs && st === 'calibrating') { drawPose($('calPose'), cs.pose); $('calPoseCap').textContent = cs.pose === 'pinch' ? 'Thumb on the first two fingertips' : cs.pose === 'flat' ? 'All fingers straight and spread' : 'Working grip: a gap between thumb and fingertips, last two fingers curled'; }
  }
}
function htWire() {
  try { const t = JSON.parse(localStorage.getItem(TUNE_KEY) || 'null'); if (t) for (const k in HT.tune) if (typeof t[k] === 'number') HT.tune[k] = t[k]; } catch (e) {}
  const sl = (id, key, to, from) => { const e = $(id); e.value = from(HT.tune[key]); e.addEventListener('input', () => { HT.tune[key] = to(+e.value); try { localStorage.setItem(TUNE_KEY, JSON.stringify(HT.tune)); } catch (_) {} }); };
  sl('tGain', 'gain', v => v / 10, v => Math.round(v * 10)); sl('tSmooth', 'smooth', v => v / 100, v => Math.round(v * 100));
  sl('tPinch', 'pinch', v => v / 100, v => Math.round(v * 100)); sl('tOpen', 'open', v => v / 100, v => Math.round(v * 100));
  $('btnHands').addEventListener('click', () => (HT.status === 'off' || HT.status === 'error' ? htEnable() : htDisable()));
  $('htOn').addEventListener('click', htEnable); $('htOff').addEventListener('click', htDisable); $('htRecal').addEventListener('click', htOpenCalib);
  $('calStd').addEventListener('click', () => calibFinish(true)); $('calRedo').addEventListener('click', calibStart);
  $('calCancel').addEventListener('click', htDisable); $('calRetry').addEventListener('click', htEnable);
  $('calSaved').addEventListener('click', () => { const c = htSavedCal(); if (c) htUseCal(c, false); });
  $('camSelA').addEventListener('change', camChoose); $('camSelB').addEventListener('change', camChoose);
}
