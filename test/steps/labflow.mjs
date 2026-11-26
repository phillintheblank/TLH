// The lab played through by script: a right retroperitoneal ureter dissection the way it is meant to go, through
// the simulator's own mouse drive. The Maryland in the left hand tents the peritoneum lateral to the IP ligament; the
// bipolar in the right coagulates the fold and cuts it; the Maryland takes the medial edge and draws it medially; the
// opening is carried down toward the round ligament; the bipolar then goes in with its jaws closed and opens them
// beside the ureter, place by place, down to the uterine artery. It ends the dissection and reads the debrief.
// SHOTS=1 writes pictures to test/out/. Run with PAGE=lab/.
import { install } from './labdriver.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  await page.click('#btnBegin'); await install(page); if (process.env.DEBUG) await page.evaluate(() => { window.__dbg = true; }); if (process.env.LOOK) await page.evaluate(v => { window.__look = v; }, process.env.LOOK);
  let n = 0; const shot = async name => { if (!process.env.SHOTS) return; await page.evaluate(() => { for (let k = 0; k < 3; k++) window.__sim.render(0.5); }); await page.waitForTimeout(150); await page.evaluate(() => window.__sim.render(0.5)); await page.locator('#view').screenshot({ path: OUT + 'lab-' + (n++) + '-' + name + '.png' }); };
  const run = async fn => { const r = await page.evaluate(fn); for (const l of r) console.log(l); };
  await run(() => {
    const s = window.__sim, L = window.__lab, D = window.__drv, B = L.LB, out = [], log = (k, v) => out.push(k + ': ' + JSON.stringify(v)); window.__simPause = true; D.tick(30);
    const F = window.__flow = { cut: () => B.dead.reduce((a, b) => a + b, 0), I: 39, J: 16 };
    // 1. tent, coagulate, cut
    D.to('L', D.rest(F.I, F.J + 1), { touch: true }); D.press('L', 0.05); log('Maryland holds', [L.LH.L.kind, L.LH.L.held.length]);
    D.nudge('L', -1.4, 50); D.tick(30);
    const r = D.to('R', D.at(F.I, F.J - 1), { touch: true }); D.press('R', 0.9); D.cut('R');
    const E = s.S.lab.entry; log('first bite', [r.d, r.on, F.cut(), E && { zone: E.zone, tented: E.tented, lift: +E.lift.toFixed(2), sealed: E.sealed, dIP: +E.dIP.toFixed(2), dIli: +E.dIli.toFixed(2) }]);
    D.press('R', 0.05); D.nudge('R', -2, 30); D.press('L', 0.05); D.tick(30);
    return out;
  });
  await shot('entry');
  await run(() => {
    const s = window.__sim, L = window.__lab, D = window.__drv, B = L.LB, F = window.__flow, out = [], log = (k, v) => out.push(k + ': ' + JSON.stringify(v));
    const open = () => { const q = []; for (let k = 0; k < B.NQ; k++) if (B.dead[k * 2] || B.dead[k * 2 + 1]) q.push([k % (B.NC - 1), (k / (B.NC - 1)) | 0]); return q; };
    // 2. the medial edge, drawn toward the IP ligament
    let q = open(); const jm = Math.max(...q.map(d => d[1])) + 1, im = q.filter(d => d[1] === jm - 1)[0][0];
    const g = D.to('L', D.at(im, jm + 1), { touch: true }); D.press('L', 0.05); log('Maryland on the medial edge', [g.d, L.LH.L.kind, L.LH.L.held.length]);
    const a = D.rest(im, jm), b = D.rest(Math.min(im, B.NU), B.NR), dir = [b[0] - a[0], b[1] - a[1] + 1.0, b[2] - a[2]], m = Math.hypot(...dir);
    D.nudge('L', dir.map(v => (v / m) * 1.1), 60); D.tick(30);
    // 3. carried down toward the round ligament, a bite at a time: each time the tip goes beyond the lower end of the opening
    for (let k = 1; k <= 5; k++) {
      q = open(); const j0 = Math.min(...q.map(d => d[1])), i0 = Math.round(q.filter(d => d[1] === j0).reduce((p, c) => p + c[0], 0) / q.filter(d => d[1] === j0).length);
      if (j0 <= 9) break;
      if (s.HAND.R.openGoal < 0.3) D.press('R', 0.05);
      const r = D.to('R', D.at(i0, j0 - 2), { touch: true }); D.press('R', 0.9); D.cut('R'); log('bite ' + k + ' at row ' + (j0 - 2), [r.d, r.on, F.cut(), 'unsealed', s.S.stats.unsealedCuts]);
      D.nudge('R', -1.2, 20);
    }
    L.lbMetrics(); log('opening', [+L.goal.openCm.toFixed(1) + ' cm', 'rows ' + Math.min(...open().map(d => d[1])) + ' to ' + Math.max(...open().map(d => d[1]))]);
    return out;
  });
  await shot('opened');
  await run(() => {
    const s = window.__sim, L = window.__lab, D = window.__drv, B = L.LB, U = L.LU, out = [], log = (k, v) => out.push(k + ': ' + JSON.stringify(v));
    const V3 = s.THREE.Vector3, p = new V3(), nn = new V3();
    // a place beside the ureter, on its side away from the leaf it lies on
    const beside = (q, k) => { L.PX.get(U.i0 + q, p); let b = 0, bd = 1e9; for (let i = 0; i < B.NS; i++) { const d = L.PX.get(i, nn).distanceToSquared(p); if (d < bd) { bd = d; b = i; } } nn.set(B.nin[b * 3], B.nin[b * 3 + 1], B.nin[b * 3 + 2]); return p.addScaledVector(nn, k).toArray(); };
    const state = () => { L.lbMetrics(); const G = L.goal; return ['ureter ' + G.ureterCm.toFixed(1) + ' cm', 'to UA ' + G.toUA, 'UA ' + G.ua, 'strip ' + G.stripCm.toFixed(1), 'EBL ' + Math.round(s.S.ebl)]; };
    // 4. in through the opening with the jaws closed, then open them beside the ureter, working down it
    if (s.HAND.R.openGoal > 0.3) D.press('R', 0.05);
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    for (const q of [34, 30, 26, 22, 18, 38, 42, U.kx - 1]) {
      const r = D.to('R', beside(q, 0.7), { tol: 0.25 }); D.press('R', 0.05); D.tick(12); D.press('R', 0.05); D.tick(6); // open the jaws there, and close them
      const t0 = s.HAND.R.tip.toArray(); D.nudge('R', sub(beside(q + 2, 0.6), t0), 25); D.nudge('R', sub(beside(q - 2, 0.6), s.HAND.R.tip.toArray()), 40); // and sweep the closed jaws up and down beside it
      log('beside ureter q' + q, [r.d, 'in ' + r.in, r.lim ? 'LIMIT' : '', r.on].concat(state()));
    }
    // 5. and round the uterine artery where it crosses
    for (const i of [1, 3, 5]) { const a = L.LV.ua.arr[i].toArray(), r = D.to('R', [a[0] + 0.2, a[1] + 0.55, a[2] + 0.45], { tol: 0.25 }); D.press('R', 0.05); D.tick(12); D.press('R', 0.05); D.nudge('R', [0.5, 0, 0.2], 20); D.nudge('R', [-0.9, 0, -0.3], 30); log('by the uterine artery ' + i, [r.d, 'in ' + r.in, r.on].concat(state())); }
    // 6. a second pass closer to the ureter with the jaws closed, pushing off what fat is left on it
    for (const q of [16, 20, 24, 28, 32]) { D.to('R', beside(q - 2, 0.5), { tol: 0.2 }); D.nudge('R', sub(beside(q + 2, 0.5), s.HAND.R.tip.toArray()), 40); }
    for (const q of [24, 27, 30, 20]) { D.to('R', beside(q, 0.55), { tol: 0.2 }); D.press('R', 0.05); D.tick(12); D.press('R', 0.05); D.tick(6); } // and the jaws opened once more where fat still holds on
    log('after the second pass', state());
    // 7. blood that has welled up is aspirated
    s.setInst('R', 'suction'); D.tick(60);
    for (let pass = 0; pass < 3; pass++) for (const w of B.wells) if (w.v > 0.2) { D.to('R', w.p.toArray(), { tol: 0.4 }); s.setActive('R'); s.INP.down = true; s.primaryDown(s.HAND.R); let g = 0; while (w.v > 0.05 && g++ < 240) D.tick(1); s.INP.down = false; s.primaryUp(s.HAND.R); }
    log('after suction', state().concat(['blood left under the peritoneum ' + B.wells.reduce((a, w) => a + w.v, 0).toFixed(1) + ' mL']));
    const map = k => L.LR.by[k].map(x => (x.rev ? 'R' : x.seen ? 's' : '.')).join('');
    log('ureter, brim to artery (R uncovered, s reached but covered, . not reached)', map('ureter')); log('uterine artery, from the crossing out', map('ua')); log('internal iliac artery', map('iia'));
    if (window.__dbg) for (const q of [16, 20, 24, 28]) { const c = []; L.PX.get(U.i0 + q, p); for (let e = 0; e < L.LF.n; e++) { const d = L.PX.get(L.LF.i0 + e, nn).distanceTo(p); if (d < 0.25 + L.LF.r[e] * 0.6 && !L.LF.free[e]) c.push([L.LF.kind[e], +L.LF.pushed[e].toFixed(2), +d.toFixed(2), +L.LF.r[e].toFixed(2)]); } log('covering q' + q + ' [kind, pushed, dist, r]', c); const tp = s.HAND.R.tip; log(' widened', s.S.lab.widened); }
    log('found', Object.keys(L.goal.found).filter(k => L.goal.found[k])); log('events', s.S.events.map(e => e.text));
    return out;
  });
  await shot('dissected');
  if (process.env.LOOK) { // for judging the picture: the medial flap lifted and the scope brought in
    await run(() => { const s = window.__sim, L = window.__lab, D = window.__drv, B = L.LB; s.setInst('R', 'bipolar'); D.to('R', [5.6, 2.2, 7.5]); D.tick(40);
      D.press('L', 0.05); D.tick(20); const q = []; for (let k = 0; k < B.NQ; k++) if (B.dead[k * 2] || B.dead[k * 2 + 1]) q.push([k % (B.NC - 1), (k / (B.NC - 1)) | 0]);
      const g = D.to('L', D.at(B.NU - 4, B.NR), { touch: true }); D.press('L', 0.05); // the IP ligament itself, drawn toward the midline
      const v = (window.__look || '').split(',').map(Number), t0 = s.HAND.L.tip.toArray().map(x => +x.toFixed(1)); D.nudge('L', [v[0] || -3, v[1] || 0.4, v[2] || 0], 150); const lim = [s.HAND.L.limT > 0, s.HAND.L.cross, s.HAND.L.touch]; D.tick(40);
      s.CAM.userIns = v[3] || 2.5; s.CAM.pan.set(v[4] || -0.5, v[5] || -1.5, 0); s.S.labels = true; D.tick(60); return ['IP drawn medially: ' + JSON.stringify([t0, lim, g.d, g.on, L.LH.L.kind, L.LH.L.held.length, s.S.lab.slips, s.HAND.L.tip.toArray().map(x => +x.toFixed(1))])]; });
    await shot('look');
  }
  // 8. end, and read the debrief
  await page.evaluate(() => { const s = window.__sim; s.STEPS[0].button.fn(); for (let i = 0; i < 5; i++) s.tick(1 / 60); s.render(0.5); });
  const db = await page.evaluate(() => ({ score: document.getElementById('dbScore').textContent, grade: document.getElementById('dbGrade').textContent, goals: document.getElementById('dbGoals').innerText, notes: document.getElementById('dbNotes').innerText, text: window.__sim.resultsText(), goal: window.__lab.goal, shown: !document.getElementById('debrief').hidden, phys: window.__lab.PX.ms }));
  console.log('--- debrief ---\n' + db.text);
  const bad = [];
  if (!db.shown) bad.push('the debrief did not open');
  if (!db.goal.entry) bad.push('goal 1 (entry) not reached'); if (!db.goal.ureter) bad.push('goal 2 (ureter to the uterine artery) not reached');
  if (+db.score < 85) bad.push('score ' + db.score + ' for a dissection done as intended');
  if (process.env.SHOTS) await page.screenshot({ path: OUT + 'lab-debrief.png' });
  console.log(bad.length ? 'FAILED: ' + bad.join('; ') : 'OK: both required goals reached, score ' + db.score + ' (' + db.grade + ')');
  if (bad.length) throw new Error(bad.join('; '));
}
