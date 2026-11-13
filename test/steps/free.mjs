// Free depth through real mouse events: swing, fulcrum inversion, wheel insertion, contact and give, working only
// in contact, traction, the first-click-takes-the-instruments rule, and the auto-depth setting.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.max(1, Math.ceil(dt / 0.033)));
  await page.click('#btnBegin');
  await ev(() => { window.__simPause = true; });
  const box = await page.locator('#ov').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const st = () => ev(() => { const s = window.__sim, h = s.HAND[s.active], q = s.proj(h.tip.toArray()); return { x: q.x, y: q.y, ins: h.ins, touch: h.touch, press: h.press, ent: h.pick.ent, hit: h.pick.hit, dent: s.DENT.pos.value[s.active === 'L' ? 0 : 1].w, lock: s.INP.lock, noLock: s.INP.noLock, act: s.S.stats.activations, firing: h.firing, grab: h.grab && h.grab.pull ? h.grab.pull.off.length() : -1, auto: s.DEPTH.auto, camIns: s.CAM.userIns }; });
  ok(await ev(() => window.__sim.freeDepth()), 'mouse mode starts in free depth');

  // the first click takes the instruments and must not fire them
  await page.mouse.move(cx, cy); await page.mouse.down(); await T(0.1); await page.mouse.up(); await page.waitForTimeout(400); await T(0.1);
  let a = await st();
  ok(a.act === 0 && !a.firing, 'first click does not fire the instrument (activations ' + a.act + ')');
  ok(a.lock || a.noLock, 'cursor locked, or fallback to travel over the picture (lock=' + a.lock + ' noLock=' + a.noLock + ')');
  await ev(() => { if (!window.__sim.INP.lock) window.__sim.INP.noLock = true; });

  // swing: the tip follows the mouse on screen
  a = await st(); await page.mouse.move(cx + 90, cy, { steps: 6 }); await T(0.4); let b = await st();
  ok(b.x - a.x > 35 && b.x - a.x < 125 && Math.abs(b.y - a.y) < 30, 'mouse right 90 px swings the tip right (less along the shaft, which is the wheel\'s job) ' + (b.x - a.x).toFixed(0) + ' px');
  ok(Math.abs(b.ins - a.ins) < 0.01, 'swinging does not change insertion');
  a = b; await page.mouse.move(cx + 90, cy - 70, { steps: 6 }); await T(0.4); b = await st();
  ok(a.y - b.y > 40 && a.y - b.y < 100, 'mouse up 70 px moves the tip up ' + (a.y - b.y).toFixed(0) + ' px');
  // fulcrum effect
  await ev(() => document.getElementById('btnFulcrum').click()); await page.mouse.move(cx + 90, cy - 70); a = await st();
  await page.mouse.move(cx + 30, cy - 70, { steps: 6 }); await T(0.4); b = await st();
  ok(b.x - a.x > 35, 'fulcrum effect on: mouse left 60 px moves the tip right ' + (b.x - a.x).toFixed(0) + ' px');
  await ev(() => document.getElementById('btnFulcrum').click()); await page.mouse.move(cx, cy);

  // wheel: forward pushes in, back pulls out; reversible
  a = await st(); await page.mouse.wheel(0, -100); await T(0.2); b = await st();
  ok(b.ins > a.ins + 0.2, 'wheel forward advances the instrument ' + (b.ins - a.ins).toFixed(2) + ' cm');
  await page.mouse.wheel(0, 100); await T(0.2); let c = await st();
  ok(c.ins < b.ins - 0.2, 'wheel back withdraws it');
  await ev(() => document.getElementById('btnFlip').click()); await page.mouse.move(cx, cy); await page.mouse.wheel(0, -100); await T(0.2); let d = await st();
  ok(d.ins < c.ins - 0.2, 'reverse wheel swaps the direction');
  await ev(() => document.getElementById('btnFlip').click()); await page.mouse.move(cx, cy);
  a = await st(); await page.mouse.wheel(0, -4); await T(0.2); b = await st();
  ok(b.ins - a.ins > 0.02 && b.ins - a.ins < 0.15, 'a slow wheel turn is a fine step (' + (b.ins - a.ins).toFixed(3) + ' cm)');

  // short of the tissue the instrument does nothing
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 100); } await T(0.3); a = await st();
  ok(!a.touch && !a.hit, 'tip in space touches nothing');
  await page.mouse.down(); await T(0.6); await page.mouse.up(); await T(0.1);
  const non = await ev(() => window.__sim.S.stats.nonTarget);
  ok(non === 0, 'energy fired in space marks no tissue');

  // advance to contact: tissue gives a little, then stops the instrument
  let n = 0; while (n++ < 80 && !(await st()).touch) { await page.mouse.wheel(0, -100); await T(0.1); }
  a = await st();
  ok(a.touch && a.hit && !!a.ent, 'advancing reaches contact with ' + a.ent + ' after ' + n + ' wheel steps');
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -100); await T(0.1); }
  b = await st();
  ok(b.press > 0.3 && b.press <= 0.71, 'pressing dents the tissue ' + b.press.toFixed(2) + ' cm and is stopped there');
  ok(b.dent > 0.3, 'the dent is drawn (' + b.dent.toFixed(2) + ' cm)');
  await T(1.6); const toast = await page.locator('#toast').textContent();
  ok(/pressing/i.test(toast), 'a warning appears while pressing: "' + toast + '"');
  n = 0; while (n++ < 12 && (await st()).touch) { await page.mouse.wheel(0, 100); await T(0.1); }
  ok(n <= 9, 'backing out frees the tip within ' + n + ' wheel steps');

  // traction: grasp the round ligament with the left hand and pull
  const tr = await ev(() => {
    const s = window.__sim, T3 = s.THREE; s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); s.setPoseGoal(s.STEPS[s.S.step].rec); for (let i = 0; i < 50; i++) s.tick(0.033); s.setActive('L'); const h = s.HAND.L, p = new T3.Vector3().fromArray(s.next().p);
    const d = p.clone().sub(h.port), L = d.length(); h.dir.copy(d.normalize()); h.ins = L - 1.5;
    for (let i = 0; i < 10; i++) s.tick(0.033);
    let n = 0; while (n++ < 200 && !h.touch) { h.cmd.dz += 0.1; s.tick(0.033); }
    return { touch: h.touch, ent: h.pick.ent, inst: h.inst };
  });
  ok(tr.touch && tr.ent === 'round' && tr.inst === 'grasper', 'left grasper reaches the round ligament (' + tr.ent + ')');
  await page.mouse.move(cx, cy); await page.mouse.down(); await T(0.1); await page.mouse.up(); await T(0.3);
  a = await st(); ok(a.grab >= 0, 'click grasps and holds');
  await page.mouse.move(cx - 40, cy - 40, { steps: 5 }); await T(0.5); b = await st();
  ok(b.grab > 0.2, 'moving the mouse puts the tissue on traction (' + b.grab.toFixed(2) + ' cm)');
  await page.mouse.move(cx - 300, cy - 260, { steps: 10 }); await T(0.6); b = await st();
  ok(b.grab <= 1.61, 'traction stops at the tissue\'s stretch (' + b.grab.toFixed(2) + ' cm)');
  await ev(() => window.__sim.setActive('R')); await T(0.3);
  const held = await ev(() => { const h = window.__sim.HAND.L; return h.grab && h.grab.pull ? h.grab.pull.off.length() : -1; });
  ok(held > 1.2, 'the left hand keeps its traction when the right hand takes over (' + held.toFixed(2) + ' cm)');

  // auto depth: the earlier behaviour
  await ev(() => document.getElementById('btnAuto').click()); await T(0.2); await page.waitForTimeout(200); await page.mouse.move(cx + 20, cy + 20); await page.mouse.move(cx + 60, cy + 40, { steps: 4 }); await T(1.2); a = await st();
  ok(a.auto && Math.hypot(a.x - (cx + 60 - box.x), a.y - (cy + 40 - box.y)) < 40, 'auto depth: the tip goes to the tissue under the pointer');
  await page.mouse.wheel(0, -200); await T(0.2); b = await st();
  ok(b.camIns > a.camIns, 'auto depth: the wheel moves the scope');
  await ev(() => document.getElementById('btnAuto').click()); await page.mouse.move(cx, cy); await T(0.2);
  a = await st(); await page.keyboard.down('='); await T(0.5); await page.keyboard.up('='); b = await st();
  ok(b.camIns > a.camIns, 'the + key advances the scope');
  ok(!(await st()).auto, 'auto depth off again');
  // complications still work when the tip has to be brought to the tissue
  const go = p => ev(p => { const s = window.__sim, T3 = s.THREE, h = s.HAND[s.active], P = new T3.Vector3().fromArray(p), d = P.clone().sub(h.port), L = d.length(); h.dir.copy(d.normalize()); h.ins = L - 1.5; for (let i = 0; i < 10; i++) s.tick(0.033); let n = 0; while (n++ < 220 && !h.touch && h.ins < L - 0.03) { h.cmd.dz += 0.1; s.tick(0.033); } return { touch: h.touch, ent: h.pick.ent }; }, p);
  await ev(() => { const s = window.__sim; s.setActive('L'); }); await page.mouse.down(); await T(0.1); await page.mouse.up(); await T(0.3); // let go of the ligament
  await ev(() => { const s = window.__sim; s.setActive('R'); }); await T(0.2);
  let r = await go((await ev(() => window.__sim.next())).p);
  ok(r.touch && r.ent === 'round', 'right bipolar reaches the round ligament');
  await ev(() => window.__sim.cutAction()); await T(0.4);
  ok(await ev(() => window.__sim.S.bleeders.length) === 1, 'cutting it unsealed makes it bleed');
  r = await go((await ev(() => window.__sim.next())).p);
  await page.mouse.down(); await T(1.8); await page.mouse.up(); await T(0.2);
  ok(await ev(() => window.__sim.S.bleeders.length) === 0, 'bipolar held on the bleeding point controls it');
  const bl = await ev(() => { // a point on the bladder that the right port can reach directly
    const s = window.__sim, T3 = s.THREE, R = new T3.Raycaster(), h = s.HAND.R;
    for (let dz = 2.4; dz >= -1; dz -= 0.4) for (const dx of [0, 0.8, -0.8, 1.6, -1.6]) { const P = new T3.Vector3(s.BL.c.x + dx, s.BL.c.y + 1.2, s.BL.c.z + dz), d = P.clone().sub(h.port).normalize(); R.set(h.port, d); const f = R.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object))[0]; if (f && f.object.userData.ent === 'bladder') return f.point.toArray(); }
    return null;
  });
  ok(!!bl, 'found a directly reachable point on the bladder');
  if (bl) {
    await ev(() => window.__sim.setInst('R', 'hook')); await T(1.0); r = await go(bl);
    ok(r.touch && r.ent === 'bladder', 'hook brought into contact with the bladder');
    await page.mouse.down(); await T(1.2); await page.mouse.up(); await T(0.2);
    ok(await ev(() => !!window.__sim.S.injuries.bladder), 'energy on the bladder in contact is recorded as an injury');
  }
  console.log(fails ? fails + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
}
