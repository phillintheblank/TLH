// ---------- lab: the instruments on that tissue, what is found and what is injured, and the score ----------
// Free play. Nothing here asks for a step: the trainee opens the peritoneum where they choose and dissects as they
// choose. Three instruments, with the mouse:
//   Maryland   a click closes the jaws and a second click opens them. Closed on tissue it holds; opened in loose tissue it spreads.
//   Bipolar    a quick click closes or opens the jaws with no energy. A held click coagulates what is in them. The blade is right-click or C.
//   Suction    hold to aspirate.
INST.maryland = { name: 'Maryland dissector', short: 'Maryland', hud: 'MARYLAND', use: 'Click to close the jaws, click again to open them. Closed on tissue it holds; opened inside loose tissue it spreads.' };
(function () { // curved, fine jaws on the same shaft as the other 5 mm instruments
  for (const h of HANDS) {
    const g = new THREE.Group(), o = { g, jaws: [], needle: null, swage: null };
    for (const sg of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(0, 0, 2.0); piv.userData.sg = sg;
      const geo = jawGeo(0.3, 0.1, 2.0, 0.72, sg, 0.012), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const q = -p.getZ(i) / 2.0; p.setX(i, p.getX(i) + 0.26 * q * q); } // the curve of a Maryland
      geo.computeVertexNormals();
      const j = new THREE.Mesh(geo, IM.steel); j.position.y = sg * 0.05; piv.add(j); g.add(piv); o.jaws.push(piv);
    }
    g.add(xPin(0.06, 0.44, 2.0, IM.steel)); for (const sx of [1, -1]) g.add(zBox(0.05, 0.3, 0.7, 1.85, IM.steel, sx * 0.17));
    g.add(zCyl(0.2, 0.25, 0.3, 2.5, IM.steel, 24));
    for (let i = 0; i < 3; i++) { g.add(zCyl(0.255, 0.255, 0.1, 2.8 + i * 0.16, IM.steel, 24)); g.add(zCyl(0.19, 0.19, 0.06, 2.9 + i * 0.16, IM.dark, 16)); }
    g.add(zCyl(0.262, 0.262, 0.07, 3.28, IM.steel, 24)); g.add(zCyl(0.25, 0.25, 40, 3.35, IM.shaft, 24));
    g.visible = false; h.sub.maryland = o; h.grp.add(g);
  }
})();

WS.VIS = 2; // The right port lies almost over the right sidewall. With the simulator's rule that 4.5 cm of an instrument must show, the right hand could not work on its own wall above the mid-pelvis; here 2 cm is enough
SOLID.perit = 1; // an instrument's shaft cannot sweep sideways through peritoneum that has not been opened: it goes in through the opening
const JR = 0.25; // half the width of a pair of jaws: what lies this near their line is against them
// HOLD: a click held this long is a hold, and starts the energy. SWEEP, ALONG: how near a thread of the web lies to a moving tip, or to the jaws behind it, when it parts.
// SLIP: how many times its own length peritoneum held in the jaws stretches before it pulls out of them. ZOOM: how many cm further than the simulator's the scope goes in
const LK = { HOLD: 0.28, JAW: { maryland: 1.6, bipolar: 1.9, suction: 0.6 }, SWEEP: 0.55, ALONG: 0.35, SLIP: 2.6, ZOOM: 5.5 };
const mkLH = () => ({ in: false, held: [], kind: '', down: false, t0: 0, wasOpen: true, coag: false, last: new V3(), vHold: null, carry: null, sph: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()], ns: 0, edge: [{ p: new V3(), d: new V3(), len: 0 }, { p: new V3(), d: new V3(), len: 0 }], ne: 0 });
const LH = { L: mkLH(), R: mkLH() };
const _ja = new V3(), _jb = new V3(), _jy = new V3(), _jc = new V3(), _jm = new V3(), _jn = new V3();
// the jaws of an instrument as a line from its tip back toward its port
function lbJaw(h, len) { _ja.copy(h.tip); _jb.copy(h.port).sub(h.tip).setLength(len || LK.JAW[h.inst] || 1.6).add(h.tip); }
// how far a point is from that line
function lbSeg(px, py, pz) {
  const ax = _jb.x - _ja.x, ay = _jb.y - _ja.y, az = _jb.z - _ja.z, t = clamp(((px - _ja.x) * ax + (py - _ja.y) * ay + (pz - _ja.z) * az) / (ax * ax + ay * ay + az * az || 1), 0, 1);
  return Math.hypot(_ja.x + ax * t - px, _ja.y + ay * t - py, _ja.z + az * t - pz);
}
const lbSegP = i => { const k = i * 3; return lbSeg(PX.x[k], PX.x[k + 1], PX.x[k + 2]); };
const lbThread = q => { const c = LS.c[q], a = PX.ci[c] * 3, b = PX.cj[c] * 3, x = PX.x; return lbSeg((x[a] + x[b]) / 2, (x[a + 1] + x[b + 1]) / 2, (x[a + 2] + x[b + 2]) / 2); }; // and how far the middle of a thread of the web is
const lbSegArr = arr => { let d = 99, at = 0; for (let i = 0; i < arr.length; i++) { const e = lbSeg(arr[i].x, arr[i].y, arr[i].z); if (e < d) { d = e; at = i; } } return { d, at }; };
// Closing jaws gather the peritoneum that lies in the V between them: a strip of it under the line of the jaws, wider
// in reach toward the heel. lbStrip sets that up for a hand (its jaws, and which way the sheet faces there);
// lbInStrip says whether a point of the sheet is in it, half being half the strip's width.
const JS = { j: new V3(), side: new V3(), len: 1, flat: false };
function lbStrip(h, len) {
  lbJaw(h, len); JS.len = _ja.distanceTo(_jb); JS.j.copy(_jb).sub(_ja).normalize();
  let b = 0, bd = 1e9; for (let i = 0; i < LB.NS; i++) { const k = i * 3, d = (PX.x[k] - _ja.x) ** 2 + (PX.x[k + 1] - _ja.y) ** 2 + (PX.x[k + 2] - _ja.z) ** 2; if (d < bd) { bd = d; b = i; } }
  JS.side.crossVectors(JS.j, lbNin(b, _jn)); JS.flat = JS.side.length() > 0.3; JS.side.normalize(); // flat: the jaws lie along the sheet rather than end-on to it
}
function lbInStrip(px, py, pz, half, pad) { // pad: a margin all round, for heat, which reaches a little beyond what the blade divides
  const vx = px - _ja.x, vy = py - _ja.y, vz = pz - _ja.z, s = vx * JS.j.x + vy * JS.j.y + vz * JS.j.z; pad = pad || 0;
  if (s < -0.2 - pad || s > JS.len + pad) return false;
  const qx = vx - s * JS.j.x, qy = vy - s * JS.j.y, qz = vz - s * JS.j.z, r = Math.hypot(qx, qy, qz);
  if (!JS.flat) return r < half + 0.1;
  return r < Math.min(1, 0.25 + 0.55 * Math.max(0, s)) + pad && Math.abs(qx * JS.side.x + qy * JS.side.y + qz * JS.side.z) < half;
}
const lbInStripP = (i, half, pad) => { const k = i * 3; return lbInStrip(PX.x[k], PX.x[k + 1], PX.x[k + 2], half, pad); };
// is there still peritoneum at this place on the sheet?
function lbAlive(i) { const { NC, NW, dead } = LB, x = i % NC, y = (i / NC) | 0; for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < NC - 1 && b < NW - 1) { const q = (b * (NC - 1) + a) * 2; if (!dead[q] || !dead[q + 1]) return true; } } return false; }

// ---- events ----
function lbInjury(key, text) { if (S.injuries[key]) return false; S.injuries[key] = { t: S.t, type: key }; logEvent('injury', text); sfx.alarm(); return true; }
function lbBleed(p, rate, arterial, label, auto, msg) { const q = p.clone(); return addBleeder(o => o.copy(q), rate, arterial, label, Object.assign({ lab: true }, auto ? { auto, autoMsg: msg } : {})); }
const MAJOR = 'Pressure held on the vessel. In theatre: call for help, vascular surgery, prepare to convert.';
function lbVesselHit(key, p, how) { // a named vessel or nerve burned, cut or torn
  const v = LV[key];
  if (key === 'obn' || key === 'gfn') { lbInjury(key, v.name + ' ' + how); return; }
  if (key === 'oua') { lbInjury('oua', v.name + ' ' + how); return; } // a cord: there is nothing in it to bleed
  if (key === 'ua') {
    if (how === 'coagulated') { if (!S.lab.uaSealed) { S.lab.uaSealed = true; lbInjury('uaCoag', 'Uterine artery coagulated'); } return; }
    if (lbInjury('uaCut', 'Uterine artery ' + how) && !S.lab.uaSealed) { lbBleed(p, 300, true, 'uterine artery'); logEvent('bleed', 'The uterine artery is bleeding. Control it with the bipolar on the bleeding point.'); }
    return;
  }
  if (key === 'sva1' || key === 'sva2') { if (lbInjury('sva', v.name + ' ' + how) && how !== 'coagulated') lbBleed(p, 60, true, 'superior vesical artery', 30, 'The vessel has stopped bleeding'); return; }
  if (key === 'umb' || key === 'oba' || key === 'obv') {
    if (lbInjury(key, v.name + ' ' + how) && how !== 'coagulated') { lbBleed(p, key === 'obv' ? 140 : 160, key !== 'obv', v.name.toLowerCase()); logEvent('bleed', 'The ' + v.name.toLowerCase() + ' is bleeding. Control it with the bipolar on the bleeding point.'); }
    return;
  }
  const k = key === 'iiaA' || key === 'iiaP' ? 'iia' : key; // either division is the internal iliac artery
  if (lbInjury(k, 'Major vascular injury: ' + v.name.toLowerCase() + ' ' + how)) lbBleed(p, k === 'eia' || k === 'iia' ? 420 : 280, k === 'eia' || k === 'iia', v.name, 8, MAJOR);
}
function lbPart(q) { // a thread of the web parted. One that is a small vessel bleeds unless it was coagulated first
  const c = LS.c[q]; if (!(PX.cf[c] & 1)) return;
  PX.cf[c] &= 2;
  if (LS.vasc[q] && !LS.sealed[q]) { PX.get(PX.ci[c], _jm).lerp(PX.get(PX.cj[c], _jn), 0.5); lbBleed(_jm, 14, false, 'small vessel', 40, 'The small vessel has stopped bleeding'); if (!S.lab.oozeSaid) { S.lab.oozeSaid = true; logEvent('bleed', 'A small vessel in the areolar tissue was divided without coagulating it'); } S.lab.smallBleeds++; }
}

// ---- jaws ----
// which places on the sheet are in a pair of jaws, and the places next to them
function lbHeldMask() {
  LB.heldV.fill(0); const { NC, NW } = LB;
  for (const k of ['L', 'R']) for (const e of LH[k].held) if (e.t === 's') { const x = e.i % NC, y = (e.i / NC) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < NC && b < NW) LB.heldV[lbId(a, b)] = 1; } }
  lbReindex();
}
function lbRelease(h) {
  const st = LH[h.key];
  for (const e of st.held) PX.w[e.i] = e.t === 's' && LB.pin[e.i] ? 0 : 1;
  st.carry = null;
  const had = st.held.some(e => e.t === 's'); st.held.length = 0; st.kind = ''; st.vHold = null; if (had) lbHeldMask();
}
function lbClose(h) {
  const st = LH[h.key], grip = h.inst === 'maryland'; h.openGoal = 0.02;
  lbStrip(h); const c = [];
  if (st.in) for (let q = 0; q < LS.n; q++) if (!LS.vasc[q] && (PX.cf[LS.c[q]] & 1) && lbThread(q) < JR + 0.05) lbPart(q); // the web between closing jaws parts
  if (!grip) return;
  for (let i = 0; i < LB.NS; i++) if (PX.w[i] > 0 && lbAlive(i)) { const d = PX.get(i, _jm).distanceTo(h.tip); if (d < 0.6 || lbInStripP(i, 0.22)) c.push({ t: 's', i, d }); }
  if (!c.length && h.touch && (h.pick.mesh === LB.pick || h.pick.ent === 'ip')) { // jaws closed on the surface, or on the ligament that is part of it: the nearest of it comes into them
    let b = -1, bd = 0.9; for (let i = 0; i < LB.NS; i++) if (PX.w[i] > 0) { const d = PX.get(i, _jm).distanceTo(h.tip); if (d < bd && lbAlive(i)) { bd = d; b = i; } }
    if (b >= 0) { PX.get(b, _l5); for (let i = 0; i < LB.NS; i++) if (PX.w[i] > 0 && lbAlive(i) && PX.get(i, _jm).distanceTo(_l5) < 0.5) c.push({ t: 's', i, d: _jm.distanceTo(h.tip) }); }
  }
  c.sort((a, b) => a.d - b.d); c.length = Math.min(c.length, 8);
  let ur = false;
  for (let q = 1; q <= LU.kx; q++) if (lbSegP(LU.i0 + q) < JR + LU.r + 0.08 && PX.w[LU.i0 + q] > 0) { c.push({ t: 'u', i: LU.i0 + q }); ur = true; LU.state[q] |= 2; }
  for (const e of c) { PX.get(e.i, _jm); e.off = _jm.sub(h.tip).clone(); PX.w[e.i] = 0; }
  st.held = c; st.kind = ur ? 'ureter' : c.length ? 'peritoneum' : '';
  if (ur && lbInjury('ureterCrush', 'The ureter was grasped in the jaws: crush injury')) S.lab.crush = true;
  if (st.kind === 'peritoneum') S.stats.traction++;
  // a vessel in the jaws is not an injury until it is pulled on
  if (!ur) for (const k of ['eia', 'eiv', 'iia', 'iiaA', 'iiaP', 'iiv', 'umb', 'oba', 'obv', 'ua']) { const v = LV[k], n = lbSegArr(v.arr); if (n.d < v.r + JR + 0.08 && (st.in || k === 'ua')) { st.vHold = { k, p0: h.tip.clone(), at: v.arr[n.at] }; break; } }
  h.grab = c.length || st.vHold ? { pull: null, onRelease: lbRelease } : { pull: null };
  if (c.some(e => e.t === 's')) { lbHeldMask(); lbCarry(h, c); }
}
// Peritoneum is a sheet here, and a sheet pushed toward the ridge it hangs from only gathers. Tissue is thicker than
// that: a fold of the medial flap drawn medially takes the infundibulopelvic ligament and the ovary with it. So while
// the Maryland holds peritoneum within 4 cm of that ridge, the ridge is carried the way the jaws go (PX.collide): fully
// where it is nearest the fold, less to either side over about 3 cm, and no further than the peritoneum still
// attached to it, and LB.reach, let it come.
function lbCarry(h, held) {
  const { NC, NR } = LB, hs = held.filter(e => e.t === 's' && ((e.i / NC) | 0) !== NR), st = LH[h.key]; st.carry = null; if (!hs.length) return; // (the ridge itself in the jaws is carried by them)
  _jc.set(0, 0, 0); for (const e of hs) _jc.add(PX.rest(e.i, _jm)); _jc.multiplyScalar(1 / hs.length);
  let b0 = -1, bd = 4; for (let i = LB.rg0; i <= LB.NU; i++) { const d = PX.rest(lbId(i, NR), _jn).distanceTo(_jc); if (d < bd) { bd = d; b0 = i; } } // (beyond NU the ridge is the brim, where the ligament is fixed)
  if (b0 < 0) return; const k = 1 - sstep(2.5, 4, bd), list = [];
  for (let i = LB.rg0; i <= LB.NU + 3; i++) { const w = k * Math.exp(-Math.pow((i - b0) / 9, 2)); if (w > 0.05) list.push(lbId(i, NR), w); }
  st.carry = { p0: h.tip.clone(), list };
}
function lbOpen(h) {
  const st = LH[h.key], had = st.held.length > 0;
  lbRelease(h); h.grab = null; h.openGoal = 0.7;
  if (st.in && !had) lbSpread(h);
}
// Jaws opened inside the web part it bluntly: every thread across them lets go, and a small vessel squarely between
// them tears. Opened along the ureter itself, they strip its sheath.
function lbSpread(h) {
  lbJaw(h); _jy.setFromMatrixColumn(h.grp.matrixWorld, 1).normalize(); _jc.lerpVectors(_ja, _jb, 0.4);
  const inZone = (p, k) => { _jn.copy(p).sub(_jc); const a = Math.abs(_jn.dot(_jy)); _jn.addScaledVector(_jy, -_jn.dot(_jy)); return a < 1.1 * k && _jn.length() < 0.8 * k; }; // as far as the jaws open, and a little to either side of them
  let n = 0;
  for (let q = 0; q < LS.n; q++) { const c = LS.c[q], v = LS.vasc[q]; if (!(PX.cf[c] & 1)) continue; PX.get(PX.ci[c], _jm).lerp(PX.get(PX.cj[c], _l5), 0.5); if (inZone(_jm, v ? 0.5 : 1) || (!v && (inZone(PX.get(PX.ci[c], _jm), 1) || inZone(_l5, 1)))) { lbPart(q); n++; } }
  let strip = 0; for (let q = 1; q <= LU.kx; q++) if (lbSegP(LU.i0 + q) < LU.r + JR + 0.08) { LU.strip[q] = 1; strip++; }
  if (strip && !S.lab.stripSaid) { S.lab.stripSaid = true; logEvent('tech', 'Jaws opened on the ureter itself: its sheath is stripped there. Spread in the tissue beside it.'); }
  if (n) { S.stats.blunt++; sfx.bite(); }
}
// A moving instrument under the peritoneum parts the web it meets: every thread within reach of its tip, and every
// thread that lies against the jaws behind the tip. A thread that is a small vessel stands until it is met squarely.
function lbSweep(h) {
  lbJaw(h); const x = PX.x, t = h.tip, cf = PX.cf;
  for (let q = 0; q < LS.n; q++) {
    const c = LS.c[q]; if (!(cf[c] & 1)) continue;
    const a = PX.ci[c] * 3, b = PX.cj[c] * 3, ax = x[a], ay = x[a + 1], az = x[a + 2], bx = x[b] - ax, by = x[b + 1] - ay, bz = x[b + 2] - az;
    if (Math.abs(ax - t.x) > 3 || Math.abs(ay - t.y) > 3) continue;
    const s = clamp(((t.x - ax) * bx + (t.y - ay) * by + (t.z - az) * bz) / (bx * bx + by * by + bz * bz || 1), 0, 1), d = Math.hypot(ax + bx * s - t.x, ay + by * s - t.y, az + bz * s - t.z), v = LS.vasc[q];
    if (d < (v ? 0.14 : LK.SWEEP) || lbSeg(ax + bx * 0.5, ay + by * 0.5, az + bz * 0.5) < (v ? 0.1 : LK.ALONG)) lbPart(q);
  }
}

// ---- energy ----
function lbCoag(h, dt) {
  const L = S.lab;
  S.stats.energyTime += dt; S.haze = Math.min(0.6, S.haze + dt * 0.05);
  if (Math.random() < dt * 16) emitPuff(h.tip, true);
  lbStrip(h); let on = false;
  for (let i = S.bleeders.length - 1; i >= 0; i--) { const b = S.bleeders[i]; if (b.pt(_jm).distanceTo(h.tip) < 1.0) { on = true; b.seal += dt / 1.2; if (b.seal >= 1) { S.bleeders.splice(i, 1); logEvent('info', 'Bleeding controlled'); sfx.sealDone(); } } }
  for (let i = 0; i < LB.NS; i++) if (lbInStripP(i, 0.5, 0.25) && lbAlive(i)) { const was = LB.seal[i]; LB.seal[i] = Math.min(3, was + dt / 0.22); on = true; L.paint = true; if (was < 1 && LB.seal[i] >= 1 && !L.sealSaid) { L.sealSaid = true; sfx.sealDone(); } }
  for (let q = 0; q < LS.n; q++) if (PX.cf[LS.c[q]] & 1) { const d = lbThread(q); if (!LS.vasc[q]) { if (d < 0.3) lbPart(q); } else if (!LS.sealed[q] && d < 0.47) { LS.sealed[q] = 1; on = true; } } // a small vessel in the jaws is sealed, and the web against them shrivels
  // heat reaches a little beyond the jaws. Seconds within 5 mm of the ureter are counted; within 2 mm it is burned
  let near = 9;
  for (let q = 1; q < LU.n - 1; q++) {
    const d = lbSegP(LU.i0 + q) - LU.r - JR; if (d < near) near = d; // from the surface of the jaws to the surface of the ureter
    if (d < 0.2) { LU.heat[q] += dt * (d < 0.03 ? 2.6 : 1.3); if (LU.heat[q] >= 0.45 && !(LU.state[q] & 1)) { for (let e = -1; e <= 1; e++) LU.state[clamp(q + e, 0, LU.n - 1)] |= 1; lbInjury('ureterBurn', 'Thermal injury to the right ureter'); } }
  }
  L.minU = Math.min(L.minU, Math.max(0, near)); if (near < 0.5) { L.nearSec += dt; if (!h.nearFlag) { h.nearFlag = true; S.stats.nearMiss++; logEvent('near', 'Energy within 5 mm of the ureter'); sfx.warn(); } }
  for (const k in LV) {
    const v = LV[k]; if (!v.r) continue; const n = lbSegArr(v.arr), d = n.d - v.r - JR; if (d > 0.06) continue; on = true;
    const need = k === 'ua' ? 1 : k === 'umb' ? 0.8 : k === 'oua' ? 0.6 : k === 'obn' || k === 'gfn' ? 0.5 : /^(sva|ob)/.test(k) ? 0.4 : 0.3; v.heat += dt * 1.5;
    if (v.heat >= need) lbVesselHit(k, v.arr[n.at].clone(), 'coagulated');
  }
  // the round ligament in the jaws is sealed where they hold it: about a second
  const rl = LB.rl, rn = rl.cut ? null : lbSegArr(LB.rlArr);
  if (rn && rn.d < 0.2 + JR + 0.08) { const u = rn.at / (LB.rlArr.length - 1); if (u > LB.RLU + 0.03 && u < 0.97 && sealK(rl, u) < 0.9) { on = true; if (!rl.act || Math.abs(rl.act.u - u) > 0.04) rl.act = { u, w: 0.05, p: 0 }; rl.act.p += dt / 0.9; if (rl.act.p >= 1) { rl.seals.push({ u: rl.act.u, w: 0.05 }); rl.act = null; sfx.sealDone(); } } }
  // the ovarian vessels run in the infundibulopelvic ligament
  let ip = 0; for (let i = LB.ipI0; i < LB.NC - 1; i++) if (LB.seal[lbId(i, LB.NR)] >= 1.2 || LB.seal[lbId(i, LB.NR + 1)] >= 1.6) ip++;
  if (ip >= 2) lbInjury('ipCoag', 'Infundibulopelvic ligament coagulated: the ovarian vessels are in it');
  sustain('bip', on ? 560 : 430, 'sine', on ? 0.065 : 0.05);
}
// The blade divides what the closed jaws hold. Peritoneum that was coagulated first parts dry; cut cold, its edge oozes
// a little, which is not held against the surgeon. An opening is made longer the same way: a bite at a time.
function labCut(hand) {
  const h = hand || activeHand(), L = S.lab;
  if (h.inst !== 'bipolar' || h.exch > 0) { hint('cutinst', 'The cut blade is on the advanced bipolar'); return true; }
  if (h.openGoal > 0.3) { hint('cutopen', 'Close the jaws on the tissue before firing the blade'); return true; }
  lbStrip(h, 1.75); const kill = [];
  for (let k = 0; k < LB.NQ * 2; k++) if (!LB.dead[k]) { lbTriC(k, _jm); if (lbInStrip(_jm.x, _jm.y, _jm.z, 0.17)) kill.push(k); }
  let other = false;
  // the round ligament in the closed jaws is divided, and the peritoneum on it with it
  const rl = LB.rl, rn = rl.cut ? null : lbSegArr(LB.rlArr), ru = rn ? rn.at / (LB.rlArr.length - 1) : 0;
  if (rn && rn.d < 0.2 + JR + 0.05 && ru > LB.RLU + 0.03 && ru < 0.97) {
    const dry = sealK(rl, ru) > 0.5, ic = clamp(Math.round((ru - LB.RLU) / (1 - LB.RLU) * LB.NU - 0.5), 0, LB.NU - 1); other = true;
    Object.assign(rl, { cut: true, uc: ru, dry, act: null }); L.round = { t: S.t, dry };
    for (const q of [ic - 1, ic, ic + 1]) if (q >= 0 && q < LB.NC - 1) for (const k of [q * 2, q * 2 + 1]) if (!LB.dead[k] && !kill.includes(k)) kill.push(k);
    for (let i = 1; i < LB.NU; i++) { const a = lbId(i, 0); LB.pin[a] = 0; LB.free[a] = 1; if (!LB.heldV[a]) PX.w[a] = 1; } // its two stumps, and the peritoneum on them, hang free
    logEvent('info', dry ? 'Round ligament divided' : 'Round ligament divided without coagulating it: it bleeds');
    if (!dry) { lbBleed(sampleArr(LB.rlArr, ru, new V3()), 40, true, 'round ligament', 30, 'The round ligament has stopped bleeding'); sfx.warn(); }
  }
  for (let q = 0; q < LS.n; q++) if ((PX.cf[LS.c[q]] & 1) && lbThread(q) < 0.25) { lbPart(q); other = true; }
  for (let q = 1; q <= LU.kx; q++) if (lbSegP(LU.i0 + q) < LU.r + JR + 0.08 && L.cutU < 0) { L.cutU = q; LU.state[q] |= 4; other = true; lbInjury('ureterCut', 'The right ureter was divided by the blade'); for (let c = 0; c < PX.m; c++) if ((PX.ci[c] === LU.i0 + q && PX.cj[c] >= LU.i0 && PX.cj[c] < LU.i0 + LU.n) || (PX.cj[c] === LU.i0 + q && PX.ci[c] >= LU.i0 && PX.ci[c] < LU.i0 + LU.n)) PX.cf[c] = 0; }
  for (const k in LV) { const v = LV[k]; if (!v.r) continue; const n = lbSegArr(v.arr); if (n.d < v.r + JR) { lbVesselHit(k, v.arr[n.at].clone(), 'divided by the blade'); other = true; } }
  if (!kill.length && !other) { hint('cutnone', 'Nothing in the jaws to divide here'); return true; }
  sfx.cut(); h.open = 0;
  if (kill.length) {
    let s = 0, n = 0, lift = 0, ipq = 0, qs = 0; const cen = new V3();
    for (const q of kill) {
      const i = (q >> 1) % (LB.NC - 1), j = ((q >> 1) / (LB.NC - 1)) | 0;
      qs = 0; for (const a of lbTri(q)) { qs += Math.min(1, LB.seal[a]) / 3; n++; PX.get(a, _jm); PX.rest(a, _jn); lift = Math.max(lift, -_jm.sub(_jn).dot(lbNin(a, _l5))); cen.add(_jn); }
      if (qs >= 0.5) s++;
      if ((j === LB.NR - 1 || j === LB.NR) && i >= LB.ipI0) ipq++;
      LB.dead[q] = 1;
    }
    cen.multiplyScalar(1 / n); lbReindex(); L.cuts += kill.length;
    const sealed = s / kill.length >= 0.75, c0 = lbTriC(kill[0], new V3());
    if (!sealed) { S.stats.unsealedCuts++; lbBleed(c0, 6, false, 'peritoneal edge', 20, 'The edge has stopped oozing'); if (!L.coldSaid) { L.coldSaid = true; logEvent('info', 'Peritoneum cut cold: its edge oozes a little'); } }
    if (ipq) { if (lbInjury('ipCut', 'Infundibulopelvic ligament divided: the ovarian vessels are in it') && !sealed) lbBleed(c0, 90, true, 'ovarian vessels'); }
    if (!L.entry) { // the first opening: where it is, and whether the peritoneum was lifted off what lies under it
      const k0 = kill[kill.length >> 1] >> 1, w = ((k0 / (LB.NC - 1)) | 0) / LB.NR, u = lbU(k0 % (LB.NC - 1), (k0 / (LB.NC - 1)) | 0);
      const dIli = Math.min(nearestOnArr(LV.eia.arr, cen).d, nearestOnArr(LV.eiv.arr, cen).d), dIP = nearestOnArr(LB.ipRest, cen).d;
      const zone = ipq || (w > 0.93 && w < 1.08 && u >= LB.IPU) ? 'ip' : w >= 1.08 ? 'medial' : dIli < 1.25 ? 'iliac' : w < 0.1 ? 'round' : u < 0.58 ? 'adnexa' : 'triangle';
      L.entry = { t: S.t, zone, tented: lift >= 0.45, lift, sealed, dIli, dIP, at: cen.clone() };
      logEvent('info', 'Retroperitoneum opened');
    }
  }
  uiDirty(); return true;
}

// ---- the mouse button and the jaws ----
function labClick(h) {
  const st = LH[h.key];
  if (h.inst === 'suction') { h.firing = true; return true; }
  if (h.inst === 'maryland') { if (h.openGoal < 0.3) lbOpen(h); else lbClose(h); sfx.click(); return true; }
  if (h.inst === 'bipolar') { st.t0 = S.t; st.wasOpen = h.openGoal > 0.3; st.down = true; h.nearFlag = false; if (st.wasOpen) { lbClose(h); sfx.click(); } }
  return true;
}
function labSuction(h, dt) { for (const w of LB.wells) if (w.v > 0 && h.tip.distanceTo(w.p) < 0.62 * Math.cbrt(w.v) + 0.7) w.v = Math.max(0, w.v - 5 * dt); }

// ---- every frame: the tissue ----
function lbCollide() { // instrument tips push the ureter aside, and under the peritoneum lift it from beneath and push the web before them
  const x = PX.x, w = PX.w, u0 = LU.i0, n0 = LW.i0, n1 = LW.i0 + LW.n, NS = LB.NS, mob = LB.mob, r0 = LB.r0;
  for (const h of HANDS) {
    const st = LH[h.key];
    for (let s = 0; s < st.ns; s++) {
      const c = st.sph[s], cx = c.x, cy = c.y, cz = c.z, R = c.w;
      const push = (a, rr) => { const k = a * 3, dx = x[k] - cx, dy = x[k + 1] - cy, dz = x[k + 2] - cz, d2 = dx * dx + dy * dy + dz * dz; if (d2 >= rr * rr || d2 < 1e-8) return; const d = Math.sqrt(d2), m = (rr - d) / d; x[k] += dx * m; x[k + 1] += dy * m; x[k + 2] += dz * m; };
      for (let q = 1; q <= LU.kx; q++) if (w[u0 + q] > 0) push(u0 + q, R + LU.r);
      if (st.in) { for (let i = 0; i < LB.NS; i++) if (w[i] > 0) push(i, R); for (let i = n0; i < n1; i++) if (w[i] > 0) push(i, R); }
    }
    // The edge of an opening does not tear when a shaft is pushed against it: it is stretched aside round the shaft
    for (let e = 0; e < st.ne; e++) {
      const E = st.edge[e], px = E.p.x, py = E.p.y, pz = E.p.z, dx = E.d.x, dy = E.d.y, dz = E.d.z, ax = h.dir.x, ay = h.dir.y, az = h.dir.z;
      for (let i = 0; i < NS; i++) if (mob[i] && w[i] > 0) {
        const k = i * 3; let vx = x[k] - px, vy = x[k + 1] - py, vz = x[k + 2] - pz; const a = vx * ax + vy * ay + vz * az; if (a > 1 || a < -1) continue; vx -= a * ax; vy -= a * ay; vz -= a * az;
        const s = vx * dx + vy * dy + vz * dz, l2 = vx * vx + vy * vy + vz * vz - s * s; if (l2 > 1.2 || s < -E.len - 0.1) continue; // (not the far edge of the opening)
        const need = 0.34 * Math.exp(-l2 / 0.3) - s; if (need > 0) { x[k] += dx * need * 0.5; x[k + 1] += dy * need * 0.5; x[k + 2] += dz * need * 0.5; }
      }
    }
  }
}
PX.collide = () => {
  lbCollide();
  const x = PX.x, r0 = LB.r0, NR = LB.NR;
  // the adnexa go with a fold of peritoneum held beside them (lbCarry)
  for (const h of HANDS) { const cy = LH[h.key].carry; if (!cy) continue; const dx = h.tip.x - cy.p0.x, dy = h.tip.y - cy.p0.y, dz = h.tip.z - cy.p0.z, l = cy.list; for (let e = 0; e < l.length; e += 2) { const k = l[e] * 3, w = l[e + 1]; if (PX.w[l[e]] === 0) continue; x[k] += (r0[k] + dx * w - x[k]) * 0.25; x[k + 1] += (r0[k + 1] + dy * w - x[k + 1]) * 0.25; x[k + 2] += (r0[k + 2] + dz * w - x[k + 2]) * 0.25; } }
  // and come only so far from where they lie (LB.reach)
  for (let i = LB.rg0; i < LB.NC - 1; i++) { const k = lbId(i, NR) * 3, dx = x[k] - r0[k], dy = x[k + 1] - r0[k + 1], dz = x[k + 2] - r0[k + 2], d2 = dx * dx + dy * dy + dz * dz, m = LB.reach[i]; if (d2 > m * m && PX.w[k / 3] > 0) { const s = m / Math.sqrt(d2); x[k] = r0[k] + dx * s; x[k + 1] = r0[k + 1] + dy * s; x[k + 2] = r0[k + 2] + dz * s; } }
};
const _lr = new THREE.Raycaster();
function lbHands() {
  for (const h of HANDS) {
    const st = LH[h.key];
    // under the peritoneum? The tip is, once it has gone in through a place that was cut, until it comes back out
    _lr.set(h.port, h.dir); _lr.far = Math.max(0.1, h.ins - 0.03); const hits = _lr.intersectObject(LB.full, false);
    // Pushed against the edge of an opening, a shaft does not tear it. Within two triangles of the opening the edge gives,
    // stretched aside round the shaft (lbCollide); further than that from it the peritoneum stops the instrument.
    st.ne = 0;
    for (const x of hits) if (!LB.dead[x.faceIndex] && LB.near[x.faceIndex] && st.ne < 2) {
      let bd = 4; for (let k = 0; k < LB.NQ * 2; k++) if (LB.dead[k]) { const d = lbTriC(k, _jm).distanceToSquared(x.point); if (d < bd) { bd = d; _jc.copy(_jm); } }
      if (bd >= 4) continue;
      const e = st.edge[st.ne++]; e.p.copy(x.point); e.d.copy(x.point).sub(_jc); e.d.addScaledVector(h.dir, -e.d.dot(h.dir)); e.len = e.d.length(); e.d.normalize(); // len: how far the shaft is from the opening
    }
    if (!hits.length) st.in = false; else if (!st.in) st.in = hits.some(x => LB.dead[x.faceIndex] || LB.near[x.faceIndex]);
    // the tip, and the jaws behind it, as balls
    const back = _jn.copy(h.port).sub(h.tip).normalize(), jl = LK.JAW[h.inst] || 1.6, op = h.open * 0.42;
    st.sph[0].set(h.tip.x, h.tip.y, h.tip.z, 0.26); st.ns = 1;
    if (h.exch <= 0 && h.inst !== 'suction') {
      _jy.setFromMatrixColumn(h.grp.matrixWorld, 1).normalize();
      for (const s of [1, -1]) { const k = s * Math.sin(op) * jl * 0.6; st.sph[st.ns++].set(h.tip.x + back.x * jl * 0.55 + _jy.x * k, h.tip.y + back.y * jl * 0.55 + _jy.y * k, h.tip.z + back.z * jl * 0.55 + _jy.z * k, 0.22); }
    }
    for (const e of st.held) { const k = e.i * 3; PX.x[k] = h.tip.x + e.off.x; PX.x[k + 1] = h.tip.y + e.off.y; PX.x[k + 2] = h.tip.z + e.off.z; }
  }
}
function labUpdate(dt, time) {
  // the uterus stays where it is held, and the parts of the simulator's own right side that the lab replaces are not drawn
  S.poseGoal.yaw = S.pose.yaw = LB.POSE.yaw; S.poseGoal.pitch = S.pose.pitch = LB.POSE.pitch; S.poseGoal.push = S.pose.push = 0;
  const sd = AN.side.R; for (const m of [sd.st.roofL, sd.st.postL, sd.st.areolar, sd.t.ip, URETER.R.tube]) m.mesh.visible = false;
  for (const h of HANDS) if (h.inst === 'grasper' && h.exch <= 0) { h.sub.grasper.g.visible = false; h.inst = 'maryland'; h.sub.maryland.g.visible = true; }
  DEPTH.auto = false; S.guided = false;
  for (const m of [sd.t.roundA, sd.t.roundB]) m.mesh.visible = false; // the lab draws its own round ligament
  LB.rl.gk = damp(LB.rl.gk, LB.rl.cut ? 1 : 0, 7, dt);
  lbAdnexa();
  // The scope goes in further here than in the simulator: at the simulator's limit, + carries on and - comes back
  if (LB.keys.in && CAM.userIns >= 5.99) LB.zoom = Math.min(LK.ZOOM, LB.zoom + 6 * dt); if (LB.keys.out && LB.zoom > 0) { LB.zoom = Math.max(0, LB.zoom - 6 * dt); CAM.userIns = 6; }
  CAM.insGoal = CAM.goal.distanceTo(CAM.pivot) - LAB_STEPS[0].dist + LB.zoom;
  lbHands();
  lbBeat(time);
  PX.step(clamp(dt, 0.004, 0.034));
  if (S.lab && S.lab.paint) { S.lab.paint = false; lbPaint(); }
  lbDraw(time);
}
// ---- every frame while the dissection is running: what the instruments are doing ----
function labTick(dt) {
  const L = S.lab;
  for (const h of HANDS) {
    const st = LH[h.key];
    if (st.down) { // the bipolar's button: let go early and it was a click, held and it is the energy
      if (!INP.down || ACTIVE !== h.key || h.inst !== 'bipolar' || h.exch > 0) {
        st.down = false;
        if (st.coag) { st.coag = false; stopSustain(); } else if (!st.wasOpen) { lbOpen(h); sfx.click(); }
      } else if (!st.coag && S.t - st.t0 >= LK.HOLD) { st.coag = true; S.stats.activations++; if (h.openGoal > 0.3) lbClose(h); }
      if (st.coag) lbCoag(h, dt);
    }
    if (h.inst !== 'maryland' && h.inst !== 'bipolar' && st.held.length) lbRelease(h);
    // the peritoneum pulls out of the jaws before it stretches to SLIP times its length
    if (st.kind === 'peritoneum') for (const e of st.held) if (e.t === 's') { const c = LB.eh[e.i], d = LB.ev[e.i]; if ((c >= 0 && (PX.cf[c] & 1) && PX.dist(PX.ci[c], PX.cj[c]) > LK.SLIP * PX.cl[c]) || (d >= 0 && (PX.cf[d] & 1) && PX.dist(PX.ci[d], PX.cj[d]) > LK.SLIP * PX.cl[d])) { lbOpen(h); L.slips++; logEvent('tech', 'The peritoneum was pulled out of the jaws'); break; } }
    if (st.kind === 'peritoneum') for (const e of st.held) if (e.t === 's' && LB.ridge[e.i] && PX.get(e.i, _jm).distanceTo(PX.rest(e.i, _jn)) > LB.reach[e.i % LB.NC] + 0.3) { lbOpen(h); L.slips++; logEvent('tech', 'The ligament was pulled out of the jaws: the adnexa come no further'); break; }
    if (st.vHold && st.vHold.p0.distanceTo(h.tip) > 0.8) { const v = st.vHold; lbOpen(h); lbVesselHit(v.k, v.at.clone(), 'torn by traction'); }
    if (st.in && st.last.distanceTo(h.tip) > 0.012) lbSweep(h);
    st.last.copy(h.tip);
    if (st.in) { L.inT += dt; for (const s of LR.list) if (!s.seen && s.at(_jm).distanceTo(h.tip) < 1.15) s.seen = true; for (const key in LB.sp) { const A = LB.sp[key], seen = L.spSeen[key]; for (let k = 0; k < A.length; k++) if (!seen[k] && A[k].mid.distanceTo(h.tip) < 0.9) seen[k] = 1; } }
  }
  // what stretched until it broke in the last step: threads of the web, and what holds the ureter to its leaf
  for (const c of PX.broke) {
    const s = LS.byC.get(c); if (s != null) { PX.cf[c] |= 1; lbPart(s); continue; }
    if (LU.attC.has(c)) { L.offLeaf++; if (L.offLeaf >= 4) lbInjury('ureterOff', 'The ureter was pulled off the peritoneum that carries its blood supply'); }
  }
  for (const k in LV) LV[k].heat = Math.max(0, LV[k].heat - dt * 0.25);
  for (let q = 0; q < LU.n; q++) LU.heat[q] = Math.max(0, LU.heat[q] - dt * 0.15);
  // blood wells up where it is lost under the peritoneum
  for (const b of S.bleeders) if (b.lab) { b.pt(_jm); let w = LB.wells.find(w => w.v > 0 && w.p.distanceTo(_jm) < 1.4) || LB.wells.find(w => w.v <= 0); if (!w) continue; if (w.v <= 0) { w.p.copy(_jm); w.p.y -= 0.15; w.v = 0.01; } w.v = Math.min(14, w.v + (b.rate * dt / 60) * 0.7); }
  S.pool = 0; // what is lost here wells up where it is lost; none runs to the cul-de-sac
  if ((L.mT -= dt) <= 0) { L.mT = 0.25; lbMetrics(); uiDirty(); }
}

// ---- what has been uncovered ----
// A place on a structure counts as uncovered once an instrument has worked beside it under the peritoneum, most of
// the web that lay on it has been swept off, and no blood stands over it.
const LR = { list: [], by: {} };
(function () {
  const add = (key, at, rad, face) => { const s = { key, at, rad, face, seen: false, rev: false }; LR.list.push(s); (LR.by[key] = LR.by[key] || []).push(s); };
  // The side of each place that the dissection works on. The ureter is left on its leaf, which brings its blood supply, and is uncovered on its other side; a vessel on the wall is uncovered on its side toward the pelvis
  for (let q = 1; q <= LU.kx; q++) {
    const p = PX.rest(LU.i0 + q, new V3()); let b = -1, bd = 0.75; for (let i = 0; i < LB.NS; i++) { const d = PX.rest(i, _jm).distanceTo(p); if (d < bd) { bd = d; b = i; } }
    add('ureter', o => PX.get(LU.i0 + q, o), LU.r + 0.05, b < 0 ? null : lbNin(b, new V3()));
  }
  for (const k of ['ua', 'iia', 'iiaA', 'iiaP', 'iiv', 'umb', 'sva1', 'sva2', 'oua', 'oba', 'obv', 'obn', 'gfn', 'eia', 'eiv']) { const v = LV[k]; for (let i = 0; i < v.arr.length; i++) { const p = v.arr[i]; if (p.z < BRIM - 0.8 && p.z > -5.3) add(k, o => o.copy(p), v.r + 0.08, new V3(-p.x, BOWL_YC - p.y, 0).normalize()); } }
  LS.byC = new Map(); for (let q = 0; q < LS.n; q++) LS.byC.set(LS.c[q], q);
  LU.attC = new Set(LU.att.map(a => a.c));
  LB.ipRest = []; for (let i = LB.ipI0; i < LB.NC; i++) LB.ipRest.push(PX.rest(lbId(i, LB.NR), new V3()));
  // the threads of the web that lie on each place
  const M = LS.mid; for (const s of LR.list) { const p = s.at(new V3()), f = s.face, c = []; for (let q = 0; q < LS.n; q++) { const dx = M[q * 3] - p.x, dy = M[q * 3 + 1] - p.y, dz = M[q * 3 + 2] - p.z; if (Math.hypot(dx, dy, dz) < s.rad + 0.35 && (!f || dx * f.x + dy * f.y + dz * f.z > -0.05)) c.push(q); } s.cov = c; }
  // how far it is from one place to the next along each space (LB.sp): along the ureter, and along the obliterated umbilical artery
  let len = 0; const A = LV.oua.arr; for (let i = 1; i < A.length; i++) len += A[i].distanceTo(A[i - 1]);
  LB.spDs = { prL: LU.ds, pvL: len / (A.length - 1), pvM: len / (A.length - 1) };
})();
// the longest stretch of a row of places that all pass, counting through a gap of up to `bridge` places that do not
const lbRun = (ok, n, bridge) => { let best = 0, cur = 0, gap = 0, end = -1, bEnd = -1; for (let q = 0; q < n; q++) { if (ok(q)) { cur += 1 + gap; gap = 0; end = q; if (cur > best) { best = cur; bEnd = end; } } else if (cur && gap < bridge) gap++; else { cur = 0; gap = 0; } } return { n: best, end: bEnd }; };
function lbMetrics() {
  const L = S.lab, left = a => { let n = 0; for (let e = 0; e < a.length; e++) if (PX.cf[LS.c[a[e]]] & 1) n++; return n; }; // how many of a list of threads have not been parted
  for (const s of LR.list) {
    s.rev = false; if (!s.seen || !L.entry) continue;
    let cov = left(s.cov) > 0.4 * s.cov.length; s.at(_jm);
    for (const w of LB.wells) if (w.v > 0.3 && w.p.distanceTo(_jm) < 0.62 * Math.cbrt(w.v)) cov = true;
    s.rev = !cov;
  }
  const U = LR.by.ureter, run = lbRun(q => U[q].rev, U.length, 2), G = L.goal; // a tag of web left on it, under a centimetre, does not break the run
  G.ureterCm = run.n * LU.ds; G.toUA = run.n > 0 && run.end >= U.length - 3; G.ua = LR.by.ua.slice(0, 7).filter(s => s.rev).length >= 3;
  G.found = {}; for (const k in LR.by) { const a = LR.by[k], n = a.filter(s => s.rev).length; G.found[k] = n >= Math.max(3, a.length * 0.2); }
  G.found.ureter = G.ureterCm >= 1.5; G.found.ua = G.ua; G.found.sva = G.found.sva1 || G.found.sva2; delete G.found.sva1; delete G.found.sva2;
  // the spaces: how far along each the web that lay across it has been swept out. A place counts once an instrument has
  // worked in it and three quarters of the threads across it are parted
  for (const key in LB.sp) { const A = LB.sp[key], seen = L.spSeen[key]; G.sp[key] = lbRun(k => !!seen[k] && left(A[k].thr) <= 0.25 * A[k].thr.length, A.length, 1).n * LB.spDs[key]; }
  G.prCm = G.sp.prL; G.pr = G.prCm >= 2; G.pvL = G.sp.pvL >= 1.5; G.pvM = G.sp.pvM >= 1.5;
  G.entry = !!L.entry && (L.entry.zone === 'triangle' || L.entry.zone === 'round') && !['ureterBurn', 'ureterCut', 'ureterCrush', 'ipCoag', 'ipCut', 'eia', 'eiv', 'iia', 'iiv'].some(k => S.injuries[k] && S.injuries[k].t <= L.entry.t + 20);
  G.ureter = G.ureterCm >= 6 && G.toUA && G.ua;
  let str = 0; for (let q = 1; q < LU.n; q++) if (LU.strip[q] >= 1) str++; G.stripCm = str * LU.ds;
  // how long the opening is
  let far = 0; const pts = [];
  for (let q = 0; q < LB.NQ; q++) if (LB.dead[q * 2] || LB.dead[q * 2 + 1]) { const i = q % (LB.NC - 1), j = (q / (LB.NC - 1)) | 0; pts.push(PX.rest(lbId(i, j), new V3())); }
  for (let i = 0; i < pts.length; i += 1) for (let j = i + 1; j < pts.length; j += 1) far = Math.max(far, pts[i].distanceTo(pts[j]));
  G.openCm = pts.length ? far + 0.36 : 0;
}
const LNAME = { ureter: 'ureter', ua: 'uterine artery', iia: 'internal iliac artery', iiaA: 'its anterior division', iiaP: 'its posterior division', iiv: 'internal iliac vein', umb: 'umbilical artery', sva: 'superior vesical arteries', oua: 'obliterated umbilical artery', oba: 'obturator artery', obv: 'obturator vein', obn: 'obturator nerve', gfn: 'genitofemoral nerve', eia: 'external iliac artery', eiv: 'external iliac vein' };
const SPACE = { prL: 'Lateral pararectal space', pvL: 'Lateral paravesical space', pvM: 'Medial paravesical space' };
const ZONE = { triangle: 'Lateral to the IP ligament', ip: 'On the IP ligament', medial: 'Medial to the IP ligament', iliac: 'Over the external iliac vessels', round: 'At the round ligament', adnexa: 'Beside the adnexa, not at the sidewall' };

// ---- score ----
function labScore() {
  lbMetrics();
  const L = S.lab, G = L.goal, E = L.entry, I = S.injuries, notes = []; let pts = 100;
  const ded = (n, t) => { pts -= n; notes.push(t + ' (&minus;' + n + ')'); };
  if (!E) ded(30, 'The retroperitoneum was not opened');
  else {
    if (E.zone !== 'triangle' && E.zone !== 'round') ded(12, 'Entry: ' + ZONE[E.zone].toLowerCase());
    if (!E.tented) ded(6, 'First bite taken with the peritoneum lying on what is under it, not tented');
  }
  if (L.round && !L.round.dry) ded(3, 'Round ligament divided without coagulating it');
  for (const [k, n, t] of [['ureterCut', 40, 'Ureter divided'], ['ureterBurn', 30, 'Thermal injury to the ureter'], ['ureterCrush', 12, 'Ureter grasped: crush injury'], ['ureterOff', 12, 'Ureter pulled off the leaf that carries its blood supply'],
    ['ipCut', 20, 'IP ligament divided'], ['ipCoag', 15, 'IP ligament coagulated'], ['eia', 35, 'External iliac artery injured'], ['eiv', 35, 'External iliac vein injured'], ['iia', 35, 'Internal iliac artery injured'], ['iiv', 35, 'Internal iliac vein injured'],
    ['uaCut', 15, 'Uterine artery divided'], ['uaCoag', 8, 'Uterine artery coagulated'], ['umb', 12, 'Umbilical artery injured'], ['sva', 5, 'Superior vesical artery injured'], ['oba', 12, 'Obturator artery injured'], ['obv', 12, 'Obturator vein injured'], ['oua', 5, 'Obliterated umbilical artery divided'], ['obn', 12, 'Obturator nerve injured'], ['gfn', 6, 'Genitofemoral nerve injured']]) if (I[k] && !(k === 'uaCoag' && I.uaCut) && !(k === 'ipCoag' && I.ipCut)) ded(n, t);
  if (G.stripCm >= 1) ded(G.stripCm >= 2.5 ? 10 : 5, 'Ureteric sheath stripped over ' + G.stripCm.toFixed(1) + ' cm');
  if (L.nearSec >= 2 && !I.ureterBurn) ded(4, 'Energy within 5 mm of the ureter for ' + L.nearSec.toFixed(1) + ' s');
  if (S.ebl > 150) ded(10, 'Blood loss over 150 mL'); else if (S.ebl > 50) ded(5, 'Blood loss over 50 mL');
  if (L.slips >= 2) ded(2, 'Peritoneum pulled out of the jaws ' + L.slips + ' times');
  if (E && !G.ureter) ded(15, G.ureterCm < 1.5 ? 'The ureter was not uncovered' : !G.toUA ? 'The ureter was not followed to the uterine artery' : !G.ua ? 'The uterine artery was not uncovered where it crosses the ureter' : 'Less than 6 cm of ureter uncovered');
  pts = Math.max(0, Math.round(pts));
  return { pts, notes, grade: pts >= 90 ? 'A clean dissection' : pts >= 75 ? 'Sound, with points to tighten' : pts >= 50 ? 'Unsafe in places' : 'Not safe as performed' };
}
function labDebrief(row) {
  const L = S.lab, G = L.goal, E = L.entry, I = S.injuries, yn = (b, y, n) => (b ? y || 'Yes' : n || 'No');
  const found = Object.keys(LNAME).filter(k => G.found[k]).map(k => LNAME[k]);
  const goals = row('1. Retroperitoneum entered in the right place, nothing injured', yn(G.entry, 'Reached', 'Not reached'), G.entry ? '' : 'warn') + row('2. Ureter followed to the uterine artery, and the artery uncovered', yn(G.ureter, 'Reached', 'Not reached') + ': ' + G.ureterCm.toFixed(1) + ' of ' + (LR.by.ureter.length * LU.ds).toFixed(0) + ' cm of ureter', G.ureter ? '' : 'warn') +
    ['prL', 'pvL', 'pvM'].map(k => row(SPACE[k] + ' (not required)', G.sp[k] >= 0.3 ? 'Developed over ' + G.sp[k].toFixed(1) + ' cm' : 'Not developed')).join('') + row('Uncovered', found.length ? found.join(', ') : 'nothing');
  const g = $('dbGoals'); if (g && goals.charAt(0) === '<') g.innerHTML = goals; // on the page; not when the debrief is being written out as plain text
  const ves = ['eia', 'eiv', 'iia', 'iiv', 'uaCut', 'uaCoag', 'umb', 'sva', 'oba', 'obv', 'oua'].filter(k => I[k]).length, ur = ['ureterCut', 'ureterBurn', 'ureterCrush', 'ureterOff'].filter(k => I[k]);
  const safety = row('Ureter', ur.length ? ur.map(k => ({ ureterCut: 'divided', ureterBurn: 'thermal injury', ureterCrush: 'crushed', ureterOff: 'pulled off its leaf' })[k]).join(', ') : 'Intact', ur.length ? 'bad' : '') +
    row('Ureteric sheath', G.stripCm >= 0.3 ? 'Stripped over ' + G.stripCm.toFixed(1) + ' cm' : 'Preserved', G.stripCm >= 1 ? 'warn' : '') +
    row('Energy within 5 mm of the ureter', L.nearSec.toFixed(1) + ' s' + (L.minU < 9 ? ' (closest ' + (L.minU * 10).toFixed(0) + ' mm)' : ''), L.nearSec >= 2 ? 'warn' : '') +
    row('IP ligament', I.ipCut ? 'Divided' : I.ipCoag ? 'Coagulated' : 'Intact', I.ipCut || I.ipCoag ? 'bad' : '') +
    row('Vessel injuries', ves, ves ? 'bad' : '') + row('Nerve injuries', (I.obn ? 1 : 0) + (I.gfn ? 1 : 0), I.obn || I.gfn ? 'bad' : '') + row('Small vessels cut uncoagulated', L.smallBleeds, L.smallBleeds > 6 ? 'warn' : '');
  const tech = row('Opened', E ? ZONE[E.zone] : 'Not opened', E && (E.zone === 'triangle' || E.zone === 'round') ? '' : 'warn') +
    row('First bite tented', E ? yn(E.tented, 'Yes, ' + (E.lift * 10).toFixed(0) + ' mm', 'No') : 'n/a', E && !E.tented ? 'warn' : '') +
    row('Length of the opening', E ? G.openCm.toFixed(1) + ' cm' : 'n/a') +
    row('Bites of peritoneum cut cold', S.stats.unsealedCuts) + row('Round ligament', L.round ? (L.round.dry ? 'Divided, coagulated first' : 'Divided without coagulating it') : 'Not divided', L.round && !L.round.dry ? 'warn' : '') + row('Blunt spreads', S.stats.blunt) +
    row('Peritoneum lost from the jaws', L.slips, L.slips >= 2 ? 'warn' : '') + row('Time under the peritoneum', fmtT(L.inT));
  return [safety, tech];
}

// ---- the case ----
const LAB_STEPS = [{
  id: 'free', phase: 'Free play', short: 'Free dissection', title: 'Right retroperitoneal ureter dissection', tool: 'any', pearl: '',
  text: ['Open the retroperitoneum and find the ureter.', 'Follow it down the sidewall to where it passes under the uterine artery, and uncover the artery.', 'Nothing is asked for in any order and nothing will prompt you. Whatever lies under the peritoneum can be found, and can be injured.'],
  focus: w => w.set(4.9, -1.0, 3.2), dist: 13.5, done: () => false, frac: () => 0, next: () => null,
  button: { label: 'End the dissection', fn: () => endCase() }, click: labClick, cut: labCut, tick: labTick,
  force() { endCase(); }
}];
const LAB = {
  id: 'lab', name: 'Retroperitoneal ureter dissection', tag: ', right side, free play', blurb: 'Free play on tissue that moves.',
  sub: 'Right pelvic sidewall. Normal anatomy.',
  brief: ['A woman with normal pelvic anatomy: no endometriosis and no adhesions. The uterus is held to her left on its manipulator, which puts the right sidewall on stretch. 10 mm umbilical scope and two 5 mm lateral ports, as for the hysterectomy. You are looking at her right sidewall: the round ligament above, the infundibulopelvic ligament running back to the pelvic brim, and the external iliac vessels under the peritoneum beside it.',
    'Open the retroperitoneum, find the ureter, and follow it down to where it passes under the uterine artery. Carry the opening toward the round ligament a bite at a time, coagulated first or cut cold: the peritoneum stretches round an instrument but does not tear. Hold the medial edge of the opening in the Maryland and draw it medially, and the ovary and its ligament come with it. The round ligament can be coagulated and divided to open the space further. Under the peritoneum there is loose areolar tissue and no fat: an instrument swept through it, or jaws opened in it, part it. The Maryland starts in your left hand and the advanced bipolar in your right. The suction is on the tray for blood that wells up.'],
  steps: LAB_STEPS, insts: ['maryland', 'bipolar', 'suction'], warp: [0, 0], tipZ: 7.5, ureters: false, eblWarn: 50, needleHint: '',
  // A structure is named once it has been uncovered. The ureter lies on the far side of the medial leaf from the scope, so
  // its name is put on the leaf over it, where it can be seen through the peritoneum
  labels: [], // the lab names things itself (08-lab.js)
  state(s) {
    lbResetModel();
    for (const k of ['L', 'R']) Object.assign(LH[k], { in: false, held: [], kind: '', down: false, coag: false, vHold: null, carry: null, ne: 0 });
    for (const r of LR.list) { r.seen = false; r.rev = false; }
    s.guided = false;
    s.lab = { entry: null, round: null, cuts: 0, slips: 0, smallBleeds: 0, nearSec: 0, minU: 9, cutU: -1, crush: false, offLeaf: 0, uaSealed: false, inT: 0, mT: 0, paint: true, spSeen: { prL: new Uint8Array(LB.sp.prL.length), pvL: new Uint8Array(LB.sp.pvL.length), pvM: new Uint8Array(LB.sp.pvM.length) },
      goal: { entry: false, ureter: false, pr: false, pvL: false, pvM: false, ua: false, toUA: false, ureterCm: 0, prCm: 0, stripCm: 0, openCm: 0, found: {}, sp: { prL: 0, pvL: 0, pvM: 0 } } };
    LB.zoom = 0;
  },
  show() {}, update: labUpdate, suction: labSuction, score: labScore, debrief: labDebrief, sutures: () => ({ st: [], from: null, on: false }), force() {}
};
CASES.tlh = LAB; // the lab's page has this one case
