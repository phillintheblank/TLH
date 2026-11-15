// ---------- case: laparoscopic salpingectomy for a ruptured tubal ectopic pregnancy ----------
// The pelvis as the model has it, with three things added: blood (the pool every case has, begun full and spread
// wide), clots lying in and over it, and a pregnancy in the ampulla of one tube, ruptured and still bleeding. That
// bleeding is not one of the engine's bleeding points, which bipolar on the spot controls: it comes from the vessels
// in the mesosalpinx and stops when they are sealed.
const EC = {
  K: 'R', U: 0.58, W: 0.12, R: 0.62, // the side; where along the tube the pregnancy lies, how far it reaches either way (shares of the tube's length), how far it stands out (cm)
  BLOOD: 500, OOZE: 30, SEE: 80, DRY: 15, // mL in the pelvis on entry; mL a minute from the rupture; mL left that still lets you see; mL left at the end
  UT: 0.15, FLUSH: 0.07, LONG: 0.26, FAR: 0.33, // along the tube: where the isthmus is divided, about 1 cm from the cornu; nearer than FLUSH is on the cornu, beyond LONG leaves a long stump, beyond FAR is not the isthmus
  col: C(112, 46, 88), clots: [], knob: null,
  // each clot: on the tube (d: its place from the pregnancy) or on the pelvic floor at x, z; its size; the seconds of suction it takes; whether it must go before the adnexa can be seen
  DEF: [{ on: true, d: V(0.15, 0.25, 0.45), r: [1.5, 0.85, 1.15], T: 2.4, need: true }, { x: 1.3, z: 3.5, r: [1.2, 0.6, 0.95], T: 1.8 }, { x: 3.4, z: 5.9, r: [1.0, 0.5, 0.8], T: 1.6 }, { x: -0.9, z: 6.6, r: [1.5, 0.65, 1.1], T: 1.8 }]
};
EC.O = EC.K === 'R' ? 'L' : 'R';
// how the tube with the pregnancy differs from the model's: swollen, and dusky blue-purple where its wall is stretched over blood
EC.look = {
  rad: u => EC.R * Math.exp(-Math.pow((u - EC.U) / EC.W, 2)),
  col(u, c) { const q = Math.exp(-Math.pow((u - EC.U) / (EC.W * 1.4), 2)); c[0] = lerp(c[0], EC.col[0], q); c[1] = lerp(c[1], EC.col[1], q); c[2] = lerp(c[2], EC.col[2], q); }
};
const _e1 = new V3(), _e2 = new V3(), DOWN = V(0, -1, 0);
function ectPt(u, lift, out) { sampleArr(curG(EC.K).tubeCur, u, out); out.y += lift; return out; } // a point on that tube, or above it
const ectHolder = () => HANDS.find(h => h.grab && h.grab.pull && h.grab.ent === 'tube' && h.grab.side === EC.K); // the hand that has the tube
const ectLen = () => { const a = curG(EC.K).tubeAtt; let L = 0; for (let i = 1; i < a.length; i++) L += a[i].distanceTo(a[i - 1]); return L; };
const ectStump = out => sampleArr(curG(EC.K).tubeAtt, Math.max(0.02, S.side[EC.K].isth.uc - 0.04), out);
(function () {
  const lump = (seed, r) => paramSurface(22, 14, (u, v, p) => {
    const th = u * TAU, sv = Math.sin(Math.PI * v), cv = Math.cos(Math.PI * v), k = 1 + 0.34 * (fbm3(sv * Math.sin(th) * 1.8 + seed, cv * 1.8 + 1, sv * Math.cos(th) * 1.8, 2) - 0.5);
    p.set(-cv * r[0] * k, sv * Math.sin(th) * r[1] * k, sv * Math.cos(th) * r[2] * k);
  }, { closedU: true, su: 2, sv: 1, flip: true });
  EC.DEF.forEach((def, i) => { const m = reg(new THREE.Mesh(lump(3 + i * 7, def.r), MAT.clot), 'clot'); m.rotation.y = i * 1.3; scene.add(m); EC.clots.push({ def, m, at: new V3() }); });
  EC.knob = new THREE.Mesh(lump(41, [0.3, 0.16, 0.24]), MAT.clot); scene.add(EC.knob); // clot in the rupture itself
})();
function ectShow(on) { if (!on) { for (const c of EC.clots) c.m.visible = false; EC.knob.visible = false; } }

// the tube is cut free: from here it keeps its shape and goes where it is carried
function ectFree() {
  const st = S.side[EC.K], h = ectHolder(), m = S.ect;
  st.spec = { pts: curG(EC.K).tubeCur.map(p => p.clone()), off: new V3(), gone: false };
  if (h) { for (const p of st.spec.pts) p.sub(h.grab.pull.off); h.grab.pull.max = 99; } // held: it stays in the jaws, and now comes away whole
  m.rest = null;
}
function ectUpdate(dt) {
  const m = S.ect, st = S.side[EC.K], sp = st.spec, held = ectHolder();
  for (let i = 0; i < EC.clots.length; i++) {
    const c = EC.clots[i], left = m.clots[i];
    if (c.def.on) ectPt(EC.U, 0, c.at).add(c.def.d);
    c.m.visible = left > 0; c.m.position.copy(c.at); c.m.scale.setScalar(0.45 + 0.55 * Math.cbrt(Math.max(0, left)));
  }
  const top = lerp(0.15, 0.27, sstep(0.15, 0.8, EC.U)) + EC.R; // the summit of the swelling, where it has ruptured
  EC.knob.visible = !(sp && sp.gone); ectPt(EC.U, top * 0.92, EC.knob.position);
  // the rupture bleeds until the vessels that feed it are sealed: less after the first bite of mesosalpinx, not at all after the second
  const fed = sp || S.mesoBite[EC.K] >= 2 ? 0 : S.mesoBite[EC.K] === 1 ? 0.4 : 1;
  m.rate = S.running ? EC.OOZE * fed * (1 + 0.5 * Math.min(2, m.tear)) : 0;
  if (m.rate > 0) { const v = (m.rate * dt) / 60; S.ebl += v; S.pool += v; if (Math.random() < dt * (3 + m.rate / 6)) emitBlood(EC.knob.position, 1 + m.rate / 40); }
  else if (S.running && !fed && m.tCtrl == null) { m.tCtrl = S.t; toast('The rupture has stopped bleeding: the vessels that fed it are sealed', 'ok'); }
  // the tube once it is free: in the grasper; let go, it falls to whatever lies below; bagged, it goes out through the port
  BAG.visible = !!sp && !sp.gone && m.bag >= 0;
  if (!sp || sp.gone) return;
  const mid = ectPt(EC.U, 0, _e1);
  if (m.bag >= 0) {
    m.bag += dt; BAG.position.copy(mid); BAG.scale.set(2.3, 1.5, 1.5); BAG.quaternion.copy(camera.quaternion);
    if (m.bag > 0.8) sp.off.addScaledVector(_e2.subVectors(bagExit(), mid), 1 - Math.exp(-2.2 * dt));
    if (m.bag > 2.4) { sp.gone = true; BAG.visible = false; toast('The tube is out in its bag, for histology', 'ok'); uiDirty(); }
  } else if (!held) {
    if (m.rest == null) { // where it comes to rest: on the first thing under it
      let low = 1e9; for (let i = Math.round(st.isth.uc * (NS - 1)); i < NS; i++) low = Math.min(low, curG(EC.K).tubeCur[i].y);
      RAY.set(_e2.copy(mid).setY(mid.y - 1.2), DOWN); const f = RAY.intersectObjects(PICKS, false).find(x => shown(x.object) && x.object.userData.ent !== 'tube' && x.object.userData.ent !== 'clot');
      m.rest = sp.off.y - Math.max(0, low - ((f ? f.point.y : -6.5) + 0.3));
      if (!m.dropped) { m.dropped = true; logEvent('tech', 'The tube was let go before it was bagged. A specimen loose in a pelvis with blood in it is easily lost.'); }
    }
    sp.off.y = damp(sp.off.y, m.rest, 5, dt);
  } else m.rest = null;
}
// suction on a clot breaks it up and clears it
function ectSuction(h, dt) {
  const m = S.ect;
  for (let i = 0; i < EC.clots.length; i++) {
    const c = EC.clots[i]; if (m.clots[i] <= 0) continue;
    if (!(h.near && h.pick.mesh === c.m) && h.tip.distanceTo(c.at) > c.def.r[0] * 0.7 + 0.4) continue;
    m.clots[i] -= dt / c.def.T;
    if (m.clots[i] <= 0) { m.clots[i] = 0; sfx.ok(); toast('Clot cleared', 'ok'); uiDirty(); }
    return;
  }
}
// the grasper has taken hold of something
function ectGrasped(h) {
  const g = h.grab, m = S.ect;
  if (g.ent !== 'tube' || g.side !== EC.K || S.side[EC.K].spec || Math.abs(g.pull.u - EC.U) > EC.W * 1.3) return;
  m.tear++; S.ebl += 12; S.pool += 12; for (let i = 0; i < 10; i++) emitBlood(EC.knob.position, 2 + Math.random() * 2);
  releaseGrab(h); sfx.warn();
  if (m.tear === 1) logEvent('tech', 'The pregnancy itself was grasped: the distended tube is friable, and it tears and bleeds. Hold the tube beside it.'); else hint('tear', 'Hold the tube beside the pregnancy, not the pregnancy');
}
const ectClot = need => { const m = S.ect; for (let i = 0; i < EC.clots.length; i++) if (m.clots[i] > 0 && (!need || EC.clots[i].def.need)) return EC.clots[i]; return null; }; // a clot still to clear (need: one that hides the adnexa)
const ectClotAct = c => ({ p: _w.copy(c.at).setY(c.at.y + c.def.r[1] * 0.5).clone(), act: 'suction', label: c.def.on ? 'Clot on the right adnexa: hold the suction on it' : 'Clot: hold the suction on it' });

// ---------- steps ----------
const exLift = { label: 'Tube lifted with the grasper', ok: () => !!ectHolder() };
const ECT_REC = { yaw: yawFor(EC.K), pitch: 0.5, push: 0.3 };
const ECT_STEPS = [
  {
    id: 'asp', kind: 'asp', tool: 'suction', phase: 'See', short: 'Aspirate the haemoperitoneum', title: 'Aspirate the blood and clot', dist: 13.5, rec: null, expo: [],
    text: ['Take the suction-irrigator and put its tip in the blood. Hold to aspirate.', 'Hold the tip on the clot over the right adnexa until it breaks up and clears.', 'Stop when you can see the uterus and both tubes. The tube is still bleeding, so the pelvis will not stay dry yet.'],
    pearl: 'Blood hides the anatomy and soaks up the light, so clear it before anything else: find the fundus, then follow each cornu out to its tube. If she were unstable the order would change: find the bleeding tube and grasp it first, then aspirate.',
    next() { const c = ectClot(true); return S.pool > EC.SEE ? { p: poolSpot().clone(), act: 'suction', label: 'Aspirate the blood' } : c ? ectClotAct(c) : null; },
    done() { return S.pool < EC.SEE + 12 && !ectClot(true); },
    progress() { return 'Blood in the pelvis: ' + Math.round(S.pool) + ' mL' + (ectClot(true) ? ' · clot on the right adnexa' : ''); },
    frac() { return 0.8 * clamp(1 - (S.pool - EC.SEE) / (EC.BLOOD - EC.SEE), 0, 1) + (ectClot(true) ? 0 : 0.2); },
    focus(o) { return o.set(0.8, -2.2, 3.2); },
    force() { S.pool = Math.min(S.pool, 50); S.ect.clots[0] = 0; }
  },
  {
    id: 'ident', kind: 'survey', tool: 'any', phase: 'See', short: 'Find the pregnancy', title: 'Find the pregnancy and look at the other tube', dist: 12.5, rec: { yaw: 0, pitch: 0.35, push: 0.4 }, expo: [],
    text: ['Find the uterus first: the fundus is the landmark.', 'Follow the right cornu out to the swollen, dusky tube. That is the pregnancy, and the blood is coming from its ruptured wall.', 'Then look at the left tube. Hold an instrument tip beside each of the three to mark it. No pinch or click is needed.'],
    pearl: 'Confirm the diagnosis before you remove anything, and look at the other tube and both ovaries: a bleeding corpus luteum can look like this at first sight. With a healthy tube on the other side, salpingectomy is the usual operation. If the other tube is damaged or absent and she wants a pregnancy, salpingotomy is the conversation to have had beforehand.',
    tm: { U: 0, E: 0, L: 0 }, name: { U: 'uterus', E: 'pregnancy', L: 'left tube' }, said: { U: 'Uterus', E: 'Ectopic pregnancy in the right tube', L: 'Left tube: looks healthy' },
    pt(k, out) { return k === 'U' ? out.set(0, 8.4, -0.4).applyMatrix4(UT.M) : k === 'E' ? ectPt(EC.U, 0.6, out) : sampleArr(curG(EC.O).tubeCur, 0.6, out); },
    click(h) { if (h.inst !== 'bipolar') return false; hint('identE', 'No energy yet. Hold the tip beside the uterus, the pregnancy and the other tube to mark them.'); return true; },
    tick(dt) {
      const seen = S.ect.seen;
      for (const k of ['U', 'E', 'L']) {
        if (seen[k]) continue;
        const p = this.pt(k, _w), near = HANDS.some(h => h.ptr.on && h.exch <= 0 && !h.firing && h.tip.distanceTo(p) < 1.3);
        this.tm[k] = near ? this.tm[k] + dt : Math.max(0, this.tm[k] - 2 * dt);
        if (this.tm[k] >= 1) { seen[k] = true; sfx.ok(); toast(this.said[k], 'ok'); uiDirty(); }
      }
    },
    next() { for (const k of ['U', 'E', 'L']) if (!S.ect.seen[k]) return { p: this.pt(k, new V3()), act: 'hover', label: 'Hold near the ' + this.name[k], prog: this.tm[k] }; return null; },
    reset() { this.tm = { U: 0, E: 0, L: 0 }; },
    done() { const s = S.ect.seen; return s.U && s.E && s.L; }, progress() { const s = S.ect.seen; return (s.U ? 1 : 0) + (s.E ? 1 : 0) + (s.L ? 1 : 0) + ' of 3 identified'; },
    frac() { const s = S.ect.seen; return ((s.U ? 1 : 0) + (s.E ? 1 : 0) + (s.L ? 1 : 0)) / 3; }, focus(o) { return o.set(0, -1, 3.4); },
    force() { const s = S.ect.seen; s.U = s.E = s.L = true; }
  },
  {
    id: 'lift', kind: 'lift', tool: 'grasper', phase: 'Salpingectomy', short: 'Lift the tube', title: 'Grasp and lift the right tube', dist: 10.5, rec: ECT_REC, expo: [exSide(EC.K)],
    text: ['Take the atraumatic grasper in your other hand.', 'Grasp the tube beside the pregnancy, toward its fimbrial end, and lift it toward the abdominal wall.', 'Keep hold. The mesosalpinx now stands up as a sheet for the other hand to work on.'],
    pearl: 'Hold the tube, not the pregnancy: the distended segment is friable, and it tears and bleeds in the jaws. Lifting the tube draws the mesosalpinx away from the ovary and the pelvic wall, which is what keeps the energy off both.',
    next() {
      const h = ectHolder();
      if (!h) return { p: ectPt(0.87, 0.1, new V3()), act: 'grasp', keep: true, tool: 'grasper', hand: 'L', label: 'Grasp the tube here, beside the pregnancy' };
      return { p: h.grab.pull.nat.clone().add(_w.set(-0.3 * AN.side[EC.K].s, 1.3, 0.2)), act: 'pull', tool: 'grasper', hand: h.key, label: 'Lift' };
    },
    done() { const h = ectHolder(); return S.ect.lifted || (!!h && h.grab.pull.off.length() > 0.55); },
    progress() { const h = ectHolder(); return h ? 'Held: lift it' : 'Not held'; }, frac() { const h = ectHolder(); return h ? 0.5 + 0.5 * clamp(h.grab.pull.off.length() / 0.55, 0, 1) : 0; },
    focus(o) { return ectPt(0.55, 0, o); },
    force() { S.ect.lifted = true; }
  },
  mesoStep({
    id: 'meso', side: EC.K, phase: 'Salpingectomy', short: 'Divide the mesosalpinx', title: 'Seal and divide the mesosalpinx', dist: 10.5, rec: ECT_REC, expo: [exSide(EC.K), exLift],
    text: ['With the advanced bipolar in the other hand, take the mesosalpinx just under the tube in two bites, fimbrial end first.', 'Seal, then cut, each bite.', 'Stay close to the tube. The bleeding slows with the first bite and stops with the second.'],
    pearl: 'Hug the tube. The vessels in the mesovarium just below are the ovary\'s supply, and this ovary is staying. The same bites shut off the vessels feeding the pregnancy, so control of the bleeding and the dissection are one manoeuvre.'
  }),
  sealStep({
    id: 'isth', side: EC.K, ent: 'isth', uT: EC.UT, phase: 'Salpingectomy', short: 'Divide the tube at the isthmus', title: 'Seal and divide the isthmus', dist: 10, rec: ECT_REC, expo: [exSide(EC.K), exLift],
    text: ['Seal the tube at its isthmus, about 1 cm from the cornu.', 'Hold until the seal tone completes, then fire the cut blade through the sealed zone.', 'The tube comes away in the grasper. Do not let go of it.'],
    pearl: 'Leave a short stump and stay off the cornu: heat there bleeds from the ascending uterine branches and weakens the wall. A long stump can harbour a later pregnancy.',
    off(h) { const P = h && h.pick; return !!P && h.near && P.hit && P.ent === 'tube' && P.side === EC.K && P.u > EC.FAR; }, // the jaws are on the tube, but beyond its isthmus
    bipolar(h) { if (!this.off(h)) return false; hint('isthfar', 'Divide the tube at its isthmus, about 1 cm from the cornu'); return true; },
    cut(hand) { const h = hand || HANDS.find(x => x.inst === 'bipolar' && x.exch <= 0 && x.ptr.on); if (!this.off(h)) return false; hint('isthfar', 'Divide the tube at its isthmus, about 1 cm from the cornu'); return true; },
    onCut() {
      const uc = S.side[EC.K].isth.uc;
      if (uc < EC.FLUSH) logEvent('tech', 'Tube divided flush with the cornu: heat there bleeds from the ascending uterine branches. Leave a short stump.');
      else if (uc > EC.LONG) logEvent('tech', 'A long stump of tube was left: a later pregnancy can implant in it');
      ectFree(); toast(ectHolder() ? 'The tube is free, in the grasper. Bag it.' : 'The tube is free', 'ok');
    }
  }),
  {
    id: 'bag', kind: 'bag', tool: 'any', phase: 'Completion', short: 'Remove the tube', title: 'Remove the tube in a bag', dist: 12.5, rec: null, expo: [],
    text: ['Place the tube in a retrieval bag.', 'Bring the bag out through the umbilical port.'],
    pearl: 'Take it out in a bag. Trophoblast spilled or left in the abdomen can implant and keep the hCG up. Send the tube for histology to confirm chorionic villi.',
    ready() { const sp = S.side[EC.K].spec; return !!sp && !sp.gone && S.ect.bag < 0; },
    button: { label: 'Bag the tube and take it out', fn() { const st = STEPS[S.step], h = ectHolder(); if (!st.ready()) return; if (h) releaseGrab(h); S.ect.bag = 0; uiDirty(); }, hide: () => !STEPS[S.step].ready() },
    next() { return this.ready() ? { p: ectPt(EC.U, 0, new V3()), act: 'button', label: 'Bag the tube' } : null; },
    done() { const sp = S.side[EC.K].spec; return !!sp && sp.gone; }, progress() { return S.ect.bag >= 0 ? 'Coming out' : ''; }, frac() { return clamp(S.ect.bag / 2.4, 0, 1); },
    focus(o) { return o.set(1.5, -1.5, 3.4); },
    force() { const st = S.side[EC.K]; if (!st.spec) ectFree(); const h = ectHolder(); if (h) releaseGrab(h); st.spec.gone = true; }
  },
  {
    id: 'final', kind: 'final', tool: 'any', phase: 'Completion', short: 'Wash out and check', title: 'Clear the pelvis and check for bleeding', dist: 13, rec: null, expo: [],
    text: ['Drop the pneumoperitoneum to 8 mmHg and look at the stump and the cut edge of the mesosalpinx.', 'Control any ooze with a short bipolar burst, away from the ovary.', 'Irrigate, and aspirate the remaining blood and clot.'],
    pearl: 'Look again at low pressure, and look up: in a head-down patient blood tracks to the upper abdomen. Before she leaves, check her rhesus status for anti-D, and arrange the follow-up your unit uses after a salpingectomy.',
    button: { label: 'Lower pressure to 8 mmHg', fn() { if (S.lowP) return; S.lowP = true; S.pressureGoal = 8; addBleeder(ectStump, 12, false, 'tubal stump'); toast('Pressure down: ooze from the tubal stump', 'bleed'); uiDirty(); }, hide: () => S.lowP },
    button2: { label: 'End the case', fn() { endCase(); }, show: () => S.lowP && !S.bleeders.length && S.pool < EC.DRY && !ectClot() },
    next() {
      if (!S.lowP) return { p: ectStump(new V3()), act: 'button', label: 'Lower the pressure' };
      if (S.bleeders.length) return null;
      const c = ectClot(), wet = S.pool >= EC.DRY;
      if (c && !(wet && c.at.y < poolTop(c.at.z))) return ectClotAct(c); // a clot that stands clear of the blood; one still under it waits for the level to fall
      if (wet) return { p: poolSpot().clone(), act: 'suction', label: 'Aspirate the blood' };
      return { p: ectStump(new V3()), act: 'button', label: 'End the case' };
    },
    done() { return S.ended; },
    progress() { const n = S.ect.clots.filter(v => v > 0).length; return !S.lowP ? 'At 15 mmHg' : S.bleeders.length ? 'Ooze to control' : S.pool >= EC.DRY || n ? 'Blood to aspirate: ' + Math.round(S.pool) + ' mL' + (n ? ' · ' + n + ' clot' + (n > 1 ? 's' : '') : '') : 'Dry'; },
    frac() { return (S.lowP ? 0.3 : 0) + (S.lowP && !S.bleeders.length ? 0.2 : 0) + (S.pool < EC.DRY ? 0.25 : 0) + (ectClot() ? 0 : 0.25); },
    focus(o) { return o.set(0.6, -2.4, 3.4); },
    force() { S.lowP = true; S.bleeders.length = 0; S.pool = 0; S.ect.clots.fill(0); endCase(); }
  }
];

// complete a sealing step, for automated checks. The tube, once free, is taken out at once: no hand is holding it.
function ectForce(st) {
  const sd = S.side[EC.K];
  if (st.kind === 'meso') { S.mesoBite[EC.K] = 2; sd.meso.pGoal = 1; }
  else if (st.id === 'isth') { sd.isth.seals.push({ u: EC.UT, w: SEALSPEC.isth.w }); sd.isth.cut = true; sd.isth.uc = EC.UT; ectFree(); sd.spec.gone = true; }
}

// ---------- scoring, debrief ----------
function ectScore() {
  const s = S.stats, m = S.ect, inj = Object.keys(S.injuries).length;
  let pts = 100; const notes = [];
  if (inj) { pts -= 25 * inj; notes.push(inj + ' organ or vessel injur' + (inj > 1 ? 'ies' : 'y')); }
  if (s.unsealedCuts) { pts -= 8 * s.unsealedCuts; notes.push(s.unsealedCuts + ' pedicle' + (s.unsealedCuts > 1 ? 's' : '') + ' cut without a complete seal'); }
  if (m.tear) { pts -= 5; notes.push('The pregnancy itself was grasped'); }
  if (m.dropped) { pts -= 3; notes.push('The tube was let go before it was bagged'); }
  if (s.expoMiss) { pts -= Math.min(12, 2 * s.expoMiss); notes.push(s.expoMiss + ' step' + (s.expoMiss > 1 ? 's' : '') + ' started without the recommended exposure'); }
  if (S.ebl > ECT.eblWarn) { pts -= Math.min(20, Math.round((S.ebl - ECT.eblWarn) / 20)); notes.push('More than ' + ECT.eblWarn + ' mL lost during the operation'); }
  const tech = S.events.filter(e => e.type === 'tech').length - (m.tear ? 1 : 0) - (m.dropped ? 1 : 0);
  if (tech > 0) { pts -= Math.min(10, 2 * tech); notes.push(tech + ' point' + (tech > 1 ? 's' : '') + ' of technique in the event log'); }
  if (s.nonTarget > 3) { pts -= Math.min(6, Math.round(s.nonTarget)); notes.push('Energy applied off target for ' + s.nonTarget.toFixed(1) + ' s'); }
  pts = Math.max(0, Math.round(pts));
  return { pts, grade: pts >= 90 ? 'Proficient' : pts >= 75 ? 'Competent' : pts >= 60 ? 'Developing' : 'Needs review', notes };
}
function ectDebrief(row) {
  const s = S.stats, m = S.ect, inj = Object.keys(S.injuries).length, e = S.side[EC.K].isth, yn = (k, v) => row(k, v ? 'Yes' : 'No', v ? 'warn' : 'ok');
  return [
    row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + row('Pedicles cut without a full seal', s.unsealedCuts, s.unsealedCuts ? 'warn' : 'ok') + yn('Pregnancy grasped', m.tear > 0) + yn('Tube let go before it was bagged', m.dropped),
    row('Blood in the pelvis on entry', EC.BLOOD + ' mL') + row('Lost during the operation', Math.round(S.ebl) + ' mL', S.ebl > ECT.eblWarn ? 'warn' : 'ok') + row('Bleeding from the rupture stopped at', m.tCtrl != null ? fmtT(m.tCtrl) : 'n/a') + row('Tubal stump', e.cut ? (e.uc * ectLen()).toFixed(1) + ' cm' : 'n/a') + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok')
  ];
}
const ECT = {
  id: 'ect', name: 'Laparoscopic salpingectomy', tag: ', ruptured right tubal ectopic', blurb: 'Ruptured tubal ectopic with haemoperitoneum. 7 steps.',
  sub: 'Ruptured right tubal ectopic pregnancy. Moderate haemoperitoneum.',
  brief: ['29-year-old, 7 weeks from her last period, with sudden lower abdominal pain and shoulder-tip pain. Positive pregnancy test. Ultrasound: empty uterus, a 3 cm right adnexal mass, free fluid in the pelvis. Heart rate 104 and blood pressure 102/64 after a litre of crystalloid, haemoglobin 10.4 g/dL, blood cross-matched. No previous pelvic infection or tubal surgery.',
    'She is in lithotomy with a uterine manipulator in place. 10 mm umbilical scope, two 5 mm lateral ports, pneumoperitoneum at 15 mmHg. You are looking toward the pelvis: her right is on the right of the screen. About 500 mL of blood and clot lies in the pelvis, and the right tube is still bleeding.'],
  steps: ECT_STEPS, insts: ['grasper', 'bipolar', 'suction'], warp: [0, 0], tipZ: 4.6, ureters: false, ebl0: EC.BLOOD, eblWarn: 150, needleHint: '', // ebl0: blood already lost on entry, counted in the estimate; eblWarn is on what is lost after that
  spare: { tube: EC.O }, // the other tube is staying: energy on it is an injury
  labels: [['Ectopic pregnancy', () => ectPt(EC.U, 0.7, _w), () => !S.ect.clots[0] && !S.side[EC.K].spec]],
  poolY: v => -7 + 4 * Math.sqrt(Math.min(v, 700) / 500), poolWide: 2, // the blood stands much higher here, and reaches further, than a pool from a bleeding point
  tube: k => (k === EC.K ? EC.look : null),
  state(s) {
    s.pool = EC.BLOOD;
    s.ect = { clots: EC.DEF.map(() => 1), seen: { U: false, E: false, L: false }, tear: 0, rate: 0, tCtrl: null, lifted: false, dropped: false, bag: -1, rest: null };
    for (const c of EC.clots) if (!c.def.on) { // each floor clot lies on the first of the wall or the bowel below it
      RAY.set(_e1.set(c.def.x, -3.4, c.def.z), DOWN); const f = RAY.intersectObjects(PICKS, false).find(x => x.object.userData.ent === 'wall' || x.object.userData.ent === 'rectum');
      c.at.set(c.def.x, (f ? f.point.y : -6.6) + c.def.r[1] * 0.6, c.def.z);
    }
  },
  show: ectShow, update: ectUpdate, suction: ectSuction, grasped: ectGrasped,
  score: ectScore, debrief: ectDebrief, sutures: () => ({ st: [], from: null, on: false }), force: ectForce,
  // what a scripted hand should find under its tip. The cut at the isthmus goes through the seal itself: a lifted tube is a thin target
  want: (st, n) => (st.id === 'isth' && n.act === 'cut' ? { spot: 0.45, avoid: [] } : st.seal ? { ents: st.seal.ent === 'meso' ? ['meso', 'tube'] : ['tube'], side: st.seal.side } : n.act === 'grasp' ? { ents: ['tube'], side: EC.K } : null)
};
