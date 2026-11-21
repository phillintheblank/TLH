// The total hysterectomy as it is now done: a side at a time (mesosalpinx, utero-ovarian ligament, the incision carried
// forward to the round ligament, posterior leaf, anterior leaf and its half of the fold, bladder, uterine vessels,
// cardinal ligament), the advanced bipolar for all of it and the hook only for the colpotomy, the tube left hanging
// behind the uterus, the ovary lifting off the sidewall at the ureter survey, and a bladder that is taken down by
// holding an instrument at its edge. Real mouse input, auto depth.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  await page.click('#caseList .case:nth-child(1)');
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const next = () => ev(() => window.__sim.next());
  const to = async n => { await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); };
  const waitNext = async () => { let n = await next(), g = 0; while (!n && g++ < 30) { await T(0.1); n = await next(); } return n; }; // a sweep in progress shows no mark
  const atNext = async () => { const n = await waitNext(); await to(n); return n; };
  const quick = async () => { const n = await waitNext(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 2 }); await T(0.2); return n; }; // arrive, without dwelling
  const bite = async () => { await page.mouse.down(); await ev(() => { for (let i = 0; i < 7; i++) window.__sim.tick(0.033); }); await page.mouse.up(); await T(0.25); }; // one bite's worth of holding, and no more
  const away = async () => { await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.12, { steps: 3 }); await T(0.4); };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const pose = async () => { await ev(() => { const s = window.__sim, r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }); await T(1.6); };
  const restart = async id => { await away(); await ev(id => { const s = window.__sim; s.startCase(false); let g = 0; while (id && s.STEPS[s.S.step].id !== id && g++ < 30) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } }, id); await pose(); };
  const sealCut = async () => { // seal where the prompt says until the tone completes, then fire the blade there
    let n = await atNext(); await page.mouse.down(); for (let i = 0; i < 40; i++) { await T(0.2); const m = await next(); if (!m || m.act !== 'seal' || m.label !== n.label) break; } await page.mouse.up(); await T(0.2);
    n = await next(); if (n && n.act === 'cut') { await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(0.6); }
  };
  const M = () => ev(() => {
    const s = window.__sim, S = s.S, R = S.side.R, L = S.side.L, st = s.STEPS[S.step], V = new s.THREE.Vector3(); s.render();
    const seen = k => { let n = 0; for (let i = 0; i < 24; i++) { const a = s.URETER[k].arr, p = a[Math.round((0.12 + 0.5 * i / 23) * (a.length - 1))]; if (s.visibleAt(p, 0.5)) n++; } return n; }; // how much of the ureter's sidewall course the scope sees
    const nx = s.next();
    return { step: st.id, tool: st.tool, ids: s.STEPS.map(x => x.id).join(), lift: [+R.ovLift.toFixed(2), +L.ovLift.toFixed(2)], ovX: +s.AN.side.R.ovary.position.x.toFixed(2), seenR: seen('R'), id: [S.ureterID.R, S.ureterID.L],
      bites: S.mesoBite.R, tube: [20, 32].map(i => V.copy(s.AN.side.R.cur.tubeCur[i]).applyMatrix4(s.UT.Minv).toArray().map(x => +x.toFixed(2))), tubeOn: !R.isth.cut && s.AN.side.R.t.tube.mesh.visible, uo: R.uo.cut, roof: R.roofGoal, roofCut: R.roofCut, round: R.round.cut, post: R.postGoal, ant: R.antGoal, fold: [R.vufGoal, L.vufGoal], upper: !!R.rel.upper,
      flap: +S.flap.toFixed(2), flapGoal: +S.flapGoal.toFixed(3), cnt: st.cnt, sweep: !!(s.HAND.R.sweep || s.HAND.L.sweep), ua: R.ua.cut, card: R.card.cut, colp: S.colp.filter(c => c >= 1).length,
      acts: S.stats.activations, nonTarget: +S.stats.nonTarget.toFixed(2), blunt: +S.stats.blunt.toFixed(1), unsealed: S.stats.unsealedCuts, xm: S.stats.expoMiss, inj: Object.keys(S.injuries), bleeders: S.bleeders.length, toast: document.getElementById('toast').textContent, act: nx && nx.act, label: nx && nx.label, chips: [...document.querySelectorAll('#stepChips .chip')].map(e => e.textContent).join(' | ') };
  });
  // ---- the order ----
  let m = await M();
  ok('after the survey each side is done in turn, tube first and vessels last, before the other side is started', m.ids === 'survey,mesoR,uoR,roundR,postR,antR,bladR,uaR,cardR,mesoL,uoL,roundL,postL,antL,bladL,uaL,cardL,colp,deliver,cuff,final', m.ids);
  // ---- the survey: the ovary lifts off the sidewall ----
  await away(); await T(1); m = await M(); const rest = m;
  let n = await atNext(); await T(0.3); m = await M();
  ok('an instrument at the right sidewall lifts the right ovary toward the uterus, and only that one', /right ureter/.test(n.label) && m.lift[0] > 0.6 && m.lift[1] === 0 && m.ovX < rest.ovX - 0.7, { lift: m.lift, ovaryX: [rest.ovX, m.ovX] });
  ok('with the ovary lifted more of the ureter\'s course on the sidewall is in view', m.seenR > rest.seenR, { before: rest.seenR, lifted: m.seenR });
  await T(1.2); m = await M();
  ok('held there a moment, the ureter is identified without a pinch or a click', m.id[0] && !m.id[1] && m.acts === 0, m.id);
  await away(); await T(1.6); m = await M();
  ok('when the instrument leaves, the ovary settles back on the sidewall', m.lift[0] < 0.05 && Math.abs(m.ovX - rest.ovX) < 0.1, { lift: m.lift, ovaryX: m.ovX });
  n = await atNext(); await T(1.6); m = await M();
  ok('the left side the same, and the first operative step is the right mesosalpinx, with the bipolar', m.id[1] && m.step === 'mesoR' && m.tool === 'bipolar', { step: m.step, tool: m.tool });
  // ---- the tube ----
  await pose(); await inst('R', 'bipolar'); const t0 = (await M()).tube;
  await sealCut(); await sealCut(); await T(1.8); m = await M();
  ok('two bites free the tube from its mesosalpinx: it stays on the cornu and falls back behind the uterus', m.bites === 2 && m.tubeOn && m.tube[0][2] > 0.9 && m.tube[1][2] > 0.9 && m.tube[1][0] < t0[1][0] - 1.5 && m.tube[1][0] < 2.4 && m.step === 'uoR' && m.unsealed === 0, { bites: m.bites, before: t0, after: m.tube, step: m.step });
  // ---- the utero-ovarian ligament, then forward to the round ligament ----
  await pose(); await sealCut(); await T(0.6); m = await M();
  ok('the utero-ovarian ligament is next; the top of the broad ligament is not yet open', m.uo && m.step === 'roundR' && m.roof === 0 && !m.roofCut, { uo: m.uo, step: m.step });
  await pose(); m = await M();
  ok('the round ligament step starts by carrying the incision forward from that pedicle', m.act === 'trace' && /Carry the incision forward/.test(m.label), { act: m.act, label: m.label });
  await inst('R', 'hook'); await atNext(); await hold(0.6); m = await M();
  ok('the hook does not do it: this work is the bipolar\'s', m.roof === 0 && m.step === 'roundR' && /Advanced bipolar/.test(m.chips), { roof: m.roof, chips: m.chips });
  await inst('R', 'bipolar'); await atNext(); await bite(); m = await M(); const half = m.roof;
  await atNext(); await bite(); m = await M();
  ok('two bites of peritoneum with the bipolar bring the incision to the round ligament, which is then sealed', half === 0.5 && m.roof === 1 && m.act === 'seal' && !m.round, { roof: [half, m.roof], act: m.act });
  await sealCut(); await T(0.6); m = await M();
  ok('sealed and cut, the round ligament is divided and the top of the broad ligament is open between the two pedicles', m.round && m.roofCut && m.step === 'postR' && m.tool === 'bipolar' && m.unsealed === 0, { round: m.round, roofCut: m.roofCut, step: m.step });
  // ---- the leaves ----
  await pose();
  let g = 0; for (; g < 10 && (await M()).step === 'postR'; g++) { await atNext(); await bite(); }
  m = await M();
  ok('six bites open the posterior leaf; the uterus is not yet free on that side, the anterior leaf being whole', m.post === 1 && m.step === 'antR' && !m.upper && m.ant === 0 && m.inj.length === 0, { post: m.post, step: m.step, upper: m.upper, bites: g });
  await pose();
  for (let i = 0; i < 6; i++) { await atNext(); await bite(); }
  await T(0.5); m = await M();
  ok('six bites open the anterior leaf, and the upper uterus comes free on that side', m.ant === 1 && m.upper && m.step === 'antR', { ant: m.ant, upper: m.upper, step: m.step });
  ok('the step goes on across the vesicouterine fold', m.act === 'trace' && /across the fold/.test(m.label) && m.fold[0] === 0, { label: m.label, fold: m.fold });
  for (let i = 0; i < 3; i++) { await atNext(); await bite(); }
  await T(0.5); m = await M();
  ok('three more bites cut the right half of the fold to the midline; the left half is left for its own side', m.fold[0] === 1 && m.fold[1] === 0 && m.step === 'bladR' && !m.inj.includes('bladder'), { fold: m.fold, step: m.step });
  // ---- the bladder, on this side ----
  await away(); await pose(); const a0 = m.acts;
  n = await quick(); await page.mouse.down(); await T(0.3); m = await M(); await page.mouse.up(); await T(0.3);
  ok('at the bladder a press of the bipolar gives no energy', m.acts === a0 && /No energy here/.test(m.toast) && m.cnt <= 1, { acts: m.acts - a0, toast: m.toast });
  await restart('bladR'); await ev(() => window.__sim.setPoseGoal({ push: 0.3 })); await T(1.6); await inst('R', 'bipolar'); await atNext(); await T(1.4); m = await M();
  ok('with the cup not pushed up, holding there does nothing but say so, and is not counted against the trainee', m.cnt === 0 && m.flapGoal === 0 && /Set the exposure first/.test(m.toast) && m.xm === 0, { cnt: m.cnt, toast: m.toast, missed: m.xm });
  await restart('bladR'); await inst('R', 'hook'); n = await atNext(); await T(1.6); m = await M(); await away();
  ok('the hook held at the bladder\'s edge does nothing', m.cnt === 0 && m.flapGoal === 0 && n.act === 'hover', { cnt: m.cnt, act: n.act });
  await inst('R', 'bipolar'); await quick(); await T(0.6); m = await M();
  ok('the bipolar held there starts the instrument sweeping by itself, and the bladder begins to come down', m.cnt === 1 && m.sweep && m.flapGoal > 0.15 && m.flapGoal < 0.18 && m.act === null, { cnt: m.cnt, sweep: m.sweep, flapGoal: m.flapGoal });
  await away(); await T(1.3); m = await M();
  ok('the sweep over, the next place along the bladder\'s edge is marked', !m.sweep && m.cnt === 1 && m.act === 'hover' && m.step === 'bladR', { sweep: m.sweep, cnt: m.cnt, act: m.act });
  await inst('R', 'grasper'); await quick(); await T(0.6); m = await M(); await away(); await T(1.3);
  ok('the grasper does the same', m.cnt === 2 && m.sweep && m.flapGoal > 0.32 && m.flapGoal < 0.35, { cnt: m.cnt, sweep: m.sweep, flapGoal: m.flapGoal });
  await inst('R', 'bipolar'); await quick(); await T(2.6); m = await M();
  ok('three holds take the bladder half way down, with no energy used, and the uterine vessels on this side are next', m.step === 'uaR' && Math.abs(m.flap - 0.5) < 0.04 && m.acts === 0 && m.blunt >= 3 && m.inj.length === 0, { step: m.step, flap: m.flap, acts: m.acts, blunt: m.blunt });
  // ---- vessels, then the other side ----
  await pose(); await sealCut(); await T(0.6); await pose(); await sealCut(); await T(0.8); m = await M();
  ok('uterine vessels and cardinal ligament divided, the left side begins with its tube', m.ua && m.card && m.step === 'mesoL' && m.unsealed === 0 && m.bleeders === 0, { ua: m.ua, card: m.card, step: m.step });
  await restart('bladL'); m = await M();
  ok('by the time the left bladder is reached the whole fold is cut and the bladder is half way down', m.fold[0] === 1 && m.fold[1] === 1 && m.flapGoal === 0.5 && m.step === 'bladL', { fold: m.fold, flapGoal: m.flapGoal });
  await inst('R', 'bipolar');
  for (let i = 0; i < 3 && (await M()).step === 'bladL'; i++) { await quick(); await T(1.7); }
  await T(1.5); m = await M();
  ok('three holds on the left bring it clear of the cup', m.step === 'uaL' && m.flap > 0.93, { step: m.step, flap: m.flap });
  // ---- the colpotomy is the hook's ----
  await restart('colp'); m = await M();
  ok('the colpotomy asks for the hook: the one step that does', m.tool === 'hook' && /Monopolar hook/.test(m.chips), { tool: m.tool, chips: m.chips });
  await inst('R', 'bipolar'); await atNext(); await hold(0.7); m = await M(); const bip = m.colp;
  await inst('R', 'hook'); await atNext(); await hold(0.6); m = await M();
  ok('the bipolar does not cut the vagina on the cup; the hook does', bip === 0 && m.colp >= 1, { bipolar: bip, hook: m.colp });
}
