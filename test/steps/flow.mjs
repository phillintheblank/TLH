// Drive the whole case through the same "next target" data the guidance overlay draws.
// MODE=mouse uses real mouse events. MODE=hands feeds synthetic hand landmarks through the full hand-control
// pipeline (slot assignment, filtering, calibration, relative mapping, pinch and clutch detection).
// Simulation time is advanced synchronously through the page's tick() so the run does not depend on frame rate.
import fs from 'node:fs';
import { installHandDriver, calibrate } from './handdriver.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
const STOP = process.env.STOP || '', FROM = process.env.FROM || '', MODE = process.env.MODE || 'mouse';
const SHOTS = (process.env.SHOTS || '').split(',').filter(Boolean);
const VERBOSE = !!process.env.VERBOSE;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const log = []; const say = s => { log.push(s); console.log(s); };
  let D; // driver: T(seconds), moveTo({x,y}), down(), up(), cut(n)
  if (MODE === 'hands') {
    await installHandDriver(page);
    await ev(() => { window.__simPause = true; window.__sim.HT.sim = true; });
    await page.click('#btnBeginHands');
    const cal = await calibrate(page, process.env.CAM || 'upright');
    say('calibrated: ' + JSON.stringify(cal));
    D = {
      T: dt => ev(n => window.__drv.step(n), Math.max(1, Math.ceil(dt * 30))),
      moveTo: async n => { const r = await ev(n => window.__drv.moveTo('R', n.x, n.y), n); if (!r.ok) say('   (pointer did not reach target: ' + JSON.stringify(r) + ')'); await D.T(0.5); },
      down: () => ev(() => { window.__drv.hands.R.ap = 0.14; window.__drv.step(3); }),
      up: () => ev(() => { window.__drv.hands.R.ap = 0.62; window.__drv.step(3); }),
      cut: async () => { await D.T(0.4); await D.down(); await D.T(0.2); await D.up(); }
    };
  } else {
    await page.click('#btnBegin');
    await ev(() => { window.__simPause = true; });
    const box = await page.locator('#ov').boundingBox();
    D = {
      T: dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.max(1, Math.ceil(dt / 0.033))),
      moveTo: async n => { await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 2 }); await D.T(0.9); },
      down: () => page.mouse.down(), up: () => page.mouse.up(),
      cut: async n => { await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); }
    };
  }
  const T = D.T;
  const next = () => ev(() => window.__sim.next());
  const info = () => ev(() => { const s = window.__sim, st = s.STEPS[s.S.step], h = s.HAND.R, P = h.pick; return { i: s.S.step, id: st.id, tool: st.tool, rec: st.rec, ended: s.S.ended, t: s.S.t, ebl: s.S.ebl, nb: s.S.bleeders.length, inj: Object.keys(s.S.injuries).join(','), nev: s.S.events.length, xm: s.S.stats.expoMiss, pick: { ent: P.ent, side: P.side, u: +P.u.toFixed(3), v: +P.v.toFixed(3) }, near: h.near, inst: h.inst, on: h.ptr.on, prog: st.progress ? st.progress() : '' }; });
  const setPose = async p => { await ev(p => window.__sim.setPoseGoal(p), p); await T(1.4); };
  const setInst = async t => { const cur = await ev(() => window.__sim.HAND.R.inst); if (cur === t) return; await ev(t => window.__sim.setInst('R', t), t); await T(0.9); };
  const shot = async name => { await T(1.5); await ev(() => window.__sim.render()); await page.waitForTimeout(300); await page.screenshot({ path: OUT + name + '.png' }); };
  if (FROM) { await ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, FROM); say('skipped to ' + FROM); }
  const colpPoses = [{ yaw: 0, pitch: -0.1, push: 1 }, { yaw: 0, pitch: 0.95, push: 1 }, { yaw: -0.5, pitch: 0.2, push: 1 }, { yaw: 0.5, pitch: 0.2, push: 1 }, { yaw: -0.45, pitch: 0.95, push: 1 }, { yaw: 0.45, pitch: 0.95, push: 1 }];
  let lastStep = -1, stuck = 0, colpI = 0, guard = 0, lastInj = '', lastEv = 0, prevId = '', xm = 0;
  while (guard++ < 1200) {
    const I = await info();
    if (I.inj !== lastInj) { say('  !! injury during ' + I.id + ': ' + I.inj + ' pick=' + JSON.stringify(I.pick)); lastInj = I.inj; }
    if (I.nev !== lastEv) { const evs = await ev(n => window.__sim.S.events.slice(n).map(e => e.type + ': ' + e.text), lastEv); for (const e of evs) say('  event [' + I.id + '] ' + e); lastEv = I.nev; }
    if (I.xm !== xm) { say('  expoMiss -> ' + I.xm + ' during ' + I.id); xm = I.xm; }
    if (I.ended) { say('ENDED t=' + I.t.toFixed(1) + ' ebl=' + I.ebl.toFixed(0)); break; }
    if (I.i !== lastStep) {
      if (lastStep >= 0) { say('done ' + prevId + ' at t=' + I.t.toFixed(1)); if (SHOTS.includes(prevId)) await shot('f-' + prevId); if (STOP === prevId) break; }
      lastStep = I.i; prevId = I.id; stuck = 0;
      if (I.rec) await setPose(I.rec);
      if (I.tool !== 'any') await setInst(I.tool);
      await T(0.8);
      if (SHOTS.includes('pre-' + I.id)) await shot('pre-' + I.id);
      continue;
    }
    const n = await next();
    if (!n) { await T(0.3); if (++stuck > 30) { say('STUCK (no next) at ' + I.id + ' ' + JSON.stringify(I)); break; } continue; }
    if (n.act === 'bleed') { await setInst('bipolar'); await D.moveTo(n); await D.down(); await T(1.7); await D.up(); if (I.tool !== 'any') await setInst(I.tool); continue; }
    if (n.act === 'button') { await ev(() => window.__sim.render()); const b2 = await page.locator('#stepBtn2').isVisible(); await page.click(b2 ? '#stepBtn2' : '#stepBtn1'); await T(0.6); continue; }
    if (I.id === 'colp' && (n.hidden || !n.vis)) { await setPose(colpPoses[colpI++ % colpPoses.length]); if (colpI > 40) { say('STUCK colp ' + I.prog); break; } continue; }
    if (!n.vis && n.act !== 'suction') { if (++stuck > 4) { say('TARGET HIDDEN at ' + I.id + ' act=' + n.act + ' label=' + n.label); await shot('hidden-' + I.id); break; } }
    const before = JSON.stringify([I.prog, n.act, n.label]);
    if (n.act === 'suction') await setInst('suction');
    await D.moveTo(n);
    if (VERBOSE) { const J = await info(); say('   ' + I.id + ' ' + n.act + ' "' + n.label + '" pick=' + JSON.stringify(J.pick) + ' near=' + J.near + ' on=' + J.on); }
    if (n.act === 'click' || n.act === 'bite') { await D.down(); await T(0.1); await D.up(); await T(n.act === 'bite' ? 1.2 : 0.3); }
    else if (n.act === 'cut') { await D.cut(n); await T(0.5); }
    else if (n.act === 'seal') { await D.down(); for (let k = 0; k < 40; k++) { await T(0.2); const m = await next(); if (!m || m.act !== 'seal') break; } await D.up(); await T(0.2); }
    else if (n.act === 'trace' || n.act === 'push') { await D.down(); await T(n.act === 'push' ? 0.75 : 0.25); await D.up(); await T(0.15); }
    else if (n.act === 'suction') { await D.down(); await T(2.5); await D.up(); }
    const J = await info(), m = await next();
    const after = JSON.stringify([J.prog, m && m.act, m && m.label]);
    if (J.i === I.i && after === before) { if (++stuck > 5) { say('NO PROGRESS at ' + I.id + ' act=' + n.act + ' label=' + n.label + ' pick=' + JSON.stringify(J.pick) + ' near=' + J.near + ' on=' + J.on + ' inst=' + J.inst + ' prog=' + J.prog); await shot('stuck-' + I.id); break; } } else stuck = 0;
  }
  const fin = await ev(() => { const s = window.__sim.S; return { step: s.step, ended: s.ended, t: +s.t.toFixed(1), ebl: +s.ebl.toFixed(1), injuries: Object.keys(s.injuries), stats: s.stats, stitches: s.cuff.stitches.length, bites: s.cuff.stitches.map(b => [b.x, b.da, b.dp].map(v => +v.toFixed(2)).join('/')) }; });
  say(JSON.stringify(fin));
  fs.writeFileSync(OUT + 'flow-' + MODE + '.log', log.join('\n'));
  await ev(() => window.__sim.render());
  await page.waitForTimeout(300);
}
