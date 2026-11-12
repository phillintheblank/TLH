// ---------- anatomy model ----------
// World frame (scope view): +x = patient's right (screen right), +y = anterior, +z = cephalad (toward the scope). Units: cm.
// Uterus local frame: X = patient's right, Y = cervix->fundus axis, Z = posterior. Y=0 is the colpotomy line on the cup rim.
const PITCH0 = 0.17;
const LIM = { yaw: 0.62, pMin: -0.28, pMax: 1.0 };
const P0 = V(0, -1.6, -5.5);
const NEUTRAL = { yaw: 0, pitch: PITCH0, push: 0 };
const BOWL_YC = -1.3;
const _br = [0, 0];
function bowlR(z, up) { // `up` = max(0, sin theta): the insufflated anterior wall domes up toward the scope
  const w = clamp((4 - z) / 12.5, 0, 1), k = sstep(0, 0.8, w), cap = Math.sqrt(Math.max(0, 1 - sstep(0.72, 1, w)));
  _br[0] = lerp(7.4, 5.2, k) * cap; _br[1] = lerp(5.6, 4.4, k) * cap * (1 + (0.25 + 1.3 * sstep(-7, 4, z)) * (up || 0)); return _br;
}
function bowlPoint(cs, sn, z, inset, out) {
  const r = bowlR(z, Math.max(0, sn)), k = 1 + 0.07 * (fbm3(cs * 1.3 + 5, sn * 1.3 + 2, z * 0.16, 3) - 0.5);
  return out.set((r[0] * k - inset) * cs, BOWL_YC + (r[1] * k - inset) * sn, z);
}
function wallPt(thDeg, z, inset, s) { const th = thDeg * DEG; return bowlPoint(s * Math.cos(th), Math.sin(th), z, inset, new V3()); }
const UT_PROF = [[0, 1.9], [0.35, 1.93], [0.8, 1.64], [1.4, 1.4], [2.2, 1.29], [3.0, 1.3], [3.8, 1.55], [4.8, 2.0], [5.8, 2.4], [6.8, 2.6], [7.5, 2.5], [8.0, 2.1], [8.35, 1.4], [8.55, 0.55], [8.6, 0]];
function utRlin(y) {
  y = clamp(y, 0, 8.6);
  for (let i = 0; i < UT_PROF.length - 1; i++) {
    const a = UT_PROF[i], b = UT_PROF[i + 1];
    if (y <= b[0]) return lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0]));
  }
  return 0;
}
function utR(y) { if (y > 8.2) return utRlin(y); return (utRlin(y - 0.22) + 2 * utRlin(y) + utRlin(y + 0.22)) / 4; }
const utAP = y => lerp(0.94, 0.7, sstep(1.5, 5.5, y));
function utSurf(phiDeg, y, lift, out) {
  const ph = phiDeg * DEG, r = utR(y) + (lift || 0), horn = 1 + 0.1 * Math.exp(-Math.pow((y - 7.3) / 0.8, 2)) * Math.pow(Math.abs(Math.sin(ph)), 3);
  return (out || new V3()).set(r * Math.sin(ph) * horn, y, r * Math.cos(ph) * utAP(y));
}
const _X = new V3(), _Y = new V3(), _Z = new V3(), _O = new V3();
function poseMat(p, M, lift, deliv) {
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  _Y.set(sy * cp, sp, cy * cp);
  _Z.set(0, -1, 0).addScaledVector(_Y, _Y.y).normalize();
  _X.crossVectors(_Y, _Z);
  _O.copy(P0); _O.x += sy * 1.0; _O.y += (p.pitch - PITCH0) * 0.9;
  _O.addScaledVector(_Y, p.push * 1.6 + (lift || 0) * 0.7 - (deliv || 0) * 11);
  const k = 1 - 0.32 * (deliv || 0);
  M.makeBasis(_X.multiplyScalar(k), _Y, _Z.multiplyScalar(k)); M.setPosition(_O);
  return M;
}
const relaxedPose = s => ({ yaw: 0.36 * s, pitch: PITCH0, push: 0 });
function lerpPose(a, b, t, o) { o.yaw = lerp(a.yaw, b.yaw, t); o.pitch = lerp(a.pitch, b.pitch, t); o.push = lerp(a.push, b.push, t); return o; }

const COL = {
  lig: C(214, 150, 140), tube: C(222, 152, 146), fim: C(190, 70, 80), uo: C(214, 150, 140), ip: C(190, 120, 130),
  art: C(186, 66, 62), vein: C(112, 100, 152), ureter: C(232, 204, 184), usl: C(200, 128, 120),
  iliacA: C(204, 112, 102), iliacV: C(146, 116, 146), fold: C(210, 132, 114),
  seal: C(216, 184, 132), blanch: C(238, 220, 206), char: C(92, 56, 34), edge: C(150, 96, 80)
};
const SIDEK = {};
for (const s of [1, -1]) {
  const uaX = V(3.35 * s, -2.4, -4.25), uaO = wallPt(-20, -2.8, 0.25, s);
  SIDEK[s] = {
    ring: wallPt(38, -2.4, 0.15, s), ip: wallPt(-8, 8.5, 0.25, s),
    fa1: V(2.45 * s, 1.2, -3.5), wallAnt: wallPt(22, -4.8, 0.2, s),
    fp1: V(3.0 * s, -2.6, -2.4), fp2: wallPt(-24, 0.8, 0.35, s), fp3: wallPt(-22, 5.5, 0.3, s),
    uaX, uaO, uaM2: V().lerpVectors(uaX, uaO, 0.5).add(V(0, 0.1, -0.3)),
    cl1: V(3.0 * s, -2.9, -5.6), cl2: wallPt(-35, -5.6, 0.2, s),
    ft1: V(4.1 * s, -0.3, -0.8), ft2: wallPt(4, -0.6, 0.3, s),
    uslSac: wallPt(-62, -2.0, 0.1, s)
  };
}
const NS = 33;
class SideGeom {
  constructor(s) {
    this.s = s; this.M = new THREE.Matrix4();
    for (const k of ['round', 'ridge', 'tube', 'tubeAtt', 'floorA', 'floorP', 'ua', 'uv', 'cardLow', 'fatTop']) this[k] = vecArr(NS);
    this.tubeCur = this.tubeAtt; this.ovC = new V3(); this.ovA = new V3();
    this.c = {}; for (const k of ['cR', 'cT', 'cU', 'r1', 'r2', 'ax', 'ovR', 'ovMed', 'ovLat', 'ovTop', 'ipMid', 'fim', 't1', 't2', 'f1', 'f2', 'f3', 'a0', 'a1', 'a2', 'a3', 'm1']) this.c[k] = new V3();
  }
  L(v, x, y, z) { return v.set(x, y, z).applyMatrix4(this.M); }
  compute(M, st, pulls) {
    this.M.copy(M);
    const s = this.s, K = SIDEK[s], c = this.c;
    const cR = this.L(c.cR, 2.4 * s, 6.9, -0.75), cT = this.L(c.cT, 2.55 * s, 7.4, 0.05), cU = this.L(c.cU, 2.4 * s, 6.75, 0.75);
    c.r1.lerpVectors(cR, K.ring, 0.35); c.r1.y -= 0.3; c.r1.z += 0.35;
    c.r2.lerpVectors(cR, K.ring, 0.72); c.r2.y -= 0.15; c.r2.z += 0.15;
    spline([cR, c.r1, c.r2, K.ring], this.round);
    const ax = c.ax.subVectors(K.ip, cU);
    const ovR = c.ovR.copy(cU).addScaledVector(ax, 0.38); ovR.x += 0.5 * s; ovR.y -= 0.4; ovR.z -= 0.4;
    const a = this.ovA.copy(ax).normalize(); a.x += 0.25 * s; a.normalize();
    const ovMed = c.ovMed.copy(ovR).addScaledVector(a, -1.2), ovLat = c.ovLat.copy(ovR).addScaledVector(a, 1.2);
    const ovTop = c.ovTop.copy(ovR); ovTop.y += 0.3;
    const ipMid = c.ipMid.lerpVectors(ovLat, K.ip, 0.5); ipMid.x += 0.25 * s; ipMid.y -= 0.35;
    spline([cU, ovMed, ovTop, ovLat, ipMid, K.ip], this.ridge);
    this.ovC.copy(ovR); this.ovC.x += 0.1 * s; this.ovC.y -= 0.5; this.ovC.z += 0.45;
    const fim = c.fim.copy(ovLat); fim.x += 0.3 * s; fim.y += 0.9; fim.z += 0.3;
    const t1 = c.t1.lerpVectors(cT, fim, 0.35); t1.y += 0.8; t1.z += 0.2;
    const t2 = c.t2.lerpVectors(cT, fim, 0.72); t2.x += 0.5 * s; t2.y += 0.7; t2.z += 0.2;
    spline([cT, t1, t2, fim], this.tubeAtt);
    if (st && st.tubeFree > 0) {
      const k = easeIO(st.tubeFree);
      t1.lerp(this.L(c.f1, 3.3 * s, 7.4, -0.35), k); t2.lerp(this.L(c.f2, 3.65 * s, 6.7, -1.1), k); fim.lerp(this.L(c.f3, 3.2 * s, 5.5, -1.55), k);
      spline([cT, t1, t2, fim], this.tube); this.tubeCur = this.tube;
    } else this.tubeCur = this.tubeAtt;
    spline([this.L(c.a0, 1.21 * s, 3.3, -0.6), K.fa1, K.wallAnt], this.floorA);
    spline([this.L(c.a1, 1.05 * s, 1.6, 0.85), K.fp1, K.fp2, K.fp3], this.floorP);
    const u0 = this.L(c.a2, 1.42 * s, 2.7, 0.05), m1 = c.m1.lerpVectors(u0, K.uaX, 0.5); m1.y += 0.25; m1.z += 0.2;
    spline([u0, m1, K.uaX, K.uaM2, K.uaO], this.ua);
    for (let i = 0; i < NS; i++) { const p = this.ua[i]; this.uv[i].set(p.x + 0.06 * s, p.y - 0.24, p.z - 0.3); }
    spline([this.L(c.a3, 1.75 * s, 0.25, 0.15), K.cl1, K.cl2], this.cardLow);
    spline([this.L(c.a0, 2.1 * s, 5.6, 0), K.ft1, K.ft2], this.fatTop);
    if (pulls) for (const p of pulls) {
      if (p.s !== s) continue;
      const arr = p.curve === 'tube' ? this.tubeCur : this[p.curve];
      sampleArr(arr, p.u, p.nat);
      for (let i = 0; i < NS; i++) {
        const ui = i / (NS - 1), w = Math.exp(-Math.pow((ui - p.u) / 0.2, 2)) * sstep(0, 0.1, ui) * (p.curve === 'tube' ? 1 : sstep(1, 0.9, ui));
        arr[i].addScaledVector(p.off, w);
      }
      if (p.curve === 'ridge') this.ovC.addScaledVector(p.off, Math.exp(-Math.pow((0.4 - p.u) / 0.2, 2)));
    }
    return this;
  }
}

// ---------- simulation state ----------
let S = null;
function newSide(s, name) {
  const ent = uc => ({ uc, cut: false, gk: 0, seals: [], act: null });
  return {
    s, name, round: ent(0.45), uo: ent(0.1), ua: ent(0.14), card: ent(0.2),
    meso: { p: 0, pGoal: 0, seals: [], act: null, cut: false, uc: 0, gk: 0 },
    antP: 0, antGoal: 0, postP: 0, postGoal: 0, roofGk: 0, roofCut: false, tubeFree: 0, tubeGoal: 0,
    rel: { upper: null, ua: null, card: null }
  };
}
function freshState() {
  return {
    t: 0, running: false, ended: false, guided: true, labels: false,
    pose: { yaw: 0, pitch: PITCH0, push: 0 }, poseGoal: { yaw: 0, pitch: PITCH0, push: 0 }, manipOut: false,
    flap: 0, flapGoal: 0, vufP: 0, vufGoal: 0, vufGk: 0,
    side: { R: newSide(1, 'R'), L: newSide(-1, 'L') },
    colp: new Array(16).fill(0), colpDone: false, lift: 0, deliv: 0, specimen: 'in',
    cuff: { stitches: [], pending: null, front: 2.4, frontGoal: 2.4, done: false },
    ebl: 0, pool: 0, bleeders: [], events: [], heat: {}, injuries: {}, pulls: [],
    stats: { activations: 0, energyTime: 0, nonTarget: 0, exchanges: 0, unsealedCuts: 0, nearMiss: 0, minUreter: { R: 99, L: 99 }, expoMiss: 0, traction: 0, blunt: 0 },
    pressure: 15, pressureGoal: 15, lowP: false, oozeDone: false, ureterOK: { R: false, L: false }, ureterID: { R: false, L: false },
    step: 0, haze: 0, flapPush: 0, mesoBite: { R: 0, L: 0 }
  };
}

// ---------- static anatomy ----------
const PICKS = [];
function reg(mesh, ent, side, extra) { mesh.userData = Object.assign({ ent, side: side || null }, extra || {}); PICKS.push(mesh); return mesh; }
const AN = { side: {} };

// pelvic walls and floor
(function () {
  const g = paramSurface(84, 64, (u, v, p, c) => {
    const th = u * TAU, z = 22 - v * 30.5;
    bowlPoint(Math.cos(th), Math.sin(th), z, 0, p);
    const up = Math.sin(th), deep = sstep(2, -8, z);
    c[0] = 1 - 0.1 * deep; c[1] = (1 + 0.1 * Math.max(0, up)) * (1 - 0.16 * deep); c[2] = (1 - 0.06 * Math.max(0, up)) * (1 - 0.16 * deep);
  }, { closedU: true, su: 6, sv: 5 });
  AN.bowl = reg(new THREE.Mesh(g, MAT.perit), 'wall');
  scene.add(AN.bowl);
})();

// rectosigmoid
(function () {
  const ctrl = [V(0, -4.6, -8.6), V(-0.4, -5.7, -5.5), V(-1.4, -6.1, -2), V(-3.3, -5.8, 2), V(-5.1, -5.0, 6), V(-6.5, -3.8, 10), V(-7.4, -2.0, 16)];
  const A = spline(ctrl, vecArr(64));
  const t = new Tube(64, 20, MAT.bowel, 1, 6);
  t.set(A, 0, 1, u => 1.3 * (1 + 0.13 * Math.pow(Math.abs(Math.sin(u * 27 + Math.sin(u * 9))), 0.55) + 0.05 * Math.sin(u * 13 + 1)), null);
  AN.rectum = reg(t.mesh, 'rectum'); AN.rectumArr = A; scene.add(t.mesh);
})();

// iliac vessels, medial umbilical folds, ureters
const URETER = {};
(function () {
  for (const s of [1, -1]) {
    const side = s > 0 ? 'R' : 'L';
    const aA = spline([wallPt(-24, 14, 0.0, s), wallPt(-6, 7, 0.0, s), wallPt(13, 1.5, 0.0, s), wallPt(30, -2.6, 0.05, s)], vecArr(33));
    const aV = spline([wallPt(-36, 14, -0.2, s), wallPt(-17, 7, -0.2, s), wallPt(2, 1.5, -0.2, s), wallPt(20, -2.8, -0.1, s)], vecArr(33));
    const ta = new Tube(33, 12, MAT.cord, 1, 4), tv = new Tube(33, 12, MAT.cord, 1, 4);
    tv.set(aV, 0, 1, () => 0.55, (u, c) => { c[0] = COL.iliacV[0]; c[1] = COL.iliacV[1]; c[2] = COL.iliacV[2]; });
    reg(ta.mesh, 'iliac', side); reg(tv.mesh, 'iliac', side); scene.add(ta.mesh, tv.mesh);
    const uA = spline([wallPt(-41, 12, -0.08, s), wallPt(-34, 8.5, -0.08, s), wallPt(-30, 5, -0.08, s), wallPt(-34, 1.5, -0.08, s), wallPt(-38, -2, 0.02, s), V(3.5 * s, -3.0, -4.5), V(2.7 * s, -2.1, -6.5), V(1.9 * s, -1.0, -8.0)], vecArr(49));
    const tu = new Tube(49, 8, MAT.cord, 1, 5);
    reg(tu.mesh, 'ureter', side); scene.add(tu.mesh);
    URETER[side] = { arr: uA, tube: tu, s, phase: s > 0 ? 0 : 2.6 };
    AN['iliac' + side] = { aA, ta, aV };
  }
})();

// bladder
const BL = { c0: V(0, 0.9, -5.2), c: V(0, 0.9, -5.2), r: V(3.4, 1.6, 2.6) };
(function () {
  const g = paramSurface(40, 28, (u, v, p, c) => {
    const th = u * TAU, sv = Math.sin(Math.PI * v), cv = Math.cos(Math.PI * v);
    const k = 1 + 0.06 * (fbm3(sv * Math.sin(th) * 1.4 + 9, cv * 1.4, sv * Math.cos(th) * 1.4, 3) - 0.5);
    p.set(sv * Math.sin(th) * BL.r.x * k, -cv * BL.r.y * k, sv * Math.cos(th) * BL.r.z * k);
  }, { closedU: true, su: 3, sv: 2 });
  AN.bladder = reg(new THREE.Mesh(g, MAT.bladder), 'bladder'); scene.add(AN.bladder);
})();
function bladderDist(p) {
  const dx = (p.x - BL.c.x) / BL.r.x, dy = (p.y - BL.c.y) / BL.r.y, dz = (p.z - BL.c.z) / (BL.r.z - 0.6 * S.flap), q = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return p.distanceTo(BL.c) * (1 - 1 / Math.max(q, 0.01));
}
function bladderPt(psi, out) { // fold line on the cephalad-posterior dome
  const dx = Math.sin(psi), dy = 0.25, dz = Math.cos(psi) * 0.8 + 0.3, l = Math.hypot(dx, dy, dz);
  return out.set(BL.c.x + (dx / l) * BL.r.x, BL.c.y + (dy / l) * BL.r.y, BL.c.z + (dz / l) * (BL.r.z - 0.6 * S.flap));
}

// uterus (specimen) group
const UT = { g: new THREE.Group(), M: new THREE.Matrix4(), Minv: new THREE.Matrix4() };
UT.g.matrixAutoUpdate = false; scene.add(UT.g);
(function () {
  const g = paramSurface(72, 60, (u, v, p, c) => {
    const y = 8.6 * Math.sin(v * Math.PI / 2);
    utSurf(u * 360, y, 0, p);
    const k = 1 + 0.035 * (fbm3(p.x * 0.55 + 3, p.y * 0.55, p.z * 0.55 + 7, 3) - 0.5);
    p.x *= k; p.z *= k;
    const cx = sstep(3.6, 2.0, y), rim = sstep(0.75, 0.2, y);
    c[0] = 1 + 0.1 * cx + 0.12 * rim; c[1] = 1 + 0.22 * cx + 0.3 * rim; c[2] = 1 + 0.2 * cx + 0.3 * rim;
  }, { closedU: true, su: 3, sv: 3 });
  UT.mesh = reg(new THREE.Mesh(g, MAT.uterus), 'uterus'); UT.g.add(UT.mesh);
  // ascending uterine vessels along the lateral margin
  for (const s of [1, -1]) {
    const A = spline([V(1.34 * s, 2.7, 0.05), V(1.62 * s, 3.8, 0.14), V(2.12 * s, 5.0, 0.02), V(2.5 * s, 6.2, 0.12), V(2.5 * s, 7.0, 0.1)], vecArr(25));
    for (let i = 0; i < 25; i++) { A[i].z += Math.sin(i * 1.3) * 0.07; A[i].y += Math.cos(i * 1.7) * 0.03; }
    const t = new Tube(25, 6, MAT.cord, 1, 2);
    t.set(A, 0, 1, u => 0.12 - 0.04 * u, (u, c) => { c[0] = COL.art[0] * 0.6; c[1] = COL.art[1] * 0.7; c[2] = COL.art[2] * 0.9; });
    UT.g.add(t.mesh);
  }
  // colpotomy cup (visible once the uterus is free) and colpotomy cut segments
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.6, 1.0, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x7db4d8, roughness: 0.38, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.6 }));
  cup.position.y = -0.22; UT.g.add(cup);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshStandardMaterial({ color: 0xc66a74, roughness: 0.6 }));
  cap.rotation.x = Math.PI / 2; cap.position.y = 0.26; UT.g.add(cap);
  UT.segs = [];
  const sm = new THREE.MeshBasicMaterial({ color: 0x1c0b08 });
  for (let k = 0; k < 16; k++) {
    const sg = new THREE.TorusGeometry(1.95, 0.085, 6, 5, TAU / 16);
    sg.rotateZ((k / 16) * TAU - TAU / 32); sg.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(sg, sm); m.scale.z = 0.94; m.position.y = 0.08; m.visible = false; UT.g.add(m); UT.segs.push(m);
  }
})();
function colpPt(k, out) { const a = (k / 16) * TAU; return out.set(1.95 * Math.cos(a), 0.1, 1.95 * Math.sin(a) * 0.94).applyMatrix4(UT.M); }

// vagina and cuff
const CUFF_PROF = [[1.84, -7], [1.84, -3], [1.86, -0.9], [1.86, -0.08], [1.72, 0.1], [1.5, 0.04], [1.44, -0.6], [1.4, -2.5], [1.3, -6]];
const VG = { g: new THREE.Group(), M: new THREE.Matrix4(), pose: { yaw: 0, pitch: PITCH0, push: 0 } };
VG.g.matrixAutoUpdate = false; scene.add(VG.g);
const cuffClose = x => sstep(S.cuff.front - 0.22, S.cuff.front + 0.22, x);
function cuffLocal(phi, f, out) { // f in [0, CUFF_PROF.length-1]
  const i = Math.min(Math.floor(f), CUFF_PROF.length - 2), t = f - i, a = CUFF_PROF[i], b = CUFF_PROF[i + 1];
  const r = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), x = r * Math.sin(phi);
  const z = r * Math.cos(phi) * 0.94 * (1 - cuffClose(x) * sstep(-2.6, -0.3, y) * 0.97);
  return out.set(x, y, z);
}
(function () {
  const nu = 112, nv = (CUFF_PROF.length - 1) * 5, cols = nu + 1, rows = nv + 1;
  const g = paramSurface(nu, nv, (u, v, p, c) => {
    p.set(0, 0, 0);
    const f = v * (CUFF_PROF.length - 1);
    if (f > 4.4) { c[0] = 0.62; c[1] = 0.42; c[2] = 0.46; }
  }, { su: 3, sv: 2 });
  VG.geo = g; VG.cols = cols; VG.rows = rows; VG.nu = nu; VG.nv = nv; VG.dirty = true; VG.lastFront = 99;
  VG.mesh = reg(new THREE.Mesh(g, MAT.vag), 'vagina'); VG.g.add(VG.mesh);
  const occ = new THREE.Mesh(new THREE.CircleGeometry(1.42, 28), new THREE.MeshBasicMaterial({ color: 0x240a0e }));
  occ.rotation.x = -Math.PI / 2; occ.position.y = -2.6; VG.g.add(occ);
  g.boundingSphere = BIG_SPHERE(); VG.mesh.frustumCulled = false;
})();
function updateCuff() {
  if (Math.abs(S.cuff.front - VG.lastFront) < 1e-4 && !VG.dirty) return;
  VG.lastFront = S.cuff.front; VG.dirty = false;
  const pos = VG.geo.attributes.position.array, col = VG.geo.attributes.color.array, p = new V3(), n = CUFF_PROF.length - 1;
  for (let j = 0; j < VG.rows; j++) for (let i = 0; i < VG.cols; i++) {
    const f = (j / VG.nv) * n; cuffLocal((i / VG.nu) * TAU, f, p);
    const k = (j * VG.cols + i) * 3; pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    if (f > 2.6 && f <= 4.4) { const q = S.colpDone ? 1 : 0; col[k] = lerp(1, 0.86, q); col[k + 1] = lerp(1, 0.6, q); col[k + 2] = lerp(1, 0.5, q); }
  }
  VG.geo.attributes.position.needsUpdate = true; VG.geo.attributes.color.needsUpdate = true;
  VG.geo.computeVertexNormals();
  const nr = VG.geo.attributes.normal.array;
  for (let j = 0; j < VG.rows; j++) {
    const a = j * VG.cols * 3, b = (j * VG.cols + VG.nu) * 3;
    const x = nr[a] + nr[b], y = nr[a + 1] + nr[b + 1], z = nr[a + 2] + nr[b + 2], l = Math.hypot(x, y, z) || 1;
    nr[a] = nr[b] = x / l; nr[a + 1] = nr[b + 1] = y / l; nr[a + 2] = nr[b + 2] = z / l;
  }
}
// world point on the outer cuff wall: x in cuff-local cm, edge 'ant'|'post', depth below the rim
function cuffPt(x, edge, depth, out) {
  const r = 1.86, sn = clamp(x / r, -0.995, 0.995), phi = edge === 'post' ? Math.asin(sn) : Math.PI - Math.asin(sn);
  const f = 3 - clamp(depth / 0.82, 0, 1); // profile index 3 = rim outer edge, 2 = 0.82 cm below
  return cuffLocal(phi, f, out).applyMatrix4(VG.M);
}

// ---------- dynamic structures per side ----------
function mkSide(name, s) {
  const sd = { name, s, cur: new SideGeom(s), t: {}, st: {} };
  const T = (k, n, m, ent, extra) => { const t = new Tube(n, m, MAT.cord, 1, 3); reg(t.mesh, ent, name, Object.assign({ tube: t, piece: k }, extra)); t.mesh.matrixAutoUpdate = false; scene.add(t.mesh); sd.t[k] = t; return t; };
  T('roundA', 26, 10, 'round'); T('roundB', 26, 10, 'round');
  T('uoA', 12, 10, 'uo'); T('uoB', 12, 10, 'uo'); T('ip', 16, 10, 'ip');
  T('tube', 30, 10, 'tube');
  T('uaA', 14, 8, 'ua'); T('uaB', 32, 8, 'ua'); T('uvA', 14, 8, 'ua'); T('uvB', 32, 8, 'ua');
  T('usl', 14, 8, 'usl');
  const P = (k, ns, nt, mat, ent, uvS, uvT) => { const p = new Strip(ns, nt, mat, uvS, uvT); reg(p.mesh, ent, name, { strip: p, piece: k }); p.mesh.matrixAutoUpdate = false; scene.add(p.mesh); sd.st[k] = p; return p; };
  P('antM', 8, 9, MAT.leaf, 'ant', 0.5, 1); P('antL', 12, 9, MAT.leaf, 'ant', 1, 1);
  P('roofM', 8, 9, MAT.leaf, 'roof', 0.5, 1); P('roofL', 12, 9, MAT.leaf, 'roof', 1.4, 1.4);
  P('postM', 8, 9, MAT.leaf, 'post', 0.5, 1); P('postL', 12, 9, MAT.leaf, 'post', 1.4, 1.2);
  P('mesoM', 5, 6, MAT.leaf, 'meso', 0.3, 0.5); P('mesoL', 14, 6, MAT.leaf, 'meso', 1, 0.5);
  P('cardM', 6, 8, MAT.card, 'card', 0.4, 1); P('cardL', 12, 8, MAT.card, 'card', 1, 1);
  P('areolar', 14, 8, MAT.areolar, 'areolar', 1.5, 1.2);
  const og = paramSurface(28, 20, (u, v, p) => {
    const th = u * TAU, sv = Math.sin(Math.PI * v), cv = Math.cos(Math.PI * v);
    const k = 1 + 0.16 * (fbm3(sv * Math.sin(th) * 2.2 + s * 4, cv * 2.2 + 1, sv * Math.cos(th) * 2.2, 2) - 0.5);
    p.set(-cv * 1.3 * k, sv * Math.sin(th) * 0.85 * k, sv * Math.cos(th) * 0.7 * k);
  }, { closedU: true, su: 2, sv: 1, flip: true });
  sd.ovary = reg(new THREE.Mesh(og, MAT.ovary), 'ovary', name); scene.add(sd.ovary);
  sd.uslArr = vecArr(17);
  return sd;
}
AN.side.R = mkSide('R', 1); AN.side.L = mkSide('L', -1);

// vesicouterine peritoneum: upper sliver rides the uterus, lower part rides the bladder
const VUF = {
  up: new Strip(13, 4, MAT.leaf, 1.2, 0.3), lo: new Strip(13, 6, MAT.leaf, 1.2, 0.6),
  e0: vecArr(13), e0b: vecArr(13), e1: vecArr(13), q: vecArr(13)
};
reg(VUF.up.mesh, 'vuf'); reg(VUF.lo.mesh, 'vuf'); scene.add(VUF.up.mesh, VUF.lo.mesh);

// blood pool in the cul-de-sac
const POOL = new THREE.Mesh(new THREE.CircleGeometry(9, 40), MAT.blood);
POOL.rotation.x = -Math.PI / 2 + 0.06; POOL.position.set(0, -7, -1.5); POOL.visible = false; scene.add(POOL);

const IDENT = new THREE.Matrix4();
const _tp = {}, _tp2 = {}, _a = new V3(), _b = new V3(), _m4 = new THREE.Matrix4();
function setM(mesh, M) { mesh.matrix.copy(M); mesh.matrixWorldNeedsUpdate = true; }
function startRelease(sd, g) {
  const st = S.side[sd.name];
  if (st.rel[g]) return;
  st.rel[g] = { t: 0, from: Object.assign({}, S.pose), ref: new SideGeom(sd.s), lat: new SideGeom(sd.s), T: new THREE.Matrix4(), settled: false };
}
function grp(sd, g) {
  const r = S.side[sd.name].rel[g];
  return r ? r : null;
}
function stripPt(E0, u0, E1, u1, v, sag, out) {
  sampleArr(E0, u0, _a); sampleArr(E1, u1, _b); out.lerpVectors(_a, _b, v);
  if (sag) out.y -= sag * Math.sin(Math.PI * v);
  return out;
}
// A bipolar seal on a cord: the band the jaws compressed is desiccated to tan and loses its wet film, its margins
// are scorched, and heat blanches the tissue a little way beyond. p is seal progress, 0..1.
function sealPaint(c, d, p, fleck) {
  const halo = (1 - sstep(1.0, 2.3, d)) * 0.5 * p, k = (1 - sstep(0.9, 1.08, d)) * p, edge = Math.exp(-Math.pow((d - 0.98) / 0.13, 2)) * p * (0.7 + 0.3 * fleck);
  c[0] = lerp(c[0], COL.blanch[0], halo); c[1] = lerp(c[1], COL.blanch[1], halo); c[2] = lerp(c[2], COL.blanch[2], halo);
  const t = k * (0.82 + 0.18 * fleck);
  c[0] = lerp(c[0], COL.seal[0], t); c[1] = lerp(c[1], COL.seal[1], t); c[2] = lerp(c[2], COL.seal[2], t);
  c[0] = lerp(c[0], COL.char[0], edge); c[1] = lerp(c[1], COL.char[1], edge); c[2] = lerp(c[2], COL.char[2], edge);
  c[3] = Math.max(c[3], k, edge);
}
const fleckAt = u => 0.5 + 0.5 * Math.sin(u * 733.1) * Math.sin(u * 291.7 + 1.3);
// how much of a cord at u has been sealed (0..1), counting a seal in progress: sealed tissue shrinks
function sealK(e, u) {
  let k = 0;
  for (let i = 0; i < e.seals.length; i++) { const z = e.seals[i]; k = Math.max(k, 1 - sstep(z.w * 0.85, z.w * 1.15, Math.abs(u - z.u))); }
  if (e.act) k = Math.max(k, (1 - sstep(e.act.w * 0.85, e.act.w * 1.15, Math.abs(u - e.act.u))) * e.act.p);
  return k;
}
function cordCol(e, base, gapHalf) {
  return (u, c) => {
    c[0] = base[0]; c[1] = base[1]; c[2] = base[2];
    const fl = fleckAt(u);
    for (let i = 0; i < e.seals.length; i++) { const z = e.seals[i]; sealPaint(c, Math.abs(u - z.u) / z.w, 1, fl); }
    if (e.act) sealPaint(c, Math.abs(u - e.act.u) / e.act.w, e.act.p, fl);
    if (e.cut) {
      const k = (1 - sstep(0, 0.03, Math.abs(u - e.uc) - gapHalf * e.gk)) * 0.8;
      c[0] = lerp(c[0], COL.char[0], k); c[1] = lerp(c[1], COL.char[1], k); c[2] = lerp(c[2], COL.char[2], k); c[3] = Math.max(c[3], k);
    }
  };
}
const taper = (u, uEnd, gk, w) => { const q = clamp(1 - Math.abs(uEnd - u) / (w || 0.035), 0, 1); return lerp(1, Math.sqrt(Math.max(0.03, 1 - q * q)), gk); };
// Edge of peritoneum cut with energy: a pale, dry margin with a scorched rim
function edgeCol(c, m, prox) {
  const k1 = m * sstep(0.55, 0.9, prox), k2 = m * sstep(0.88, 1, prox);
  c[0] = lerp(lerp(1, 1.1, k1), 0.5, k2); c[1] = lerp(lerp(1, 1.04, k1), 0.33, k2); c[2] = lerp(lerp(1, 0.96, k1), 0.24, k2); c[3] = Math.max(k1 * 0.8, k2);
}
// a seal across a sheet of tissue (mesosalpinx, cardinal web); colours multiply the sheet's own texture
function sheetSeal(c, d, p) {
  const halo = (1 - sstep(1.0, 2.0, d)) * 0.4 * p, k = (1 - sstep(0.88, 1.06, d)) * p, edge = Math.exp(-Math.pow((d - 0.97) / 0.14, 2)) * p * 0.7;
  c[0] = lerp(c[0], 1.14, halo); c[1] = lerp(c[1], 1.14, halo); c[2] = lerp(c[2], 1.14, halo);
  c[0] = lerp(c[0], 1.06, k); c[1] = lerp(c[1], 0.98, k); c[2] = lerp(c[2], 0.76, k);
  c[0] = lerp(c[0], 0.46, edge); c[1] = lerp(c[1], 0.3, edge); c[2] = lerp(c[2], 0.2, edge);
  c[3] = Math.max(c[3], k, edge);
}
const pulse = t => { const x = (t * 1.25) % 1; return Math.exp(-Math.pow((x - 0.15) / 0.09, 2)) + 0.35 * Math.exp(-Math.pow((x - 0.42) / 0.12, 2)); };

function updateSide(sd, time) {
  const st = S.side[sd.name], s = sd.s, cur = sd.cur;
  cur.compute(UT.M, st, S.pulls);
  for (const g of ['upper', 'ua', 'card']) {
    const r = st.rel[g]; if (!r) continue;
    if (!r.settled) {
      const e = easeIO(r.t);
      r.ref.compute(poseMat(lerpPose(r.from, NEUTRAL, e, _tp), _m4), st, null);
      r.lat.compute(poseMat(lerpPose(r.from, relaxedPose(s), e, _tp2), _m4), st, null);
      if (r.t >= 1) r.settled = true;
    }
    r.T.copy(r.ref.M).invert().premultiply(UT.M);
  }
  const U = grp(sd, 'upper'), A = grp(sd, 'ua'), Cg = grp(sd, 'card');
  const Um = U ? U.ref : cur, Ul = U ? U.lat : cur, UT_ = U ? U.T : IDENT;
  const Am = A ? A.ref : cur, Al = A ? A.lat : cur, AT = A ? A.T : IDENT;
  const Cm = Cg ? Cg.ref : cur, Cl = Cg ? Cg.lat : cur, CT = Cg ? Cg.T : IDENT;
  const t = sd.t, p = sd.st;

  // round ligament
  const rd = st.round, uR = rd.uc, gR = 0.07 * rd.gk;
  t.roundA.set(Um.round, 0, uR - gR, u => 0.2 * taper(u, uR - gR, rd.gk) * (1 - 0.3 * sealK(rd, u)), cordCol(rd, COL.lig, 0.07)); setM(t.roundA.mesh, UT_);
  t.roundB.set(Ul.round, uR + gR, 1, u => 0.2 * taper(u, uR + gR, rd.gk) * (1 - 0.3 * sealK(rd, u)), cordCol(rd, COL.lig, 0.07));
  // utero-ovarian ligament, ovary, IP ligament (ridge)
  const uo = st.uo, uU = uo.uc, gU = 0.035 * uo.gk;
  t.uoA.set(Um.ridge, 0, uU - gU, u => 0.23 * taper(u, uU - gU, uo.gk, 0.02) * (1 - 0.3 * sealK(uo, u)), cordCol(uo, COL.uo, 0.035)); setM(t.uoA.mesh, UT_);
  t.uoB.set(Ul.ridge, uU + gU, 0.22, u => 0.23 * taper(u, uU + gU, uo.gk, 0.02) * (1 - 0.3 * sealK(uo, u)), cordCol(uo, COL.uo, 0.035));
  t.ip.set(Ul.ridge, 0.56, 1, u => 0.3 + 0.06 * Math.sin(u * 40), (u, c) => { const k = 0.5 + 0.5 * Math.sin(u * 55); c[0] = lerp(COL.ip[0], COL.lig[0], k); c[1] = lerp(COL.ip[1], COL.lig[1], k); c[2] = lerp(COL.ip[2], COL.lig[2], k); });
  sd.ovary.position.copy(Ul.ovC); sd.ovary.quaternion.setFromUnitVectors(_a.set(1, 0, 0), Ul.ovA);
  // fallopian tube
  t.tube.set(cur.tubeCur, 0, 1, u => lerp(0.15, 0.27, sstep(0.15, 0.8, u)) + 0.2 * sstep(0.9, 1, u), (u, c) => { const k = sstep(0.86, 1, u); c[0] = lerp(COL.tube[0], COL.fim[0], k); c[1] = lerp(COL.tube[1], COL.fim[1], k); c[2] = lerp(COL.tube[2], COL.fim[2], k); });
  // uterine artery + vein
  const ua = st.ua, uA = ua.uc, gA = 0.045 * ua.gk, pl = 1 + 0.07 * pulse(time), dead = ua.cut ? 1 : pl;
  t.uaA.set(Am.ua, 0, uA - gA, u => 0.17 * dead * taper(u, uA - gA, ua.gk, 0.03) * (1 - 0.3 * sealK(ua, u)), cordCol(ua, COL.art, 0.045)); setM(t.uaA.mesh, AT);
  t.uaB.set(Al.ua, uA + gA, 1, u => 0.17 * pl * taper(u, uA + gA, ua.gk, 0.03) * (1 - 0.3 * sealK(ua, u)), cordCol(ua, COL.art, 0.045));
  t.uvA.set(Am.uv, 0, uA - gA, u => 0.22 * taper(u, uA - gA, ua.gk, 0.03) * (1 - 0.35 * sealK(ua, u)), cordCol(ua, COL.vein, 0.045)); setM(t.uvA.mesh, AT);
  t.uvB.set(Al.uv, uA + gA, 1, u => 0.22 * taper(u, uA + gA, ua.gk, 0.03) * (1 - 0.35 * sealK(ua, u)), cordCol(ua, COL.vein, 0.045));
  // uterosacral ligament (stays with the vaginal cuff)
  _a.set(1.0 * s, -0.2, 1.5).applyMatrix4(VG.M); _b.lerpVectors(_a, SIDEK[s].uslSac, 0.5); _b.y -= 0.35; _b.x += 0.3 * s;
  spline([_a, _b, SIDEK[s].uslSac], sd.uslArr);
  t.usl.set(sd.uslArr, 0, 1, u => 0.2 + 0.12 * u, (u, c) => { c[0] = COL.usl[0]; c[1] = COL.usl[1]; c[2] = COL.usl[2]; });

  // anterior leaf
  const antMask = v => Math.max(rd.gk * sstep(0.72, 1, v), st.antP > 0 ? sstep(1 - st.antP - 0.12, 1 - st.antP + 0.02, v) : 0);
  const antG = 0.07 + 0.05 * sstep(0.9, 1, st.antP);
  p.antM.update((sx, v, o, c) => { const m = antMask(v), ucv = 0.03 + (uR - 0.03) * v, u = sx * Math.max(0, ucv - antG * m); stripPt(Um.floorA, u, Um.round, u, v, 0.22, o); edgeCol(c, m, sx); }); setM(p.antM.mesh, UT_);
  p.antL.update((sx, v, o, c) => { const m = antMask(v), ucv = 0.03 + (uR - 0.03) * v, u = lerp(ucv + antG * m, 1, sx); stripPt(Ul.floorA, u, Ul.round, u, v, 0.22, o); edgeCol(c, m, 1 - sx); });
  p.antM.map = (sx, v) => [sx * (0.03 + (uR - 0.03) * v), v]; p.antL.map = (sx, v) => [lerp(0.03 + (uR - 0.03) * v, 1, sx), v];
  // roof (round ligament to utero-ovarian/IP ridge)
  const roofMask = v => Math.max(st.roofGk, rd.gk * sstep(0.28, 0, v), uo.gk * sstep(0.72, 1, v));
  p.roofM.update((sx, v, o, c) => { const m = roofMask(v), ucv = uR + (uU - uR) * v, u = sx * Math.max(0, ucv - 0.07 * m); stripPt(Um.round, u, Um.ridge, u, v, 0.3, o); edgeCol(c, m, sx); }); setM(p.roofM.mesh, UT_);
  p.roofL.update((sx, v, o, c) => { const m = roofMask(v), ucv = uR + (uU - uR) * v, u = lerp(ucv + 0.07 * m, 1, sx); stripPt(Ul.round, u, Ul.ridge, u, v, 0.3, o); edgeCol(c, m, 1 - sx); });
  // posterior leaf
  const postMask = v => Math.max(uo.gk * sstep(0.28, 0, v), st.postP > 0 ? 1 - sstep(st.postP - 0.02, st.postP + 0.12, v) : 0);
  const postG = 0.05 + 0.05 * sstep(0.9, 1, st.postP);
  p.postM.update((sx, v, o, c) => { const m = postMask(v), ucv = uU - (uU - 0.03) * v, u = sx * Math.max(0, ucv - postG * m); stripPt(Um.ridge, u, Um.floorP, u, v, 0.3, o); edgeCol(c, m, sx); }); setM(p.postM.mesh, UT_);
  p.postL.update((sx, v, o, c) => { const m = postMask(v), ucv = uU - (uU - 0.03) * v, u = lerp(ucv + postG * m, 1, sx); stripPt(Ul.ridge, u, Ul.floorP, u, v, 0.3, o); edgeCol(c, m, 1 - sx); });
  p.postM.map = (sx, v) => [sx * (uU - (uU - 0.03) * v), v]; p.postL.map = (sx, v) => [lerp(uU - (uU - 0.03) * v, 1, sx), v];
  // mesosalpinx fin (ridge up to the tube)
  const wU = uU / 0.6, me = st.meso;
  const mesoMask = w => (me.p > 0 ? sstep(1 - me.p - 0.07, 1 - me.p + 0.02, w) : 0);
  const mesoFn = (G, w, v, o, c) => {
    const m = mesoMask(w), vv = v * (1 - 0.55 * m); stripPt(G.ridge, 0.6 * w, G.tubeAtt, w, vv, 0, o); edgeCol(c, m, v);
    for (const z of me.seals) sheetSeal(c, Math.abs(w - z.u) / (z.w * 0.55), 1);
    if (me.act) sheetSeal(c, Math.abs(w - me.act.u) / (me.act.w * 0.55), me.act.p);
  };
  p.mesoM.update((sx, v, o, c) => mesoFn(Um, sx * Math.max(0, wU - 0.05 * uo.gk), v, o, c)); setM(p.mesoM.mesh, UT_);
  p.mesoL.update((sx, v, o, c) => mesoFn(Ul, lerp(wU + 0.05 * uo.gk, 1, sx), v, o, c));
  p.mesoM.map = (sx, v) => [sx * wU, v]; p.mesoL.map = (sx, v) => [lerp(wU, 1, sx), v];
  // cardinal ligament / parametrium web
  const cd = st.card, uC = cd.uc, gC = 0.06 * cd.gk;
  const cardCol = (c, u, prox) => {
    edgeCol(c, cd.gk * 0.9, prox);
    for (const z of cd.seals) sheetSeal(c, Math.abs(u - z.u) / z.w, 1);
    if (cd.act) sheetSeal(c, Math.abs(u - cd.act.u) / cd.act.w, cd.act.p);
  };
  p.cardM.update((sx, v, o, c) => { const u = sx * Math.max(0, uC - gC); stripPt(Cm.cardLow, u, Cm.ua, u, v, 0.08, o); cardCol(c, u, sx); }); setM(p.cardM.mesh, CT);
  p.cardL.update((sx, v, o, c) => { const u = lerp(uC + gC, 1, sx); stripPt(Cl.cardLow, u, Cl.ua, u, v, 0.08, o); cardCol(c, u, 1 - sx); });
  p.cardM.map = (sx, v) => [sx * uC, v]; p.cardL.map = (sx, v) => [lerp(uC, 1, sx), v];
  // areolar tissue over the vessels, cleared as the posterior leaf is opened
  const skel = st.postP;
  p.areolar.mesh.visible = skel < 0.97 && !U;
  if (p.areolar.mesh.visible) p.areolar.update((sx, v, o) => { stripPt(cur.ua, sx, cur.fatTop, sx, v * (1 - skel), 0.1, o); });
}

function updateAnatomy(dt, time) {
  // manipulator pose
  const P = S.pose, G = S.poseGoal, rate = 4.5;
  P.yaw = damp(P.yaw, G.yaw, rate, dt); P.pitch = damp(P.pitch, G.pitch, rate, dt); P.push = damp(P.push, G.push, rate, dt);
  if (S.specimen !== 'out') { VG.pose.yaw = P.yaw; VG.pose.pitch = P.pitch; VG.pose.push = P.push; }
  else { VG.pose.yaw = damp(VG.pose.yaw, 0, 2.5, dt); VG.pose.pitch = damp(VG.pose.pitch, -0.38, 2.5, dt); VG.pose.push = damp(VG.pose.push, 0.3, 2.5, dt); }
  poseMat(VG.pose, VG.M); setM(VG.g, VG.M);
  poseMat(P, UT.M, S.lift, S.deliv); UT.Minv.copy(UT.M).invert(); setM(UT.g, UT.M);
  UT.g.visible = S.specimen !== 'out';
  // eased state
  S.flap = damp(S.flap, S.flapGoal, 3.5, dt);
  S.vufP = damp(S.vufP, S.vufGoal, 9, dt);
  S.vufGk = damp(S.vufGk, S.vufGoal >= 1 ? 1 : 0, 4, dt);
  S.cuff.front = damp(S.cuff.front, S.cuff.frontGoal, 8, dt);
  if (S.colpDone && S.specimen === 'in') S.lift = damp(S.lift, 1, 3, dt);
  if (S.specimen === 'delivering') { S.deliv = Math.min(1, S.deliv + dt / 1.6); if (S.deliv >= 1) { S.specimen = 'out'; S.manipOut = true; onSpecimenOut(); } }
  for (const k of ['R', 'L']) {
    const st = S.side[k];
    for (const e of ['round', 'uo', 'ua', 'card']) st[e].gk = damp(st[e].gk, st[e].cut ? 1 : 0, 7, dt);
    st.antP = damp(st.antP, st.antGoal, 9, dt); st.postP = damp(st.postP, st.postGoal, 9, dt);
    st.meso.p = damp(st.meso.p, st.meso.pGoal, 6, dt);
    st.roofGk = damp(st.roofGk, st.roofCut ? 1 : 0, 5, dt);
    st.tubeFree = Math.min(1, st.tubeFree + (st.tubeGoal > st.tubeFree ? dt / 1.1 : 0));
    for (const g of ['upper', 'ua', 'card']) { const r = st.rel[g]; if (r && r.t < 1) r.t = Math.min(1, r.t + dt / 0.9); }
  }
  // bladder
  BL.c.set(BL.c0.x, BL.c0.y + 0.4 * S.flap, BL.c0.z - 3.4 * S.flap - 2.3 * Math.max(0, S.pose.pitch - PITCH0) * (1 - 0.5 * S.flap));
  AN.bladder.position.copy(BL.c); AN.bladder.scale.z = (BL.r.z - 0.6 * S.flap) / BL.r.z;
  for (const k of ['R', 'L']) {
    const sd = AN.side[k], vis = S.specimen !== 'out';
    updateSide(sd, time);
    if (!vis) for (const m of [sd.t.roundA, sd.t.uoA, sd.t.tube, sd.t.uaA, sd.t.uvA]) m.mesh.visible = false;
    for (const m of ['antM', 'roofM', 'postM', 'mesoM', 'cardM']) sd.st[m].mesh.visible = vis;
    // ureters with peristalsis, iliac pulse
    const U = URETER[k], ph = ((time + U.phase) % 5.2) / 1.7;
    U.tube.set(U.arr, 0, 1, u => 0.165 * (1 + 0.42 * Math.exp(-Math.pow((u - ph + 0.1) / 0.07, 2)) - 0.2 * Math.exp(-Math.pow((u - ph + 0.24) / 0.06, 2))),
      (u, c) => { const inj = S.injuries['ureter' + k]; let r = COL.ureter[0], g = COL.ureter[1], b = COL.ureter[2]; if (inj) { const q = 1 - sstep(0.02, 0.06, Math.abs(u - inj.u)); r = lerp(r, 1, q); g = lerp(g, 0.95, q); b = lerp(b, 0.85, q); } c[0] = r; c[1] = g; c[2] = b; });
    const I = AN['iliac' + k], pl = 1 + 0.035 * pulse(time);
    I.ta.set(I.aA, 0, 1, () => 0.47 * pl, (u, c) => { c[0] = COL.iliacA[0]; c[1] = COL.iliacA[1]; c[2] = COL.iliacA[2]; });
  }
  // vesicouterine peritoneum
  const gk = S.vufGk, cutMask = u => (S.vufP > 0 ? sstep(1 - S.vufP - 0.1, 1 - S.vufP + 0.02, u) : 0);
  for (let i = 0; i < 13; i++) {
    const u = i / 12; // anterior surface, patient's left -> right as u goes 0 -> 1
    utSurf(180 - lerp(-60, 60, u), 3.3, 0.03, VUF.e0[i]).applyMatrix4(UT.M);
    utSurf(180 - lerp(-60, 60, u), 2.75, 0.06, VUF.e0b[i]).applyMatrix4(UT.M);
    bladderPt(lerp(-55, 55, u) * DEG, VUF.e1[i]);
    VUF.q[i].copy(VUF.e1[i]); VUF.q[i].y -= 0.75; VUF.q[i].z += 0.55;
  }
  const VC = 0.35;
  VUF.up.mesh.visible = S.specimen !== 'out';
  VUF.up.update((sx, t, o, c) => {
    const m = cutMask(sx), v = t * (VC - 0.1 * m);
    sampleArr(VUF.e0, sx, _a); sampleArr(VUF.e1, sx, _b); o.lerpVectors(_a, _b, v);
    if (gk > 0) { sampleArr(VUF.e0b, sx, _b); _b.lerpVectors(_a, _b, t); o.lerp(_b, gk); }
    edgeCol(c, m, t);
  });
  VUF.lo.update((sx, t, o, c) => {
    const m = cutMask(sx), v = lerp(VC + 0.1 * m, 1, t);
    sampleArr(VUF.e0, sx, _a); sampleArr(VUF.e1, sx, _b); o.lerpVectors(_a, _b, v);
    if (gk > 0) { sampleArr(VUF.q, sx, _a); _a.lerpVectors(_a, _b, t); o.lerp(_a, gk); }
    edgeCol(c, m, 1 - t);
  });
  // colpotomy segments, cuff, pool
  for (let k = 0; k < 16; k++) UT.segs[k].visible = S.colp[k] >= 1 && !S.colpDone;
  updateCuff();
  POOL.visible = S.pool > 2;
  if (POOL.visible) POOL.position.y = -6.95 + 2.3 * Math.pow(Math.min(S.pool, 600) / 300, 0.45);
}
function vufPt(u, out) { sampleArr(VUF.e0, u, _a); sampleArr(VUF.e1, u, _b); return out.lerpVectors(_a, _b, 0.35); }
function flapEdgePt(u, out) { // hanging edge of the bladder peritoneum = where to sweep
  sampleArr(VUF.q, u, out); return out;
}
