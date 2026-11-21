// ---------- case: laparoscopic supracervical hysterectomy ----------
// The hysterectomy's steps on each side as far as the uterine vessels, then the body of the uterus is cut off its cervix. The cervix, with its
// cardinal and uterosacral ligaments, stays. The sacrocolpopexy (next file) starts from where this ends.
const LS = { YA: 2.6, N: 12, CONE: 0.45 }; // YA: the level of the cut, at the internal os; N: segments round it; CONE: how far the cut dips toward the canal

// The uterus in two pieces, divided at LS.YA. top: the body, closed below by its cut face. Otherwise the cervix, closed above by its.
function lsPiece(top) {
  const tA = Math.asin(LS.YA / 8.6) / (Math.PI / 2), F = top ? 0.16 : 0.42; // F: the share of the rows that make the cut face
  return paramSurface(72, top ? 56 : 24, (u, v, p, c) => {
    const face = top ? v < F : v > 1 - F;
    if (!face) { utVertex(u, top ? lerp(tA, 1, (v - F) / (1 - F)) : lerp(0, tA, v / (1 - F)), p, c); return; }
    const q = top ? v / F : (1 - v) / F; // 0 at the canal, 1 at the rim
    utVertex(u, tA, p, c); p.x *= q; p.z *= q; p.y = LS.YA - LS.CONE * (1 - q * q);
    // cauterised muscle: blanched, scorched at the rim, the canal a dark spot at its centre
    const rim = sstep(0.8, 0.97, q), can = 1 - sstep(0.08, 0.2, q);
    c[0] = lerp(lerp(1.12, 0.5, rim), 0.55, can); c[1] = lerp(lerp(1.14, 0.34, rim), 0.2, can); c[2] = lerp(lerp(1.02, 0.26, rim), 0.2, can);
  }, { closedU: true, su: 3, sv: 3 });
}
(function () {
  LS.corpus = reg(new THREE.Mesh(lsPiece(true), MAT.uterus), 'uterus'); LS.corpus.visible = false; UT.g.add(LS.corpus);
  LS.stump = reg(new THREE.Mesh(lsPiece(false), MAT.uterus), 'stump'); LS.stump.visible = false; VG.g.add(LS.stump);
  // where the hook has been round the cervix: a scorched groove
  LS.segs = []; const charM = new THREE.MeshStandardMaterial({ color: 0x1e0d08, roughness: 0.95 }), r = utR(LS.YA) + 0.02;
  for (let k = 0; k < LS.N; k++) {
    const sg = new THREE.TorusGeometry(r, 0.11, 8, 6, TAU / LS.N); sg.rotateZ((k / LS.N) * TAU - TAU / (2 * LS.N)); sg.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(sg, charM); m.scale.z = utAP(LS.YA); m.position.y = LS.YA; m.visible = false; UT.g.add(m); LS.segs.push(m);
  }
  // the canal, once coagulated
  LS.char = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshStandardMaterial({ color: 0x24100a, roughness: 0.95, transparent: true, opacity: 0 }));
  LS.char.rotation.x = -Math.PI / 2; LS.char.position.y = LS.YA - LS.CONE + 0.04; LS.char.visible = false; VG.g.add(LS.char);
})();
const lsAmpPt = (k, out) => { const a = (k / LS.N) * TAU, r = utR(LS.YA) + 0.03; return out.set(r * Math.cos(a), LS.YA, r * Math.sin(a) * utAP(LS.YA)).applyMatrix4(UT.M); };
const lsCanal = out => out.set(0, LS.YA - LS.CONE + 0.05, 0).applyMatrix4(VG.M);
const lsEdge = (phiDeg, out) => utSurf(phiDeg, LS.YA, -0.25, out).applyMatrix4(VG.M); // a point on the stump's cut face, just inside its rim
// off: the body is off the cervix. done: this is the pelvis as the supracervical hysterectomy leaves it.
function lsState(s, done) { s.lsh = { amp: new Array(LS.N).fill(done ? 1 : 0), off: done, bag: -1, canal: done ? 1 : 0, bled: done }; }
// The cardinal ligaments are not divided: when the body comes off they stay where the cervix is.
function lsHold() { for (const k of ['R', 'L']) { const st = S.side[k], g = new SideGeom(st.s); st.rel.card = { t: 1, settled: true, stay: true, ref: g, lat: g, T: new THREE.Matrix4() }; } }
function lsFree() {
  const m = S.lsh; if (m.off) return;
  m.off = true; lsHold(); for (const k of ['L', 'R']) if (HAND[k].grab) releaseGrab(HAND[k]);
  S.manipOut = true; S.poseGoal.yaw = 0; S.poseGoal.pitch = PITCH0; S.poseGoal.push = 0;
  toast('The body of the uterus is free. The manipulator is withdrawn.', 'ok'); uiDirty();
}
function lsShow() { // for either case that keeps the cervix; which one is in hand is CASE's business
  const on = !!CASE.cervix; for (const m of UT.cup) m.visible = !on;
  if (!on) { LS.corpus.visible = LS.stump.visible = LS.char.visible = false; for (const m of LS.segs) m.visible = false; }
}
function lsUpdate(dt) {
  const m = S.lsh;
  UT.mesh.visible = !m.off; LS.corpus.visible = LS.stump.visible = m.off;
  for (let k = 0; k < LS.N; k++) LS.segs[k].visible = m.amp[k] >= 1 && !m.off;
  LS.char.visible = m.canal > 0.02; LS.char.material.opacity = 0.9 * sstep(0, 1, m.canal); LS.char.scale.setScalar(0.5 + 0.5 * m.canal);
  if (m.off && S.specimen === 'in') S.lift = damp(S.lift, 1, 3, dt);
  BAG.visible = m.bag >= 0 && S.specimen === 'in';
  if (BAG.visible) { // bagged, the body of the uterus and its tubes go out by the port
    m.bag += dt; BAG.position.set(0, 5.4, 0).applyMatrix4(UT.M); BAG.quaternion.setFromRotationMatrix(UT.M); BAG.scale.set(3.9, 4.6, 3.3).multiplyScalar(sstep(0, 0.8, m.bag));
    if (m.bag > 0.9) S.carry.addScaledVector(_w.subVectors(bagExit(), BAG.position), 1 - Math.exp(-2.2 * dt));
    if (m.bag > 2.7) { S.specimen = 'out'; BAG.visible = false; toast('The uterus is out in its bag', 'ok'); uiDirty(); }
  }
}

const exPushU = { label: 'Uterus pushed cephalad', ok: exPush.ok };
const lsVessel = k => Object.assign(VESSEL_STEPS(k)[0], {
  expo: [exPushU, exSide(k)],
  text: ['Push the uterus cephalad and deviate it to the patient\'s ' + OPP[k] + '.', 'Seal the skeletonized uterine vessels at the level of the internal os, at a right angle to them, three times: against the uterus, beside that burn, then between the two.', 'Cut through the middle burn. Go no lower: the cardinal and uterosacral ligaments stay with the cervix.'],
  pearl: 'This is the ascending branch, taken where it meets the uterus. The ureter passes under the uterine artery 1.5 to 2 cm lateral to here, so stay on the uterus. Once both sides are sealed the body of the uterus blanches.'
});
const TLH_FINAL = TLH_STEPS.find(s => s.id === 'final');
// the bladder on one side, only as far as the amputation needs
const lsBladder = (k, from, full) => bladderStep(k, from, full, {
  us: k === 'R' ? [0.62, 0.84] : [0.38, 0.16], title: 'Mobilize the bladder on the ' + WORD[k], expo: [exPushU],
  text: ['Push the uterus cephalad.', 'Hold the closed jaws of the bipolar, or the grasper, at the edge of the bladder on this side. No pinch or click is needed: held there, the instrument sweeps the bladder caudally off the lower uterine segment.', 'Stop when the bladder is clear of the internal os. There will be no colpotomy, so it need go no lower.'],
  pearl: 'A supracervical hysterectomy needs the bladder only just below the level of the amputation. If mesh is to be laid on the anterior vaginal wall afterwards, that dissection is carried further at that stage, with the vagina on a probe.'
});
const LSH_STEPS = [
  TLH_STEPS.find(s => s.id === 'survey'),
  ...['R', 'L'].flatMap(k => [...UPPER_STEPS(k), lsBladder(k, k === 'R' ? 0 : 0.25, k === 'R' ? 0.25 : 0.5), lsVessel(k)]),
  {
    id: 'amp', kind: 'colp', tool: 'hook', phase: 'Amputation', short: 'Amputate the uterus', title: 'Amputate the body of the uterus from the cervix', dist: 9.5,
    rec: { yaw: 0, pitch: -0.1, push: 1 }, expo: [exPushU],
    text: ['Both uterine pedicles are sealed and the body of the uterus has blanched.', 'With the hook, cut across the cervix at the level of the internal os, just below the sealed pedicles. Start in front and work round each side.', 'Antevert the uterus to finish the back. Angle the cut down toward the canal so that the stump is left as a shallow cone.'],
    pearl: 'Cut at or just below the internal os and take the upper canal with the specimen: endometrium left on the stump is what bleeds each month afterwards. The tip of the manipulator is metal, so bring it down out of the way before the cut reaches the canal. A monopolar loop makes this cut in one pass.',
    vis: [], visT: 0,
    refresh() { if (S.t < this.visT) return; this.visT = S.t + 0.18; for (let k = 0; k < LS.N; k++) this.vis[k] = S.lsh.amp[k] >= 1 ? false : visibleAt(lsAmpPt(k, _w2), 0.7); },
    next() {
      const a = S.lsh.amp; this.refresh(); let best = -1, bd = 1e9;
      const h = HANDS.find(x => x.inst === 'hook') || activeHand();
      for (let k = 0; k < LS.N; k++) if (a[k] < 1 && this.vis[k]) { const d = lsAmpPt(k, _w2).distanceTo(h.tip); if (d < bd) { bd = d; best = k; } }
      if (best >= 0) return { p: lsAmpPt(best, new V3()), act: 'trace', label: 'Cut across the cervix' };
      for (let k = 0; k < LS.N; k++) if (a[k] < 1) return { p: lsAmpPt(k, new V3()), act: 'trace', label: 'Reposition the uterus to expose the rest', hidden: true };
      return null;
    },
    dots() { const a = []; for (let k = 0; k < LS.N; k++) a.push({ p: lsAmpPt(k, new V3()), done: S.lsh.amp[k] >= 1, vis: !!this.vis[k] }); return a; },
    targets() { const a = []; for (let k = 0; k < LS.N; k++) if (S.lsh.amp[k] < 1) a.push(lsAmpPt(k, new V3())); return a; },
    hook(h, dt) {
      const a = S.lsh.amp; let any = false;
      for (let k = 0; k < LS.N; k++) if (a[k] < 1 && nearTarget(h, lsAmpPt(k, _w2), 0.62)) { any = true; a[k] += dt / 0.16; if (a[k] >= 1) { S.ebl += 1.2; sfx.click(); uiDirty(); } }
      if (a.every(c => c >= 1)) lsFree();
      return any || h.pick.ent === 'uterus';
    },
    done() { return S.lsh.off && S.lift > 0.9; }, progress() { return S.lsh.amp.filter(c => c >= 1).length + ' / ' + LS.N + ' segments'; }, frac() { return S.lsh.amp.filter(c => c >= 1).length / LS.N; },
    focus(o) { return o.set(0, LS.YA, 0).applyMatrix4(UT.M); },
    force() { S.lsh.amp.fill(1); lsFree(); S.lift = 1; }
  },
  {
    id: 'bag', kind: 'bag', tool: 'any', phase: 'Amputation', short: 'Remove the specimen', title: 'Remove the uterus in a bag', dist: 13, rec: null, expo: [],
    text: ['The body of the uterus lies free in the pelvis with both tubes on it.', 'Place it in a containment bag.', 'Bring the mouth of the bag out through the umbilical incision, extended as needed, and take the specimen out in pieces with a scalpel inside the bag.'],
    pearl: 'Never morcellate outside a bag. An unsuspected sarcoma is rare, but uncontained morcellation spreads it, and benign fragments left behind can implant as well. This is part of consent before the day. Check that the bag is intact when it is out.',
    ready() { return S.lsh.off && S.lsh.bag < 0 && S.specimen === 'in'; },
    button: { label: 'Bag the uterus and take it out', fn() { if (!STEPS[S.step].ready()) return; S.lsh.bag = 0; S.carry = new V3(); uiDirty(); }, hide: () => !STEPS[S.step].ready() },
    next() { return this.ready() ? { p: _w.set(0, 5.4, 0).applyMatrix4(UT.M).clone(), act: 'button', label: 'Bag the uterus' } : null; },
    done() { return S.specimen === 'out'; }, progress() { return S.lsh.bag >= 0 ? 'Coming out' : ''; }, frac() { return clamp(S.lsh.bag / 2.7, 0, 1); }, focus(o) { return o.set(0, 3, 0).applyMatrix4(VG.M); },
    force() { S.lsh.amp.fill(1); lsFree(); S.specimen = 'out'; }
  },
  {
    id: 'stump', kind: 'hemo', tool: 'bipolar', phase: 'Completion', short: 'Secure the stump', title: 'Secure the cervical stump', dist: 7.5, rec: null, expo: [],
    text: ['With the specimen out, look at the stump. A vessel is bleeding at its edge.', 'Touch it with the bipolar until it stops.', 'Then coagulate the lining of the canal, at the centre of the stump.'],
    pearl: 'Coagulating or coring out the top of the canal is meant to destroy any endometrium left on the stump. It lowers the chance of cyclical spotting but does not abolish it, and she should hear that beforehand. She keeps her cervix, so cervical screening goes on as before.',
    enter() { const m = S.lsh; if (m.bled) return; m.bled = true; addBleeder(o => lsEdge(70, o), 18, true, 'cervical stump'); toast('A cervical branch is bleeding at the edge of the stump', 'bleed'); },
    next() { return S.lsh.canal < 1 ? { p: lsCanal(new V3()), act: 'seal', label: 'Coagulate the canal', prog: S.lsh.canal } : null; },
    targets() { return S.lsh.canal < 1 ? [lsCanal(new V3())] : []; },
    bipolar(h, dt) { const m = S.lsh; if (m.canal >= 1 || !nearTarget(h, lsCanal(_w2), 0.6)) return h.pick.ent === 'stump'; m.canal = Math.min(1, m.canal + dt / 1.6); sustain('bip', 440 + 190 * m.canal, 'sine', 0.07); if (m.canal >= 1) { sfx.sealDone(); toast('Canal coagulated', 'ok'); uiDirty(); } return true; },
    done() { return S.lsh.bled && S.lsh.canal >= 1; }, progress() { return S.bleeders.length ? 'Bleeding at the stump' : S.lsh.canal >= 1 ? 'Dry, canal coagulated' : 'Canal ' + Math.round(S.lsh.canal * 100) + '%'; },
    frac() { return (S.lsh.bled && !S.bleeders.length ? 0.5 : 0) + 0.5 * S.lsh.canal; }, focus(o) { return o.set(0, LS.YA, 0).applyMatrix4(VG.M); },
    force() { const m = S.lsh; m.bled = true; m.canal = 1; S.bleeders.length = 0; }
  },
  Object.assign({}, TLH_FINAL, {
    phase: 'Completion',
    text: ['Drop the pneumoperitoneum to 8 mmHg and inspect the pedicles and the stump.', 'Control any ooze with short bipolar bursts.', 'Aspirate pooled blood, then hold a tip beside each ureter for a moment to confirm peristalsis.'],
    pearl: 'Venous bleeding that 15 mmHg tamponades shows itself at 8. Some surgeons close the peritoneum over the stump. If a sacrocolpopexy follows, the stump is left open for the mesh.',
    button: { label: 'Lower pressure to 8 mmHg', fn() { if (S.lowP) return; S.lowP = true; S.pressureGoal = 8; addBleeder(o => lsEdge(-110, o), 12, false, 'cervical stump'); S.oozeDone = true; toast('Pressure down: venous ooze at the edge of the stump', 'bleed'); uiDirty(); }, hide: () => S.lowP }
  })
];
function lsDebrief(row) {
  const s = S.stats, m = S.lsh, inj = Object.keys(S.injuries).length;
  const uad = k => (s['uaDist' + k] != null ? s['uaDist' + k].toFixed(1) + ' cm' : 'n/a'), minU = Math.min(s.minUreter.R, s.minUreter.L);
  return [
    row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + row('Near misses at the ureter', s.nearMiss, s.nearMiss ? 'warn' : 'ok') + row('Pedicles cut without a full seal', s.unsealedCuts, s.unsealedCuts ? 'warn' : 'ok') + row('Seal to ureter, right uterine pedicle', uad('R')) + row('Seal to ureter, left uterine pedicle', uad('L')) + row('Closest energy to a ureter', minU < 90 ? minU.toFixed(1) + ' cm' : 'n/a'),
    row('Cervix', m.off ? 'Kept, with its cardinal and uterosacral ligaments' : 'n/a') + row('Canal coagulated', m.canal >= 1 ? 'Yes' : 'No', m.canal >= 1 ? 'ok' : 'warn') + row('Specimen removed', S.specimen === 'out' ? 'In a bag' : 'n/a') + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok') + row('Left-hand traction used', s.traction + ' time' + (s.traction === 1 ? '' : 's'))
  ];
}
const LSH = {
  id: 'lsh', name: 'Laparoscopic supracervical hysterectomy', tag: ', bilateral salpingectomy', blurb: 'Cervix kept, ahead of a sacrocolpopexy. 19 steps.',
  sub: 'With bilateral salpingectomy. Cervix and ovaries conserved.',
  brief: ['48-year-old, three vaginal births, with a bulge at the introitus and a feeling of incomplete emptying. Stage III uterovaginal prolapse, apical and anterior. A pessary would not stay in. Regular periods, normal cervical screening, normal ultrasound. She has chosen a sacrocolpopexy, with a supracervical hysterectomy first: mesh fixed to a cervix that has been kept is less likely to be exposed later than mesh fixed to a fresh vaginal cuff.',
    'She is in lithotomy and steep Trendelenburg with a uterine manipulator in place. 10 mm umbilical scope, two 5 mm lateral ports, pneumoperitoneum at 15 mmHg. You are looking toward the pelvis: her right is on the right of the screen. This case ends with the uterus out and the stump dry. The sacrocolpopexy is the next case.'],
  steps: LSH_STEPS, insts: ['grasper', 'bipolar', 'hook', 'suction'], warp: [0, 0], tipZ: 4.6, ureters: true, eblWarn: 100, needleHint: '',
  cervix: true, // the cervix stays: there is no cup, no colpotomy and no cuff
  labels: [['Uterus', () => _w.set(0, 7.6, 0).applyMatrix4(UT.M), () => S.specimen !== 'out'], ['Cervical stump', () => _w.set(0, LS.YA, 0).applyMatrix4(VG.M), () => S.lsh.off]],
  state(s) { lsState(s, false); }, show: lsShow, update: lsUpdate,
  score: tlhScore, debrief: lsDebrief, sutures: () => ({ st: [], from: null, on: false }), force: tlhForce, want: tlhWant
};
