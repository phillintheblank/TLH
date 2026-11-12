// ---------- hand control: camera -> hand landmarks -> gestures -> one instrument per hand ----------
// Each hand is followed in three directions: right, up and forward. Two come from where the hand is in the picture;
// the third comes from how large the palm looks (forward with the lid upright, lift with the lid tilted down).
// The video never leaves the browser: frames go straight to an in-page model and are discarded.
const HCOL = { L: '#43c6c0', R: '#f0b24a' };
const HT_PATH = { lib: './vendor/mediapipe/vision_bundle.mjs', wasm: './vendor/mediapipe/wasm', model: './models/hand_landmarker.task' };
const CAL_KEY = 'tlh.handcal.v2', TUNE_KEY = 'tlh.handtune.v1';
// Fallback when calibration is skipped: an upright, user-facing webcam (image is mirrored relative to the user).
const CAL_STD = { rx: -1, ry: 0, rz: 0, ux: 0, uy: -1, uz: 0, fx: 0, fy: 0, fz: 1, apClosed: 0.16, apRel: 0.62, pinchOn: 0.3, pinchOff: 0.42, opnRel: 1.4, opnFlat: 1.84, flatOn: 1.68, flatOff: 1.58, std: true };

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
function newSlot(k) {
  return { key: k, tSeen: -9, ever: false, x: 0, y: 0, rawx: 0, rawy: 0, fx: new OneEuro(), fy: new OneEuro(), ap: 1, opn: 1.4, pinch: false, flat: false,
    flatT: 0, unflatT: 0, clutch: false, engaged: false, ax: 0, ay: 0, az: 0, px: 0, py: 0, down: false, armed: true, relT: 0, lm: null, v: 0, tPrev: 0, readyT: 0,
    z: 0, zb: 0, fz: new OneEuro(), lx: 0, ly: 0, lz: 0 }; // z: palm-size signal; zb: the same after its dead band; l*: last values used
}
const HT = {
  status: 'off', // off | loading | calibrating | ready | error
  msg: '', cal: null, tune: { gain: 2.0, smooth: 0.5, pinch: 0, open: 0, zgain: 1, zsteady: 0.5 }, slot: { L: newSlot('L'), R: newSlot('R') },
  clock: 0, dets: [], aspect: 4 / 3, video: null, stream: null, landmarker: null, lastVT: -1, fps: 0, fpsN: 0, fpsT: 0, calib: null, resume: false, prevT: 0, sim: false
};
function htResetSlots() { for (const k of ['L', 'R']) { const o = HT.slot[k], n = newSlot(k); n.tSeen = o.tSeen; n.ever = o.ever; n.x = o.x; n.y = o.y; n.rawx = o.rawx; n.rawy = o.rawy; n.fx = o.fx; n.fy = o.fy; n.fz = o.fz; n.z = o.z; n.ap = o.ap; n.opn = o.opn; n.lm = o.lm; HT.slot[k] = n; } }
// Calibration stores what the camera sees (x, y, depth signal) when a hand moves right, up and forward. Inverting
// that turns any seen movement back into right / up / forward, whatever the camera angle.
function calInv(c) {
  let fx = c.fx, fy = c.fy, fz = c.fz;
  const det3 = () => c.rx * (c.uy * fz - fy * c.uz) - c.ux * (c.ry * fz - fy * c.rz) + fx * (c.ry * c.uz - c.uy * c.rz);
  let det = det3();
  if (Math.abs(det) < 0.2) { // "forward" was too close to the other two: take the direction square to both, on the same side
    let nx = c.ry * c.uz - c.rz * c.uy, ny = c.rz * c.ux - c.rx * c.uz, nz = c.rx * c.uy - c.ry * c.ux; const l = Math.hypot(nx, ny, nz) || 1, sg = nx * fx + ny * fy + nz * fz < 0 ? -1 : 1;
    fx = (sg * nx) / l; fy = (sg * ny) / l; fz = (sg * nz) / l; det = det3() || 1e-6;
  }
  return [ // rows: right, up, forward
    (c.uy * fz - fy * c.uz) / det, (fx * c.uz - c.ux * fz) / det, (c.ux * fy - fx * c.uy) / det,
    (fy * c.rz - c.ry * fz) / det, (c.rx * fz - fx * c.rz) / det, (fx * c.ry - c.rx * fy) / det,
    (c.ry * c.uz - c.uy * c.rz) / det, (c.ux * c.rz - c.rx * c.uz) / det, (c.rx * c.uy - c.ux * c.ry) / det
  ];
}
function htThresh() {
  const c = HT.cal || CAL_STD, kp = 1 + 0.4 * HT.tune.pinch, o = 0.14 * HT.tune.open;
  return { on: c.pinchOn * kp, off: c.pinchOff * kp, flatOn: c.flatOn - o, flatOff: c.flatOff - o };
}
const _d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const PALM = [0, 1, 5, 9, 13, 17], KZ = 1.1;
// lm: 21 image landmarks (x, y in 0..1); wl: 21 metric landmarks relative to the hand itself
function handFeatures(lm, wl, aspect) {
  const x = ((lm[0].x + lm[5].x + lm[17].x) / 3) * aspect, y = (lm[0].y + lm[5].y + lm[17].y) / 3; // palm centre: steady while the fingers pinch
  const size = Math.hypot((lm[0].x - lm[9].x) * aspect, lm[0].y - lm[9].y);
  // Depth signal: how large the palm looks, as picture size per metre of real hand. The model's own 3-D estimate of
  // the hand supplies the real size, so tilting the palm does not read as moving nearer or further; the fingers are
  // left out so that pinching does not either. KZ makes a change in scale comparable to a sideways move.
  let sc = 0;
  if (wl && wl.length === 21) {
    let mu = 0, mv = 0, mX = 0, mY = 0;
    for (const i of PALM) { mu += lm[i].x * aspect; mv += lm[i].y; mX += wl[i].x; mY += wl[i].y; }
    mu /= PALM.length; mv /= PALM.length; mX /= PALM.length; mY /= PALM.length;
    let num = 0, den = 0;
    for (const i of PALM) { const X = wl[i].x - mX, Y = wl[i].y - mY; num += (lm[i].x * aspect - mu) * X + (lm[i].y - mv) * Y; den += X * X + Y * Y; }
    sc = den > 1e-9 ? num / den : 0;
  }
  const z = KZ * Math.log(sc > 1e-3 ? sc : Math.max(size, 1e-3));
  const W = wl && wl.length === 21 ? wl : lm.map(p => ({ x: p.x * aspect, y: p.y, z: (p.z || 0) * aspect }));
  const palm = _d3(W[0], W[9]) || 1e-6;
  const ap = Math.min(_d3(W[4], W[8]), _d3(W[4], W[12])) / palm; // thumb tip to the nearer of index and middle tips
  let opn = 0; for (const [m, t] of [[5, 8], [9, 12], [13, 16], [17, 20]]) opn += _d3(W[t], W[0]) / (_d3(W[m], W[0]) || 1e-6);
  return { x, y, z, size, ap, opn: opn / 4, lm };
}
function assignSlots(feats) {
  const L = HT.slot.L, R = HT.slot.R, cal = HT.cal || CAL_STD, out = [];
  const pr = p => p.x * cal.rx + p.y * cal.ry; // larger = further toward the user's right
  const rec = s => HT.clock - s.tSeen < 0.6, d = (f, s) => Math.hypot(f.x - s.rawx, f.y - s.rawy);
  if (feats.length >= 2) {
    const a = feats[0], b = feats[1];
    let aL;
    if (rec(L) && rec(R)) aL = d(a, L) + d(b, R) <= d(a, R) + d(b, L); // keep each hand on its own track, even if they cross
    else if (rec(L)) aL = d(a, L) <= d(b, L);
    else if (rec(R)) aL = d(a, R) > d(b, R);
    else aL = pr(a) < pr(b);
    out.push([aL ? L : R, a], [aL ? R : L, b]);
  } else if (feats.length === 1) {
    const f = feats[0];
    let s;
    if (rec(L) && rec(R)) s = d(f, L) <= d(f, R) ? L : R;
    else if (rec(L) && d(f, L) < 0.3) s = L;
    else if (rec(R) && d(f, R) < 0.3) s = R;
    else { const mid = L.ever && R.ever ? (pr({ x: L.rawx, y: L.rawy }) + pr({ x: R.rawx, y: R.rawy })) / 2 : pr({ x: HT.aspect / 2, y: 0.5 }); s = pr(f) < mid ? L : R; }
    out.push([s, f]);
  }
  return out;
}
// One tracking result. dets: [{lm, wl}], t: seconds on any steady clock.
function htIngest(dets, t) {
  const feats = dets.map(d => handFeatures(d.lm, d.wl, HT.aspect)).sort((a, b) => b.size - a.size).slice(0, 2);
  HT.dets = feats; HT.fpsN++;
  if (HT.calib) { calibIngest(feats, t); return; }
  const th = htThresh(), mc = lerp(3.2, 0.5, HT.tune.smooth);
  for (const [s, f] of assignSlots(feats)) {
    const back = HT.clock - s.tSeen > 0.6;
    if (back) { s.fx.reset(); s.fy.reset(); s.fz.reset(); s.ap = f.ap; s.opn = f.opn; }
    s.rawx = f.x; s.rawy = f.y; s.rawz = f.z; s.ever = true; s.tSeen = HT.clock; s.lm = f.lm;
    const ox = s.x, oy = s.y, fdt = clamp(t - s.tPrev, 0.005, 0.2); s.tPrev = t;
    s.x = s.fx.f(f.x, t, mc, 5); s.y = s.fy.f(f.y, t, mc, 5); s.z = s.fz.f(f.z, t, lerp(1.8, 0.3, HT.tune.zsteady), 2.5); // palm size is the noisier signal, so it is smoothed harder
    s.v = back ? 0 : lerp(s.v, Math.hypot(s.x - ox, s.y - oy) / fdt, 0.4);
    s.ap = lerp(s.ap, f.ap, 0.6); s.opn = lerp(s.opn, f.opn, 0.5);
    if (!s.pinch && s.ap < th.on) s.pinch = true; else if (s.pinch && s.ap > th.off) s.pinch = false;
    s.flat = s.flat ? s.opn > th.flatOff && s.ap > th.on : s.opn > th.flatOn && s.ap > th.off; // open, flat hand = clutch
  }
}
const htFresh = s => HT.clock - s.tSeen < 0.3;
// Before picking: pass each engaged hand's movement to its instrument. Mapping is relative, so taking an instrument
// never makes it jump. Free depth: the tip follows the hand right, up and into the picture, as on a robot console.
// Auto depth: the hand moves a pointer on the screen and the tip rides the tissue under it.
function htPointers(dt) {
  HT.clock += dt;
  const cal = HT.cal || CAL_STD, inv = cal.inv || (cal.inv = calInv(cal)), live = HT.status === 'ready' && S.running && !S.ended, free = freeDepth();
  for (const h of HANDS) {
    const s = HT.slot[h.key], fresh = htFresh(s);
    if (fresh && s.flat) { s.flatT += dt; s.unflatT = 0; } else if (fresh) { s.unflatT += dt; s.flatT = 0; }
    if (!s.clutch && s.flatT > 0.1) s.clutch = true; else if (s.clutch && s.unflatT > 0.15) s.clutch = false;
    // A hand takes its instrument only after holding a steady, curled pose for a moment. That keeps a hand that is
    // reaching for the keyboard, or passing through the camera view, from grabbing the instrument on the way.
    s.readyT = fresh && !s.clutch && s.v < 0.7 ? s.readyT + dt : 0;
    const want = live && fresh && !s.clutch && (s.engaged || s.readyT > 0.35);
    if (want && !s.engaged) {
      project(h.tip, _ps);
      s.px = clamp(_ps.x, 4, VW - 4); s.py = clamp(_ps.y, 4, VH - 4); s.ax = s.lx = s.x; s.ay = s.ly = s.y; s.az = s.lz = s.zb = s.z; s.armed = !s.pinch; s.engaged = true;
    } else if (!want) s.engaged = false;
    if (!s.engaged) { h.ptr.on = false; continue; }
    const g = HT.tune.gain * VH;
    // Palm size is the noisier measurement. It passes through a small dead band, so tracker jitter does not creep the
    // instrument. With the lid upright that steadies depth; with the lid tilted down it steadies whichever
    // direction the calibration reads from palm size.
    const band = lerp(0.002, 0.016, HT.tune.zsteady);
    if (s.z - s.zb > band) s.zb = s.z - band; else if (s.zb - s.z > band) s.zb = s.z + band;
    if (free) {
      const dx = s.x - s.lx, dy = s.y - s.ly, dz = s.zb - s.lz; s.lx = s.x; s.ly = s.y; s.lz = s.zb;
      const c = h.cmd; c.dx += (inv[0] * dx + inv[1] * dy + inv[2] * dz) * g; c.dy -= (inv[3] * dx + inv[4] * dy + inv[5] * dz) * g; c.dv += (inv[6] * dx + inv[7] * dy + inv[8] * dz) * g * HT.tune.zgain; c.cart = true;
      h.ptr.on = true;
    } else {
      const dx = s.x - s.ax, dy = s.y - s.ay, dz = s.zb - s.az;
      let x = s.px + (inv[0] * dx + inv[1] * dy + inv[2] * dz) * g, y = s.py - (inv[3] * dx + inv[4] * dy + inv[5] * dz) * g;
      const cx = clamp(x, 4, VW - 4), cy = clamp(y, 4, VH - 4);
      if (cx !== x || cy !== y) { s.px = x = cx; s.py = y = cy; s.ax = s.x; s.ay = s.y; s.az = s.zb; } // at the edge of the view: re-anchor so reversing responds at once
      h.ptr.x = x; h.ptr.y = y; h.ptr.ndc.set((x / VW) * 2 - 1, -((y / VH) * 2 - 1)); h.ptr.on = true;
    }
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
// Direction: the user shows which way is right, up and forward, so any camera angle works (lid upright or tilted
// down at the hands). Gestures: the user's own pinch, working grip and flat hand set the thresholds.
const CAL_STEPS = [
  { id: 'hands', title: 'Show both hands', text: 'Hold both hands still where you plan to work, inside the camera view.' },
  { id: 'right', title: 'Move your right hand to the right', text: 'Slide your right hand about a hand-width to your right, then hold it still. Keep the left hand where it is.' },
  { id: 'up', title: 'Now lift that hand', text: 'Raise the same hand about a hand-width, straight up, then hold it still.' },
  { id: 'fwd', title: 'Now push it forward', text: 'Push the same hand away from you, toward the screen, about a hand-length, then hold it still. This is the direction that drives an instrument in.' },
  { id: 'pinch', title: 'Pinch', text: 'With the right hand, pinch your thumb against your first two fingers and hold.' },
  { id: 'grip', title: 'Relax into your working grip', text: 'Let the thumb come just off the fingertips, with the other fingers loosely curled, as if holding the controls. Hold still.' },
  { id: 'flat', title: 'Open the hand flat', text: 'Straighten all the fingers and spread the hand. This is the clutch: it freezes that instrument until you curl the hand again.' }
];
function calibStart() {
  htRelease();
  HT.calib = { i: 0, hold: 0, tr: [null, null], right: -1, p0: null, p1: null, p2: null, rv: null, uv: null, fv: null, apC: 0, apR: 0, opR: 0, opF: 0, acc: [0, 0, 0], prog: 0, lastT: 0, note: '', stepT: 0, apMax: 0 };
  HT.status = 'calibrating'; uiDirty();
}
function calibIngest(feats, t) {
  const C = HT.calib, dt = clamp(t - (C.lastT || t), 0.005, 0.12); C.lastT = t; C.stepT += dt;
  const step = CAL_STEPS[C.i].id, upd = (tr, f) => {
    if (!tr) return { x: f.x, y: f.y, z: f.z, v: 1, vz: 1, ap: f.ap, opn: f.opn, gv: 2 };
    // speeds are taken from the smoothed values so tracker jitter does not read as movement
    const x = lerp(tr.x, f.x, 0.5), y = lerp(tr.y, f.y, 0.5), z = lerp(tr.z, f.z, 0.35), ap = lerp(tr.ap, f.ap, 0.5), opn = lerp(tr.opn, f.opn, 0.5);
    return { x, y, z, ap, opn, v: lerp(tr.v, Math.hypot(x - tr.x, y - tr.y) / dt, 0.4), vz: lerp(tr.vz, Math.abs(z - tr.z) / dt, 0.4), gv: lerp(tr.gv, (Math.abs(ap - tr.ap) + Math.abs(opn - tr.opn)) / dt, 0.4) };
  };
  const dist = (f, tr) => Math.hypot(f.x - tr.x, f.y - tr.y);
  if (feats.length >= 2) {
    const a = feats[0], b = feats[1], T = C.tr;
    const straight = !T[0] || !T[1] || dist(a, T[0]) + dist(b, T[1]) <= dist(a, T[1]) + dist(b, T[0]);
    T[0] = upd(T[0], straight ? a : b); T[1] = upd(T[1], straight ? b : a);
  } else if (feats.length === 1 && C.tr[0] && C.tr[1]) {
    const k = dist(feats[0], C.tr[0]) <= dist(feats[0], C.tr[1]) ? 0 : 1; C.tr[k] = upd(C.tr[k], feats[0]);
    if (C.right >= 0 && k !== C.right) { C.hold = 0; C.note = 'I can only see one hand. Keep the right hand in view.'; C.prog = 0; return; }
    if (C.right < 0) { C.hold = 0; C.prog = 0; C.note = 'I can only see one hand. Bring both into view.'; return; }
  } else { C.hold = 0; C.prog = 0; C.note = feats.length ? 'Bring both hands into view.' : 'I can\'t see your hands. Move them into the camera view.'; return; }
  C.note = '';
  const still = tr => tr.v < 0.2 && tr.vz < 0.3, d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), P3 = tr => ({ x: tr.x, y: tr.y, z: tr.z }), advance = () => { C.i++; C.hold = 0; C.prog = 0; C.stepT = 0; C.acc = [0, 0, 0]; sfx.ok(); uiDirty(); };
  // a noisy frame drains the hold a little and does not restart it
  const holdFor = (ok, need) => { C.hold = ok ? C.hold + dt : Math.max(0, C.hold - 2 * dt); if (C.hold === 0) C.acc = [0, 0, 0]; return C.hold >= need; };
  if (step === 'hands') {
    C.prog = clamp(C.hold / 0.8, 0, 1);
    if (holdFor(still(C.tr[0]) && still(C.tr[1]), 0.8)) { C.p0 = [P3(C.tr[0]), P3(C.tr[1])]; advance(); }
    return;
  }
  if (step === 'right') {
    const m = [0, 1].map(k => d3(C.tr[k], C.p0[k])), k = m[0] >= m[1] ? 0 : 1, o = 1 - k;
    const far = m[k] > 0.12 && m[o] < 0.6 * m[k];
    C.prog = far ? 0.5 + 0.5 * clamp(C.hold / 0.5, 0, 1) : 0.5 * clamp(m[k] / 0.12, 0, 1);
    if (holdFor(far && still(C.tr[k]), 0.5)) {
      C.right = k; C.rv = { x: (C.tr[k].x - C.p0[k].x) / m[k], y: (C.tr[k].y - C.p0[k].y) / m[k], z: (C.tr[k].z - C.p0[k].z) / m[k] }; C.p1 = P3(C.tr[k]); advance();
    }
    return;
  }
  const R = C.tr[C.right];
  if (step === 'up' || step === 'fwd') { // a new direction has to differ clearly from the ones already shown
    const from = step === 'up' ? C.p1 : C.p2, m = d3(R, from), d = m > 1e-6 ? { x: (R.x - from.x) / m, y: (R.y - from.y) / m, z: (R.z - from.z) / m } : { x: 0, y: 0, z: 0 };
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z, r = C.rv;
    let ox = d.x - dot(d, r) * r.x, oy = d.y - dot(d, r) * r.y, oz = d.z - dot(d, r) * r.z;
    if (step === 'fwd') { // also take out the part along "up" (made square to "right" first)
      const u = C.uv, k = dot(u, r), wx = u.x - k * r.x, wy = u.y - k * r.y, wz = u.z - k * r.z, wl = Math.hypot(wx, wy, wz) || 1, w = { x: wx / wl, y: wy / wl, z: wz / wl }, q = dot({ x: ox, y: oy, z: oz }, w);
      ox -= q * w.x; oy -= q * w.y; oz -= q * w.z;
    }
    const indep = Math.hypot(ox, oy, oz), far = m > 0.1, need = step === 'up' ? 0.5 : 0.45, ok = far && indep > need;
    if (far && !ok) C.note = step === 'up' ? 'That looks like the same direction as before. Lift the hand straight up.' : 'That looks like a direction already shown. Push the hand straight away from you.';
    C.prog = ok ? 0.5 + 0.5 * clamp(C.hold / 0.5, 0, 1) : 0.5 * clamp(m / 0.1, 0, 1);
    if (holdFor(ok && still(R), 0.5)) { if (step === 'up') { C.uv = d; C.p2 = P3(R); } else C.fv = d; advance(); }
    return;
  }
  C.apMax = Math.max(C.apMax, R.ap);
  const calm = R.gv < 1.2 && R.v < 0.3, mean = (v, n) => { C.acc[0] += v * dt; C.acc[1] += (n || 0) * dt; C.acc[2] += dt; };
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
function calibFinish(std) {
  const C = HT.calib;
  let cal;
  if (std || !C || !C.rv || !C.uv || !C.fv) cal = Object.assign({}, CAL_STD);
  else {
    const span = Math.max(0.12, C.apR - C.apC), os = Math.max(0.12, C.opF - C.opR);
    cal = { rx: C.rv.x, ry: C.rv.y, rz: C.rv.z, ux: C.uv.x, uy: C.uv.y, uz: C.uv.z, fx: C.fv.x, fy: C.fv.y, fz: C.fv.z, apClosed: C.apC, apRel: C.apC + span, pinchOn: C.apC + 0.35 * span, pinchOff: C.apC + 0.6 * span,
      opnRel: C.opR, opnFlat: C.opR + os, flatOn: C.opR + 0.6 * os, flatOff: C.opR + 0.42 * os, std: false };
  }
  htUseCal(cal, true);
}
function htUseCal(cal, save) {
  cal.inv = calInv(cal); HT.cal = cal; HT.calib = null; HT.status = 'ready';
  if (save) try { localStorage.setItem(CAL_KEY, JSON.stringify(cal)); } catch (e) {}
  htResetSlots(); for (const k of ['L', 'R']) { HT.slot[k].tSeen = -9; }
  $('calModal').hidden = true;
  if (HT.resume && !S.ended) S.running = true;
  HT.resume = false;
  toast('Hand control is on. Curl your hands into the working grip to take the instruments. An open, flat hand puts that instrument on hold.', 'ok'); sfx.ok(); uiDirty(true);
}
function htSavedCal() { try { const c = JSON.parse(localStorage.getItem(CAL_KEY) || 'null'); return c && typeof c.rx === 'number' && typeof c.fz === 'number' && typeof c.pinchOn === 'number' ? c : null; } catch (e) { return null; } }

// ---------- camera + model ----------
function htSetMode(on) { htRelease(); CTRL.mode = on ? 'hands' : 'mouse'; uiDirty(true); }
function htOpenCalib() {
  if (S.running) { HT.resume = true; S.running = false; }
  $('calModal').hidden = false; $('calSaved').hidden = !htSavedCal();
  calibStart();
}
async function htEnable() {
  if (HT.status === 'loading' || HT.status === 'calibrating' || HT.status === 'ready') return;
  HT.status = 'loading'; HT.msg = 'Starting the camera'; uiDirty(true);
  htSetMode(true);
  if (S.running) { HT.resume = true; S.running = false; }
  $('calModal').hidden = false; $('calSaved').hidden = true;
  try {
    if (!HT.sim) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('This browser has no camera access on this page. Open the simulator over https.'), { name: 'NoMedia' });
      HT.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: false });
      if (HT.status !== 'loading') { htStopCamera(); return; } // turned off while the permission prompt was open
      const v = HT.video = $('camVideo'); v.srcObject = HT.stream; await v.play();
      HT.aspect = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 4 / 3;
      HT.msg = 'Loading the hand-tracking model'; uiDirty();
      if (!HT.landmarker) {
        const mp = await import(HT_PATH.lib), fileset = await mp.FilesetResolver.forVisionTasks(HT_PATH.wasm);
        const opts = delegate => ({ baseOptions: { modelAssetPath: HT_PATH.model, delegate }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        try { HT.landmarker = await mp.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
        catch (e) { HT.landmarker = await mp.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
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
function htStopCamera() {
  if (HT.stream) { for (const t of HT.stream.getTracks()) t.stop(); HT.stream = null; }
  if (HT.video) { try { HT.video.pause(); HT.video.srcObject = null; } catch (e) {} }
}
function htDisable() {
  htStopCamera(); HT.calib = null; HT.status = 'off'; HT.msg = ''; HT.dets = [];
  $('calModal').hidden = true; htSetMode(false);
  if (HT.resume && !S.ended) S.running = true;
  HT.resume = false; uiDirty(true);
}
function htLoop() {
  const v = HT.video;
  const step = () => {
    if (!HT.stream) return;
    if (v.readyState >= 2 && v.currentTime !== HT.lastVT && !document.hidden) {
      HT.lastVT = v.currentTime;
      let res = null;
      try { res = HT.landmarker.detectForVideo(v, performance.now()); } catch (e) { res = null; }
      if (res && res.landmarks) htIngest(res.landmarks.map((lm, i) => ({ lm, wl: res.worldLandmarks && res.worldLandmarks[i] })), performance.now() / 1000);
    }
    requestAnimationFrame(step);
  };
  step();
}

// ---------- panel, preview, calibration screen ----------
const HAND_BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function drawPreview(cv) {
  const r = cv.getBoundingClientRect(); if (r.width < 4) return;
  const pr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(r.width * pr), H = Math.round(r.height * pr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#05080a'; c.fillRect(0, 0, W, H);
  // shown mirrored, like a mirror: your right hand appears on the right
  if (HT.video && HT.video.readyState >= 2) { c.save(); c.translate(W, 0); c.scale(-1, 1); c.globalAlpha = 0.85; c.drawImage(HT.video, 0, 0, W, H); c.restore(); }
  const col = f => { if (HT.calib) { const C = HT.calib, k = C.tr[0] && C.tr[1] ? (Math.hypot(f.x - C.tr[0].x, f.y - C.tr[0].y) <= Math.hypot(f.x - C.tr[1].x, f.y - C.tr[1].y) ? 0 : 1) : -1; return C.right >= 0 ? (k === C.right ? HCOL.R : HCOL.L) : '#dfe8ec'; }
    for (const k of ['L', 'R']) if (HT.slot[k].lm === f.lm) return HCOL[k]; return '#dfe8ec'; };
  for (const f of HT.dets) {
    const X = p => (1 - p.x) * W, Y = p => p.y * H; c.strokeStyle = c.fillStyle = col(f); c.lineWidth = 1.5 * pr;
    c.beginPath(); for (const [a, b] of HAND_BONES) { c.moveTo(X(f.lm[a]), Y(f.lm[a])); c.lineTo(X(f.lm[b]), Y(f.lm[b])); } c.stroke();
    for (const i of [4, 8, 12]) { c.beginPath(); c.arc(X(f.lm[i]), Y(f.lm[i]), 3 * pr, 0, TAU); c.fill(); }
  }
}
let htUiT = 0;
function htRenderUI(dt, time) {
  HT.fpsT += dt; if (HT.fpsT >= 1) { HT.fps = Math.round(HT.fpsN / HT.fpsT); HT.fpsN = 0; HT.fpsT = 0; }
  htUiT -= dt; if (htUiT > 0) return; htUiT = 0.066;
  const st = HT.status, on = st !== 'off';
  $('btnHands').classList.toggle('on', on); $('btnHands').setAttribute('aria-pressed', on ? 'true' : 'false');
  $('htOn').hidden = on && st !== 'error'; $('htOff').hidden = !on; $('htRecal').hidden = st !== 'ready'; $('htLive').hidden = st !== 'ready';
  const line = st === 'off' ? 'Off. The mouse controls the instruments.' : st === 'loading' ? HT.msg + '…' : st === 'error' ? HT.msg : st === 'calibrating' ? 'Calibrating' : 'On' + (HT.cal && HT.cal.std ? ', standard webcam settings' : ', calibrated') + ' · tracking ' + HT.fps + ' fps';
  if ($('htStatus').textContent !== line) $('htStatus').textContent = line;
  $('htStatus').className = 'ht-status' + (st === 'error' ? ' err' : '');
  if (st === 'ready') {
    for (const k of ['L', 'R']) {
      const s = HT.slot[k], e = $('ht' + k), txt = !htFresh(s) ? 'no hand' : s.clutch ? 'on hold' : !s.engaged ? 'ready' : s.pinch ? 'pinched' : 'tracking';
      e.textContent = (k === 'L' ? 'Left: ' : 'Right: ') + txt; e.className = 'chip ' + (!htFresh(s) ? 'no' : s.clutch ? '' : 'ok');
    }
    drawPreview($('camPrev'));
  }
  if (st === 'calibrating' || st === 'loading' || st === 'error') {
    const C = HT.calib, cs = C ? CAL_STEPS[C.i] : null;
    $('calTitle').textContent = st === 'loading' ? 'Getting ready' : st === 'error' ? 'Hand control could not start' : cs.title;
    $('calText').textContent = st === 'loading' ? HT.msg + '… The first load takes a few seconds.' : st === 'error' ? HT.msg : cs.text;
    $('calNote').textContent = C ? C.note : '';
    $('calBar').style.width = (C ? Math.round(C.prog * 100) : 0) + '%';
    $('calCount').textContent = C ? 'Step ' + (C.i + 1) + ' of ' + CAL_STEPS.length : '';
    $('calStd').hidden = st !== 'calibrating'; $('calRedo').hidden = st !== 'calibrating' || !C || C.i === 0; $('calRetry').hidden = st !== 'error';
    if (st !== 'calibrating') $('calSaved').hidden = true;
    drawPreview($('calCanvas'));
  }
}
function htWire() {
  try { const t = JSON.parse(localStorage.getItem(TUNE_KEY) || 'null'); if (t) for (const k in HT.tune) if (typeof t[k] === 'number') HT.tune[k] = t[k]; } catch (e) {}
  const sl = (id, key, to, from) => { const e = $(id); e.value = from(HT.tune[key]); e.addEventListener('input', () => { HT.tune[key] = to(+e.value); try { localStorage.setItem(TUNE_KEY, JSON.stringify(HT.tune)); } catch (_) {} }); };
  sl('tGain', 'gain', v => v / 10, v => Math.round(v * 10)); sl('tSmooth', 'smooth', v => v / 100, v => Math.round(v * 100));
  sl('tZGain', 'zgain', v => v / 100, v => Math.round(v * 100)); sl('tZSteady', 'zsteady', v => v / 100, v => Math.round(v * 100));
  sl('tPinch', 'pinch', v => v / 100, v => Math.round(v * 100)); sl('tOpen', 'open', v => v / 100, v => Math.round(v * 100));
  $('btnHands').addEventListener('click', () => (HT.status === 'off' || HT.status === 'error' ? htEnable() : htDisable()));
  $('htOn').addEventListener('click', htEnable); $('htOff').addEventListener('click', htDisable); $('htRecal').addEventListener('click', htOpenCalib);
  $('calStd').addEventListener('click', () => calibFinish(true)); $('calRedo').addEventListener('click', calibStart);
  $('calCancel').addEventListener('click', htDisable); $('calRetry').addEventListener('click', htEnable);
  $('calSaved').addEventListener('click', () => { const c = htSavedCal(); if (c) htUseCal(c, false); });
}
