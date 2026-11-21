// The supracervical hysterectomy: its place in the chooser, what it shares with the total hysterectomy and where it
// parts from it (less bladder, no cardinal ligaments, no colpotomy), the amputation, and what is left behind: a cervix
// on its ligaments. Real mouse input, auto depth.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  const look = () => ev(() => { const s = window.__sim; return { id: s.CASE.id, cases: document.querySelectorAll('#caseList .case').length, tools: [...document.querySelectorAll('#insts .inst span')].map(e => e.textContent), steps: s.STEPS.map(x => x.id), cup: s.UT.cup[0].visible, uterus: s.UT.mesh.visible, corpus: s.LS.corpus.visible, stump: s.LS.stump.visible, saved: localStorage.getItem('tlh.case.v1') }; });
  const settle = () => ev(() => { for (let i = 0; i < 10; i++) window.__sim.tick(0.033); });
  // ---- the chooser ----
  await page.click('#caseList .case:nth-child(5)'); await settle(); let c = await look();
  ok('the fifth of six cases is the supracervical hysterectomy: 19 steps, no needle driver, no cup', c.cases === 6 && c.id === 'lsh' && c.steps.length === 19 && c.tools.length === 4 && !c.tools.includes('Needle driver') && !c.cup && c.uterus && !c.stump && c.saved === 'lsh', { cases: c.cases, id: c.id, n: c.steps.length, tools: c.tools, cup: c.cup });
  ok('it is the hysterectomy a side at a time as far as the uterine vessels, then amputates: no cardinal ligaments, colpotomy or cuff', c.steps.join() === 'survey,mesoR,uoR,roundR,postR,antR,bladR,uaR,mesoL,uoL,roundL,postL,antL,bladL,uaL,amp,bag,stump,final', c.steps);
  await page.click('#caseList .case:nth-child(1)'); await settle(); c = await look();
  ok('choosing the total hysterectomy puts the cup back', c.id === 'tlh' && c.cup && c.uterus && !c.corpus && !c.stump, c.cup);
  await page.click('#caseList .case:nth-child(5)');
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const at = async p => { const q = await ev(p => window.__sim.proj(p), p); await page.mouse.move(box.x + q.x, box.y + q.y, { steps: 3 }); await T(0.9); };
  const next = () => ev(() => window.__sim.next());
  const atNext = async () => { const n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); return n; };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const btn = async id => { await ev(() => window.__sim.render()); await page.click(id); await T(0.4); };
  const pose = async p => { await ev(p => window.__sim.setPoseGoal(p), p); await T(1.6); };
  const restart = async to => { await ev(to => { const s = window.__sim; s.startCase(false); let g = 0; while (to && s.STEPS[s.S.step].id !== to && g++ < 30) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } const r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }, to); await T(1.6); };
  const M = () => ev(() => {
    const s = window.__sim, S = s.S, m = S.lsh, V = s.THREE.Vector3; s.render(); // the side panel is drawn with the picture
    const o = M => new V().setFromMatrixPosition(M), y = M => new V().setFromMatrixColumn(M, 1);
    return { step: s.STEPS[S.step].id, amp: m.amp.filter(a => a >= 1).length, segs: s.LS.segs.filter(x => x.visible).length, off: m.off, canal: +m.canal.toFixed(2), char: s.LS.char.visible, flap: +S.flap.toFixed(2), flapGoal: S.flapGoal, cardCut: S.side.R.card.cut || S.side.L.card.cut, stay: !!(S.side.R.rel.card && S.side.R.rel.card.stay), cardM: s.AN.side.R.st.cardM.mesh.visible, usl: s.AN.side.R.t.usl.mesh.visible,
      uterus: s.UT.mesh.visible, corpus: s.LS.corpus.visible && s.UT.g.visible, stump: s.LS.stump.visible, gap: +o(s.UT.M).sub(o(s.VG.M)).dot(y(s.VG.M)).toFixed(2), manipOut: S.manipOut, specimen: S.specimen, bag: s.BAG.visible, pitch: +s.VG.pose.pitch.toFixed(2), tubes: s.AN.side.R.t.tube.mesh.visible,
      bleeders: S.bleeders.map(b => b.label), inj: Object.keys(S.injuries), ebl: +S.ebl.toFixed(1), lowP: S.lowP, b1: !document.getElementById('stepBtn1').hidden, b2: !document.getElementById('stepBtn2').hidden, ended: S.ended, prompt: (s.next() || {}).label };
  });
  // ---- the bladder: only as far as the amputation needs ----
  await restart('bladR'); await inst('R', 'bipolar');
  for (let i = 0; i < 2; i++) { await atNext(); await T(1.5); }
  await T(1.5); let m = await M();
  ok('on the right, the bipolar held twice at the bladder\'s edge takes it a quarter of the way down, and the vessels are next', m.step === 'uaR' && m.flapGoal === 0.25 && Math.abs(m.flap - 0.25) < 0.03 && m.inj.length === 0, { step: m.step, flap: m.flap });
  await restart('bladL'); await inst('R', 'grasper');
  for (let i = 0; i < 2; i++) { await atNext(); await T(1.5); }
  await T(1.5); m = await M();
  ok('on the left, the grasper does the same: the bladder ends half as far down as a total hysterectomy takes it', m.step === 'uaL' && m.flapGoal === 0.5 && Math.abs(m.flap - 0.5) < 0.03, { step: m.step, flap: m.flap });
  // ---- the amputation ----
  await restart('amp'); m = await M();
  ok('with both uterine pedicles divided the next step is the amputation; the cardinal ligaments are untouched', m.step === 'amp' && !m.cardCut && m.uterus && !m.stump && m.amp === 0, { step: m.step, cardCut: m.cardCut });
  await inst('R', 'hook');
  let n = await atNext(); await hold(0.5); m = await M();
  ok('the hook cuts into the cervix where it is held on the line, and leaves a scorched groove', m.amp >= 1 && m.segs === m.amp && !m.off, { amp: m.amp, segs: m.segs });
  let guard = 0, hidden = false;
  while (guard++ < 40) { n = await next(); if (!n || n.act !== 'trace') break; if (n.hidden) { hidden = true; break; } await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.7); await hold(0.4); }
  m = await M();
  ok('the back of the cervix cannot be reached from in front: the prompt asks for the uterus to be repositioned', hidden && m.amp >= 4 && m.amp < 12 && /Reposition/.test(n.label), { amp: m.amp, label: n && n.label });
  for (const p of [{ yaw: 0, pitch: 0.95, push: 1 }, { yaw: -0.5, pitch: 0.2, push: 1 }, { yaw: 0.5, pitch: 0.2, push: 1 }, { yaw: -0.45, pitch: 0.95, push: 1 }, { yaw: 0.45, pitch: 0.95, push: 1 }, { yaw: 0, pitch: -0.1, push: 1 }]) {
    await pose(p); guard = 0;
    while (guard++ < 30) { n = await next(); if (!n || n.act !== 'trace' || n.hidden) break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.7); await hold(0.4); }
    if (!n || n.act !== 'trace') break;
  }
  await T(2); m = await M();
  ok('cut all the way round, the body of the uterus comes off: it lifts, and the cervix stays on the vagina', m.off && m.amp === 12 && m.corpus && m.stump && !m.uterus && m.segs === 0 && m.gap > 0.5 && m.step === 'bag', { off: m.off, gap: m.gap, step: m.step });
  ok('the manipulator is out, and the cardinal and uterosacral ligaments are still on the cervix', m.manipOut && !m.cardCut && m.stay && m.cardM && m.usl && m.inj.length === 0, { manipOut: m.manipOut, stay: m.stay, cardM: m.cardM });
  // ---- out in a bag ----
  ok('the specimen has to go into a bag: the button is offered', m.b1 && m.specimen === 'in' && m.tubes, { b1: m.b1 });
  await btn('#stepBtn1'); await T(0.6); m = await M();
  const inBag = m.bag;
  await T(3.2); m = await M();
  ok('bagged, the uterus and its tubes leave the field; the cervix rests where its ligaments hold it', inBag && m.specimen === 'out' && !m.corpus && !m.tubes && m.stump && m.cardM && !m.bag && m.step === 'stump', { specimen: m.specimen, step: m.step });
  // ---- the stump ----
  await T(2); m = await M();
  ok('a vessel on the stump is bleeding, and the stump sits near neutral rather than falling back like a cuff', m.bleeders.includes('cervical stump') && m.pitch > 0 && m.pitch < 0.3, { bleeders: m.bleeders, pitch: m.pitch });
  await inst('R', 'bipolar');
  n = await atNext(); await hold(1.7); m = await M();
  ok('bipolar on the bleeding point stops it', m.bleeders.length === 0 && m.step === 'stump', m.bleeders);
  n = await atNext(); await hold(0.7); m = await M();
  const part = m.canal;
  ok('the canal has then to be coagulated: a short touch is not enough', n.label === 'Coagulate the canal' && part > 0.2 && part < 1 && m.step === 'stump' && m.char, { canal: part });
  await atNext(); await hold(1.6); await T(0.5); m = await M();
  ok('held on the canal until it is done, the step completes', m.canal === 1 && m.step === 'final', { canal: m.canal, step: m.step });
  // ---- completion ----
  await btn('#stepBtn1'); m = await M();
  ok('at low pressure the edge of the stump oozes, and the case cannot be ended yet', m.lowP && m.bleeders.includes('cervical stump') && !m.b2, m.bleeders);
  await atNext(); await hold(1.7);
  for (let i = 0; i < 2; i++) { n = await atNext(); await T(1.4); }
  m = await M();
  ok('with the ooze stopped and both ureters seen to work, the case can be ended', m.bleeders.length === 0 && m.b2 && m.inj.length === 0, { b2: m.b2, prompt: m.prompt });
  await btn('#stepBtn2'); await T(0.5);
  const d = await ev(() => ({ ended: window.__sim.S.ended, text: document.getElementById('debrief').textContent, score: window.__sim.CASE.score() }));
  ok('the debrief says what was kept and how the specimen left', d.ended && /Kept, with its cardinal and uterosacral ligaments/.test(d.text) && /In a bag/.test(d.text) && /Canal coagulated/.test(d.text) && !/Cuff stitches/.test(d.text) && d.score.pts === 100, d.score);
  // ---- energy where it must not go ----
  await restart('amp'); await inst('R', 'hook');
  let on = null;
  for (const [dy, dz] of [[0.2, 2], [0.1, 2.1], [0.35, 1.8]]) { await at(await ev(([dy, dz]) => { const s = window.__sim; return [s.BL.c.x, s.BL.c.y + s.BL.r.y * dy, s.BL.c.z + dz]; }, [dy, dz])); on = await ev(() => window.__sim.PICK.ent); if (on === 'bladder') break; } // the part of the bladder that is in the picture
  await hold(1.2); m = await M();
  ok('the hook held on the bladder during the amputation is a bladder injury', m.inj.includes('bladder') && m.amp === 0, m.inj);
  // ---- leaving the case ----
  await restart('stump');
  await ev(() => window.__sim.setCase('tlh')); await settle(); c = await look();
  ok('going back to the total hysterectomy restores the whole uterus and its cup', c.id === 'tlh' && c.uterus && c.cup && !c.corpus && !c.stump, c);
}
