// ---------- case: laparoscopic sacrocolpopexy ----------
// Starts where the supracervical hysterectomy ends: the cervix is kept and a probe in the vagina moves the vault.
// Adds the sacral promontory with the vessels that make it dangerous, a sigmoid that has to be moved off it, the
// peritoneal incision from the promontory to the cul-de-sac, and a Y-shaped mesh from the vagina and cervix to the sacrum.
const SC = {
  T1: 0.27, // how far along the incision the window over the promontory reaches
  SIG: [0, 0, 0, 0.45, 1, 1, 0.5], // how far each point of the sigmoid's course lies over the midline before it is moved
  MARK: { P: [[-15, -2.1], [15, -2.1], [0, 0.9]], A: [[210, -1.7], [150, -1.7], [180, 0.9]] }, // sutures on each leaf: degrees round the vagina (0: posterior), cm above the fornix
  SAC: [0.15, 0.215], END: 0.055, DISC: 8.05, MSX: 0.3, // where on the incision the sacral sutures go and the arm ends; the disc lies cephalad of DISC; the middle sacral vessels run at x = MSX
  PER: [0.1, 0.36, 0.62, 0.88], SHUT: [0.24, 0.5, 0.76, 1], // the peritoneal closure: where each bite goes, and how far it closes the incision
  xz: vecArr(41), armA: vecArr(44), armN: vecArr(44), armT: new Float32Array(44), rkey: ''
};
HAZ.civ = { th: 0.25, text: () => 'Major vascular injury: left common iliac vein' };
PRESERVE.civ = PRESERVE.msv = 1;
const _s1 = new V3(), _s2 = new V3(), _s3 = new V3(), _s4 = new V3();
// how far the promontory, and the spine above it, stand out of the posterior wall
const scH = (x, z) => 1.3 * Math.exp(-Math.pow((x - 0.3) / 2.6, 2)) * sstep(5.0, 8.6, z) * (1 - 0.2 * sstep(8.6, 10, z)) * (1 - sstep(12.5, 16.5, z));
function scFloor(x, z, lift, out) { // a point on the posterior wall, promontory included, raised by lift
  const cs = clamp(x / bowlR(z, 0)[0], -0.98, 0.98);
  return bowlPoint(cs, -Math.sqrt(1 - cs * cs), z, scH(x, z) + 0.06 + (lift || 0), out);
}
// On the peritoneal incision: t along it from the promontory (0) to the cul-de-sac (1), a across it in cm (+: the patient's right).
function scPath(t, a, lift, out) {
  sampleArr(SC.xz, t, _s1); sampleArr(SC.xz, Math.min(1, t + 0.02), _s2).sub(sampleArr(SC.xz, Math.max(0, t - 0.02), _s3)).normalize();
  return scFloor(_s1.x - _s2.z * a, _s1.z + _s2.x * a, lift, out);
}
function scOnPath(p) { // where a point lies against the incision: { t, a }
  let bi = 0, bd = 1e9; for (let i = 0; i < 41; i++) { const q = SC.xz[i], d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z); if (d < bd) { bd = d; bi = i; } }
  const t = bi / 40; sampleArr(SC.xz, t, _s1); sampleArr(SC.xz, Math.min(1, t + 0.02), _s2).sub(sampleArr(SC.xz, Math.max(0, t - 0.02), _s3)).normalize();
  return { t, a: -(p.x - _s1.x) * _s2.z + (p.z - _s1.z) * _s2.x };
}
// the outside of the cervix (y > 0) and of the vagina below it, in the vagina's own frame and in the world
function scWallL(phiDeg, y, lift, out) { if (y >= 0) return utSurf(phiDeg, Math.min(y, LS.YA), lift, out); const ph = phiDeg * DEG, r = 1.86 + lift; return out.set(r * Math.sin(ph), y, r * Math.cos(ph) * 0.94); }
const scWall = (phiDeg, y, lift, out) => scWallL(phiDeg, y, lift, out).applyMatrix4(VG.M);
// A leaf of the mesh: a across it, v from its far end on the vaginal wall up the cervix and over the edge of the stump onto its cut face. c0: 0 the posterior leaf, 180 the anterior.
function scLeaf(c0, a, v, out) {
  const ph = c0 ? 180 - lerp(-48, 48, a) : lerp(-28, 28, a), k = clamp(v / 0.82, 0, 1); // the posterior leaf lies between the uterosacral ligaments
  scWallL(ph, lerp(c0 ? -2.3 : -2.7, LS.YA - 0.1, k), 0.07, out);
  if (v > 0.82) { const t = (v - 0.82) / 0.18, q = lerp(1, 0.12, sstep(0.25, 1, t)); out.set(out.x * q, lerp(LS.YA - 0.1, LS.YA - LS.CONE * (1 - q * q) + 0.07, sstep(0, 0.3, t)), out.z * q); }
  return out.applyMatrix4(VG.M);
}
(function () {
  spline([[0.95, 9.3], [1.0, 7.6], [1.35, 5.6], [1.75, 3.2], [1.8, 0.8], [1.6, -1.6], [1.4, -3.3], [1.3, -4.5]].map(q => V(q[0], 0, q[1])), SC.xz);
  // the promontory and the lumbar spine above it, under peritoneum
  SC.prom = reg(new THREE.Mesh(paramSurface(44, 52, (u, v, p, c) => {
    const x = lerp(-5.6, 5.6, u), z = lerp(3.4, 18.5, v), e = sstep(0, 0.1, Math.min(u, 1 - u, v, 1 - v)), h = scH(x, z) / 1.3;
    scFloor(x, z, lerp(-0.26, 0, e), p); c[0] = 1 + 0.05 * h; c[1] = 1 + 0.1 * h; c[2] = 1 + 0.1 * h;
  }, { su: 2, sv: 3, flip: true }), MAT.perit), 'prom');
  // the left common iliac vein, crossing above the promontory, and the middle sacral vessels in the midline
  const tube = (pts, lift, r, col, ent, flat) => { // r(u): it tapers out of sight under the peritoneum at its ends
    const A = spline(pts.map(q => scFloor(q[0], q[1], lift, new V3())), vecArr(33)), t = new Tube(33, 10, MAT.cord, 1, 4);
    t.set(A, 0, 1, r, (u, c) => { c[0] = col[0]; c[1] = col[1]; c[2] = col[2]; }, flat); reg(t.mesh, ent); return { A, mesh: t.mesh };
  };
  const civ = tube([[-7.6, 8.6], [-6.2, 9.4], [-3.8, 10.3], [-1.4, 11.2], [0.9, 12.3], [2.2, 14], [2.9, 17.5]], 0.1, () => 0.34, COL.iliacV, 'civ', 1.7); SC.civA = civ.A;
  const ms = [[SC.MSX - 0.02, 13.5], [SC.MSX - 0.1, 11.2], [SC.MSX - 0.06, 9], [SC.MSX - 0.12, 7], [SC.MSX - 0.05, 4.8], [SC.MSX - 0.2, 2.6]], fade = u => sstep(0, 0.12, u) * (1 - sstep(0.8, 1, u));
  const pale = (c, k) => [lerp(c[0], COL.lig[0], k), lerp(c[1], COL.lig[1], k), lerp(c[2], COL.lig[2], k)]; // seen through peritoneum
  SC.fixed = [SC.prom, civ.mesh, tube(ms, 0.035, u => 0.055 * fade(u), pale(COL.art, 0.25), 'msv').mesh, tube(ms.map(q => [q[0] + 0.16, q[1]]), 0.035, u => 0.07 * fade(u), pale(COL.vein, 0.3), 'msv').mesh];
  // the opened retroperitoneum, the bared posterior vaginal wall, and the mesh
  const weave = (function () {
    const cv = mkCanvas(64), g = cv.getContext('2d'); g.fillStyle = '#f3f5f9'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#a3abbb';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) { g.beginPath(); g.arc(x * 8 + (y % 2 ? 4 : 0), y * 8 + 4, 2.2, 0, TAU); g.fill(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
  })();
  MAT.mesh = new THREE.MeshStandardMaterial({ map: weave, roughness: 0.85, side: THREE.DoubleSide });
  const strip = (ns, nt, mat, ent, us, ut) => { const s = new Strip(ns, nt, mat, us, ut); reg(s.mesh, ent, null, { strip: s }); s.mesh.visible = false; return s; };
  SC.rib = strip(48, 7, MAT.fat, 'retro', 6, 1); SC.lig = strip(14, 5, MAT.cord, 'retro', 1, 2); SC.rvs = strip(9, 8, MAT.cord, 'rvs', 1, 1);
  SC.leafP = strip(9, 14, MAT.mesh, 'mesh', 2.5, 7); SC.leafA = strip(9, 14, MAT.mesh, 'mesh', 4, 7); SC.arm = strip(44, 5, MAT.mesh, 'mesh', 20, 2);
  SC.moving = [SC.rib, SC.lig, SC.rvs, SC.leafP, SC.leafA, SC.arm].map(s => s.mesh);
  for (const m of SC.fixed.concat(SC.moving)) { m.visible = false; scene.add(m); }
})();
function scShow(on) {
  for (const m of SC.fixed) m.visible = on;
  if (!on) { for (const m of SC.moving) m.visible = false; if (SC.rkey) { SC.rkey = ''; setRectum(); } }
}
// The sigmoid starts over the promontory and is swept to the patient's left; the rectum falls back as it is taken off the vagina.
function scRect() {
  const m = S.scp, key = m.sigP.toFixed(3) + '/' + m.rvP.toFixed(3); if (SC.rkey === key) return; SC.rkey = key;
  const k = 1 - m.sigP;
  setRectum((i, p) => {
    const b = SC.SIG[i]; if (b && k > 0) { p.x += 6 * b * k; p.y = lerp(p.y, scFloor(p.x, p.z, 1.15, _s4).y, Math.min(1, b) * k); }
    if (i < 2) { p.y -= 0.6 * m.rvP; p.z -= 0.3 * m.rvP; }
  });
}
function scUpdate(dt) {
  const m = S.scp;
  m.sigP = damp(m.sigP, m.sig, 3, dt); m.rvP = damp(m.rvP, m.rv, 4, dt); m.cut = damp(m.cut, m.cutGoal, 9, dt); m.shut = damp(m.shut, m.shutGoal, 5, dt); m.clearP = damp(m.clearP, m.clear, 4, dt);
  scRect();
  // the incision: a window over the promontory, a narrower bed down the gutter. Fat until it is cleared off the ligament.
  const a0 = m.shut, a1 = m.cut;
  SC.rib.mesh.visible = a1 - a0 > 0.004;
  if (SC.rib.mesh.visible) SC.rib.update((sx, v, o, c) => {
    const t = lerp(a0, a1, sx), a = v * 2 - 1, w = (0.95 + 0.3 * (1 - sstep(0.12, SC.T1 + 0.05, t))) * sstep(0, 0.05, a1 - t + 0.004) * sstep(0, 0.04, t - a0 + 0.004);
    scPath(t, a * w, 0.04, o); edgeCol(c, 1, Math.abs(a)); c[1] *= 0.9; c[2] *= 1.25; // loose fat and areolar tissue, redder at the cut edges
  });
  // the anterior longitudinal ligament, white, where the fat has been swept off the bone
  SC.lig.mesh.visible = m.clearP > 0.03 && a0 < SC.T1 - 0.05;
  if (SC.lig.mesh.visible) SC.lig.update((sx, v, o, c) => {
    const t = lerp(Math.max(0.015, a0), SC.T1 - 0.035, sx), a = 1 - v * 2, w = 0.68 * m.clearP * Math.sin(Math.PI * clamp(sx, 0.04, 0.96));
    scPath(t, a * w, 0.07, o); const k = 1 - 0.25 * sstep(0.5, 1, Math.abs(a)); c[0] = 1.02 * k; c[1] = 0.99 * k; c[2] = 0.95 * k;
  });
  SC.rvs.mesh.visible = m.rvP > 0.02;
  if (SC.rvs.mesh.visible) SC.rvs.update((sx, v, o, c) => { scWall(lerp(-34, 34, sx), lerp(-0.3 - 2.6 * m.rvP, -0.3, v), 0.035, o); edgeCol(c, 1, Math.max(Math.abs(2 * sx - 1), 1 - 2.2 * v)); c[1] *= 0.92; c[2] *= 0.88; });
  // the mesh: its posterior leaf from the step that brings it in, the anterior leaf from the next, and its arm, kept
  // rolled up out of the way until both leaves are fixed, from the one after that
  const inP = S.step >= SC.iP, inA = S.step > SC.iP, arm = S.step > SC.iP + 1;
  SC.leafP.mesh.visible = inP; SC.leafA.mesh.visible = inA; SC.arm.mesh.visible = arm;
  if (inP) SC.leafP.update((sx, v, o) => scLeaf(0, sx, v, o));
  if (inA) SC.leafA.update((sx, v, o) => scLeaf(180, sx, v, o));
  if (arm) { // the arm: off the top of the stump, down behind the cervix, and along the gutter to the promontory. Under the peritoneum once that is closed.
    const C = [_s2.set(0, LS.YA - LS.CONE + 0.14, 0).applyMatrix4(VG.M).clone(), _s2.set(0, LS.YA + 0.12, 1.0).applyMatrix4(VG.M).clone(), scWall(0, LS.YA - 0.5, 0.17, new V3()), scWall(0, 0.9, 0.22, new V3()), scWall(0, -0.7, 0.3, new V3())];
    for (const t of [1, 0.93, 0.86, 0.72, 0.58, 0.44, 0.34, 0.27, 0.21, 0.16, 0.11, SC.END]) C.push(scPath(t, 0, t < m.shut ? -0.3 : t < 0.3 ? 0.16 : 0.12, new V3()));
    spline(C, SC.armA);
    const n = SC.armA.length, X = _s3.setFromMatrixColumn(VG.M, 0);
    for (let i = 0; i < n; i++) {
      const tn = _s1.subVectors(SC.armA[Math.min(n - 1, i + 1)], SC.armA[Math.max(0, i - 1)]).normalize(), N = SC.armN[i];
      N.set(-tn.z, 0, tn.x); if (N.lengthSq() < 0.05) N.copy(i ? SC.armN[i - 1] : X); N.normalize(); if (N.x < 0) N.negate();
    }
    SC.arm.update((sx, v, o) => { const i = Math.min(n - 1, Math.round(sx * (n - 1))); o.copy(SC.armA[i]).addScaledVector(SC.armN[i], (v - 0.5) * 1.3); });
  }
}
// ---------- hazards ----------
function scMsv(p) { // the middle sacral vessels, opened by a needle or by energy
  const m = S.scp; if (m.msv) return; m.msv = true; const q = p.clone();
  addBleeder(o => o.copy(q), 45, false, 'middle sacral vessels'); logEvent('bleed', 'Middle sacral vessels opened: presacral bleeding. Hold bipolar on the bleeding point.'); sfx.warn();
}
function scBig(p) { const q = p.clone(); addBleeder(o => o.copy(q), 420, true, 'iliac', { auto: 7, autoMsg: 'Pressure held on the vessel. In theatre: call for help, vascular surgery, prepare to convert.' }); }
function scHeat(h, dt, e) { // energy on what this operation works among
  const m = S.scp;
  if (e === 'civ') { heatUp(h, 'civ', '', dt); if (S.injuries.civ && !m.civ) { m.civ = true; scBig(h.pick.point); } return true; }
  if (e === 'msv') { m.msvT += dt; if (m.msvT > 0.25) scMsv(h.pick.point); return true; }
  if (e === 'mesh') { hint('meshE', 'Keep energy off the mesh'); return true; }
  return e === 'retro' || e === 'rvs' || e === 'stump' || e === 'prom';
}
function scStab(h) { // a needle through something it must not go through. true: that is what this bite did
  const P = h.pick, e = P.ent, k = P.side;
  if (e === 'msv') { scMsv(P.point); return true; }
  const text = { bladder: 'Suture placed through the bladder wall', rectum: 'Suture placed through the bowel wall', ureter: sideName(k, true) + ' ureter caught in a suture', civ: 'Major vascular injury: needle into the left common iliac vein', iliac: 'Major vascular injury: needle into the ' + sideName(k) + ' external iliac vessels' }[e];
  if (!text) return false;
  const key = e + (e === 'ureter' || e === 'iliac' ? k : '');
  if (!S.injuries[key]) { S.injuries[key] = { t: S.t, type: e, side: k, u: P.u }; logEvent('injury', text); sfx.alarm(); if (e === 'civ' || e === 'iliac') scBig(P.point); }
  return true;
}
// ---------- steps ----------
const exVault = { label: 'Vault pushed cephalad', ok: () => S.pose.push > 0.7 };
const exFwd = { label: 'Vault tipped forward', ok: () => S.pose.pitch > 0.5 };
const exBack = { label: 'Vault tipped back', ok: () => S.pose.pitch < 0.05 };
const exTen = { label: 'Vault at its natural level: supported, not stretched', ok: () => S.pose.push > 0.35 && S.pose.push < 0.8 };
// A stretch of the peritoneal incision cut with the hook, to the path values in o.at. o.sweeps: places then cleared of fat.
function scIncise(o) {
  const SW = o.sweeps || [], cutN = () => o.at.filter(t => S.scp.cutGoal >= t - 1e-3).length;
  const cp = (i, out) => scPath(lerp(i ? o.at[i - 1] : o.from, o.at[i], 0.6), 0, 0.05, out);
  return Object.assign({
    kind: 'incise', tool: 'hook', acc: 0, cnt: 0,
    next() {
      const i = cutN(); if (i < o.at.length) return { p: cp(i, new V3()), act: 'trace', label: i === 0 && !o.from ? 'Start here: hold to cut' : 'Trace' };
      return this.cnt >= SW.length ? null : { p: scPath(SW[this.cnt], 0, 0.06, new V3()), act: 'push', label: 'Clear the fat off the ligament', prog: this.acc / 0.4 };
    },
    path() { const a = []; for (let i = cutN(); i < o.at.length; i++) a.push(cp(i, new V3())); return a; },
    targets() { const i = cutN(); return i < o.at.length ? [cp(i, new V3())] : this.cnt < SW.length ? [scPath(SW[this.cnt], 0, 0.06, new V3())] : []; },
    sweep(h, dt, T) {
      if (cutN() < o.at.length || this.cnt >= SW.length || !nearTarget(h, scPath(SW[this.cnt], 0, 0.06, _w2), 0.9)) return false;
      this.acc += dt; if (this.acc > T) { this.acc = 0; this.cnt++; S.scp.clear = this.cnt / SW.length; S.ebl += 0.5; sfx.click(); uiDirty(); if (this.cnt >= SW.length) toast('The anterior longitudinal ligament is bare', 'ok'); }
      return true;
    },
    hook(h, dt) {
      const i = cutN();
      if (i < o.at.length && nearTarget(h, cp(i, _w2), 0.8)) { this.acc += dt; if (this.acc > 0.11) { this.acc = 0; S.scp.cutGoal = o.at[i]; S.ebl += 0.5; sfx.click(); uiDirty(); } return true; }
      if (this.sweep(h, dt, 0.4)) return true;
      if (h.pick.hit && (h.pick.ent === 'prom' || h.pick.ent === 'retro')) { if (S.guided && i < o.at.length) hint('line', 'Follow the marked line'); return true; }
      return false;
    },
    blunt(h, dt) { if (this.sweep(h, dt, 0.6)) S.stats.blunt += dt; },
    done() { return cutN() >= o.at.length && this.cnt >= SW.length && S.scp.cutGoal - S.scp.cut < 0.01; },
    progress() { const i = cutN(); return i < o.at.length ? 'Incision ' + i + ' / ' + o.at.length : SW.length ? 'Ligament cleared ' + this.cnt + ' / ' + SW.length : 'Open'; },
    frac() { return (cutN() + this.cnt) / (o.at.length + SW.length); },
    focus(out) { return scPath(lerp(o.from, o.at[o.at.length - 1], 0.5), 0, 0, out); },
    force() { S.scp.cutGoal = o.at[o.at.length - 1]; this.cnt = SW.length; if (SW.length) S.scp.clear = 1; }
  }, o);
}
// Fix a leaf of the mesh to the vagina and cervix: one bite at each of its marks, in any order.
function scFix(o) {
  const L = o.leaf, marks = SC.MARK[L], have = i => S.scp.fix.some(f => f.leaf === L && f.i === i), left = () => marks.findIndex((q, i) => !have(i));
  const pt = (i, out) => scWall(marks[i][0], marks[i][1], 0.09, out);
  return Object.assign({
    kind: 'fix', tool: 'needle', phase: 'Mesh', dist: 7.5,
    // a corner on the patient's left is square to the left hand's needle and edge-on to the right's, and the other way about
    next() { const i = left(); if (i < 0) return null; const sx = Math.sin(marks[i][0] * DEG); return { p: pt(i, new V3()), act: 'bite', hand: sx < -0.2 ? 'L' : sx > 0.2 ? 'R' : null, label: i < 2 ? 'Suture the far corner of the leaf' : 'Suture the leaf to the cervix' }; },
    targets() { const a = []; marks.forEach((q, i) => { if (!have(i)) a.push(pt(i, new V3())); }); return a; },
    click(h) {
      if (h.inst !== 'needle') return false;
      const P = h.pick; if (left() < 0) return true;
      if (!P.hit || !h.near) { hint('fixmiss', 'Place the bite through the mesh into the vaginal wall'); return true; }
      if (scStab(h)) return true;
      if (P.ent !== 'mesh') { hint('fixmesh', 'Take the mesh in the bite: place it on the leaf'); return true; }
      let best = -1, bd = 0.8; for (let i = 0; i < marks.length; i++) if (!have(i)) { const d = pt(i, _w2).distanceTo(P.point); if (d < bd) { bd = d; best = i; } }
      if (best < 0) { hint('fixspot', 'Spread the sutures: one at each far corner of this leaf and one on the cervix'); return true; }
      S.scp.fix.push({ leaf: L, i: best }); S.ebl += 0.3; h.roll = 1; sfx.bite();
      if (left() < 0) toast(L === 'P' ? 'Posterior leaf fixed' : 'Anterior leaf fixed', 'ok');
      uiDirty(); return true;
    },
    done() { return left() < 0; }, progress() { return S.scp.fix.filter(f => f.leaf === L).length + ' of ' + marks.length + ' sutures'; }, frac() { return S.scp.fix.filter(f => f.leaf === L).length / marks.length; },
    force() { marks.forEach((q, i) => { if (!have(i)) S.scp.fix.push({ leaf: L, i }); }); }
  }, o);
}
const scNeedleOff = h => { if (h.inst !== 'needle') return true; const P = h.pick; if (!P.hit || !h.near) { hint('bitemiss', 'Bring the needle onto the tissue first'); return true; } return scStab(h); }; // nothing for the step to judge: not a needle, not on tissue, or through something it must not go through
const SCP_STEPS = [
  {
    id: 'sig', kind: 'retract', tool: 'suction', phase: 'Promontory', short: 'Move the sigmoid', title: 'Sweep the sigmoid off the promontory', dist: 13, acc: 0, cnt: 0, rec: { yaw: 0, pitch: PITCH0, push: 0.3 }, expo: [],
    text: ['The sigmoid lies over the promontory.', 'With the blunt suction tip, sweep it to the patient\'s left until the promontory and the right pararectal gutter are in view.', 'The assistant then holds it there by an appendix epiploica.'],
    pearl: 'Steep Trendelenburg and a tilt to the left do much of this for you. Many surgeons hitch the sigmoid to the left abdominal wall with a stitch through an epiploic appendix, which frees the assistant\'s hand. Handle bowel by its fat, never by its wall.',
    pt(out) { sampleArr(AN.rectumArr, 0.74, out); out.x += 1.15; out.y += 0.55; return out; },
    next() { return this.cnt >= 3 ? null : { p: this.pt(new V3()), act: 'push', label: 'Push the sigmoid to the patient\'s left', prog: this.acc / 0.6 }; },
    targets() { return this.cnt >= 3 ? [] : [this.pt(new V3())]; },
    blunt(h, dt) {
      if (this.cnt >= 3 || !nearTarget(h, this.pt(_w2), 1.0)) return;
      this.acc += dt; S.stats.blunt += dt; if (this.acc < 0.6) return;
      this.acc = 0; this.cnt++; S.scp.sig = this.cnt / 3; sfx.click(); uiDirty(); if (this.cnt >= 3) toast('The assistant holds the sigmoid to the left', 'ok');
    },
    done() { return this.cnt >= 3 && S.scp.sigP > 0.95; }, progress() { return 'Swept ' + this.cnt + ' / 3'; }, frac() { return this.cnt / 3; }, focus(o) { return scFloor(0.2, 8, 1, o); },
    force() { this.cnt = 3; S.scp.sig = 1; }
  },
  {
    id: 'look', kind: 'survey', tool: 'any', phase: 'Promontory', short: 'Identify the landmarks', title: 'Identify the promontory and what lies around it', dist: 11.5, rec: null, expo: [],
    text: ['Before any incision, find the landmarks.', 'Hold an instrument tip beside each for a moment: the sacral promontory, the right ureter where it crosses the pelvic brim, and the left common iliac vein.', 'The safe ground lies between them: over the promontory, just to the right of the midline.'],
    pearl: 'The left common iliac vein crosses just above the promontory and can lie within 2 to 3 cm of it. It is flat and easy to miss under the peritoneum. The middle sacral vessels run down the front of the sacrum in the midline. The right ureter and the right common iliac vessels are the lateral limit.',
    tm: { P: 0, U: 0, V: 0 }, name: { P: 'sacral promontory', U: 'right ureter', V: 'left common iliac vein' }, said: { P: 'Sacral promontory', U: 'Right ureter, crossing the brim', V: 'Left common iliac vein, above the promontory' },
    pt(k, out) { return k === 'P' ? scFloor(0.4, 8.5, 0.1, out) : k === 'U' ? sampleArr(URETER.R.arr, 0.1, out) : sampleArr(SC.civA, 0.55, out); },
    click(h) { if (h.inst !== 'bipolar' && h.inst !== 'hook') return false; hint('lookE', 'No energy yet. Hold the tip beside each landmark to mark it.'); return true; },
    tick(dt) {
      const seen = S.scp.seen;
      for (const k of ['P', 'U', 'V']) {
        if (seen[k]) continue;
        const p = this.pt(k, _w), near = HANDS.some(h => h.ptr.on && h.exch <= 0 && !h.firing && h.tip.distanceTo(p) < 1.3);
        this.tm[k] = near ? this.tm[k] + dt : Math.max(0, this.tm[k] - 2 * dt);
        if (this.tm[k] >= 1) { seen[k] = true; sfx.ok(); toast(this.said[k], 'ok'); uiDirty(); }
      }
    },
    reset() { this.tm.P = this.tm.U = this.tm.V = 0; },
    next() { for (const k of ['P', 'U', 'V']) if (!S.scp.seen[k]) return { p: this.pt(k, new V3()), act: 'hover', label: 'Hold near the ' + this.name[k], prog: this.tm[k] }; return null; },
    done() { const s = S.scp.seen; return s.P && s.U && s.V; }, progress() { const s = S.scp.seen; return (s.P ? 1 : 0) + (s.U ? 1 : 0) + (s.V ? 1 : 0) + ' of 3 identified'; },
    frac() { const s = S.scp.seen; return ((s.P ? 1 : 0) + (s.U ? 1 : 0) + (s.V ? 1 : 0)) / 3; }, focus(o) { return scFloor(0.6, 9.4, 0, o); },
    force() { const s = S.scp.seen; s.P = s.U = s.V = true; }
  },
  scIncise({
    id: 'prom', from: 0, at: [0.07, 0.14, 0.21, SC.T1], sweeps: [0.1, 0.2], alt: 'suction', phase: 'Promontory', short: 'Open the promontory', title: 'Open the peritoneum over the promontory', dist: 8.5, rec: null, expo: [],
    text: ['With the hook, open the peritoneum over the promontory, just to the right of the midline. Lift it off the bone before you cut it.', 'Carry the incision a few centimetres down the front of the sacrum.', 'Then clear the fat until the white anterior longitudinal ligament is bare: sweep with the hook or the suction tip.'],
    pearl: 'You need to see the ligament itself: a suture in fat holds nothing. Keep the dissection shallow and to the right of the midline. Presacral veins bleed from the bone and retract into it, so the best control is not to cut them.'
  }),
  scIncise({
    id: 'gutter', from: SC.T1, at: [0.37, 0.47, 0.57, 0.67, 0.77, 0.88, 1], phase: 'Dissection', short: 'Incise down the gutter', title: 'Carry the peritoneal incision down to the cul-de-sac', dist: 12, rec: { yaw: 0, pitch: 0.5, push: 0.5 }, expo: [],
    text: ['Continue the incision caudally along the right pararectal gutter to the cul-de-sac.', 'Stay medial to the right ureter and the uterosacral ligament, and lateral to the rectum.', 'This makes the bed the mesh will lie in, and the edges that will cover it.'],
    pearl: 'The right ureter is the lateral hazard all the way down, the mesorectum the medial one. Some surgeons tunnel under the peritoneum instead of opening it. Either way no mesh may be left uncovered at the end.'
  }),
  {
    id: 'post', kind: 'flap', tool: 'hook', alt: 'suction', phase: 'Dissection', short: 'Posterior dissection', title: 'Open the rectovaginal space', dist: 8, acc: 0, cnt: 0,
    rec: { yaw: 0, pitch: 0.85, push: 1 }, expo: [exVault, exFwd],
    text: ['Have the vault pushed cephalad and tipped forward on the probe, so that the posterior vaginal wall stands up.', 'Open the peritoneum of the cul-de-sac on the vaginal side and push the rectum off the posterior vaginal wall: midline first, then each side.', 'Stay on the vagina, which is firm and pale over the probe. Use short hook bursts on the vaginal side or blunt pushes with the suction tip.'],
    pearl: 'The plane is avascular and opens easily when you are in it. Fat means you are on the rectum. How far down to go depends on the posterior defect: far enough for a few centimetres of mesh, further for a rectocele.',
    at: [[0, -0.7], [-24, -1.5], [24, -1.5], [0, -2.3]],
    pt(out) { const q = this.at[this.cnt]; return scWall(q[0], q[1], 0.06, out); },
    targets() { return this.cnt >= 4 ? [] : [this.pt(new V3())]; },
    next() { return this.cnt >= 4 ? null : { p: this.pt(new V3()), act: 'push', label: this.cnt ? 'Push the rectum off the vaginal wall' : 'Open the peritoneum on the vaginal wall', prog: this.acc / 0.4 }; },
    sweep(h, dt, T) {
      if (this.cnt >= 4) return true;
      if (h.pick.ent === 'rectum') return false;
      if (nearTarget(h, this.pt(_w2), 0.9)) { this.acc += dt; if (this.acc > T) { this.acc = 0; this.cnt++; S.scp.rv = this.cnt / 4; S.ebl += 0.6; sfx.click(); uiDirty(); } return true; }
      return false;
    },
    hook(h, dt) { return this.sweep(h, dt, 0.4); }, blunt(h, dt) { if (this.sweep(h, dt, 0.6)) S.stats.blunt += dt; },
    done() { return this.cnt >= 4 && S.scp.rvP > 0.93; }, progress() { return 'Rectum mobilized ' + Math.round(S.scp.rvP * 100) + '%'; }, frac() { return this.cnt / 4; },
    focus(o) { return scWall(0, -1.2, 0, o); },
    force() { this.cnt = 4; S.scp.rv = 1; }
  },
  flapStep({
    id: 'ant', from: 0.5, N: 3, full: 1, phase: 'Dissection', short: 'Anterior dissection', title: 'Dissect the bladder off the anterior vaginal wall', rec: { yaw: 0, pitch: -0.2, push: 1 }, expo: [exVault, exBack],
    text: ['Have the vault pushed cephalad and tipped back on the probe.', 'Carry the bladder flap from the hysterectomy further down the anterior vaginal wall: midline first, then each side.', 'Stop a few centimetres down the wall, short of the bladder neck.'],
    pearl: 'The probe shows you the vaginal wall. The bladder is the thicker, fatty, mobile layer. Filling the bladder a little helps if the plane is unclear. Thin vaginal wall under mesh is where exposures happen, so leave the fascia on the vagina.'
  }),
  scFix({
    id: 'meshP', leaf: 'P', short: 'Fix the posterior leaf', title: 'Fix the posterior leaf of the mesh', rec: { yaw: 0, pitch: 0.85, push: 1 }, expo: [exVault, exFwd],
    text: ['The Y-shaped polypropylene mesh is in, its long arm still rolled up. The posterior leaf lies on the posterior vaginal wall and the back of the cervix.', 'Take the needle driver. Fix the leaf with a suture at each far corner, then one on the cervix.', 'Each bite takes the mesh and the vaginal fascia, not the full thickness of the wall.'],
    pearl: 'A bite that enters the vaginal lumen invites suture and mesh exposure: use the probe to judge depth. Lay the mesh flat, since folds are where it erodes. In theatre each leaf takes six or more sutures. Three stand for them here.',
    focus(o) { return scWall(0, -0.8, 0, o); }
  }),
  scFix({
    id: 'meshA', leaf: 'A', short: 'Fix the anterior leaf', title: 'Fix the anterior leaf of the mesh', rec: { yaw: 0, pitch: -0.2, push: 1 }, expo: [exVault, exBack],
    text: ['Tip the vault back. The anterior leaf lies on the anterior vaginal wall and the front of the cervix.', 'Fix it the same way: each far corner, then the cervix.', 'The bladder lies just beyond the lower edge of the leaf.'],
    pearl: 'The cervix is the strongest tissue you have here: take a good bite of it. Keep the lowest sutures clear of the bladder, and look at both ureteric orifices at cystoscopy afterwards.',
    focus(o) { return scWall(180, -0.5, 0, o); }
  }),
  {
    id: 'sacral', kind: 'fix', tool: 'needle', phase: 'Mesh', short: 'Fix the mesh to the promontory', title: 'Set the tension and fix the mesh to the promontory', dist: 8.5, rec: { yaw: 0, pitch: PITCH0, push: 0.55 }, expo: [exTen],
    text: ['The arm of the mesh is unrolled along the gutter to the promontory. Have the probe hold the vault at its natural level: supported, not stretched, with the arm lying free of tension.', 'Suture the arm to the anterior longitudinal ligament over the body of S1, just below the promontory, with two bites in the area you cleared.', 'Stay to the right of the midline vessels and below the disc.'],
    pearl: 'Too tight and she has pain, urgency or new stress incontinence. Too loose and the apex is not supported. Take the ligament, not the disc: a deep bite at L5 to S1 risks discitis. Permanent suture and tacks are both in use.',
    next() { const n = S.scp.sac.length; return n >= 2 ? null : { p: scPath(SC.SAC[n], 0, 0.15, new V3()), act: 'bite', label: n ? 'Second suture, a little lower' : 'Suture the mesh to the ligament over S1' }; },
    targets() { const n = S.scp.sac.length; return n >= 2 ? [] : [scPath(SC.SAC[n], 0, 0.15, new V3())]; },
    click(h) {
      const m = S.scp, P = h.pick; if (h.inst !== 'needle') return false; if (m.sac.length >= 2 || scNeedleOff(h)) return true;
      const q = scOnPath(P.point);
      if (P.ent !== 'mesh' || q.t > SC.T1 || Math.abs(q.a) > 1.15) { hint('sacspot', 'Place the bite through the mesh into the ligament you bared over the promontory'); return true; }
      if (m.sac.length && Math.hypot(P.point.x - m.sac[0].x, P.point.z - m.sac[0].z) < 0.4) { hint('sacclose', 'Too close to the first suture: place the second a little away from it'); return true; }
      if (Math.abs(P.point.x - SC.MSX) < 0.4) scMsv(P.point);
      if (P.point.z > SC.DISC) logEvent('tech', 'Bite taken at the L5 to S1 disc: risk of discitis. Take the ligament over the body of S1, just below the promontory.');
      m.sac.push({ x: P.point.x, z: P.point.z }); h.roll = 1; sfx.bite(); S.ebl += 0.5;
      if (m.sac.length === 1) { m.tension = S.pose.push; if (m.tension >= 0.8) logEvent('tech', 'Mesh fixed with the vault pushed hard up: it is under tension'); else if (m.tension <= 0.35) logEvent('tech', 'Mesh fixed with the vault low: the apex is not supported'); }
      if (m.sac.length >= 2) { S.manipOut = true; toast('Mesh fixed to the promontory. The probe comes out.', 'ok'); }
      uiDirty(); return true;
    },
    done() { return S.scp.sac.length >= 2; }, progress() { return S.scp.sac.length + ' of 2 sutures'; }, frac() { return S.scp.sac.length / 2; }, focus(o) { return scPath(0.17, 0, 0, o); },
    force() { const m = S.scp; while (m.sac.length < 2) { const p = scPath(SC.SAC[m.sac.length], 0, 0, _w); m.sac.push({ x: p.x, z: p.z }); } if (m.tension == null) m.tension = 0.55; S.manipOut = true; }
  },
  {
    id: 'perit', kind: 'close', tool: 'needle', phase: 'Completion', short: 'Close the peritoneum', title: 'Close the peritoneum over the mesh', dist: 12, rec: null, expo: [],
    text: ['Run a suture down the peritoneal incision from the promontory to the cul-de-sac, taking both edges in each bite.', 'Four bites stand for the running closure here.', 'Take peritoneum only: the right ureter runs lateral to the edge all the way down.'],
    pearl: 'Bowel that meets bare mesh can adhere to it, or slip beneath it and obstruct. Cover all of it.',
    next() { const n = S.scp.per; return n >= 4 ? null : { p: scPath(SC.PER[n], 0, 0.14, new V3()), act: 'bite', label: n ? 'Next bite, toward the pelvis' : 'Start the closure at the promontory' }; },
    targets() { const n = S.scp.per; return n >= 4 ? [] : [scPath(SC.PER[n], 0, 0.14, new V3())]; },
    click(h) {
      const m = S.scp; if (h.inst !== 'needle') return false; if (m.per >= 4 || scNeedleOff(h)) return true;
      if (scPath(SC.PER[m.per], 0, 0.14, _w2).distanceTo(h.pick.point) > 0.9) { hint('perspot', m.per ? 'Carry on from the last bite: take both edges at the next mark' : 'Start the closure at the promontory'); return true; }
      m.per++; m.shutGoal = SC.SHUT[m.per - 1]; h.roll = 1; sfx.bite(); S.ebl += 0.3;
      if (m.per >= 4) toast('Peritoneum closed over the mesh', 'ok');
      uiDirty(); return true;
    },
    done() { return S.scp.per >= 4 && S.scp.shut > 0.97; }, progress() { return S.scp.per + ' of 4 bites'; }, frac() { return S.scp.per / 4; }, focus(o) { return scPath(0.45, 0, 0, o); },
    force() { const m = S.scp; m.per = 4; m.shutGoal = 1; }
  },
  Object.assign({}, TLH_FINAL, {
    phase: 'Completion', dist: 14,
    text: ['Drop the pneumoperitoneum to 8 mmHg and inspect the promontory, the gutter and the vagina.', 'Control any ooze with short bipolar bursts.', 'Aspirate pooled blood, then hold a tip beside each ureter for a moment to confirm peristalsis.'],
    pearl: 'Cystoscopy follows: look for both ureteric jets and for suture or mesh in the bladder. Examine vaginally for a suture through the wall. Record the mesh, the sutures and the level of fixation.',
    button: { label: 'Lower pressure to 8 mmHg', fn() { if (S.lowP) return; S.lowP = true; S.pressureGoal = 8; addBleeder(o => scPath(0.8, 0.5, 0.05, o), 12, false, 'peritoneal edge'); S.oozeDone = true; toast('Pressure down: venous ooze from the peritoneal edge in the gutter', 'bleed'); uiDirty(); }, hide: () => S.lowP },
    focus(o) { return o.set(0.5, -4.5, 1); }
  })
];
SC.iP = SCP_STEPS.findIndex(s => s.id === 'meshP');
// ---------- scoring, debrief, sutures ----------
function scScore() {
  const s = S.stats, m = S.scp, inj = Object.keys(S.injuries).length;
  let pts = 100; const notes = [];
  if (inj) { pts -= 25 * inj; notes.push(inj + ' organ or vessel injur' + (inj > 1 ? 'ies' : 'y')); }
  if (m.msv) { pts -= 8; notes.push('Middle sacral vessels opened'); }
  if (s.nearMiss) { pts -= Math.min(15, 5 * s.nearMiss); notes.push(s.nearMiss + ' near miss' + (s.nearMiss > 1 ? 'es' : '') + ' at the ureter'); }
  const tight = m.tension != null && m.tension >= 0.8, slack = m.tension != null && m.tension <= 0.35;
  if (tight || slack) { pts -= 8; notes.push(tight ? 'Mesh fixed under tension' : 'Mesh fixed slack: apex not supported'); }
  if (s.expoMiss) { pts -= Math.min(12, 2 * s.expoMiss); notes.push(s.expoMiss + ' step' + (s.expoMiss > 1 ? 's' : '') + ' started without the recommended exposure'); }
  if (S.ebl > SCP.eblWarn) { pts -= Math.min(20, Math.round((S.ebl - SCP.eblWarn) / 20)); notes.push('Blood loss above ' + SCP.eblWarn + ' mL'); }
  const tech = S.events.filter(e => e.type === 'tech').length - (tight || slack ? 1 : 0);
  if (tech > 0) { pts -= Math.min(10, 3 * tech); notes.push(tech + ' point' + (tech > 1 ? 's' : '') + ' of technique in the event log'); }
  if (s.nonTarget > 3) { pts -= Math.min(6, Math.round(s.nonTarget)); notes.push('Energy applied off target for ' + s.nonTarget.toFixed(1) + ' s'); }
  pts = Math.max(0, Math.round(pts));
  return { pts, grade: pts >= 90 ? 'Proficient' : pts >= 75 ? 'Competent' : pts >= 60 ? 'Developing' : 'Needs review', notes };
}
function scDebrief(row) {
  const s = S.stats, m = S.scp, inj = Object.keys(S.injuries).length, n = L => m.fix.filter(f => f.leaf === L).length;
  const ten = m.tension == null ? 'n/a' : m.tension >= 0.8 ? 'Tight' : m.tension <= 0.35 ? 'Slack' : 'Without tension', disc = m.sac.filter(b => b.z > SC.DISC).length;
  return [
    row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + row('Middle sacral vessels', m.msv ? 'Opened' : 'Intact', m.msv ? 'warn' : 'ok') + row('Near misses at the ureter', s.nearMiss, s.nearMiss ? 'warn' : 'ok') + row('Sacral bites at the disc', disc, disc ? 'warn' : 'ok'),
    row('Mesh tension', ten, ten === 'Tight' || ten === 'Slack' ? 'warn' : 'ok') + row('Sutures: posterior leaf / anterior leaf / promontory', n('P') + ' / ' + n('A') + ' / ' + m.sac.length) + row('Peritoneum closed over the mesh', m.per >= 4 ? 'Yes' : 'No', m.per >= 4 ? 'ok' : 'warn') + row('Blunt dissection', s.blunt.toFixed(0) + ' s') + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok')
  ];
}
function scSutures() { // every suture as a short loop of thread: on the leaves, at the promontory, across the peritoneal edges
  const m = S.scp, st = [], N = () => new V3();
  for (const f of m.fix) { const q = SC.MARK[f.leaf][f.i]; st.push([scWall(q[0] - 7, q[1], 0.09, N()), scWall(q[0], q[1], 0.22, N()), scWall(q[0] + 7, q[1], 0.09, N())]); }
  for (const b of m.sac) st.push([scFloor(b.x - 0.3, b.z, 0.13, N()), scFloor(b.x, b.z, 0.3, N()), scFloor(b.x + 0.3, b.z, 0.13, N())]);
  for (let i = 0; i < m.per; i++) st.push([scPath(SC.PER[i], -0.45, 0.06, N()), scPath(SC.PER[i], 0, 0.2, N()), scPath(SC.PER[i], 0.45, 0.06, N())]);
  const cur = STEPS[S.step];
  return { st, from: st.length ? st[st.length - 1][2] : null, on: cur.tool === 'needle' && !cur.done() };
}
const SCP = {
  id: 'scp', name: 'Laparoscopic sacrocolpopexy', tag: ', onto the cervical stump', blurb: 'Mesh from the kept cervix to the promontory. 11 steps.',
  sub: 'Sacrocervicopexy with a Y-shaped mesh, after supracervical hysterectomy.',
  brief: ['The same 48-year-old with stage III uterovaginal prolapse. The supracervical hysterectomy with bilateral salpingectomy has just been done: the body of the uterus is out in its bag, the cervical stump is dry, and the bladder has been taken down only as far as the amputation needed.',
    'A probe in the vagina has replaced the manipulator and moves the vault. Same ports, steep Trendelenburg, 15 mmHg. The sigmoid lies over the sacral promontory. The plan: expose the promontory, open the peritoneum down to the cul-de-sac, free the vaginal walls from rectum and bladder, fix a Y-shaped mesh to the vagina and cervix and to the promontory, and cover it with peritoneum.'],
  steps: SCP_STEPS, insts: ['grasper', 'bipolar', 'hook', 'suction', 'needle'], warp: [0, 0], tipZ: 4.6, ureters: true, eblWarn: 100,
  needleHint: 'The needle driver is for fixing the mesh and closing the peritoneum',
  cervix: true, probe: true, // the cervix was kept; a probe in the vagina goes on moving the vault
  labels: [['Cervical stump', () => _w.set(0, LS.YA, 0).applyMatrix4(VG.M)], ['Sacral promontory', () => scFloor(0.4, 8.6, 0.2, _w)], ['Left common iliac vein', () => sampleArr(SC.civA, 0.55, _w)], ['Middle sacral vessels', () => scFloor(SC.MSX, 6, 0.1, _w)], ['Mesh', () => _w.set(0, LS.YA + 0.2, 0).applyMatrix4(VG.M), () => S.step >= SC.iP]],
  // The pelvis as the supracervical hysterectomy leaves it: every pedicle sealed and divided, both leaves open, the body of the uterus out.
  state(s) {
    lsState(s, true);
    for (const k of ['R', 'L']) {
      const sd = s.side[k];
      for (const e of ['round', 'uo', 'ua']) { sd[e].cut = true; sd[e].gk = 1; sd[e].seals.push({ u: sd[e].uc, w: SEALSPEC[e].w }); }
      sd.roofCut = true; sd.roofGk = 1; sd.antGoal = sd.antP = sd.postGoal = sd.postP = 1; sd.meso.pGoal = sd.meso.p = 1; sd.tubeGoal = sd.tubeFree = 1; s.mesoBite[k] = 2;
      for (const g of ['upper', 'ua']) { startRelease(AN.side[k], g); sd.rel[g].t = 1; }
    }
    lsHold();
    s.vufGoal = s.vufP = s.vufGk = 1; s.flap = s.flapGoal = 0.5; s.specimen = 'out'; s.lift = 1; s.ureterID.R = s.ureterID.L = true;
    s.pose.push = s.poseGoal.push = 0.3;
    s.scp = { sig: 0, sigP: 0, seen: { P: false, U: false, V: false }, cut: 0, cutGoal: 0, clear: 0, clearP: 0, rv: 0, rvP: 0, fix: [], sac: [], tension: null, per: 0, shut: 0, shutGoal: 0, msv: false, msvT: 0, civ: false };
    SC.rkey = '';
  },
  show(on) { lsShow(); scShow(on); }, update(dt) { lsUpdate(dt); scUpdate(dt); }, heat: scHeat,
  bite(h) { if (h.pick.ent === 'rectum') hint('bowel', 'Do not grasp the bowel wall. Sweep it with a blunt tip, or hold it by its fat.'); },
  score: scScore, debrief: scDebrief, sutures: scSutures,
  // what a scripted hand should find under its tip: a ureter when the prompt names one, otherwise the marked spot with nothing dangerous on it
  want(st, n) {
    const um = /(right|left) ureter/.exec(n.label || ''), bad = ['ureter', 'rectum', 'bladder', 'civ', 'msv', 'iliac'];
    return um ? { ents: ['ureter'], side: um[1] === 'right' ? 'R' : 'L' } : n.act === 'bite' ? { spot: 0.45, avoid: bad } : n.act === 'trace' ? { spot: 0.5, avoid: bad } : null;
  }
};
