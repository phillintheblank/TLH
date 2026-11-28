// ---------- case: pelvic anatomy ----------
// Not an operation. A walk round the pelvis that names what a gynecologic surgeon has to know on sight, and then asks
// for it back. The pelvis of the other cases is used as it stands. This file adds what they do not need: the folds of
// the anterior wall, the landmarks of the pelvic brim, and the retroperitoneum of the sidewall (vessels, nerves and
// the avascular spaces). The retroperitoneum is shown by opening a window in the peritoneum, not by dissecting.
const AX = {
  on: false, picks: [], c: { R: {}, L: {} }, win: {}, nCap: 0, shell: {}, dirty: true, sig: 0, sigP: 0, rv: 0, rvP: 0, blad: 0, bladP: 0, lift: null, sigKey: '',
  mode: 'tour', set: 'all', seed: 1 // what the start sheet has chosen: tour | find | name, and surface | retro | all
};
const COLX = { nerve: C(240, 232, 204), perit: C(224, 164, 158), umb: C(214, 150, 132), urachus: C(226, 176, 160) };
const _x1 = new V3(), _x2 = new V3(), _x3 = new V3(), _xs = new V3(), _xq = new V3();
const axS = k => (k === 'R' ? 1 : -1);

// ---------- where things lie ----------
// A place on the pelvic wall is [th, z, d]: th degrees round the wall from the side (0) toward the front (90) or the
// back (-90), on the named side; z along the pelvis (cephalad positive); d how far under the peritoneum, in cm (a
// negative d stands proud of it, as a fold does). The promontory and the spine above it stand out of the back wall.
// Psoas is a low swell of the wall lateral to the iliac artery (AX_IA is the artery's course, common then external).
// It divides at the brim where the infundibulopelvic ligament reaches the wall, and the external iliac runs along the
// lateral edge of the broad ligament's roof (the pelvic sidewall triangle) to the inguinal ligament, below the deep ring.
const AX_IA = [[-80, 15.5, 0.05], [-62, 13.6, 0.05], [-41, 11.8, 0.05], [-18, 10.2, 0], [-2, 7.0, -0.12], [11, 4.4, -0.15], [23, 1.5, -0.12], [33, -2.6, -0.05], [40, -4.7, 1.7]];
function axEth(z) { // how far round the wall the external iliac artery lies at z; above the bifurcation, the medial edge of psoas
  const q = AX_IA; if (z >= q[3][1]) return q[3][0] - 6 * (z - q[3][1]);
  for (let i = 3; i < 7; i++) if (z >= q[i + 1][1]) return lerp(q[i][0], q[i + 1][0], (q[i][1] - z) / (q[i][1] - q[i + 1][1]));
  return q[7][0];
}
const axPsoas = (th, z) => { const u = (th - axEth(z) - 1) / 35; return u <= 0 || u >= 1 ? -0.2 : 0.52 * Math.pow(Math.sin(Math.PI * u), 0.7) * sstep(0.5, 2.7, z) * (1 - sstep(17, 19, z)) - 0.2; };
const axBump = (th, z, s) => (th < 0 ? scH(bowlR(z, 0)[0] * Math.cos(th * DEG) * s, z) : 0) + Math.max(0, axPsoas(th, z));
const axPt = (q, s, out) => (q.isVector3 ? (out || new V3()).copy(q) : bowlPoint(s * Math.cos(q[0] * DEG), Math.sin(q[0] * DEG), q[1], axBump(q[0], q[1], s) - (q[2] == null ? axFloor(q[0], q[1]) - 0.14 : q[2]), out || new V3()));
// The other way: how far round the wall a point lies, in degrees, as seen from side s.
function axTh(p, s) {
  const r = bowlR(p.z, 0), dy = p.y - BOWL_YC, f = 0.25 + 1.3 * sstep(-7, 4, p.z);
  const sn = dy <= 0 ? dy / r[1] : (-r[1] + Math.sqrt(r[1] * r[1] + 4 * f * r[1] * dy)) / (2 * f * r[1]);
  return Math.atan2(sn, (p.x * s) / r[0]) / DEG;
}
// Under the peritoneum of the sidewall lies a shallow bed with three hollows: the pararectal space, the obturator fossa
// (the lateral paravesical space) and the medial paravesical space beside the bladder. axFloor is how far under the
// peritoneum their floor lies at (th, z); a hollow is given by its midline and its half-width, in cm.
const HOLLOW = [
  { D: 1.1, R: 2.0, line: [[-55, 5.6], [-50, -1.4]] },
  { D: 0.3, R: 2.3, line: [[-16, 3.0], [-2, -0.4], [10, -2.8]] },
  { D: 1.2, R: 1.2, line: [[18, -6.1], [46, -5.9]] }
];
function axFloor(th, z) {
  let d = 0.5;
  for (const h of HOLLOW) {
    let m = 9;
    for (let i = 0; i < h.line.length - 1; i++) {
      const a = h.line[i], b = h.line[i + 1], ax = a[0] * 0.1, bx = b[0] * 0.1, px = th * 0.1, ex = bx - ax, ez = b[1] - a[1];
      const t = clamp(((px - ax) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1); m = Math.min(m, Math.hypot(px - ax - ex * t, z - a[1] - ez * t));
    }
    d += h.D * (1 - sstep(0.35 * h.R, h.R, m));
  }
  return d;
}

// ---------- windows in the peritoneum ----------
// A window is a set of capsules on the wall (two places and a half-width). Opened, the wall's peritoneum is not drawn
// inside it (PEEL, which the wall's material reads), from the middle outward.
function axWindow(name, s, caps) {
  AX.win[name] = { i0: AX.nCap, n: caps.length, g: 0, goal: 0 };
  for (const c of caps) { const i = AX.nCap++, a = axPt([c[0][0], c[0][1], 0], s), b = axPt([c[1][0], c[1][1], 0], s); PEEL.a.value[i].set(a.x, a.y, a.z, -1); PEEL.b.value[i].set(b.x, b.y, b.z, 0); PEEL.a.value[i].r = c[2]; }
}
function axWinSd(name, p) { // how far outside a window, fully opened, p lies (negative: inside)
  const w = AX.win[name]; let d = 9;
  for (let i = w.i0; i < w.i0 + w.n; i++) { const a = PEEL.a.value[i], b = PEEL.b.value[i]; _x1.set(b.x - a.x, b.y - a.y, b.z - a.z); _x2.set(p.x - a.x, p.y - a.y, p.z - a.z); d = Math.min(d, _x2.addScaledVector(_x1, -clamp(_x2.dot(_x1) / _x1.lengthSq(), 0, 1)).length() - a.r); }
  return d;
}
function axSeen(name, p, m) { // does the scope's line of sight to p, a place under the peritoneum, come in through the window (by a margin m)?
  const d = _xs.subVectors(p, CAM.pivot).normalize(); let t = 0.2;
  while (t < 4 && !inBowl(p.x - d.x * t, p.y - d.y * t, p.z - d.z * t)) t += 0.2;
  return axWinSd(name, _xq.copy(p).addScaledVector(d, -t)) < -(m || 0);
}
function axWindows() { // write each window's state where the material reads it
  for (const k in AX.win) { const w = AX.win[k]; for (let i = w.i0; i < w.i0 + w.n; i++) { PEEL.a.value[i].w = w.g > 0.001 ? PEEL.a.value[i].r : -1; PEEL.b.value[i].w = (1 - easeIO(w.g)) * 2.7; } }
}

// ---------- what this case adds to the pelvis ----------
function axReg(mesh, ent, side, extra) { mesh.userData = Object.assign({ ent, side: side || null }, extra || {}); mesh.visible = false; mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.material.userData.depth) mesh.customDepthMaterial = mesh.material.userData.depth; scene.add(mesh); AX.picks.push(mesh); return mesh; }
// A cord under or on the peritoneum: an artery, a vein, a nerve, the ureter, a fold. o.r: its radius along its length;
// o.col; o.pulse: how much it beats; o.bare: drawn in its own colour even under peritoneum; o.live: its course is worked
// out again each frame (it is fixed to something that moves).
function axCord(k, id, ent, pts, n, o) {
  const s = axS(k), t = new Tube(n, o.m || 10, o.mat || MAT.vessel, 1, o.uv || 4);
  axReg(t.mesh, ent, o.mid ? null : k, { tube: t, cord: id });
  const c = Object.assign({ id, k, s, t, A: vecArr(n), pts, u0: 0, u1: 1 }, o);
  if (!o.live) spline(pts.map(q => axPt(q, s)), c.A);
  return (AX.c[k][id] = c);
}
function axDraw(c, time) {
  const pl = c.pulse ? 1 + c.pulse * pulse(time) : 1, col = c.col;
  c.t.set(c.A, c.u0, c.u1, u => c.r(u, time) * pl, (u, o) => {
    const v = c.bare ? 0 : 0.62 * (1 - peelAt(sampleArr(c.A, u, _x3))); // under peritoneum it shows through, paler
    o[0] = lerp(col[0], COLX.perit[0], v); o[1] = lerp(col[1], COLX.perit[1], v); o[2] = lerp(col[2], COLX.perit[2], v);
  }, c.flat);
}
const axTaper = (r, a, b) => u => r * sstep(0, a || 0.001, u) * (1 - sstep(1 - (b || 0.001), 1, u)); // a cord that sinks out of sight at its ends
MAT.vessel = wet({ map: TEX.cord, mr: [1.2, 1.8], bs: 0.2 });
MAT.retro = wet({ map: TEX.card, tri: { k: 0.24, n: 0.4, m: 1 }, bs: 0.9, side: THREE.DoubleSide });
(function () {
  const UB = 3 / 8; // how far along the iliac artery's course it divides
  for (const k of ['R', 'L']) {
    const s = axS(k), R = k === 'R', T = (id, ent, pts, n, o) => axCord(k, id, ent, pts, n, o);
    // the common iliac artery, continuing along the brim as the external iliac; the internal iliac turns down from it
    T('cia', 'cia', AX_IA, 49, { r: () => 0.5, col: COL.iliacA, pulse: 0.035, u1: UB, m: 12 });
    T('eia', 'eia', AX_IA, 49, { r: () => 0.45, col: COL.iliacA, pulse: 0.035, u0: UB, m: 12 });
    T('eiv', 'eiv', [[-31, 11, 1.3], [-27, 9.8, 1.25], [-21.5, 8.4, 1.0], [-16, 7.0, 0.3], [-4, 4.4, 0.25], [8, 1.4, 0.25], [20, -2.8, 0.2], [25, -4.1, 0.8], [28.5, -5.0, 1.9]], 45, { r: axTaper(0.5, 0.1), col: COL.iliacV, m: 12 });
    T('iia', 'iia', [[-18, 10.2, 0.05], [-22, 9.0, 0.25], [-25.5, 7.0, 0.5], [-27, 5.0, 0.6], [-27, 3.2, 0.62], [-26.5, 1.4, 0.55], [-25, -0.6, 0.45], [-22, -2.3, 0.35]], 29, { r: u => lerp(0.4, 0.26, u), col: COL.art, pulse: 0.05 });
    T('iiv', 'iiv', [[-31, 11, 0.9], [-28, 9.2, 0.85], [-30, 7.0, 0.82], [-31.5, 5.0, 0.8], [-31.5, 3.0, 0.8], [-31, 0.8, 0.78], [-29.5, -1.4, 0.72], [-27.5, -3.0, 0.65]], 29, { r: u => lerp(0.38, 0.3, u), col: COL.vein });
    // the umbilical artery: patent at first, it runs forward between the bladder and the sidewall (a centimetre off the
    // wall, under the anterior leaf) once the sidewall is opened, then up the front wall as the cord that raises the medial umbilical fold
    const front = [[50, -4.5, -0.15], [62, -3.0, -0.12], [70, 0, -0.1], [76, 4.6, -0.1], [80, 9.5, -0.1], [84, 15.5, -0.05]];
    const um = T('umb', 'umb', [[-22, -2.3, 0.35], [-14, -3.0, -0.2], V(4.55 * s, -0.9, -3.9), V(4.25 * s, 0.3, -4.7), V(3.9 * s, 1.7, -5.1)].concat(front), 61, { r: u => lerp(0.2, 0.27, sstep(0.3, 0.55, u)), col: COLX.umb });
    // With the peritoneum whole it lies on the wall under the anterior leaf (A0); with the sidewall opened it is seen as the cord it is (A1).
    um.A1 = um.A.map(p => p.clone()); um.A0 = vecArr(61); spline([[-22, -2.3, 0.35], [-14, -3.0, 0.3], [-2, -3.9, 0.3], [12, -4.6, 0.28], [26, -5.0, 0.2]].concat(front).map(q => axPt(q, s)), um.A0);
    // the obturator nerve, artery and vein, from above down, on the floor of the obturator fossa to the obturator canal
    T('obn', 'obn', [[-26, 9.4, 1.2], [-23, 7.0, null], [-17, 4.0, null], [-9.5, 1.2, null], [-0.5, -1.6, null], [7, -3.2, null], [11.5, -4.0, 1.5]], 33, { r: () => 0.15, col: COLX.nerve, flat: 0.65, mat: MAT.cord });
    T('oba', 'obv', [[-26.5, 2.4, 0.55], [-21, 1.5, null], [-13, -0.1, null], [-4.5, -2.2, null], [3.5, -3.8, null], [8, -4.3, null], [11.5, -4.5, 1.5]], 29, { r: () => 0.12, col: COL.art, pulse: 0.05 });
    T('obv', 'obv', [[-31, 1.3, 0.85], [-23, 0.6, null], [-14, -0.7, null], [-5, -2.8, null], [3, -4.3, null], [8, -4.75, null], [11.5, -4.95, 1.5]], 29, { r: () => 0.16, col: COL.vein });
    // the ureter: over the iliac vessels at the brim (at the bifurcation on the right, a little higher on the left),
    // down the sidewall medial to the internal iliac artery, under the uterine artery and forward to the bladder
    const low = [[-38, -2, -0.02], V(3.5 * s, -3.0, -4.5), V(2.7 * s, -2.1, -6.5), V(1.9 * s, -1.0, -8.0)];
    T('ur', 'ur', (R ? [[-38, 17, 0.1], [-28, 14.2, 0.05], [-19, 12, -0.1], [-12, 9.2, -0.74], [-31, 7.6, -0.05], [-43, 5.6, 0.05], [-49, 3.6, 0.05], [-48, 1.2, 0.05]]
      : [[-44, 17, 0.1], [-40, 14, 0.05], [-33, 11.2, -0.62], [-35, 8.8, -0.05], [-44, 6.2, 0.05], [-49.5, 3.8, 0.05], [-48.5, 1.4, 0.05]]).concat(low), 65,
    { r: (u, time) => { const ph = (((time || 0) + (R ? 0 : 2.6)) % 5.2) / 1.7; return 0.165 * (1 + 0.42 * Math.exp(-Math.pow((u - ph + 0.1) / 0.07, 2)) - 0.2 * Math.exp(-Math.pow((u - ph + 0.24) / 0.06, 2))) * sstep(0, 0.05, u); }, col: COL.ureter, beat: true, mat: MAT.cord });
    // the hypogastric nerve: from the plexus in front of the promontory down the side of the rectum, medial and dorsal
    // to the ureter, and nearer to it on the left than on the right
    T('hgn', 'hgn', R ? [[-83, 9.6, 0.2], [-72, 7.8, 0.2], [-60, 6.0, 0.2], [-63, 4.0, 0.2], [-62, 1.2, 0.2], [-53, -1.6, 0.2], [-47, -3.8, 0.3]]
      : [[-86, 9.6, 0.2], [-68, 7.8, 0.2], [-53, 6.0, 0.2], [-58, 4.0, 0.2], [-57, 1.4, 0.2], [-49, -1.6, 0.2], [-43, -3.8, 0.3]], 33, { r: axTaper(0.085, 0.06, 0.12), col: COLX.nerve, flat: 1.9, mat: MAT.cord });
    // on psoas, lateral to the external iliac artery: the genitofemoral nerve. In the infundibulopelvic ligament and
    // above the brim: the ovarian vessels. Up the front wall, medial to the deep ring: the inferior epigastric vessels.
    T('gfn', 'gfn', [[-40, 17, -0.06], [-28, 13.6, -0.06], [-7, 10.2, -0.06], [9, 7.0, -0.06], [21, 4.4, -0.06], [31, 1.5, -0.05], [37, -1.8, 0.02]], 33, { r: axTaper(0.075, 0.02, 0.06), col: COLX.nerve, mat: MAT.cord });
    T('ovv', 'ip', [[-8, 8.5, -0.25], [-13, 11, -0.08], [-21, 14, 0.02], [-30, 18, 0.1], [-36, 22, 0.3]], 25, { r: u => lerp(0.32, 0.2, u) * (1 - sstep(0.8, 1, u)), col: COL.ip, mat: MAT.cord });
    T('epa', 'epi', [[35, -3.1, 0.12], [46.5, -2.1, 0.03], [58.2, 0.6, 0.02], [66.2, 4.5, 0.02], [72, 9.5, 0.02], [77, 15, 0.02]], 33, { r: axTaper(0.1, 0.05), col: COL.art, pulse: 0.04 });
    T('epv', 'epi', [[32, -3.2, 0.12], [44, -2.1, 0.03], [55.8, 0.6, 0.02], [63.8, 4.5, 0.02], [70, 9.5, 0.02], [75, 15, 0.02]], 33, { r: axTaper(0.13, 0.05), col: COL.vein });
    // the uterine vessels' last centimetre, from where the other cases end them on the wall to the internal iliac vessels
    T('uao', 'ua', [SIDEK[s].uaO, [-21, -2.6, 0.12], [-22, -2.3, 0.35]], 9, { r: () => 0.17, col: COL.art, pulse: 0.07 });
    T('uvo', 'ua', [SIDEK[s].uaO.clone().add(V(0.06 * s, -0.24, -0.3)), [-25, -3.1, 0.45], [-28, -3.0, 0.75]], 9, { r: () => 0.22, col: COL.vein });
    // the deep uterine vein: from the side of the cervix, under the ureter, to the internal iliac vein
    T('duv', 'duv', [V(1.2 * s, 1.2, 0.35), V(3.35 * s, -3.8, -4.75), [-33, -3.3, 0.6], [-28, -3.0, 0.75]], 21, { r: () => 0.2, col: COL.vein, live: true });
    // psoas: a low swell of the wall lateral to the artery, under peritoneum like the rest of the wall
    const pg = paramSurface(28, 72, (u, v, p, c) => {
      const z = lerp(0.5, 19, v), th = axEth(z) + lerp(1, 36, u), h = axPsoas(th, z), e = (h + 0.2) / 0.52;
      bowlPoint(s * Math.cos(th * DEG), Math.sin(th * DEG), z, h + (th < 0 ? scH(bowlR(z, 0)[0] * Math.cos(th * DEG) * s, z) : 0), p); c[0] = 1 - 0.05 * e; c[1] = 1 - 0.1 * e; c[2] = 1 - 0.1 * e;
    }, { su: 2, sv: 4, flip: R });
    axReg(new THREE.Mesh(pg, MAT.bowl), 'psoas', k);
    // the opened sidewall: the bed and its three hollows, muscle where muscle lies bare (psoas, obturator internus)
    const sg = paramSurface(70, 60, (u, v, p, c) => {
      const th = lerp(-94, 90, u), z = lerp(-8.45, 12, v), d = axFloor(th, z), ps = sstep(2, 9, th - axEth(z)) * sstep(-1.5, 1, z), ob = sstep(1.2, 1.9, d) * sstep(-24, -16, th) * (1 - sstep(8, 16, th)), mu = Math.max(ps, ob), dk = 1 - 0.12 * sstep(0.6, 1.9, d);
      axPt([th, z, d], s, p); c[0] = lerp(1.02, 0.86, mu) * dk; c[1] = lerp(0.95, 0.5, mu) * dk; c[2] = lerp(0.8, 0.44, mu) * dk;
    }, { su: 3, sv: 3, flip: R });
    AX.shell[k] = axReg(new THREE.Mesh(sg, MAT.retro), 'retro', k);
    AX.fold = AX.fold || {}; AX.fold[k] = new Strip(14, 4, MAT.leaf, 1.2, 0.8); axReg(AX.fold[k].mesh, 'usl', k, { strip: AX.fold[k] });
    // the cardinal ligament as the opened sidewall shows it: the web between the uterine artery above and the deep uterine vein below
    AX.web = AX.web || {}; AX.web[k] = new Strip(18, 5, MAT.card, 2, 1); axReg(AX.web[k].mesh, 'card', k, { strip: AX.web[k] });
    // this side's window: the pararectal fossa, along the vessels at the brim, and the obturator fossa and paravesical space
    axWindow(k, s, [[[-56, 6.2], [-46, -0.4], 1.65], [[-38, 7.0], [-33, 2.4], 1.9], [[-20, 9.6], [-32, 6.4], 1.4], [[-19, 9.8], [-4, 6.6], 1.5], [[-4, 6.6], [8, 4.0], 1.5], [[8, 4.0], [20, 1.2], 1.5],
      [[20, 1.2], [28, -1.4], 1.3], [[-24, 3.4], [-6, 0.8], 2.3], [[-6, 0.8], [16, -3.2], 2.4], [[16, -3.2], [40, -5.4], 1.7], [[-36, -0.4], [-22, -4.2], 1.8], [[44, -5.9], [64, -5.6], 1.25]]);
  }
  // the urachus: the single fold in the midline of the front wall, from the bladder to the umbilicus
  axCord('R', 'ura', 'ura', [[90, -4.7, 0], [90, -3, -0.1], [90, 1, -0.14], [90, 6, -0.14], [90, 11.5, -0.12], [90, 16.5, -0.05]], 33, { r: axTaper(0.24, 0.08), col: COLX.urachus, mid: true, bare: true, mat: MAT.cord });
  // the promontory and the lumbar spine above it, under peritoneum
  const g = paramSurface(40, 48, (u, v, p, c) => {
    const x = lerp(-4.9, 5.5, u), z = lerp(4.3, 18.5, v), e = sstep(0, 0.1, Math.min(u, 1 - u, v, 1 - v)), h = scH(x, z) / 1.3;
    scFloor(x, z, lerp(-0.3, 0, e), p); c[0] = 1 + 0.05 * h; c[1] = 1 + 0.1 * h; c[2] = 1 + 0.1 * h;
  }, { su: 2, sv: 3, flip: true });
  axReg(new THREE.Mesh(g, MAT.bowl), 'prom');
})();

AX.tugs = {}; for (const k of ['R', 'L']) AX.tugs[k] = { p: 0, a: { curve: 'ridge', s: axS(k), u: 0.42, off: new V3(), nat: new V3() }, b: { curve: 'ridge', s: axS(k), u: 0.7, off: new V3(), nat: new V3() } };
// ---------- showing it ----------
function axShow(on) {
  AX.on = on;
  for (const m of AX.picks) { m.visible = on; const i = PICKS.indexOf(m); if (on && i < 0) PICKS.push(m); else if (!on && i >= 0) PICKS.splice(i, 1); }
  for (const k of ['R', 'L']) { URETER[k].tube.on = !on; AN['iliac' + k].ta.on = !on; AN['iliac' + k].tv.mesh.visible = !on; if (!on) for (const p of ['antL', 'roofL', 'postL']) AN.side[k].st[p].mesh.visible = true; }
  if (!on) { for (const k in AX.win) AX.win[k].g = AX.win[k].goal = 0; axWindows(); AX.sig = AX.sigP = AX.rv = AX.rvP = AX.blad = AX.bladP = 0; AX.lift = AX.tug = null; SC.rvs.mesh.visible = false; if (AX.sigKey) { AX.sigKey = ''; setRectum(); } }
  AX.dirty = true;
}
function axUpdate(dt, time) {
  let moved = AX.dirty; AX.dirty = false;
  for (const k in AX.win) { const w = AX.win[k], g = w.g; w.g = Math.abs(w.goal - w.g) < 0.002 ? w.goal : damp(w.g, w.goal, 2.6, dt); if (w.g !== g) moved = true; }
  if (moved) axWindows();
  for (const k of ['R', 'L']) {
    const C = AX.c[k], sd = AN.side[k], open = AX.win[k].g > 0.35;
    // with the sidewall opened, the lateral halves of the broad ligament's leaves are out of the way
    for (const p of ['antL', 'roofL', 'postL']) sd.st[p].mesh.visible = !open;
    if (open || S.flap > 0.05) sd.st.areolar.mesh.visible = false;
    // the uterosacral ligament is the edge of a fold of peritoneum, not a cord in the open: the fold, down to the floor
    AX.fold[k].update((sx, v, o) => { sampleArr(sd.uslArr, sx, o); if (v > 0) { const cs = clamp(o.x / bowlR(o.z, 0)[0], -0.97, 0.97); o.lerp(bowlPoint(cs, -Math.sqrt(1 - cs * cs), o.z, -0.08, _x1), v); } });
    AX.shell[k].visible = AX.win[k].g > 0.001;
    const dv = C.duv, cp = dv.cp || (dv.cp = vecArr(4)); // its medial end goes with the uterus
    cp[0].copy(dv.pts[0]).applyMatrix4(UT.M); cp[1].copy(dv.pts[1]); axPt(dv.pts[2], dv.s, cp[2]); axPt(dv.pts[3], dv.s, cp[3]); spline(cp, dv.A);
    const wb = AX.web[k], G = axG(k); wb.mesh.visible = open; // the ureter passes through it, under the artery and over the vein
    if (open) wb.update((sx, v, o, c) => { sampleArr(G.ua, lerp(0.34, 1, sx), o); o.y -= 0.1; o.lerp(sampleArr(dv.A, lerp(0.3, 1, sx), _x1), v); const e = 1 - 0.2 * Math.sin(Math.PI * v); c[0] = e; c[1] = 0.92 * e; c[2] = 0.9 * e; });
    if (moved) { const um = C.umb, e = easeIO(AX.win[k].g); for (let i = 0; i < um.A.length; i++) um.A[i].lerpVectors(um.A0[i], um.A1[i], e); }
    for (const id in C) { const c = C[id]; if (moved || c.pulse || c.beat || c.live) axDraw(c, time); }
  }
  // The probe comes in from the side the pointer is on, so that its shaft does not lie across the picture, and it is
  // in the picture only while it is pointing.
  if (INP.inside && S.running && CTRL.mode === 'mouse') { const f = INP.x / VW; if (ACTIVE === 'R' ? f < 0.42 : f > 0.58) setActive(ACTIVE === 'R' ? 'L' : 'R'); }
  for (const h of HANDS) h.grp.visible = h.ptr.on;
  if (AX.lift && S.running) S.side[AX.lift].ovGoal = 1;
  AX.bladP = damp(AX.bladP, S.running ? AX.blad : 0, 3, dt);
  // the adnexa held out of the way of an opened sidewall
  for (const k of ['R', 'L']) {
    const T = AX.tugs[k], g = AX.tug === k && S.running ? 1 : 0, s = axS(k); T.p = Math.abs(g - T.p) < 0.002 ? g : damp(T.p, g, 3, dt);
    if (g) T.by = AX.tugBy; const b = T.by || [0, 0, 0, 0, 0, 0]; T.a.off.set(b[0] * s, b[1], b[2]).multiplyScalar(T.p); T.b.off.set(b[3] * s, b[4], b[5]).multiplyScalar(T.p);
    for (const p of [T.a, T.b]) { const i = S.pulls.indexOf(p); if (T.p > 0 && i < 0) S.pulls.push(p); else if (T.p <= 0 && i >= 0) S.pulls.splice(i, 1); }
  }
  // the sigmoid: swept toward the midline when the left sidewall is to be seen. The rectum: dropped back off the vagina
  // when the rectovaginal space is opened, which is drawn as the sacrocolpopexy draws it, as the bared vaginal wall.
  AX.sigP = damp(AX.sigP, AX.sig, 3, dt); AX.rvP = damp(AX.rvP, AX.rv, 3, dt); const key = AX.sigP.toFixed(3) + '/' + AX.rvP.toFixed(3);
  if (key !== AX.sigKey) { AX.sigKey = key; const q = AX.sigP, r = AX.rvP; setRectum((i, p) => { const b = [0, 0, 0.25, 0.8, 1, 1, 0.8][i]; if (b && q > 0) { p.x += 4.6 * b * q; p.y = lerp(p.y, scFloor(p.x, p.z, 1.2, _x1).y, b * q); } if (i < 2) { p.y -= 0.7 * r; p.z -= 0.3 * r; } }); }
  if (time - AXI.t > 0.12 || time < AXI.t) { AXI.t = time; axMap(); }
  SC.rvs.mesh.visible = AX.rvP > 0.02;
  if (SC.rvs.mesh.visible) SC.rvs.update((sx, v, o, c) => { scWall(lerp(-34, 34, sx), lerp(-0.3 - 2.6 * AX.rvP, -0.3, v), 0.035, o); edgeCol(c, 1, Math.max(Math.abs(2 * sx - 1), 1 - 2.2 * v)); c[1] *= 0.92; c[2] *= 0.88; });
}


// ---------- views ----------
// Where the scope looks and how the pelvis is set for it. g: the point looked at; d: from how far; pose: the
// manipulator; lift: the ovary lifted off the sidewall; tug: the adnexa held out of the way (how far the ovary, then the
// middle of its infundibulopelvic ligament, are drawn: medially, anteriorly, cephalad); sig: the sigmoid swept toward the midline; blad: the bladder held toward the midline; win: the sidewall's
// peritoneum opened; flap: the bladder taken down; rv: the rectovaginal space opened. s is the side's sign, k the side.
const AXV = {
  survey: () => ({ g: [0, -1.2, -1], d: 14.5 }),
  adnex: s => ({ g: [3.3 * s, -1.4, 1.6], d: 11, pose: { yaw: -0.25 * s } }),
  ant: () => ({ g: [0, 4.8, -2.6], d: 12.5, pose: { pitch: 0 } }),
  post: () => ({ g: [0, -2.6, -3.6], d: 11.5, pose: { pitch: 0.95 } }),
  prom: () => ({ g: [0.6, -5.2, 8.2], d: 11 }),
  brim: (s, k) => ({ g: [5.4 * s, -3.6, 8.6], d: 10.5, pose: { yaw: -0.4 * s }, sig: k === 'L' }),
  wall: (s, k) => ({ g: [4.3 * s, -3, 1.5], d: 10.5, pose: { yaw: -0.5 * s }, lift: 1, sig: k === 'L' }),
  prs: (s, k) => ({ g: [4.2 * s, -4.4, 2.4], d: 11, pose: { yaw: -0.3 * s, pitch: 0.6 }, tug: [-1, 2.2, -1.5, 0.8, 2.6, -0.5], win: 1, sig: k === 'L' }),
  pvs: s => ({ g: [5.6 * s, -0.8, -0.4], d: 10, pose: { yaw: -0.5 * s, pitch: -0.05 }, win: 1 }),
  pvm: s => ({ g: [3.8 * s, 0.8, -5], d: 9.5, pose: { yaw: -0.4 * s, pitch: -0.1 }, win: 1, blad: 1 }),
  para: s => ({ g: [3.6 * s, -2.4, -3.6], d: 7.6, pose: { yaw: -0.55 * s }, tug: [-2.2, 0.9, -0.8, -3.6, 0.2, -2.4], win: 1 }),
  vvs: () => ({ g: [0, 0.4, -4.4], d: 9.5, pose: { pitch: -0.05, push: 0.5 }, flap: 1 }),
  rvs: () => ({ g: [0, -3.4, -4.6], d: 9.5, pose: { pitch: 0.95 }, rv: 1 })
};
const AX_MID = { survey: 1, ant: 1, post: 1, prom: 1, vvs: 1, rvs: 1 }; // views that show both sides at once
function axApply(v, k) { // set the pelvis for a view
  setPoseGoal(Object.assign({ yaw: 0, pitch: PITCH0, push: 0 }, v.pose));
  AX.view = v; AX.vk = k; AX.peel = 1; AX.sig = v.sig ? 1 : 0; AX.lift = v.lift ? k : null; AX.tug = v.tug ? k : null; if (v.tug) AX.tugBy = v.tug; AX.blad = v.blad ? axS(k) : 0; AX.rv = v.rv ? 1 : 0;
  S.flapGoal = v.flap ? 1 : 0; for (const j of ['R', 'L']) { S.side[j].antGoal = S.side[j].vufGoal = v.flap ? 1 : 0; AX.win[j].goal = v.win && j === k ? 1 : 0; }
}

// ---------- the structures ----------
const axLoc = P => _x3.copy(P.point).applyMatrix4(UT.Minv); // a pick, in the uterus's own frame
const axIs = (...e) => (P, k) => e.includes(P.ent) && (!k || P.side === k);
const axOn = (id, lo, hi) => (P, k) => !!P.mesh && P.mesh.userData.cord === id && (!k || P.side === k) && (lo == null || (P.u >= lo && P.u <= hi));
const axC = (id, u) => (k, o) => sampleArr(AX.c[k || 'R'][id].A, u, o);
const axL = (id, u0, u1) => k => [AX.c[k || 'R'][id].A, u0, u1];
const axU = (x, y, z) => (k, o) => o.set(x * axS(k), y, z).applyMatrix4(UT.M);
function axAt(k, id, z) { const A = AX.c[k][id].A; let b = 0, bd = 1e9; for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i].z - z); if (d < bd) { bd = d; b = i; } } return axTh(A[b], axS(k)); } // how far round the wall a cord lies where it passes z
function axZat(k, id, th) { const A = AX.c[k][id].A, s = axS(k); let b = 0, bd = 1e9; for (let i = 0; i < A.length; i++) { const d = Math.abs(axTh(A[i], s) - th); if (d < bd) { bd = d; b = i; } } return A[b].z; } // and its z where it passes th
// The obliterated umbilical artery runs through the paravesical space clear of the wall, so which side of it a place on
// the floor lies is a matter of where the scope sees it: +1 on the bladder's side of the artery, -1 on the sidewall's,
// 0 if the line of sight to it passes more than far cm from the artery.
function axUmbSide(k, p, far) {
  const A = AX.c[k].umb.A1, d = _x1.subVectors(p, CAM.pivot).normalize(); let b = 1, bd = 1e9;
  for (let i = 1; i < 30; i++) { const t = _x2.subVectors(A[i], CAM.pivot).dot(d), e = _x2.addScaledVector(d, -t).lengthSq(); if (e < bd) { bd = e; b = i; } }
  if (bd > far * far) return 0;
  const a = A[b], n = _x2.subVectors(a, CAM.pivot).cross(_x3.subVectors(A[b + 1], A[b - 1])); // the plane through the port and the artery there
  return n.dot(_x3.subVectors(p, a)) * n.dot(_x3.set(-a.x, 0, 0)) > 0 ? 1 : -1;
}
// The four spaces of the sidewall, as places on its opened floor (th degrees round the wall, z along it): each is
// bounded by the cords themselves, which is what there is to learn about them.
const AXR = {
  lpr: (k, th, z) => z > -2.4 && z < 7 && th > axAt(k, 'ur', z) + 1.5 && th < axAt(k, 'iia', z) + 1,
  mpr: (k, th, z) => { const u = axAt(k, 'ur', z); return z > -2.4 && z < 7 && th < u - 1.5 && th > Math.max(-82, u - 25); },
  // the paravesical space: the obliterated umbilical artery runs through it, and the floor medial to the artery (nearer the bladder, further round the wall) is one space and the floor lateral to it the other
  lpv: (k, th, z, p) => th > -22 && th < 34 && z < axZat(k, 'eiv', th) - 1.9 && z > -6.4 && (z > -2.6 || th > -14) && axUmbSide(k, p, 9) < 0,
  mpv: (k, th, z, p) => th > -12 && th < 70 && z < -3.2 && axUmbSide(k, p, 2.6) > 0
};
const axSpace = (id, holds) => ({ // holds: what lies in the space, a click on which is a click in it
  hit: (P, k) => P.side === k && (P.ent === 'retro' || (!!holds && holds.includes(P.ent))) && AXR[id](k, axTh(P.point, axS(k)), P.point.z, P.point),
  area(k) { // sample points of the space on the floor, for drawing its outline
    const c = this.pts || (this.pts = {}); if (c[k]) return c[k]; c[k] = [];
    for (let th = -84; th <= 70; th += 3.5) for (let z = -8.3; z <= 7; z += 0.45) { const p = axPt([th, z, null], axS(k)); if (AXR[id](k, axTh(p, axS(k)), z, p) && axSeen(k, p)) c[k].push(p); } // where it is seen through the window
    return c[k];
  },
  at(k, o) { // a place in it that the scope sees through the window, clear of what crosses in front of it, as near its middle as may be
    k = k || 'R'; const c = this.mid || (this.mid = {}), now = S.running ? S.t - STEPS[S.step].t0 : 0;
    if (c[k] && c[k].ok) return o.copy(c[k].p);
    const a = this.area(k), m = new V3(), G = axG(k), sc = []; for (const p of a) m.add(p); m.divideScalar(a.length || 1);
    const front = Object.keys(AX.c[k]).map(id => AX.c[k][id].A).concat([G.round, G.ridge]);
    for (const p of a) {
      let cl = axSeen(k, p, 0.2) ? 9 : -5; const dir = _x3.subVectors(p, CAM.pivot), L = dir.length(); dir.divideScalar(L); // the line of sight to it, from the port
      for (const A of front) for (let i = 0; i < A.length; i++) { const d = _x2.subVectors(A[i], CAM.pivot).dot(dir); if (d < L + 0.3) cl = Math.min(cl, _x2.addScaledVector(dir, -d).length()); }
      sc.push([Math.min(cl, 1) - 0.1 * p.distanceTo(m), p]);
    }
    sc.sort((x, y) => y[0] - x[0]); let best = sc.length ? sc[0][1] : m;
    // settled once the uterus and what hangs from it have come to rest in the view: then the place is one where a click falls on the space itself
    if (now > 2.2) for (let i = 0; i < Math.min(sc.length, 14); i++) if (this.hit(axPickAt(sc[i][1]), k)) { best = sc[i][1]; break; }
    c[k] = { p: best.clone(), ok: now > 2.2 };
    return o.copy(best);
  }
});
const axG = k => curG(k || 'R');
const _rc = new THREE.Raycaster(), _n2 = new THREE.Vector2(), _ph = { pick: newPick(), ray: null };
function axPickAt(p) { // what the scope sees where p falls in the picture
  _pv.copy(p).project(camera); _rc.setFromCamera(_n2.set(_pv.x, _pv.y), camera); _ph.ray = _rc.ray; fillPick(_ph, firstShown(_rc.intersectObjects(PICKS, false))); return _ph.pick;
}
// Each: id; n its name; g the group it is listed under; t its tier (1: seen at the surface, 2: under the peritoneum);
// v the view it is shown in; bi: there is one on each side; at(k, out): where to mark it; line(k): the cord to trace;
// hit(pick, k): is this pick on it?; f: where it is and how to know it; w: why it matters. left: what differs on the left.
const AXS = [
  { id: 'fundus', n: 'Uterine fundus', g: 'Uterus and adnexa', t: 1, v: 'survey', at: axU(0, 8.3, -0.6), hit: P => { if (P.ent !== 'uterus') return false; const p = axLoc(P); return p.y > 7.9 || (p.y > 6.6 && Math.abs(p.x) <= 1.5); },
    f: ['The dome of the uterus above the two cornua.', 'It is the part the manipulator swings: watch it as you tilt and deviate the uterus.'],
    w: 'Everything else in the pelvis is found from the uterus. Anteverting it opens the cul-de-sac; deviating it to one side puts the opposite adnexa and sidewall on stretch.' },
  { id: 'cornu', n: 'Uterine cornu', g: 'Uterus and adnexa', t: 1, v: 'survey', bi: 1, at: axU(2.25, 7.2, -0.5), hit: (P, k) => { if (P.ent !== 'uterus') return false; const p = axLoc(P); return p.y > 5.9 && p.y <= 7.9 && p.x * axS(k) > 1.5; },
    f: ['The corner of the uterus on each side, where the fundus meets the lateral border.', 'Three structures leave it: the round ligament in front, the tube in the middle and the utero-ovarian ligament behind.'],
    w: 'Front to back: round ligament, tube, utero-ovarian ligament. The order holds when adhesions or a large fibroid distort everything else.' },
  { id: 'round', n: 'Round ligament', g: 'Uterus and adnexa', t: 1, v: 'survey', bi: 1, at: (k, o) => sampleArr(axG(k).round, 0.55, o), line: k => [axG(k).round, 0.04, 0.97], hit: axIs('round'),
    f: ['A cord from the cornu, forward and out to the deep inguinal ring.', 'The most anterior of the three structures at the cornu.'],
    w: 'Dividing it opens the broad ligament, the first step into the retroperitoneum. It leaves the abdomen lateral to the inferior epigastric vessels.' },
  { id: 'tube', n: 'Fallopian tube', g: 'Uterus and adnexa', t: 1, v: 'adnex', bi: 1, at: (k, o) => sampleArr(axG(k).tubeCur, 0.45, o), line: k => [axG(k).tubeCur, 0.04, 0.84], hit: (P, k) => P.ent === 'tube' && P.side === k && P.u < 0.84,
    f: ['From the cornu along the upper edge of the broad ligament, curving round the ovary.', 'Narrow at the uterus, wider toward its open end.'],
    w: 'For a salpingectomy, stay on the tube as its mesosalpinx is divided, so that the vessels running to the ovary beneath it are kept.' },
  { id: 'fimbria', n: 'Fimbriae', g: 'Uterus and adnexa', t: 1, v: 'adnex', bi: 1, at: (k, o) => sampleArr(axG(k).tubeCur, 0.97, o), hit: (P, k) => P.ent === 'tube' && P.side === k && P.u >= 0.84,
    f: ['The fringed open end of the tube, lying against the ovary.'],
    w: 'Most high-grade serous cancers of the ovary are thought to start in the fimbriated end of the tube, so a salpingectomy takes the whole tube, fimbriae included.' },
  { id: 'ovary', n: 'Ovary', g: 'Uterus and adnexa', t: 1, v: 'adnex', bi: 1, at: (k, o) => { o.copy(axG(k).ovC); o.y += 0.55; return o; }, hit: axIs('ovary'),
    f: ['The pale, almond-shaped organ behind the broad ligament.', 'It is held medially by the utero-ovarian ligament and laterally by the infundibulopelvic ligament, and rests in the ovarian fossa on the sidewall.'],
    w: 'The ureter runs in the floor of the ovarian fossa, under the peritoneum the ovary lies on. An ovary stuck to the sidewall is stuck over the ureter.' },
  { id: 'uo', n: 'Utero-ovarian ligament', g: 'Uterus and adnexa', t: 1, v: 'adnex', bi: 1, at: (k, o) => sampleArr(axG(k).ridge, 0.1, o), line: k => [axG(k).ridge, 0.01, 0.21], hit: axIs('uo'),
    f: ['The short cord from the cornu, behind the tube, to the medial pole of the ovary.'],
    w: 'It is sealed and divided to leave the ovary in place at hysterectomy. The ovary then lives on the vessels in its infundibulopelvic ligament.' },
  { id: 'ip', n: 'Infundibulopelvic ligament', g: 'Uterus and adnexa', t: 1, v: 'adnex', bi: 1, at: (k, o) => sampleArr(axG(k).ridge, 0.8, o), line: k => [axG(k).ridge, 0.58, 1], hit: axIs('ip'),
    f: ['The fold of peritoneum from the lateral pole of the ovary up over the pelvic brim.', 'It carries the ovarian artery and veins.'],
    w: 'The ureter crosses the brim just medial to it and beneath it. See the ureter, or open the peritoneum and find it, before this ligament is sealed.' },
  { id: 'meso', n: 'Mesosalpinx', g: 'Uterus and adnexa', t: 1, v: 'adnex', bi: 1, at: (k, o) => sampleArr(axG(k).ridge, 0.33, o).lerp(sampleArr(axG(k).tubeAtt, 0.55, _x1), 0.4), hit: axIs('meso'),
    f: ['The thin fold of broad ligament between the tube above and the ovary and its ligaments below.'],
    w: 'It carries the tubal branches of the uterine and ovarian vessels. A salpingectomy divides it close to the tube.' },

  { id: 'bladder', n: 'Bladder', g: 'Anterior compartment', t: 1, v: 'ant', at: (k, o) => o.set(BL.c.x, BL.c.y + BL.r.y * 0.9, BL.c.z + 1), hit: axIs('bladder'),
    f: ['In front of the uterus and behind the pubic bones; its dome rises as it fills.', 'Its peritoneum turns onto the uterus at the vesicouterine fold.'],
    w: 'It lies on the cervix and the upper vagina. It has to be taken off them, in the vesicovaginal space, before the uterine vessels are sealed and the vagina is opened.' },
  { id: 'vuf', n: 'Vesicouterine fold', g: 'Anterior compartment', t: 1, v: 'ant', at: (k, o) => vufPt(0.5, o), hit: axIs('vuf'),
    f: ['The loose fold of peritoneum where the bladder meets the front of the uterus, at the level of the isthmus.', 'Tip the uterus back to put it on stretch.'],
    w: 'Opening it is the way into the vesicovaginal space. Open it where the peritoneum is loose and lifts away, not where it is fixed to the uterus.' },
  { id: 'antleaf', n: 'Broad ligament, anterior leaf', g: 'Anterior compartment', t: 1, v: 'ant', bi: 1, at: (k, o) => antLeafPt(k, axG(k), 0.42, 0.55, o), hit: (P, k) => P.side === k && (P.ent === 'ant' || (P.ent === 'roof' && !(P.piece === 'roofL' && P.u > 0.3))),
    f: ['The sheet of peritoneum running forward and down from the round ligament to the bladder and the front of the pelvis.', 'Medially it is continuous with the vesicouterine fold.'],
    w: 'Opened from the round ligament toward the fold, it leads medially to the bladder flap and laterally to the paravesical space.' },
  { id: 'ura', n: 'Median umbilical fold', g: 'Anterior compartment', t: 1, v: 'ant', at: axC('ura', 0.3), line: axL('ura', 0.05, 0.6), hit: axOn('ura'),
    f: ['The single fold in the midline of the anterior wall, from the dome of the bladder to the umbilicus.', 'It is the urachus.'],
    w: 'It marks the midline and leads down to the apex of the bladder: a guide to where the bladder lies before a suprapubic port goes in.' },
  { id: 'mfold', n: 'Medial umbilical fold', g: 'Anterior compartment', t: 1, v: 'ant', bi: 1, at: axC('umb', 0.66), line: axL('umb', 0.48, 0.85), hit: axOn('umb', 0.46, 1),
    f: ['The prominent fold on each side of the midline, converging on the umbilicus.', 'It is the obliterated umbilical artery.'],
    w: 'Followed back into the pelvis it leads to the internal iliac artery and the origin of the uterine artery. Under the peritoneum it separates the medial from the lateral paravesical space.' },
  { id: 'lfold', n: 'Lateral umbilical fold', g: 'Anterior compartment', t: 1, v: 'ant', bi: 1, at: axC('epa', 0.42), line: axL('epa', 0.08, 0.7), hit: axIs('epi'),
    f: ['A flatter fold lateral to the medial fold: the inferior epigastric artery and its veins, running up toward the rectus muscle.', 'They leave the external iliac vessels just above the inguinal ligament, medial to the deep inguinal ring.'],
    w: 'These are the vessels a lateral port injures. Find them from inside, and bring the trocar in lateral to them under vision.' },
  { id: 'ring', n: 'Deep inguinal ring', g: 'Anterior compartment', t: 1, v: 'ant', bi: 1, at: (k, o) => o.copy(SIDEK[axS(k)].ring), hit: (P, k) => (P.ent === 'round' && P.side === k && P.u > 0.9) || (P.point.distanceTo(SIDEK[axS(k)].ring) < 0.75 && P.ent !== 'epi'),
    f: ['The dimple where the round ligament leaves the abdomen.', 'It lies lateral to the inferior epigastric vessels.'],
    w: 'It ties three landmarks together: the round ligament enters it, the inferior epigastric vessels pass medial to it, and the external iliac vessels leave the pelvis just below it.' },

  { id: 'isthmus', n: 'Uterine isthmus', g: 'Posterior compartment', t: 1, v: 'post', at: axU(0, 3.0, 1.26), hit: P => { if (P.ent !== 'uterus') return false; const y = axLoc(P).y; return y > 2.2 && y < 3.9; },
    f: ['The narrow waist of the uterus between the body and the cervix, at the level of the internal os.', 'Behind, it lies just above where the uterosacral ligaments reach the cervix; in front, at the vesicouterine fold.'],
    w: 'The uterine vessels reach the uterus at this level, and the ureter passes under them 1.5 to 2 cm to the side.' },
  { id: 'usl', n: 'Uterosacral ligament', g: 'Posterior compartment', t: 1, v: 'post', bi: 1, at: (k, o) => sampleArr(AN.side[k || 'R'].uslArr, 0.45, o), line: k => [AN.side[k || 'R'].uslArr, 0.05, 0.95], hit: axIs('usl'),
    f: ['A ridge from the back of the cervix round the side of the rectum toward the sacrum.', 'Antevert the uterus to stretch it: the two ligaments are the sides of the cul-de-sac.'],
    w: 'The ureter runs lateral to it, nearest at the cervix, and the hypogastric nerve lies along its lateral side. It is a common site of deep endometriosis.' },
  { id: 'cds', n: 'Posterior cul-de-sac', g: 'Posterior compartment', t: 1, v: 'post', at: (k, o) => scWall(0, -2.3, 0.04, o), hit: P => (P.ent === 'wall' || P.ent === 'vagina' || (P.ent === 'rectum' && P.point.z < -5.4)) && P.point.z < -4.2 && Math.abs(P.point.x) < 2.5 && P.point.y < -2.4,
    f: ['The lowest part of the peritoneal cavity: behind the cervix and the top of the vagina, in front of the rectum, between the two uterosacral ligaments.', 'The pouch of Douglas.'],
    w: 'Blood and fluid collect here, and so does endometriosis. Seeing the rectum fall away from the cervix, and both uterosacral ligaments, shows that it is not obliterated.' },
  { id: 'rectum', n: 'Rectosigmoid', g: 'Posterior compartment', t: 1, v: 'post', at: (k, o) => { sampleArr(AN.rectumArr, 0.3, o); o.y += 1.25; return o; }, hit: axIs('rectum'),
    f: ['The sigmoid comes down the left side of the pelvis and becomes the rectum in the midline, behind the uterus and vagina.'],
    w: 'The sigmoid lies over the left pelvic brim. The left ureter and the left iliac vessels are usually hidden under it until it is moved toward the midline.' },
  { id: 'postleaf', n: 'Broad ligament, posterior leaf', g: 'Posterior compartment', t: 1, v: 'post', bi: 1, at: (k, o) => stripPt(axG(k).ridge, 0.14, axG(k).floorP, 0.14, 0.6, 0.3, o), hit: axIs('post'),
    f: ['The sheet of peritoneum behind the adnexa, from the ovary and its ligaments down to the uterosacral ligament and the floor of the pelvis.'],
    w: 'The ureter is attached to its deep surface. When the broad ligament is opened and this leaf is drawn medially, the ureter goes with it.' },

  { id: 'prom', n: 'Sacral promontory', g: 'Pelvic brim and sidewall', t: 1, v: 'prom', at: (k, o) => scFloor(0.3, 7.9, 0.05, o), hit: P => P.ent === 'prom' && P.point.z < 10.4 && scH(P.point.x, P.point.z) > 0.55,
    f: ['The forward lip of the first sacral vertebra, in the midline at the back of the pelvic inlet.', 'Firm bone under thin peritoneum.'],
    w: 'The fixation point for a sacrocolpopexy. The left common iliac vein, the middle sacral vessels and the right ureter all lie within a few centimetres of it.' },
  { id: 'bif', n: 'Common iliac bifurcation', g: 'Pelvic brim and sidewall', t: 1, v: 'brim', bi: 1, at: axC('cia', 0.335), hit: (P, k) => axOn('cia', 0.29, 1)(P, k) || axOn('eia', 0, 0.43)(P, k) || axOn('iia', 0, 0.12)(P, k),
    f: ['At the pelvic brim, in front of the sacroiliac joint, the common iliac artery divides.', 'The external iliac artery carries on along the brim; the internal iliac artery turns down into the pelvis.'],
    w: 'The ureter enters the pelvis by crossing the vessels here. It is the most constant place to find it.' },
  { id: 'urbrim', n: 'Ureter at the pelvic brim', g: 'Pelvic brim and sidewall', t: 1, v: 'brim', bi: 1, at: (k, o) => axC('ur', k === 'L' ? 0.2 : 0.273)(k, o), line: k => [AX.c[k || 'R'].ur.A, 0.06, 0.36], hit: (P, k) => axOn('ur')(P, k) && P.point.z > 7.4,
    f: ['A pale tube crossing over the iliac vessels where they divide, medial to the infundibulopelvic ligament.', 'Watch it: a wave of peristalsis passes along it every few seconds.'],
    w: 'The first of the three places it is injured in gynecologic surgery: here, beneath the infundibulopelvic ligament; then under the uterine artery; then beside the cervix and vagina as it enters the bladder.',
    left: 'On the left it is hidden under the sigmoid, which has been moved toward the midline here, and it crosses the common iliac artery a little above the bifurcation.' },
  { id: 'eia', n: 'External iliac artery', g: 'Pelvic brim and sidewall', t: 1, v: 'brim', bi: 1, at: axC('eia', 0.56), line: axL('eia', 0.43, 0.86), hit: axOn('eia', 0.43, 1),
    f: ['The pulsating artery along the pelvic brim, on the medial edge of psoas, from the bifurcation to the inguinal ligament.'],
    w: 'It is the lateral side of the pelvic sidewall triangle. The inferior epigastric artery leaves it just before the inguinal ligament.' },
  { id: 'psoas', n: 'Psoas major', g: 'Pelvic brim and sidewall', t: 1, v: 'brim', bi: 1, at: (k, o) => axPt([axEth(10) + 17, 10, -0.05], axS(k), o), hit: (P, k) => P.side === k && (P.ent === 'psoas' || (P.ent === 'retro' && P.point.z > 0 && axTh(P.point, axS(k)) - axEth(P.point.z) > 4)),
    f: ['The long muscle on the lateral side of the pelvic brim.', 'The external iliac artery runs along its medial edge and the genitofemoral nerve lies on its surface.'],
    w: 'It is the lateral limit of a sidewall dissection. Above the brim the ureter lies on it.' },
  { id: 'gfn', n: 'Genitofemoral nerve', g: 'Pelvic brim and sidewall', t: 1, v: 'brim', bi: 1, at: axC('gfn', 0.42), line: axL('gfn', 0.15, 0.8), hit: axOn('gfn'),
    f: ['A thin pale nerve on the surface of psoas, lateral to the external iliac artery.'],
    w: 'Injury gives numbness or pain over the mons, the labium majus and the upper front of the thigh. It is at risk in any dissection lateral to the artery.' },
  { id: 'tri', n: 'Pelvic sidewall triangle', g: 'Pelvic brim and sidewall', t: 1, v: 'wall', bi: 1, at: (k, o) => stripPt(axG(k).round, 0.8, axG(k).ridge, 0.8, 0.5, 0.3, o),
    area: k => { const G = axG(k), a = []; for (let i = 0; i <= 6; i++) { a.push(sampleArr(G.round, lerp(0.42, 0.98, i / 6), new V3())); a.push(sampleArr(G.ridge, lerp(0.62, 0.99, i / 6), new V3())); } return a; }, hit: (P, k) => P.ent === 'roof' && P.side === k && P.piece === 'roofL' && P.u > 0.3,
    f: ['The triangle of peritoneum bounded by the round ligament in front, the infundibulopelvic ligament medially and the external iliac artery laterally.'],
    w: 'Opening the peritoneum here, parallel and lateral to the infundibulopelvic ligament, is the standard way into the retroperitoneum to find the ureter.' },
  { id: 'urwall', n: 'Ureter on the pelvic sidewall', g: 'Pelvic brim and sidewall', t: 1, v: 'wall', bi: 1, at: (k, o) => axC('ur', k === 'L' ? 0.5 : 0.55)(k, o), line: k => [AX.c[k || 'R'].ur.A, 0.4, 0.68], hit: (P, k) => axOn('ur')(P, k) && P.point.z <= 7.4 && P.point.z > -1.5,
    f: ['Below the brim the ureter runs down the sidewall under the peritoneum of the ovarian fossa, medial to the internal iliac artery.', 'The ovary has been lifted so that it shows through the peritoneum.'],
    w: 'It stays attached to the peritoneum, so once the retroperitoneum is opened it is found on the medial leaf, not on the sidewall.' },

  { id: 'iia', n: 'Internal iliac artery', g: 'Sidewall vessels', t: 2, v: 'prs', bi: 1, at: axC('iia', 0.38), line: axL('iia', 0.05, 1), hit: axOn('iia', 0.12, 1),
    f: ['It turns down into the pelvis from the bifurcation, lateral to the ureter.', 'Its anterior division gives the umbilical, uterine and obturator arteries, among others.'],
    w: 'It is the lateral wall of the lateral pararectal space. The uterine artery can be sealed at its origin from it when the uterus cannot be reached safely.' },
  { id: 'eiv', n: 'External iliac vein', g: 'Sidewall vessels', t: 2, v: 'pvs', bi: 1, at: axC('eiv', 0.6), line: axL('eiv', 0.3, 0.76), hit: axOn('eiv'),
    f: ['Wider and darker than the external iliac artery, lying medial to it and a little below.', 'At the surface it is covered by the peritoneum of the sidewall triangle.'],
    w: 'The obturator fossa lies directly beneath it. Its wall is thin and tears with traction.' },
  { id: 'iiv', n: 'Internal iliac vein', g: 'Sidewall vessels', t: 2, v: 'prs', bi: 1, at: axC('iiv', 0.76), line: axL('iiv', 0.1, 1), hit: axOn('iiv'),
    f: ['Deep to the internal iliac artery and behind it: wide and thin-walled.'],
    w: 'Bleeding from it or its tributaries is hard to control. Dissection in the pararectal space stays on the artery and the ureter, not deep and lateral to them.' },
  { id: 'umb', n: 'Obliterated umbilical artery', g: 'Sidewall vessels', t: 2, v: 'pvm', bi: 1, at: axC('umb', 0.2), line: axL('umb', 0, 0.46), hit: axOn('umb', 0, 0.46),
    f: ['Pull on the medial umbilical fold and this cord tightens. Followed back, it reaches the internal iliac artery.', 'Its first part is still open and gives the superior vesical arteries to the bladder.'],
    w: 'It divides the paravesical space into medial and lateral parts. The uterine artery leaves the internal iliac artery beside it, so following it back finds the uterine artery at its origin.' },
  { id: 'ua', n: 'Uterine artery', g: 'Sidewall vessels', t: 2, v: 'para', bi: 1, at: (k, o) => sampleArr(axG(k).ua, 0.42, o), line: k => [axG(k).ua, 0.25, 1], hit: axIs('ua'),
    f: ['It leaves the anterior division of the internal iliac artery beside the umbilical artery and runs medially in the base of the broad ligament.', 'It crosses over the ureter and reaches the uterus at the isthmus, with its vein beside it.'],
    w: '"Water under the bridge": the ureter passes beneath it. The artery is also the wall between the paravesical space in front and the pararectal space behind.' },
  { id: 'duv', n: 'Deep uterine vein', g: 'Sidewall vessels', t: 2, v: 'para', bi: 1, at: axC('duv', 0.6), line: axL('duv', 0.2, 1), hit: axOn('duv'),
    f: ['The largest vein of the parametrium. It runs from the cervix to the internal iliac vein beneath the ureter; the uterine artery and its vein run over it.'],
    w: 'In a radical or nerve-sparing hysterectomy it marks the floor of the dissection: the pelvic splanchnic nerves lie just beneath it.' },
  { id: 'obv', n: 'Obturator vessels', g: 'Sidewall vessels', t: 2, v: 'pvs', bi: 1, at: axC('oba', 0.55), line: axL('oba', 0.1, 0.95), hit: axIs('obv'),
    f: ['The obturator artery and vein cross the obturator fossa below the nerve, to the obturator canal.'],
    w: 'From above down in the fossa: nerve, artery, vein. A vessel joining them to the external iliac or inferior epigastric vessels over the pubic bone is common, and bleeds briskly if torn.' },

  { id: 'obn', n: 'Obturator nerve', g: 'Nerves', t: 2, v: 'pvs', bi: 1, at: axC('obn', 0.55), line: axL('obn', 0.15, 0.95), hit: axOn('obn'),
    f: ['A flat white nerve crossing the obturator fossa beneath the external iliac vein, to the obturator canal.', 'It comes out from behind the vessels, between the external iliac vein and the internal iliac artery.'],
    w: 'It works the adductors of the thigh. Find it before anything in the fossa is sealed or divided.' },
  { id: 'hgn', n: 'Hypogastric nerve', g: 'Nerves', t: 2, v: 'prs', bi: 1, at: axC('hgn', 0.55), line: axL('hgn', 0.15, 0.92), hit: axOn('hgn'),
    f: ['A fine pale band under the peritoneum beside the rectum, running down from the plexus in front of the promontory.', 'It lies in the same sheet as the ureter, medial and dorsal to it.'],
    w: 'It carries the sympathetic supply to the bladder and rectum. Nerve-sparing surgery for deep endometriosis and cervical cancer is built on finding it and keeping it.',
    left: 'On the left it lies nearer the ureter: about 9 mm, against about 15 mm on the right, in one small series of cadaveric and laparoscopic dissections (Seracchioli and colleagues, 2019).' },

  { id: 'urua', n: 'Ureter under the uterine artery', g: 'Ureter', t: 2, v: 'para', bi: 1, at: (k, o) => axC('ur', (k === 'L' ? 0.8 : 9 / 11) - 0.022)(k, o), hit: (P, k) => axOn('ur')(P, k) && P.point.distanceTo(_x1.set(3.5 * axS(k), -3, -4.5)) < 1.2, // marked where it is last seen before it goes under
    f: ['Beside the cervix the ureter passes under the uterine artery.', 'Follow it down the sidewall until the artery crosses over it.'],
    w: 'The commonest place it is injured at hysterectomy. Pushing the uterus up with the cup and sealing the vessels against the uterus keeps the instrument away from it.' },
  { id: 'urtun', n: 'Ureteric tunnel', g: 'Ureter', t: 2, v: 'para', bi: 1, at: axC('ur', 0.9), line: axL('ur', 0.82, 1), hit: (P, k) => axOn('ur')(P, k) && P.point.z < -5.3,
    f: ['Beyond the artery the ureter turns forward and medially, through the vesicouterine ligament beside the cervix and over the front of the vagina, into the bladder.'],
    w: 'The third place it is injured: at the angle of the vaginal cuff. Taking the bladder well down and to the sides moves it out of the way before the vagina is opened and closed.' },

  Object.assign({ id: 'lpr', n: 'Lateral pararectal space', g: 'Avascular spaces', t: 2, v: 'prs', bi: 1,
    f: ['Behind the uterine artery, between the internal iliac artery laterally and the ureter medially.', 'Latzko\'s space.'],
    w: 'Opening it leaves the ureter on the medial leaf and shows the uterine artery at its origin. It is the usual route to both in a pelvis frozen by endometriosis.' }, axSpace('lpr')),
  Object.assign({ id: 'mpr', n: 'Medial pararectal space', g: 'Avascular spaces', t: 2, v: 'prs', bi: 1,
    f: ['Behind the uterine artery, between the ureter laterally and the rectum and uterosacral ligament medially.', 'Okabayashi\'s space.'],
    w: 'The hypogastric nerve lies in its lateral wall, in the same sheet as the ureter. Developing it frees the uterosacral ligament and the rectum while the nerve stays out on that sheet.' }, axSpace('mpr')),
  Object.assign({ id: 'lpv', n: 'Lateral paravesical space', g: 'Avascular spaces', t: 2, v: 'pvs', bi: 1,
    f: ['In front of the uterine artery, between the obliterated umbilical artery medially and the external iliac vein and obturator internus laterally.', 'The obturator fossa: it holds the obturator nerve, vessels and nodes.'],
    w: 'With the pararectal space opened behind it, the cardinal ligament and the uterine artery stand isolated between the two.' }, axSpace('lpv', ['obn', 'obv'])),
  Object.assign({ id: 'mpv', n: 'Medial paravesical space', g: 'Avascular spaces', t: 2, v: 'pvm', bi: 1,
    f: ['In front of the uterine artery, between the bladder medially and the obliterated umbilical artery laterally.'],
    w: 'It is developed to free the side of the bladder and to reach the vesicouterine ligament, where the ureter enters the bladder.' }, axSpace('mpv')),
  { id: 'card', n: 'Cardinal ligament', g: 'Avascular spaces', t: 2, v: 'para', bi: 1, at: (k, o) => sampleArr(axG(k).ua, 0.67, o).lerp(axC('duv', 0.65)(k, _x1), 0.45), hit: (P, k) => P.side === k && (P.ent === 'card' || (P.ent === 'retro' && P.point.z < -1.7 && P.point.z > -5.2 && Math.abs(axTh(P.point, axS(k)) + 26) < 11)),
    f: ['The band of connective tissue, vessels and nerves from the pelvic sidewall to the cervix and upper vagina, under the uterine artery.', 'It is the partition between the paravesical space in front and the pararectal space behind. Here it is the web between the uterine artery above and the deep uterine vein below.'],
    w: 'At hysterectomy it is divided against the cervix, medial to the ureter. The deep uterine vein and the pelvic splanchnic nerves run in its lower part.' },
  { id: 'vvs', n: 'Vesicovaginal space', g: 'Avascular spaces', t: 2, v: 'vvs', at: (k, o) => o.set(0, -0.9, -1.9).applyMatrix4(VG.M), hit: P => S.flap > 0.6 && ((P.ent === 'vagina' && _x1.copy(P.point).applyMatrix4(_m4.copy(VG.M).invert()).z < 0.4) || (P.ent === 'uterus' && axLoc(P).y < 2.6 && axLoc(P).z < 0.3)),
    f: ['Between the bladder in front and the cervix and vagina behind, entered through the vesicouterine fold.', 'Its floor is the pale pubocervical fascia; at each side is a bladder pillar.'],
    w: 'Stay in the midline on the pale fascia. Bleeding at the side means the dissection is in a bladder pillar, where the ureter runs.' },
  { id: 'rvs', n: 'Rectovaginal space', g: 'Avascular spaces', t: 2, v: 'rvs', at: (k, o) => scWall(0, -1.5, 0.05, o), hit: axIs('rvs'),
    f: ['Between the back wall of the vagina and the rectum, below the peritoneum of the cul-de-sac and between the uterosacral ligaments.'],
    w: 'Opened to free the rectum in endometriosis surgery and for the posterior mesh of a sacrocolpopexy. Stay on the vagina: the fat belongs to the rectum.' }
];
// names for what else can be pointed at
const AXN = {
  wall: 'Peritoneum of the pelvic wall', retro: 'Floor of the opened sidewall', cia: k => CAP[k] + ' common iliac artery', uterus: 'Body of the uterus', vagina: 'Vagina', prom: 'Peritoneum over the lumbar spine',
  ur: k => CAP[k] + ' ureter', roof: 'Broad ligament', areolar: 'Areolar tissue', psoas: k => CAP[k] + ' psoas major', tube: k => CAP[k] + ' fallopian tube', round: k => CAP[k] + ' round ligament'
};
const axLow = t => t.charAt(0).toLowerCase() + t.slice(1);
const axName = (q, k) => (q.bi && k ? CAP[k] + ' ' + axLow(q.n) : q.n);
function axWhat(P) { // the name of whatever a pick is on
  if (!P.hit || !P.ent) return null;
  const k = P.side || ((P.ent === 'uterus' ? axLoc(P).x : P.point.x) >= 0 ? 'R' : 'L');
  for (const q of AXS) if (q.hit(P, q.bi ? k : null)) return axName(q, k);
  const n = AXN[P.ent]; return !n ? null : typeof n === 'function' ? n(k) : n;
}

// ---------- relationships: questions asked only when naming ----------
const AXQ = [
  { id: 'q-cornu', s: 'Order at the cornu', t: 1, v: 'survey', k: 'R', at: axU(2.25, 7.2, -0.5), q: 'At the cornu, which of the three structures leaving it is the most anterior?', a: 'Round ligament', d: ['Fallopian tube', 'Utero-ovarian ligament', 'Infundibulopelvic ligament'], w: 'Front to back at the cornu: round ligament, tube, utero-ovarian ligament.' },
  { id: 'q-epi', s: 'What raises the lateral umbilical fold', t: 1, v: 'ant', k: 'R', at: axC('epa', 0.42), q: 'Which vessels raise the lateral umbilical fold, marked here?', a: 'Inferior epigastric vessels', d: ['Obliterated umbilical artery', 'External iliac vessels', 'Superior vesical arteries'], w: 'The lateral fold is the inferior epigastric artery and veins. A lateral port goes in lateral to them, under vision.' },
  { id: 'q-ip', s: 'What crosses the brim beside the ureter', t: 1, v: 'brim', k: 'R', at: (k, o) => axC('ur', 0.3)(k, o), q: 'The ureter crosses the pelvic brim here. Which fold crosses the brim just lateral to it?', a: 'Infundibulopelvic ligament', d: ['Round ligament', 'Uterosacral ligament', 'Medial umbilical fold'], w: 'The ureter lies medial to and beneath the infundibulopelvic ligament at the brim: the first place it is injured.' },
  { id: 'q-bridge', s: 'What crosses over the ureter', t: 2, v: 'para', k: 'R', at: (k, o) => axC('ur', (k === 'L' ? 0.8 : 9 / 11) - 0.022)(k, o), q: 'Which structure crosses over the ureter here?', a: 'Uterine artery', d: ['Obturator nerve', 'Round ligament', 'Infundibulopelvic ligament'], w: '"Water under the bridge": the ureter passes under the uterine artery beside the cervix.' },
  { id: 'q-pvs', s: 'What divides the paravesical space', t: 2, v: 'pvm', k: 'R', at: axC('umb', 0.2), q: 'Which structure divides the paravesical space into its medial and lateral parts?', a: 'Obliterated umbilical artery', d: ['Uterine artery', 'Obturator nerve', 'External iliac vein'], w: 'Medial to the obliterated umbilical artery lies the bladder; lateral to it, the obturator fossa.' },
  { id: 'q-prs', s: 'What divides the pararectal space', t: 2, v: 'prs', k: 'R', at: axC('ur', 0.52), q: 'Which structure divides the pararectal space into its medial and lateral parts?', a: 'Ureter', d: ['Hypogastric nerve', 'Internal iliac artery', 'Uterosacral ligament'], w: 'Lateral to the ureter is Latzko\'s space, as far as the internal iliac artery. Medial to it is Okabayashi\'s, as far as the rectum.' },
  { id: 'q-obt', s: 'Order in the obturator fossa', t: 2, v: 'pvs', k: 'R', at: axC('obn', 0.55), q: 'In the obturator fossa, which structure lies highest, nearest the external iliac vein?', a: 'Obturator nerve', d: ['Obturator artery', 'Obturator vein', 'Ureter'], w: 'From above down: nerve, artery, vein.' },
  { id: 'q-latzko', s: 'Lateral wall of the lateral pararectal space', t: 2, v: 'prs', k: 'R', at: axC('iia', 0.5), q: 'Which structure is the lateral wall of the lateral pararectal (Latzko\'s) space?', a: 'Internal iliac artery', d: ['Ureter', 'External iliac vein', 'Hypogastric nerve'], w: 'Latzko\'s space lies between the internal iliac artery and the ureter.' }
];

// ---------- the list for a run ----------
const AX_KEY = 'tlh.anat.v1', AX_VIEWS = Object.keys(AXV);
function axRand(seed) { const r = prng(seed * 7919 + 13); return n => Math.floor(r() * n); }
function axBuild() {
  const tiers = AX.set === 'surface' ? [1] : AX.set === 'retro' ? [2] : [1, 2], rnd = axRand(AX.seed), tour = AX.mode === 'tour';
  let items = [];
  for (const q of AXS) if (tiers.includes(q.t)) {
    // a tour shows a structure on both sides where both are in view, otherwise on the right; a test asks for one side
    const k = !q.bi ? null : tour ? (AX_MID[q.v] ? null : AX.tourSide || 'R') : AX.testSide || (rnd(2) ? 'R' : 'L'); // tourSide, testSide: for the automated checks
    items.push({ q, k, note: tour && k === 'L' ? q.left : null });
    if (tour && q.left && k !== 'L') items.push({ q, k: 'L', note: q.left });
  }
  if (AX.mode === 'name') for (const q of AXQ) if (tiers.includes(q.t)) items.push({ q, k: q.k });
  if (!tour) { // keep the scope's walk round the pelvis, and take what is seen from each place in a fresh order
    const key = it => AX_VIEWS.indexOf(it.q.v) * 4 + (it.q.t - 1) * 100 + (it.k === 'L' ? 2 : 0);
    items = items.map(it => ({ it, r: key(it) + rnd(1000) / 1000 })).sort((a, b) => a.r - b.r).map(x => x.it);
    if (AX.mode === 'name') for (const it of items) { // three wrong names beside the right one: from its own group first
      const q = it.q, right = q.a || q.n, pool = q.d ? q.d.slice() : AXS.filter(o => o !== q && o.t === q.t && o.g === q.g).map(o => o.n).concat(AXS.filter(o => o !== q && o.t === q.t && o.g !== q.g).map(o => o.n));
      const wrong = []; for (let i = 0, m = Math.min(pool.length, q.d ? 3 : 7); wrong.length < 3 && i < 40; i++) { const c = pool[rnd(m)]; if (!wrong.includes(c)) wrong.push(c); }
      it.opts = wrong.concat([right]).map(t => ({ t, r: rnd(1000) })).sort((a, b) => a.r - b.r).map(x => x.t); it.right = right;
    }
  }
  AX.steps = items.map((it, i) => axStep(it, i, items.length));
}
const axV = st => AXV[st.q.v](axS(st.k || 'R'), st.k || 'R');
const axSides = st => (st.k ? [st.k] : st.q.bi ? ['R', 'L'] : [null]);
function axGo(i) { if (i >= STEPS.length) { if (AX.mode === 'tour') { resetWorld(false); $('startCard').hidden = false; } else endCase(); } else if (i >= 0) enterStep(i); }
function axPeelToggle() { const st = STEPS[S.step], v = axV(st); if (!v.win || AX.mode !== 'tour') return; AX.peel = AX.peel ? 0 : 1; AX.win[st.k || 'R'].goal = AX.peel; uiDirty(); }
function axMarkList(i, res) { const li = $('cl-' + i); if (li) { li.querySelector('span').textContent = STEPS[i].short; STEPS[i].miss = !res.ok; } }
function axStep(it, i, n) {
  const q = it.q, k = it.k, mode = AX.mode, nm = q.q ? q.a : axName(q, k), ref = q.q ? q.s : nm, last = i === n - 1; // nm: what is marked; ref: what the list and the results call this item
  const prep = () => {
    st.title = mode === 'tour' ? nm : mode === 'find' ? 'Point to the ' + axLow(nm) : q.q || 'What is the structure marked?';
    st.text = mode === 'tour' ? q.f.concat(it.note ? [it.note] : []) : mode === 'find' ? ['Click on it in the picture.', 'The scope and the uterus are set for you. You can still move both.'] : ['Choose its name below, or press its number.'];
  };
  const st = {
    id: q.id + (k || ''), q, k, phase: mode === 'tour' ? q.g : q.t === 1 ? 'At the surface' : 'Under the peritoneum', tool: 'any', nm, ref,
    short: mode === 'tour' ? nm : 'Structure ' + (i + 1), title: '', text: [], pearl: q.w, state: 'ask', tries: 0, t0: 0, auto: 0,
    get dist() { return axV(st).d; },
    focus(o) { const v = axV(st); o.set(v.g[0], v.g[1], v.g[2]); if (mode === 'tour' && (st.k || !q.bi)) o.lerp(q.at(st.k, _x2), 0.45); return o; }, // a tour leans toward what it is showing; a test does not give it away
    done: () => false,
    enter() {
      axApply(axV(st), k || 'R'); st.state = 'ask'; st.tries = 0; st.t0 = S.t; st.auto = 0; AX.miss = null; prep();
    },
    noPearl: () => mode !== 'tour' && st.state === 'ask',
    tick(dt) { if (st.auto > 0 && (st.auto -= dt) <= 0) axGo(i + 1); },
    settle(ok, how) { // an answer is in: record it, show what there is to learn, and move on (at once if it was right first time)
      AX.res[i] = { ok, tries: st.tries, shown: how === 'shown', said: how && how !== 'shown' ? how : null, t: S.t - st.t0 };
      st.state = ok ? 'right' : how === 'shown' ? 'shown' : st.tries && mode === 'find' ? 'found' : 'wrong';
      st.short = ref; st.text = q.f || []; if (mode === 'name' && !q.q) st.title = nm; axMarkList(i, AX.res[i]);
      if (ok) { sfx.ok(); st.auto = 1.3; } else sfx.warn();
      logEvent(ok ? 'ok' : 'tech', ok ? 'Right: ' + ref : how === 'shown' ? 'Shown: ' + ref : mode === 'name' ? (q.q ? ref + ': a' : 'A') + 'nswered "' + how + '". It is the ' + axLow(nm) + '.' : 'Found after ' + st.tries + (st.tries > 1 ? ' misses: ' : ' miss: ') + ref);
      uiDirty(true);
    },
    click(h) {
      if (mode !== 'find') { if (mode === 'tour' && h.pick.hit) { const w = axWhat(h.pick); if (w) toast(w, 'info'); } return true; }
      if (st.state !== 'ask' || !h.pick.hit) return true;
      if (q.hit(h.pick, k)) { st.settle(st.tries === 0); return true; }
      st.tries++; const w = axWhat(h.pick); AX.miss = { p: h.pick.point.clone(), t: S.t, w };
      if (st.tries >= 3) { toast('Three misses: here it is.', 'tech'); st.settle(false, 'shown'); return true; }
      sfx.click(); toast((w ? 'That is the ' + axLow(w) + '. ' : '') + (st.tries === 1 ? 'A hint is on the right.' : 'One more try.'), 'tech');
      st.text = q.f; uiDirty(true); return true;
    },
    button: { label: mode === 'tour' ? (last ? 'Finish the tour' : 'Next') : 'Show me', fn() { if (mode === 'tour' || st.state !== 'ask') axGo(i + 1); else st.settle(false, 'shown'); } },
    button2: { label: 'Back', show: () => mode === 'tour' && i > 0, fn: () => axGo(i - 1) },
    progress: () => (mode === 'tour' ? '' : AX.res.filter(r => r && r.ok).length + ' right of ' + AX.res.filter(r => r).length),
    frac: () => (mode === 'tour' ? (i + 1) / n : AX.res.filter(r => r).length / n)
  };
  prep();
  if (mode === 'name') { // the names to choose from, and what choosing one does
    st.choices = () => it.opts.map((t, j) => ({ label: (j + 1) + '  ' + t, cls: st.state === 'ask' ? '' : t === it.right ? 'ok' : t === st.said ? 'no' : 'dim' }));
    st.choose = j => { if (st.state !== 'ask' || !it.opts[j]) return; st.said = it.opts[j]; if (st.said === it.right) st.settle(true); else st.settle(false, st.said); };
  } else if (mode === 'tour') {
    st.choices = () => (axV(st).win ? [{ label: AX.peel ? 'Put the peritoneum back' : 'Open the peritoneum', cls: '' }] : []);
    st.choose = () => axPeelToggle();
  }
  return st;
}
// once an answer is in, the button moves on
function axButtons() { const st = STEPS[S.step]; if (AX.mode !== 'tour') st.button.label = st.state === 'ask' ? 'Show me' : S.step === STEPS.length - 1 ? 'See the results' : 'Next'; }

// ---------- marking the picture ----------
const AXM = { t: -9, vis: [], key: '' }, _mp = { x: 0, y: 0, z: 0 };
function axHull(P) { // the outline round a set of points in the picture
  P = P.slice().sort((a, b) => a.x - b.x || a.y - b.y); if (P.length < 3) return P;
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
function axMark(c, st, time, label, col) {
  const q = st.q, rgb = col === 'ok' ? '95,207,142' : col === 'warn' ? '240,178,74' : '67,198,192', pr = 1 + 0.12 * Math.sin(time * 5);
  let named = false; const tags = [];
  for (const k of axSides(st)) {
    let ax = 0, ay = 0, on = false;
    if (q.area) {
      const pts = q.area(k || 'R').map(p => project(p, { x: 0, y: 0, z: 0 })).filter(p => p.z < 1), h = axHull(pts);
      if (h.length > 2) { c.beginPath(); h.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.fillStyle = 'rgba(' + rgb + ',0.2)'; c.fill(); c.setLineDash([5, 5]); c.strokeStyle = 'rgba(' + rgb + ',0.95)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); for (const p of h) { ax += p.x / h.length; ay += p.y / h.length; } on = true; }
    } else {
      if (q.line) { const L = q.line(k); c.setLineDash([5, 6]); c.strokeStyle = 'rgba(' + rgb + ',0.9)'; c.lineWidth = 2.2; c.beginPath(); let pen = false; for (let j = 0; j <= 18; j++) { project(sampleArr(L[0], lerp(L[1], L[2], j / 18), _x1), _mp); if (_mp.z >= 1) { pen = false; continue; } pen ? c.lineTo(_mp.x, _mp.y) : c.moveTo(_mp.x, _mp.y); pen = true; } c.stroke(); c.setLineDash([]); }
      project(q.at(k, _x1), _mp); if (_mp.z < 1) { ax = clamp(_mp.x, 20, VW - 20); ay = clamp(_mp.y, 20, VH - 20); on = true; c.strokeStyle = 'rgba(' + rgb + ',1)'; c.lineWidth = 2.5; c.beginPath(); c.arc(ax, ay, 16 * pr, 0, TAU); c.stroke(); }
    }
    if (on && label && !(named && !q.bi)) { tags.push([ax, ay, st.k || !q.bi ? label : CAP[k] + ' ' + axLow(label)]); named = true; }
  }
  // two marks in one picture: the one on the left of the screen is named to its left, so that the names do not lie on each other
  c.font = '500 12px "IBM Plex Sans", system-ui, sans-serif';
  tags.forEach((t, i) => pill(c, tags.length > 1 && t[0] < tags[1 - i][0] ? t[0] - 36 - c.measureText(t[2]).width : t[0] + 22, t[1] - 30, t[2], '#0b1014', 'rgb(' + rgb + ')'));
}
function axOverlay(c, time) {
  const st = STEPS[S.step], mode = AX.mode; if (!st.q) return;
  if (mode === 'tour') { if (S.guided) axMark(c, st, time, st.q.n, ''); }
  else if (st.state !== 'ask') axMark(c, st, time, st.nm, st.state === 'right' ? 'ok' : 'warn');
  else if (mode === 'name') axMark(c, st, time, null, '');
  const m = AX.miss; // a miss: where the click fell
  if (m && S.t - m.t < 1.8 && st.state === 'ask') { project(m.p, _mp); c.strokeStyle = '#ef5a56'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(_mp.x - 7, _mp.y - 7); c.lineTo(_mp.x + 7, _mp.y + 7); c.moveTo(_mp.x + 7, _mp.y - 7); c.lineTo(_mp.x - 7, _mp.y + 7); c.stroke(); if (m.w) pill(c, _mp.x + 14, _mp.y - 26, m.w, '#ffd9d7', 'rgba(90,10,10,0.85)'); }
}
// With Labels on, a tour names everything that belongs to the view in hand. A test names nothing.
function axLabels() {
  const st = STEPS[S.step]; if (AX.mode !== 'tour' || !st.q) return [];
  const key = st.q.v + (st.k || ''); if (AXM.key === key) return AXM.list;
  AXM.key = key; AXM.list = [];
  for (const q of AXS) if (q.v === st.q.v && q !== st.q) for (const k of q.bi ? (AX_MID[q.v] ? ['R', 'L'] : [st.k || 'R']) : [null]) AXM.list.push([axName(q, AX_MID[q.v] ? k : null), () => q.at(k, _w)]);
  return AXM.list;
}

// ---------- where the scope is looking ----------
// A small map beside the manipulator: the pelvis as the scope sees it from the port, drawn in outline, with a frame
// round what the picture in hand shows. A laparoscope has no view from outside; this is what stands in for one.
const AXI = { cv: $('axMap'), cam: null, t: -9, o: { x: 0, y: 0 } };
function axMap() {
  const I = AXI, cv = I.cv, W = 168, H = 112, o = I.o, pr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== W * pr) { cv.width = W * pr; cv.height = H * pr; }
  if (!I.cam) { // the survey's own line of sight, from a little further back
    const v = AXV.survey(), g = _x1.set(v.g[0], v.g[1], v.g[2]), d = _x2.subVectors(g, CAM.pivot), L = d.length();
    I.cam = new THREE.PerspectiveCamera(camera.fov, W / H, 0.5, 90); I.cam.position.copy(CAM.pivot).addScaledVector(d, (L - v.d - 2.5) / L); I.cam.lookAt(g); I.cam.updateMatrixWorld(true);
  }
  const c = cv.getContext('2d'), P = (p, first) => { _pv.copy(p).project(I.cam); o.x = ((_pv.x + 1) / 2) * W; o.y = ((1 - _pv.y) / 2) * H; first ? c.moveTo(o.x, o.y) : c.lineTo(o.x, o.y); };
  c.setTransform(pr, 0, 0, pr, 0, 0); c.clearRect(0, 0, W, H); c.lineJoin = c.lineCap = 'round'; c.lineWidth = 1;
  // the pelvic wall at three levels, the rectosigmoid, the bladder
  c.strokeStyle = 'rgba(223,232,236,0.34)'; for (const z of [6, 0, -5.5]) { c.beginPath(); for (let i = 0; i <= 36; i++) P(bowlPoint(Math.cos((i / 36) * TAU), Math.sin((i / 36) * TAU), z, 0, _x1), !i); c.stroke(); }
  c.strokeStyle = 'rgba(205,150,140,0.75)'; c.lineWidth = 6; c.beginPath(); for (let i = 0; i <= 20; i++) P(sampleArr(AN.rectumArr, i / 20, _x1), !i); c.stroke();
  c.fillStyle = 'rgba(232,196,150,0.55)'; c.beginPath(); for (let i = 0; i <= 24; i++) P(_x1.set(BL.c.x + BL.r.x * Math.cos((i / 24) * TAU), BL.c.y + BL.r.y * Math.sin((i / 24) * TAU), BL.c.z + 1), !i); c.fill();
  // the adnexa and round ligaments, then the uterus over them
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(240,206,196,0.85)'; c.fillStyle = 'rgba(244,236,226,0.95)';
  for (const k of ['R', 'L']) { const G = axG(k); for (const A of [G.round, G.ridge]) { c.beginPath(); for (let i = 0; i <= 12; i++) P(sampleArr(A, i / 12, _x1), !i); c.stroke(); } c.beginPath(); P(G.ovC, true); c.arc(o.x, o.y, 3.2, 0, TAU); c.fill(); }
  c.beginPath(); P(_x1.set(0, 6.2, 0).applyMatrix4(UT.M).add(_x3.set(2.5, 0, 0)), true); const ux = o.x; P(_x1.sub(_x3), true); // the body of the uterus, as a disc where it stands
  c.fillStyle = 'rgba(206,104,96,0.96)'; c.beginPath(); c.ellipse(o.x, o.y, ux - o.x, 0.82 * (ux - o.x), 0, 0, TAU); c.fill();
  // the picture in hand: its four corners, where the scope is looking
  const f = _x2.subVectors(CAM.tgt, camera.position).normalize();
  c.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((q, i) => { const d = _x1.set(q[0], q[1], 0.5).unproject(camera).sub(camera.position); P(d.multiplyScalar(CAM.dist / d.dot(f)).add(camera.position), !i); }); c.closePath();
  c.fillStyle = 'rgba(67,198,192,0.1)'; c.fill(); c.strokeStyle = 'rgba(67,198,192,1)'; c.lineWidth = 1.8; c.stroke();
  c.font = '600 10px "IBM Plex Sans", system-ui, sans-serif'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(223,232,236,0.8)'; c.fillText('L', 6, H / 2); c.fillText('R', W - 13, H / 2);
}

// ---------- results ----------
function axScore() {
  const R = AX.res, n = STEPS.length, ok = R.filter(r => r && r.ok).length, notes = [];
  STEPS.forEach((st, i) => { const r = R[i]; if (r && !r.ok) notes.push(st.ref + ': ' + (r.shown ? (r.tries ? 'shown after ' + r.tries + (r.tries > 1 ? ' misses' : ' miss') : 'shown') : r.said ? 'answered "' + r.said + '"' + (st.q.q ? ', not ' + axLow(st.nm) : '') : 'found after ' + r.tries + (r.tries > 1 ? ' misses' : ' miss'))); });
  return { pts: Math.round((100 * ok) / n), grade: ok + ' of ' + n + ' right first time. ' + (AX.mode === 'find' ? 'Find it' : 'Name it') + ', ' + axSetName().toLowerCase() + '.', notes, clean: 'Nothing to revise: every one right first time.' };
}
const axSetName = () => (AX.set === 'surface' ? 'At the surface' : AX.set === 'retro' ? 'Under the peritoneum' : 'Both tiers');
function axSummary(row) {
  const R = AX.res.filter(r => r), ts = R.map(r => r.t).sort((a, b) => a - b), med = ts.length ? ts[Math.floor(ts.length / 2)] : 0;
  return row(AX.mode === 'name' ? 'Questions' : 'Structures', STEPS.length) + row('Right first time', R.filter(r => r.ok).length, 'ok') + (AX.mode === 'find' ? row('Found after a miss', R.filter(r => !r.ok && !r.shown).length) : '') + row('Shown', R.filter(r => r.shown).length) + row('Time', fmtT(S.t)) + row('Median time for one', med.toFixed(1) + ' s');
}
function axDebrief(row) {
  const by = {}, slow = [], order = []; for (const q of AXS) if (!order.includes(q.g)) order.push(q.g); order.push('Relationships');
  STEPS.forEach((st, i) => { const r = AX.res[i], g = st.q.q ? 'Relationships' : st.q.g; by[g] = by[g] || [0, 0]; by[g][1]++; if (r && r.ok) by[g][0]++; if (r) slow.push([st.ref, r.t]); });
  slow.sort((a, b) => b[1] - a[1]);
  return [order.filter(g => by[g]).map(g => row(g, by[g][0] + ' of ' + by[g][1], by[g][0] === by[g][1] ? 'ok' : by[g][0] < by[g][1] / 2 ? 'warn' : '')).join(''), slow.slice(0, 6).map(x => row(x[0], x[1].toFixed(1) + ' s')).join('')];
}

// ---------- the case ----------
try { const o = JSON.parse(localStorage.getItem(AX_KEY) || 'null'); if (o && ['tour', 'find', 'name'].includes(o.mode)) AX.mode = o.mode; if (o && ['surface', 'retro', 'all'].includes(o.set)) AX.set = o.set; } catch (_) {}
const axOpt = key => ({ get: () => AX[key], set(v) { AX[key] = v; try { localStorage.setItem(AX_KEY, JSON.stringify({ mode: AX.mode, set: AX.set })); } catch (_) {} axBuild(); } });
axBuild();
const ANAT = {
  id: 'anat', name: 'Pelvic anatomy', tag: '', blurb: 'Find and name the pelvic structures a surgeon has to know on sight. ' + AXS.length + ' structures.', cls: 'anat',
  sub: 'A normal pelvis at laparoscopy: the surface, then the retroperitoneum of the sidewall.',
  brief: ['The scope is at the umbilicus, looking into the pelvis: her right is on the right of the screen. A uterine manipulator is in place. Nothing is operated on here: the scope and the uterus are moved for you from one view to the next, and you can move both yourself. A small map under the picture shows where in the pelvis the scope is looking.',
    '<b>Tour</b> shows each structure in turn, with where to find it and why it matters. <b>Find it</b> names a structure and you click on it. <b>Name it</b> marks one and you choose its name; it also asks how structures lie to one another. Under the peritoneum, the sidewall is shown with its peritoneum opened as a window.'],
  options: [
    Object.assign({ label: 'What to do', opts: [['tour', 'Tour', 'Each structure in turn, named, with where to find it and why it matters'], ['find', 'Find it', 'A structure is named: click on it in the picture'], ['name', 'Name it', 'A structure is marked: choose its name']] }, axOpt('mode')),
    Object.assign({ label: 'Which structures', opts: [['surface', 'At the surface', AXS.filter(q => q.t === 1).length + ' structures seen without opening the peritoneum'], ['retro', 'Under the peritoneum', AXS.filter(q => q.t === 2).length + ' structures of the retroperitoneum: vessels, nerves, the ureter and the avascular spaces'], ['all', 'Both', 'All ' + AXS.length]] }, axOpt('set'))
  ],
  help: [['Click', 'Find it: click on the structure asked for. Tour: click anything to name it.'], ['Point', 'Tour: the name of what is under the pointer is shown'], ['Space, Enter', 'Next'], ['B', 'Tour: back'], ['1 to 4', 'Name it: choose an answer'], ['P', 'Tour: put the peritoneum back, or open it again'], ['L', 'Tour: name everything in view'], ['G', 'Tour: hide or show the marks, to test yourself'], ['W A S D, Q E', 'Uterine manipulator: tilt, deviate, push cephalad'], ['Wheel, + and &minus;, arrows', 'Advance and aim the scope']],
  get steps() { return AX.steps; }, insts: ['suction'], hands: { L: 'suction', R: 'suction' }, pointer: true, noHands: true, warp: [0, 0], tipZ: 11, ureters: false, eblWarn: 1e9, needleHint: '',
  listTitle: 'Structures', stepWord: '', dbTitle: 'Results', pearlTag: 'Why it matters', dbHeads: ['To revise', 'Summary', 'By region', 'Slowest'], dbA: axSummary,
  state(s) { AX.res = []; AX.miss = null; AXM.key = ''; if (AX.mode !== 'tour' && !AX.fixed) AX.seed++; axBuild(); STEPS = AX.steps; buildChecklist(); }, // a test is in a fresh order each time
  show: axShow, update(dt, time) { axUpdate(dt, time); if (S.running) axButtons(); }, bladder(c) { c.x -= 1.4 * AX.bladP; }, overlay: axOverlay, labelSet: axLabels,
  hover: P => (AX.mode === 'tour' ? axWhat(P) : null),
  jump: i => { if (AX.mode === 'tour' && S.running) axGo(i); },
  key(k) {
    const st = STEPS[S.step];
    if (k === ' ' || k === 'enter' || k === 'n') { if (AX.mode === 'tour' || st.state !== 'ask') st.button.fn(); return true; }
    if (k === 'b') { if (st.button2.show()) st.button2.fn(); return true; }
    if (k === 'p') { axPeelToggle(); return true; }
    if (k >= '1' && k <= '4' && AX.mode === 'name') { st.choose(+k - 1); return true; }
    return (k >= '1' && k <= '9') || k === 'x' || k === 'c'; // no instruments to change, switch or fire here
  },
  score: axScore, debrief: axDebrief, sutures: () => ({ st: [], from: null, on: false }), force() { const st = STEPS[S.step]; if (AX.mode === 'tour') axGo(S.step + 1); else if (st.state === 'ask') st.settle(true); else axGo(S.step + 1); }
};
