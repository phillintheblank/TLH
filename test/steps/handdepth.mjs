// Hand control in free depth, with scripted hands and a camera model (CAM=upright|tilted): the three learned
// directions, depth from how large the palm looks, both hands at once, clutch and ratchet, jitter, contact,
// traction in depth, and the auto-depth fallback.
import { installHandDriver, calibrate } from './handdriver.mjs';
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a), CAM = process.env.CAM || 'upright';
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await installHandDriver(page, CAM);
  // these checks are of the bare hand-to-tip mapping and contact, so depth assist and target lock are off (assist.mjs covers them)
  await ev(() => { window.__simPause = true; const s = window.__sim; s.HT.sim = true; s.DEPTH.assist = false; s.DEPTH.prio = false; window.__drv.noise = 0.004; });
  await page.click('#btnBeginHands');
  const cal = await calibrate(page);
  ok(cal.status === 'ready' && cal.running, 'calibration with a forward step completes under jitter ' + JSON.stringify({ r: cal.r, u: cal.u, f: cal.f, fail: cal.fail, note: cal.note }));
  ok(await ev(() => window.__sim.freeDepth()), 'hand control runs in free depth');
  // position of a tip in the camera's own frame: right, up, depth into the picture (cm)
  await ev(() => {
    const S = window.__sim, T3 = S.THREE;
    window.__cf = k => { const c = S.camera, h = S.HAND[k], R = new T3.Vector3().setFromMatrixColumn(c.matrixWorld, 0), U = new T3.Vector3().setFromMatrixColumn(c.matrixWorld, 1), F = c.getWorldDirection(new T3.Vector3()), v = h.port.clone().addScaledVector(h.dir, h.ins).sub(c.position); return [v.dot(R), v.dot(U), v.dot(F)]; };
    window.__mv = (k, a, b, c, n) => { const d = window.__drv, p = window.__cf(k); for (let i = 0; i < n; i++) { d.move(k, a / n, b / n, c / n); d.step(1); } d.step(14); const q = window.__cf(k); return [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; };
    // start both tips well clear of tissue
    for (const k of ['L', 'R']) { const h = S.HAND[k]; h.ins = 10.5; } window.__drv.step(10);
  });
  const f2 = a => a.map(v => +v.toFixed(2));
  let d = await ev(() => window.__mv('R', 0.06, 0, 0, 12));
  ok(d[0] > 0.8 && Math.abs(d[1]) < 0.35 * d[0] && Math.abs(d[2]) < 0.45 * d[0], 'hand right moves the tip right ' + JSON.stringify(f2(d)));
  d = await ev(() => window.__mv('R', 0, 0.06, 0, 12));
  ok(d[1] > 0.8 && Math.abs(d[0]) < 0.35 * d[1] && Math.abs(d[2]) < 0.45 * d[1], 'hand up moves the tip up ' + JSON.stringify(f2(d)));
  d = await ev(() => window.__mv('R', 0, 0, 0.06, 12));
  ok(d[2] > 0.7 && Math.abs(d[0]) < 0.35 * d[2] && Math.abs(d[1]) < 0.35 * d[2], 'hand forward drives the tip into the picture ' + JSON.stringify(f2(d)));
  const fwd = d[2];
  d = await ev(() => window.__mv('R', 0, 0, -0.06, 12));
  ok(d[2] < -0.7, 'hand back draws it out ' + JSON.stringify(f2(d)));
  // both hands at once, opposite ways in depth
  d = await ev(() => { const dr = window.__drv, a = window.__cf('L'), b = window.__cf('R'); for (let i = 0; i < 12; i++) { dr.move('L', 0, 0, 0.005); dr.move('R', 0, 0, -0.005); dr.step(1); } dr.step(14); const p = window.__cf('L'), q = window.__cf('R'); return [p[2] - a[2], q[2] - b[2]]; });
  ok(d[0] > 0.7 && d[1] < -0.7, 'both hands at once: left in ' + d[0].toFixed(2) + ' cm, right out ' + d[1].toFixed(2) + ' cm');
  // pinching is not a move in depth
  d = await ev(() => { const dr = window.__drv, a = window.__cf('L'); dr.hands.L.ap = 0.14; dr.step(20); const b = window.__cf('L'); dr.hands.L.ap = 0.62; dr.step(10); return Math.abs(b[2] - a[2]); });
  ok(d < 0.15, 'pinching does not move the tip in depth (' + d.toFixed(2) + ' cm)');
  // a still hand with tracker jitter does not creep
  d = await ev(() => { const dr = window.__drv, a = window.__cf('R'); dr.step(120); const b = window.__cf('R'); return [Math.abs(b[2] - a[2]), Math.hypot(b[0] - a[0], b[1] - a[1])]; });
  ok(d[0] < 0.2 && d[1] < 0.2, 'a still hand does not creep over 4 s (depth ' + d[0].toFixed(2) + ' cm, sideways ' + d[1].toFixed(2) + ' cm)');
  // clutch: open hand holds the instrument, in depth too, and taking it again does not make it jump (ratchet)
  d = await ev(() => {
    const dr = window.__drv, h = dr.hands.R, a = window.__cf('R');
    h.opn = 1.95; h.ap = 0.9; dr.step(10); for (let i = 0; i < 10; i++) { dr.move('R', 0, 0, -0.012); dr.step(1); } const b = window.__cf('R');
    h.opn = 1.45; h.ap = 0.62; dr.step(24); const c = window.__cf('R');
    for (let i = 0; i < 12; i++) { dr.move('R', 0, 0, 0.005); dr.step(1); } dr.step(14); const e = window.__cf('R');
    return [Math.abs(b[2] - a[2]), Math.abs(c[2] - a[2]), e[2] - c[2]];
  });
  ok(d[0] < 0.1 && d[1] < 0.15, 'open hand holds depth while the hand moves back (' + d[0].toFixed(2) + ', ' + d[1].toFixed(2) + ' cm)');
  ok(d[2] > 0.7, 'curling again carries on from there: forward ' + d[2].toFixed(2) + ' cm');

  // contact: bring the right bipolar to the round ligament by hand
  await ev(() => { const s = window.__sim; s.forceStep(); for (let i = 0; i < 60; i++) window.__drv.step(1); s.setPoseGoal(s.STEPS[s.S.step].rec); window.__drv.step(50); });
  let r = await ev(() => { const n = window.__sim.next(); let r; for (let t = 0; t < 4; t++) { r = window.__drv.reach('R', n.p, t, n.want); if (r.good) break; } return r; });
  ok(r.touch && r.ent === 'round', 'right hand brings the bipolar into contact with the round ligament ' + JSON.stringify({ ok: r.ok, ent: r.ent, short: r.short, clutches: r.clutches }));
  d = await ev(() => { const dr = window.__drv, h = window.__sim.HAND.R; for (let i = 0; i < 25; i++) { dr.move('R', 0, 0, 0.006); dr.step(1); } dr.step(10); return { press: h.press, give: h.give, touch: h.touch }; });
  ok(d.touch && d.give > 0.3 && d.press <= 0.55 * 2.4 + 0.01, 'pushing on dents the tissue and is stopped (give ' + d.give.toFixed(2) + ' cm, over-travel ' + d.press.toFixed(2) + ' cm)');
  d = await ev(() => { const dr = window.__drv, h = window.__sim.HAND.R; let n = 0; while (n++ < 60 && h.touch) { dr.move('R', 0, 0, -0.006); dr.step(1); } return n; });
  ok(d < 45, 'drawing back frees the tip (' + d + ' frames)');
  // seal with a pinch while in contact, then cut with a second pinch
  r = await ev(() => { const n = window.__sim.next(); let r; for (let t = 0; t < 4; t++) { r = window.__drv.reach('R', n.p, t, n.want); if (r.good) break; } return r; });
  d = await ev(() => { const dr = window.__drv, s = window.__sim, e = s.S.side.R.round; dr.hands.R.ap = 0.14; let n = 0; while (n++ < 120 && !e.seals.length) dr.step(1); dr.hands.R.ap = 0.62; dr.step(14); { const n = s.next(); if (n && n.act === 'cut') for (let t = 0; t < 4; t++) if (dr.reach('R', n.p, t, n.want).good) break; } /* sealed tissue shrinks a little: re-seat the tip, as a person would */ const H = s.HAND.R, dbg = []; dr.hands.R.ap = 0.14; for (let i = 0; i < 6; i++) { dr.step(1); dbg.push([H.touch ? 1 : 0, H.pick.ent, +H.pick.u.toFixed(3), s.HT.slot.R.pinch ? 1 : 0, s.HT.slot.R.down ? 1 : 0, s.HT.slot.R.armed ? 1 : 0, H.firing ? 1 : 0, +(s.S.t - H.lastUp).toFixed(2), e.seals.map(z => z.u.toFixed(3) + '±' + z.w).join(';')].join(' ')); } window.__dbgCut = dbg; dr.hands.R.ap = 0.62; dr.step(10); return { seals: e.seals.length, cut: !!e.cut, bleed: s.S.bleeders.length }; });
  ok(d.seals >= 1 && d.cut && d.bleed === 0, 'pinch seals in contact, a second pinch divides, no bleeding ' + JSON.stringify(d) + (d.cut ? '' : ' cut pinch frames [touch ent u pinch down armed firing sinceUp seals]: ' + JSON.stringify(await ev(() => window.__dbgCut))) + ' after reach ' + JSON.stringify({ good: r.good, ent: r.ent, feel: r.feel, aim: r.aim, short: r.short, off: r.off }));

  // traction in depth: left grasper takes the tube and moves it, depth not locked while pinched
  await ev(() => { const s = window.__sim; s.setActive('L'); });
  r = await ev(() => { // a spot on the left tube or round ligament that the left port has a clear line to
    const s = window.__sim, T3 = s.THREE, G = s.AN.side.L.cur, R = new T3.Raycaster(), port = s.HAND.L.port, v = new T3.Vector3();
    for (const a of [G.tube, G.round]) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const p = a[Math.floor(a.length * t)]; R.set(port, v.copy(p).sub(port).normalize());
      const f = R.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0], ud = f && f.object.userData;
      if (ud && (ud.ent === 'tube' || ud.ent === 'round') && ud.side === 'L' && f.point.distanceTo(p) < 0.6) { window.__tgt = { p: p.toArray(), want: { ents: [ud.ent], side: 'L' } }; let r; for (let t = 0; t < 4; t++) { r = window.__drv.reach('L', window.__tgt.p, t, window.__tgt.want); if (r.good) break; } return r; }
    }
    return { touch: false, ent: 'nothing in reach' };
  });
  ok(r.touch && (r.ent === 'tube' || r.ent === 'round'), 'left hand brings the grasper onto the ' + r.ent + ' ' + JSON.stringify(r).slice(0, 300));
  d = await ev(() => {
    const dr = window.__drv, h = window.__sim.HAND.L, T = window.__tgt; dr.hands.L.ap = 0.14; dr.step(8);
    // a grasp that closes on nothing is let go and taken again, as a person would
    for (let t = 1; t < 4 && !(h.grab && h.grab.pull) && T; t++) { dr.hands.L.ap = 0.62; dr.step(14); dr.reach('L', T.p, t, T.want); dr.hands.L.ap = 0.14; dr.step(8); }
    const g0 = h.grab && h.grab.pull ? 1 : 0, t0 = h.tip.clone();
    for (let i = 0; i < 14; i++) { dr.move('L', 0, 0.004, -0.005); dr.step(1); } dr.step(10);
    const off = h.grab && h.grab.pull ? h.grab.pull.off.length() : -1, moved = h.tip.distanceTo(t0);
    dr.hands.L.ap = 0.62; dr.step(20);
    return { g0, off, moved, released: !h.grab };
  });
  ok(d.g0 === 1 && d.off > 0.4 && d.moved > 0.4, 'pinch grasps, and moving the hand up and back moves the tissue ' + JSON.stringify({ g0: d.g0, off: +d.off.toFixed(2), moved: +d.moved.toFixed(2) }));
  ok(d.released, 'relaxing the hand lets go');

  // auto depth still available with hands
  await ev(() => document.getElementById('btnAuto').click());
  d = await ev(() => { const dr = window.__drv, s = window.__sim; dr.step(20); const m = dr.moveTo('R', 520, 330); dr.step(20); return { free: s.freeDepth(), ok: m.ok, near: s.HAND.R.near }; });
  ok(!d.free && d.ok && d.near, 'auto depth with hands: the pointer is steered and the tip rides the tissue ' + JSON.stringify(d));
  console.log(fails ? fails + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
}
