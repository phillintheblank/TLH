// The salpingectomy for a ruptured ectopic: its place in the chooser, the blood and clot, the rupture that bleeds until
// its supply is sealed, and the case's rules and complication paths. Real mouse input, auto depth.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  const look = () => ev(() => { const s = window.__sim; return { id: s.CASE.id, cases: document.querySelectorAll('#caseList .case').length, tools: document.querySelectorAll('#insts .inst').length, steps: document.querySelectorAll('#checklist li').length, pool: s.S.pool, clots: s.EC.clots.filter(c => c.m.visible).length, wide: s.POOL.scale.x, swollen: !!(s.CASE.tube && s.CASE.tube('R')), model: s.UT.mesh.visible, saved: localStorage.getItem('tlh.case.v1') }; });
  const settle = () => ev(() => { for (let i = 0; i < 10; i++) window.__sim.tick(0.033); });
  // ---- the chooser ----
  await page.click('#caseList .case:nth-child(3)'); await settle(); let c = await look();
  ok('the third case is the ectopic: its tray and steps, a pelvis full of blood, clots, a swollen tube', c.cases === 6 && c.id === 'ect' && c.tools === 3 && c.steps === 7 && c.pool === 500 && c.clots === 4 && c.wide === 2 && c.swollen && c.model && c.saved === 'ect', c);
  await page.click('#caseList .case:nth-child(1)'); await settle(); c = await look();
  ok('choosing the hysterectomy clears all of that away', c.id === 'tlh' && c.pool === 0 && c.clots === 0 && c.wide === 1 && !c.swollen && c.tools === 5, c);
  await page.click('#caseList .case:nth-child(3)');
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const at = async p => { const q = await ev(p => window.__sim.proj(p), p); await page.mouse.move(box.x + q.x, box.y + q.y, { steps: 3 }); await T(0.9); };
  const next = () => ev(() => window.__sim.next());
  const atNext = async () => { const n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); return n; };
  const click = async () => { await page.mouse.down(); await T(0.1); await page.mouse.up(); await T(0.4); };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const rclick = async n => { await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(0.6); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const btn = async id => { await ev(() => window.__sim.render()); await page.click(id); }; // the panel is drawn with the picture: draw it, then press
  const hand = async k => { await ev(k => window.__sim.setActive(k), k); await T(0.3); };
  const tube = (k, u, lift) => ev(([k, u, lift]) => { const p = window.__sim.AN.side[k].cur.tubeCur[Math.round(u * 32)]; return [p.x, p.y + (lift || 0), p.z]; }, [k, u, lift]);
  const M = () => ev(() => { const s = window.__sim, S = s.S, m = S.ect, sd = S.side.R; return { step: s.STEPS[S.step].id, pool: +S.pool.toFixed(1), ebl: +S.ebl.toFixed(1), rate: +m.rate.toFixed(1), clots: m.clots.map(v => +v.toFixed(2)), tear: m.tear, tCtrl: m.tCtrl, dropped: m.dropped, bites: S.mesoBite.R, isth: { cut: sd.isth.cut, seals: sd.isth.seals.length, act: !!sd.isth.act, uc: +sd.isth.uc.toFixed(2) }, spec: sd.spec && { gone: sd.spec.gone, y: +sd.spec.off.y.toFixed(2), at: s.AN.side.R.cur.tubeCur[19].toArray() }, grab: s.HANDS.map(h => !!(h.grab && h.grab.pull)), firing: s.HANDS.map(h => h.firing), xm: S.stats.expoMiss, unsealed: S.stats.unsealedCuts, bleeders: S.bleeders.map(b => b.label), inj: Object.keys(S.injuries), b2: !document.getElementById('stepBtn2').hidden, hud: document.getElementById('hudEBL').textContent, ev: S.events.map(e => e.text) }; });
  const seal = async () => { const n = await atNext(); await page.mouse.down(); for (let k = 0; k < 30; k++) { await T(0.2); const m = await next(); if (!m || m.act !== 'seal') break; } await page.mouse.up(); await T(0.3); return n; };
  // ---- the blood ----
  await T(4); await ev(() => window.__sim.render()); let m = await M();
  ok('the rupture bleeds into the pelvis at its set rate, and the estimate counts the blood already there', m.rate === 30 && m.ebl > 1.5 && m.ebl < 3 && m.pool > 501 && /^50\d mL$/.test(m.hud), { rate: m.rate, ebl: m.ebl, pool: m.pool, hud: m.hud });
  await inst('R', 'suction'); await atNext(); const p0 = (await M()).pool; await hold(3); m = await M();
  ok('suction in the blood lowers it', p0 - m.pool > 60, { from: p0, to: m.pool });
  await ev(() => { window.__sim.S.pool = 40; }); await T(1.5); m = await M();
  ok('with the blood low but the clot still over the adnexa, the step waits', m.step === 'asp' && m.clots[0] === 1, m.step);
  let n = await atNext(); await hold(3); await T(1); m = await M();
  ok('suction held on the clot clears it, and the step is done', /Clot/.test(n.label) && m.clots[0] === 0 && m.step === 'ident', { label: n.label, clots: m.clots, step: m.step });
  // ---- identification: no energy ----
  await inst('R', 'bipolar'); await at(await tube('L', 0.6)); await page.mouse.down(); await T(0.3); m = await M(); await page.mouse.up(); await T(1.5);
  ok('while identifying, a click does not fire the bipolar', !m.firing[1], m.firing);
  await ev(() => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== 'lift' && g++ < 9) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } });
  // ---- the grasper ----
  await hand('L'); await at(await tube('R', 0.58, 0.3)); const e0 = (await M()).ebl; await click(); m = await M();
  ok('grasping the pregnancy itself tears it: it bleeds more, and the jaws let go', m.tear === 1 && !m.grab[0] && m.ebl - e0 > 11 && m.rate === 45 && m.ev.some(t => /pregnancy itself was grasped/.test(t)), { tear: m.tear, rate: m.rate, grab: m.grab });
  await atNext(); await click(); n = await atNext(); await T(0.8); m = await M();
  ok('grasping the tube beside it and lifting completes the step', m.grab[0] && n.act === 'pull' && m.step === 'meso', { grab: m.grab, act: n.act, step: m.step });
  // ---- the mesosalpinx ----
  await click(); m = await M(); // let go
  await inst('R', 'bipolar'); await atNext(); await hold(0.5); m = await M();
  ok('starting to seal with the tube not held counts against exposure', !m.grab[0] && m.xm === 1, { grab: m.grab, xm: m.xm });
  await hand('L'); await at(await tube('R', 0.87, 0.1)); await click(); await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.25, { steps: 3 }); await T(0.8); await hand('R');
  n = await seal(); await rclick(await next()); m = await M();
  ok('the first bite slows the bleeding from the rupture', m.bites === 1 && m.rate === 18 && m.tCtrl == null, { bites: m.bites, rate: m.rate });
  n = await seal(); await rclick(await next()); await T(0.5); m = await M();
  ok('the second bite stops it', m.bites === 2 && m.rate === 0 && m.tCtrl != null && m.step === 'isth', { bites: m.bites, rate: m.rate, tCtrl: m.tCtrl, step: m.step });
  // ---- the isthmus ----
  await at(await tube('R', 0.5)); await hold(1.2); n = await ev(() => window.__sim.proj(window.__sim.AN.side.R.cur.tubeCur[16].toArray())); await rclick(n); m = await M();
  ok('the bipolar neither seals nor cuts the tube beyond its isthmus', !m.isth.act && !m.isth.seals && !m.isth.cut, m.isth);
  n = await atNext(); await rclick(n); await T(0.5); m = await M();
  ok('the isthmus cut without a seal bleeds; the tube comes away in the grasper', m.isth.cut && m.unsealed === 1 && m.bleeders.includes('tubal isthmus') && m.spec && !m.spec.gone && m.grab[0] && !m.dropped, { isth: m.isth, bleeders: m.bleeders, grab: m.grab });
  const a0 = m.spec.at; await hand('L'); await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 4 }); await T(1.2); const a1 = (await M()).spec.at, carried = +Math.hypot(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]).toFixed(1);
  ok('the freed tube goes where the grasper carries it', carried > 2, carried);
  await hand('R'); n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(2.0); await T(0.5); m = await M();
  ok('bipolar on the bleeding stump controls it', n.act === 'bleed' && !m.bleeders.length && m.step === 'bag', { act: n.act, bleeders: m.bleeders, step: m.step });
  await hand('L');
  const y0 = (await M()).spec.y; await click(); await T(2.5); m = await M();
  ok('let go before it is bagged, the tube falls and that is recorded', !m.grab[0] && m.dropped && m.spec.y < y0 - 0.5 && m.ev.some(t => /let go before it was bagged/.test(t)), { y0, y: m.spec.y, dropped: m.dropped });
  await btn('#stepBtn1'); await T(3.2); m = await M();
  ok('the bag takes the tube out', m.spec.gone && m.step === 'final', { gone: m.spec.gone, step: m.step });
  // ---- the end ----
  await btn('#stepBtn1'); await T(0.6); m = await M();
  ok('at low pressure the stump oozes', m.bleeders.includes('tubal stump'), m.bleeders);
  await inst('R', 'bipolar'); n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(2.0);
  await at(await tube('L', 0.5)); await hold(1.4); m = await M();
  ok('energy on the other tube, which is staying, is an injury', m.inj.includes('tubeL') && !m.inj.includes('tubeR'), m.inj);
  await ev(() => { window.__sim.S.pool = 4; }); await T(0.3); await ev(() => window.__sim.render()); m = await M();
  ok('the case cannot be ended while clots remain', !m.b2 && m.clots.filter(v => v > 0).length === 3, { b2: m.b2, clots: m.clots });
  await inst('R', 'suction');
  for (let k = 0; k < 6; k++) { n = await next(); if (!n || n.act !== 'suction') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(2.4); }
  await ev(() => window.__sim.render()); m = await M();
  ok('with the blood and clots cleared it can', m.b2 && !m.clots.some(v => v > 0) && m.pool < 15, { b2: m.b2, clots: m.clots, pool: m.pool });
  const sc = await ev(() => window.__sim.CASE.score());
  const want = [/injur/, /without a complete seal/, /pregnancy itself was grasped/, /let go before it was bagged/, /without the recommended exposure/];
  ok('each of these shows in the score', want.every(r => sc.notes.some(t => r.test(t))) && sc.pts < 70, sc);
  // ---- every case still plays to its end, one after another ----
  const play = id => ev(id => { const s = window.__sim; s.setCase(id); s.startCase(false); let g = 0; while (!s.S.ended && g++ < 60) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } return { id: s.CASE.id, ended: s.S.ended, step: s.S.step, pts: s.CASE.score().pts, clots: s.EC.clots.filter(c => c.m.visible).length, bag: s.BAG.visible, swollen: !!(s.CASE.tube && s.CASE.tube('R')), stump: s.AN.side.R.t.tubeS.mesh.visible }; }, id);
  let r = await play('tlh'); ok('the hysterectomy runs to its debrief after the ectopic, with nothing of it left behind', r.ended && r.step === 20 && r.clots === 0 && !r.bag && !r.swollen && !r.stump, r);
  r = await play('myo'); ok('the myomectomy runs to its debrief', r.ended && r.step === 8 && r.clots === 0 && !r.bag, r);
  r = await play('ect'); ok('the ectopic, forced through, runs to a clean debrief', r.ended && r.step === 6 && r.pts === 100 && r.stump, r);
  await ev(() => window.__sim.render());
}
