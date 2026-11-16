// ---------- case: laparoscopic ovarian cystectomy (dermoid) ----------
// One ovary holds a cyst. In place of the model's ovary on that side there are two bodies: the ovary, its cortex
// stretched thin over the cyst, and the cyst inside it. The ovary is drawn as a ball with an opening that the
// operation makes and widens. The cortex parts along the incision, draws back over the cyst as the plane between the
// two is developed, and once the cyst is out is left as a shallow cup with its raw bed facing the scope.
const CY = {
  K: 'R', R: 2.0, R0: 2.2, R1: 1.25, // the side; the cyst's radius; the ovary's radius stretched over the cyst, and once it is empty (cm)
  A0: 0.42, A1: 1.0, QA: 5 / 8, TILT: 0.9, HINGE: 180, // half-angle of the opening when the cortex first parts, and of the empty ovary's (rad); the share of the dissection that brings the cyst's widest part through the opening; how far the cyst is then rolled off its bed (rad), and over which side of the opening (degrees, as AZ)
  N: 6, DA: 0.2, LINE: 36, DEEP: 1.0, HEAT: 0.45, // incision: points along it and the angle between them at the ovary's centre; which way it runs (degrees, as AZ: square to the working hand's line of approach, so that the hook meets every part of it alike); seconds of energy on cortex already cut before it goes through; seconds of energy on the cyst wall before that gives way
  NP: 8, PUSH: 0.5, // places round the plane, and the seconds of blunt work each takes
  AZ: [-30, 20, -75, -115, -5, -40, -20], // where round the opening each is worked: degrees from the side nearest the scope, positive toward the midline. These are on the working hand's side. The last place is the base, in the bed.
  EDGE: 75, BURN: 8, // where the cut edge of the cortex is held, the same way; seconds of bipolar on this ovary before it counts against the ovary
  dir: V(-0.3, 0.3, 0.9), // which way the cyst faces, for a right ovary: toward the scope
  NU: 48, NV: 34, V0: 0.3, // the ovary's mesh: columns, rows, and the share of the rows that make the bed
  G: { r: 2.2, a: 0, key: '', H: new V3(), C: new V3(), D: new V3(), e: new V3(), f: new V3(), Q: new V3(), hv: new V3() }, // the shape now: radius, half-angle of the opening, hilum, centre, axes, the cyst's centre, the way it rolls
  SPILL: [[-0.7, 1.0, [0.55, 0.22, 0.42]], [1.0, 0.5, [0.45, 0.18, 0.36]], [-1.5, -0.1, [0.4, 0.17, 0.3]]], // spilled contents: where each lump lands, from under the cyst (x, z), and its size
  spill: [], ov: null, cy: null, cut: null
};
CY.O = CY.K === 'R' ? 'L' : 'R';
const _c1 = new V3(), _c2 = new V3(), _c3 = new V3();
// The ovary in its own frame: x toward the opening, y toward the scope, z across (toward the midline). th is the angle from the middle
// of the opening. Outside the opening (th > a) this is the cortex. Inside, it is the bed: the cap turned inside out.
const cyRo = (th, ph, r) => r * (1 + 0.06 * (fbm3(Math.sin(th) * Math.cos(ph) * 1.6 + 7, Math.cos(th) * 1.6 + 1, Math.sin(th) * Math.sin(ph) * 1.6, 2) - 0.5));
function cyLocal(th, ph, out) {
  const G = CY.G, ro = cyRo(th, ph, G.r), lat = ro * Math.sin(th);
  return out.set(th < G.a ? 2 * cyRo(G.a, ph, G.r) * Math.cos(G.a) - ro * Math.cos(th) : ro * Math.cos(th), lat * Math.cos(ph), lat * Math.sin(ph));
}
function cyWorld(x, y, z, out) { const G = CY.G; return out.copy(G.C).addScaledVector(G.D, x).addScaledVector(G.e, y).addScaledVector(G.f, z); }
// a world point on the ovary: th from the middle of the opening, az degrees round it, lift cm clear of the surface
function cySurf(th, az, lift, out) { const p = cyLocal(th, az * DEG, _c1), k = 1 + lift / Math.max(0.3, p.length()); return cyWorld(p.x * k, p.y * k, p.z * k, out); }
const cyBed = (tf, az, out) => { const p = cyLocal(CY.G.a * tf, az * DEG, _c1); return cyWorld(p.x + 0.04, p.y, p.z, out); }; // a point in the bed: tf from its middle (0) to its lip (1)
const cyCut = (i, lift, out) => { const a = (i - (CY.N - 1) / 2) * CY.DA; return cySurf(Math.abs(a), a < 0 ? CY.LINE - 180 : CY.LINE, lift, out); }; // the i-th point of the incision
// the j-th place to work in the plane: on the lip of the opening, where cortex meets cyst; the last is in the bed, at the base
const cyPlane = (j, out) => (j >= CY.NP - 1 ? cyBed(0.1, 0, out) : cySurf(CY.G.a + 0.02, CY.AZ[j], 0.05, out));
const cyEdge = out => cySurf(CY.G.a + 0.3, CY.EDGE, 0, out); // where to take hold of the cut edge
const cyTop = (lift, out) => out.copy(CY.G.Q).add(S.cyst.off).addScaledVector(CY.G.D, CY.R + lift); // the cyst's free pole
const cyUo = out => { sampleArr(curG(CY.K).ridge, 0.07, out); out.y += 0.08; return out; }; // on the utero-ovarian ligament, where the cyst does not hide it
const cyHolder = ent => HANDS.find(h => h.grab && h.grab.pull && h.grab.side === CY.K && (ent ? h.grab.ent === ent : h.grab.ent === 'uo' || h.grab.ent === 'ovary')); // the hand steadying this ovary (ent: by that structure)
(function () {
  const g = paramSurface(CY.NU, CY.NV, (u, v, p) => p.set(0, 0, 0), { closedU: true, flip: true });
  CY.ov = reg(new THREE.Mesh(g, MAT.ovary), 'ovary', CY.K, { piece: 'cyst-ovary' }); CY.ov.frustumCulled = false; scene.add(CY.ov);
  const cg = paramSurface(40, 26, (u, v, p) => {
    const th = v * Math.PI, ph = u * TAU, k = CY.R * (1 + 0.03 * (fbm3(Math.sin(th) * Math.cos(ph) * 1.3 + 3, Math.cos(th) * 1.3 + 5, Math.sin(th) * Math.sin(ph) * 1.3, 2) - 0.5));
    p.set(k * Math.cos(th), k * Math.sin(th) * Math.cos(ph), k * Math.sin(th) * Math.sin(ph));
  }, { closedU: true, flip: true, su: 2, sv: 1 });
  CY.cy = reg(new THREE.Mesh(cg, MAT.cyst), 'cyst', CY.K); scene.add(CY.cy);
  // the incision before the cortex parts: a dark line scored along the free border, drawn as far as it has been cut
  const n = CY.N * 4, half = (CY.N / 2) * CY.DA;
  const L = CY.LINE * DEG, cl = Math.cos(L), sl = Math.sin(L);
  const lg = paramSurface(n, 1, (u, v, p) => { const a = (u * 2 - 1) * half, ro = cyRo(Math.abs(a), a < 0 ? L - Math.PI : L, CY.R0) + 0.012, d = ro * Math.sin(a), w = (v - 0.5) * 0.09; p.set(ro * Math.cos(a), d * cl - w * sl, d * sl + w * cl); }, {});
  CY.cut = new THREE.Mesh(lg, MAT.bloodWet); CY.cut.frustumCulled = false; scene.add(CY.cut);
  CY.SPILL.forEach((d, i) => { const m = reg(new THREE.Mesh(lumpGeo(51 + i * 9, d[2]), MAT.spill), 'spill'); m.rotation.y = i * 2.1; scene.add(m); CY.spill.push({ m, at: new V3() }); });
})();
function cyShow(on) { CY.ov.visible = on; AN.side[CY.K].ovary.visible = !on; if (!on) { CY.cy.visible = CY.cut.visible = false; for (const s of CY.spill) s.m.visible = false; } }

// Where everything is, from how far the operation has got. The cyst's dome always passes through the lip of the
// opening, so the lip is where cortex meets cyst. Until the cyst's widest part is through, the cortex draws back
// round a cyst that hardly moves. After that the ovary shrinks back toward its hilum and the cyst is rolled off it,
// away from the scope and hinged on the far lip, which opens the bed and shows the last attachment in its floor.
function cyShape() {
  const m = S.cyst, G = CY.G, s = AN.side[CY.K].s, R = CY.R;
  const qa = clamp(m.q / CY.QA, 0, 1), qb = easeIO(clamp((m.q - CY.QA) / (1 - CY.QA), 0, 1)), aE = Math.asin(R / CY.R0);
  G.r = lerp(CY.R0, CY.R1, qb);
  G.a = qb > 0 ? lerp(aE, CY.A1, qb) : lerp(CY.A0 * easeIO(m.open), aE, qa);
  G.D.set(CY.dir.x * s, CY.dir.y, CY.dir.z).normalize();
  sampleArr(curG(CY.K).ridge, 0.4, G.H); G.C.copy(G.H).addScaledVector(G.D, 0.86 * G.r);
  G.e.subVectors(CAM.pivot, G.C); G.e.addScaledVector(G.D, -G.e.dot(G.D)).normalize(); G.f.crossVectors(G.D, G.e);
  const hr = G.r * Math.cos(G.a), rho = Math.min(R, G.r * Math.sin(G.a)), w = Math.sqrt(Math.max(0, R * R - rho * rho));
  const hz = CY.HINGE * DEG; G.hv.copy(G.e).multiplyScalar(Math.cos(hz)).addScaledVector(G.f, Math.sin(hz));
  if (qb > 0) { const psi = Math.atan2(rho, w) - CY.TILT * qb; cyWorld(hr + R * Math.cos(psi), 0, 0, G.Q).addScaledVector(G.hv, rho - R * Math.sin(psi)); m.roll = CY.TILT * qb; }
  else { cyWorld(hr - w, 0, 0, G.Q); m.roll = 0; }
  const key = G.r.toFixed(3) + '/' + G.a.toFixed(3);
  if (key === G.key) return; G.key = key;
  const g = CY.ov.geometry, pos = g.attributes.position.array, col = g.attributes.color.array, cols = CY.NU + 1;
  for (let j = 0; j <= CY.NV; j++) for (let i = 0; i <= CY.NU; i++) {
    const v = j / CY.NV, k = (j * cols + i) * 3, th = v <= CY.V0 ? G.a * (v / CY.V0) : G.a + (Math.PI - G.a) * ((v - CY.V0) / (1 - CY.V0));
    const p = cyLocal(th, (i / CY.NU) * TAU, _c1), raw = v < CY.V0 ? 1 - 0.75 * sstep(0.7, 1, v / CY.V0) : 0.25 * (1 - sstep(0, 0.06, (v - CY.V0) / (1 - CY.V0))); // the bed is raw; the lip keeps a trace of it
    pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    col[k] = lerp(1, 0.82, raw); col[k + 1] = lerp(1, 0.3, raw); col[k + 2] = lerp(1, 0.28, raw);
  }
  g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); weldSeam(g, CY.NU, CY.NV); g.computeBoundingSphere();
}
// the cyst wall has been breached: by energy on it, by a cut carried too deep, or by a grasper's jaws
function cyRupture(why) {
  const m = S.cyst; if (m.rupt || m.out) return;
  m.rupt = why; m.inc = CY.N; sfx.warn();
  for (let i = 0; i < CY.spill.length; i++) { // each lump lands on the first thing under it
    const d = CY.SPILL[i], sp = CY.spill[i]; RAY.set(_c2.set(CY.G.Q.x + d[0], CY.G.Q.y - CY.R * 0.6, CY.G.Q.z + d[1]), DOWN);
    const f = RAY.intersectObjects(PICKS, false).find(x => shown(x.object) && !['cyst', 'ovary', 'spill'].includes(x.object.userData.ent));
    sp.at.set(_c2.x, (f ? f.point.y : -6.6) + d[2][1] * 0.6, _c2.z); m.spill[i] = 1;
  }
  logEvent('tech', (why === 'grasp' ? 'The grasper\'s jaws went through the cyst wall' : why === 'deep' ? 'The incision went through the cortex into the cyst' : 'Energy on the cyst wall went through it') + ': the cyst has ruptured and its contents have spilled. Finish the cystectomy, then wash out until the return is clear.');
}
function cyUpdate(dt) {
  const m = S.cyst, G = CY.G;
  m.open = damp(m.open, m.inc >= CY.N ? 1 : 0, 5, dt); m.q = damp(m.q, m.n / CY.NP, 3.5, dt); if (Math.abs(m.q - m.n / CY.NP) < 0.002) m.q = m.n / CY.NP;
  m.sag = damp(m.sag, m.rupt ? 1 : 0, 3, dt);
  cyShape();
  AN.side[CY.K].ovary.visible = false;
  CY.ov.position.copy(G.C); CY.ov.quaternion.setFromRotationMatrix(_cm.makeBasis(G.D, G.e, G.f));
  const hd = cyHolder('ovary');
  if (hd && hd.grab.cy) { // carry the jaws with the edge they hold
    const pl = hd.grab.pull; cySurf(Math.min(2.9, G.a + hd.grab.cy.dth), hd.grab.cy.az, 0, _c2).sub(G.H);
    if (_c2.distanceToSquared(pl.gp) > 1e-8) { if (freeDepth()) poseFromPoint(hd, _c3.copy(G.H).add(_c2)); else pl.slip.add(_c2).sub(pl.gp); pl.gp.copy(_c2); }
  }
  CY.cut.visible = m.inc > 0 && m.open < 0.6; CY.cut.position.copy(G.C); CY.cut.quaternion.copy(CY.ov.quaternion); CY.cut.geometry.setDrawRange(0, Math.min(m.inc, CY.N) * 4 * 6);
  CY.cy.visible = m.open > 0.02 && !m.out;
  if (m.free && m.bag < 0) { // free, it rolls off the ovary and comes to rest on the first thing under it
    if (m.rest == null) { RAY.set(_c2.copy(G.Q).addScaledVector(G.hv, 0.9), DOWN); const f = RAY.intersectObjects(PICKS, false).find(x => shown(x.object) && !['cyst', 'ovary', 'spill'].includes(x.object.userData.ent)); m.rest = _c2.setY((f ? f.point.y : -6.6) + CY.R * 0.92).sub(G.Q).clone(); if (m.rest.y > 0) m.rest.y = 0; }
    m.off.x = damp(m.off.x, m.rest.x, 2.5, dt); m.off.z = damp(m.off.z, m.rest.z, 2.5, dt); m.off.y = damp(m.off.y, m.rest.y, 4, dt);
  }
  CY.cy.position.copy(G.Q).add(m.off).addScaledVector(G.D, 0.24 * CY.R * m.sag); CY.cy.quaternion.setFromAxisAngle(_c3.crossVectors(G.D, G.hv), m.roll).multiply(CY.ov.quaternion);
  CY.cy.scale.set(1 - 0.3 * m.sag, 1 - 0.16 * m.sag, 1 - 0.16 * m.sag); // ruptured, it is slack: flatter, and narrower than the opening it lies in
  for (let i = 0; i < CY.spill.length; i++) { const sp = CY.spill[i], left = m.spill[i] || 0; sp.m.visible = left > 0; sp.m.position.copy(sp.at); sp.m.scale.setScalar(0.5 + 0.5 * Math.cbrt(Math.max(0, left))); }
  BAG.visible = m.bag >= 0 && !m.out;
  if (BAG.visible) { // bagged, it goes out through the port
    m.bag += dt; BAG.position.copy(CY.cy.position); BAG.scale.set(CY.R * 1.3, CY.R * 1.2, CY.R * 1.2); BAG.quaternion.copy(camera.quaternion);
    if (m.bag > 0.8) m.off.addScaledVector(_c2.subVectors(bagExit(), CY.cy.position), 1 - Math.exp(-2.2 * dt));
    if (m.bag > 2.4) { m.out = true; BAG.visible = false; toast(m.rupt ? 'The cyst wall is out in its bag' : 'The cyst is out in its bag, unruptured', 'ok'); uiDirty(); }
  }
}
const _cm = new THREE.Matrix4();
// energy on this ovary or its cyst: the case's own account, not an injury
function cyHeat(h, dt, e, side) {
  const m = S.cyst;
  if (e === 'cyst') { if (!m.rupt) { m.heat += dt * (h.inst === 'hook' ? 1.5 : 1); if (m.heat >= CY.HEAT) cyRupture('energy'); else hint('cyheat', 'That is the cyst wall. Energy on it goes through.'); } return true; }
  if (e !== 'ovary' || side !== CY.K) return false;
  if (h.inst === 'bipolar') { m.burn += dt; if (m.burn > CY.BURN && !m.warned) { m.warned = true; logEvent('tech', 'Prolonged coagulation of the ovary: the heat destroys follicles well beyond the point it is applied to. Touch the vessel and stop.'); } }
  return true;
}
function cyBite(h) { if (h.pick.ent === 'cyst' && h.pick.side === CY.K) cyRupture('grasp'); } // a grasper closed on the cyst itself
// The cortex is held: note where on it, as an angle outside the lip of the opening, so that the jaws go with that
// part of the edge as the cortex draws back.
function cyGrasped(h) {
  const g = h.grab, G = CY.G; if (g.ent !== 'ovary' || g.side !== CY.K) return;
  _c2.copy(h.pick.point).sub(G.C); const x = _c2.dot(G.D), y = _c2.dot(G.e), z = _c2.dot(G.f);
  g.cy = { az: Math.atan2(z, y) / DEG, dth: Math.max(0.12, Math.acos(clamp(x / Math.max(0.1, _c2.length()), -1, 1)) - G.a) }; g.pull.slip = new V3();
}
// suction on spilled contents clears them
function cySuction(h, dt) {
  const m = S.cyst;
  for (let i = 0; i < CY.spill.length; i++) {
    const sp = CY.spill[i]; if (!(m.spill[i] > 0)) continue;
    if (!(h.near && h.pick.mesh === sp.m) && h.tip.distanceTo(sp.at) > 0.8) continue;
    m.spill[i] -= dt / 1.6; if (m.spill[i] <= 0) { m.spill[i] = 0; sfx.ok(); toast('Cleared', 'ok'); uiDirty(); }
    return;
  }
}
const cySpill = () => { const m = S.cyst; for (let i = 0; i < CY.spill.length; i++) if (m.spill[i] > 0) return CY.spill[i]; return null; }; // spilled contents still to clear
const cyEnergy = (h, dt) => { // energy in the plane, by any instrument
  const m = S.cyst; if (m.free || !nearTarget(h, cyPlane(m.n, _w2), 0.75)) return false;
  hint('cyplane', 'No energy in the plane: heat beside the cyst wall goes through it. Push with the suction tip.');
  if (!m.rupt && h.pick.ent !== 'cyst') { m.heat += dt; if (m.heat >= CY.HEAT) cyRupture('energy'); } // on the cyst itself it is already counted (cyHeat)
  return true;
};

// ---------- steps ----------
const exSteady = { label: 'Ovary steadied with the grasper', ok: () => !!cyHolder() };
const CY_REC = { yaw: yawFor(CY.K), pitch: 0.3, push: 0.3 };
const cyFocus = o => o.copy(CY.G.C).addScaledVector(CY.G.D, CY.G.r * 0.9);
const CYS_STEPS = [
  {
    id: 'look', kind: 'survey', tool: 'any', phase: 'See', short: 'Survey the pelvis', title: 'Survey the pelvis and both ovaries', dist: 13, rec: { yaw: 0, pitch: 0.35, push: 0.35 }, expo: [],
    text: ['Look before you touch the cyst.', 'Find the uterus, the right ovary with its cyst, and the left ovary. Hold an instrument tip beside each of the three to mark it. No pinch or click is needed.', 'Check the surface of the cyst, the other ovary and the peritoneum for anything that does not look benign.'],
    pearl: 'Inspect first: the capsule of the cyst, the other ovary, the pouch of Douglas, the diaphragm and the omentum. Smooth, mobile and free of surface growths fits a benign cyst. Take washings before you start if you have any doubt, and stop and stage if what you see does not fit the scan.',
    tm: { U: 0, C: 0, O: 0 }, name: { U: 'uterus', C: 'cyst', O: 'left ovary' }, said: { U: 'Uterus', C: 'Right ovary: a smooth-walled cyst, no surface growths', O: 'Left ovary: looks normal' },
    pt(k, out) { return k === 'U' ? out.set(0, 8.4, -0.4).applyMatrix4(UT.M) : k === 'C' ? cySurf(0.25, 0, 0.5, out) : out.copy(curG(CY.O).ovC).add(_w2.set(0.45 * AN.side[CY.K].s, 0.45, 0.75)); },
    click(h) { if (h.inst !== 'bipolar' && h.inst !== 'hook') return false; hint('lookE', 'No energy yet. Hold the tip beside the uterus, the cyst and the other ovary to mark them.'); return true; },
    tick(dt) {
      const seen = S.cyst.seen;
      for (const k of ['U', 'C', 'O']) {
        if (seen[k]) continue;
        const p = this.pt(k, _w), near = HANDS.some(h => h.ptr.on && h.exch <= 0 && !h.firing && h.tip.distanceTo(p) < 1.3);
        this.tm[k] = near ? this.tm[k] + dt : Math.max(0, this.tm[k] - 2 * dt);
        if (this.tm[k] >= 1) { seen[k] = true; sfx.ok(); toast(this.said[k], 'ok'); uiDirty(); }
      }
    },
    next() { for (const k of ['U', 'C', 'O']) if (!S.cyst.seen[k]) return { p: this.pt(k, new V3()), act: 'hover', label: 'Hold near the ' + this.name[k], prog: this.tm[k] }; return null; },
    reset() { this.tm = { U: 0, C: 0, O: 0 }; },
    done() { const s = S.cyst.seen; return s.U && s.C && s.O; }, progress() { const s = S.cyst.seen; return (s.U ? 1 : 0) + (s.C ? 1 : 0) + (s.O ? 1 : 0) + ' of 3 identified'; },
    frac() { const s = S.cyst.seen; return ((s.U ? 1 : 0) + (s.C ? 1 : 0) + (s.O ? 1 : 0)) / 3; }, focus(o) { return o.set(0, -1.2, 3.6); },
    force() { const s = S.cyst.seen; s.U = s.C = s.O = true; }
  },
  {
    id: 'steady', kind: 'lift', tool: 'grasper', phase: 'Cystectomy', short: 'Steady the ovary', title: 'Steady the ovary by its ligament', dist: 11.5, rec: CY_REC, expo: [exSide(CY.K)], tm: 0,
    text: ['Take the atraumatic grasper in your left hand.', 'Grasp the utero-ovarian ligament, between the uterus and the ovary.', 'Keep hold. The free border of the ovary, away from its vessels, now faces the scope.'],
    pearl: 'Hold the ligament, never the cyst: a grasper on the cyst wall goes through it. The free border, opposite the hilum where the ovary\'s vessels enter, is where the cortex is thinnest and the incision bleeds least.',
    tick(dt) { this.tm = cyHolder() ? this.tm + dt : 0; },
    next() { return cyHolder() ? null : { p: cyUo(new V3()), act: 'grasp', keep: true, tool: 'grasper', hand: 'L', label: 'Grasp the utero-ovarian ligament' }; },
    reset() { this.tm = 0; },
    done() { return S.cyst.steady || this.tm > 0.6; }, progress() { return cyHolder() ? 'Held' : 'Not held'; }, frac() { return clamp(this.tm / 0.6, 0, 1); }, focus: cyFocus,
    force() { S.cyst.steady = true; }
  },
  {
    id: 'incise', kind: 'incise', tool: 'hook', phase: 'Cystectomy', short: 'Incise the cortex', title: 'Incise the cortex over the cyst', dist: 10.5, rec: CY_REC, expo: [exSide(CY.K), exSteady], acc: 0,
    text: ['Switch to the monopolar hook in your other hand.', 'Score the cortex along the marked line on the free border, in short bursts, starting at the marked end.', 'Stop the moment the cortex parts and the cyst wall shows: pale, smooth and yellow.'],
    pearl: 'Depth is the whole step. The cortex over a cyst this size is a millimetre or two thick, and the cyst wall lies directly under it. A shallow cut that you deepen is safe; one burst too long is a spill. Some surgeons first raise the cortex off the cyst with saline, or score it with cold scissors.',
    next() { const n = S.cyst.inc; return n >= CY.N ? null : { p: cyCut(n, 0, new V3()), act: 'trace', label: n === 0 ? 'Start here: hold to cut' : 'Trace' }; },
    path() { const a = []; for (let i = S.cyst.inc; i < CY.N; i++) a.push(cyCut(i, 0.03, new V3())); return a; },
    targets() { const n = S.cyst.inc, a = []; for (let i = n; i < Math.min(CY.N, n + 2); i++) a.push(cyCut(i, 0.03, new V3())); return a; },
    hook(h, dt) {
      const m = S.cyst, n = m.inc;
      if (n < CY.N && nearTarget(h, cyCut(n, 0, _w2), 0.5)) {
        this.acc += dt;
        if (this.acc > 0.14) { this.acc = 0; m.inc = n + 1; S.ebl += 1; sfx.click(); uiDirty(); if (n + 1 >= CY.N) toast('The cortex parts and the cyst wall shows. Stop.', 'ok'); }
        return true;
      }
      if (!(h.near && h.pick.ent === 'ovary' && h.pick.side === CY.K)) return false;
      let d = 9; for (let i = 0; i < Math.min(n, CY.N); i++) d = Math.min(d, h.tip.distanceTo(cyCut(i, 0, _w2)));
      if (d < 0.45) { m.deep += dt; if (m.deep >= CY.DEEP) cyRupture('deep'); else if (m.deep > 0.35) hint('cydeep', 'You are deepening a cut already made. The cyst wall is directly under it.'); } // on cortex already cut: deeper
      else { S.stats.nonTarget += dt; if (S.guided) hint('line', 'Follow the marked line along the free border'); }
      return true;
    },
    done() { return S.cyst.inc >= CY.N && S.cyst.open > 0.97; }, progress() { return 'Incision ' + Math.min(S.cyst.inc, CY.N) + ' / ' + CY.N; }, frac() { return S.cyst.inc / CY.N; }, focus: cyFocus,
    force() { S.cyst.inc = CY.N; S.cyst.open = 1; }
  },
  {
    id: 'strip', kind: 'enuc', tool: 'suction', assist: 'grasper', phase: 'Cystectomy', short: 'Enucleate the cyst', title: 'Develop the plane and enucleate the cyst', dist: 10.5, rec: CY_REC, expo: [exSide(CY.K)], acc: 0,
    text: ['Let go of the ligament and take the cut edge of the cortex in the grasper. This is your counter-traction: keep hold.', 'With the suction-irrigator in the other hand, push the cyst wall off the cortex at the marked place. Hold to work it, then move to the next.', 'Work round the cyst to its base. Do not grasp the cyst, and use no energy in the plane.'],
    pearl: 'The right plane is bloodless and opens easily, with cyst wall on one side and ovarian stroma on the other. If it bleeds or will not open, you are in the ovary. Irrigating through the suction tip opens the plane as well as pushing does. Toward the hilum the plane is less distinct and the vessels are larger: slow down there.',
    worker() { const g = cyHolder(); return HANDS.find(h => h !== g) || activeHand(); },
    next() {
      const m = S.cyst; if (m.free) return null;
      const g = cyHolder('ovary'), u = cyHolder('uo');
      if (!g && u) return { p: u.tip.clone(), act: 'click', tool: 'grasper', hand: u.key, label: 'Let go of the ligament' };
      if (!g) return { p: cyEdge(new V3()), act: 'grasp', keep: true, tool: 'grasper', hand: 'L', label: 'Grasp the cut edge of the cortex' };
      return { p: cyPlane(m.n, new V3()), act: 'suction', tool: 'suction', hand: g.key === 'L' ? 'R' : 'L', label: m.n >= CY.NP - 1 ? 'Free the base' : 'Push the cyst off the cortex here' };
    },
    targets() { return S.cyst.free ? [] : [cyPlane(S.cyst.n, new V3())]; },
    blunt(h, dt) {
      const m = S.cyst; if (m.free || !nearTarget(h, cyPlane(m.n, _w2), 0.75)) return;
      if (!cyHolder('ovary')) { hint('cytrac', (cyHolder() ? 'Let go of the ligament and hold' : 'Hold') + ' the cut edge of the cortex with the grasper: the plane opens against counter-traction'); return; }
      this.acc += dt; S.stats.blunt += dt; if (this.acc < CY.PUSH) return;
      this.acc = 0; m.n++; S.ebl += 2; sfx.click(); uiDirty();
      if (m.n === 5) toast('The widest part of the cyst is through. Roll it back and work toward the base.', 'ok');
      else if (m.n === CY.NP - 1) toast('Only the base holds it now', 'ok');
      else if (m.n >= CY.NP) { m.free = true; toast(m.rupt ? 'The cyst wall is out of the ovary' : 'The cyst is out of the ovary, unruptured', 'ok'); }
    },
    hook: cyEnergy, bipolar: cyEnergy,
    done() { return S.cyst.free && Math.abs(S.cyst.q - 1) < 0.01; },
    progress() { const m = S.cyst; return m.free ? 'Free' : 'Plane ' + m.n + ' / ' + CY.NP + (cyHolder('ovary') ? '' : ' · no counter-traction'); }, frac() { return S.cyst.n / CY.NP; },
    focus(o) { return o.lerpVectors(cyFocus(_c3), CY.G.Q, 0.5); },
    force() { const m = S.cyst; m.inc = CY.N; m.n = CY.NP; m.q = 1; m.free = true; }
  },
  {
    id: 'bag', kind: 'bag', tool: 'any', phase: 'Cystectomy', short: 'Remove the cyst', title: 'Remove the cyst in a bag', dist: 12.5, rec: null, expo: [],
    text: ['Place the cyst in a retrieval bag without puncturing it.', 'Bring the mouth of the bag out through the umbilical port, decompress the cyst inside the bag, and withdraw it.'],
    pearl: 'What a dermoid holds is an irritant: sebum and hair left in the abdomen can cause a chemical peritonitis. Open the cyst only inside the bag. If it spills, wash out with litres of warm fluid until the return is clear, and take out every fragment you can see.',
    ready() { const m = S.cyst; return m.free && m.bag < 0 && !m.out; },
    button: { label: 'Bag the cyst and take it out', fn() { if (!STEPS[S.step].ready()) return; S.cyst.bag = 0; uiDirty(); }, hide: () => !STEPS[S.step].ready() },
    next() { return this.ready() ? { p: cyTop(0, new V3()), act: 'button', label: 'Bag the cyst' } : null; },
    done() { return S.cyst.out; }, progress() { return S.cyst.bag >= 0 ? 'Coming out' : ''; }, frac() { return clamp(S.cyst.bag / 2.4, 0, 1); }, focus: cyFocus,
    force() { const m = S.cyst; m.free = true; m.out = true; }
  },
  {
    id: 'bed', kind: 'hemo', tool: 'bipolar', phase: 'Completion', short: 'Haemostasis of the bed', title: 'Control bleeding in the ovarian bed', dist: 9.5, rec: CY_REC, expo: [exSide(CY.K)],
    text: ['Look into the bed. Two vessels are bleeding.', 'Touch each with the bipolar for the shortest burst that stops it.', 'Leave the ovary open. Its edges fall together.'],
    pearl: 'Every second of coagulation in this bed costs follicles. Find the vessel, touch it, stop. Irrigate to show the point so that you can be exact. Do not paint the bed, and keep off the hilum. If a point will not stop, a suture or a haemostatic agent costs the ovary less than more heat.',
    // the two vessels are on the side of the bed that the tube does not lie across
    enter() { const m = S.cyst; if (m.bed) return; m.bed = true; addBleeder(o => cyBed(0.45, 160, o), 22, false, 'ovarian bed'); addBleeder(o => cyBed(0.75, 50, o), 14, false, 'ovarian bed'); toast('Two vessels are bleeding in the bed', 'bleed'); },
    next() { return null; },
    done() { return S.cyst.bed; }, progress() { return S.bleeders.length ? S.bleeders.length + ' bleeding point' + (S.bleeders.length > 1 ? 's' : '') : 'Dry'; }, frac() { return S.cyst.bed ? 1 - S.bleeders.length / 2 : 0; },
    focus(o) { return cyBed(0, 0, o); },
    force() { S.cyst.bed = true; S.bleeders.length = 0; }
  },
  {
    id: 'final', kind: 'final', tool: 'any', phase: 'Completion', short: 'Wash out and check', title: 'Wash out and check at low pressure', dist: 12, rec: null, expo: [],
    text: ['Drop the pneumoperitoneum to 8 mmHg and look at the bed again.', 'Control any ooze with one touch of the bipolar.', 'Irrigate and aspirate. If the cyst spilled, clear every trace of its contents.'],
    pearl: 'Record whether the cyst came out intact, and how the other ovary looked: roughly one dermoid in ten is bilateral. Send the cyst for histology. Tell her what was done to the ovary, since that bears on her fertility and on follow-up.',
    button: { label: 'Lower pressure to 8 mmHg', fn() { if (S.lowP) return; S.lowP = true; S.pressureGoal = 8; addBleeder(o => cyBed(0.45, -150, o), 8, false, 'ovarian bed'); toast('Pressure down: a little ooze from the bed', 'bleed'); uiDirty(); }, hide: () => S.lowP },
    button2: { label: 'End the case', fn() { endCase(); }, show: () => S.lowP && !S.bleeders.length && S.pool < 8 && !cySpill() },
    next() {
      if (!S.lowP) return { p: cyBed(0, 0, new V3()), act: 'button', label: 'Lower the pressure' };
      if (S.bleeders.length) return null;
      const sp = cySpill();
      if (sp) return { p: _w.copy(sp.at).setY(sp.at.y + 0.1).clone(), act: 'suction', label: 'Spilled contents: hold the suction on them' };
      if (S.pool >= 8) return { p: poolSpot().clone(), act: 'suction', label: 'Aspirate the pool' };
      return { p: cyBed(0, 0, new V3()), act: 'button', label: 'End the case' };
    },
    done() { return S.ended; },
    progress() { const n = S.cyst.spill.filter(v => v > 0).length; return !S.lowP ? 'At 15 mmHg' : S.bleeders.length ? 'Ooze to control' : n ? 'Spilled contents to clear: ' + n : S.pool >= 8 ? 'Blood to aspirate: ' + Math.round(S.pool) + ' mL' : 'Clean and dry'; },
    frac() { return (S.lowP ? 0.3 : 0) + (S.lowP && !S.bleeders.length ? 0.3 : 0) + (S.lowP && S.pool < 8 ? 0.2 : 0) + (cySpill() ? 0 : 0.2); }, focus: cyFocus,
    force() { S.lowP = true; S.bleeders.length = 0; S.pool = 0; S.cyst.spill.fill(0); endCase(); }
  }
];

// ---------- scoring, debrief ----------
function cyScore() {
  const s = S.stats, m = S.cyst, inj = Object.keys(S.injuries).length;
  let pts = 100; const notes = [];
  if (inj) { pts -= 25 * inj; notes.push(inj + ' organ or vessel injur' + (inj > 1 ? 'ies' : 'y')); }
  if (m.rupt) { pts -= 10; notes.push('The cyst ruptured and its contents spilled'); }
  if (m.burn > CY.BURN) { pts -= Math.min(10, Math.ceil(m.burn - CY.BURN)); notes.push('Bipolar on the ovary for ' + m.burn.toFixed(1) + ' s'); }
  if (s.expoMiss) { pts -= Math.min(12, 2 * s.expoMiss); notes.push(s.expoMiss + ' step' + (s.expoMiss > 1 ? 's' : '') + ' started without the recommended exposure'); }
  if (S.ebl > CYS.eblWarn) { pts -= Math.min(20, Math.round((S.ebl - CYS.eblWarn) / 20)); notes.push('Blood loss above ' + CYS.eblWarn + ' mL'); }
  const tech = S.events.filter(e => e.type === 'tech').length - (m.rupt ? 1 : 0) - (m.warned ? 1 : 0);
  if (tech > 0) { pts -= Math.min(10, 2 * tech); notes.push(tech + ' point' + (tech > 1 ? 's' : '') + ' of technique in the event log'); }
  if (s.nonTarget > 3) { pts -= Math.min(6, Math.round(s.nonTarget)); notes.push('Energy applied off target for ' + s.nonTarget.toFixed(1) + ' s'); }
  pts = Math.max(0, Math.round(pts));
  return { pts, grade: pts >= 90 ? 'Proficient' : pts >= 75 ? 'Competent' : pts >= 60 ? 'Developing' : 'Needs review', notes };
}
function cyDebrief(row) {
  const s = S.stats, m = S.cyst, inj = Object.keys(S.injuries).length;
  return [
    row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + row('Cyst removed intact', m.rupt ? 'No' : m.out ? 'Yes' : 'n/a', m.rupt ? 'warn' : 'ok') + (m.rupt ? row('How it ruptured', { grasp: 'Grasped', deep: 'Incision too deep', energy: 'Energy on its wall' }[m.rupt]) : ''),
    row('Bipolar on the ovary', m.burn.toFixed(1) + ' s', m.burn > CY.BURN ? 'warn' : 'ok') + row('Blunt dissection', s.blunt.toFixed(0) + ' s') + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok')
  ];
}
const CYS = {
  id: 'cyst', name: 'Laparoscopic ovarian cystectomy', tag: ', right ovarian dermoid', blurb: 'Dermoid cyst of the right ovary, fertility-sparing. 7 steps.',
  sub: '4 cm dermoid cyst of the right ovary. The ovary is to be kept.',
  brief: ['24-year-old with intermittent right-sided pelvic pain. Ultrasound: a 4 cm right ovarian cyst with an echogenic nodule and acoustic shadowing, typical of a dermoid (mature cystic teratoma). No free fluid, normal tumour markers, normal left ovary. She has no children yet and wants the ovary kept.',
    'She is in lithotomy with a uterine manipulator in place. 10 mm umbilical scope, two 5 mm lateral ports, pneumoperitoneum at 15 mmHg. You are looking toward the pelvis: her right is on the right of the screen. The aim is to take the cyst out whole and leave as much working ovary as possible.'],
  steps: CYS_STEPS, insts: ['grasper', 'hook', 'bipolar', 'suction'], warp: [0, 0], tipZ: 4.6, ureters: false, eblWarn: 100, needleHint: '',
  spare: { tube: 1 }, // both tubes are staying: energy on either is an injury. So is energy on the other ovary, as in every case.
  labels: [['Dermoid cyst', () => (S.cyst.open > 0.5 ? cyTop(0.5, _w) : cySurf(0.2, 0, 0.6, _w)), () => !S.cyst.out]],
  state(s) { s.cyst = { seen: { U: false, C: false, O: false }, steady: false, inc: 0, open: 0, deep: 0, n: 0, q: 0, roll: 0, heat: 0, rupt: null, sag: 0, spill: CY.spill.map(() => 0), free: false, rest: null, off: new V3(), bag: -1, out: false, bed: false, burn: 0, warned: false }; CY.G.key = ''; },
  show: cyShow, update: cyUpdate, suction: cySuction, heat: cyHeat, bite: cyBite, grasped: cyGrasped,
  score: cyScore, debrief: cyDebrief, sutures: () => ({ st: [], from: null, on: false }),
  want: (st, n) => (n.act === 'grasp' ? { ents: [st.id === 'steady' ? 'uo' : 'ovary'], side: CY.K } : n.act === 'trace' ? { ents: ['ovary'], side: CY.K } : null) // what a scripted hand should find under its tip
};
