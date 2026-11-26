// Checks of the lab (PAGE=lab/): its page, the tissue at rest, each instrument, the first opening and how it is
// graded, and each way the dissection can go wrong. Instruments are steered by labdriver.mjs through the simulator's
// own free-depth drive, so contact, the working-space limits and the rule about unopened peritoneum apply. Where a
// check needs a wide opening to start from, it cuts one out of the sheet directly (open()), and says so.
import { install } from './labdriver.mjs';
export default async function (page) {
  const errs = [], ok = (c, m) => { console.log((c ? 'ok    ' : 'FAIL  ') + m); if (!c) errs.push(m); };
  const ev = (fn, a) => page.evaluate(fn, a);
  // ---- the page ----
  const pg = await ev(() => ({ title: document.title, brand: document.getElementById('brandSub').textContent, insts: [...document.querySelectorAll('#insts .inst span')].map(e => e.textContent), manip: getComputedStyle(document.getElementById('manip')).display, hands: !!document.getElementById('btnHands'), guide: getComputedStyle(document.getElementById('btnGuide')).display, robots: (document.querySelector('meta[name=robots]') || {}).content, cases: Object.keys(window.__sim.CASES).length }));
  ok(/lab/i.test(pg.title) && /Lab 0\.1/.test(pg.brand), 'the page is the lab: "' + pg.brand + '"');
  ok(pg.insts.join() === 'Maryland,Bipolar,Suction', 'three instruments on the tray: ' + pg.insts.join(', '));
  ok(pg.manip === 'none' && pg.guide === 'none' && !pg.hands && pg.cases === 1, 'no manipulator, no guidance switch, no hand control, one case');
  ok(/noindex/.test(pg.robots || ''), 'search engines are asked not to list it');
  await page.click('#btnBegin'); await install(page);
  await ev(() => { const s = window.__sim, L = window.__lab, D = window.__drv, B = L.LB, P = L.PX; window.__simPause = true;
    // helpers for the checks below
    window.__t = {
      fresh() { s.startCase(false); D.tick(20); },
      disp() { let m = 0, mx = 0; for (let i = 0; i < B.NS; i++) { const k = i * 3, d = Math.hypot(P.x[k] - P.r[k], P.x[k + 1] - P.r[k + 1], P.x[k + 2] - P.r[k + 2]); m += d; mx = Math.max(mx, d); } return [m / B.NS, mx]; },
      cut() { return B.dead.reduce((a, b) => a + b, 0); },
      open(i0, i1, j0, j1) { for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const q = j * (B.NC - 1) + i; B.dead[q * 2] = B.dead[q * 2 + 1] = 1; } L.lbReindex(); s.S.lab.entry = s.S.lab.entry || { t: s.S.t, zone: 'triangle', tented: true, lift: 1, sealed: true, dIli: 2, dIP: 2 }; },
      inj() { return Object.keys(s.S.injuries); },
      tent(i, j, lift) { D.to('L', D.rest(i, j), { touch: true }); D.press('L', 0.05); D.nudge('L', -(lift || 1.4), 50); D.tick(30); return L.LH.L.kind; },
      bite(i, j, hold) { if (s.HAND.R.openGoal < 0.3) D.press('R', 0.05); const r = D.to('R', D.at(i, j), { touch: true }); if (hold) D.press('R', hold); else D.press('R', 0.05); D.cut('R'); return r; }
    }; });
  const T = fn => ev(fn);
  // ---- at rest ----
  const rest = await T(() => { const s = window.__sim, L = window.__lab, D = window.__drv, t = window.__t; D.tick(120); const a = t.disp(); D.tick(300); const b = t.disp(), t0 = performance.now(); for (let i = 0; i < 120; i++) L.PX.step(1 / 60); const ms = (performance.now() - t0) / 120;
    return { a, b, ms, n: L.PX.n, m: L.PX.m, keys: Object.keys(localStorage), inst: [s.HAND.L.inst, s.HAND.R.inst], pose: s.S.pose.yaw }; });
  ok(rest.a[1] < 0.4 && Math.abs(rest.a[0] - rest.b[0]) < 0.01, 'the peritoneum rests where it was laid and stays there (mean ' + rest.a[0].toFixed(2) + ' cm, most ' + rest.a[1].toFixed(2) + ' cm off, no drift over 5 s)');
  ok(rest.ms < 8, 'tissue physics takes ' + rest.ms.toFixed(1) + ' ms a frame here at 60 frames a second (' + rest.n + ' particles, ' + rest.m + ' constraints)');
  ok(rest.inst.join() === 'maryland,bipolar', 'the Maryland starts in the left hand and the bipolar in the right');
  ok(rest.keys.every(k => !/^tlh\./.test(k)) && rest.keys.some(k => /^lab\./.test(k)), 'the lab keeps its settings under its own names: ' + rest.keys.join(', '));
  ok(Math.abs(rest.pose + 0.5) < 0.01, 'the uterus is held to the patient\'s left');
  // ---- the bipolar's button, through real mouse events ----
  const box = await page.locator('#ov').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2, tick = n => ev(n => window.__drv.tick(n), n);
  await page.mouse.move(cx, cy); await ev(() => { const s = window.__sim; window.__drv.to('R', [3.4, 1.2, 8]); s.INP.noLock = true; s.setActive('R'); }); await tick(2); // the instrument in clear space, well off the tissue
  const st = () => ev(() => { const s = window.__sim; return { open: s.HAND.R.openGoal > 0.3, coag: window.__lab.LH.R.coag, e: s.S.stats.energyTime, act: s.S.stats.activations }; });
  await page.mouse.down(); await tick(6); await page.mouse.up(); await tick(6); let b1 = await st();
  ok(!b1.open && b1.e === 0 && b1.act === 0, 'bipolar: a quick click closes the jaws with no energy');
  await page.mouse.down(); await tick(6); await page.mouse.up(); await tick(6); let b2 = await st();
  ok(b2.open && b2.e === 0, 'bipolar: a second quick click opens them, still no energy');
  await page.mouse.down(); await tick(12); const b3a = await st(); await tick(40); const b3 = await st(); await page.mouse.up(); await tick(6); const b4 = await st();
  ok(!b3a.coag && b3.coag && b3.e > 0.4 && b3.act === 1, 'bipolar: a held click starts the energy after ' + (await ev(() => window.__lab.LK.HOLD)) + ' s (' + b3.e.toFixed(2) + ' s of energy, 1 activation)');
  ok(!b4.coag && !b4.open, 'bipolar: letting go stops the energy and leaves the jaws closed for the blade');
  await page.mouse.click(cx, cy, { button: 'right' }); await tick(4);
  ok((await T(() => window.__t.cut())) === 0, 'the blade in closed jaws that hold nothing divides nothing');
  await page.mouse.down(); await tick(6); await page.mouse.up(); await tick(6);
  // ---- unopened peritoneum ----
  const un = await T(() => { const D = window.__drv, L = window.__lab, B = L.LB, s = window.__sim; window.__t.fresh(); const r = D.to('R', D.add(D.rest(33, 14), D.nin(33, 14), 1.2), { tol: 0.1 }); return { d: r.d, in: r.in, on: r.on, press: s.HAND.R.press }; });
  ok(!un.in && un.on === 'perit' && un.d > 0.5, 'an instrument pushed at unopened peritoneum stops on it (' + un.d.toFixed(1) + ' cm short of a place 1.2 cm under it)');
  // ---- the first opening ----
  const e1 = await T(() => { const t = window.__t, s = window.__sim; t.fresh(); const k = t.tent(39, 17); const r = t.bite(39, 15, 0.9); const E = s.S.lab.entry; return { k, cut: t.cut(), E, un: s.S.stats.unsealedCuts, bl: s.S.bleeders.length, goal: (window.__lab.lbMetrics(), window.__lab.goal.entry) }; });
  ok(e1.k === 'peritoneum' && e1.cut > 3 && e1.E && e1.E.zone === 'triangle' && e1.E.tented && e1.E.sealed && e1.un === 0 && e1.bl === 0 && e1.goal, 'tented, coagulated and cut lateral to the IP ligament: opened, in the right place, tented (' + (e1.E ? (e1.E.lift * 10).toFixed(0) : '?') + ' mm), dry, goal 1 reached');
  const e2 = await T(() => { const t = window.__t, s = window.__sim; t.fresh(); t.tent(39, 17); t.bite(39, 15, 0); const E = s.S.lab.entry; return { E, un: s.S.stats.unsealedCuts, bl: s.S.bleeders.length, ev: s.S.events.map(e => e.text).join(' | ') }; });
  ok(e2.E && !e2.E.sealed && e2.un === 1 && e2.bl >= 1 && /without coagulating/.test(e2.ev), 'the same bite cut cold: the edge bleeds and the cut is counted');
  const e3 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv; t.fresh(); if (s.HAND.R.openGoal < 0.3) D.press('R', 0.05); D.to('R', D.rest(36, 12), { touch: true }); D.press('R', 0.9); D.cut('R'); const E = s.S.lab.entry; return { E, sc: s.CASE.score() }; });
  ok(e3.E && !e3.E.tented && e3.sc.notes.some(n => /not tented/.test(n)), 'a first bite on peritoneum that was not lifted is recorded as not tented (lifted ' + (e3.E ? (e3.E.lift * 10).toFixed(0) : '?') + ' mm)');
  const e4 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, B = window.__lab.LB; t.fresh(); s.setInst('L', 'bipolar'); D.tick(60); const r = D.to('L', D.rest(28, B.NR + 5), { touch: true }); D.press('L', 0.9); D.cut('L'); const E = s.S.lab.entry; window.__lab.lbMetrics(); return { r, zone: E && E.zone, goal: window.__lab.goal.entry }; }); // the left hand reaches the medial leaf
  ok(e4.zone === 'medial' && !e4.goal, 'opened medial to the IP ligament, over the ureter: recorded as such, goal 1 not reached'); if (process.env.DEBUG) console.log(JSON.stringify(e4));
  // ---- energy on what lies under unopened peritoneum ----
  const h1 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB; t.fresh(); const q = 5, u = D.ureter(q); if (s.HAND.R.openGoal < 0.3) D.press('R', 0.05); const r = D.to('L', u, { touch: true }); s.setInst('L', 'bipolar'); D.tick(60); D.to('L', u, { touch: true }); D.nudge('L', 0.4, 10); D.press('L', 2.2); return { inj: t.inj(), near: s.S.lab.nearSec, minU: s.S.lab.minU, on: r.on, ev: s.S.events.map(e => e.text).join(' | ') }; });
  ok(h1.near > 0.5 && h1.ev && /within 5 mm/.test(h1.ev), 'bipolar held on the peritoneum over the ureter at the brim: ' + h1.near.toFixed(1) + ' s of energy within 5 mm of it is counted, closest ' + (h1.minU * 10).toFixed(0) + ' mm' + (h1.inj.includes('ureterBurn') ? ', and it is burned' : ''));
  const h2 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB; t.fresh(); if (s.HAND.R.openGoal < 0.3) D.press('R', 0.05); D.to('R', D.rest(B.ipI0 + 8, B.NR), { touch: true }); D.press('R', 2.0); const a = t.inj().slice(); D.cut('R'); return { a, b: t.inj(), bl: s.S.bleeders.length }; });
  ok(h2.a.includes('ipCoag') && h2.b.includes('ipCut'), 'bipolar on the IP ligament: coagulated, then divided, each recorded');
  // ---- under the peritoneum (the test opens a wide window first) ----
  const h3 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    if (s.HAND.R.openGoal > 0.3) D.press('R', 0.05); const v = L.LV.eiv.arr[18], r = D.to('R', v.toArray(), { touch: true }); D.press('R', 1.2); return { in: r.in, on: r.on, inj: t.inj(), bl: s.S.bleeders.map(b => b.rate), ev: s.S.events.map(e => e.text).join(' | ') }; });
  ok(h3.in && (h3.inj.includes('eiv') || h3.inj.includes('eia')) && h3.bl.some(r => r >= 200), 'through an opening, bipolar held on the external iliac vessels: major vascular injury, brisk bleeding (' + h3.inj.join() + ')'); if (process.env.DEBUG) console.log(JSON.stringify(h3));
  const h4 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB, U = L.LU; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    s.setInst('R', 'maryland'); D.tick(60); const r = D.to('R', D.ureter(34), { touch: true }); D.press('R', 0.05); const k = L.LH.R.kind, a = t.inj().slice(); D.press('R', 0.05);
    // jaws opened lying along the ureter
    const s0 = L.goal.stripCm; D.to('R', D.ureter(36), { touch: true }); D.press('R', 0.05); D.press('R', 0.05); L.lbMetrics(); return { in: r.in, on: r.on, k, a, strip: L.goal.stripCm, sc: s.CASE.score().notes }; });
  ok(h4.k === 'ureter' && h4.a.includes('ureterCrush'), 'Maryland closed on the ureter: crush injury'); if (process.env.DEBUG) console.log(JSON.stringify(h4));
  const h5 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB, U = L.LU; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    if (s.HAND.R.openGoal > 0.3) D.press('R', 0.05); const u = D.ureter(34); const r = D.to('R', u, { touch: true }); D.cut('R'); return { r, inj: t.inj(), cutU: s.S.lab.cutU }; });
  ok(h5.inj.includes('ureterCut') && h5.cutU > 0, 'the blade fired with the closed jaws on the ureter: the ureter is divided'); if (process.env.DEBUG) console.log(JSON.stringify(h5));
  const h6 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    if (s.HAND.R.openGoal > 0.3) D.press('R', 0.05); D.to('R', D.ureter(34), { touch: true }); D.press('R', 1.5); return { inj: t.inj(), near: s.S.lab.nearSec }; });
  ok(h6.inj.includes('ureterBurn'), 'through an opening, bipolar held on the ureter itself: thermal injury to the ureter');
  const h7 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    s.setInst('R', 'maryland'); D.tick(60); const u = D.ureter(34), n = D.nin(39, 30); D.to('R', D.add(u, [0, 0.12, 0], 1), { tol: 0.1 }); D.press('R', 0.05); const held = L.LH.R.kind; D.press('R', 0.05); // closed beside it holding nothing, then opened
    L.lbMetrics(); return { held, strip: L.goal.stripCm, ev: s.S.events.map(e => e.text).join(' | '), blunt: s.S.stats.blunt }; });
  ok(h7.strip > 0 || /crush/.test(h7.ev), 'jaws worked on the ureter itself: ' + (h7.strip > 0 ? 'its sheath is stripped over ' + h7.strip.toFixed(1) + ' cm' : 'it is crushed'));
  // ---- small vessels in the areolar tissue, blood and suction ----
  const v1 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB, S = L.LS, P = L.PX, V3 = s.THREE.Vector3; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    const vs = []; for (let q = 0; q < S.n; q++) if (S.vasc[q]) vs.push(q); const mid = q => { const a = new V3(), b = new V3(); P.get(P.ci[S.c[q]], a); P.get(P.cj[S.c[q]], b); return a.lerp(b, 0.5); };
    // the two nearest the window: one is broken as it is, the other coagulated first
    const c = new V3(...D.rest(39, 14)); vs.sort((a, b) => mid(a).distanceTo(c) - mid(b).distanceTo(c));
    L.lbInjury; const before = s.S.bleeders.length; const br = window.__lab; P.cf[S.c[vs[0]]] |= 1;
    return { n: vs.length, total: S.n }; });
  ok(v1.n >= 8 && v1.n < v1.total * 0.15, v1.n + ' of ' + v1.total + ' strands of areolar tissue carry a small vessel');
  const v2 = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB, U = L.LU, V3 = s.THREE.Vector3; t.fresh(); t.open(36, 43, 8, 20); D.tick(10);
    // a bleeding point under the peritoneum, as a divided small vessel leaves
    const p = new V3(...D.ureter(34)); p.x += 0.5; s.S.bleeders.push({ pt: o => o.copy(p), rate: 14, arterial: false, seal: 0, t: 0, label: 'small vessel', lab: true });
    D.tick(600); const well = B.wells.reduce((a, w) => a + w.v, 0), ebl = s.S.ebl; for (const x of L.LR.list) x.seen = true; for (let q = 0; q < L.LF.n; q++) L.LF.free[q] = 1; L.lbMetrics(); const hid = !L.LR.by.ureter[33].rev;
    if (s.HAND.R.openGoal > 0.3) D.press('R', 0.05); D.to('R', p.toArray(), { tol: 0.3 }); D.press('R', 1.8); const stopped = s.S.bleeders.length === 0;
    s.setInst('R', 'suction'); D.tick(60); D.to('R', B.wells[0].p.toArray(), { tol: 0.4 }); s.setActive('R'); s.INP.down = true; s.primaryDown(s.HAND.R); D.tick(300); s.INP.down = false; s.primaryUp(s.HAND.R);
    const left = B.wells.reduce((a, w) => a + w.v, 0); for (const x of L.LR.list) x.seen = true; L.lbMetrics(); return { well, ebl, hid, stopped, left, shown: L.LR.by.ureter[33].rev, pool: s.S.pool }; });
  ok(v2.well > 1 && v2.ebl > 1.5 && v2.hid, 'a small vessel bleeding under the peritoneum: ' + v2.well.toFixed(1) + ' mL wells up there and hides the ureter beside it');
  ok(v2.stopped && v2.left < 0.3 && v2.shown && v2.pool === 0, 'bipolar on the point stops it, suction clears the blood, and the ureter shows again');
  // ---- traction ----
  const tr = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab; t.fresh(); t.tent(33, 12, 0.5); D.nudge('L', -4.5, 120); D.tick(300); return { slips: s.S.lab.slips, kind: L.LH.L.kind, ev: s.S.events.map(e => e.text).join(' | '), d: t.disp() }; });
  ok(tr.slips === 1 && tr.kind === '' && tr.d[1] < 0.8, 'peritoneum pulled too far comes out of the jaws, and falls back'); if (process.env.DEBUG) console.log(JSON.stringify(tr));
  // ---- the score, the debrief, and starting again ----
  const fin = await T(() => { const t = window.__t, s = window.__sim, D = window.__drv, L = window.__lab, B = L.LB; t.fresh(); t.open(36, 43, 8, 20); if (s.HAND.R.openGoal > 0.3) D.press('R', 0.05); D.to('R', L.LV.eiv.arr[18].toArray(), { touch: true }); D.press('R', 1.2);
    s.STEPS[0].button.fn(); D.tick(3); const sc = s.CASE.score(), shown = !document.getElementById('debrief').hidden, goals = document.getElementById('dbGoals').innerText, txt = s.resultsText();
    document.getElementById('dbRestart').click(); D.tick(5); const back = { cut: t.cut(), inj: t.inj().length, free: L.LF.free.reduce((a, b) => a + b, 0), start: !document.getElementById('startCard').hidden, d: t.disp()[1] };
    return { sc, shown, goals, txt: txt.length, back }; });
  ok(fin.shown && fin.sc.pts <= 65 && fin.sc.notes.some(n => /iliac (vein|artery)/.test(n)) && /Not reached/.test(fin.goals), 'ending opens the debrief: ' + fin.sc.pts + ' points with an iliac vessel injured, goals listed');
  if (process.env.DEBUG) console.log(JSON.stringify(fin.back));
  ok(fin.back.cut === 0 && fin.back.inj === 0 && fin.back.free === 0 && fin.back.start && fin.back.d < 0.3, 'Start again puts the sidewall back as it was');
  console.log(errs.length ? errs.length + ' FAILED' : 'all lab checks passed');
  if (errs.length) throw new Error(errs.length + ' lab checks failed');
}
