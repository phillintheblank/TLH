// Build 0.3c, hand control made easier: identifying a ureter by holding near it, depth assist (slow approach, the
// tip stays on tissue and rides it, a clear draw back lifts it off), and target lock. Scripted hands with jitter.
import { installHandDriver, calibrate } from './handdriver.mjs';
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await installHandDriver(page, process.env.CAM || 'upright');
  await ev(() => { window.__simPause = true; window.__sim.HT.sim = true; window.__sim.DEPTH.auto = false; });
  await page.click('#btnBeginHands');
  const cal = await calibrate(page);
  ok(cal.status === 'ready', 'calibrated ' + JSON.stringify(cal.f));
  await ev(() => { window.__drv.noise = 0.004; });
  ok(await ev(() => window.__sim.DEPTH.assist && window.__sim.DEPTH.prio), 'depth assist and target lock are on by default');

  // --- hold near a ureter to identify it (target lock off, so this is the bare rule)
  let d = await ev(() => {
    const s = window.__sim, dr = window.__drv, T3 = s.THREE; s.DEPTH.prio = false; s.setActive('L'); dr.step(10);
    const n = s.next(), P = new T3.Vector3().fromArray(n.p), F = new T3.Vector3(); s.camera.getWorldDirection(F);
    const W = P.clone().addScaledVector(F, -0.8); // 8 mm short of it, toward the camera: beside it, not on it
    const r = dr.tipTo('L', W, 0.25, false, 400), h = s.HAND.L, d0 = h.tip.distanceTo(P), act0 = s.S.stats.activations;
    let n1 = 0; while (n1++ < 90 && !s.S.ureterID.R) dr.step(1);
    return { label: n.label, act: n.act, reached: r.ok, dist: +d0.toFixed(2), frames: n1, id: s.S.ureterID.R, pinched: s.HT.slot.L.pinch, act: s.S.stats.activations - act0, grab: !!h.grab };
  });
  ok(d.id && !d.pinched && !d.grab && d.act === 0, 'holding a tip beside the right ureter identifies it with no pinch ' + JSON.stringify(d));
  ok(d.frames < 60, 'within about a second of arriving (' + (d.frames / 30).toFixed(1) + ' s more)');
  d = await ev(() => { const s = window.__sim, dr = window.__drv; s.forceStep(); for (let i = 0; i < 60; i++) dr.step(1); s.setPoseGoal(s.STEPS[s.S.step].rec); dr.step(50); return s.STEPS[s.S.step].id; });

  // --- depth assist, on the front of the uterus: a broad, smooth surface (target lock still off)
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, T3 = s.THREE, h = s.HAND.R, RC = new T3.Raycaster();
    const ut = s.PICKS.find(m => m.userData.ent === 'uterus'), c = new T3.Box3().setFromObject(ut).getCenter(new T3.Vector3());
    const dd = c.clone().sub(h.port).normalize(); RC.set(h.port, dd); const f = RC.intersectObject(ut, false)[0], L = f.distance;
    dr.tipTo('R', h.port.clone().addScaledVector(dd, L - 5), 0.15, false, 500); dr.step(20);
    // push the hand steadily forward and watch the tip come down
    const gap = () => (h.ahead.hit ? h.ahead.dist - h.ins : 9); let far = 0, nearV = 0, nf = 0, nn = 0, maxPress = 0, i = 0;
    for (; i < 300 && !h.hold; i++) { const g0 = gap(), i0 = h.ins; dr.move('R', 0, 0, 0.004); dr.step(1); const v = h.ins - i0; if (i > 12 && g0 > 2) { far += v; nf++; } else if (g0 < 0.8 && g0 > 0.25) { nearV += v; nn++; } }
    const held = h.hold, t0 = h.touch, ent = h.pick.ent;
    for (let k = 0; k < 40; k++) { dr.move('R', 0, 0, 0.004); dr.step(1); maxPress = Math.max(maxPress, h.ins - h.ahead.dist); } // keep pushing: it must not dig in
    return { held, touch: t0, ent, far: +(far / Math.max(1, nf)).toFixed(3), near: +(nearV / Math.max(1, nn)).toFixed(3), nf, nn, maxPress: +maxPress.toFixed(2), frames: i };
  });
  ok(d.held && d.touch, 'pushing forward brings the tip to rest on the tissue ' + JSON.stringify(d));
  ok(d.nf > 3 && d.nn > 3 && d.near < d.far * 0.75, 'it slows on the way down (' + d.far + ' then ' + d.near + ' cm a frame)');
  ok(d.maxPress < 0.2, 'and pushing on does not dig in (' + d.maxPress + ' cm past the surface)');
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, h = s.HAND.R; let on = 0, n = 0; const t0 = h.tip.clone();
    for (let k = 0; k < 20; k++) { dr.move('R', 0.0025, 0.001, 0); dr.step(1); n++; if (h.touch) on++; } for (let k = 0; k < 8; k++) { dr.step(1); n++; if (h.touch) on++; }
    return { on, n, moved: +h.tip.distanceTo(t0).toFixed(2), hold: h.hold, ent: h.pick.ent };
  });
  ok(d.moved > 0.6 && d.hold && d.on >= d.n - 1, 'moving the hand sideways slides the tip over the tissue without losing contact ' + JSON.stringify(d));
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, h = s.HAND.R, o = {};
    for (let k = 0; k < 4; k++) { dr.move('R', 0, 0, -0.003); dr.step(1); } dr.step(12); o.small = h.hold && h.touch; // about 2 mm back
    for (let k = 0; k < 14; k++) { dr.move('R', 0, 0, -0.004); dr.step(1); } dr.step(12); o.big = !h.hold && !h.touch; o.gap = +(h.ahead.dist - h.ins).toFixed(2);
    return o;
  });
  ok(d.small, 'a small draw back does not lift it off');
  ok(d.big, 'a clear draw back does (now ' + d.gap + ' cm clear)');

  // --- target lock
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, T3 = s.THREE, h = s.HAND.R, o = {};
    const n = s.next(), P = new T3.Vector3().fromArray(n.p), dd = P.clone().sub(h.port), L = dd.length(); dd.normalize();
    const R = new T3.Vector3().setFromMatrixColumn(s.camera.matrixWorld, 0);
    // come in 4 mm to one side of the target and a centimetre short of it
    const W = h.port.clone().addScaledVector(dd, L - 1.2).addScaledVector(R, 0.4);
    dr.tipTo('R', W, 0.2, false, 400); o.before = h.lock; s.DEPTH.prio = true; // arrive with the lock off, then switch it on: the tip is 4 mm off and short
    let i = 0; for (; i < 60 && !h.lock; i++) dr.step(1);
    dr.step(10);
    o.lock = h.lock; o.frames = i; o.ent = h.pick.ent; o.side = h.pick.side; o.off = +h.tip.distanceTo(P).toFixed(2); o.touch = h.touch;
    // the left grasper passing the same spot is not caught
    o.leftFree = !s.HAND.L.lock;
    // seal, then cut with a second pinch, without re-aiming
    const e = s.S.side.R.round; dr.hands.R.ap = 0.14; let k = 0; while (k++ < 120 && !e.seals.length) dr.step(1); o.sealFrames = k; o.locked2 = h.lock;
    dr.hands.R.ap = 0.62; dr.step(14); dr.hands.R.ap = 0.14; dr.step(6); dr.hands.R.ap = 0.62; dr.step(10);
    o.seals = e.seals.length; o.cut = !!e.cut; o.bleed = s.S.bleeders.length; o.nonTarget = s.S.stats.nonTarget;
    return o;
  });
  ok(d.lock && d.ent === 'round' && d.side === 'R' && d.off < 0.45 && d.touch, 'coming close to the step\'s target, the bipolar settles onto it ' + JSON.stringify({ frames: d.frames, off: d.off, ent: d.ent }));
  ok(d.leftFree, 'the other hand\'s grasper is left alone');
  ok(d.seals >= 1 && d.cut && d.bleed === 0 && d.nonTarget === 0, 'a pinch seals and a second pinch divides, with no re-aiming ' + JSON.stringify({ seals: d.seals, cut: d.cut, sealFrames: d.sealFrames }));
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, T3 = s.THREE, o = {}, RC = new T3.Raycaster();
    // next step's target: lock on with whichever hand has the clear line to it, then leave by moving the hand clearly sideways
    for (let i = 0; i < 40; i++) dr.step(1);
    const n = s.next(); if (!n) return { none: true }; const P = new T3.Vector3().fromArray(n.p);
    const clear = h => { const v = P.clone().sub(h.port), L = v.length(); RC.set(h.port, v.normalize()); const f = RC.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0]; return f ? f.distance - L : 9; };
    const k = clear(s.HAND.R) >= clear(s.HAND.L) ? 'R' : 'L', h = s.HAND[k], sg = k === 'R' ? 1 : -1, dd = P.clone().sub(h.port), L = dd.length(); dd.normalize();
    s.setActive(k); s.setInst(k, s.STEPS[s.S.step].tool); dr.step(40);
    let i = 0; for (; i < 400 && !h.lock; i++) dr.nudge(k, h.port.clone().addScaledVector(dd, L - 0.8), 0.01);
    dr.step(12); o.lock = h.lock; o.step = s.STEPS[s.S.step].id; o.hand = k; const t0 = h.tip.clone();
    if (!h.lock) { const v = P.clone().sub(h.tip), al = v.dot(h.dir); o.why = { clearR: +clear(s.HAND.R).toFixed(2), clearL: +clear(s.HAND.L).toFixed(2), act: n.act, label: n.label, inst: h.inst, tool: s.STEPS[s.S.step].tool, hold: h.hold, touch: h.touch, ent: h.pick.ent, along: +al.toFixed(2), lat: +Math.sqrt(Math.max(0, v.lengthSq() - al * al)).toFixed(2), out: h.lockOut, eng: s.HT.slot[k].engaged, guided: s.S.guided, prio: s.DEPTH.prio, hid: !!n.hidden }; }
    for (let q = 0; q < 8; q++) { dr.move(k, 0.0015 * sg, 0, 0); dr.step(1); } dr.step(6); o.stayed = h.lock && h.tip.distanceTo(t0) < 0.15; // 2 mm of drift: still on
    for (let q = 0; q < 20; q++) { dr.move(k, 0.004 * sg, 0, 0); dr.step(1); } dr.step(6); o.left = !h.lock; o.moved = +h.tip.distanceTo(t0).toFixed(2);
    // guidance off: no lock
    s.S.guided = false; let j = 0; for (; j < 200 && !h.lock; j++) dr.nudge(k, h.port.clone().addScaledVector(dd, L - 0.8), 0.01); o.unguided = !h.lock; s.S.guided = true;
    return o;
  });
  ok(d.lock && d.stayed, 'small drift of the hand does not shake it off the target (' + d.step + ', ' + d.hand + ' hand) ' + JSON.stringify(d));
  ok(d.left && d.moved > 0.3, 'a clear sideways move lets go (' + d.moved + ' cm)');
  ok(d.unguided, 'with guidance off there is no lock');
  // --- the thumb goes out of the camera's sight: the grip keeps its state; the edge of view is flagged
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, R = dr.hands.R, sl = s.HT.slot.R, o = {};
    dr.clutch('R'); dr.step(20); R.ap = 0.62; R.hide = false; dr.step(10); o.open0 = !sl.pinch && !sl.hid;
    R.hide = true; dr.step(6); o.hid = sl.hid; R.ap = 0.14; dr.step(12); o.heldOpen = !sl.pinch;       // thumb hidden while the hand "closes": stays open
    R.hide = false; dr.step(8); o.closes = sl.pinch && !sl.hid;                                        // seen again: follows
    R.hide = true; dr.step(6); R.ap = 0.62; dr.step(12); o.heldShut = sl.pinch;                        // hidden while it "opens": stays closed
    R.opn = 1.95; R.ap = 0.9; dr.step(12); o.flatFrees = sl.clutch && !sl.engaged;                     // an open flat hand still takes over
    R.opn = 1.45; R.ap = 0.62; R.hide = false; dr.step(30); o.back = !sl.pinch && sl.engaged;
    R.ap = 0.14; dr.step(10); const p0 = sl.pinch; s.HT.tune.ghold = 0; R.hide = true; dr.step(12); o.offFollows = p0 && !sl.pinch && !sl.hid; s.HT.tune.ghold = 1; R.hide = false; R.ap = 0.62; dr.step(12); // the guess for a hidden thumb reads as open
    const y0 = R.y; R.y = 0.9; dr.step(6); o.edge = sl.edge; R.y = y0; dr.step(6); o.edgeClear = sl.edge;
    return o;
  });
  ok(d.open0 && d.hid && d.heldOpen, 'thumb hidden from the camera: an open instrument stays open ' + JSON.stringify(d));
  ok(d.closes, 'thumb seen again: the pinch is read');
  ok(d.heldShut, 'thumb hidden while pinched: the instrument stays closed');
  ok(d.flatFrees && d.back, 'an open flat hand still puts the instrument on hold, and curling it resumes');
  ok(d.offFollows, 'with grip hold switched off the tracker\'s guess is followed');
  ok(d.edge === 'bottom' && d.edgeClear === '', 'a hand at the bottom of the camera\'s view is flagged (' + d.edge + ')');
  console.log(fails ? fails + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
}
