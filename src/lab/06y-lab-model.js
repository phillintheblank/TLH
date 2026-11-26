// ---------- lab: the right pelvic sidewall as tissue that moves ----------
// The lab keeps its own settings: nothing it stores is read by the simulator on the same site.
(function () {
  const P = Storage.prototype, g = P.getItem, s = P.setItem, m = k => String(k).replace(/^tlh\./, 'lab.');
  P.getItem = function (k) { return g.call(this, m(k)); }; P.setItem = function (k, v) { return s.call(this, m(k), v); };
})();

// The uterus is held to the patient's left, and stays there: the sheet below is laid out on the round ligament and
// the ovary as they lie in that position.
const LB = { POSE: { yaw: -0.5, pitch: 0.17, push: 0 }, NU: 34, NX: 10, NR: 22, NP: 14, IPU: 0.62, URW: 0.56 };
LB.NC = LB.NU + LB.NX + 1; LB.NW = LB.NR + LB.NP + 1; LB.NS = LB.NC * LB.NW; LB.NQ = (LB.NC - 1) * (LB.NW - 1);
const LG = new SideGeom(1); LG.compute(poseMat(LB.POSE, new THREE.Matrix4()), null, null);
const PX = new XPBD(4600, 15000);
const _l1 = new V3(), _l2 = new V3(), _l3 = new V3(), _l4 = new V3(), _l5 = new V3();
// where the external iliac artery and vein lie round the wall, in degrees, at a given depth of the pelvis
const lbTh = (z, a) => { for (let i = 0; i < a.length - 1; i++) if (z >= a[i + 1][0] || i === a.length - 2) return lerp(a[i][1], a[i + 1][1], clamp((a[i][0] - z) / (a[i][0] - a[i + 1][0]), -0.3, 1.3)); };
const thA = z => lbTh(z, [[14, -24], [7, -6], [1.5, 13], [-2.6, 30]]), thV = z => lbTh(z, [[14, -36], [7, -17], [1.5, 2], [-2.8, 20]]);
const thTop = z => thA(z) + 9 + 5 * sstep(-2, 2, z); // the sheet's lateral attachment, on the psoas above the artery
const BRIM = 10.8;
// the foot of the medial leaf: the broad ligament's own near the uterus, then down onto the floor and along the wall below the vessels
LB.foot = spline([LG.floorP[1], LG.floorP[6], LG.floorP[12], V(4.6, -4.5, -0.9), wallPt(-41, 1.2, 0.08, 1), wallPt(-46, 4, 0.05, 1), wallPt(-48, 7, 0.05, 1)], vecArr(33));
// the column of the sheet that lies on the wall: up the psoas from the internal ring to the brim (rows of the roof),
// then down across the brim (rows of the medial leaf)
function lbWallCol(roof, v, out) {
  if (roof) { const z = lerp(-2.9, BRIM, Math.pow(v, 0.85)); return bowlPoint(Math.cos(lerp(thTop(z), -10, sstep(0.78, 1, v)) * DEG), Math.sin(lerp(thTop(z), -10, sstep(0.78, 1, v)) * DEG), z, 0.05, out); }
  const th = lerp(-10, -51, v) * DEG; return bowlPoint(Math.cos(th), Math.sin(th), BRIM - 0.5 * v, 0.05, out);
}
const lbU = (i, j) => { const roof = j <= LB.NR, v = roof ? j / LB.NR : (j - LB.NR) / LB.NP; return lerp(roof ? lerp(0.45, 0.1, v) : lerp(0.1, 0.03, v), 1, Math.min(1, i / LB.NU)); };
// Where particle (i, j) of the sheet rests. i runs from the uterus out to the wall and on over it to the brim; j runs
// from the round ligament over the infundibulopelvic ligament (row NR) and down the medial leaf to its foot.
function lbRest(i, j, out) {
  const roof = j <= LB.NR, v = roof ? j / LB.NR : (j - LB.NR) / LB.NP, u = lbU(i, j), lam = Math.max(0, (i - LB.NU) / LB.NX);
  if (roof) stripPt(LG.round, u, LG.ridge, u, v, 0.3, out); else stripPt(LG.ridge, u, LB.foot, u, v, 0.3, out);
  if (lam > 0) out.lerp(lbWallCol(roof, v, _l1), lam);
  // it stands off the wall over the vessels and the ureter: most along the ligament, nothing at its edges
  const w = roof ? v : 1 + v, k = 1.15 * sstep(0.6, 1, u) * Math.pow(Math.cos(lam * Math.PI / 2), 0.5) * Math.pow(Math.sin(Math.PI * w / 2), 0.6);
  if (k > 0) { _l2.set(-out.x, BOWL_YC - out.y, 0).normalize(); out.addScaledVector(_l2, k); }
  return out;
}
const lbId = (i, j) => j * LB.NC + i;
(function () { // the sheet: particles, the constraints that hold it together, and what holds its edges
  const { NC, NW, NR, NU } = LB; LB.pin = new Uint8Array(LB.NS);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    lbRest(i, j, _l3);
    const pin = i === 0 || i === NC - 1 || j === 0 || j === NW - 1 || (j === NR && lbU(i, j) < LB.IPU); // the ovary and its ligament do not move
    PX.add(_l3.x, _l3.y, _l3.z, pin ? 0 : 1, 400); LB.pin[lbId(i, j)] = pin ? 1 : 0;
  }
  LB.eh = new Int32Array(NC * NW).fill(-1); LB.ev = new Int32Array(NC * NW).fill(-1); LB.qd = new Int32Array(LB.NQ * 2);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    if (i < NC - 1) LB.eh[lbId(i, j)] = PX.link(lbId(i, j), lbId(i + 1, j), 0.05);
    if (j < NW - 1) LB.ev[lbId(i, j)] = PX.link(lbId(i, j), lbId(i, j + 1), 0.05);
    if (i < NC - 1 && j < NW - 1) { const q = j * (NC - 1) + i; LB.qd[q * 2] = PX.link(lbId(i, j), lbId(i + 1, j + 1), 0.5); LB.qd[q * 2 + 1] = PX.link(lbId(i + 1, j), lbId(i, j + 1), 0.5); }
  }
  // which way is in: toward the wall and the floor, away from the scope
  LB.nin = new Float32Array(LB.NS * 3);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    lbRest(Math.min(i + 1, NC - 1), j, _l1).sub(lbRest(Math.max(i - 1, 0), j, _l2)); lbRest(i, Math.min(j + 1, NW - 1), _l3).sub(lbRest(i, Math.max(j - 1, 0), _l4));
    _l1.cross(_l3).normalize(); if (!(_l1.lengthSq() > 0.5)) _l1.set(0, -1, 0);
    LB.nin.set([_l1.x, _l1.y, _l1.z], lbId(i, j) * 3);
  }
  PX.rest(lbId(NU - 6, NR >> 1), _l2); const k = lbId(NU - 6, NR >> 1) * 3;
  LB.flip = LB.nin[k + 1] > 0 ? -1 : 1; // in the roof, in is down
  for (let q = 0; q < LB.nin.length; q++) LB.nin[q] *= LB.flip;
})();
const lbNin = (i, out) => out.set(LB.nin[i * 3], LB.nin[i * 3 + 1], LB.nin[i * 3 + 2]);
// how far it is from a place on the sheet in to the wall (or 2.4 cm where the wall is further than that)
function lbGap(i) { PX.rest(i, _l1); lbNin(i, _l2); let t = 0.15; for (; t < 2.4; t += 0.15) if (!inBowl(_l1.x + _l2.x * t, _l1.y + _l2.y * t, _l1.z + _l2.z * t)) break; return t - 0.15; }

// ---- what the scope sees of it ----
LB.dead = new Uint8Array(LB.NQ * 2); // triangles of the sheet that have been cut out: two to a square
LB.near = new Uint8Array(LB.NQ * 2); // triangles within two of an opening: its edge, which gives way to an instrument pushed through it
LB.heldV = new Uint8Array(LB.NS);    // places on the sheet that are in a pair of jaws: the fold they hold does not get in the way of the instrument holding it
LB.seal = new Float32Array(LB.NS); // how far each place on it has been coagulated
(function () {
  const { NC, NW, NS, NQ } = LB, g = new THREE.BufferGeometry(), uv = new Float32Array(NS * 2);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) { uv[lbId(i, j) * 2] = (i / (NC - 1)) * 2.3; uv[lbId(i, j) * 2 + 1] = (j / (NW - 1)) * 1.9; }
  LB.pos = PX.x.subarray(0, NS * 3); LB.nor = new Float32Array(NS * 3); LB.col = new Float32Array(NS * 3).fill(1); LB.dry = new Float32Array(NS);
  g.setAttribute('position', new THREE.BufferAttribute(LB.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(LB.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(LB.col, 3)); g.setAttribute('dry', new THREE.BufferAttribute(LB.dry, 1)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  LB.idx = new Uint16Array(NQ * 6);
  g.setIndex(new THREE.BufferAttribute(LB.idx, 1)); g.boundingSphere = BIG_SPHERE();
  // peritoneum: the simulator's broad-ligament leaf, but less of what lies under it shows through
  LB.mat = wet({ map: TEX.leaf, side: THREE.DoubleSide, mr: [4, 4], bs: 0.45, roughness: 0.5, transmission: 0.34, transmissionMap: TEX.leaf.userData.trans, thickness: 0, ior: 1.4 }); TRANSLUCENT.push([LB.mat, 0.34]);
  LB.geo = g; LB.mesh = new THREE.Mesh(g, LB.mat); LB.mesh.frustumCulled = false; scene.add(LB.mesh);
  // What an instrument meets is the same sheet less a margin round every opening (see lbReindex): never drawn
  const gp = new THREE.BufferGeometry(); LB.pidx = new Uint16Array(NQ * 6);
  gp.setAttribute('position', g.attributes.position); gp.setIndex(new THREE.BufferAttribute(LB.pidx, 1)); gp.boundingSphere = BIG_SPHERE();
  LB.pick = reg(new THREE.Mesh(gp, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false })), 'perit', 'R'); LB.pick.frustumCulled = false; scene.add(LB.pick);
  // the same sheet with nothing cut out of it, never drawn: a ray that passes it has gone under the peritoneum
  const gf = new THREE.BufferGeometry(), fi = new Uint16Array(NQ * 6);
  for (let q = 0; q < NQ; q++) { const i = q % (NC - 1), j = (q / (NC - 1)) | 0, a = lbId(i, j), b = a + 1, c = a + NC, d = c + 1; fi.set(LB.flip > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c], q * 6); } // wound so that its outer face is the one toward the scope
  gf.setAttribute('position', g.attributes.position); gf.setIndex(new THREE.BufferAttribute(fi, 1)); gf.boundingSphere = BIG_SPHERE();
  LB.full = new THREE.Mesh(gf, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); LB.fullIdx = fi;
})();
// Draw the triangles that are left, and let go of the threads that ran across one that is gone. The edge of an opening
// does not stop an instrument: peritoneum within two triangles of one is left out of what the instruments meet, and
// tears if a tip or a shaft is pushed through it (lbHands).
const _lv1 = new Uint8Array(LB.NS), _lv2 = new Uint8Array(LB.NS);
function lbReindex() {
  const { NC, NW, dead, idx, near, pidx } = LB, NT = LB.NQ * 2; let n = 0, m = 0;
  // a triangle left hanging by one side or by a corner goes with what was cut
  const A = (i, j, k) => i < 0 || j < 0 || i >= NC - 1 || j >= NW - 1 || !dead[(j * (NC - 1) + i) * 2 + k]; // triangle k of square (i, j) is still there (or lies beyond the sheet's own edge, where it is held)
  for (let pass = 0, any = true; pass < 4 && any; pass++) { any = false; for (let k = 0; k < NT; k++) if (!dead[k]) { const q = k >> 1, i = q % (NC - 1), j = (q / (NC - 1)) | 0, nb = k & 1 ? A(i, j, 0) + A(i, j + 1, 0) + A(i + 1, j, 0) : A(i, j, 1) + A(i, j - 1, 1) + A(i - 1, j, 1); if (nb < 2) { dead[k] = 1; any = true; } } }
  _lv1.fill(0); _lv2.fill(0); near.fill(0);
  for (let k = 0; k < NT; k++) if (dead[k]) for (const v of lbTri(k)) _lv1[v] = 1;
  for (let k = 0; k < NT; k++) if (!dead[k]) { const c = lbTri(k); if (_lv1[c[0]] || _lv1[c[1]] || _lv1[c[2]]) { near[k] = 1; _lv2[c[0]] = _lv2[c[1]] = _lv2[c[2]] = 1; } }
  for (let k = 0; k < NT; k++) if (!dead[k] && !near[k]) { const c = lbTri(k); if (_lv2[c[0]] || _lv2[c[1]] || _lv2[c[2]]) near[k] = 2; }
  for (let k = 0; k < NT; k++) if (!dead[k]) { idx.set(LB.fullIdx.subarray(k * 3, k * 3 + 3), n * 3); n++; const c = lbTri(k); if (!near[k] && !LB.heldV[c[0]] && !LB.heldV[c[1]] && !LB.heldV[c[2]]) { pidx.set(LB.fullIdx.subarray(k * 3, k * 3 + 3), m * 3); m++; } }
  LB.geo.setDrawRange(0, n * 3); LB.geo.index.needsUpdate = true; LB.pick.geometry.setDrawRange(0, m * 3); LB.pick.geometry.index.needsUpdate = true;
  const G = (i, j, k) => i < 0 || j < 0 || i >= NC - 1 || j >= NW - 1 || dead[(j * (NC - 1) + i) * 2 + k]; // triangle k of square (i, j) is gone, or was never there
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    const h = LB.eh[lbId(i, j)], v = LB.ev[lbId(i, j)];
    if (h >= 0) PX.cf[h] = G(i, j, 0) && G(i, j - 1, 1) ? 0 : 1;
    if (v >= 0) PX.cf[v] = G(i, j, 0) && G(i - 1, j, 1) ? 0 : 1;
  }
  for (let q = 0; q < LB.NQ; q++) { PX.cf[LB.qd[q * 2]] = dead[q * 2] || dead[q * 2 + 1] ? 0 : 1; PX.cf[LB.qd[q * 2 + 1]] = dead[q * 2] && dead[q * 2 + 1] ? 0 : 1; }
}
// the middle of triangle k of the sheet, and its three corners
const lbTri = k => { const q = k >> 1, a = lbId(q % (LB.NC - 1), (q / (LB.NC - 1)) | 0); return k & 1 ? [a + 1, a + LB.NC + 1, a + LB.NC] : [a, a + 1, a + LB.NC]; };
const lbTriC = (k, out) => { const c = lbTri(k); return PX.get(c[0], out).add(PX.get(c[1], _l1)).add(PX.get(c[2], _l1)).multiplyScalar(1 / 3); };
function lbNormals() { // each place takes the mean of the squares round it
  const { NC, NW, pos, nor } = LB, f = LB.flip;
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    const a = lbId(Math.max(i - 1, 0), j) * 3, b = lbId(Math.min(i + 1, NC - 1), j) * 3, c = lbId(i, Math.max(j - 1, 0)) * 3, d = lbId(i, Math.min(j + 1, NW - 1)) * 3, k = lbId(i, j) * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[d] - pos[c], vy = pos[d + 1] - pos[c + 1], vz = pos[d + 2] - pos[c + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = -f / (Math.hypot(nx, ny, nz) || 1);
    nor[k] = nx * l; nor[k + 1] = ny * l; nor[k + 2] = nz * l;
  }
}
function lbPaint() { // coagulated peritoneum: tan and dry, scorched where it was held longest
  const { NS, seal, col, dry } = LB;
  for (let i = 0; i < NS; i++) {
    const s = Math.min(1, seal[i]), ch = clamp(seal[i] - 1.6, 0, 1), k = i * 3;
    col[k] = lerp(lerp(1, COL.seal[0] * 1.25, s), COL.char[0], ch); col[k + 1] = lerp(lerp(1, COL.seal[1] * 1.2, s), COL.char[1], ch); col[k + 2] = lerp(lerp(1, COL.seal[2] * 1.2, s), COL.char[2], ch); dry[i] = s;
  }
  LB.geo.attributes.color.needsUpdate = true; LB.geo.attributes.dry.needsUpdate = true;
}

// ---- under the peritoneum: the wall, its vessels and nerves ----
const LV = {}; // each: where it runs (arr), how thick (r), what it is called, and how it is drawn
(function () {
  const bedMat = wet({ map: TEX.uterus, tri: { k: 0.2, n: 0.3, m: 1 }, relief: NRM.fiber, bs: 0.9, roughness: 0.62 });
  LB.bed = new THREE.Mesh(paramSurface(40, 46, (u, v, p, c) => { // the muscle the peritoneum is lifted off: psoas above the vessels, the obturator fascia below
    const z = lerp(-4.9, BRIM - 0.15, v), lo = z > 1.2 ? lerp(-41, -49, sstep(1.2, 7, z)) + 2.5 : -39, th = lerp(lo, thTop(z) - 1.5, u) * DEG, ps = sstep(thA(z) + 1, thA(z) + 7, th / DEG);
    bowlPoint(Math.cos(th), Math.sin(th), z, 0.03, p);
    const n = 0.9 + 0.2 * fbm3(z * 0.9, th * 6, 3, 2);
    c[0] = lerp(1.0, 0.72, ps) * n; c[1] = lerp(0.86, 0.5, ps) * n; c[2] = lerp(0.8, 0.5, ps) * n;
  }, { su: 3, sv: 5, flip: true }), bedMat);
  scene.add(LB.bed);
  const mk = (key, name, ent, ctrl, r, col, n, pulseK) => {
    const arr = spline(ctrl, vecArr(n || 33)), t = new Tube(arr.length, 10, MAT.cord, 1, 4);
    t.set(arr, 0, 1, () => r, (u, c) => { c[0] = col[0]; c[1] = col[1]; c[2] = col[2]; });
    reg(t.mesh, ent, 'R', { piece: key }); scene.add(t.mesh);
    LV[key] = { key, name, arr, r, col, tube: t, pulseK: pulseK || 0, heat: 0 };
  };
  const W = (th, z, inset) => wallPt(th, z, inset, 1);
  mk('iia', 'Internal iliac artery', 'iliac', [W(thA(10.3), 10.3, 0), W(-24, 8, 0), W(-29, 5, 0), W(-31, 2, 0.02), W(-28, -0.6, 0.1), SIDEK[1].uaO], 0.34, COL.iliacA, 33, 0.04);
  mk('iiv', 'Internal iliac vein', 'iliac', [W(-30, 10.3, -0.1), W(-35, 7, -0.1), W(-38, 4, -0.08), W(-38.5, 1.5, -0.05), W(-37, -1, 0)], 0.46, COL.iliacV, 25);
  mk('oua', 'Obliterated umbilical artery', 'vessel', [SIDEK[1].uaO, W(-10, -4.2, 0.2), W(4, -5.4, 0.2), W(16, -6.4, 0.15)], 0.19, C(206, 150, 138), 17, 0.02);
  mk('obn', 'Obturator nerve', 'nerve', [W(-27, 7.5, -0.05), W(-20, 5, 0.02), W(-9, 2.5, 0.06), W(3, -0.5, 0.1), W(14, -3.8, 0.1)], 0.11, C(246, 236, 196), 25);
  mk('gfn', 'Genitofemoral nerve', 'nerve', [W(thA(9.5) + 7, 9.5, 0.04), W(thA(6) + 7, 6, 0.04), W(thA(2.5) + 7, 2.5, 0.04), W(thA(-1) + 7, -1, 0.04)], 0.06, C(244, 232, 196), 21);
  LV.eia = { key: 'eia', name: 'External iliac artery', arr: AN.iliacR.aA, r: 0.47, heat: 0 };
  LV.eiv = { key: 'eiv', name: 'External iliac vein', arr: AN.iliacR.aV, r: 0.55, heat: 0 };
  LV.ua = { key: 'ua', name: 'Uterine artery', arr: LG.ua.slice(15), r: 0.17, heat: 0 }; // from where it crosses the ureter out to where it leaves the internal iliac
})();

// ---- the ureter: a soft tube on the inner face of the medial leaf, then across the floor and under the uterine artery ----
const LU = { r: 0.2 };
(function () {
  const { NC, NR, NP, NU } = LB, jU = NR + Math.round(LB.URW * NP), path = [];
  for (let i = NC - 1; i >= 0; i--) { if (lbU(i, jU) < 0.55) break; const a = lbId(i, jU); PX.rest(a, _l1).addScaledVector(lbNin(a, _l2), i > NU ? 0.5 * Math.sin(Math.PI * (NC - 1 - i) / (NC - 1 - NU) / 2) + 0.1 : 0.36); path.push(_l1.clone()); }
  LU.leaf = path.length;
  for (const p of [V(4.55, -4.0, -1.9), V(4.05, -3.5, -3.2), V(3.5, -3.0, -4.3), V(3.05, -2.7, -5.4), V(2.59, -1.96, -6.72), V(1.9, -1, -8)]) path.push(p);
  const fine = spline(path, vecArr(400)); let L = 0; const cum = [0];
  for (let i = 1; i < 400; i++) { L += fine[i].distanceTo(fine[i - 1]); cum.push(L); }
  LU.n = Math.round(L / 0.34); LU.ds = L / (LU.n - 1); LU.i0 = PX.n; LU.pts = vecArr(LU.n);
  // the crossing: the place on it nearest the uterine artery
  let k = 0, best = 99, kx = 0;
  for (let q = 0; q < LU.n; q++) {
    const d = q * LU.ds; while (k < 398 && cum[k + 1] < d) k++;
    _l1.lerpVectors(fine[k], fine[k + 1], clamp((d - cum[k]) / (cum[k + 1] - cum[k] || 1), 0, 1));
    const du = nearestOnArr(LV.ua.arr, _l1).d; if (du < best) { best = du; kx = q; }
    PX.add(_l1.x, _l1.y, _l1.z, 1, 0);
  }
  LU.kx = kx; LU.onLeaf = new Uint8Array(LU.n);
  for (let q = 0; q < LU.n; q++) {
    const a = LU.i0 + q;
    if (q === 0 || q > kx + 1) PX.w[a] = 0; // fixed where it comes over the brim, and beyond the artery where it runs on to the bladder
    if (q > 0) PX.link(a - 1, a, 0.05); if (q > 1) PX.link(a - 2, a, 1.5);
  }
  LU.att = []; // what holds it to the leaf (its own blood supply comes to it this way)
  for (let q = 1; q <= kx; q++) {
    const a = LU.i0 + q; PX.rest(a, _l1); let b1 = -1, d1 = 9, b2 = -1, d2 = 9;
    for (let i = 0; i < LB.NS; i++) { const d = PX.rest(i, _l2).distanceTo(_l1); if (d < d1) { b2 = b1; d2 = d1; b1 = i; d1 = d; } else if (d < d2) { b2 = i; d2 = d; } }
    if (d1 < 0.75) { LU.onLeaf[q] = 1; LU.att.push({ q, c: PX.link(a, b1, 0.4, false, 0, 1.3) }, { q, c: PX.link(a, b2, 0.4, false, 0, 1.3) }); } else PX.tk[a] = 45; // on the floor it lies in the base of the broad ligament
  }
  LU.tube = new Tube(LU.n, 10, MAT.cord, 1, 7); reg(LU.tube.mesh, 'ureter', 'R'); scene.add(LU.tube.mesh);
  LU.strip = new Float32Array(LU.n); LU.heat = new Float32Array(LU.n); LU.state = new Uint8Array(LU.n); // state: 1 burned, 2 crushed, 4 cut
})();

// ---- fat and areolar tissue between the peritoneum and the wall ----
const LF = { i0: 0, n: 0, r: null, kind: null, free: null, link: null }; // fat: lobules. kind 1 rides the peritoneum, 0 lies deep
const LS = { n: 0, c: null, vasc: null, sealed: null, kind: null }; // strands of areolar tissue: constraints that part
(function () {
  const rnd = prng(977), { NC, NW, NR, NU } = LB, lob = [], str = [];
  const gap = new Float32Array(LB.NS); for (let i = 0; i < LB.NS; i++) gap[i] = PX.w[i] ? lbGap(i) : 0;
  const rest = []; for (let i = 0; i < LB.NS; i++) rest.push(PX.rest(i, new V3()));
  const J = () => (rnd() - 0.5), addLob = (p, r, kind, host) => { if (lob.length >= 620) return; for (let i = 0; i < LB.NS; i++) if (Math.abs(rest[i].x - p.x) < 0.8 && rest[i].distanceTo(p) < r * 1.45 + 0.1) return; lob.push({ p: p.clone(), r, kind, host }); }; // none so near the peritoneum that it would show through it
  // a layer under the peritoneum, thinner in the triangle and none where the ureter crosses the brim
  for (let j = 1; j < NW - 1; j++) for (let i = 2; i < NC - 1; i++) {
    const a = lbId(i, j), g = gap[a]; if (g < 0.75 || lbU(i, j) < 0.3 || j < 4 || i < 5) continue; // none along the round ligament or beside the uterus, where there is nothing in this model to hold it in
    const roof = j <= NR, ureterBrim = !roof && i > NU - 2, every = roof ? 3 : 2;
    if ((i + 2 * j) % every === 0 && !ureterBrim && rnd() < 0.8) { PX.rest(a, _l1).addScaledVector(lbNin(a, _l2), 0.52 + 0.12 * rnd()); _l1.x += J() * 0.15; _l1.z += J() * 0.15; addLob(_l1, 0.2 + 0.08 * rnd(), 1, a); }
    if (g > 1.3 && (i * 3 + j) % 5 === 0) { PX.rest(a, _l1).addScaledVector(lbNin(a, _l2), g * (0.5 + 0.4 * rnd())); _l1.x += J() * 0.3; _l1.y += J() * 0.3; _l1.z += J() * 0.3; addLob(_l1, 0.28 + 0.14 * rnd(), 0, -1); }
    // strands from the peritoneum to the wall: long and few in the triangle, shorter and more of them lower down
    if (i % 2 === 0 && j % 2 === 0 && g > 0.45) str.push({ a, to: PX.rest(a, new V3()).addScaledVector(lbNin(a, _l2), g + 0.08), slack: roof ? 0.6 : 0.35, brk: roof ? 3.0 : 2.0, kind: 0 });
  }
  // round each vessel and nerve, on the side away from the wall
  for (const key of ['iia', 'iiv', 'oua', 'obn', 'eia', 'eiv', 'ua']) {
    const v = LV[key], n = v.arr.length;
    for (let q = 1; q < n - 1; q += key === 'ua' ? 1 : 2) {
      const p = v.arr[q]; if (p.z > BRIM - 1 || p.z < -4.6) continue;
      for (let e = 0; e < (key === 'ua' ? 2 : 1); e++) { _l2.set(-p.x, BOWL_YC - p.y, 0).normalize(); _l1.copy(p).addScaledVector(_l2, v.r + 0.22 + 0.2 * rnd()); _l1.x += J() * 0.25; _l1.y += J() * 0.3 + (key === 'ua' ? 0.25 : 0); _l1.z += J() * 0.4; addLob(_l1, 0.26 + 0.12 * rnd(), 0, -1); }
    }
  }
  // round the ureter below the brim, on its side away from the leaf, and strands from it to the wall: the pararectal space
  LU.pr = new Int32Array(LU.n).fill(-1);
  for (let q = 2; q < LU.kx; q++) {
    const a = LU.i0 + q; PX.rest(a, _l1); if (_l1.z > 8.3) continue;
    PX.rest(a + 1, _l3).sub(PX.rest(a - 1, _l4)).normalize(); _l2.set(_l1.x, _l1.y - BOWL_YC, 0).normalize(); _l2.addScaledVector(_l3, -_l2.dot(_l3)).normalize(); // out toward the wall, square to the ureter
    if (q % 2 === 0) { _l4.copy(_l1).addScaledVector(_l2, 0.42 + 0.15 * rnd()); _l4.y += 0.15 + J() * 0.3; _l4.z += J() * 0.2; addLob(_l4, 0.25 + 0.1 * rnd(), 0, -1); }
    if (q % 3 === 0) { _l4.copy(_l1).addScaledVector(_l2, 0.95 + 0.2 * rnd()); _l4.y += J() * 0.5; addLob(_l4, 0.3 + 0.12 * rnd(), 0, -1); }
    if (LU.onLeaf[q]) { let t = 0.3; for (; t < 2.2; t += 0.15) if (!inBowl(_l1.x + _l2.x * t, _l1.y + _l2.y * t, _l1.z + _l2.z * t)) break; str.push({ a, to: _l1.clone().addScaledVector(_l2, t), slack: 0.3, brk: 1.5, kind: 1, q }); }
  }
  LF.i0 = PX.n; LF.n = lob.length; LF.home = new Int32Array(LF.n); LF.host = new Int32Array(LF.n).fill(-1); LF.r = new Float32Array(LF.n); LF.kind = new Uint8Array(LF.n); LF.free = new Uint8Array(LF.n); LF.link = new Int32Array(LF.n).fill(-1); LF.sq = new Float32Array(LF.n * 3);
  lob.forEach((l, q) => {
    const a = PX.add(l.p.x, l.p.y, l.p.z, 1.6, l.kind ? 0 : 30); LF.r[q] = l.r; LF.kind[q] = l.kind;
    let hb = 0, hd = 1e9; for (let i = 0; i < LB.NS; i++) { const d = rest[i].distanceToSquared(l.p); if (d < hd) { hd = d; hb = i; } } LF.home[q] = hb; // the place on the peritoneum it lies under
    if (l.kind) { LF.host[q] = l.host; LF.link[q] = PX.link(a, l.host, 0.6, false, 0, 0.9); PX.link(a, l.host + 1, 0.6, false, 0, 0.9); PX.link(a, l.host + LB.NC, 0.6, false, 0, 0.9); } // three threads to the sheet, so that it rides it and does not swing from it
    LF.sq.set([0.85 + 0.4 * rnd(), 0.7 + 0.3 * rnd(), 0.85 + 0.4 * rnd()], q * 3);
  });
  LS.n = str.length; LS.c = new Int32Array(LS.n); LS.vasc = new Uint8Array(LS.n); LS.sealed = new Uint8Array(LS.n); LS.kind = new Uint8Array(LS.n);
  str.forEach((s, q) => {
    const b = PX.add(s.to.x, s.to.y, s.to.z, 0, 0);
    LS.c[q] = PX.link(s.a, b, 2.5, true, s.slack, s.brk); LS.kind[q] = s.kind; LS.vasc[q] = s.kind === 0 && rnd() < 0.07 ? 1 : 0; // a few carry a small vessel
    if (s.kind === 1) LU.pr[s.q] = q;
  });
  // drawn: lobules as one instanced mesh, strands as fine lines
  const sg = new THREE.IcosahedronGeometry(1, 2), sp0 = sg.attributes.position; // a lobule: a lumpy ball
  for (let i = 0; i < sp0.count; i++) { const k = 1 + 0.32 * (fbm3(sp0.getX(i) * 1.7 + 3, sp0.getY(i) * 1.7, sp0.getZ(i) * 1.7 + 7, 2) - 0.5) + 0.1 * Math.sin(sp0.getX(i) * 5) * Math.sin(sp0.getY(i) * 5 + 1); sp0.setXYZ(i, sp0.getX(i) * k, sp0.getY(i) * k, sp0.getZ(i) * k); }
  sg.computeVertexNormals(); const cnt = sp0.count;
  sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cnt * 3).fill(1), 3)); sg.setAttribute('dry', new THREE.BufferAttribute(new Float32Array(cnt), 1));
  LF.mesh = new THREE.InstancedMesh(sg, MAT.fat, LF.n); LF.mesh.frustumCulled = false; LF.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(LF.mesh);
  const lg = new THREE.BufferGeometry(); LS.pos = new Float32Array(LS.n * 6); LS.col = new Float32Array(LS.n * 6);
  lg.setAttribute('position', new THREE.BufferAttribute(LS.pos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(LS.col, 3)); lg.boundingSphere = BIG_SPHERE();
  LS.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 })); LS.lines.frustumCulled = false; scene.add(LS.lines);
})();
// the infundibulopelvic ligament with the ovarian vessels in it: it goes with the sheet it is part of
LB.ipArr = vecArr(LB.NC - Math.ceil(((LB.IPU - 0.1) / 0.9) * LB.NU)); LB.ipI0 = LB.NC - LB.ipArr.length;
LB.ipTube = new Tube(LB.ipArr.length, 10, MAT.cord, 1, 5); reg(LB.ipTube.mesh, 'ip', 'R'); scene.add(LB.ipTube.mesh);
// blood that wells up where a vessel bleeds and stays until it is aspirated
LB.wells = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), MAT.blood); m.visible = false; scene.add(m); LB.wells.push({ m, v: 0, p: new V3() }); }

const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lsc = new V3(), _lc = new THREE.Color();
function lbDraw(time) {
  LB.geo.attributes.position.needsUpdate = true; lbNormals(); LB.geo.attributes.normal.needsUpdate = true; LB.pick.castShadow = false;
  // ureter: peristalsis, and what has been done to it
  for (let q = 0; q < LU.n; q++) PX.get(LU.i0 + q, LU.pts[q]);
  const ph = ((time + 0.4) % 5.2) / 1.7, cu = S && S.lab ? S.lab.cutU : -1;
  LU.tube.set(LU.pts, 0, 1, u => { const q = Math.round(u * (LU.n - 1)); return (cu >= 0 && Math.abs(q - cu) < 1 ? 0.02 : LU.r) * (1 + 0.38 * Math.exp(-Math.pow((u - ph + 0.1) / 0.06, 2)) - 0.18 * Math.exp(-Math.pow((u - ph + 0.22) / 0.05, 2))); },
    (u, c) => {
      const q = Math.round(u * (LU.n - 1)), st = LU.state[q], sp = Math.min(1, LU.strip[q]), b = st & 1 ? 1 : 0;
      c[0] = lerp(lerp(COL.ureter[0], 0.86, sp), 1, b); c[1] = lerp(lerp(COL.ureter[1], 0.84, sp), 0.95, b); c[2] = lerp(lerp(COL.ureter[2], 0.86, sp), 0.86, b); c[3] = Math.max(sp * 0.8, b);
      if (st & 2) { c[0] *= 0.62; c[1] *= 0.4; c[2] *= 0.5; }
    });
  // infundibulopelvic ligament along its row of the sheet
  for (let q = 0; q < LB.ipArr.length; q++) PX.get(lbId(LB.ipI0 + q, LB.NR), LB.ipArr[q]).addScaledVector(lbNin(lbId(LB.ipI0 + q, LB.NR), _l1), 0.08);
  LB.ipTube.set(LB.ipArr, 0, 1, u => lerp(0.27, 0.15, sstep(0.45, 1, u)), (u, c) => { const s = Math.min(1, LB.seal[lbId(LB.ipI0 + Math.round(u * (LB.ipArr.length - 1)), LB.NR)]); c[0] = lerp(COL.ip[0], COL.seal[0], s); c[1] = lerp(COL.ip[1], COL.seal[1], s); c[2] = lerp(COL.ip[2], COL.seal[2], s); c[3] = s; });
  // arteries pulse
  const pl = pulse(time);
  for (const k of ['iia', 'oua']) { const v = LV[k]; v.tube.set(v.arr, 0, 1, () => v.r * (1 + v.pulseK * pl), (u, c) => { const h = Math.min(1, v.heat * 2); c[0] = lerp(v.col[0], COL.seal[0], h); c[1] = lerp(v.col[1], COL.seal[1], h); c[2] = lerp(v.col[2], COL.seal[2], h); c[3] = h; }); }
  // fat
  const x = PX.x, wl = LB.wells;
  for (let q = 0; q < LF.n; q++) {
    const k = (LF.i0 + q) * 3, r = LF.r[q];
    _l1.set(x[k], x[k + 1], x[k + 2]); _lsc.set(r * 1.3 * LF.sq[q * 3], r * 1.3 * LF.sq[q * 3 + 1], r * 1.3 * LF.sq[q * 3 + 2]); _lq.set(Math.sin(q * 1.7), Math.sin(q * 2.3), Math.sin(q * 3.1), 1).normalize(); // drawn a little larger than it is, so that neighbours merge into a pad of fat
    LF.mesh.setMatrixAt(q, _lm.compose(_l1, _lq, _lsc));
    let red = 0; for (const w of wl) if (w.v > 0.05) red = Math.max(red, 1 - sstep(0.6, 1.25, _l1.distanceTo(w.p) / w.m.scale.x));
    LF.mesh.setColorAt(q, _lc.setRGB(lerp(1, 0.5, red), lerp(1, 0.08, red), lerp(1, 0.08, red)));
  }
  LF.mesh.instanceMatrix.needsUpdate = true; if (LF.mesh.instanceColor) LF.mesh.instanceColor.needsUpdate = true;
  // strands, lit by the scope as everything else is
  const sp = LS.pos, sc = LS.col;
  for (let q = 0; q < LS.n; q++) {
    const c = LS.c[q], k = q * 6;
    if (!(PX.cf[c] & 1)) { sp[k] = sp[k + 3] = 0; sp[k + 1] = sp[k + 4] = -99; sp[k + 2] = sp[k + 5] = 0; continue; }
    const a = PX.ci[c] * 3, b = PX.cj[c] * 3;
    sp[k] = x[a]; sp[k + 1] = x[a + 1]; sp[k + 2] = x[a + 2]; sp[k + 3] = x[b]; sp[k + 4] = x[b + 1]; sp[k + 5] = x[b + 2];
    const l = Math.min(1.6, litAt(_l1.set(x[a], x[a + 1], x[a + 2]))) * 0.5, v = LS.vasc[q], sl = LS.sealed[q];
    const r = v ? (sl ? 0.55 : 0.8) : 0.95, g = v ? (sl ? 0.42 : 0.16) : 0.9, bl = v ? (sl ? 0.28 : 0.16) : 0.84;
    sc[k] = sc[k + 3] = r * l; sc[k + 1] = sc[k + 4] = g * l; sc[k + 2] = sc[k + 5] = bl * l;
  }
  LS.lines.geometry.attributes.position.needsUpdate = true; LS.lines.geometry.attributes.color.needsUpdate = true;
  for (const w of wl) { w.m.visible = w.v > 0.05; if (w.m.visible) { const r = 0.62 * Math.cbrt(w.v); w.m.position.copy(w.p); w.m.scale.set(r, r * 0.6, r); } }
}
// everything back as it was before anything was touched
function lbResetModel() {
  PX.r.set(LB.r0); PX.reset(); LB.dead.fill(0); LB.seal.fill(0); LB.heldV.fill(0); lbReindex(); lbPaint();
  for (let c = 0; c < PX.m; c++) PX.cf[c] |= 1;
  for (let i = 0; i < LB.NS; i++) PX.w[i] = LB.pin[i] ? 0 : 1;
  LU.strip.fill(0); LU.heat.fill(0); LU.state.fill(0);
  for (let q = 0; q < LU.n; q++) PX.w[LU.i0 + q] = q === 0 || q > LU.kx + 1 ? 0 : 1;
  for (let q = 0; q < LF.n; q++) { LF.free[q] = 0; PX.w[LF.i0 + q] = 1.6; PX.tk[LF.i0 + q] = LF.kind[q] ? 0 : 30; LF.home[q] = LF.home0[q]; }
  LS.sealed.fill(0);
  for (const k in LV) LV[k].heat = 0;
  for (const w of LB.wells) w.v = 0;
  lbNormals(); // which way the sheet faces is used before it is next drawn
}
LF.home0 = LF.home.slice(); LB.r0 = PX.r.slice(0, PX.n * 3); lbReindex(); lbPaint(); // r0: where everything rests before anything has been pushed aside
