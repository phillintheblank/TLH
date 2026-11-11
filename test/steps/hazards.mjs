// Exercise the complication paths with real mouse input.
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  await page.click('#btnBegin');
  await page.evaluate(() => { window.__simPause = true; });
  const box = await page.locator('#ov').boundingBox();
  const ev = (fn, a) => page.evaluate(fn, a);
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const skip = id => ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, id);
  const pose = async () => { await ev(() => { const s = window.__sim, r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }); await T(1.6); };
  const st = () => ev(() => { const s = window.__sim.S; return { step: window.__sim.STEPS[s.step].id, bleeders: s.bleeders.length, ebl: +s.ebl.toFixed(1), pool: +s.pool.toFixed(1), inj: Object.keys(s.injuries), pulls: s.pulls.map(p => p.curve + ':' + p.off.length().toFixed(2)), ev: s.events.map(e => e.type + ': ' + e.text), pick: window.__sim.PICK.ent, active: window.__sim.active, unsealed: s.stats.unsealedCuts, near: s.stats.nearMiss }; });
  const mv = async (x, y) => { await page.mouse.move(box.x + x, box.y + y, { steps: 3 }); await T(0.5); };
  const shot = async name => { await ev(() => window.__sim.render()); await page.waitForTimeout(250); await page.locator('#view').screenshot({ path: OUT + name + '.png' }); };
  // A: grasper traction on the right tube with the left hand
  await skip('roundR'); await pose();
  await page.keyboard.press('x'); await T(0.2);
  let p = await ev(() => { const s = window.__sim, a = s.AN.side.R.cur.tubeCur; return s.proj(a[16].toArray()); });
  await mv(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await T(0.3);
  await mv(p.x + 10, p.y - 90); await T(0.6);
  console.log('A grasp:', JSON.stringify(await st()));
  await shot('h-grasp');
  await page.keyboard.press('x'); await T(0.2);
  // B: cut the round ligament without sealing -> bleeding, then control it
  let n = await ev(() => window.__sim.next());
  await mv(n.x, n.y); await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(2.5);
  console.log('B after unsealed cut:', JSON.stringify(await st()));
  await mv(box.width / 2, box.height * 0.8); await T(1.0); await shot('h-bleed');
  n = await ev(() => window.__sim.next()); console.log('  next=', JSON.stringify(n));
  await mv(n.x, n.y); await page.mouse.down(); await T(1.8); await page.mouse.up(); await T(0.5);
  console.log('B after control:', JSON.stringify(await st()));
  // C: hook on the bladder
  await ev(() => window.__sim.setInst('R', 'hook')); await T(1);
  p = await ev(() => { const s = window.__sim; return s.proj([s.BL.c.x, s.BL.c.y + 1.5, s.BL.c.z + 0.6]); });
  await mv(p.x, p.y); console.log('C pick over bladder:', (await st()).pick);
  await page.mouse.down(); await T(0.8); await page.mouse.up(); await T(0.3);
  console.log('C after hook on bladder:', JSON.stringify((await st()).inj));
  // D: bipolar on the ureter
  await ev(() => window.__sim.setInst('R', 'bipolar')); await T(1);
  await ev(() => window.__sim.setPoseGoal({ yaw: 0, pitch: 0.6, push: 0.3 })); await T(1.6);
  p = await ev(() => { const s = window.__sim; return s.proj(s.URETER.L.arr[18].toArray()); });
  await mv(p.x, p.y); console.log('D pick over ureter:', (await st()).pick);
  await page.mouse.down(); await T(1.0); await page.mouse.up(); await T(0.3);
  const f = await st(); console.log('D injuries:', JSON.stringify(f.inj), 'events:', JSON.stringify(f.ev, null, 1));
  await shot('h-end');
}
