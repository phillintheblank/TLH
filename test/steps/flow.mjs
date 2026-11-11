// Drive the case with real mouse input, using the same "next target" data the guidance overlay draws.
// Simulation time is advanced synchronously through the page's tick() so the run does not depend on frame rate.
import fs from 'node:fs';
const OUT = '/home/claude/sim/test/out/';
const STOP = process.env.STOP || '', FROM = process.env.FROM || '';
const SHOTS = (process.env.SHOTS || '').split(',').filter(Boolean);
const VERBOSE = !!process.env.VERBOSE;
export default async function (page) {
  await page.click('#btnBegin');
  await page.evaluate(() => { window.__simPause = true; });
  const box = await page.locator('#ov').boundingBox();
  const ev = (fn, a) => page.evaluate(fn, a);
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.max(1, Math.ceil(dt / 0.033)));
  const next = () => ev(() => window.__sim.next());
  const info = () => ev(() => { const s = window.__sim, st = s.STEPS[s.S.step], h = s.HAND[s.active]; return { i: s.S.step, id: st.id, tool: st.tool, rec: st.rec, ended: s.S.ended, t: s.S.t, ebl: s.S.ebl, nb: s.S.bleeders.length, inj: Object.keys(s.S.injuries).join(','), nev: s.S.events.length, xm: s.S.stats.expoMiss, pick: { ent: s.PICK.ent, side: s.PICK.side, u: +s.PICK.u.toFixed(3), v: +s.PICK.v.toFixed(3) }, near: h.near, inst: h.inst, prog: st.progress ? st.progress() : '' }; });
  const setPose = async p => { await ev(p => window.__sim.setPoseGoal(p), p); await T(1.4); };
  const setInst = async t => { const cur = await ev(() => window.__sim.HAND[window.__sim.active].inst); if (cur === t) return; await ev(t => window.__sim.setInst(window.__sim.active, t), t); await T(0.9); };
  const moveTo = async n => { await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 2 }); await T(0.9); };
  const shot = async name => { await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.96); await T(1.5); await ev(() => window.__sim.render()); await page.waitForTimeout(300); await page.screenshot({ path: OUT + name + '.png' }); };
  const log = []; const say = s => { log.push(s); console.log(s); };
  if (FROM) { await ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, FROM); say('skipped to ' + FROM); }
  const colpPoses = [{ yaw: 0, pitch: -0.1, push: 1 }, { yaw: 0, pitch: 0.95, push: 1 }, { yaw: -0.5, pitch: 0.2, push: 1 }, { yaw: 0.5, pitch: 0.2, push: 1 }, { yaw: -0.45, pitch: 0.95, push: 1 }, { yaw: 0.45, pitch: 0.95, push: 1 }, { yaw: -0.6, pitch: 0.6, push: 1 }, { yaw: 0.6, pitch: 0.6, push: 1 }];
  let lastStep = -1, stuck = 0, colpI = 0, guard = 0, lastInj = '', lastEv = 0, prevId = '';
  while (guard++ < 1200) {
    const I = await info();
    if (I.inj !== lastInj) { say('  !! injury during ' + I.id + ': ' + I.inj + ' pick=' + JSON.stringify(I.pick)); lastInj = I.inj; }
    if (I.nev !== lastEv) { const evs = await ev(n => window.__sim.S.events.slice(n).map(e => e.type + ': ' + e.text), lastEv); for (const e of evs) say('  event [' + I.id + '] ' + e); lastEv = I.nev; }
    if (I.xm !== (globalThis.__xm || 0)) { say('  expoMiss -> ' + I.xm + ' during ' + I.id); globalThis.__xm = I.xm; }
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
    if (n.act === 'bleed') { await setInst('bipolar'); await moveTo(n); await page.mouse.down(); await T(1.7); await page.mouse.up(); if (I.tool !== 'any') await setInst(I.tool); continue; }
    if (n.act === 'button') { await ev(() => window.__sim.render()); const b2 = await page.locator('#stepBtn2').isVisible(); await page.click(b2 ? '#stepBtn2' : '#stepBtn1'); await T(0.6); continue; }
    if (I.id === 'colp' && (n.hidden || !n.vis)) { await setPose(colpPoses[colpI++ % colpPoses.length]); if (colpI > 40) { say('STUCK colp ' + I.prog); break; } continue; }
    if (!n.vis && n.act !== 'suction') { if (++stuck > 4) { say('TARGET HIDDEN at ' + I.id + ' act=' + n.act + ' label=' + n.label); await shot('hidden-' + I.id); break; } }
    const before = JSON.stringify([I.prog, n.act, n.label]);
    if (n.act === 'suction') await setInst('suction');
    await moveTo(n);
    if (VERBOSE) { const J = await info(); say('   ' + I.id + ' ' + n.act + ' "' + n.label + '" pick=' + JSON.stringify(J.pick) + ' near=' + J.near); }
    if (n.act === 'click' || n.act === 'bite') { await page.mouse.down(); await page.mouse.up(); await T(n.act === 'bite' ? 1.2 : 0.3); }
    else if (n.act === 'cut') { await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(0.5); }
    else if (n.act === 'seal') { await page.mouse.down(); for (let k = 0; k < 40; k++) { await T(0.2); const m = await next(); if (!m || m.act !== 'seal') break; } await page.mouse.up(); await T(0.2); }
    else if (n.act === 'trace' || n.act === 'push') { await page.mouse.down(); await T(n.act === 'push' ? 0.75 : 0.25); await page.mouse.up(); await T(0.15); }
    else if (n.act === 'suction') { await page.mouse.down(); await T(2.5); await page.mouse.up(); }
    const J = await info(), m = await next();
    const after = JSON.stringify([J.prog, m && m.act, m && m.label]);
    if (J.i === I.i && after === before) { if (++stuck > 5) { say('NO PROGRESS at ' + I.id + ' act=' + n.act + ' label=' + n.label + ' pick=' + JSON.stringify(J.pick) + ' near=' + J.near + ' inst=' + J.inst + ' prog=' + J.prog); await shot('stuck-' + I.id); break; } } else stuck = 0;
  }
  const fin = await ev(() => { const s = window.__sim.S; return { step: s.step, ended: s.ended, t: +s.t.toFixed(1), ebl: +s.ebl.toFixed(1), injuries: Object.keys(s.injuries), stats: s.stats, stitches: s.cuff.stitches.length, bites: s.cuff.stitches.map(b => [b.x, b.da, b.dp].map(v => +v.toFixed(2)).join('/')) }; });
  say(JSON.stringify(fin));
  fs.writeFileSync(OUT + 'flow.log', log.join('\n'));
  await ev(() => window.__sim.render());
  await page.waitForTimeout(300);
}
