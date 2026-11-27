// ---------- lab: the right pelvic sidewall as tissue that moves ----------
// The lab keeps its own settings: nothing it stores is read by the simulator on the same site.
(function () {
  const P = Storage.prototype, g = P.getItem, s = P.setItem, m = k => String(k).replace(/^tlh\./, 'lab.');
  P.getItem = function (k) { return g.call(this, m(k)); }; P.setItem = function (k, v) { return s.call(this, m(k), v); };
})();

// The uterus is held to the patient's left, and stays there: the sheet below is laid out on the round ligament and
// the ovary as they lie in that position.
const LB = { POSE: { yaw: -0.5, pitch: 0.17, push: 0 }, NU: 34, NX: 10, NR: 22, NP: 14, IPU: 0.62, URW: 0.56, TK: 40, EDGE: 6 };
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
// The peritoneum is taut. Every place on it is tethered where it lies (TK), as the areolar tissue under it holds it to
// the wall: lifted in a pair of jaws it tents over a couple of centimetres and no further, and let go it lies back flat.
(function () { // the sheet: particles, the constraints that hold it together, and what holds its edges
  const { NC, NW, NR, NU } = LB; LB.pin = new Uint8Array(LB.NS);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    lbRest(i, j, _l3);
    const pin = i === 0 || i === NC - 1 || j === 0 || j === NW - 1 || (j === NR && lbU(i, j) < LB.IPU); // the ovary and its ligament do not move
    PX.add(_l3.x, _l3.y, _l3.z, pin ? 0 : 1, LB.TK); LB.pin[lbId(i, j)] = pin ? 1 : 0;
  }
  LB.eh = new Int32Array(NC * NW).fill(-1); LB.ev = new Int32Array(NC * NW).fill(-1); LB.qd = new Int32Array(LB.NQ * 2);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    if (i < NC - 1) LB.eh[lbId(i, j)] = PX.link(lbId(i, j), lbId(i + 1, j), 0.02);
    if (j < NW - 1) LB.ev[lbId(i, j)] = PX.link(lbId(i, j), lbId(i, j + 1), 0.02);
    if (i < NC - 1 && j < NW - 1) { const q = j * (NC - 1) + i; LB.qd[q * 2] = PX.link(lbId(i, j), lbId(i + 1, j + 1), 0.2); LB.qd[q * 2 + 1] = PX.link(lbId(i + 1, j), lbId(i, j + 1), 0.2); }
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
LB.alive = new Uint8Array(LB.NS);  // places that still have peritoneum at them
(function () {
  const { NC, NW, NS, NQ } = LB, g = new THREE.BufferGeometry(), uv = new Float32Array(NS * 2);
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) { uv[lbId(i, j) * 2] = (i / (NC - 1)) * 2.3; uv[lbId(i, j) * 2 + 1] = (j / (NW - 1)) * 1.9; }
  LB.pos = PX.x.subarray(0, NS * 3); LB.nor = new Float32Array(NS * 3); LB.col = new Float32Array(NS * 3).fill(1); LB.dry = new Float32Array(NS);
  g.setAttribute('position', new THREE.BufferAttribute(LB.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(LB.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(LB.col, 3)); g.setAttribute('dry', new THREE.BufferAttribute(LB.dry, 1)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  LB.idx = new Uint16Array(NQ * 6);
  g.setIndex(new THREE.BufferAttribute(LB.idx, 1)); g.boundingSphere = BIG_SPHERE();
  // peritoneum: the simulator's broad-ligament leaf with no fat under it, and less of what lies under it showing through
  const tex = tissueTex({ seed: 14, base: [238, 190, 180], dark: [214, 150, 144], vessels: 26, vw: 1.2, vcol: [140, 24, 36], va: 0.55, caps: 36, trans: 0.85 });
  LB.mat = wet({ map: tex, side: THREE.DoubleSide, mr: [4, 4], bs: 0.45, roughness: 0.5, transmission: 0.34, transmissionMap: tex.userData.trans, thickness: 0, ior: 1.4 }); TRANSLUCENT.push([LB.mat, 0.34]);
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
  // the edge of an opening is free of what held it to the wall and can be drawn aside, and what is lifted in a pair of jaws comes off the wall round them
  _lv1.fill(0); for (let k = 0; k < NT; k++) if (dead[k] || near[k]) { const c = lbTri(k); _lv1[c[0]] = _lv1[c[1]] = _lv1[c[2]] = 1; }
  for (let i = 0; i < LB.NS; i++) PX.tk[i] = _lv1[i] || LB.heldV[i] ? LB.TK * LB.EDGE : LB.TK;
  for (let k = 0; k < NT; k++) if (!dead[k]) { idx.set(LB.fullIdx.subarray(k * 3, k * 3 + 3), n * 3); n++; const c = lbTri(k); if (!near[k] && !LB.heldV[c[0]] && !LB.heldV[c[1]] && !LB.heldV[c[2]]) { pidx.set(LB.fullIdx.subarray(k * 3, k * 3 + 3), m * 3); m++; } }
  LB.geo.setDrawRange(0, n * 3); LB.geo.index.needsUpdate = true; LB.pick.geometry.setDrawRange(0, m * 3); LB.pick.geometry.index.needsUpdate = true;
  const G = (i, j, k) => i < 0 || j < 0 || i >= NC - 1 || j >= NW - 1 || dead[(j * (NC - 1) + i) * 2 + k]; // triangle k of square (i, j) is gone, or was never there
  for (let j = 0; j < NW; j++) for (let i = 0; i < NC; i++) {
    const h = LB.eh[lbId(i, j)], v = LB.ev[lbId(i, j)];
    if (h >= 0) PX.cf[h] = G(i, j, 0) && G(i, j - 1, 1) ? 0 : 1;
    if (v >= 0) PX.cf[v] = G(i, j, 0) && G(i - 1, j, 1) ? 0 : 1;
  }
  for (let q = 0; q < LB.NQ; q++) { PX.cf[LB.qd[q * 2]] = dead[q * 2] || dead[q * 2 + 1] ? 0 : 1; PX.cf[LB.qd[q * 2 + 1]] = dead[q * 2] && dead[q * 2 + 1] ? 0 : 1; }
  for (let i = 0; i < LB.NS; i++) LB.alive[i] = lbAlive(i) ? 1 : 0;
  lbWebTrim();
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

// ---- areolar tissue between the peritoneum and the wall: a fine web ----
// Loose areolar tissue and nothing else fills the space: a web of fine threads from the peritoneum to the wall, and
// over every vessel, every nerve and the ureter. Its nodes are light particles, each tethered where it lies. Its
// threads are constraints that resist stretch only; they part when stretched far enough, and when an instrument meets
// them (lbSweep). A few are small vessels. Between the threads finer fibrils are drawn: a fibril goes when either of
// the two threads it hangs from goes. A node that peritoneum has been drawn across, or that lies under peritoneum
// held in a pair of jaws, is not drawn while that is so: it is inside the fold.
const LS = { n: 0 }; // threads. c: the constraint. vasc: a small vessel. sealed: coagulated. mid: where it lies at rest
const LW = { i0: 0, n: 0 }; // nodes, and the fixed points on the wall and on the vessels that threads end on
const _lq1 = new V3();
const lbOnArr = (arr, p, out) => sampleArr(arr, nearestUOnArr(arr, p), out).distanceTo(p); // the point of a curve nearest to p, and how far off it is
(function () {
  const rnd = prng(977), { NC, NW } = LB, J = k => (rnd() - 0.5) * k, thr = [], tied = new Set(), t1 = new V3(), t2 = new V3();
  const gap = new Float32Array(LB.NS); for (let i = 0; i < LB.NS; i++) gap[i] = PX.w[i] ? lbGap(i) : 0;
  const rest = []; for (let i = 0; i < LB.NS; i++) rest.push(PX.rest(i, new V3()));
  const urest = []; for (let q = 0; q < LU.n; q++) urest.push(PX.rest(LU.i0 + q, new V3()));
  const solid = Object.keys(LV).map(k => LV[k]).concat([{ arr: urest, r: LU.r }]);
  // no node lies inside a vessel, and none so near the peritoneum that it would show on its outer face
  const clear = p => { for (const v of solid) { const d = lbOnArr(v.arr, p, _lq1); if (d < v.r + 0.07) p.sub(_lq1).setLength(v.r + 0.07 + 0.05 * rnd()).add(_lq1); } return p; };
  const under = p => { let b = -1, bd = 1; for (let i = 0; i < LB.NS; i++) if (Math.abs(rest[i].x - p.x) < 1) { const d = rest[i].distanceTo(p); if (d < bd) { bd = d; b = i; } } return b < 0 || t1.copy(p).sub(rest[b]).dot(lbNin(b, t2)) > 0.1; };
  const tie = (a, b, ride) => { if (a === b || a < 0 || b < 0) return; const k = Math.min(a, b) * 8192 + Math.max(a, b); if (tied.has(k) || PX.dist(a, b) > 1.1) return; tied.add(k); thr.push({ a, b, v: 0, ride }); };
  LW.i0 = PX.n;
  // under the peritoneum: a node a few millimetres in from every other place on it, which goes where that place goes;
  // a second deeper where there is room; and a thread on to the wall. None along the round ligament or beside the uterus, where this model has nothing under the sheet
  const top = new Int32Array(LB.NS).fill(-1), low = new Int32Array(LB.NS).fill(-1), host = new Map();
  for (let j = 3; j < NW - 1; j++) for (let i = 5; i < NC - 1; i++) {
    const a = lbId(i, j), g = gap[a]; if ((i + j) % 2 || !PX.w[a] || g < 0.3 || lbU(i, j) < 0.3) continue;
    lbNin(a, _l2);
    const put = d => { _l3.copy(rest[a]).addScaledVector(_l2, d); _l3.x += J(0.18); _l3.y += J(0.18); _l3.z += J(0.18); return under(clear(_l3)) ? PX.add(_l3.x, _l3.y, _l3.z, 3, 60) : -1; }; // where the roof and the medial leaf come together, a place under the one may be outside the other
    let dl = Math.min(0.28 + 0.2 * rnd(), g * 0.55), last = top[a] = put(dl); if (last < 0) continue; host.set(last, a); tie(a, last, true);
    if (g > 1) { const d2 = Math.min(g - 0.3, 0.8 + 0.3 * rnd()), n = put(d2); if (n >= 0) { dl = d2; last = low[a] = n; tie(top[a], n); } }
    if (g < 2.2 && g - dl < 0.9 && under(_l3.copy(rest[a]).addScaledVector(_l2, g + 0.06))) tie(last, PX.add(_l3.x, _l3.y, _l3.z, 0, 0)); else PX.tk[last] = 25;
  }
  for (let j = 3; j < NW - 1; j++) for (let i = 5; i < NC - 1; i++) { // from each node to those beside it, and aslant to the peritoneum beside its own place
    const a = lbId(i, j); if (top[a] < 0) continue;
    for (const [di, dj, p] of [[1, 1, 0.85], [1, -1, 0.85], [2, 0, 0.3], [0, 2, 0.3]]) {
      if (i + di >= NC || j + dj >= NW) continue; const b = lbId(i + di, j + dj); if (top[b] < 0) continue;
      if (rnd() < p) tie(top[a], top[b]);
      if (low[a] >= 0 && low[b] >= 0 && rnd() < p * 0.8) tie(low[a], low[b]);
      if (low[b] >= 0 && rnd() < 0.3) tie(top[a], low[b]);
    }
    for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const b = lbId(i + di, j + dj); if (rnd() < 0.3 && PX.w[b] && gap[b] >= 0.3) tie(b, top[a]); }
  }
  const col = []; for (let i = 0; i < LB.NS; i++) { if (top[i] >= 0) col.push(top[i]); if (low[i] >= 0) col.push(low[i]); }
  // a net over each vessel and nerve on its side toward the pelvis, and over the ureter on its side away from its
  // leaf: nodes to either side of it all the way along, threads across it from one to the next, and a short thread from each node down onto it
  const net = (arr, r, inward, onto, ok) => {
    const P = [], M = [];
    for (let q = 1; q < arr.length - 1; q++) {
      P.push(-1); M.push(-1); const p = arr[q]; if (!ok(p, q)) continue;
      _l1.copy(arr[q + 1]).sub(arr[q - 1]).normalize(); inward(p, _l2); _l2.addScaledVector(_l1, -_l2.dot(_l1)).normalize(); _l3.crossVectors(_l1, _l2);
      for (const s of [1, -1]) {
        const ph = s * (0.3 + 0.55 * rnd()), R = r * 1.25 + 0.1 + 0.16 * rnd(), cs = Math.cos(ph), sn = Math.sin(ph);
        _l4.copy(p); if (s < 0) _l4.lerp(arr[q + 1], 0.5);
        _l5.copy(_l4).addScaledVector(_l2, R * cs).addScaledVector(_l3, R * sn); if (!inBowl(_l5.x, _l5.y, _l5.z) || !under(_l5)) continue;
        const n = PX.add(_l5.x, _l5.y, _l5.z, 3, 40);
        if (onto) tie(n, onto(q)); else { _l4.addScaledVector(_l2, r * 0.9 * cs).addScaledVector(_l3, r * 0.9 * sn); tie(n, PX.add(_l4.x, _l4.y, _l4.z, 0, 0)); }
        (s > 0 ? P : M)[P.length - 1] = n;
      }
    }
    for (let k = 0; k < P.length; k++) { tie(P[k], M[k]); if (k + 1 < P.length) { tie(M[k], P[k + 1]); if (rnd() < 0.5) tie(P[k], P[k + 1]); if (rnd() < 0.5) tie(M[k], M[k + 1]); } }
    for (const n of P.concat(M)) if (n >= 0) { // and into the web round it
      let b1 = -1, d1 = 0.85, b2 = -1, d2 = 0.85; for (const c of col) { const d = PX.dist(n, c); if (d < d1) { b2 = b1; d2 = d1; b1 = c; d1 = d; } else if (d < d2) { b2 = c; d2 = d; } }
      if (rnd() < 0.85) tie(n, b1); if (rnd() < 0.6) tie(n, b2);
    }
  };
  for (const k of ['eia', 'eiv', 'iia', 'iiv', 'oua', 'obn', 'gfn', 'ua']) net(LV[k].arr, LV[k].r, (p, o) => o.set(-p.x, BOWL_YC - p.y, 0), null, p => p.z < BRIM - 0.8 && p.z > -4.7);
  net(urest, LU.r, (p, o) => o.set(p.x, p.y - BOWL_YC, 0), q => LU.i0 + q, (p, q) => q <= LU.kx);
  LW.n = PX.n - LW.i0;
  // the place on the peritoneum that each node lies under: the one it rides, or the nearest
  LW.home = new Int32Array(LW.n).fill(-1); LW.out = new Uint8Array(LW.n);
  for (let e = 0; e < LW.n; e++) { const i = LW.i0 + e; if (host.has(i)) { LW.home[e] = host.get(i); continue; } PX.rest(i, t1); let bd = 1.2; for (let s = 0; s < LB.NS; s++) if (Math.abs(rest[s].x - t1.x) < 1.2) { const d = rest[s].distanceTo(t1); if (d < bd) { bd = d; LW.home[e] = s; } } }
  // a few threads, none of them tied to the peritoneum itself, are small vessels
  const el = thr.filter(t => t.a >= LW.i0 && t.b >= LW.i0 && PX.dist(t.a, t.b) > 0.3), stepV = Math.max(1, Math.floor(el.length / 16));
  for (let k = Math.floor(stepV * rnd()); k < el.length; k += stepV) el[k].v = 1;
  LS.n = thr.length; LS.c = new Int32Array(LS.n); LS.vasc = new Uint8Array(LS.n); LS.sealed = new Uint8Array(LS.n); LS.mid = new Float32Array(LS.n * 3); LS.tone = new Float32Array(LS.n); LS.bow = new Float32Array(LS.n * 3); LS.hid = new Uint8Array(LS.n); LS.vq = [];
  thr.forEach((t, q) => {
    LS.c[q] = t.ride ? PX.link(t.a, t.b, 1, false, 0, 2) : PX.link(t.a, t.b, t.v ? 8 : 30, true, 0.05 + 0.12 * rnd(), t.v ? 2 : 1 + 0.6 * rnd()); LS.vasc[q] = t.v; if (t.v) LS.vq.push(q);
    PX.rest(t.a, _l1).add(PX.rest(t.b, _l2)).multiplyScalar(0.5); LS.mid.set([_l1.x, _l1.y, _l1.z], q * 3); LS.tone[q] = 0.3 + 0.45 * rnd();
    // a thread hangs a little slack: which way it bows, and how much
    _l3.set(J(1), J(1), J(1)); _l2.sub(_l1); _l3.addScaledVector(_l2, -_l3.dot(_l2) / (_l2.lengthSq() || 1)).setLength(0.25 + 0.35 * rnd()); LS.bow.set([_l3.x, _l3.y, _l3.z], q * 3);
  });
  // fibrils: from part way along one thread to part way along another that leaves the same node
  const at = new Map(), fa = [], fb = [], fu = [], fv = [];
  thr.forEach((t, q) => { for (const n of [t.a, t.b]) { if (!at.has(n)) at.set(n, []); at.get(n).push(q); } });
  for (const [n, l] of at) {
    if (l.length < 2) continue;
    for (let k = 0, m = Math.min(l.length === 2 ? 1 : l.length, 4); k < m; k++) { const a = l[k], b = l[(k + 1) % l.length]; if (thr[a].v || thr[b].v || rnd() > 0.85) continue; const f = 0.3 + 0.5 * rnd(), g = 0.3 + 0.5 * rnd(); fa.push(a); fb.push(b); fu.push(thr[a].a === n ? f : 1 - f); fv.push(thr[b].a === n ? g : 1 - g); }
  }
  LS.nf = fa.length; LS.fa = Int32Array.from(fa); LS.fb = Int32Array.from(fb); LS.fu = Float32Array.from(fu); LS.fv = Float32Array.from(fv);
  // drawn: threads and fibrils as fine lines (a thread as three, so that it can bow), the small vessels as fine red tubes
  const lg = new THREE.BufferGeometry(), nv = LS.n * 6 + LS.nf * 2; LS.pos = new Float32Array(nv * 3); LS.col = new Float32Array(nv * 3);
  lg.setAttribute('position', new THREE.BufferAttribute(LS.pos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(LS.col, 3)); lg.boundingSphere = BIG_SPHERE();
  LS.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false })); LS.lines.frustumCulled = false; scene.add(LS.lines);
  LS.ves = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshStandardMaterial({ roughness: 0.4 }), LS.vq.length); LS.ves.frustumCulled = false; LS.ves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(LS.ves);
})();
// a thread tied to peritoneum that has been cut away has nothing to hold it
function lbWebTrim() { for (let q = 0; q < LS.n; q++) { const c = LS.c[q]; if ((PX.cf[c] & 1) && PX.ci[c] < LB.NS && !LB.alive[PX.ci[c]]) PX.cf[c] &= 2; } }

// ---- what moves when no instrument does: the arterial pulse and the ureter's peristalsis ----
// A place on the peritoneum, or a node of the web, that lies against an artery or the ureter is carried by it: the
// place where it rests is moved a fraction of a millimetre, out from the vessel with each beat and out from the ureter
// as a wave passes, and the tissue follows. Nothing else moves tissue that no instrument is touching.
const lbPhase = time => ((time + 0.4) % 5.2) / 1.7; // where the wave is along the ureter: one every 5 s
const lbPeri = (u, ph) => 0.38 * Math.exp(-Math.pow((u - ph + 0.1) / 0.06, 2)) - 0.18 * Math.exp(-Math.pow((u - ph + 0.22) / 0.05, 2)); // how much wider, or narrower, the ureter is at a place along it as the wave passes
(function () {
  const bi = [], bd = [], bu = [], bw = [], p = new V3(), q = new V3(), d = new V3();
  const each = i => {
    PX.rest(i, p); d.set(0, 0, 0);
    for (const [v, amp] of [[LV.eia, 0.05], [LV.iia, 0.045], [LV.ua, 0.03]]) { const e = lbOnArr(v.arr, p, q), w = (1 - sstep(v.r + 0.1, v.r + 0.8, e)) * amp; if (w > 0.001 && e > 1e-3 && w > d.length()) d.subVectors(p, q).setLength(w); } // where two arteries lie together, the one that moves it more
    let uq = -1, ud = 0.85; for (let k = 1; k <= LU.kx + 1; k++) { const e = PX.rest(LU.i0 + k, q).distanceTo(p); if (e < ud) { ud = e; uq = k; } }
    if (uq < 0 && d.lengthSq() < 1e-8) return;
    bi.push(i); bd.push(d.x, d.y, d.z); bu.push(uq); bw.push(uq < 0 ? 0 : 1 - sstep(0.3, 0.85, ud));
  };
  for (let i = 0; i < LB.NS; i++) if (PX.w[i]) each(i);
  for (let i = LW.i0; i < LW.i0 + LW.n; i++) if (PX.w[i]) each(i);
  LB.beat = { n: bi.length, i: Int32Array.from(bi), d: Float32Array.from(bd), u: Int32Array.from(bu), w: Float32Array.from(bw) };
})();
function lbBeat(time) {
  const B = LB.beat, r = PX.r, r0 = LB.r0, x = PX.x, pl = pulse(time), ph = lbPhase(time);
  for (let e = 0; e < B.n; e++) {
    const k = B.i[e] * 3, uq = B.u[e]; let dx = B.d[e * 3] * pl, dy = B.d[e * 3 + 1] * pl, dz = B.d[e * 3 + 2] * pl;
    if (uq >= 0) {
      const f = lbPeri(uq / (LU.n - 1), ph);
      if (f > 0.004 || f < -0.004) { const a = (LU.i0 + uq) * 3, ux = x[k] - x[a], uy = x[k + 1] - x[a + 1], uz = x[k + 2] - x[a + 2], l = Math.hypot(ux, uy, uz), m = l > 1e-3 && l < 1.2 ? B.w[e] * LU.r * f * 1.1 / l : 0; dx += ux * m; dy += uy * m; dz += uz * m; }
    }
    r[k] = r0[k] + dx; r[k + 1] = r0[k + 1] + dy; r[k + 2] = r0[k + 2] + dz;
  }
}
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
  const ph = lbPhase(time), cu = S && S.lab ? S.lab.cutU : -1;
  LU.tube.set(LU.pts, 0, 1, u => { const q = Math.round(u * (LU.n - 1)); return (cu >= 0 && Math.abs(q - cu) < 1 ? 0.02 : LU.r) * (1 + lbPeri(u, ph)); },
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
  // the web, lit by the scope as everything else is, and red where blood stands in it
  const x = PX.x, wl = LB.wells, sp = LS.pos, sc = LS.col, cf = PX.cf, ci = PX.ci, cj = PX.cj, wet = wl.some(w => w.v > 0.05);
  LS.lines.material.opacity = Math.min(0.95, 0.6 * renderer.getPixelRatio()); // a line is one pixel wide however fine the screen
  const cl = PX.cl, bow = LS.bow, hid = LS.hid, n0 = LW.i0, out = LW.out, nor = LB.nor, NS = LB.NS;
  for (let e = 0; e < LW.n; e++) { // is each node still under the peritoneum it lay under?
    const h = LW.home[e]; out[e] = 0; if (h < 0 || !LB.alive[h]) continue;
    const a = (n0 + e) * 3, b = h * 3, dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
    if (LB.heldV[h] || (dx * dx + dy * dy + dz * dz < 1.5 && dx * nor[b] + dy * nor[b + 1] + dz * nor[b + 2] > -0.03)) out[e] = 1;
  }
  for (let q = 0; q < LS.n; q++) {
    const c = LS.c[q], k = q * 18;
    const ia = ci[c], ib = cj[c], a = ia * 3, b = ib * 3;
    hid[q] = !(cf[c] & 1) || LS.vasc[q] || (ia < NS ? LB.heldV[ia] : ia >= n0 && out[ia - n0]) || (ib >= n0 && out[ib - n0]) ? 1 : 0;
    if (hid[q]) { sp.fill(0, k, k + 18); continue; }
    const ax = x[a], ay = x[a + 1], az = x[a + 2], dx = x[b] - ax, dy = x[b + 1] - ay, dz = x[b + 2] - az;
    const h = 0.445 * Math.sqrt(Math.max(0, cl[c] * cl[c] - dx * dx - dy * dy - dz * dz)), hx = bow[q * 3] * h, hy = bow[q * 3 + 1] * h, hz = bow[q * 3 + 2] * h; // pulled out straight, it does not bow
    sp[k] = ax; sp[k + 1] = ay; sp[k + 2] = az; sp[k + 3] = sp[k + 6] = ax + dx / 3 + hx; sp[k + 4] = sp[k + 7] = ay + dy / 3 + hy; sp[k + 5] = sp[k + 8] = az + dz / 3 + hz;
    sp[k + 9] = sp[k + 12] = ax + dx / 1.5 + hx; sp[k + 10] = sp[k + 13] = ay + dy / 1.5 + hy; sp[k + 11] = sp[k + 14] = az + dz / 1.5 + hz; sp[k + 15] = ax + dx; sp[k + 16] = ay + dy; sp[k + 17] = az + dz;
    _l1.set(ax, ay, az); const l = Math.min(1.8, litAt(_l1)) * LS.tone[q]; let red = 0;
    if (wet) for (const w of wl) if (w.v > 0.05) red = Math.max(red, 1 - sstep(0.6, 1.25, _l1.distanceTo(w.p) / w.m.scale.x));
    const r = lerp(0.96, 0.5, red) * l, g = lerp(0.91, 0.08, red) * l, bl = lerp(0.86, 0.08, red) * l;
    for (let e = k; e < k + 18; e += 3) { sc[e] = r; sc[e + 1] = g; sc[e + 2] = bl; }
  }
  for (let m = 0, k = LS.n * 18; m < LS.nf; m++, k += 6) {
    const qa = LS.fa[m], qb = LS.fb[m];
    if (hid[qa] || hid[qb]) { sp.fill(0, k, k + 6); continue; }
    for (let e = 0; e < 2; e++) { // each end of it: a point part way along a thread, on whichever of that thread's three lines it falls
      const u = (e ? LS.fv[m] : LS.fu[m]) * 3, sg = Math.min(2, u | 0), f = u - sg, a = (e ? qb : qa) * 18 + sg * 6, o = k + e * 3;
      sp[o] = sp[a] + (sp[a + 3] - sp[a]) * f; sp[o + 1] = sp[a + 1] + (sp[a + 4] - sp[a + 1]) * f; sp[o + 2] = sp[a + 2] + (sp[a + 5] - sp[a + 2]) * f;
    }
    const a = qa * 18; sc[k] = sc[k + 3] = sc[a] * 0.62; sc[k + 1] = sc[k + 4] = sc[a + 1] * 0.62; sc[k + 2] = sc[k + 5] = sc[a + 2] * 0.62;
  }
  LS.lines.geometry.attributes.position.needsUpdate = true; LS.lines.geometry.attributes.color.needsUpdate = true;
  for (let e = 0; e < LS.vq.length; e++) { // a small vessel: red, and tan once it has been coagulated
    const q = LS.vq[e], c = LS.c[q];
    if (!(cf[c] & 1)) { LS.ves.setMatrixAt(e, _lm.makeScale(0, 0, 0)); continue; }
    PX.get(ci[c], _l1); PX.get(cj[c], _l2); _l3.subVectors(_l2, _l1); const len = _l3.length() || 1e-3;
    _lq.setFromUnitVectors(_l4.set(0, 1, 0), _l3.multiplyScalar(1 / len)); LS.ves.setMatrixAt(e, _lm.compose(_l1.lerp(_l2, 0.5), _lq, _lsc.set(0.035, len, 0.035)));
    LS.ves.setColorAt(e, LS.sealed[q] ? _lc.setRGB(0.62, 0.5, 0.36) : _lc.setRGB(0.62, 0.07, 0.09));
  }
  LS.ves.instanceMatrix.needsUpdate = true; if (LS.ves.instanceColor) LS.ves.instanceColor.needsUpdate = true;
  for (const w of wl) { w.m.visible = w.v > 0.05; if (w.m.visible) { const r = 0.62 * Math.cbrt(w.v); w.m.position.copy(w.p); w.m.scale.set(r, r * 0.6, r); } }
}
// everything back as it was before anything was touched
function lbResetModel() {
  PX.r.set(LB.r0); PX.reset(); LB.dead.fill(0); LB.seal.fill(0); LB.heldV.fill(0); lbReindex(); lbPaint();
  for (let c = 0; c < PX.m; c++) PX.cf[c] |= 1;
  for (let i = 0; i < LB.NS; i++) PX.w[i] = LB.pin[i] ? 0 : 1;
  LU.strip.fill(0); LU.heat.fill(0); LU.state.fill(0);
  for (let q = 0; q < LU.n; q++) PX.w[LU.i0 + q] = q === 0 || q > LU.kx + 1 ? 0 : 1;
  LS.sealed.fill(0);
  for (const k in LV) LV[k].heat = 0;
  for (const w of LB.wells) w.v = 0;
  lbNormals(); // which way the sheet faces is used before it is next drawn
}
LB.r0 = PX.r.slice(0, PX.n * 3); lbReindex(); lbPaint(); // r0: where everything rests between one beat and the next
