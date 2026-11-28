// The ovarian cystectomy: its place in the chooser, the ovary with a cyst in it, and the case's rules and
// complication paths (the three ways to rupture the cyst, counter-traction, energy on the ovary). Real mouse input,
// auto depth.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  const look = () => ev(() => { const s = window.__sim; return { id: s.CASE.id, cases: document.querySelectorAll('#caseList .case').length, tools: document.querySelectorAll('#insts .inst').length, steps: document.querySelectorAll('#checklist li').length, cystOvary: s.CY.ov.visible, modelOvary: s.AN.side.R.ovary.visible, otherOvary: s.AN.side.L.ovary.visible, saved: localStorage.getItem('tlh.case.v1') }; });
  const settle = () => ev(() => { for (let i = 0; i < 10; i++) window.__sim.tick(0.033); });
  // ---- the chooser ----
  await page.click('#caseList .case:nth-child(4)'); await settle(); let c = await look();
  ok('the fourth case is the cystectomy: its tray and steps, and an ovary with a cyst in place of the model\'s right ovary', c.cases === 7 && c.id === 'cyst' && c.tools === 4 && c.steps === 7 && c.cystOvary && !c.modelOvary && c.otherOvary && c.saved === 'cyst', c);
  await page.click('#caseList .case:nth-child(1)'); await settle(); c = await look();
  ok('choosing the hysterectomy puts the model\'s ovary back', c.id === 'tlh' && !c.cystOvary && c.modelOvary && c.tools === 5, c);
  await page.click('#caseList .case:nth-child(4)');
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const at = async p => { const q = await ev(p => window.__sim.proj(p), p); await page.mouse.move(box.x + q.x, box.y + q.y, { steps: 3 }); await T(0.9); };
  const next = () => ev(() => window.__sim.next());
  const atNext = async () => { const n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); return n; };
  const click = async () => { await page.mouse.down(); await T(0.1); await page.mouse.up(); await T(0.4); };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const hand = async k => { await ev(k => window.__sim.setActive(k), k); await T(0.3); };
  const btn = async id => { await ev(() => window.__sim.render()); await page.click(id); await T(0.4); }; // the panel is drawn with the picture: draw it, then press
  const restart = async to => { await ev(to => { const s = window.__sim; s.startCase(false); let g = 0; while (to && s.STEPS[s.S.step].id !== to && g++ < 20) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } }, to); await ev(() => window.__sim.setPoseGoal({ yaw: -0.5, pitch: 0.3, push: 0.3 })); await T(2); };
  const pt = what => ev(what => { // a place on the ovary or the cyst
    const s = window.__sim, CY = s.CY, G = CY.G, V = new s.THREE.Vector3();
    if (what === 'cyst') return G.Q.clone().add(s.S.cyst.off).addScaledVector(G.D, CY.R * 0.98).toArray();
    if (what === 'plane') return s.cySurf(G.a + 0.02, CY.AZ[Math.min(s.S.cyst.n, CY.AZ.length - 1)], 0.05, V).toArray();
    if (what === 'cortex') return s.cySurf(G.a + 0.9, -60, 0, V).toArray();
    if (what === 'bed') return s.cyBed(0.15, 0, V).toArray();
    if (what === 'other') { const p = s.AN.side.L.cur.ovC; return [p.x + 0.3, p.y + 0.5, p.z + 0.5]; }
    return s.cySurf(Math.abs((what - 2.5) * CY.DA), what < 2.5 ? CY.LINE - 180 : CY.LINE, 0, V).toArray(); // a number: that point of the incision
  }, what);
  const M = () => ev(() => { const s = window.__sim, S = s.S, m = S.cyst; return { step: s.STEPS[S.step].id, n: m.n, inc: m.inc, open: +m.open.toFixed(2), rupt: m.rupt, spill: m.spill.filter(v => v > 0).length, lumps: s.CY.spill.filter(x => x.m.visible).length, free: m.free, out: m.out, burn: +m.burn.toFixed(2), heat: +m.heat.toFixed(2), deep: +m.deep.toFixed(2), ebl: +S.ebl.toFixed(1), pool: +S.pool.toFixed(1), bleeders: S.bleeders.map(b => b.label), inj: Object.keys(S.injuries), holds: s.HANDS.map(h => (h.grab && h.grab.pull ? h.grab.ent : h.grab ? 'empty' : '')), acts: S.stats.activations, blunt: +S.stats.blunt.toFixed(2), xm: S.stats.expoMiss, cyst: s.CY.cy.visible, slack: +s.CY.cy.scale.y.toFixed(2), line: s.CY.cut.visible, low: s.CY.cy.position.y, b2: !document.getElementById('stepBtn2').hidden, ended: S.ended, ev: S.events.map(e => e.text) }; });
  // ---- survey: no energy ----
  let n = await atNext(); await page.mouse.down(); await T(0.3); let m = await M(); await page.mouse.up(); await T(0.3);
  ok('while surveying, a press of the bipolar gives no energy', m.acts === 0 && m.step === 'look', { acts: m.acts });
  for (let k = 0; k < 3; k++) { await atNext(); await T(1.3); }
  m = await M(); ok('holding a tip beside the uterus, the cyst and the other ovary completes the survey', m.step === 'steady', m.step);
  // ---- steady, incise ----
  await ev(() => window.__sim.setPoseGoal({ yaw: -0.5, pitch: 0.3, push: 0.3 })); await T(2);
  await hand('L'); n = await atNext(); await click(); await T(1); m = await M();
  ok('the grasper takes the utero-ovarian ligament and the ovary is steadied', m.holds[0] === 'uo' && m.step === 'incise', { holds: m.holds, step: m.step });
  await inst('R', 'hook');
  for (let k = 0; k < 3; k++) { await atNext(); await hold(0.16); }
  m = await M(); ok('the hook scores the cortex point by point: a line, and the cortex not yet open', m.inc === 3 && m.line && !m.cyst && m.open < 0.05 && !m.rupt, { inc: m.inc, line: m.line, cyst: m.cyst });
  await at(await pt(0)); await hold(1.3); m = await M();
  ok('energy held on cortex already cut goes through into the cyst: it ruptures, and its contents spill', m.rupt === 'deep' && m.spill === 3 && m.ev.some(t => /incision went through/.test(t)), { rupt: m.rupt, deep: m.deep, spill: m.spill });
  await T(2); m = await M();
  ok('the cortex has parted, the cyst shows slack, and three lumps of its contents lie in the pelvis', m.step === 'strip' && m.cyst && m.slack < 0.9 && m.lumps === 3, { step: m.step, slack: m.slack, lumps: m.lumps });
  await ev(() => { const s = window.__sim; for (let g = 0; g < 3; g++) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } s.S.pool = 0; }); await T(0.5);
  await btn('#stepBtn1'); await T(0.5); await inst('R', 'bipolar'); n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(1.5); await ev(() => { window.__sim.S.pool = 0; }); await ev(() => window.__sim.render()); m = await M();
  ok('the case cannot be ended while spilled contents remain', m.step === 'final' && !m.bleeders.length && !m.b2 && m.spill === 3, { step: m.step, bleeders: m.bleeders, b2: m.b2, spill: m.spill });
  await inst('R', 'suction');
  for (let k = 0; k < 6; k++) { n = await next(); if (!n || n.act !== 'suction') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(2.0); await ev(() => { window.__sim.S.pool = 0; }); }
  await ev(() => window.__sim.render()); m = await M(); let sc = await ev(() => window.__sim.CASE.score());
  ok('suction held on each lump clears it, and then it can', m.spill === 0 && m.b2 && sc.notes.some(t => /ruptured/.test(t)) && sc.pts <= 90, { spill: m.spill, b2: m.b2, sc });
  // ---- a clean cystectomy ----
  await restart('steady');
  await hand('L'); await atNext(); await click(); await T(1);
  await inst('R', 'hook');
  for (let k = 0; k < 6; k++) { n = await next(); if (!n || n.act !== 'trace') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(0.16); }
  await T(1.5); m = await M();
  ok('traced once and no deeper, the cortex parts over an intact cyst', m.step === 'strip' && m.inc === 6 && m.open > 0.95 && m.cyst && !m.rupt && m.slack === 1 && m.xm === 0, { step: m.step, inc: m.inc, open: m.open, rupt: m.rupt, xm: m.xm });
  await hand('L'); n = await atNext(); await click(); m = await M();
  ok('the prompt is to let go of the ligament first', /Let go/.test(n.label) && m.holds[0] === '', { label: n.label, holds: m.holds });
  await inst('R', 'suction'); await at(await pt('plane')); await hold(1.0); m = await M();
  ok('without counter-traction the plane does not open', m.n === 0, { n: m.n });
  await hand('L'); n = await atNext(); await click(); m = await M();
  ok('the grasper takes the cut edge of the cortex', /cut edge/.test(n.label) && m.holds[0] === 'ovary', { label: n.label, holds: m.holds });
  await hand('R'); n = await atNext(); await hold(0.7); m = await M();
  ok('with it held, the suction tip pushes the cyst off the cortex', n.act === 'suction' && m.n === 1 && m.blunt > 0.4, { n: m.n, blunt: m.blunt });
  await inst('R', 'hook'); await at(await pt('plane')); await hold(0.13); m = await M();
  ok('a touch of energy in the plane heats the cyst wall but does not yet breach it', m.heat > 0.1 && !m.rupt && m.n === 1, { heat: m.heat, rupt: m.rupt });
  await inst('R', 'suction');
  let high = 0;
  for (let k = 0; k < 14; k++) { n = await next(); if (!n || n.act !== 'suction') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(1.2); high = (await M()).low; await hold(0.7); await T(0.8); }
  await T(2.5); m = await M();
  ok('worked round to its base, the cyst comes out whole and rolls to rest below the ovary', m.free && m.n === 8 && !m.rupt && m.step === 'bag' && m.low < high - 0.5 && m.holds[0] === 'ovary', { n: m.n, rupt: m.rupt, step: m.step, fell: +(high - m.low).toFixed(2), holds: m.holds });
  await btn('#stepBtn1'); await T(3.2); m = await M();
  ok('bagged, it is taken out, and two vessels bleed in the bed', m.out && !m.cyst && m.step === 'bed' && m.bleeders.length === 2, { out: m.out, step: m.step, bleeders: m.bleeders });
  await inst('R', 'bipolar');
  for (let k = 0; k < 4; k++) { n = await next(); if (!n || n.act !== 'bleed') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(1.4); }
  await T(0.5); m = await M(); sc = await ev(() => window.__sim.CASE.score());
  ok('a short touch on each stops it; the seconds of bipolar on the ovary are counted, and the score is clean', m.step === 'final' && !m.bleeders.length && m.burn > 2 && m.burn < 5 && !m.inj.length && sc.pts === 100, { step: m.step, burn: m.burn, inj: m.inj, sc });
  await at(await pt('bed')); await hold(6); m = await M(); sc = await ev(() => window.__sim.CASE.score());
  ok('painting the bed is recorded against the ovary, once, and not as an injury', m.burn > 8 && !m.inj.length && m.ev.some(t => /Prolonged coagulation/.test(t)) && sc.notes.length === 1 && /Bipolar on the ovary/.test(sc.notes[0]) && sc.pts < 100, { burn: m.burn, inj: m.inj, sc });
  await btn('#stepBtn1'); await T(0.5); m = await M();
  ok('at low pressure the bed oozes', m.bleeders.length === 1, m.bleeders);
  n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(1.4);
  await inst('R', 'suction');
  for (let k = 0; k < 6; k++) { n = await next(); if (!n || n.act !== 'suction') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(2.0); }
  await ev(() => window.__sim.render()); m = await M();
  ok('with the ooze controlled and the pelvis dry the case can be ended', m.b2 && !m.bleeders.length && m.pool < 8, { b2: m.b2, pool: m.pool });
  await btn('#stepBtn2'); await T(0.3); const db = await ev(() => ({ ended: window.__sim.S.ended, shown: !document.getElementById('debrief').hidden, text: document.getElementById('debrief').innerText }));
  ok('the debrief says the cyst came out intact and how long the bipolar was on the ovary', db.ended && db.shown && /Cyst removed intact\s*Yes/.test(db.text) && /Bipolar on the ovary\s*\d/.test(db.text), { ended: db.ended, shown: db.shown });
  // ---- the other ways to rupture it, and what energy elsewhere does ----
  await restart('strip'); await T(1);
  await hand('L'); await at(await pt('cyst')); await click(); m = await M();
  ok('a grasper closed on the cyst itself goes through its wall', m.rupt === 'grasp' && m.spill === 3 && m.holds[0] !== 'ovary', { rupt: m.rupt, holds: m.holds });
  await restart('strip'); await T(1);
  await inst('R', 'hook'); await at(await pt('cyst')); await hold(0.4); m = await M();
  ok('so does energy on the cyst wall', m.rupt === 'energy' && m.spill === 3, { rupt: m.rupt, heat: m.heat });
  await inst('R', 'bipolar'); await at(await pt('cortex')); await hold(1.0); m = await M();
  ok('energy on the ovary being operated on is counted, and is not an injury', m.burn > 0.7 && !m.inj.length, { burn: m.burn, inj: m.inj });
  await ev(() => window.__sim.setPoseGoal({ yaw: 0, pitch: 0.35, push: 0.35 })); await T(2);
  await at(await pt('other')); await hold(1.0); m = await M(); sc = await ev(() => window.__sim.CASE.score());
  ok('energy on the other ovary is an injury', m.inj.includes('ovaryL') && sc.notes.some(t => /injur/.test(t)) && sc.notes.some(t => /ruptured/.test(t)), { inj: m.inj, sc });
  // ---- every case still plays to its end, one after another ----
  const play = id => ev(id => { const s = window.__sim; s.setCase(id); s.startCase(false); let g = 0; while (!s.S.ended && g++ < 60) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } return { id: s.CASE.id, ended: s.S.ended, step: s.S.step, pts: s.CASE.score().pts, cystOvary: s.CY.ov.visible, cyst: s.CY.cy.visible, lumps: s.CY.spill.filter(x => x.m.visible).length, modelOvary: s.AN.side.R.ovary.visible, bag: s.BAG.visible }; }, id);
  let r = await play('tlh'); ok('the hysterectomy runs to its debrief after the cystectomy, with nothing of it left behind', r.ended && r.step === 20 && !r.cystOvary && !r.cyst && !r.lumps && r.modelOvary && !r.bag, r);
  r = await play('myo'); ok('the myomectomy runs to its debrief', r.ended && r.step === 8 && !r.cystOvary && r.modelOvary, r);
  r = await play('ect'); ok('the ectopic runs to its debrief', r.ended && r.step === 6 && r.pts === 100 && !r.cystOvary && r.modelOvary, r);
  r = await play('cyst'); ok('the cystectomy, forced through, runs to a clean debrief', r.ended && r.step === 6 && r.pts === 100 && r.cystOvary && !r.cyst && !r.modelOvary, r);
  await ev(() => window.__sim.render());
}
