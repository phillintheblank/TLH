// The sacrocolpopexy: its place in the chooser, the pelvis it starts in (as the supracervical hysterectomy leaves it),
// the probe, and each stage's rules and complication paths: the sigmoid, the landmarks, the vessels at the promontory,
// the two dissections, the mesh sutures, tension, the disc, and the peritoneal closure. Real mouse input, auto depth.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  const settle = () => ev(() => { for (let i = 0; i < 20; i++) window.__sim.tick(0.033); });
  const look = () => ev(() => {
    const s = window.__sim, S = s.S, V = new s.THREE.Vector3(); s.render();
    return { id: s.CASE.id, cases: document.querySelectorAll('#caseList .case').length, tools: document.querySelectorAll('#insts .inst').length, steps: s.STEPS.length, specimen: S.specimen, stump: s.LS.stump.visible, uterus: s.UT.g.visible, tube: s.AN.side.R.t.tube.mesh.visible, roundCut: S.side.R.round.cut && S.side.L.round.cut, uaCut: S.side.R.ua.cut && S.side.L.ua.cut, cardCut: S.side.R.card.cut, cardM: s.AN.side.L.st.cardM.mesh.visible, flap: S.flap,
      prom: s.SC.prom.visible, vein: s.SC.fixed[1].visible, mesh: s.SC.arm.mesh.visible, sigX: +s.AN.rectumArr[47].x.toFixed(2), note: document.getElementById('manipNote').textContent, push: document.getElementById('pushNote').textContent, saved: localStorage.getItem('tlh.case.v1') };
  });
  // ---- the chooser, and the pelvis this case starts in ----
  await page.click('#caseList .case:nth-child(6)'); await settle(); let c = await look();
  ok('the sixth of seven cases is the sacrocolpopexy: 11 steps, five instruments', c.cases === 7 && c.id === 'scp' && c.steps === 11 && c.tools === 5 && c.saved === 'scp', { id: c.id, steps: c.steps, tools: c.tools });
  ok('it starts where the supracervical hysterectomy ends: the body of the uterus and tubes out, pedicles divided, the cervix on its cardinal ligaments, the bladder half down', c.specimen === 'out' && c.stump && !c.uterus && !c.tube && c.roundCut && c.uaCut && !c.cardCut && c.cardM && c.flap === 0.5, { specimen: c.specimen, stump: c.stump, cardCut: c.cardCut, flap: c.flap });
  ok('the promontory and its vessels are there, the sigmoid lies over it, and there is no mesh yet', c.prom && c.vein && !c.mesh && c.sigX > -1.5, { sigX: c.sigX, mesh: c.mesh });
  ok('a probe in the vagina takes the manipulator\'s place', c.note === 'Vaginal probe' && /vault/.test(c.push), { note: c.note, push: c.push });
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const at = async p => { const q = await ev(p => window.__sim.proj(p), p); await page.mouse.move(box.x + q.x, box.y + q.y, { steps: 3 }); await T(0.9); return ev(() => window.__sim.PICK.ent); };
  const next = () => ev(() => window.__sim.next());
  const atNext = async () => { const n = await next(); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.9); return n; };
  const click = async () => { await page.mouse.down(); await T(0.1); await page.mouse.up(); await T(0.5); };
  const hold = async s => { await page.mouse.down(); await T(s); await page.mouse.up(); await T(0.3); };
  const inst = async (k, t) => { await ev(([k, t]) => { window.__sim.setActive(k); window.__sim.setInst(k, t); }, [k, t]); await T(1.0); };
  const btn = async id => { await ev(() => window.__sim.render()); await page.click(id); await T(0.4); };
  const pose = async p => { await ev(p => window.__sim.setPoseGoal(p), p); await T(1.6); };
  const restart = async (to, noPose) => { await ev(([to, noPose]) => { const s = window.__sim; s.startCase(false); let g = 0; while (to && s.STEPS[s.S.step].id !== to && g++ < 30) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } const r = s.STEPS[s.S.step].rec; if (r && !noPose) s.setPoseGoal(r); }, [to, noPose]); await T(1.8); };
  const P = (fn, ...a) => ev(([fn, a]) => window.__sim[fn](...a, new window.__sim.THREE.Vector3()).toArray(), [fn, a]); // a point from one of the case's own surface functions
  const M = () => ev(() => {
    const s = window.__sim, S = s.S, m = S.scp; s.render();
    return { step: s.STEPS[S.step].id, sig: m.sig, sigX: +s.AN.rectumArr[47].x.toFixed(2), rectY: +s.AN.rectumArr[6].y.toFixed(2), seen: Object.keys(m.seen).filter(k => m.seen[k]).join(''), cut: +m.cut.toFixed(2), cutGoal: m.cutGoal, clear: m.clear, rib: s.SC.rib.mesh.visible, lig: s.SC.lig.mesh.visible, rv: m.rv, rvs: s.SC.rvs.mesh.visible, flap: +S.flap.toFixed(2),
      leafP: s.SC.leafP.mesh.visible, leafA: s.SC.leafA.mesh.visible, arm: s.SC.arm.mesh.visible, fix: m.fix.map(f => f.leaf + f.i).join(','), sac: m.sac.length, tension: m.tension, per: m.per, shut: +m.shut.toFixed(2), msv: m.msv, manipOut: S.manipOut, vgPush: +s.VG.pose.push.toFixed(2), vgPitch: +s.VG.pose.pitch.toFixed(2),
      bleeders: S.bleeders.map(b => b.label), inj: Object.keys(S.injuries), ebl: +S.ebl.toFixed(1), acts: S.stats.activations, xm: S.stats.expoMiss, blunt: +S.stats.blunt.toFixed(1), tech: S.events.filter(e => e.type === 'tech').map(e => e.text), toast: document.getElementById('toast').textContent, threads: s.CASE.sutures().st.length,
      lowP: S.lowP, b2: !document.getElementById('stepBtn2').hidden, ended: S.ended, prompt: (s.next() || {}).label };
  });
  // ---- the probe ----
  await pose({ yaw: 0, pitch: 0.8, push: 1 }); let m = await M();
  ok('the probe moves the vault although the uterus is out', m.vgPush > 0.9 && m.vgPitch > 0.7 && !m.manipOut, { push: m.vgPush, pitch: m.vgPitch });
  // ---- the sigmoid ----
  await restart('sig'); await inst('R', 'grasper');
  let n = await atNext(); await click(); m = await M();
  ok('grasping the bowel wall moves nothing and is warned against', m.sig === 0 && /Do not grasp the bowel wall/.test(m.toast), { toast: m.toast });
  await ev(() => { const h = window.__sim.HAND.R; if (h.grab) window.__sim.releaseGrab(h); });
  await inst('R', 'suction'); const x0 = m.sigX;
  for (let i = 0; i < 3; i++) { await atNext(); await hold(0.8); }
  await T(1.5); m = await M();
  ok('three pushes with the blunt suction tip sweep the sigmoid to the patient\'s left, off the promontory', m.sig === 1 && m.sigX < x0 - 4 && m.step === 'look' && m.blunt > 1.5 && m.inj.length === 0, { from: x0, to: m.sigX, step: m.step });
  // ---- the landmarks ----
  await inst('R', 'bipolar'); n = await atNext(); await page.mouse.down(); await T(0.3); m = await M(); await page.mouse.up(); await T(0.3);
  ok('while the landmarks are being found, a press of the bipolar gives no energy', m.acts === 0 && m.step === 'look', { acts: m.acts });
  const names = [n.label]; // the tip has been beside the first landmark all this while
  for (let i = 0; i < 3; i++) { n = await next(); if (!n || n.act !== 'hover') break; names.push(n.label); await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(2.3); }
  m = await M(); const all = names.join('; ');
  ok('holding a tip beside the promontory, the right ureter and the left common iliac vein marks each', m.seen === 'PUV' && m.step === 'prom' && /promontory/.test(all) && /right ureter/.test(all) && /iliac vein/.test(all), { seen: m.seen, names });
  // ---- the promontory: what must not be touched ----
  await inst('R', 'hook');
  let on = await at(await P('scFloor', -1.4, 11.2, 0.4)); await hold(0.7); m = await M();
  ok('the hook on the left common iliac vein is a major vascular injury', on === 'civ' && m.inj.includes('civ') && m.bleeders.includes('iliac'), { on, inj: m.inj, bleeders: m.bleeders });
  await restart('prom'); await inst('R', 'hook');
  on = await at(await P('scFloor', 0.24, 9, 0.08)); await hold(0.6); m = await M();
  ok('the hook on the middle sacral vessels opens them: presacral bleeding', on === 'msv' && m.msv && m.bleeders.includes('middle sacral vessels') && m.inj.length === 0, { on, msv: m.msv, bleeders: m.bleeders });
  await inst('R', 'bipolar'); await atNext(); await hold(1.7); m = await M();
  ok('bipolar on the bleeding point controls it, and the score remembers', m.bleeders.length === 0 && (await ev(() => window.__sim.CASE.score().notes.join())).includes('Middle sacral vessels opened'), m.bleeders);
  // ---- the promontory: opening it ----
  await restart('prom'); await inst('R', 'hook');
  n = await atNext(); await hold(0.3); m = await M();
  ok('the hook held on the marked line opens the peritoneum over the promontory', m.cutGoal > 0 && m.rib && !m.lig, { cutGoal: m.cutGoal });
  for (let i = 0; i < 3; i++) { await atNext(); await hold(0.3); }
  n = await next(); m = await M();
  ok('the incision made, the fat has still to be cleared off the ligament', m.step === 'prom' && n.act === 'push' && /Clear the fat/.test(n.label) && !m.lig, { cutGoal: m.cutGoal, label: n.label });
  for (let i = 0; i < 2; i++) { await atNext(); await hold(0.6); }
  await T(1.2); m = await M();
  ok('swept clear, the white anterior longitudinal ligament shows and the step is done', m.clear === 1 && m.lig && m.step === 'gutter' && m.inj.length === 0 && !m.msv, { clear: m.clear, step: m.step });
  // ---- down the gutter ----
  await pose({ yaw: 0, pitch: 0.5, push: 0.5 });
  for (let i = 0; i < 7; i++) { n = await atNext(); await hold(0.3); }
  await T(1); m = await M();
  ok('seven strokes carry the incision down the right pararectal gutter to the cul-de-sac, clear of ureter and rectum', m.cutGoal === 1 && m.cut > 0.97 && m.step === 'post' && m.inj.length === 0, { cut: m.cut, step: m.step, inj: m.inj });
  // ---- the rectovaginal space ----
  await pose({ yaw: 0, pitch: 0.17, push: 0 }); n = await atNext(); await hold(0.3); m = await M();
  ok('starting the posterior dissection without the vault pushed up and tipped forward is counted', m.xm === 1, { xm: m.xm });
  await pose({ yaw: 0, pitch: 0.85, push: 1 }); const y0 = m.rectY;
  let g = 0; while (g++ < 12) { n = await next(); if (!n || n.act !== 'push' || (await M()).step !== 'post') break; await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 3 }); await T(0.8); await hold(0.6); }
  await T(1.5); m = await M();
  ok('four sweeps on the vaginal side open the rectovaginal space: the rectum falls back and the vaginal wall is bare', m.rv === 1 && m.rvs && m.rectY < y0 - 0.3 && m.step === 'ant' && !m.inj.includes('rectum'), { rv: m.rv, rectY: [y0, m.rectY], step: m.step });
  // ---- the bladder ----
  await pose({ yaw: 0, pitch: -0.2, push: 1 }); await inst('R', 'bipolar'); const acts0 = (await M()).acts;
  for (let i = 0; i < 3; i++) { n = await atNext(); await T(1.7); }
  await T(1.8); m = await M();
  ok('the bipolar held three times at the bladder\'s edge, with no energy, takes it the rest of the way down the anterior vaginal wall', n.act === 'hover' && m.flap > 0.93 && m.step === 'meshP' && m.acts === acts0 && !m.inj.includes('bladder'), { flap: m.flap, step: m.step, acts: m.acts - acts0 });
  // ---- the posterior leaf ----
  ok('the mesh comes in at this step: its posterior leaf first, the anterior leaf and the arm not yet', m.leafP && !m.arm && !m.leafA, { leafP: m.leafP, arm: m.arm, leafA: m.leafA });
  await pose({ yaw: 0, pitch: 0.85, push: 1 }); await inst('R', 'needle');
  on = await at(await P('scPath', 0.8, 2.6, 0)); await click(); m = await M();
  ok('a bite into the peritoneum beside the mesh fixes nothing', on === 'wall' && m.fix === '' && /Take the mesh in the bite/.test(m.toast), { on, toast: m.toast });
  on = await at(await P('scWall', 0, -0.6, 0.08)); if (on) await click(); m = await M();
  ok('nor does a bite through the mesh away from where the leaf needs holding', on === 'mesh' && m.fix === '' && /Spread the sutures/.test(m.toast), { on, toast: m.toast });
  for (const i of [18, 20, 16, 22, 24]) { on = await at(await ev(i => window.__sim.AN.rectumArr[i].clone().add({ x: 0, y: 1.3, z: 0 }).toArray(), i)); if (on === 'rectum') break; }
  if (on) await click(); m = await M();
  ok('a bite into the rectum is an injury', on === 'rectum' && m.inj.includes('rectum') && m.fix === '', { on, inj: m.inj });
  for (let i = 0; i < 3; i++) { await atNext(); await click(); }
  m = await M();
  ok('a suture at each far corner and one on the cervix fix the posterior leaf', m.fix === 'P0,P1,P2' && m.step === 'meshA' && m.threads === 3 && m.leafA, { fix: m.fix, step: m.step, threads: m.threads });
  // ---- the anterior leaf ----
  await pose({ yaw: 0, pitch: -0.2, push: 1 });
  on = null; for (const [dy, dz] of [[0.2, 2], [0.1, 2.1], [0.4, 1.7], [0.6, 1.4]]) { on = await at(await ev(([dy, dz]) => { const s = window.__sim; return [s.BL.c.x, s.BL.c.y + s.BL.r.y * dy, s.BL.c.z + dz]; }, [dy, dz])); if (on === 'bladder') break; }
  await click(); m = await M();
  ok('a bite into the bladder is an injury', on === 'bladder' && m.inj.includes('bladder'), { on, inj: m.inj });
  for (let i = 0; i < 3; i++) { await atNext(); await click(); }
  m = await M();
  ok('three sutures fix the anterior leaf, and the arm of the mesh is then laid along the gutter', m.fix.endsWith('A0,A1,A2') && m.step === 'sacral' && m.arm, { fix: m.fix, step: m.step, arm: m.arm });
  // ---- tension, and the promontory sutures ----
  await pose({ yaw: 0, pitch: 0.17, push: 1 });
  n = await atNext(); await click(); m = await M();
  ok('fixing the mesh with the vault pushed hard up puts it under tension, and that is recorded', m.sac === 1 && m.tension > 0.9 && m.tech.some(t => /under tension/.test(t)) && !m.manipOut, { sac: m.sac, tension: m.tension });
  await click(); m = await M();
  ok('a second suture on top of the first is refused', m.sac === 1 && /Too close/.test(m.toast), { sac: m.sac, toast: m.toast });
  on = await at(await P('scPath', 0.22, -0.56, 0.2)); await click(); m = await M();
  ok('a bite at the medial edge of the mesh goes through the middle sacral vessels', on === 'mesh' && m.sac === 2 && m.msv && m.bleeders.includes('middle sacral vessels'), { on, sac: m.sac, msv: m.msv });
  ok('with two sutures in, the probe comes out and the vault stays where the mesh holds it', m.manipOut && m.vgPush > 0.9, { manipOut: m.manipOut, push: m.vgPush });
  const sc = await ev(() => window.__sim.CASE.score());
  ok('tension and the opened vessels both cost points', sc.notes.includes('Mesh fixed under tension') && sc.notes.includes('Middle sacral vessels opened') && sc.pts < 80, sc);
  await restart('sacral'); await inst('R', 'needle');
  on = await at(await P('scPath', 0.07, 0, 0.15)); await click(); m = await M();
  ok('a bite at the top of the promontory is at the disc, and is said to be', on === 'mesh' && m.sac === 1 && m.tech.some(t => /disc/.test(t)) && !m.tech.some(t => /tension|supported/.test(t)), { on, tech: m.tech });
  on = await at(await P('scPath', 0.2, 2.2, 0.1)); await click(); m = await M();
  ok('a bite on the peritoneum beside the mesh does not fix it', m.sac === 1 && /through the mesh/.test(m.toast), { on, sac: m.sac });
  await restart('sacral'); await inst('R', 'needle');
  for (let i = 0; i < 2; i++) { await atNext(); await click(); }
  m = await M();
  ok('two sutures over S1 with the vault at its natural level: no tension, no disc, intact vessels', m.sac === 2 && m.tension > 0.35 && m.tension < 0.8 && m.tech.length === 0 && !m.msv && m.step === 'perit', { sac: m.sac, tension: m.tension, tech: m.tech });
  // ---- the peritoneum ----
  on = await at(await P('scPath', 0.62, 0, 0.14)); await click(); m = await M();
  ok('the closure starts at the promontory: a bite half way down is refused', m.per === 0 && /Start the closure/.test(m.toast), { on, per: m.per });
  n = await atNext(); await click(); await T(1); m = await M();
  ok('the first bite closes the peritoneum over the promontory', m.per === 1 && m.shut > 0.2 && m.shut < 0.3 && m.rib, { per: m.per, shut: m.shut });
  for (let i = 0; i < 3; i++) { await atNext(); await click(); await T(0.6); }
  await T(1.5); m = await M();
  ok('four bites close it to the cul-de-sac: the bed and the arm of the mesh are covered', m.per === 4 && m.shut > 0.97 && !m.rib && !m.lig && m.step === 'final' && m.threads === 12, { per: m.per, shut: m.shut, threads: m.threads });
  const hid = await ev(() => { const s = window.__sim, V = new s.THREE.Vector3(), a = s.SC.armA[30]; return +(a.y - s.scFloor(a.x, a.z, 0, V).y).toFixed(2); });
  ok('the arm of the mesh now lies beneath the peritoneum', hid < -0.1, { depthBelow: hid });
  // ---- completion ----
  await btn('#stepBtn1'); m = await M();
  ok('at low pressure the peritoneal edge oozes, and the case cannot be ended yet', m.lowP && m.bleeders.includes('peritoneal edge') && !m.b2, m.bleeders);
  await inst('R', 'bipolar'); await atNext(); await hold(1.7);
  for (let i = 0; i < 2; i++) { n = await atNext(); await T(1.4); }
  m = await M();
  ok('with the ooze stopped and both ureters seen to work, the case can be ended', m.bleeders.length === 0 && m.b2 && m.inj.length === 0, { b2: m.b2, prompt: m.prompt, inj: m.inj });
  await btn('#stepBtn2'); await T(0.5);
  const d = await ev(() => ({ ended: window.__sim.S.ended, text: document.getElementById('debrief').textContent, score: window.__sim.CASE.score() }));
  ok('the debrief reports the mesh: its tension, its sutures and its cover', d.ended && /Mesh tensionWithout tension/.test(d.text) && /3 \/ 3 \/ 2/.test(d.text) && /Peritoneum closed over the meshYes/.test(d.text) && /Sacral bites at the disc0/.test(d.text) && d.score.pts === 100, d.score);
  // ---- leaving the case ----
  await ev(() => window.__sim.setCase('tlh')); await settle(); c = await look();
  ok('going back to the total hysterectomy takes the promontory, the mesh and the probe away and puts the sigmoid back', c.id === 'tlh' && !c.prom && !c.vein && !c.mesh && c.uterus && c.tube && c.sigX < -5 && c.note === 'Uterine manipulator', { prom: c.prom, sigX: c.sigX, note: c.note });
}
