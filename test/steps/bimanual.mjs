// Checks specific to two-handed control: simultaneous motion, traction with one hand while the other works,
// the open-hand clutch, a lost hand, and tracking noise. Prints PASS/FAIL per check.
import { installHandDriver, calibrate } from './handdriver.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  let fails = 0;
  const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : '')); if (!ok) fails++; };
  await installHandDriver(page, 'upright');
  await ev(() => { window.__simPause = true; window.__sim.HT.sim = true; }); // one camera, so auto depth; two cameras are covered by twocam.mjs
  await page.click('#btnBeginHands');
  await ev(() => { window.__drv.noise = 0.004; }); // jitter on every landmark frame
  const cal = await calibrate(page);
  check('calibration completes with jitter', cal.status === 'ready' && cal.running, cal);
  check('one camera: auto depth, directions learned', cal.n === 1 && !cal.free && cal.right[0][0] < -0.9 && cal.J[0][0][0] < -0.8 && cal.J[0][1][1] < -0.8, { right: cal.right, J: cal.J });

  // 1. both instruments move at the same time, each with its own hand, in the directions the user means
  let r = await ev(() => {
    const d = window.__drv, S = window.__sim, a = { L: { ...S.HAND.L.ptr }, R: { ...S.HAND.R.ptr } };
    for (let i = 0; i < 12; i++) { d.move('L', -0.005, 0.004, 0); d.move('R', 0.005, 0.004, 0); d.step(1); } // L hand left, R hand right, both up
    d.step(12);
    return { dL: [S.HAND.L.ptr.x - a.L.x, S.HAND.L.ptr.y - a.L.y], dR: [S.HAND.R.ptr.x - a.R.x, S.HAND.R.ptr.y - a.R.y], on: [S.HAND.L.ptr.on, S.HAND.R.ptr.on] };
  });
  check('both pointers move together: L goes left, R goes right, both up', r.on[0] && r.on[1] && r.dL[0] < -25 && r.dR[0] > 25 && r.dL[1] < -25 && r.dR[1] < -25, r);

  // 2. skip to the right round ligament; left hand grasps the right tube and pulls, right hand seals at the same time
  r = await ev(() => {
    const d = window.__drv, S = window.__sim;
    S.forceStep(); d.step(40); S.setPoseGoal(S.STEPS[S.S.step].rec); d.step(50);
    const p = S.proj(S.AN.side.R.cur.tubeCur[16].toArray());
    const m1 = d.moveTo('L', p.x, p.y); d.step(15);
    const entL = S.HAND.L.pick.ent;
    d.hands.L.ap = 0.14; d.step(6);
    const grabbed = !!(S.HAND.L.grab && S.HAND.L.grab.pull);
    const tipBefore = S.HAND.L.tip.toArray();
    const m2 = d.moveTo('L', p.x + 6, p.y - 70); d.step(15);
    const pull = S.S.pulls.length ? S.S.pulls[0].off.length() : 0;
    const n = S.next(); const m3 = d.moveTo('R', n.x, n.y); d.step(15);
    d.hands.R.ap = 0.14; let frames = 0; while (frames < 120 && S.next() && S.next().act === 'seal') { d.step(1); frames++; }
    const sealed = S.S.side.R.round.seals.length, stillHolding = !!(S.HAND.L.grab && S.HAND.L.grab.pull);
    d.hands.R.ap = 0.62; d.step(14); d.hands.R.ap = 0.14; d.step(5); d.hands.R.ap = 0.62; d.step(10);
    return { m1, m2, m3, entL, grabbed, pull: +pull.toFixed(2), sealed, stillHolding, cut: S.S.side.R.round.cut, tipMoved: +S.HAND.L.tip.distanceTo(new S.THREE.Vector3(...tipBefore)).toFixed(2), traction: S.S.stats.traction, unsealed: S.S.stats.unsealedCuts };
  });
  check('left hand grasps the tube and holds traction', r.grabbed && r.pull > 0.5 && r.entL === 'tube', r);
  check('right hand seals while the left keeps holding', r.sealed === 1 && r.stillHolding, { sealed: r.sealed, holding: r.stillHolding });
  check('second pinch on the sealed zone fires the cut blade cleanly', r.cut && r.unsealed === 0, { cut: r.cut, unsealed: r.unsealed });

  // 3. clutch: opening the left hand flat keeps the grasp latched and freezes the instrument while the hand moves away
  r = await ev(() => {
    const d = window.__drv, S = window.__sim, L = d.hands.L, h = S.HAND.L;
    L.opn = 1.95; L.ap = 0.9; d.step(10);
    const held1 = !!(h.grab && h.grab.pull), on1 = h.ptr.on, tip = h.tip.clone();
    L.X[0] -= 0.08; L.X[1] -= 0.07; d.step(15);
    const moved = h.tip.distanceTo(tip), clutch = S.HT.slot.L.clutch;
    L.opn = 1.45; L.ap = 0.14; d.step(22); // come back still pinched: keep holding, no jump
    const held2 = !!(h.grab && h.grab.pull), on2 = h.ptr.on, jump = h.tip.distanceTo(tip);
    L.ap = 0.62; d.step(20); // relax: release after the short delay
    return { held1, on1, clutch, moved: +moved.toFixed(3), held2, on2, jump: +jump.toFixed(3), releasedAfterRelax: !h.grab };
  });
  check('open hand = hold: grasp stays latched, pointer off, instrument still while the hand moves', r.held1 && !r.on1 && r.clutch && r.moved < 0.05, r);
  check('curling the hand again re-engages without a jump and keeps the grasp if still pinched', r.held2 && r.on2 && r.jump < 0.25, { held2: r.held2, on2: r.on2, jump: r.jump });
  check('relaxing the pinch releases the tissue', r.releasedAfterRelax);

  // 4. energy stops the moment the hand opens or is lost; a hand that returns pinched must relax before firing again
  r = await ev(() => {
    const d = window.__drv, S = window.__sim, R = d.hands.R, h = S.HAND.R;
    S.setInst('R', 'hook'); d.step(30);
    const c = S.proj(S.UT.M.elements.slice(12, 15)); d.moveTo('R', c.x, c.y - 40); d.step(10);
    R.ap = 0.14; d.step(6); const firing1 = h.firing;
    R.opn = 1.95; R.ap = 0.9; d.step(8); const firing2 = h.firing;
    R.opn = 1.45; R.ap = 0.14; d.step(22); const firing3 = h.firing, on3 = h.ptr.on; // back, already pinched
    R.ap = 0.62; d.step(6); R.ap = 0.14; d.step(6); const firing4 = h.firing;
    R.vis = false; d.step(14); const firing5 = h.firing, on5 = h.ptr.on, lostL = S.HAND.L.ptr.on;
    R.vis = true; R.ap = 0.62; d.step(24); const on6 = h.ptr.on, slotR = S.HT.slot.R.engaged, slotL = S.HT.slot.L.engaged;
    return { firing1, firing2, firing3, on3, firing4, firing5, on5, lostL, on6, slotR, slotL };
  });
  check('pinch fires the hook; opening the hand stops it at once', r.firing1 && !r.firing2, r);
  check('returning already pinched does not fire until relaxed and pinched again', !r.firing3 && r.on3 && r.firing4, { f3: r.firing3, on3: r.on3, f4: r.firing4 });
  check('losing a hand stops its energy and holds only that instrument; it re-engages on return', !r.firing5 && !r.on5 && r.lostL && r.on6, { f5: r.firing5, on5: r.on5, L: r.lostL, on6: r.on6 });

  // 4b. a hand that sweeps through the view without settling does not take the instrument
  r = await ev(() => {
    const d = window.__drv, S = window.__sim, R = d.hands.R, h = S.HAND.R;
    R.vis = false; d.step(14); const tip = h.tip.clone();
    R.vis = true; R.X = [0.2, 0.12, 0]; let took = false;
    for (let i = 0; i < 12; i++) { R.X[0] -= 0.03; R.X[1] -= 0.015; d.step(1); took = took || h.ptr.on; }
    R.vis = false; d.step(12);
    const moved = h.tip.distanceTo(tip);
    R.vis = true; R.X = d.HOME.R.slice(); d.step(26);
    return { took, moved: +moved.toFixed(3), backOn: h.ptr.on };
  });
  check('a hand sweeping through the view does not take the instrument; a settled hand does', !r.took && r.moved < 0.05 && r.backOn, r);

  // 5. mouse fallback: turning hand control off hands the active instrument back to the mouse
  await ev(() => { window.__sim.htDisable(); window.__sim.tick(0.033); });
  const box = await page.locator('#ov').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  r = await ev(() => { const S = window.__sim; for (let i = 0; i < 10; i++) S.tick(0.033); return { mode: S.CTRL.mode, status: S.HT.status, on: S.HAND.R.ptr.on, running: S.S.running }; });
  check('mouse fallback works after turning hand control off', r.mode === 'mouse' && r.on && r.running, r);
  console.log(fails ? fails + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED');
  await ev(() => window.__sim.render());
}
