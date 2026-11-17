// ---------- case: total laparoscopic hysterectomy ----------
const exPush = { label: 'Cup pushed cephalad', ok: () => S.pose.push > 0.7 };
const exAnt = { label: 'Uterus anteverted', ok: () => S.pose.pitch > 0.5 };
const exMid = { label: 'Uterus in the midline', ok: () => Math.abs(S.pose.yaw) < 0.2 };
const TRACK_URETER = () => ['ua', 'card', 'colp'].includes(STEPS[S.step].kind);
const KI = 6;

function inciseStep(o) {
  const k = o.side, which = o.which;
  const cp = (i, out) => {
    const G = curG(k), st = S.side[k], uR = st.round.uc, uU = st.uo.uc;
    if (which === 'ant') { const v = 0.94 - i * 0.18, u = 0.03 + (uR - 0.03) * v; return stripPt(G.floorA, u, G.round, u, v, 0.22, out); }
    const v = 0.06 + i * 0.18, u = uU - (uU - 0.03) * v; return stripPt(G.ridge, u, G.floorP, u, v, 0.3, out);
  };
  const count = () => Math.round((which === 'ant' ? S.side[k].antGoal : S.side[k].postGoal) * KI);
  return Object.assign({
    kind: 'incise', tool: 'hook', acc: 0,
    next() { const n = count(); return n >= KI ? null : { p: cp(n, new V3()), act: 'trace', label: n === 0 ? 'Start here: hold to cut' : 'Trace' }; },
    path() { const a = []; for (let i = count(); i < KI; i++) a.push(cp(i, new V3())); return a; },
    targets() { const n = count(), a = []; for (let i = n; i < Math.min(KI, n + 2); i++) a.push(cp(i, new V3())); return a; },
    hook(h, dt) {
      const n = count(); if (n >= KI) return true;
      if (nearTarget(h, cp(n, _w2), 0.8)) {
        this.acc += dt;
        if (this.acc > 0.11) {
          this.acc = 0; if (which === 'ant') S.side[k].antGoal = (n + 1) / KI; else S.side[k].postGoal = (n + 1) / KI; S.ebl += 0.4; sfx.click(); uiDirty();
          if (which === 'post' && n + 1 >= KI) { dropGrabsOnSide(k); startRelease(AN.side[k], 'upper'); }
        }
        return true;
      }
      if (h.pick.hit && (h.pick.ent === which || h.pick.ent === 'roof' || h.pick.ent === 'areolar')) { if (S.guided) hint('line', 'Follow the marked line from the divided pedicle'); return true; }
      return false;
    },
    done() { return count() >= KI; },
    progress() { return 'Incision ' + count() + ' / ' + KI; },
    frac() { return count() / KI; },
    focus(out) { return cp(2, out); }
  }, o);
}
function markUreter(k) {
  const sur = STEPS[S.step].id === 'survey', map = sur ? S.ureterID : S.ureterOK;
  if (!map[k]) { map[k] = true; sfx.ok(); toast(CAP[k] + ' ureter ' + (sur ? 'identified' : 'peristalsing, not dilated'), 'ok'); uiDirty(); }
}
function clickUreter(h) {
  if (h.pick.hit && h.near && h.pick.ent === 'ureter') {
    if (STEPS[S.step].id === 'final' && (!S.lowP || S.bleeders.length)) return false;
    markUreter(h.pick.side);
    return true;
  }
  return false;
}
// Hold-near identification: a driven instrument tip held beside a ureter for a moment identifies it (survey) or
// confirms it (final inspection). No pinch or click is needed, so nothing beside it is grasped or burned by mistake.
const UDW = { R: 0, L: 0, NEAR: 1.2, T: 1 };
function ureterDwell(dt) {
  const st = STEPS[S.step];
  if (st.id !== 'survey' && !(st.id === 'final' && S.lowP && !S.bleeders.length)) { UDW.R = UDW.L = 0; return; }
  const map = st.id === 'survey' ? S.ureterID : S.ureterOK;
  for (const k of ['R', 'L']) {
    if (map[k]) { UDW[k] = 0; continue; }
    let near = false;
    for (const h of HANDS) if (h.ptr.on && h.exch <= 0 && !h.firing) { const n = nearestOnArr(URETER[k].arr, h.tip); if (n.d - 0.2 < UDW.NEAR && n.u > 0.05 && n.u < 0.65) near = true; }
    UDW[k] = near ? UDW[k] + dt : Math.max(0, UDW[k] - 2 * dt);
    if (UDW[k] >= UDW.T) { UDW[k] = 0; markUreter(k); }
  }
}
const _um = {};
function ureterMarker(k) {
  const U = URETER[k], c = _um[k];
  if (c && c.t > S.t && c.t < S.t + 1) return c.p.clone();
  const r = ureterMarkerRaw(k); _um[k] = { t: S.t + 0.25, p: r.clone() }; return r;
}
function ureterMarkerRaw(k) {
  const U = URETER[k];
  for (const u of [0.42, 0.34, 0.5, 0.26, 0.18, 0.58, 0.1]) { const p = sampleArr(U.arr, u, new V3()); if (visibleAt(p, 0.5)) return p; }
  return sampleArr(U.arr, 0.34, new V3());
}
function deliverSpecimen() { if (S.colpDone && S.specimen === 'in') { S.specimen = 'delivering'; for (const k of ['L', 'R']) if (HAND[k].grab) releaseGrab(HAND[k]); toast('Specimen delivered through the vagina', 'ok'); uiDirty(); } }
function onSpecimenOut() { S.poseGoal.yaw = 0; uiDirty(); }

const SIDE_STEPS = k => [
  sealStep({
    id: 'round' + k, side: k, ent: 'round', uT: 0.45, phase: CAP[k] + ' side', short: CAP[k] + ' round ligament',
    title: 'Divide the ' + WORD[k] + ' round ligament', dist: 11, rec: { yaw: yawFor(k), pitch: 0.1, push: 0.4 }, expo: [exSide(k)],
    text: ['Deviate the uterus to the patient\'s ' + OPP[k] + ' to put the ' + WORD[k] + ' round ligament on stretch.', 'Grasp its mid-portion with the advanced bipolar and hold until the seal tone completes.', 'Fire the cut blade through the sealed zone.'],
    pearl: 'Divide mid-ligament. Too medial bleeds from the ascending uterine branches; too lateral approaches the internal ring and the external iliac vessels.'
  }),
  inciseStep({
    id: 'ant' + k, side: k, which: 'ant', phase: CAP[k] + ' side', short: CAP[k] + ' anterior leaf',
    title: 'Open the ' + WORD[k] + ' anterior leaf', dist: 10.5, rec: { yaw: yawFor(k), pitch: -0.12, push: 0.5 }, expo: [exSide(k)],
    text: ['Switch to the monopolar hook.', 'Hold to activate and carry the incision from the divided round ligament down the anterior leaf toward the vesicouterine fold.', 'Stay on the thin, lifted peritoneum and keep the tip off the bladder.'],
    pearl: 'CO₂ tracks into the opened leaf and separates the loose areolar plane for you. Let it show you where to cut.'
  }),
  mesoStep({
    id: 'meso' + k, side: k, swing: true, phase: CAP[k] + ' side', short: CAP[k] + ' salpingectomy',
    title: 'Free the ' + WORD[k] + ' tube: mesosalpinx', dist: 10.5, rec: { yaw: yawFor(k), pitch: 0.5, push: 0.3 }, expo: [exSide(k)],
    text: ['With the advanced bipolar, take the mesosalpinx just under the tube in two bites, fimbrial end first.', 'Seal, then cut, each bite.', 'The tube stays attached at the cornu and comes out with the uterus.'],
    pearl: 'Hug the tube. The ovarian arcade runs in the mesovarium just below, and it is the conserved ovary\'s collateral supply.'
  }),
  sealStep({
    id: 'uo' + k, side: k, ent: 'uo', uT: 0.1, phase: CAP[k] + ' side', short: CAP[k] + ' utero-ovarian ligament',
    title: 'Divide the ' + WORD[k] + ' utero-ovarian ligament', dist: 10, rec: { yaw: yawFor(k), pitch: 0.55, push: 0.3 }, expo: [exSide(k)],
    text: ['Seal the utero-ovarian ligament between the cornu and the ovary, then cut.', 'The ovary stays on its infundibulopelvic supply and falls back to the sidewall.'],
    pearl: 'Leave a pedicle on the uterine side. A cut flush with the cornu back-bleeds briskly from the ascending uterine vessels.'
  }),
  inciseStep({
    id: 'post' + k, side: k, which: 'post', phase: CAP[k] + ' side', short: CAP[k] + ' posterior leaf',
    title: 'Open the ' + WORD[k] + ' posterior leaf and skeletonize the vessels', dist: 10, rec: { yaw: yawFor(k), pitch: 0.85, push: 0.4 }, expo: [exSide(k), exAnt],
    text: ['Antevert the uterus and keep it deviated to the patient\'s ' + OPP[k] + '.', 'With the hook, open the posterior leaf from the divided pedicle down toward the uterosacral ligament.', 'The areolar tissue clears off the uterine vessels as you go. The ureter runs on the lateral side of this leaf: stay medial to it.'],
    pearl: 'Opening the posterior leaf lets the ureter fall laterally. Skeletonized vessels seal more reliably and with less thermal spread than a thick pedicle.'
  })
];
const VESSEL_STEPS = k => [
  sealStep({
    id: 'ua' + k, side: k, ent: 'ua', uT: 0.14, phase: 'Uterine vessels', short: CAP[k] + ' uterine vessels',
    title: 'Seal and divide the ' + WORD[k] + ' uterine vessels', dist: 8.5, rec: { yaw: yawFor(k) * 0.9, pitch: 0.3, push: 1 }, expo: [exPush, exSide(k)],
    text: ['Push the cup firmly cephalad and deviate the uterus to the patient\'s ' + OPP[k] + '.', 'Seal the skeletonized vessels at the level of the internal os, right against the uterus and at a right angle to them.', 'Confirm the seal, then cut.'],
    pearl: 'Cephalad pressure on the cup lifts the uterine artery away from the ureter, which crosses under it 1.5 to 2 cm lateral to the cervix. Every millimetre lateral on the pedicle is a millimetre closer.'
  }),
  sealStep({
    id: 'card' + k, side: k, ent: 'card', uT: 0.17, phase: 'Uterine vessels', short: CAP[k] + ' cardinal ligament',
    title: 'Step down the ' + WORD[k] + ' cardinal ligament', dist: 8, rec: { yaw: yawFor(k) * 0.9, pitch: 0.3, push: 1 }, expo: [exPush, exSide(k)],
    text: ['Stay inside the sealed uterine pedicle.', 'Seal and cut the cardinal ligament along the cervix, down to the cup rim.'],
    pearl: 'Working medial to the pedicle lateralizes the uterine stump and the ureter together, away from the colpotomy.'
  })
];

// Sweep the bladder off the cervix and vagina: N sweeps take it from `from` to `full` of the way down (1: clear of a colpotomy).
const flapStep = o => Object.assign({
  id: 'flap', kind: 'flap', tool: 'hook', alt: 'suction', phase: 'Bladder', short: 'Develop bladder flap', title: 'Develop the bladder flap', dist: 9, acc: 0, cnt: 0, N: 6, from: 0, full: 1,
  rec: { yaw: 0, pitch: -0.18, push: 1 }, expo: [exPush],
  text: ['Push the cup cephalad: its rim marks the anterior fornix.', 'Sweep the bladder caudally off the cervix, midline first, then each side. Use short hook bursts on the cervical side or blunt pushes with the suction tip.', 'Carry on until the bladder sits 1.5 to 2 cm below the cup rim.'],
  pearl: 'The right plane is white, filmy and avascular. Yellow fat belongs to the bladder. The bladder pillars laterally carry vessels, and a prior caesarean scar hides the midline plane: start lateral in those cases.',
  at() { return [0.5, 0.22, 0.78][this.cnt % 3]; },
  targets() { return this.cnt >= this.N ? [] : [flapEdgePt(this.at(), new V3())]; },
  next() { return this.cnt >= this.N ? null : { p: flapEdgePt(this.at(), new V3()), act: 'push', label: 'Sweep the bladder down', prog: this.acc / 0.4 }; },
  sweep(h, dt, T) {
    if (this.cnt >= this.N) return true;
    if (h.pick.ent === 'bladder') return false;
    if (nearTarget(h, flapEdgePt(this.at(), _w2), 0.9)) { this.acc += dt; if (this.acc > T) { this.acc = 0; this.cnt++; S.flapGoal = lerp(this.from, this.full, this.cnt / this.N); S.ebl += 0.6; sfx.click(); uiDirty(); } return true; }
    return false;
  },
  hook(h, dt) { return this.sweep(h, dt, 0.4); }, blunt(h, dt) { if (this.sweep(h, dt, 0.6)) S.stats.blunt += dt; },
  done() { return this.cnt >= this.N && S.flap > lerp(this.from, this.full, 0.93); }, progress() { return 'Bladder mobilized ' + Math.round(S.flap * 100) + '%'; }, frac() { return this.cnt / this.N; },
  focus(o) { return flapEdgePt(0.5, o); },
  force() { this.cnt = this.N; S.flapGoal = this.full; }
}, o);

const TLH_STEPS = [
  {
    id: 'survey', kind: 'survey', tool: 'any', phase: 'Survey', short: 'Identify both ureters', title: 'Survey the pelvis and identify both ureters', dist: 17,
    rec: { yaw: 0, pitch: 0.6, push: 0.3 }, expo: [],
    text: ['Before any energy is used, find each ureter through the peritoneum.', 'It crosses the pelvic brim and runs down the sidewall below the infundibulopelvic ligament. Look for peristalsis.', 'Hold an instrument tip beside each ureter for a moment to mark it. No pinch or click is needed.'],
    pearl: 'Deviating and anteverting the uterus opens each sidewall. At the cervix the ureter passes under the uterine artery about 1.5 to 2 cm lateral.',
    // no energy during the survey: a press that misses the ureter must not fire a bipolar or hook beside it
    click(h) { if (clickUreter(h)) return true; if (h.inst !== 'bipolar' && h.inst !== 'hook') return false; hint('surveyE', 'No energy yet. Hold the tip beside a ureter for a moment to mark it.'); return true; },
    tick: ureterDwell,
    next() { for (const k of ['R', 'L']) if (!S.ureterID[k]) return { p: ureterMarker(k), act: 'hover', side: k, label: 'Hold near the ' + WORD[k] + ' ureter', prog: UDW[k] / UDW.T }; return null; },
    done() { return S.ureterID.R && S.ureterID.L; }, progress() { return (S.ureterID.R ? 1 : 0) + (S.ureterID.L ? 1 : 0) + ' of 2 identified'; },
    frac() { return ((S.ureterID.R ? 1 : 0) + (S.ureterID.L ? 1 : 0)) / 2; }, focus(o) { return o.set(0, -1.6, 0); }
  },
  ...SIDE_STEPS('R'), ...SIDE_STEPS('L'),
  {
    id: 'vuf', kind: 'incise', tool: 'hook', phase: 'Bladder', short: 'Incise vesicouterine fold', title: 'Incise the vesicouterine peritoneum', dist: 9.5, acc: 0,
    rec: { yaw: 0, pitch: -0.18, push: 0.7 }, expo: [exMid],
    text: ['Bring the uterus to the midline and tip it back to tent the vesicouterine fold.', 'With the hook, join the two anterior-leaf incisions across the midline, from the patient\'s right to left.', 'Cut the loose, mobile peritoneum just above the bladder reflection.'],
    pearl: 'Incise where the peritoneum lifts freely off the lower segment. Where it is densely adherent you are too high.',
    cp(i, out) { return vufPt(0.9 - i * 0.2, out); }, n() { return Math.round(S.vufGoal * 5); },
    next() { const n = this.n(); return n >= 5 ? null : { p: this.cp(n, new V3()), act: 'trace', label: n === 0 ? 'Start here: hold to cut' : 'Trace' }; },
    path() { const a = []; for (let i = this.n(); i < 5; i++) a.push(this.cp(i, new V3())); return a; },
    targets() { const n = this.n(), a = []; for (let i = n; i < Math.min(5, n + 2); i++) a.push(this.cp(i, new V3())); return a; },
    hook(h, dt) {
      const n = this.n(); if (n >= 5) return true;
      if (nearTarget(h, this.cp(n, _w2), 0.8) && h.pick.ent !== 'bladder') { this.acc += dt; if (this.acc > 0.11) { this.acc = 0; S.vufGoal = (n + 1) / 5; S.ebl += 0.4; sfx.click(); uiDirty(); } return true; }
      return h.pick.ent === 'vuf';
    },
    done() { return this.n() >= 5; }, progress() { return 'Incision ' + this.n() + ' / 5'; }, frac() { return this.n() / 5; }, focus(o) { return vufPt(0.5, o); }
  },
  flapStep({}),
  ...VESSEL_STEPS('R'), ...VESSEL_STEPS('L'),
  {
    id: 'colp', kind: 'colp', tool: 'hook', phase: 'Colpotomy and closure', short: 'Colpotomy', title: 'Circumferential colpotomy on the cup', dist: 9.5,
    rec: { yaw: 0, pitch: -0.1, push: 1 }, expo: [exPush],
    text: ['Push the cup cephalad to stretch the fornices over its rim.', 'With the hook, cut down onto the rim. Start anteriorly and work around each side.', 'Antevert the uterus to finish the posterior fornix between the uterosacral ligaments.'],
    pearl: 'Stay on the cup: the rim keeps the bladder, ureters and rectum off your cut. Use the least energy that does the job, because a devitalized vaginal edge is a risk factor for cuff dehiscence.',
    vis: [], visT: 0,
    refresh() { if (S.t < this.visT) return; this.visT = S.t + 0.18; for (let k = 0; k < 16; k++) this.vis[k] = S.colp[k] >= 1 ? false : visibleAt(colpPt(k, _w2), 0.7); },
    next() {
      this.refresh(); let best = -1, bd = 1e9;
      const h = HANDS.find(x => x.inst === 'hook') || activeHand();
      for (let k = 0; k < 16; k++) if (S.colp[k] < 1 && this.vis[k]) { const d = colpPt(k, _w2).distanceTo(h.tip); if (d < bd) { bd = d; best = k; } }
      if (best >= 0) return { p: colpPt(best, new V3()), act: 'trace', label: 'Cut on the cup rim' };
      for (let k = 0; k < 16; k++) if (S.colp[k] < 1) return { p: colpPt(k, new V3()), act: 'trace', label: 'Reposition the uterus to expose the rest', hidden: true };
      return null;
    },
    dots() { const a = []; for (let k = 0; k < 16; k++) a.push({ p: colpPt(k, new V3()), done: S.colp[k] >= 1, vis: !!this.vis[k] }); return a; },
    targets() { const a = []; for (let k = 0; k < 16; k++) if (S.colp[k] < 1) a.push(colpPt(k, new V3())); return a; },
    hook(h, dt) {
      let any = false;
      for (let k = 0; k < 16; k++) if (S.colp[k] < 1 && nearTarget(h, colpPt(k, _w2), 0.62)) {
        any = true; S.colp[k] += dt / 0.13;
        if (S.colp[k] >= 1) { S.ebl += 0.8; sfx.click(); if (!this.entered) { this.entered = true; S.pressure = 10.5; toast('Vagina entered. The occluder holds the pneumoperitoneum.', 'info'); } uiDirty(); }
      }
      if (S.colp.every(c => c >= 1) && !S.colpDone) { S.colpDone = true; VG.dirty = true; toast('Colpotomy complete: the uterus is free', 'ok'); }
      return any || h.pick.ent === 'uterus' || h.pick.ent === 'vagina';
    },
    done() { return S.colpDone; }, progress() { return S.colp.filter(c => c >= 1).length + ' / 16 segments'; }, frac() { return S.colp.filter(c => c >= 1).length / 16; },
    focus(o) { return o.set(0, 0.2, 0).applyMatrix4(UT.M); }
  },
  {
    id: 'deliver', kind: 'deliver', tool: 'any', phase: 'Colpotomy and closure', short: 'Deliver specimen', title: 'Deliver the specimen', dist: 11, rec: null, expo: [],
    text: ['Deliver the uterus with both tubes through the vagina.', 'The manipulator comes out with it and an occluder keeps the pneumoperitoneum.'],
    pearl: 'A uterus too large for the colpotomy is removed by contained extraction, never by uncontained morcellation.',
    button: { label: 'Deliver specimen through the vagina', fn: deliverSpecimen, hide: () => S.specimen !== 'in' },
    next() { return S.specimen === 'in' ? { p: _w.set(0, 5, 0).applyMatrix4(UT.M).clone(), act: 'button', label: 'Deliver the specimen' } : null; },
    done() { return S.specimen === 'out'; }, progress() { return S.specimen === 'delivering' ? 'Delivering' : ''; }, frac() { return S.deliv; }, focus(o) { return o.set(0, 2, 0).applyMatrix4(VG.M); }
  },
  {
    id: 'cuff', kind: 'cuff', tool: 'needle', phase: 'Colpotomy and closure', short: 'Close the vaginal cuff', title: 'Close the vaginal cuff', dist: 6.3, rec: null, expo: [],
    text: ['Take the needle driver. Run a barbed suture from the patient\'s right angle to the left.', 'For each stitch click or pinch on the anterior edge, then the posterior edge.', 'Take full-thickness bites about 1 cm from the cut edge and about 1 cm apart, with mucosa in every bite. Secure both angles.'],
    pearl: 'Shallow bites and missed mucosa are how cuffs dehisce. A deep anterior bite risks the bladder; lateral to the angle lies the ureter.',
    nextX() { const c = S.cuff; return c.stitches.length ? Math.max(-1.3, c.stitches[c.stitches.length - 1].x - 0.62) : 1.3; },
    next() {
      const c = S.cuff; if (c.done) return null;
      if (c.pending) return { p: cuffPtIn(c.pending.x, 0.75, new V3()), act: 'bite', label: 'Posterior bite' };
      return { p: cuffPt(this.nextX(), 'ant', 0.75, new V3()), act: 'bite', label: 'Anterior bite' };
    },
    click(h) {
      if (h.inst !== 'needle') return false;
      if (!h.pick.hit || !h.near || h.pick.ent !== 'vagina') { hint('cuffmiss', 'Place the bite on the vaginal edge'); return true; }
      const c = S.cuff; if (c.done) return true;
      const lp = _w.copy(h.pick.point).applyMatrix4(_m4.copy(VG.M).invert()), x = lp.x, edge = lp.z < 0 ? 'ant' : 'post', depth = Math.max(0, -lp.y);
      if (!c.pending) {
        if (edge !== 'ant') { hint('cuffant', 'Anterior edge first, then the posterior'); return true; }
        const last = c.stitches.length ? c.stitches[c.stitches.length - 1].x : null;
        if (last === null && x < 0.95) { hint('cuffstart', 'Start at the right angle of the cuff'); return true; }
        if (last !== null && x > last - 0.3) { hint('cuffclose', 'Too close to the last stitch: advance toward the left angle'); return true; }
        if (last !== null && x < last - 1.3) { hint('cuffgap', 'That leaves a gap. Bites should be about 1 cm apart.'); return true; }
        c.pending = { x, da: depth };
      } else {
        if (edge !== 'post') { hint('cuffpost', 'Now the posterior edge, opposite the anterior bite'); return true; }
        if (Math.abs(x - c.pending.x) > 0.6) { hint('cuffmatch', 'Match the posterior bite to the anterior one'); return true; }
        const s = { x: c.pending.x, da: c.pending.da, dp: depth }; c.stitches.push(s); c.pending = null;
        c.frontGoal = s.x - 0.4; S.ebl += 0.5;
        if (s.x <= -1.05) { c.frontGoal = -2.8; c.done = true; toast('Cuff closed. Suture cut.', 'ok'); }
      }
      h.roll = 1; sfx.bite();
      if (depth < 0.4) logEvent('tech', 'Shallow bite (' + Math.round(depth * 10) + ' mm from the edge): risk of pull-through');
      else if (depth > 1.5) logEvent('tech', 'Deep ' + (edge === 'ant' ? 'anterior bite: the bladder is close' : 'posterior bite: the rectum is close'));
      uiDirty(); return true;
    },
    done() { return S.cuff.done && S.cuff.front < -2.2; }, progress() { return S.cuff.stitches.length + ' stitches' + (S.cuff.pending ? ' + anterior bite placed' : ''); },
    frac() { const c = S.cuff; return c.done ? 1 : clamp((1.9 - (c.stitches.length ? c.stitches[c.stitches.length - 1].x : 1.9)) / 3.4, 0, 0.95); },
    focus(o) { return o.set(0, -0.1, 0).applyMatrix4(VG.M); }
  },
  {
    id: 'final', kind: 'final', tool: 'any', phase: 'Colpotomy and closure', short: 'Low-pressure inspection', title: 'Inspect at low pressure and confirm the ureters', dist: 12, rec: null, expo: [],
    text: ['Drop the pneumoperitoneum to 8 mmHg and inspect the pedicles and cuff.', 'Control any ooze with short bipolar bursts, away from the ureter at the cuff angle.', 'Aspirate pooled blood, then hold a tip beside each ureter for a moment to confirm peristalsis.'],
    pearl: 'Venous bleeding that 15 mmHg tamponades shows itself at 8. Cystoscopy follows according to your institution\'s practice.',
    click: clickUreter, tick: ureterDwell,
    button: { label: 'Lower pressure to 8 mmHg', fn() { if (S.lowP) return; S.lowP = true; S.pressureGoal = 8; addBleeder(o => cuffPt(1.7, 'ant', 0.5, o), 14, false, 'cuff angle'); S.oozeDone = true; toast('Pressure down: venous ooze at the right cuff angle', 'bleed'); uiDirty(); }, hide: () => S.lowP },
    button2: { label: 'End case', fn() { endCase(); }, show: () => S.lowP && !S.bleeders.length && S.pool < 8 && S.ureterOK.R && S.ureterOK.L },
    next() {
      if (!S.lowP) return { p: cuffPt(0, 'ant', 0, new V3()), act: 'button', label: 'Lower the pressure' };
      if (S.bleeders.length) return null;
      if (S.pool >= 8) return { p: new V3(POOL.position.x, POOL.position.y + 0.1, -1.5), act: 'suction', label: 'Aspirate the pool' };
      for (const k of ['R', 'L']) if (!S.ureterOK[k]) return { p: ureterMarker(k), act: 'hover', side: k, label: 'Hold near the ' + WORD[k] + ' ureter to confirm it', prog: UDW[k] / UDW.T };
      return { p: cuffPt(0, 'ant', 0, new V3()), act: 'button', label: 'End the case' };
    },
    done() { return S.ended; },
    progress() { return !S.lowP ? 'At 15 mmHg' : S.bleeders.length ? 'Ooze to control' : S.pool >= 8 ? 'Blood to aspirate: ' + Math.round(S.pool) + ' mL' : (S.ureterOK.R ? 1 : 0) + (S.ureterOK.L ? 1 : 0) + ' of 2 ureters confirmed'; },
    frac() { return (S.lowP ? 0.25 : 0) + (S.lowP && !S.bleeders.length ? 0.25 : 0) + (S.ureterOK.R ? 0.25 : 0) + (S.ureterOK.L ? 0.25 : 0); },
    focus(o) { return o.set(0, -1.6, -2.5); }
  }
];
// world point on the inner (mucosal) face of the posterior cuff wall
function cuffPtIn(x, depth, out) {
  const sn = clamp(x / 1.47, -0.995, 0.995), f = depth <= 0.64 ? 5 + depth / 0.64 : 6 + Math.min(1, (depth - 0.64) / 1.9);
  return cuffLocal(Math.asin(sn), f, out).applyMatrix4(VG.M);
}

function tlhScore() {
  const s = S.stats, inj = Object.keys(S.injuries).length, c = S.cuff.stitches;
  let pts = 100; const notes = [];
  if (inj) { pts -= 25 * inj; notes.push(inj + ' organ or vessel injur' + (inj > 1 ? 'ies' : 'y')); }
  if (s.unsealedCuts) { pts -= 8 * s.unsealedCuts; notes.push(s.unsealedCuts + ' pedicle' + (s.unsealedCuts > 1 ? 's' : '') + ' cut without a complete seal'); }
  if (s.nearMiss) { pts -= Math.min(15, 5 * s.nearMiss); notes.push(s.nearMiss + ' near miss' + (s.nearMiss > 1 ? 'es' : '') + ' at the ureter'); }
  if (s.expoMiss) { pts -= Math.min(12, 2 * s.expoMiss); notes.push(s.expoMiss + ' step' + (s.expoMiss > 1 ? 's' : '') + ' started without the recommended exposure'); }
  if (S.ebl > 100) { const p = Math.min(20, Math.round((S.ebl - 100) / 20)); pts -= p; notes.push('Blood loss above 100 mL'); }
  const bad = c.filter(b => b.da < 0.4 || b.dp < 0.4 || b.da > 1.5 || b.dp > 1.5).length;
  if (bad) { pts -= 2 * bad; notes.push(bad + ' cuff stitch' + (bad > 1 ? 'es' : '') + ' outside the 4 to 15 mm bite range'); }
  const tech = S.events.filter(e => e.type === 'tech').length - bad; if (tech > 0) pts -= Math.min(10, 2 * tech);
  if (s.nonTarget > 3) { pts -= Math.min(6, Math.round(s.nonTarget)); notes.push('Energy applied off target for ' + s.nonTarget.toFixed(1) + ' s'); }
  pts = Math.max(0, Math.round(pts));
  const grade = pts >= 90 ? 'Proficient' : pts >= 75 ? 'Competent' : pts >= 60 ? 'Developing' : 'Needs review';
  return { pts, grade, notes };
}
// what the debrief shows for this case beyond the figures every case has: [safety rows, technique rows]
function tlhDebrief(row) {
  const s = S.stats, c = S.cuff.stitches, inj = Object.keys(S.injuries).length;
  const depths = c.flatMap(b => [b.da, b.dp]), mean = depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;
  const gaps = c.slice(1).map((b, i) => c[i].x - b.x), gmean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const uad = k => (s['uaDist' + k] != null ? s['uaDist' + k].toFixed(1) + ' cm' : 'n/a'), minU = Math.min(s.minUreter.R, s.minUreter.L);
  return [
    row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + row('Near misses at the ureter', s.nearMiss, s.nearMiss ? 'warn' : 'ok') + row('Pedicles cut without a full seal', s.unsealedCuts, s.unsealedCuts ? 'warn' : 'ok') + row('Seal to ureter, right uterine pedicle', uad('R')) + row('Seal to ureter, left uterine pedicle', uad('L')) + row('Closest energy to a ureter', minU < 90 ? minU.toFixed(1) + ' cm' : 'n/a'),
    row('Cuff stitches', c.length) + row('Mean bite depth', depths.length ? Math.round(mean * 10) + ' mm' : 'n/a') + row('Mean stitch spacing', gaps.length ? Math.round(gmean * 10) + ' mm' : 'n/a') + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok') + row('Left-hand traction used', s.traction + ' time' + (s.traction === 1 ? '' : 's'))
  ];
}
// the threads to draw: each stitch as [from, over, to], where the running suture leaves the tissue, and whether it is in use
function tlhSutures() {
  const c = S.cuff, at = (x, edge, d) => cuffPt(x, edge, Math.min(d, 0.82), new V3());
  const st = c.stitches.map(s => [at(s.x, 'ant', s.da), new V3(s.x - 0.06, 0.24, 0).applyMatrix4(VG.M), at(s.x - 0.12, 'post', s.dp)]);
  return { st, from: c.pending ? at(c.pending.x, 'ant', c.pending.da) : st.length ? st[st.length - 1][2] : null, on: STEPS[S.step].id === 'cuff' && !c.done };
}
// ---------- hooks for automated checks ----------
function tlhForce(st) { // complete the step in hand
  const k = st.side, sd = k && S.side[k];
  if (st.id === 'survey') S.ureterID.R = S.ureterID.L = true;
  else if (st.seal && st.kind !== 'meso') { const e = sd[st.ent]; e.seals.push({ u: st.uT, w: SEALSPEC[st.ent].w }); e.cut = true; e.uc = st.uT; if (st.ent === 'uo') sd.roofCut = true; if (st.ent === 'ua' || st.ent === 'card') startRelease(AN.side[k], st.ent); }
  else if (st.kind === 'meso') { S.mesoBite[k] = 2; sd.meso.pGoal = 1; sd.tubeGoal = 1; }
  else if (st.which === 'ant') sd.antGoal = 1;
  else if (st.which === 'post') { sd.postGoal = 1; startRelease(AN.side[k], 'upper'); }
  else if (st.id === 'vuf') S.vufGoal = 1;
  else if (st.id === 'colp') { S.colp.fill(1); S.colpDone = true; VG.dirty = true; }
  else if (st.id === 'deliver') deliverSpecimen();
  else if (st.id === 'cuff') { for (const x of [1.5, 0.9, 0.3, -0.3, -0.9, -1.5]) S.cuff.stitches.push({ x, da: 0.8, dp: 0.8 }); S.cuff.frontGoal = -2.8; S.cuff.done = true; }
  else if (st.id === 'final') { S.lowP = true; S.ureterOK.R = S.ureterOK.L = true; endCase(); }
}
function tlhWant(st, n) { // what a scripted hand should find under its tip at this target
  const um = /(right|left) ureter/.exec(n.label || '');
  return st.seal ? { ents: st.seal.ent === 'meso' ? ['meso', 'tube'] : [st.seal.ent], side: st.seal.side } : um ? { ents: ['ureter'], side: um[1] === 'right' ? 'R' : 'L' } : n.act === 'bite' ? { cuff: { edge: S.cuff.pending ? 'post' : 'ant', x: S.cuff.pending ? S.cuff.pending.x : st.nextX() } } : null;
}
const TLH = {
  id: 'tlh', name: 'Total laparoscopic hysterectomy', tag: ', bilateral salpingectomy', blurb: 'With both tubes; ovaries conserved. 21 steps.',
  sub: 'With bilateral salpingectomy. Ovaries conserved.',
  brief: ['46-year-old with heavy menstrual bleeding and fibroids after failed medical management. Mobile 10-week uterus, no previous abdominal surgery.',
    'She is in lithotomy and Trendelenburg with a uterine manipulator and colpotomy cup in place. 10 mm umbilical scope, two 5 mm lateral ports, pneumoperitoneum at 15 mmHg. You are looking toward the pelvis: her right is on the right of the screen.'],
  steps: TLH_STEPS, insts: ['grasper', 'bipolar', 'hook', 'suction', 'needle'], warp: [0, 0], tipZ: 4.6, ureters: true, eblWarn: 100,
  needleHint: 'The needle driver is for closing the vaginal cuff',
  score: tlhScore, debrief: tlhDebrief, sutures: tlhSutures, force: tlhForce, want: tlhWant
};
