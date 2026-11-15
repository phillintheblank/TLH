// ---------- case: laparoscopic myomectomy ----------
// One fibroid in the anterior fundal wall of a larger uterus. The wall round it is described from the fibroid's
// centre, in the fibroid's own frame: T runs along the hysterotomy (toward the patient's right), A out through the
// serosa, W across the incision (toward the bladder). A point of the wall is (s, w, rad): s and w are the angles
// along and across the incision as seen from the centre, rad the distance from it.
// The pieces: the uterus, swollen into a dome over the fibroid and hollowed into its bed beneath (UT.myo); the top of
// the dome as two flaps that part along the incision and are drawn together again by the repair (FB.flap); the
// fibroid; the strands that hold it. With the fibroid out the dome sinks back toward the uterus's own surface
// (FB.c: 0 the full dome, 1 none) and the repair brings the floor of the bed up under the flaps (FB.beta: 0 to 1).
const FB = {
  R: 2.25, COVER: 0.32, WALL: 0.27, SM: 0.95, TL: 2 / 13, YC: 7.6, RISE: 1.25, ROLL: 0.9, WARP: [0.3, 2.3], // COVER: wall over the fibroid, of which WALL shows as the cut face; SM: half-length of the incision; YC: top of the cavity; RISE, ROLL: how far the fibroid comes up, and away from the near edge, as it is freed
  TF: 1.2, TW: 1.0, BED: 1.75, FILLET: 0.8, EPS: 0.03, // the flaps reach TF from the summit; under them, within TW, the uterus is the bed, which spans BED from its deepest point; FILLET: how wide the swell is where dome meets uterus
  SINK: [0.25, 0.45, 0.6], RISEN: [0.2, 1], // FB.c with the fibroid out, the deep layer closed, the serosa closed; FB.beta with the fibroid out, the deep layer closed
  A: V(0, 0.906, -0.423), T: V(1, 0, 0), W: new V3(), N0: new V3(), C: new V3(), // N0: where the fibroid's axis meets the serosa; C: the fibroid's centre in its bed
  c: 0, beta: 0, F: new V3(), fibIn: true, sigU: '', sigF: '', park: new V3(), site: vecArr(3), SITE: [0.55, 0, -0.55], // F: where the fibroid's centre is now; SITE: the injection sites, as shares of the incision's half-length
  // Where the fibroid is held to its bed: s as a share of the incision's half-length, sg the edge (-1 near, 1 far).
  // The first four are under the edges. The next three, on the near side, show once those are divided and the
  // fibroid has begun to come up and away from them. The last is the vascular pedicle, at the base.
  ATT: [{ s: 0.6, sg: 1 }, { s: 0.15, sg: 1 }, { s: -0.3, sg: 1 }, { s: 0.55, sg: -1 }, { s: 0.92, sg: -1 }, { s: 0.3, sg: -1 }, { s: -0.5, sg: -1 }, { s: -0.1, sg: -1 }]
};
FB.W.crossVectors(FB.A, FB.T); FB.Rs = FB.R + FB.COVER; // the serosa over the fibroid
const _fa = new V3(), _fb = new V3(), _fd = new V3(), _fe = new V3();
// frame coordinates (x along T, e along A, z along W, from the fibroid's centre) to uterus-local
function fbLocal(x, e, z, out) { return out.copy(FB.C).addScaledVector(FB.T, x).addScaledVector(FB.A, e).addScaledVector(FB.W, z); }
function fbPoint(s, w, rad, out) { const cw = Math.cos(w); return fbLocal(rad * cw * Math.sin(s), rad * cw * Math.cos(s), rad * Math.sin(w), out); }
function fbWorld(s, w, rad, out) { return fbPoint(s, w, rad, out).applyMatrix4(UT.M); }
function fbFrame(local) { // where a uterus-local point lies in the wall
  _fa.copy(local).sub(FB.C);
  const x = _fa.dot(FB.T), e = _fa.dot(FB.A), z = _fa.dot(FB.W), rad = Math.hypot(x, e, z) || 1;
  return { x, e, z, rad, s: Math.atan2(x, e), w: Math.asin(clamp(z / rad, -1, 1)) };
}
const fbAt = p => fbFrame(_fe.copy(p).applyMatrix4(UT.Minv)); // the same for a world point
// The uterus's own surface as seen from the fibroid's centre: its distance in direction (s, w), from a table (rhoBuild).
const RHO = { ns: 73, nw: 37, t: null };
function fbRho(s, w) {
  const fs = clamp((s / TAU + 0.5) * (RHO.ns - 1), 0, RHO.ns - 1.001), fw = clamp((w / Math.PI + 0.5) * (RHO.nw - 1), 0, RHO.nw - 1.001), i = Math.floor(fs), j = Math.floor(fw), a = fs - i, b = fw - j, t = RHO.t, k = j * RHO.ns + i;
  return lerp(lerp(t[k], t[k + 1], a), lerp(t[k + RHO.ns], t[k + RHO.ns + 1], a), b);
}
// How far out the wall's serosa is, given how far out the uterus's own surface is (rho): the larger of that and the
// dome, swelling smoothly from one to the other, and sunk back toward rho as far as FB.c says.
function fbRise(rho) { const K = FB.FILLET, h = Math.max(0, K - Math.abs(FB.Rs - rho)) / K; return rho + (1 - FB.c) * (Math.max(FB.Rs, rho) + h * h * K / 4 - rho); }
const fbOut = (s, w) => fbRise(fbRho(s, w));
const fbSero = (s, w, lift, out) => fbWorld(s, w, fbOut(s, w) + lift, out); // a world point on the serosa (lift: above it; negative, within the wall)
// Half-width of the opening at s: how far the incision has been cut (from the patient's right), how far its edges
// stand apart, and how much each layer of the repair has closed (also from the right).
function fbGap(s) {
  const m = S.myo, x = s / FB.SM; if (x <= -1 || x >= 1 || m.inc <= 0) return 0;
  const front = FB.SM * (1 - 2 * m.inc), drawn = sstep(m.deepFront - 0.12, m.deepFront + 0.12, s), shut = sstep(m.seroFront - 0.12, m.seroFront + 0.12, s);
  return m.G * Math.sqrt(1 - x * x * x * x) * sstep(front - 0.1, front + 0.03, s) * (1 - 0.55 * drawn) * (1 - shut);
}
// vasopressin blanches the wall round each injection
function fbBlanch(p, c) {
  const v = S.myo.vaso;
  for (let i = 0; i < 3; i++) if (v[i] > 0) { const q = v[i] * (1 - sstep(0.7, 2.2, p.distanceTo(FB.site[i]))) * 0.85; c[0] = lerp(c[0], 1.12, q); c[1] = lerp(c[1], 1.34, q); c[2] = lerp(c[2], 1.32, q); }
}
// the wall drapes over the fibroid as it comes up through the opening
function fbDrape(o) { if (!FB.fibIn) return o; _fd.subVectors(o, FB.F); const d = _fd.length(); if (d < FB.R + 0.04) o.copy(FB.F).addScaledVector(_fd, (FB.R + 0.04) / d); return o; }
// One flap: half of the cap of the dome. Rows 0 to 2 are its cut face, from the fibroid's plane up to the serosa; the
// rest is serosa, from the edge out to the rim of the cap, where it lies just over the uterus. The near flap is run
// the other way along the incision, so that both flaps face outward.
function flapFn(sg) {
  const cF = Math.cos(FB.TF);
  return (sx, t, o, c) => {
    const s = FB.TF * (2 * (sg < 0 ? 1 - sx : sx) - 1), wm = Math.acos(Math.min(1, cF / Math.cos(s))), g = Math.min(fbGap(s), wm), open = sstep(0, 0.03, g), lip = t < FB.TL + 1e-6;
    const w = sg * (lip ? g : lerp(g, wm, Math.pow((t - FB.TL) / (1 - FB.TL), 1.2))), ro = fbOut(s, w) + FB.EPS;
    fbDrape(fbPoint(s, w, lip ? ro - (FB.WALL - 0.03) * open * (1 - t / FB.TL) : ro, o));
    fbBlanch(o, c);
    if (lip && t < FB.TL - 1e-6) { c[0] = lerp(c[0], 1.0, open); c[1] = lerp(c[1], 0.66, open); c[2] = lerp(c[2], 0.64, open); } // cut myometrium
    const rim = open * (1 - sstep(0.02, 0.1, Math.abs(t - FB.TL))) * 0.55; // the serosal edge, cut with energy
    c[0] *= 1 - 0.4 * rim; c[1] *= 1 - 0.55 * rim; c[2] *= 1 - 0.6 * rim; c[3] = rim;
  };
}
// A flap's own normals are worked out from its faces, which at its rim leaves them leaning inward. Where the flap
// lies on the serosa it is given the serosa's normal instead, so its rim does not show against the uterus under it.
function flapNormals(st) {
  const pos = st.pos, nr = st.geo.attributes.normal.array, H = 0.03;
  for (let i = 0; i < pos.length; i += 3) {
    const f = fbFrame(_fb.set(pos[i], pos[i + 1], pos[i + 2]));
    if (Math.abs(f.rad - fbOut(f.s, f.w) - FB.EPS) > 0.004) continue; // a cut face, or wall lifted by the fibroid
    fbPoint(f.s + H, f.w, fbOut(f.s + H, f.w), _fa).sub(fbPoint(f.s - H, f.w, fbOut(f.s - H, f.w), _fd));
    fbPoint(f.s, f.w + H, fbOut(f.s, f.w + H), _fd).sub(fbPoint(f.s, f.w - H, fbOut(f.s, f.w - H), _fe));
    _fa.cross(_fd).normalize(); if (_fa.dot(_fb.sub(FB.C)) < 0) _fa.negate();
    nr[i] = _fa.x; nr[i + 1] = _fa.y; nr[i + 2] = _fa.z;
  }
  st.geo.attributes.normal.needsUpdate = true;
}
// The uterus round the fibroid, each point of its wall moved along the line from the fibroid's centre: out to the
// dome, or, under the flaps, the other way to line the bed (and back up under the flaps as the repair closes it).
function fbUterus() {
  const g = UT.myo.geometry, pos = g.attributes.position.array, col = g.attributes.color.array, nom = FB.nom, c0 = FB.col0, c = [1, 1, 1], p = new V3(), Rb = FB.Rs - FB.WALL;
  for (let i = 0; i < nom.length; i += 3) {
    p.set(nom[i], nom[i + 1], nom[i + 2]); c[0] = c0[i]; c[1] = c0[i + 1]; c[2] = c0[i + 2];
    const f = fbFrame(p);
    if (f.rad < FB.Rs + FB.FILLET) {
      const out = fbRise(f.rad), th = Math.acos(clamp(f.e / f.rad, -1, 1));
      if (f.rad < FB.Rs && th < FB.TW) { // the bed: from the deep face of the fibroid's sphere up to the underside of the flaps
        const tb = th * FB.BED / FB.TW, q = Rb * Math.sin(tb) / (Math.hypot(f.x, f.z) || 1), u = (out - FB.WALL - 0.03) / f.rad, b = FB.beta;
        fbLocal(lerp(f.x * q, f.x * u, b), lerp(-Rb * Math.cos(tb), f.e * u, b), lerp(f.z * q, f.z * u, b), p); c[1] *= 0.66; c[2] *= 0.64;
      } else { const q = out / f.rad; fbLocal(f.x * q, f.e * q, f.z * q, p); }
    }
    fbBlanch(p, c);
    pos[i] = p.x; pos[i + 1] = p.y; pos[i + 2] = p.z; col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2];
  }
  g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); weldSeam(g, FB.NU, FB.NV);
}
// attachment i: where it leaves the edge of the wall (uterus-local) and where it meets the fibroid
function fbStrand(i, lip, fib) {
  const a = FB.ATT[i], s = a.s * FB.SM, w = a.sg * fbGap(s);
  fbDrape(fbPoint(s, w, fbOut(s, w) - FB.WALL / 2, lip));
  return fib.subVectors(lip, FB.F).addScaledVector(FB.A, i < 7 ? -0.45 : -0.7).setLength(FB.R).add(FB.F);
}
function fbAttPt(i, out) { fbStrand(i, _fa, _fb); return out.lerpVectors(_fa, _fb, 0.5).applyMatrix4(UT.M); } // the working point: mid-strand
const fbRound = () => { const a = S.myo.att; return a.slice(0, 4).every(Boolean) ? (a.slice(4, 7).every(Boolean) ? [7] : [4, 5, 6]) : [0, 1, 2, 3]; }; // the attachments that can be reached now
function fbApex(out) { return out.copy(FB.A).transformDirection(UT.M).multiplyScalar(FB.R).add(S.myo.pos); } // the top of the fibroid
function fbFocus(out) { return out.copy(FB.N0).addScaledVector(FB.A, 0.8).applyMatrix4(UT.M); }

(function () {
  // where the fibroid's axis leaves the wall: the point of the anterior surface in direction A from the top of the cavity
  const core = V(0, FB.YC, 0), p = new V3(); let best = 9, tN = 3;
  for (let y = 7; y <= 8.6; y += 0.004) { utWarp(utSurf(180, y, 0, p), FB.WARP[0], FB.WARP[1]); const e = _fa.subVectors(p, core).angleTo(FB.A); if (e < best) { best = e; FB.N0.copy(p); tN = _fa.length(); } }
  FB.C.copy(FB.N0).addScaledVector(FB.A, -clamp(tN - FB.R - 0.3, 0.2, 1.2)); // leaves about 3 mm of wall between the fibroid and the cavity
  FB.NU = 96; FB.NV = 80;
  const g = paramSurface(FB.NU, FB.NV, (u, v, q, c) => { utVertex(u, v, q, c); utWarp(q, FB.WARP[0], FB.WARP[1]); }, { closedU: true, su: 3, sv: 3 });
  FB.nom = g.attributes.position.array.slice(); FB.col0 = g.attributes.color.array.slice(); g.boundingSphere = BIG_SPHERE();
  UT.myo = reg(new THREE.Mesh(g, MAT.uterus), 'uterus'); UT.myo.frustumCulled = false; UT.g.add(UT.myo);
  FB.flap = [-1, 1].map(() => { const st = new Strip(49, 14, MAT.wall); reg(st.mesh, 'uterus', null, { strip: st }); UT.g.add(st.mesh); return st; });
  const fg = new THREE.SphereGeometry(FB.R, 96, 64), fp = fg.attributes.position, n = new V3(), fc = new Float32Array(fp.count * 3);
  for (let i = 0; i < fp.count; i++) { // lobulated, and whorled: bands that follow the grain of the noise
    n.fromBufferAttribute(fp, i); const k = 1 + 0.07 * (fbm3(n.x * 0.9 + 4, n.y * 0.9, n.z * 0.9 + 2, 3) - 0.5), w = 0.5 + 0.5 * Math.sin(13 * fbm3(n.x * 0.5 + 1, n.y * 0.5 + 6, n.z * 0.5, 2));
    fp.setXYZ(i, n.x * k, n.y * k, n.z * k); fc[i * 3] = 1 - 0.05 * w; fc[i * 3 + 1] = 1 - 0.1 * w; fc[i * 3 + 2] = 1 - 0.12 * w;
  }
  fg.setAttribute('color', new THREE.BufferAttribute(fc, 3)); fg.computeVertexNormals();
  FB.fib = reg(new THREE.Mesh(fg, MAT.fibroid), 'fibroid'); scene.add(FB.fib);
  FB.str = FB.ATT.map(() => { const t = new Tube(5, 6, MAT.cord, 1, 1); scene.add(t.mesh); return t; }); FB.sarr = vecArr(3);
})();
// The table behind fbRho: a ray from the centre in each direction, met with the triangles of the wall near enough to
// matter. Made the first time the case is taken up.
function rhoBuild() {
  const nom = FB.nom, ix = UT.myo.geometry.index.array, p = new V3(), far = (FB.Rs + FB.FILLET + 0.6) ** 2, tris = [], P = k => p.set(nom[k * 3], nom[k * 3 + 1], nom[k * 3 + 2]).sub(FB.C);
  for (let k = 0; k < ix.length; k += 3) { const a = P(ix[k]).clone(), b = P(ix[k + 1]).clone(), c = P(ix[k + 2]).clone(); if (Math.min(a.lengthSq(), b.lengthSq(), c.lengthSq()) < far) tris.push(a, b.sub(a), c.sub(a)); }
  const d = new V3(), h = new V3(), q = new V3(); RHO.t = new Float32Array(RHO.ns * RHO.nw).fill(9);
  for (let j = 0; j < RHO.nw; j++) for (let i = 0; i < RHO.ns; i++) {
    fbPoint((i / (RHO.ns - 1) - 0.5) * TAU, (j / (RHO.nw - 1) - 0.5) * Math.PI, 1, d).sub(FB.C); let best = 9;
    for (let k = 0; k < tris.length; k += 3) { // Moller-Trumbore, either face
      const e1 = tris[k + 1], e2 = tris[k + 2]; h.crossVectors(d, e2); const det = e1.dot(h); if (Math.abs(det) < 1e-9) continue;
      const u = -tris[k].dot(h) / det; if (u < 0 || u > 1) continue;
      q.crossVectors(tris[k], e1); const v = -d.dot(q) / det; if (v < 0 || u + v > 1) continue;
      const t = -e2.dot(q) / det; if (t > 1e-4 && t < best) best = t;
    }
    RHO.t[j * RHO.ns + i] = best;
  }
}
function myoShow(on) {
  if (on && !RHO.t) rhoBuild();
  UT.mesh.visible = !on; UT.myo.visible = on; for (const f of FB.flap) f.mesh.visible = on; if (!on) { FB.fib.visible = false; for (const t of FB.str) t.mesh.visible = false; }
}

function myoUpdate(dt) {
  const m = S.myo, gone = m.fib !== 'in' && m.fib !== 'free', q2 = m.deep.st.length / 3, q3 = m.sero.st.length / 4;
  m.inc = damp(m.inc, m.incGoal, 9, dt);
  m.lift = damp(m.lift, m.att.filter(Boolean).length / 8, 3, dt);
  m.G = damp(m.G, gone ? 0.62 : m.incGoal > 0 ? 0.2 + 0.75 * Math.min(1, m.lift / 0.4) : 0, 4, dt);
  m.deepFront = damp(m.deepFront, m.deepGoal, 8, dt); m.seroFront = damp(m.seroFront, m.seroGoal, 8, dt);
  FB.c = m.c = damp(m.c, gone ? lerp(lerp(FB.SINK[0], FB.SINK[1], q2), FB.SINK[2], q3) : 0, 3, dt);
  FB.beta = m.beta = damp(m.beta, gone ? lerp(FB.RISEN[0], FB.RISEN[1], q2) : 0, 3, dt);
  for (let i = 0; i < 3; i++) fbPoint(FB.SITE[i] * FB.SM, 0, fbOut(FB.SITE[i] * FB.SM, 0), FB.site[i]);
  // the fibroid: in its bed and drawn by the tenaculum, carried once free, then set down, bagged and taken out
  const seat = fbLocal(0, m.lift * FB.RISE, m.lift * FB.ROLL, _fb).applyMatrix4(UT.M), h = m.held && HAND[m.held], g = h && h.grab;
  if (m.fib === 'in') { m.pos.copy(seat); if (g) { g.pull.nat.copy(seat).add(g.gp); m.pos.add(g.pull.off); } }
  else if (m.fib === 'free') { if (g) m.pos.copy(h.tip).sub(g.gp); }
  else if (m.fib === 'park') { m.pos.x = damp(m.pos.x, FB.park.x, 3.5, dt); m.pos.y = damp(m.pos.y, FB.park.y, 3.5, dt); m.pos.z = damp(m.pos.z, FB.park.z, 3.5, dt); }
  else if (m.fib === 'bag') { m.bag += dt; if (m.bag > 0.8) m.pos.lerp(bagExit(), 1 - Math.exp(-2.2 * dt)); if (m.bag > 2.4) { m.fib = 'out'; toast('Specimen out in its bag, through the umbilical incision', 'ok'); uiDirty(); } }
  FB.F.copy(m.pos).applyMatrix4(UT.Minv); FB.fibIn = !gone && FB.F.distanceTo(FB.C) < 3.2;
  FB.fib.visible = m.fib !== 'out'; FB.fib.position.copy(m.pos); FB.fib.quaternion.setFromRotationMatrix(UT.M);
  BAG.visible = m.fib === 'bag'; if (BAG.visible) { BAG.scale.set(FB.R * 1.25, FB.R * 1.45, FB.R * 1.25); BAG.position.copy(m.pos); BAG.quaternion.copy(camera.quaternion); }
  // geometry, only when what shapes it has changed
  const f3 = v => v.toFixed(3), sU = [m.c, m.beta, m.vaso[0] + m.vaso[1] + m.vaso[2]].map(f3).join(), sF = sU + [m.inc, m.G, m.deepFront, m.seroFront, FB.F.x, FB.F.y, FB.F.z].map(f3).join() + FB.fibIn;
  // a burn mark on the wall stays on it as it sinks: where it is, and how far it stands off the serosa
  for (const d of DECALS) if (!d.userData.fb && (d.parent === UT.myo || d.parent === FB.flap[0].mesh || d.parent === FB.flap[1].mesh)) { const f = fbFrame(d.position); d.userData.fb = f.rad < FB.Rs + FB.FILLET ? [f.s, f.w, f.rad - fbOut(f.s, f.w)] : []; }
  if (sU !== FB.sigU) { FB.sigU = sU; fbUterus(); for (const d of DECALS) { const b = d.userData.fb; if (b && b.length) fbPoint(b[0], b[1], fbOut(b[0], b[1]) + b[2], d.position); } }
  if (sF !== FB.sigF) { FB.sigF = sF; FB.flap.forEach((f, i) => { f.update(flapFn(i ? 1 : -1)); flapNormals(f); }); }
  // strands: fine fibres of the pseudocapsule, and the pedicle
  const live = fbRound(), pd = m.ped;
  for (let i = 0; i < 8; i++) {
    const t = FB.str[i];
    if (m.fib !== 'in' || m.att[i] || m.inc < 0.9 || !live.includes(i)) { t.mesh.visible = false; continue; }
    fbStrand(i, FB.sarr[0], FB.sarr[2]); FB.sarr[0].applyMatrix4(UT.M); FB.sarr[2].applyMatrix4(UT.M); FB.sarr[1].lerpVectors(FB.sarr[0], FB.sarr[2], 0.5);
    if (i < 7) t.set(FB.sarr, 0, 1, () => 0.05, (u, c) => { c[0] = 1; c[1] = 0.86; c[2] = 0.82; });
    else t.set(FB.sarr, 0, 1, u => 0.13 * (1 - 0.3 * pd.p), (u, c) => { c[0] = lerp(COL.art[0], COL.seal[0], pd.p); c[1] = lerp(COL.art[1], COL.seal[1], pd.p); c[2] = lerp(COL.art[2], COL.seal[2], pd.p); c[3] = pd.p; });
  }
}

// ---------- what the instruments do ----------
// tenaculum: lock on to the fibroid. In its bed it gives a little (traction); once free it goes where the tip goes.
function myoClamp(h) {
  const m = S.myo, P = h.pick;
  if (!(P.hit && h.near && P.ent === 'fibroid') || (m.fib !== 'in' && m.fib !== 'free')) { if (P.hit && h.near) hint('tenac2', 'The tenaculum is for the fibroid: its teeth tear other tissue'); return true; }
  h.grab = { pull: { nat: P.point.clone(), off: new V3(), max: m.fib === 'in' ? 1.3 : 99 }, gp: P.point.clone().sub(m.pos), onRelease: myoLetGo };
  h.openGoal = 0.05; m.held = h.key; S.stats.traction++; sfx.click(); uiDirty();
  return true;
}
function myoLetGo(h) {
  const m = S.myo; m.held = null; uiDirty();
  if (m.fib !== 'free') return;
  m.fib = 'park';
  if (m.pos.distanceTo(FB.park) > 4.5 && !(h.ptr.on && h.ray.distanceSqToPoint(FB.park) < 6)) { m.dropped = true; logEvent('tech', 'Fibroid let go away from the planned spot. A fibroid that is lost in the abdomen has to be found again.'); }
  else toast('Fibroid set down where it can be found again', 'ok');
}
const _pk = new V2();
function myoPark() { // where the freed fibroid is to be set down: against the pelvic wall, at a place that is in view
  for (const [x, y] of [[0.62, -0.5], [0.7, -0.15], [0.45, -0.7], [-0.62, -0.5], [-0.7, -0.15]]) {
    RAY.setFromCamera(_pk.set(x, y), camera); const f = firstShown(RAY.intersectObjects(PICKS, false));
    if (f && f.object.userData.ent === 'wall') { FB.park.copy(f.point).addScaledVector(RAY.ray.direction, -(FB.R + 0.2)); return; }
  }
  FB.park.copy(wallPt(-50, 6.5, FB.R + 0.3, 1));
}
function myoFree() { // the last attachment is divided
  const m = S.myo, h = m.held && HAND[m.held];
  m.fib = 'free'; if (h && h.grab) h.grab.pull.max = 99;
  myoPark();
  toast('Fibroid free. Carry it to the marked spot and let go.', 'ok'); sfx.ok(); uiDirty();
}
// bipolar anywhere on the uterine wall that is not a bleeding point or the pedicle: counted, because it costs myometrium
function myoCoag(h, dt) {
  if (!(h.near && h.pick.hit && h.pick.ent === 'uterus')) return false;
  S.myo.coag += dt; if (S.myo.coag > 3) hint('coag', 'Go sparingly with the bipolar on myometrium: the closure gives the haemostasis');
  return false;
}
// the hook on the floor of the bed, toward the cavity
function myoDeep(h, dt) {
  const m = S.myo, P = h.pick;
  if (!(h.near && P.hit && P.mesh === UT.myo)) return false;
  const at = fbAt(P.point); if (at.e > -0.8 || at.x * at.x + at.z * at.z > 1.7) return false; // the floor: within 1.3 cm of the deepest point
  m.bedBurn += dt;
  if (m.bedBurn > 0.6 && !m.cavity) { m.cavity = true; logEvent('tech', 'Endometrial cavity entered at the base of the bed. It is closed as a separate layer, and it changes the advice on delivery.'); sfx.warn(); }
  return false;
}

// ---------- steps ----------
const exFundus = { label: 'Fundus presented to the scope', ok: () => Math.abs(S.pose.yaw) < 0.22 && S.pose.pitch > -0.22 && S.pose.pitch < 0.3 };
const MYO_REC = { yaw: 0, pitch: 0, push: 0.35 };
function closeStep(o) { // one layer of the repair: stitches from the patient's right, each a bite on the near edge then the far edge
  const L = o.layer, deep = L === 'deep', n = o.at.length;
  const edge = sg => (sg < 0 ? 'near' : 'far');
  return Object.assign({
    kind: 'close', tool: 'needle', dist: 8.5, rec: MYO_REC, expo: [exFundus],
    aim(i, sg, out) { const s = o.at[i] * FB.SM, g = fbGap(s); return deep ? fbSero(s, sg * g, sg < 0 ? 0 : -0.15, out) : fbSero(s, sg * (g + 0.5 / fbOut(s, sg * g)), 0, out); }, // deep: the near edge, and the cut face of the far one; serosal: 5 mm back from each edge
    next() { const y = S.myo[L]; return y.done ? null : { p: this.aim(y.st.length, y.pend ? 1 : -1, new V3()), act: 'bite', label: y.pend ? 'Far edge' : 'Near edge' }; },
    click(h) {
      if (h.inst !== 'needle') return false;
      const m = S.myo, y = m[L], P = h.pick; if (y.done) return true;
      if (!P.hit || !h.near || P.ent !== 'uterus') { hint('bitemiss', 'Place the bite in the uterine wall at the edge of the defect'); return true; }
      const at = fbAt(P.point), sg = at.z < 0 ? -1 : 1, ro = fbOut(at.s, at.w), onFace = at.rad < ro - 0.06, want = o.at[y.st.length] * FB.SM;
      const off = (at.s - (y.pend ? y.pend.s : want)) * ro, from = onFace ? 0 : (Math.abs(at.w) - fbGap(at.s)) * ro; // cm along the incision from where it should be; cm back from the edge
      if (sg !== (y.pend ? 1 : -1)) { hint('biteside', y.pend ? 'Now the far edge, opposite the first bite' : 'Near edge first, then the far edge'); return true; }
      if (from > 1.4) { hint('bitefar', 'Too far from the edge of the defect'); return true; }
      if (Math.abs(off) > 0.6) { hint('biteoff', y.pend ? 'Match this bite to the one on the near edge' : off > 0 ? (y.st.length ? 'Too close to the last stitch: move toward the patient\'s left' : 'Start nearer the middle: this is beyond the right end') : (y.st.length ? 'That leaves a gap. Stitches should be about 1 cm apart.' : 'Start at the right end of the incision')); return true; }
      if (!y.pend) y.pend = { x: at.x, s: at.s, from };
      else {
        y.st.push({ s: want, x: y.pend.x, a: y.pend.from, b: from }); y.pend = null; S.ebl += 0.5;
        m[L + 'Goal'] = y.st.length >= n ? -FB.SM - 0.4 : y.st[y.st.length - 1].s - 0.3 * FB.SM;
        if (y.st.length >= n) { y.done = true; toast(deep ? 'Deep layer closed: the dead space is gone' : 'Serosa closed. Suture cut.', 'ok'); }
      }
      h.roll = 1; sfx.bite();
      if (deep && !onFace && from > 0.5) logEvent('tech', 'Deep-layer bite taken through the serosa: it should gather the muscle inside the defect');
      else if (!deep && (onFace || from < 0.2)) logEvent('tech', 'Seromuscular bite at the very edge: risk of pull-through');
      uiDirty(); return true;
    },
    bipolar: myoCoag,
    done() { const y = S.myo[L]; return y.done && S.myo[L + 'Front'] < -FB.SM; },
    progress() { const y = S.myo[L]; return y.st.length + ' of ' + n + ' stitches' + (y.pend ? ' + near edge placed' : ''); },
    frac() { const y = S.myo[L]; return (y.st.length + (y.pend ? 0.5 : 0)) / n; },
    focus: fbFocus,
    force() { const y = S.myo[L]; y.st = o.at.map(f => ({ s: f * FB.SM, x: fbOut(f * FB.SM, 0) * Math.sin(f * FB.SM), a: 0.5, b: 0.5 })); y.pend = null; y.done = true; S.myo[L + 'Goal'] = -FB.SM - 0.4; }
  }, o);
}
const MYO_STEPS = [
  {
    id: 'survey', kind: 'survey', tool: 'any', phase: 'Set-up', short: 'Map the fibroid', title: 'Survey the pelvis and map the fibroid', dist: 12.5, rec: MYO_REC, expo: [],
    text: ['Look at the whole uterus before anything is cut: the fibroid, both cornua and tubes, and the back wall.', 'Plan a transverse incision over the most prominent part of the fibroid, clear of the cornua.', 'Hold an instrument tip beside the fibroid, then beside each cornu, to mark them. No pinch or click is needed.'],
    pearl: 'Match what you see to the imaging: number, position and depth. An incision that drifts toward a cornu can cost a tube, and one placed off the fibroid\'s summit makes the enucleation deeper than it needs to be.',
    tm: { F: 0, R: 0, L: 0 }, name: { F: 'Fibroid', R: 'Right cornu', L: 'Left cornu' },
    pt(k, out) { return k === 'F' ? fbSero(0, 0, 0, out) : sampleArr(curG(k).tubeCur, 0.05, out); },
    click(h) { if (h.inst !== 'bipolar' && h.inst !== 'hook') return false; hint('surveyE', 'No energy yet. Hold the tip beside the fibroid and each cornu to mark them.'); return true; },
    tick(dt) {
      const seen = S.myo.seen;
      for (const k of ['F', 'R', 'L']) {
        if (seen[k]) continue;
        const p = this.pt(k, _w), near = HANDS.some(h => h.ptr.on && h.exch <= 0 && !h.firing && h.tip.distanceTo(p) < 1.3);
        this.tm[k] = near ? this.tm[k] + dt : Math.max(0, this.tm[k] - 2 * dt);
        if (this.tm[k] >= 1) { seen[k] = true; sfx.ok(); toast(this.name[k] + ' identified', 'ok'); uiDirty(); }
      }
    },
    next() { for (const k of ['F', 'R', 'L']) if (!S.myo.seen[k]) return { p: this.pt(k, new V3()), act: 'hover', label: 'Hold near the ' + this.name[k].toLowerCase(), prog: this.tm[k] }; return null; },
    reset() { this.tm = { F: 0, R: 0, L: 0 }; },
    done() { const s = S.myo.seen; return s.F && s.R && s.L; }, progress() { const s = S.myo.seen; return (s.F ? 1 : 0) + (s.R ? 1 : 0) + (s.L ? 1 : 0) + ' of 3 identified'; },
    frac() { const s = S.myo.seen; return ((s.F ? 1 : 0) + (s.R ? 1 : 0) + (s.L ? 1 : 0)) / 3; }, focus: fbFocus,
    force() { const s = S.myo.seen; s.F = s.R = s.L = true; }
  },
  {
    id: 'vaso', kind: 'inject', tool: 'inject', phase: 'Set-up', short: 'Inject dilute vasopressin', title: 'Inject dilute vasopressin', dist: 10, rec: MYO_REC, expo: [exFundus],
    text: ['Tell anaesthesia before you inject.', 'Take the injection needle. Along the planned incision, place the tip in the myometrium over the fibroid, aspirate, and hold to inject.', 'Inject at each marked site until the serosa blanches.'],
    pearl: 'Vasopressin is used off-label here, well diluted (your unit will have its own recipe and dose limit). Injected into a vessel it can cause severe hypertension, bradycardia and, rarely, cardiovascular collapse: aspirate first, every time, and warn anaesthesia. It lasts about half an hour, so the bed may bleed later.',
    button: { label: 'Tell anaesthesia: vasopressin going in', fn() { S.myo.told = true; toast('Anaesthesia is aware. Aspirate, then inject.', 'ok'); uiDirty(); }, hide: () => S.myo.told },
    site() { return S.myo.vaso.findIndex(v => v < 1); },
    next() { const i = this.site(); return i < 0 ? null : !S.myo.told ? { p: _w.copy(FB.site[i]).applyMatrix4(UT.M).clone(), act: 'button', label: 'Tell anaesthesia first' } : { p: _w.copy(FB.site[i]).applyMatrix4(UT.M).clone(), act: 'inject', label: 'Inject: site ' + (i + 1) + ' of 3', prog: S.myo.vaso[i] }; },
    inject(h, dt) {
      const m = S.myo, i = this.site(); if (i < 0) return true;
      if (!nearTarget(h, _w2.copy(FB.site[i]).applyMatrix4(UT.M), 0.9)) { if (h.near && h.pick.ent === 'uterus') { hint('injsite', 'Inject along the planned incision, at the marked site'); return true; } return false; }
      if (!m.told && !m.untold) { m.untold = true; logEvent('tech', 'Vasopressin injected before anaesthesia was told'); }
      m.vaso[i] = Math.min(1, m.vaso[i] + dt / 1.5); sustain('inj', 240, 'sine', 0.02);
      if (m.vaso[i] >= 1) { sfx.ok(); toast('Blanched: site ' + (i + 1) + ' of 3', 'ok'); uiDirty(); }
      return true;
    },
    done() { return this.site() < 0; }, progress() { return S.myo.vaso.filter(v => v >= 1).length + ' of 3 sites'; }, frac() { return (S.myo.vaso[0] + S.myo.vaso[1] + S.myo.vaso[2]) / 3; }, focus: fbFocus,
    force() { S.myo.told = true; S.myo.vaso = [1, 1, 1]; }
  },
  {
    id: 'hyst', kind: 'incise', tool: 'hook', phase: 'Enucleation', short: 'Hysterotomy', title: 'Incise the uterus down to the fibroid', dist: 9.5, rec: MYO_REC, expo: [exFundus], acc: 0, N: 6,
    text: ['Switch to the monopolar hook.', 'Hold to activate and carry a transverse incision across the summit of the fibroid, from the patient\'s right to left.', 'Go through serosa and myometrium until the tissue changes: the fibroid is pearly white and whorled.'],
    pearl: 'Depth is the whole step. Myometrium is pink and bleeds; the fibroid is white and firm, and the plane between them is the pseudocapsule. Stop short and you will be dissecting in muscle. Many surgeons cut transversely at laparoscopy because it runs with the arcuate vessels and is easier to suture from lateral ports.',
    cp(i, out) { return fbSero(FB.SM * (1 - (2 * (i + 0.5)) / this.N), 0, 0, out); }, n() { return Math.round(S.myo.incGoal * this.N); },
    next() { const n = this.n(); return n >= this.N ? null : { p: this.cp(n, new V3()), act: 'trace', label: n === 0 ? 'Start here: hold to cut' : 'Trace' }; },
    path() { const a = []; for (let i = this.n(); i < this.N; i++) a.push(this.cp(i, new V3())); return a; },
    targets() { const n = this.n(), a = []; for (let i = n; i < Math.min(this.N, n + 2); i++) a.push(this.cp(i, new V3())); return a; },
    hook(h, dt) {
      const n = this.n(); if (n >= this.N) return true;
      if (nearTarget(h, this.cp(n, _w2), 0.8)) { this.acc += dt; if (this.acc > 0.14) { this.acc = 0; S.myo.incGoal = (n + 1) / this.N; S.ebl += 3; sfx.click(); uiDirty(); if (n + 1 >= this.N) toast('Down to the fibroid: white, whorled, and it does not bleed', 'ok'); } return true; }
      if (h.near && h.pick.ent === 'uterus' && fbAt(h.pick.point).rad < FB.Rs + 0.4) { if (S.guided) hint('line', 'Follow the marked line across the summit of the fibroid'); S.stats.nonTarget += dt; }
      return false;
    },
    done() { return this.n() >= this.N && S.myo.inc > 0.97; }, progress() { return 'Incision ' + this.n() + ' / ' + this.N; }, frac() { return this.n() / this.N; }, focus: fbFocus,
    force() { S.myo.incGoal = 1; }
  },
  {
    id: 'enuc', kind: 'enuc', tool: 'hook', alt: 'suction', assist: 'tenaculum', phase: 'Enucleation', short: 'Enucleate the fibroid', title: 'Enucleate the fibroid', dist: 10, rec: MYO_REC, expo: [exFundus], acc: 0,
    text: ['Lock the tenaculum on the fibroid with one hand and pull: traction opens the plane.', 'With the other hand, divide the fine attachments between fibroid and wall where they are on stretch, with short hook bursts or blunt pushes of the suction tip. Stay on the fibroid.', 'At the base, seal the feeding vessels with the bipolar before you divide them. Then carry the fibroid to the marked spot and let go.'],
    pearl: 'Traction and counter-traction do the work. The pseudocapsule carries the vessels and belongs to the uterus: leave it behind, and use as little energy as the dissection allows. Put the fibroid where you will find it again, and count every one you take out.',
    pick(h) { let b = -1, bd = 1e9; for (const i of fbRound()) if (!S.myo.att[i]) { const d = fbAttPt(i, _w2).distanceTo(h.tip); if (d < bd) { bd = d; b = i; } } return b; },
    worker() { return HANDS.find(x => x.inst === 'hook' || x.inst === 'suction' || x.inst === 'bipolar') || activeHand(); },
    next() {
      const m = S.myo;
      if (m.fib === 'in' || m.fib === 'free') {
        if (!m.held) return { p: fbApex(new V3()), act: 'grasp', tool: 'tenaculum', hand: 'L', label: 'Lock the tenaculum on the fibroid' };
        if (m.fib === 'free') return { p: FB.park.clone().add(HAND[m.held].grab.gp), act: 'place', tool: 'tenaculum', hand: m.held, label: 'Carry the fibroid here and let go' }; // where the tip goes for the fibroid to lie on the spot
        const i = this.pick(this.worker()), p = fbAttPt(i, new V3());
        if (i < 7) return { p, act: 'trace', tool: 'hook', hand: 'R', label: 'Divide the attachment' };
        return m.ped.sealed ? { p, act: 'cut', tool: 'bipolar', hand: 'R', label: cutLabel() } : { p, act: 'seal', tool: 'bipolar', hand: 'R', label: 'Seal the vessels at the base', prog: m.ped.p };
      }
      return null;
    },
    targets() { return S.myo.fib === 'in' ? fbRound().filter(i => !S.myo.att[i]).map(i => fbAttPt(i, new V3())) : []; },
    divide(h, dt, T) { // an instrument working on an attachment; T: seconds it takes, 0 for at once
      const m = S.myo; if (m.fib !== 'in') return false;
      const i = this.pick(h); if (i < 0 || !nearTarget(h, fbAttPt(i, _w2), 0.75)) return false;
      if (!m.held) { hint('trac', 'Put the fibroid on traction with the tenaculum first: the plane opens under tension'); return true; }
      if (i === 7 && h.inst === 'suction') { hint('pedblunt', 'That is the vascular pedicle: seal it with the bipolar, then divide it'); return true; }
      this.acc += dt; if (this.acc < T) return true;
      this.acc = 0; m.att[i] = true; sfx.click(); uiDirty();
      if (i < 7) {
        S.ebl += 3; const n = m.att.filter(Boolean).length;
        if (n === 4) toast('The fibroid is coming up out of its bed. Work round the near side.', 'ok'); else if (n === 7) toast('Only the pedicle at the base holds it now. Seal it before you divide it.', 'ok');
        return true;
      }
      if (m.ped.sealed) S.ebl += 4;
      else { S.stats.unsealedCuts++; addBleeder(o => fbSero(-0.1 * FB.SM, -fbGap(0), -0.17, o), 110, true, 'feeding vessels'); logEvent('bleed', 'Feeding vessels divided without a seal: bleeding from the base. Control it with bipolar on the bleeding point.'); sfx.warn(); }
      myoFree(); return true;
    },
    hook(h, dt) { return this.divide(h, dt, 0.3) || myoDeep(h, dt) || (h.near && h.pick.ent === 'fibroid'); },
    blunt(h, dt) { if (this.divide(h, dt, 0.5)) S.stats.blunt += dt; },
    bipolar(h, dt) {
      const m = S.myo, pd = m.ped;
      if (m.fib !== 'in' || fbRound()[0] !== 7 || !nearTarget(h, fbAttPt(7, _w2), 0.8)) return myoCoag(h, dt);
      if (pd.sealed) { sustain('bip', 640, 'sine', 0.035); return true; }
      pd.p = Math.min(1, pd.p + dt / 1.8); sustain('bip', 440 + 190 * pd.p, 'sine', 0.07);
      if (pd.p >= 1) { pd.sealed = true; sfx.sealDone(); toast(CTRL.mode === 'hands' ? 'Sealed. Relax, then pinch again to divide.' : 'Sealed. Divide it: right-click or C, or the hook.', 'ok'); uiDirty(); }
      return true;
    },
    canCut(h) { const m = S.myo; return m.fib === 'in' && m.ped.sealed && nearTarget(h, fbAttPt(7, _w2), 1.1); },
    cut(hand) {
      const m = S.myo; if (m.fib !== 'in' || fbRound()[0] !== 7 || !m.ped.sealed) return false;
      const h = (hand ? [hand] : HANDS).find(x => x.inst === 'bipolar' && x.exch <= 0 && nearTarget(x, fbAttPt(7, _w2), 1.1));
      if (!h) { hint('cutnone', 'Bring the bipolar jaws back onto the sealed pedicle'); return true; }
      if (!m.held) { hint('trac', 'Put the fibroid on traction with the tenaculum first: the plane opens under tension'); return true; }
      sfx.cut(); h.open = 0; m.att[7] = true; S.ebl += 4; myoFree(); return true;
    },
    done() { return S.myo.fib === 'park'; },
    progress() { const m = S.myo, n = m.att.filter(Boolean).length; return m.fib === 'free' ? 'Free: set it down' : n >= 7 ? (m.ped.sealed ? 'Pedicle sealed: divide it' : 'Pedicle at the base: seal it with the bipolar') : 'Attachments ' + n + ' / 7' + (m.held ? '' : ' · no traction'); },
    frac() { const m = S.myo; return m.fib === 'in' ? (m.att.filter(Boolean).length + m.ped.p * 0.5) / 9 : 0.95; }, focus: fbFocus,
    force() { const m = S.myo; m.att.fill(true); m.ped.sealed = true; m.ped.p = 1; myoFree(); m.fib = 'park'; }
  },
  {
    id: 'hemo', kind: 'hemo', tool: 'bipolar', phase: 'Enucleation', short: 'Haemostasis of the bed', title: 'Inspect the bed and control bleeding points', dist: 8.5, rec: MYO_REC, expo: [exFundus],
    text: ['Look into the bed and along both edges.', 'Control distinct bleeding points with short bipolar bursts.', 'Leave the general ooze: the closure will deal with it.'],
    pearl: 'Use the bipolar sparingly here. Heavy coagulation devitalises myometrium that has to heal and later carry a pregnancy. Haemostasis in a myomectomy comes mainly from a layered closure that leaves no dead space.',
    enter() { const m = S.myo; if (m.bedSeen) return; m.bedSeen = true; for (const [f, sg] of [[0.35, 1], [-0.45, -1]]) addBleeder(o => fbSero(f * FB.SM, sg * fbGap(f * FB.SM), -0.15, o), 20, false, 'edge of the bed'); toast('Two vessels are bleeding at the edges of the bed', 'bleed'); },
    next() { return null; }, bipolar: myoCoag, hook: myoDeep,
    done() { return S.myo.bedSeen; }, progress() { return S.bleeders.length ? S.bleeders.length + ' bleeding point' + (S.bleeders.length > 1 ? 's' : '') : 'Dry enough to close'; }, frac() { return S.myo.bedSeen ? 1 - S.bleeders.length / 2 : 0; }, focus: fbFocus,
    force() { S.myo.bedSeen = true; S.bleeders.length = 0; }
  },
  closeStep({
    id: 'deep', layer: 'deep', at: [0.6, 0, -0.6], phase: 'Repair', short: 'Close the deep layer', title: 'Close the myometrium: deep layer',
    text: ['Take the needle driver with a barbed suture. Start at the patient\'s right end of the defect.', 'For each stitch click or pinch on the near edge, then the far edge, taking the muscle inside the defect.', 'Three stitches about 1 cm apart bring the floor and walls of the bed together.'],
    pearl: 'Close in layers so that no dead space is left for a haematoma, which weakens the scar. If the cavity was entered, the endometrium is closed first as its own layer with fine suture.'
  }),
  closeStep({
    id: 'sero', layer: 'sero', at: [0.75, 0.25, -0.25, -0.75], phase: 'Repair', short: 'Close the serosa', title: 'Close the seromuscular layer',
    text: ['Run the same suture back across the serosa.', 'For each stitch take the near edge, then the far edge, through the serosa about 5 mm from the cut edge.', 'Four stitches bring the edges together with no raw muscle showing.'],
    pearl: 'A baseball or imbricating stitch turns the edges in and leaves little suture or raw surface exposed, which is what adhesions form on. Barbed suture holds tension without knots, but an exposed barbed tail can catch bowel: cut it flush.'
  }),
  {
    id: 'bag', kind: 'bag', tool: 'any', phase: 'Completion', short: 'Remove the specimen', title: 'Remove the fibroid in a containment bag', dist: 13, rec: null, expo: [],
    text: ['Place the fibroid in a containment bag.', 'Bring the neck of the bag out through the umbilical incision and remove the tissue inside the bag.'],
    pearl: 'Fibroid tissue comes out contained. Uncontained power morcellation can scatter tissue through the abdomen, including an unsuspected sarcoma, and fragments left behind can implant.',
    button: { label: 'Bag the fibroid and take it out', fn() { const m = S.myo; if (m.fib !== 'park') return; m.fib = 'bag'; m.bag = 0; uiDirty(); }, hide: () => S.myo.fib !== 'park' },
    next() { return S.myo.fib === 'park' ? { p: S.myo.pos.clone(), act: 'button', label: 'Bag the fibroid' } : null; },
    done() { return S.myo.fib === 'out'; }, progress() { return S.myo.fib === 'bag' ? 'Coming out' : ''; }, frac() { return S.myo.fib === 'out' ? 1 : clamp(S.myo.bag / 2.4, 0, 1); }, focus(o) { return o.copy(S.myo.pos).lerp(fbFocus(_w2), 0.5); },
    force() { S.myo.fib = 'out'; }
  },
  {
    id: 'final', kind: 'final', tool: 'any', phase: 'Completion', short: 'Low-pressure inspection', title: 'Inspect the repair at low pressure', dist: 11, rec: MYO_REC, expo: [],
    text: ['Drop the pneumoperitoneum to 8 mmHg and watch the suture line.', 'Control any ooze, then irrigate and aspirate the pelvis.', 'Place an adhesion barrier over the repair.'],
    pearl: 'Record how deep the dissection went and whether the cavity was entered. Those two facts guide the advice on how long to wait before conceiving and on how to deliver.',
    bipolar: myoCoag,
    button: { label: 'Lower pressure to 8 mmHg', fn() { if (S.lowP) return; S.lowP = true; S.pressureGoal = 8; addBleeder(o => fbSero(-0.3 * FB.SM, 0.05, 0.03, o), 12, false, 'suture line'); toast('Pressure down: ooze from a needle hole in the repair', 'bleed'); uiDirty(); }, hide: () => S.lowP },
    button2: { label: 'Place the adhesion barrier and end the case', fn() { endCase(); }, show: () => S.lowP && !S.bleeders.length && S.pool < 8 },
    next() {
      if (!S.lowP) return { p: fbFocus(new V3()), act: 'button', label: 'Lower the pressure' };
      if (S.bleeders.length) return null;
      if (S.pool >= 8) return { p: poolSpot().clone(), act: 'suction', label: 'Aspirate the pool' }; // with this uterus in the way, a small pool shows only toward the scope
      return { p: fbFocus(new V3()), act: 'button', label: 'End the case' };
    },
    done() { return S.ended; }, progress() { return !S.lowP ? 'At 15 mmHg' : S.bleeders.length ? 'Ooze to control' : S.pool >= 8 ? 'Blood to aspirate: ' + Math.round(S.pool) + ' mL' : 'Dry'; },
    frac() { return (S.lowP ? 0.4 : 0) + (S.lowP && !S.bleeders.length ? 0.3 : 0) + (S.lowP && S.pool < 8 ? 0.3 : 0); }, focus: fbFocus,
    force() { S.lowP = true; S.bleeders.length = 0; S.pool = 0; endCase(); }
  }
];

// ---------- scoring, debrief, sutures ----------
function myoScore() {
  const s = S.stats, m = S.myo, inj = Object.keys(S.injuries).length;
  let pts = 100; const notes = [];
  if (inj) { pts -= 25 * inj; notes.push(inj + ' organ or vessel injur' + (inj > 1 ? 'ies' : 'y')); }
  if (m.cavity) { pts -= 10; notes.push('Endometrial cavity entered'); }
  if (s.unsealedCuts) { pts -= 8; notes.push('Feeding vessels divided without a seal'); }
  if (m.untold) { pts -= 5; notes.push('Vasopressin injected before anaesthesia was told'); }
  if (m.coag > 6) { pts -= Math.min(10, Math.round(m.coag - 6)); notes.push('Bipolar on the uterine wall for ' + m.coag.toFixed(0) + ' s beyond bleeding points'); }
  if (m.dropped) { pts -= 3; notes.push('Fibroid let go away from the planned spot'); }
  if (s.expoMiss) { pts -= Math.min(12, 2 * s.expoMiss); notes.push(s.expoMiss + ' step' + (s.expoMiss > 1 ? 's' : '') + ' started without the recommended exposure'); }
  if (S.ebl > 200) { pts -= Math.min(20, Math.round((S.ebl - 200) / 20)); notes.push('Blood loss above 200 mL'); }
  const tech = S.events.filter(e => e.type === 'tech' && /bite/.test(e.text)).length; if (tech) { pts -= Math.min(10, 2 * tech); notes.push(tech + ' stitch' + (tech > 1 ? 'es' : '') + ' placed outside the layer or at the very edge'); }
  if (s.nonTarget > 3) { pts -= Math.min(6, Math.round(s.nonTarget)); notes.push('Energy applied off target for ' + s.nonTarget.toFixed(1) + ' s'); }
  pts = Math.max(0, Math.round(pts));
  return { pts, grade: pts >= 90 ? 'Proficient' : pts >= 75 ? 'Competent' : pts >= 60 ? 'Developing' : 'Needs review', notes };
}
function myoDebrief(row) {
  const s = S.stats, m = S.myo, inj = Object.keys(S.injuries).length, yn = (v, bad) => row(v[0], v[1] ? 'Yes' : 'No', v[1] === bad ? 'warn' : 'ok');
  const gap = y => (y.st.length > 1 ? Math.round(((y.st[0].x - y.st[y.st.length - 1].x) / (y.st.length - 1)) * 10) + ' mm' : 'n/a');
  return [
    row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + yn(['Endometrial cavity entered', m.cavity], true) + yn(['Feeding vessels sealed before division', !s.unsealedCuts], false) + yn(['Anaesthesia told before vasopressin', !m.untold], false) + row('Bipolar on the wall beyond bleeding points', m.coag.toFixed(0) + ' s', m.coag > 6 ? 'warn' : 'ok'),
    row('Deep-layer stitches', m.deep.st.length) + row('Seromuscular stitches', m.sero.st.length) + row('Stitch spacing, deep / serosal', gap(m.deep) + ' / ' + gap(m.sero)) + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok') + row('Tenaculum applied', s.traction + ' time' + (s.traction === 1 ? '' : 's'))
  ];
}
function myoSutures() {
  const m = S.myo, st = [], V0 = () => new V3();
  for (const b of m.deep.st) { const g = fbGap(b.s); st.push([fbSero(b.s, -g, -0.15, V0()), fbSero(b.s - 0.04, 0, -0.1, V0()), fbSero(b.s - 0.08, g, -0.15, V0())]); }
  for (const b of m.sero.st) { const g = fbGap(b.s) + 0.5 / fbOut(b.s, 0); st.push([fbSero(b.s, -g, 0.02, V0()), fbSero(b.s - 0.04, 0, 0.13, V0()), fbSero(b.s - 0.08, g, 0.02, V0())]); }
  const id = STEPS[S.step].id, y = id === 'deep' ? m.deep : id === 'sero' ? m.sero : null;
  return { st, from: y && y.pend ? fbSero(y.pend.s, -fbGap(y.pend.s), 0, V0()) : st.length ? st[st.length - 1][2] : null, on: !!y && !y.done };
}
const MYO = {
  id: 'myo', name: 'Laparoscopic myomectomy', tag: ', single anterior fundal fibroid', blurb: 'One intramural fibroid, fertility-sparing. 9 steps.',
  sub: 'Single anterior fundal fibroid. Fertility-sparing.',
  brief: ['34-year-old, no previous pregnancies, with heavy menstrual bleeding and pelvic pressure. She wishes to conceive. MRI shows a single 4.5 cm anterior fundal fibroid, FIGO type 5, its deep margin about 3 mm from the cavity. No other fibroids.',
    'She is in lithotomy and Trendelenburg with a uterine manipulator in place. 10 mm umbilical scope, two 5 mm lateral ports, pneumoperitoneum at 15 mmHg. You are looking toward the pelvis: her right is on the right of the screen.'],
  steps: MYO_STEPS, insts: ['grasper', 'bipolar', 'hook', 'suction', 'needle', 'tenaculum', 'inject'], warp: FB.WARP, tipZ: 10.5, ureters: false, eblWarn: 200,
  spare: { tube: 1 }, // structures this operation is done to keep: energy on them is an injury
  needleHint: 'The needle driver is for closing the uterine wall',
  labels: [['Fibroid', () => fbApex(_w), () => S.myo.fib !== 'out'], ['Uterus', () => utWarp(_w.set(-2.2, 6.6, -0.92)).applyMatrix4(UT.M)]], // these replace the model's one label for the uterus
  state(s) {
    s.myo = {
      seen: { F: false, R: false, L: false }, told: false, untold: false, vaso: [0, 0, 0], incGoal: 0, inc: 0, G: 0,
      att: new Array(8).fill(false), ped: { p: 0, sealed: false }, lift: 0, held: null, fib: 'in', pos: new V3(), bag: 0, dropped: false, c: 0, beta: 0,
      bedSeen: false, bedBurn: 0, cavity: false, coag: 0,
      deep: { st: [], pend: null, done: false }, sero: { st: [], pend: null, done: false }, deepFront: 9, deepGoal: 9, seroFront: 9, seroGoal: 9
    };
    FB.c = FB.beta = 0; FB.sigU = FB.sigF = '';
  },
  show: myoShow, update: myoUpdate, clamp: myoClamp,
  score: myoScore, debrief: myoDebrief, sutures: myoSutures,
  want: (st, n) => (n.act === 'bite' ? { spot: 0.4, avoid: [] } : n.act === 'inject' ? { spot: 0.7, avoid: [] } : n.act === 'grasp' ? { ents: ['fibroid'], side: null } : null) // what a scripted hand should find under its tip
};
