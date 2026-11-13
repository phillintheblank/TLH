// Two-camera hand control. Scripted hands in real space, seen by a simulated camera in front and a second one higher
// up and looking down (true perspective, tracker jitter added), through the whole hand-control pipeline.
// RIG=shallow runs only the placement check: a second camera too low to see forward movement well must be flagged.
import { installHandDriver, calibrate } from './handdriver.mjs';
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const rig = process.env.RIG || 'two';
  await installHandDriver(page, rig);
  await ev(() => { window.__simPause = true; window.__sim.HT.sim = true; window.__drv.noise = 0.004; });
  await page.click('#btnBeginHands');
  const cal = await calibrate(page);
  if (rig === 'shallow') {
    // the second camera looks nearly level: either the forward step refuses it, or calibration ends with a warning
    const note = cal.fail ? cal.note : await ev(() => [...document.querySelectorAll('#toasts > *, .toast')].map(e => e.textContent).join(' | '));
    ok(cal.fail === 'forward' ? /second camera/.test(note) : cal.depthNoise > 2.6, 'a second camera that is too low is flagged ' + JSON.stringify(cal.fail ? { step: cal.fail, note } : { depthNoise: cal.depthNoise }));
    console.log(fails ? fails + ' CHECKS FAILED' : 'ALL CHECKS PASSED'); return;
  }
  ok(cal.status === 'ready' && cal.running && cal.n === 2 && cal.refused === 0, 'calibration with two cameras completes under jitter ' + JSON.stringify(cal));
  ok(cal.free, 'two cameras give hand control of depth');
  ok(cal.depthNoise > 0 && cal.depthNoise < 2.6, 'the second camera\'s view of forward movement is rated good (jitter reaching depth x' + cal.depthNoise + ')');
  // position of a tip in the scope's own frame: right, up, depth into the picture (cm)
  await ev(() => {
    const S = window.__sim, T3 = S.THREE;
    window.__cf = k => { const c = S.camera, h = S.HAND[k], R = new T3.Vector3().setFromMatrixColumn(c.matrixWorld, 0), U = new T3.Vector3().setFromMatrixColumn(c.matrixWorld, 1), F = c.getWorldDirection(new T3.Vector3()), v = h.port.clone().addScaledVector(h.dir, h.ins).sub(c.position); return [v.dot(R), v.dot(U), v.dot(F)]; };
    window.__mv = (k, a, b, c, n) => { const d = window.__drv, p = window.__cf(k); for (let i = 0; i < n; i++) { d.move(k, a / n, b / n, c / n); d.step(1); } d.step(14); const q = window.__cf(k); return [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; };
    // the same, averaged over a second, so that a comparison is of where the tip rests and not of its tremor
    // (two such averages of a still hand differ by up to about 0.04 cm at this jitter)
    window.__av = k => { const a = [0, 0, 0]; for (let i = 0; i < 30; i++) { window.__drv.step(1); const p = window.__cf(k); for (let j = 0; j < 3; j++) a[j] += p[j] / 30; } return a; };
    window.__gap = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (const k of ['L', 'R']) S.HAND[k].ins = 10.5; // start both tips clear of tissue and of the edges of the working space
    window.__drv.step(10);
  });
  const f2 = a => a.map(v => +v.toFixed(2));
  // --- the tip follows the hand. 0.06 picture-heights of travel is 3.7 cm of hand; what that should be at the tip
  // follows from the sensitivity setting and how far the tip is from the scope, as it does with one camera.
  const want = await ev(() => { const S = window.__sim, c = S.camera, F = c.getWorldDirection(new S.THREE.Vector3()), h = S.HAND.R; return 0.06 * S.HT.tune.gain * 2 * h.tip.clone().sub(c.position).dot(F) * Math.tan((c.fov * Math.PI) / 360); });
  // Travel is scaled by the tip's distance from the lens, so a push inward gains a little as it goes (and gives it back on the way out).
  const near = v => v > 0.82 * want && v < 1.22 * want, nearIn = v => v > 0.82 * want && v < 1.36 * want;
  let d = await ev(() => window.__mv('R', -0.06, 0, 0, 12)); const right = -d[0];
  ok(near(right) && Math.abs(d[1]) < 0.1 * right && Math.abs(d[2]) < 0.1 * right, 'hand left moves the tip left by the expected ' + want.toFixed(2) + ' cm, and nothing else ' + JSON.stringify(f2(d)));
  d = await ev(() => window.__mv('R', 0, 0.06, 0, 12)); const up = d[1];
  ok(near(up) && Math.abs(d[0]) < 0.1 * up && Math.abs(d[2]) < 0.1 * up, 'hand up moves the tip up, and nothing else ' + JSON.stringify(f2(d)));
  d = await ev(() => window.__mv('R', 0, 0, 0.06, 12)); const fwd = d[2];
  ok(nearIn(fwd) && Math.abs(d[0]) < 0.1 * fwd && Math.abs(d[1]) < 0.1 * fwd, 'hand forward drives the tip into the picture, and nothing else ' + JSON.stringify(f2(d)));
  d = await ev(() => window.__mv('L', 0, 0, 0.06, 12));
  ok(nearIn(d[2]) && Math.abs(d[0]) < 0.1 * d[2] && Math.abs(d[1]) < 0.1 * d[2], 'the left hand too, on the other side of both pictures ' + JSON.stringify(f2(d)));
  ok(Math.max(right, up, fwd) / Math.min(right, up, fwd) < 1.36, 'the same hand travel gives about the same tip travel in every direction (' + f2([right, up, fwd]).join(', ') + ' cm)');
  d = await ev(() => window.__mv('R', 0, 0, -0.06, 12));
  ok(Math.abs(d[2] + fwd) < 0.2, 'drawing the hand back the same distance brings the tip back (' + d[2].toFixed(2) + ' cm): no slack on reversing');
  d = await ev(() => { const dr = window.__drv, a = window.__cf('L'), b = window.__cf('R'); for (let i = 0; i < 12; i++) { dr.move('L', 0, 0, 0.005); dr.move('R', 0, 0, -0.005); dr.step(1); } dr.step(14); const p = window.__cf('L'), q = window.__cf('R'); return [p[2] - a[2], q[2] - b[2]]; });
  ok(d[0] > 0.8 && d[1] < -0.8, 'both hands at once: left in ' + d[0].toFixed(2) + ' cm, right out ' + d[1].toFixed(2) + ' cm');

  // --- what used to make the instrument jump
  d = await ev(() => { const dr = window.__drv; window.__sim.HAND.L.ins = 10.5; dr.step(10); const a = window.__av('L'); dr.hands.L.ap = 0.14; dr.step(12); const b = window.__av('L'); dr.hands.L.ap = 0.62; dr.step(10); return window.__gap(a, b); });
  ok(d < 0.08, 'pinching in free space does not move the tip (' + d.toFixed(3) + ' cm)');
  d = await ev(() => { // the tracker's idea of how large the hand looks changes by 12%: this is not movement
    const dr = window.__drv, S = window.__sim, a = window.__av('R'), fake = S.fakeHand; let k = 1;
    S.fakeHand = o => fake(Object.assign({}, o, { size: o.size * k }));
    for (const v of [1.12, 0.9, 1.05, 1]) { k = v; dr.step(8); }
    S.fakeHand = fake; return window.__gap(a, window.__av('R'));
  });
  ok(d < 0.08, 'a hand that looks larger or smaller to the cameras does not move the tip (' + d.toFixed(3) + ' cm)');
  d = await ev(() => { const dr = window.__drv, a = window.__cf('R'); let far = 0; for (let i = 0; i < 120; i++) { dr.step(1); const b = window.__cf('R'); far = Math.max(far, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); } const b = window.__cf('R'); return [Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), far]; });
  ok(d[0] < 0.12 && d[1] < 0.2, 'a still hand with tracker jitter does not creep over 4 s (ends ' + d[0].toFixed(2) + ' cm away, never more than ' + d[1].toFixed(2) + ' cm)');
  // clutch: open hand holds the instrument, and taking it again does not make it jump (ratchet)
  d = await ev(() => {
    const dr = window.__drv, h = dr.hands.R, a = window.__cf('R');
    h.opn = 1.95; h.ap = 0.9; dr.step(10); for (let i = 0; i < 10; i++) { dr.move('R', 0, 0, -0.012); dr.step(1); } const b = window.__cf('R');
    h.opn = 1.45; h.ap = 0.62; dr.step(24); const c = window.__cf('R');
    for (let i = 0; i < 12; i++) { dr.move('R', 0, 0, 0.005); dr.step(1); } dr.step(14); const e = window.__cf('R');
    return [Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), e[2] - c[2]];
  });
  // taking the instrument again starts from one jittery reading of the hand, worth up to about 0.15 cm
  ok(d[0] < 0.2 && d[1] < 0.2, 'an open flat hand holds the instrument while the hand moves 12 cm back (' + d[0].toFixed(2) + ', ' + d[1].toFixed(2) + ' cm)');
  ok(d[2] > 0.8, 'curling again carries on from there: forward ' + d[2].toFixed(2) + ' cm');

  // --- one camera loses the hand
  d = await ev(() => {
    const dr = window.__drv, S = window.__sim, R = dr.hands.R, o = {}; let a = window.__av('R');
    R.lost[1] = true; dr.step(14); let b = window.__av('R'); o.dropJump = window.__gap(a, b); o.engaged = S.HT.slot.R.engaged;
    let m = window.__mv('R', -0.04, 0, 0, 10); o.left = -m[0];
    m = window.__mv('R', 0, 0, 0.04, 10); o.fwdUnseen = m; // the camera in front sees almost nothing of this
    a = window.__av('R'); R.lost[1] = false; dr.step(14); b = window.__av('R'); o.backJump = window.__gap(a, b);
    m = window.__mv('R', 0, 0, 0.04, 10); o.fwdAgain = m[2];
    // and the other way round: the camera in front loses it
    a = window.__av('R'); R.lost[0] = true; dr.step(14); b = window.__av('R'); o.dropJump2 = window.__gap(a, b);
    m = window.__mv('R', 0, 0, -0.04, 10); o.backOnTop = m[2];
    a = window.__av('R'); R.lost[0] = false; dr.step(14); b = window.__av('R'); o.backJump2 = window.__gap(a, b);
    return o;
  });
  ok(d.engaged && d.dropJump < 0.15 && d.left > 0.5, 'the second camera loses the hand: no jump, and the instrument still follows sideways (' + d.left.toFixed(2) + ' cm) ' + JSON.stringify({ jump: +d.dropJump.toFixed(3) }));
  ok(Math.abs(d.fwdUnseen[2]) < 0.3, 'forward travel that only the front camera could see is not read as depth ' + JSON.stringify(f2(d.fwdUnseen)));
  ok(d.backJump < 0.15 && d.fwdAgain > 0.5, 'the camera finds the hand again: no jump (' + d.backJump.toFixed(3) + ' cm) and depth works (' + d.fwdAgain.toFixed(2) + ' cm)');
  ok(d.dropJump2 < 0.15 && d.backOnTop < -0.4 && d.backJump2 < 0.15, 'the front camera loses the hand: no jump, and depth still follows through the second camera ' + JSON.stringify({ back: +d.backOnTop.toFixed(2), jumps: [+d.dropJump2.toFixed(3), +d.backJump2.toFixed(3)] }));

  // --- the grip is read from the camera that sees it clearly
  d = await ev(() => {
    const dr = window.__drv, sl = window.__sim.HT.slot.R, R = dr.hands.R, o = {};
    R.gz = [0.96, 0]; R.apSeen = [0.18, null]; dr.step(25); // the front camera looks along the gap and guesses "pinched"; the hand is open
    o.src = sl.src; o.falsePinch = sl.pinch;
    R.ap = 0.14; R.apSeen = [0.55, null]; dr.step(12); o.realPinch = sl.pinch; // now it really pinches, and the front camera guesses "open"
    R.ap = 0.62; R.apSeen = [null, null]; R.gz = [0, 0]; dr.step(20); o.open = !sl.pinch;
    return o;
  });
  ok(d.src === 1 && !d.falsePinch, 'a camera looking along the gap between thumb and fingers is not believed: no false pinch');
  ok(d.realPinch && d.open, 'the real pinch is read from the camera that sees it side-on');
  d = await ev(() => { const dr = window.__drv, S = window.__sim, R = dr.hands.R, home = R.X.slice(); let w = ''; for (let i = 0; i < 60 && !S.HT.slot.R.c[1].edge && !S.HT.slot.R.c[0].edge; i++) { R.X[2] += 0.006; dr.step(1); } const e = [S.HT.slot.R.c[0].edge, S.HT.slot.R.c[1].edge]; R.X = home; dr.clutch('R'); dr.step(10); return e; });
  ok(d[0] || d[1], 'a hand reaching the edge of a camera\'s view is flagged, by camera (front: "' + d[0] + '", second: "' + d[1] + '")');

  // --- hold near a ureter to identify it: no pinch
  d = await ev(() => {
    const s = window.__sim, dr = window.__drv, T3 = s.THREE; dr.step(10);
    const n = s.next(), P = new T3.Vector3().fromArray(n.p), F = new T3.Vector3(); s.camera.getWorldDirection(F);
    const RC = new T3.Raycaster(), clear = h => { const v = P.clone().sub(h.port), L = v.length(); RC.set(h.port, v.normalize()); const f = RC.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0]; return f ? f.distance - L : 9; };
    const k = clear(s.HAND.L) >= clear(s.HAND.R) ? 'L' : 'R', h = s.HAND[k], act0 = s.S.stats.activations;
    const r = dr.tipTo(k, P.clone().addScaledVector(F, -0.8), 0.25, false, 500); // 8 mm short of it, toward the scope: beside it, not on it
    let n1 = 0; while (n1++ < 90 && !s.S.ureterID.R) dr.step(1);
    return { act: n.act, label: n.label, hand: k, reached: r.ok, frames: n1, id: s.S.ureterID.R, pinched: s.HT.slot[k].pinch, fired: s.S.stats.activations - act0, grab: !!h.grab };
  });
  ok(d.id && !d.pinched && !d.grab && d.fired === 0 && d.frames < 60, 'holding a tip beside the right ureter identifies it with no pinch ' + JSON.stringify(d));

  // --- contact, sealing and cutting by hand, on the right round ligament
  await ev(() => { const s = window.__sim; s.forceStep(); for (let i = 0; i < 60; i++) window.__drv.step(1); s.setPoseGoal(s.STEPS[s.S.step].rec); window.__drv.step(50); });
  let r;
  // --- pressing on a broad surface, the body of the uterus: the tissue dents and stops the tip, which stays where
  // it is: no slide, no jump, and no slack to take up on the way back
  r = await ev(() => {
    const s = window.__sim, T3 = s.THREE, B = new T3.Box3(), RC = new T3.Raycaster(), P = new T3.Vector3();
    for (const m of s.PICKS) if (m.userData.ent === 'uterus' && s.shown(m)) B.expandByObject(m);
    // a spot on the uterus that one of the ports has a clear line to
    for (const k of ['R', 'L']) for (const fx of [0.5, 0.35, 0.65]) for (const fy of [0.5, 0.7, 0.3]) for (const fz of [0.5, 0.7, 0.3]) {
      P.set(B.min.x + (B.max.x - B.min.x) * fx, B.min.y + (B.max.y - B.min.y) * fy, B.min.z + (B.max.z - B.min.z) * fz);
      RC.set(s.HAND[k].port, P.sub(s.HAND[k].port).normalize());
      const f = RC.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0]; if (!f || f.object.userData.ent !== 'uterus') continue;
      let r; for (let t = 0; t < 4; t++) { r = window.__drv.reach(k, f.point.toArray(), t, { ents: ['uterus'] }); if (r.good) break; }
      window.__pk = k; return r;
    }
    return { good: false, ent: 'no clear line' };
  });
  d = await ev(() => {
    const dr = window.__drv, k = window.__pk || 'R', h = window.__sim.HAND[k], tip = () => h.port.clone().addScaledVector(h.dir, h.ins), o = { step: 0 };
    let p = tip(); const walk = (n, dz) => { for (let i = 0; i < n; i++) { dr.move(k, 0, 0, dz); dr.step(1); const q = tip(); o.step = Math.max(o.step, q.distanceTo(p)); p = q; } };
    for (let i = 0; i < 40 && !h.touch; i++) walk(1, 0.003); o.ent = h.pick.ent;
    walk(12, 0.004); for (let i = 0; i < 30 && h.press < 0.5; i++) walk(1, 0.004); dr.step(10); const a = tip(); o.press = h.press; o.touch = h.touch; // up to the stop
    walk(12, 0.004); dr.step(10); o.slide = tip().distanceTo(a); o.press2 = h.press; // 3 cm more of hand travel
    const b = tip(); walk(6, -0.004); dr.step(8); o.back = tip().distanceTo(b); // 1.5 cm of hand travel back
    for (let i = 0; i < 12 && !h.touch; i++) walk(1, 0.003); walk(3, 0.003); dr.step(10); o.onTissue = h.touch;
    const c = window.__av(k); dr.hands[k].ap = 0.4; dr.step(12); o.grip = window.__gap(c, window.__av(k)); dr.hands[k].ap = 0.62; dr.step(10); // fingers closing, short of a pinch
    return o;
  });
  ok(d.touch && d.ent === 'uterus' && d.press > 0.15 && d.press <= 0.71 && d.press2 <= 0.71, 'pushing on into the body of the uterus dents it and is stopped (dent ' + d.press.toFixed(2) + ' cm, then ' + d.press2.toFixed(2) + ' cm)');
  ok(d.slide < 0.35 && d.step < 0.3, 'pushing on against tissue does not walk the tip along it or make it jump (moved ' + d.slide.toFixed(2) + ' cm, largest step in one frame ' + d.step.toFixed(2) + ' cm)');
  ok(d.back > 0.35, 'drawing back answers at once, with no slack to take up (' + d.back.toFixed(2) + ' cm)');
  ok(d.onTissue && d.grip < 0.1, 'closing the fingers with the tip resting on tissue does not move it (' + d.grip.toFixed(3) + ' cm)');
  d = await ev(() => { const dr = window.__drv, k = window.__pk || 'R', h = window.__sim.HAND[k]; let n = 0; while (n++ < 60 && h.touch) { dr.move(k, 0, 0, -0.006); dr.step(1); } for (let i = 0; i < 8; i++) { dr.move(k, 0, 0, -0.006); dr.step(1); } return n; });
  ok(d < 45, 'drawing back frees the tip (' + d + ' frames)');
  r = await ev(() => { const n = window.__sim.next(); let r; for (let t = 0; t < 4; t++) { r = window.__drv.reach('R', n.p, t, n.want); if (r.good) break; } return r; });
  ok(r.good && r.ent === 'round', 'right hand brings the bipolar into contact with the round ligament ' + JSON.stringify({ ent: r.ent, short: r.short, off: r.off, clutches: r.clutches }));
  d = await ev(() => {
    const dr = window.__drv, s = window.__sim, e = s.S.side.R.round, aim = () => { const n = s.next(); for (let t = 0; t < 4; t++) if (dr.reach('R', n.p, t, n.want).good) return true; return false; };
    const o = { on: aim() }; dr.hands.R.ap = 0.14; let n = 0; while (n++ < 120 && !e.seals.length) dr.step(1); o.sealFrames = n;
    dr.hands.R.ap = 0.62; dr.step(14); o.on2 = aim(); // sealed tissue shrinks a little: re-seat the tip, as a person would
    dr.hands.R.ap = 0.14; dr.step(6); dr.hands.R.ap = 0.62; dr.step(10);
    return Object.assign(o, { seals: e.seals.length, cut: !!e.cut, bleed: s.S.bleeders.length, nonTarget: s.S.stats.nonTarget });
  });
  ok(d.seals >= 1 && d.cut && d.bleed === 0 && d.nonTarget === 0, 'a pinch seals in contact and a second pinch divides, with no bleeding ' + JSON.stringify(d));

  // --- traction in depth: the left grasper takes the tube or round ligament and moves it
  r = await ev(() => { // a spot that the left port has a clear line to
    const s = window.__sim, T3 = s.THREE, G = s.AN.side.L.cur, R = new T3.Raycaster(), port = s.HAND.L.port, v = new T3.Vector3();
    for (const a of [G.tube, G.round]) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const p = a[Math.floor(a.length * t)]; R.set(port, v.copy(p).sub(port).normalize());
      const f = R.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0], ud = f && f.object.userData;
      if (ud && (ud.ent === 'tube' || ud.ent === 'round') && ud.side === 'L' && f.point.distanceTo(p) < 0.6) { window.__tgt = { p: p.toArray(), want: { ents: [ud.ent], side: 'L' } }; let r; for (let t = 0; t < 4; t++) { r = window.__drv.reach('L', window.__tgt.p, t, window.__tgt.want); if (r.good) break; } return r; }
    }
    return { good: false, ent: 'nothing in reach' };
  });
  ok(r.good, 'left hand brings the grasper onto the ' + r.ent);
  d = await ev(() => {
    const dr = window.__drv, h = window.__sim.HAND.L, T = window.__tgt; dr.hands.L.ap = 0.14; dr.step(8);
    // a grasp that closes on nothing is let go and taken again, as a person would
    for (let t = 1; t < 4 && !(h.grab && h.grab.pull) && T; t++) { dr.hands.L.ap = 0.62; dr.step(14); dr.reach('L', T.p, t, T.want); dr.hands.L.ap = 0.14; dr.step(8); }
    const g0 = h.grab && h.grab.pull ? 1 : 0, t0 = h.tip.clone();
    for (let i = 0; i < 14; i++) { dr.move('L', 0, 0.004, -0.005); dr.step(1); } dr.step(10);
    const off = h.grab && h.grab.pull ? h.grab.pull.off.length() : -1, moved = h.tip.distanceTo(t0);
    dr.hands.L.ap = 0.62; dr.step(20);
    return { g0, off: +off.toFixed(2), moved: +moved.toFixed(2), released: !h.grab };
  });
  ok(d.g0 === 1 && d.off > 0.4 && d.moved > 0.4 && d.released, 'a pinch grasps, moving the hand up and back moves the tissue, and relaxing lets go ' + JSON.stringify(d));

  // --- a structure that crosses the shaft behind the tip must not pull the tip back to itself. Put the left tip
  // beyond the uterus, with the shaft running through it, and work there.
  d = await ev(() => {
    const s = window.__sim, T3 = s.THREE, dr = window.__drv, h = s.HAND.L, tip = () => h.port.clone().addScaledVector(h.dir, h.ins), RC = new T3.Raycaster(), B = new T3.Box3();
    s.htDisable(); s.tick(0.033); dr.hands.L.X = dr.HOME.L.slice(); dr.hands.R.X = dr.HOME.R.slice(); document.getElementById('btnHands').click(); dr.step(10);
    const saved = s.HT.status !== 'ready'; if (saved) document.getElementById('calSaved').click();
    dr.step(40);
    for (const m of s.PICKS) if (m.userData.ent === 'uterus' && s.shown(m)) B.expandByObject(m);
    const dir = B.getCenter(new T3.Vector3()).sub(h.port).normalize(); RC.set(h.port, dir);
    const hits = RC.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object) && x.object.userData.ent === 'uterus'); if (!hits.length) return { status: s.HT.status, saved, none: true };
    const first = () => { RC.set(h.port, h.dir); const f = RC.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0]; return f ? f.distance : 99; };
    h.dir.copy(dir); h.ins = hits[0].distance + 3.2; const p0 = tip(); let p = p0.clone(), big = 0, crossed = 0, n = 0;
    const walk = (frames, a, b, c) => { for (let i = 0; i < frames; i++, n++) { dr.move('L', a, b, c); dr.step(1); const q = tip(); big = Math.max(big, q.distanceTo(p)); p = q; if (first() < h.ins - 1.2) crossed++; } };
    walk(30, 0, 0, 0); const still = tip().distanceTo(p0);
    walk(40, 0.0006, 0, 0); walk(80, -0.0006, 0, 0); walk(40, 0, 0.0006, 0); walk(40, 0, 0, -0.0008);
    return { status: s.HT.status, saved, frames: n, still: +still.toFixed(2), big: +big.toFixed(2), crossed, behind: +(h.ins - first()).toFixed(1) };
  });
  ok(d.status === 'ready' && d.saved, 'turning hand control off and on again offers the last two-camera calibration');
  ok(!d.none && d.crossed > 100 && d.still < 0.3 && d.big < 0.35, 'with the uterus across the shaft behind the tip, the tip stays where the hand puts it: held still it moves ' + d.still + ' cm, and working there it never moves more than ' + d.big + ' cm in one frame ' + JSON.stringify({ crossed: d.crossed, frames: d.frames }));
  console.log(fails ? fails + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
}
