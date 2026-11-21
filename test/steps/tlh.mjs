// The total hysterectomy as it is now done: a side at a time (mesosalpinx, utero-ovarian ligament, the incision carried
// forward to the round ligament, posterior leaf, anterior leaf and its half of the fold, bladder, uterine vessels,
// cardinal ligament), the advanced bipolar for all of it and the hook only for the colpotomy. Peritoneum is sealed and
// then cut with the blade, bite by bite; the uterine vessels take three burns and are cut through the middle one; the
// ovary lifts anteriorly off the sidewall at the ureter survey; the bladder is taken down by holding an instrument at
// its edge and stays one sheet with the leaves beside it; the cuff is closed in two layers, the second in single bites
// through both edges; the needle is held two thirds back from its point; at low pressure the right uterine pedicle
// oozes and the blood collects in the posterior cul-de-sac until it is controlled, to be aspirated from there. Real
// mouse input, auto depth.
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
  const away = async () => { await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.12, { steps: 3 }); await T(0.4); };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const pose = async () => { await ev(() => { const s = window.__sim, r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }); await T(1.6); };
  const restart = async id => { await away(); await ev(id => { const s = window.__sim; s.startCase(false); let g = 0; while (id && s.STEPS[s.S.step].id !== id && g++ < 30) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } }, id); await pose(); };
  const seal = async () => { // hold the energy where the prompt says until the prompt changes
    const n = await atNext(); await page.mouse.down(); for (let i = 0; i < 40; i++) { await T(0.1); const m = await next(); if (!m || m.act !== 'seal' || m.label !== n.label) break; } await page.mouse.up(); await T(0.2); return n;
  };
  const blade = async () => { const n = await atNext(); await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(0.6); return n; }; // fire the blade where the prompt is
  const sealCut = async () => { await seal(); const n = await next(); if (n && n.act === 'cut') await blade(); };
  const click = async () => { const n = await atNext(); await page.mouse.down(); await page.mouse.up(); await T(1.2); return n; };
  const M = () => ev(() => {
    const s = window.__sim, S = s.S, R = S.side.R, L = S.side.L, st = s.STEPS[S.step], V = new s.THREE.Vector3(), W = new s.THREE.Vector3(); s.render();
    const seen = k => { let n = 0; for (let i = 0; i < 40; i++) { const a = s.URETER[k].arr, p = a[Math.round((0.05 + 0.65 * i / 39) * (a.length - 1))]; if (s.visibleAt(p, 0.4)) n++; } return n; }; // how much of the ureter's sidewall course the scope sees, of 40
    const nx = s.next(), lo = s.VUF.lo.pos, join = k => { const a = s.AN.side[k].st.antL.pos, i = k === 'R' ? 36 : 0; return +Math.hypot(a[0] - lo[i], a[1] - lo[i + 1], a[2] - lo[i + 2]).toFixed(3); }; // from the foot of the leaf's cut edge to the corner of the bladder's flap
    const nd = s.HAND.R.sub.needle, grip = nd.needle.getWorldPosition(V).clone(), sw = nd.swage.getWorldPosition(W).clone(), c = S.cuff;
    return { step: st.id, tool: st.tool, ids: s.STEPS.map(x => x.id).join(), lift: [+R.ovLift.toFixed(2), +L.ovLift.toFixed(2)], ov: s.AN.side.R.ovary.position.toArray().map(x => +x.toFixed(2)), seenR: seen('R'), id: [S.ureterID.R, S.ureterID.L],
      bites: S.mesoBite.R, tube: [20, 32].map(i => V.copy(s.AN.side.R.cur.tubeCur[i]).applyMatrix4(s.UT.Minv).toArray().map(x => +x.toFixed(2))), tubeOn: !R.isth.cut && s.AN.side.R.t.tube.mesh.visible, uo: R.uo.cut,
      roof: [R.roofS, R.roofGoal], roofCut: R.roofCut, round: R.round.cut, post: [R.postS, R.postGoal], ant: [R.antS, R.antGoal], fold: [R.vufGoal, L.vufGoal], foldS: R.vufS, upper: !!R.rel.upper,
      flap: +S.flap.toFixed(2), flapGoal: +S.flapGoal.toFixed(3), cnt: st.cnt, sweep: !!(s.HAND.R.sweep || s.HAND.L.sweep), join: [join('R'), join('L')],
      seals: R.ua.seals.map(z => +z.u.toFixed(3)).sort(), ua: R.ua.cut, uc: +(+R.ua.uc).toFixed(3), card: R.card.cut, colp: S.colp.filter(c => c >= 1).length,
      cuff: { layer: c.layer, done: c.done, pending: !!c.pending, through: c.stitches.filter(b => b.layer === 2).every(b => b.da === b.dp), n: [c.stitches.filter(b => b.layer === 1).length, c.stitches.filter(b => b.layer === 2).length], xs: c.stitches.map(b => +b.x.toFixed(2)), pitch: +s.VG.pose.pitch.toFixed(2) },
      needle: { jaw: nd.jaws[0].rotation.x, point: +grip.distanceTo(s.HAND.R.tip).toFixed(2), swage: +grip.distanceTo(sw).toFixed(2) },
      acts: S.stats.activations, blunt: +S.stats.blunt.toFixed(1), unsealed: S.stats.unsealedCuts, xm: S.stats.expoMiss, inj: Object.keys(S.injuries), bleeders: S.bleeders.length, tech: S.events.filter(e => e.type === 'tech').map(e => e.text),
      toast: document.getElementById('toast').textContent, act: nx && nx.act, label: nx && nx.label, chips: [...document.querySelectorAll('#stepChips .chip')].map(e => e.textContent).join(' | ') };
  });
  // ---- the order ----
  let m = await M();
  ok('after the survey each side is done in turn, tube first and vessels last, before the other side is started', m.ids === 'survey,mesoR,uoR,roundR,postR,antR,bladR,uaR,cardR,mesoL,uoL,roundL,postL,antL,bladL,uaL,cardL,colp,deliver,cuff,final', m.ids);
  // ---- the survey: the ovary lifts anteriorly off the sidewall ----
  await away(); await T(1); m = await M(); const rest = m;
  let n = await atNext(); await T(0.3); m = await M();
  ok('an instrument under the right adnexa lifts the right ovary anteriorly, hardly toward the midline, and only that one', /right ureter/.test(n.label) && m.lift[0] > 0.6 && m.lift[1] === 0 && m.ov[1] > rest.ov[1] + 1.4 && Math.abs(m.ov[0] - rest.ov[0]) < 0.4, { lift: m.lift, ovary: [rest.ov, m.ov] });
  ok('lifted, it shows at least twice as much of the ureter\'s course along the sidewall', m.seenR >= 2 * rest.seenR && m.seenR >= 16, { before: rest.seenR, lifted: m.seenR, of: 40 });
  await T(1.2); m = await M();
  ok('held there a moment, the ureter is identified without a pinch or a click', m.id[0] && !m.id[1] && m.acts === 0, m.id);
  await away(); await T(1.6); m = await M();
  ok('when the instrument leaves, the ovary settles back on the sidewall', m.lift[0] < 0.05 && Math.abs(m.ov[1] - rest.ov[1]) < 0.1, { lift: m.lift, ovary: m.ov });
  n = await atNext(); await T(1.6); m = await M();
  ok('the left side the same, and the first operative step is the right mesosalpinx, with the bipolar', m.id[1] && m.step === 'mesoR' && m.tool === 'bipolar', { step: m.step, tool: m.tool });
  // ---- the tube ----
  await pose(); await inst('R', 'bipolar'); const t0 = (await M()).tube;
  await sealCut(); await sealCut(); await T(1.8); m = await M();
  ok('two bites free the tube from its mesosalpinx: it stays on the cornu and falls back behind the uterus', m.bites === 2 && m.tubeOn && m.tube[0][2] > 0.9 && m.tube[1][2] > 0.9 && m.tube[1][0] < t0[1][0] - 1.5 && m.tube[1][0] < 2.4 && m.step === 'uoR' && m.unsealed === 0, { bites: m.bites, before: t0, after: m.tube, step: m.step });
  // ---- the utero-ovarian ligament, then forward to the round ligament ----
  await pose(); await sealCut(); await T(0.6); m = await M();
  ok('the utero-ovarian ligament is next; the top of the broad ligament is not yet open', m.uo && m.step === 'roundR' && m.roof[1] === 0 && !m.roofCut, { uo: m.uo, step: m.step });
  await pose(); m = await M();
  ok('the round ligament step starts by sealing the first bite that carries the incision forward', m.act === 'seal' && /carry the incision forward/.test(m.label), { act: m.act, label: m.label });
  await inst('R', 'hook'); await atNext(); await hold(0.6); m = await M();
  ok('the hook does not do it: this work is the bipolar\'s', m.roof[0] === 0 && m.step === 'roundR' && /Advanced bipolar/.test(m.chips), { roof: m.roof, chips: m.chips });
  await inst('R', 'bipolar'); await atNext(); await hold(1.2); m = await M();
  ok('held on the bite, the bipolar seals it and cuts nothing, however long it is held: the prompt asks for the blade', m.roof[0] === 0.5 && m.roof[1] === 0 && m.act === 'cut' && /Sealed\. Fire the cut blade/.test(m.toast), { sealed: m.roof[0], cut: m.roof[1], act: m.act, toast: m.toast });
  await blade(); m = await M(); const half = m.roof[1];
  await sealCut(); m = await M();
  ok('the blade divides it; a second bite brings the incision to the round ligament, which is then sealed', half === 0.5 && m.roof[1] === 1 && m.act === 'seal' && m.label === 'Seal' && !m.round, { roof: [half, m.roof[1]], act: m.act, label: m.label });
  await sealCut(); await T(0.6); m = await M();
  ok('sealed and cut, the round ligament is divided and the top of the broad ligament is open between the two pedicles', m.round && m.roofCut && m.step === 'postR' && m.tool === 'bipolar' && m.unsealed === 0, { round: m.round, roofCut: m.roofCut, step: m.step });
  // ---- the leaves ----
  await pose();
  let g = 0; for (; g < 10 && (await M()).step === 'postR'; g++) await sealCut();
  m = await M();
  ok('four bites, each sealed and then cut, open the posterior leaf; the uterus is not yet free, the anterior leaf being whole', g === 4 && m.post[1] === 1 && m.step === 'antR' && !m.upper && m.ant[1] === 0 && m.inj.length === 0 && m.bleeders === 0, { bites: g, post: m.post, step: m.step, upper: m.upper });
  await pose();
  for (let i = 0; i < 3; i++) await sealCut();
  await T(0.5); m = await M();
  ok('three bites open the anterior leaf, and the upper uterus comes free on that side', m.ant[1] === 1 && m.upper && m.step === 'antR', { ant: m.ant, upper: m.upper, step: m.step });
  ok('the step goes on across the vesicouterine fold', m.act === 'seal' && /across the fold/.test(m.label) && m.fold[0] === 0, { label: m.label, fold: m.fold });
  await seal(); m = await M(); const fs = m.foldS, fc = m.fold[0];
  await blade(); await sealCut(); await T(0.5); m = await M();
  ok('two more bites, sealed and cut, take the right half of the fold to the midline; the left half is left for its own side', fs === 0.5 && fc === 0 && m.fold[0] === 1 && m.fold[1] === 0 && m.step === 'bladR' && !m.inj.includes('bladder') && m.tech.length === 0, { sealedFirst: [fs, fc], fold: m.fold, step: m.step });
  // ---- the bladder, on this side ----
  await away(); await pose(); const a0 = m.acts;
  n = await quick(); await page.mouse.down(); await T(0.3); m = await M(); await page.mouse.up(); await T(0.3);
  ok('at the bladder a press of the bipolar gives no energy', m.acts === a0 && /No energy here/.test(m.toast) && m.cnt <= 1, { acts: m.acts - a0, toast: m.toast });
  await restart('postR'); await inst('R', 'bipolar'); n = await atNext(); await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(0.6); m = await M();
  ok('the blade on a bite that was not sealed cuts it, and it bleeds: noted as technique, not as an unsealed pedicle', m.post[1] === 0.25 && m.bleeders === 1 && m.tech.length === 1 && /before it was sealed/.test(m.tech[0]) && m.unsealed === 0, { post: m.post, bleeders: m.bleeders, tech: m.tech });
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
  ok('the flap has no side edge: the foot of the right leaf\'s cut edge is the corner of the bladder\'s flap, and has come down with it', m.join[0] < 0.05, { gap: m.join[0] });
  // ---- the uterine vessels: three burns, the third between the first two, cut through the middle ----
  await pose(); m = await M();
  ok('the uterine vessels ask first for a burn against the uterus', m.act === 'seal' && /first burn, against the uterus/.test(m.label), { label: m.label });
  await seal(); m = await M(); const s1 = m.seals, l1 = m.label, t1 = m.toast;
  await seal(); m = await M(); const s2 = m.seals, l2 = m.label;
  ok('then for a second beside it, then a third between the two; no prompt to cut until all three are made', s1.length === 1 && /second burn, beside the first/.test(l1) && /Burn 1 of 3/.test(t1) && s2.length === 2 && /third burn, between the two/.test(l2) && m.act === 'seal', { after1: [s1, l1, t1], after2: [s2, l2] });
  await seal(); m = await M();
  ok('three burns side by side, the middle one last, and the prompt is to cut through the middle burn', m.seals.length === 3 && m.seals.join() === '0.075,0.12,0.165' && m.act === 'cut' && /middle burn/.test(m.label), { seals: m.seals, label: m.label });
  await blade(); await T(0.6); m = await M();
  ok('cut there, the vessels are divided with a seal left on each side: no bleeding, nothing noted', m.ua && m.uc === 0.12 && m.bleeders === 0 && m.tech.length === 0 && m.unsealed === 0 && m.step === 'cardR', { cut: m.ua, at: m.uc, bleeders: m.bleeders, step: m.step });
  await pose(); await sealCut(); await T(0.8); m = await M();
  ok('the cardinal ligament divided, the left side begins with its tube', m.card && m.step === 'mesoL' && m.unsealed === 0 && m.bleeders === 0, { card: m.card, step: m.step });
  await restart('uaR'); await inst('R', 'bipolar'); n = await seal(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 2 }); await T(0.5); await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(0.8); m = await M();
  ok('cut through a single burn, the vessels are divided at the edge of the seal: that is noted, and the pedicle oozes', m.ua && m.seals.length === 1 && m.tech.length === 1 && /edge of the seal/.test(m.tech[0]) && m.bleeders === 1 && m.unsealed === 0, { seals: m.seals, tech: m.tech, bleeders: m.bleeders });
  // ---- the left bladder ----
  await restart('bladL'); m = await M();
  ok('by the time the left bladder is reached the whole fold is cut and the bladder is half way down', m.fold[0] === 1 && m.fold[1] === 1 && m.flapGoal === 0.5 && m.step === 'bladL', { fold: m.fold, flapGoal: m.flapGoal });
  await inst('R', 'bipolar');
  for (let i = 0; i < 3 && (await M()).step === 'bladL'; i++) { await quick(); await T(1.7); }
  await T(1.5); m = await M();
  ok('three holds on the left bring it clear of the cup, still one sheet with the leaf on each side', m.step === 'uaL' && m.flap > 0.93 && m.join[0] < 0.05 && m.join[1] < 0.05, { step: m.step, flap: m.flap, gaps: m.join });
  // ---- the colpotomy is the hook's ----
  await restart('colp'); m = await M();
  ok('the colpotomy asks for the hook: the one step that does', m.tool === 'hook' && /Monopolar hook/.test(m.chips), { tool: m.tool, chips: m.chips });
  await inst('R', 'bipolar'); await atNext(); await hold(0.7); m = await M(); const bip = m.colp;
  await inst('R', 'hook'); await atNext(); await hold(0.6); m = await M();
  ok('the bipolar does not cut the vagina on the cup; the hook does', bip === 0 && m.colp >= 1, { bipolar: bip, hook: m.colp });
  // ---- the cuff, in two layers ----
  await restart('cuff'); await inst('R', 'needle'); m = await M();
  ok('the needle driver is closed on its needle, which it holds two thirds of the way back from the point: the point is the working tip', m.needle.jaw === 0 && Math.abs(m.needle.point - 1.47) < 0.03 && Math.abs(m.needle.swage - 0.85) < 0.03, m.needle); // chords of 120 and 60 degrees of a needle of radius 0.85 cm
  for (let i = 0; i < 10 && (await M()).cuff.layer === 1; i++) await click();
  await T(2.5); m = await M();
  ok('five stitches right to left, each an anterior bite and then a posterior one, close the cuff; that is the first layer only', m.cuff.n[0] === 5 && m.cuff.n[1] === 0 && m.cuff.layer === 2 && !m.cuff.done && m.step === 'cuff' && /Second layer: one bite through both edges/.test(m.label) && /Run the same suture back/.test(m.toast), { stitches: m.cuff.n, label: m.label, toast: m.toast });
  ok('the closed cuff is presented end-on for the second layer', m.cuff.pitch > 0.3, { pitch: m.cuff.pitch });
  const xl = m.cuff.xs[4];
  await click(); m = await M();
  ok('in the second layer one bite is a whole stitch, through both edges: nothing is left waiting for a second bite', m.cuff.n[1] === 1 && !m.cuff.pending && m.cuff.through && /one bite through both edges/.test(m.label), { stitches: m.cuff.n, pending: m.cuff.pending, label: m.label });
  let k2 = 1; for (; k2 < 12 && !(await M()).cuff.done; k2++) await click();
  await T(2.5); m = await M(); const x2 = m.cuff.xs.slice(5), said = await ev(() => window.__sim.S.events.filter(e => e.type === 'info').map(e => e.text).pop());
  ok('four such bites run back left to right, between the stitches of the first layer, finish it', k2 === 4 && m.cuff.done && m.cuff.n[1] === 4 && m.cuff.through && x2[0] > xl && x2[0] < xl + 0.6 && x2.every((x, i) => !i || x > x2[i - 1] + 0.3) && x2[3] > 0.8 && /two layers/.test(said) && m.tech.length === 0 && m.step === 'final', { bites: k2, first: m.cuff.xs.slice(0, 5), second: x2, record: said, step: m.step });
  // ---- low pressure: the right uterine pedicle oozes into the cul-de-sac ----
  const F = () => ev(() => {
    const s = window.__sim, S = s.S, st = s.STEPS[S.step], V = new s.THREE.Vector3(), nx = s.next(); s.render();
    let deep = null; if (s.POOL.visible && s.PF.cols) { const c = s.PF.cols, L = s.POOL.position.y; let d = 0; for (let i = 0; i < c.length; i += 4) if (L - c[i + 2] > d) { d = L - c[i + 2]; deep = [c[i], c[i + 1], +d.toFixed(2)]; } } // where the blood stands deepest: x, z, cm
    return { pool: +S.pool.toFixed(2), shown: s.POOL.visible, deep, bleeders: S.bleeders.map(b => b.label), at: S.bleeders[0] ? s.proj(S.bleeders[0].pt(V).toArray()) : null, ureter: S.bleeders[0] ? +Math.min(...s.URETER.R.arr.map(q => q.distanceTo(S.bleeders[0].pt(V)))).toFixed(2) : null,
      near: S.stats.nearMiss, inj: Object.keys(S.injuries), act: nx && nx.act, label: nx && nx.label, end: !!st.button2.show(), mmHg: S.pressureGoal, toast: document.getElementById('toast').textContent, ok: [S.ureterOK.R, S.ureterOK.L] };
  });
  let f = await F();
  ok('before the pressure is lowered the pelvis is dry', f.pool === 0 && !f.shown && f.bleeders.length === 0 && f.act === 'button', { pool: f.pool, act: f.act });
  await ev(() => { const s = window.__sim; s.STEPS[s.S.step].button.fn(); }); await T(2); f = await F(); const p1 = f.pool;
  ok('at 8 mmHg the right uterine pedicle oozes, about 2 cm from the ureter', f.mmHg === 8 && f.bleeders.join() === 'right uterine pedicle' && /right uterine pedicle is oozing/.test(f.toast) && f.ureter > 1.5 && f.ureter < 2.5, { bleeders: f.bleeders, toast: f.toast, ureter: f.ureter });
  ok('and blood collects in the posterior cul-de-sac, behind the cuff and beside the rectum', f.shown && p1 > 1 && p1 < 2.5 && f.deep && f.deep[1] < -3 && f.deep[1] > -7.5 && Math.abs(f.deep[0]) < 3, { mL: p1, deepestAt: f.deep });
  await T(3); f = await F(); const p2 = f.pool;
  ok('it goes on collecting for as long as the pedicle bleeds; the only prompt is at the bleeding point, and the case cannot be ended', p2 > p1 + 1.5 && f.act === 'bleed' && !f.end, { mL: [p1, p2], act: f.act });
  await inst('R', 'bipolar'); await page.mouse.move(box.x + f.at.x, box.y + f.at.y, { steps: 3 }); await T(0.6); await page.mouse.down(); await T(2.2); f = await F(); const p3 = f.pool; await T(1.5); await page.mouse.up(); await T(1.5); f = await F();
  ok('the bipolar held on the pedicle stops it, without a near miss at the ureter even if the press is held on, and the pool stops growing', f.bleeders.length === 0 && f.near === 0 && f.inj.length === 0 && Math.abs(f.pool - p3) < 0.01 && p3 > p2, { mL: [p3, f.pool], near: f.near });
  ok('the blood in the cul-de-sac is then to be aspirated: the case cannot be ended with it there', f.act === 'suction' && /cul-de-sac/.test(f.label) && !f.end && f.shown, { act: f.act, label: f.label, end: f.end });
  await inst('R', 'suction'); await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.88, { steps: 3 }); await T(0.6); await hold(1.5); f = await F();
  ok('suction away from the blood takes none of it', Math.abs(f.pool - p3) < 0.01, { mL: f.pool });
  await atNext(); await hold(3); f = await F();
  ok('suction in the cul-de-sac clears it, and the ureters are next', f.pool < 1 && f.act === 'hover' && /right ureter/.test(f.label), { mL: f.pool, label: f.label });
  await atNext(); await T(1.8); await atNext(); await T(1.8); f = await F();
  ok('with both ureters confirmed the case can be ended', f.ok[0] && f.ok[1] && f.end && f.act === 'button', { ureters: f.ok, end: f.end });
}
