// The case chooser, and the myomectomy's own rules and complication paths, with real mouse input (auto depth).
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  // ---- the chooser on the start screen ----
  const look = () => ev(() => { const s = window.__sim; return { id: s.CASE.id, title: document.getElementById('caseTitle').textContent, tools: document.querySelectorAll('#insts .inst').length, steps: document.querySelectorAll('#checklist li').length, on: [...document.querySelectorAll('#caseList .case')].map(b => b.classList.contains('on')), model: s.UT.mesh.visible, myo: s.UT.myo.visible, flaps: s.FB.flap.every(f => f.mesh.visible), saved: localStorage.getItem('tlh.case.v1'), brand: document.getElementById('brandSub').textContent }; });
  let c = await look();
  ok('starts on the hysterectomy with all seven cases offered', c.id === 'tlh' && c.on.length === 7 && c.on[0] && !c.on.slice(1).some(Boolean) && c.tools === 5 && c.steps === 21 && c.model && !c.myo, c);
  await page.click('#caseList .case:nth-child(2)'); c = await look();
  ok('choosing the myomectomy changes the brief, the tray, the list and the uterus', c.id === 'myo' && /myomectomy/i.test(c.title) && c.tools === 7 && c.steps === 9 && !c.model && c.myo && c.flaps && c.saved === 'myo' && /myomectomy/.test(c.brand), c);
  await page.click('#caseList .case:nth-child(1)'); c = await look();
  ok('choosing the hysterectomy again puts everything back', c.id === 'tlh' && c.tools === 5 && c.steps === 21 && c.model && !c.myo && !c.flaps && c.saved === 'tlh', c);
  await page.click('#caseList .case:nth-child(2)');
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const skip = id => ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, id);
  const at = async p => { const q = await ev(p => window.__sim.proj(p), p); await page.mouse.move(box.x + q.x, box.y + q.y, { steps: 3 }); await T(0.9); };
  const atNext = async () => { const n = await ev(() => window.__sim.next()); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); return n; };
  const click = async () => { await page.mouse.down(); await T(0.1); await page.mouse.up(); await T(0.4); };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const M = () => ev(() => { const s = window.__sim, m = s.S.myo, S = s.S; return { step: s.STEPS[S.step].id, held: m.held, fib: m.fib, att: m.att.filter(Boolean).length, ped: m.ped.sealed, untold: m.untold, vaso: m.vaso.map(v => +v.toFixed(2)), cavity: m.cavity, coag: +m.coag.toFixed(1), dropped: m.dropped, bleeders: S.bleeders.map(b => b.label + (b.arterial ? '*' : '')), unsealed: S.stats.unsealedCuts, inj: Object.keys(S.injuries), deep: m.deep.st.length, pend: !!m.deep.pend, firing: s.HANDS.map(h => h.firing), grab: s.HANDS.map(h => !!(h.grab && h.grab.pull)), ev: S.events.map(e => e.text) }; });
  const W = fn => ev(fn); // a world point, as an array
  const sero = (s, w) => ev(([s, w]) => window.__sim.fbSero(s, w, 0, new window.__sim.THREE.Vector3()).toArray(), [s, w]); // a point on the serosa over the fibroid
  // ---- survey: energy does not fire ----
  await at(await W(() => window.__sim.STEPS[0].pt('F', new window.__sim.THREE.Vector3()).toArray()));
  await page.mouse.down(); await T(0.3); let m = await M(); await page.mouse.up(); await T(0.2);
  ok('during the survey a click does not fire the bipolar', !m.firing[1], m.firing);
  // ---- vasopressin before anaesthesia has been told ----
  await skip('vaso'); await inst('R', 'inject'); await atNext(); await hold(2.2); m = await M();
  ok('injecting before telling anaesthesia is allowed, blanches the site, and is recorded', m.vaso[0] === 1 && m.untold && m.ev.some(e => /before anaesthesia/.test(e)), { vaso: m.vaso, untold: m.untold });
  // ---- enucleation ----
  await skip('enuc');
  const apex = () => W(() => { const s = window.__sim, v = s.FB.A.clone().transformDirection(s.UT.M).multiplyScalar(s.FB.R).add(s.S.myo.pos); return v.toArray(); });
  await inst('R', 'grasper'); await at(await apex()); await click(); m = await M();
  ok('an atraumatic grasper does not hold the fibroid', !m.held && !m.grab[1], m.grab); await click();
  await inst('R', 'tenaculum'); await at(await sero(0.2, 0.7)); await click(); m = await M();
  ok('the tenaculum does not lock on the uterine wall', !m.held, m.held);
  await inst('R', 'hook'); await atNext(); await hold(1.0); m = await M();
  ok('without traction no attachment is divided', m.att === 0, m.att);
  await inst('L', 'tenaculum'); await at(await apex()); await click(); m = await M();
  ok('the tenaculum locks on the fibroid and stays locked', m.held === 'L' && m.grab[0], m.held);
  await ev(() => window.__sim.setActive('R')); await T(0.3); await atNext(); await hold(0.8); m = await M();
  ok('with traction the hook divides an attachment', m.att >= 1 && m.held === 'L', m.att);
  await inst('R', 'suction'); await atNext(); await hold(1.0); const a2 = (await M()).att;
  ok('the suction tip divides one bluntly', a2 > m.att, a2);
  // the pedicle, divided without a seal
  await ev(() => { const a = window.__sim.S.myo.att; for (let i = 0; i < 7; i++) a[i] = true; }); await T(2.5);
  await inst('R', 'suction'); let n = await atNext(); await hold(1.0); m = await M();
  ok('the suction tip does not divide the vascular pedicle', n.act === 'seal' && m.fib === 'in', m.fib);
  await inst('R', 'hook'); await atNext(); await hold(1.0); m = await M();
  ok('the pedicle divided without a seal bleeds briskly and frees the fibroid', m.fib === 'free' && m.unsealed === 1 && m.bleeders.includes('feeding vessels*'), { fib: m.fib, bleeders: m.bleeders });
  await page.locator('#view').screenshot({ path: OUT + 'myo-bleed.png' }).catch(() => {});
  await inst('R', 'bipolar'); n = await ev(() => window.__sim.next()); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); await hold(2.0); m = await M();
  ok('bipolar on the bleeding point controls it', n.act === 'bleed' && !m.bleeders.length, m.bleeders);
  // the freed fibroid, let go in the wrong place
  await ev(() => window.__sim.setActive('L')); await T(0.3);
  await page.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.3, { steps: 4 }); await T(1.2); await click(); await T(1.5); m = await M();
  ok('a freed fibroid let go away from the marked spot is recorded', m.fib === 'park' && m.dropped && !m.held, { fib: m.fib, dropped: m.dropped });
  // ---- the bed ----
  await T(1.5); m = await M();
  ok('the bed is inspected next, with two bleeding edges', m.step === 'hemo' && m.bleeders.length === 2, { step: m.step, bleeders: m.bleeders });
  await inst('R', 'hook'); await at(await W(() => { const s = window.__sim; return s.FB.C.clone().addScaledVector(s.FB.A, -(s.FB.Rs - s.FB.WALL) * 0.9).applyMatrix4(s.UT.M).toArray(); })); await hold(1.3); m = await M();
  ok('the hook on the floor of the bed enters the cavity', m.cavity && m.ev.some(e => /cavity entered/.test(e)), m.cavity);
  await ev(() => { window.__sim.S.bleeders.length = 0; }); // done with the edges
  await inst('R', 'bipolar'); await at(await sero(0.3, -0.8)); await hold(7.5); m = await M();
  ok('bipolar held on the wall is counted', m.coag > 6, m.coag);
  // ---- the repair ----
  await skip('deep'); await inst('R', 'needle');
  const aim = (i, sg) => ev(([i, sg]) => { const s = window.__sim; return s.STEPS[s.S.step].aim(i, sg, new s.THREE.Vector3()).toArray(); }, [i, sg]);
  await at(await aim(0, 1)); await click(); m = await M();
  ok('a bite on the far edge first is refused', !m.pend && m.deep === 0, m.pend);
  await at(await aim(2, -1)); await click(); m = await M();
  ok('a first bite at the wrong end is refused', !m.pend && m.deep === 0, m.pend);
  await at(await aim(0, -1)); await click(); m = await M(); const p1 = m.pend;
  await at(await aim(1, 1)); await click(); m = await M();
  ok('a far bite that does not match the near one is refused', p1 && m.pend && m.deep === 0, { p1, deep: m.deep });
  await at(await aim(0, 1)); await click(); m = await M();
  ok('near edge then far edge makes a stitch', m.deep === 1 && !m.pend, m.deep);
  // ---- a structure this operation keeps ----
  await inst('R', 'bipolar'); await at(await W(() => { const s = window.__sim; return s.AN.side.R.cur.tubeCur[14].toArray(); })); await hold(1.6); m = await M();
  ok('energy on a fallopian tube is an injury here', m.inj.includes('tubeR'), m.inj);
  const sc = await ev(() => window.__sim.CASE.score());
  const want = [/injur/, /cavity entered/, /without a seal/, /before anaesthesia/, /Bipolar on the uterine wall/, /let go away/];
  ok('each of these shows in the score', want.every(r => sc.notes.some(t => r.test(t))) && sc.pts < 60, sc);
  // ---- blood in the pelvis at the end ----
  await skip('final'); await ev(() => { const s = window.__sim; s.STEPS[s.S.step].button.fn(); s.S.bleeders.length = 0; s.S.pool = 20; }); await T(0.6);
  let n2 = await ev(() => window.__sim.next()); await inst('R', 'suction'); n2 = await atNext(); await hold(2.5);
  const pool = await ev(() => window.__sim.S.pool);
  ok('a small pool is marked where it can be seen, and the suction clears it', n2.act === 'suction' && n2.vis && pool < 8, { vis: n2.vis, pool: +pool.toFixed(1) });
  // ---- both cases still play to the end, one after the other ----
  const play = id => ev(id => { const s = window.__sim; s.setCase(id); s.startCase(false); let g = 0; while (!s.S.ended && g++ < 60) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } return { id: s.CASE.id, ended: s.S.ended, step: s.S.step, steps: s.STEPS.length, model: s.UT.mesh.visible, myo: s.UT.myo.visible, fib: s.FB.fib.visible, score: s.CASE.score().pts }; }, id);
  let r = await play('tlh'); ok('the hysterectomy runs to its debrief after a myomectomy', r.ended && r.id === 'tlh' && r.step === 20 && !r.myo && !r.fib, r);
  r = await play('myo'); ok('the myomectomy runs to its debrief after a hysterectomy', r.ended && r.id === 'myo' && r.step === 8 && !r.model && r.myo, r);
  await ev(() => window.__sim.render());
}
