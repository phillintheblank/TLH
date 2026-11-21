// The complication paths of the hysterectomy, in its present order, with real mouse input: traction on the tube,
// a pedicle cut before it is sealed and the bleeding controlled, the hook on the bladder, the bipolar on a ureter.
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await page.click('#btnBegin'); await ev(() => { window.__sim.DEPTH.auto = true; window.__simPause = true; }); // these scripts point at the screen: auto depth
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const skip = id => ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, id);
  const pose = async () => { await ev(() => { const s = window.__sim, r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }); await T(1.6); };
  const st = () => ev(() => { const s = window.__sim.S; return { step: window.__sim.STEPS[s.step].id, bleeders: s.bleeders.length, ebl: +s.ebl.toFixed(1), inj: Object.keys(s.injuries), pulls: s.pulls.map(p => p.curve + ':' + p.off.length().toFixed(2)), ev: s.events.map(e => e.type + ': ' + e.text), pick: window.__sim.PICK.ent, unsealed: s.stats.unsealedCuts, round: s.side.R.round.cut }; });
  const mv = async (x, y) => { await page.mouse.move(box.x + x, box.y + y, { steps: 3 }); await T(0.5); };
  const shot = async name => { await ev(() => window.__sim.render()); await page.waitForTimeout(250); await page.locator('#view').screenshot({ path: OUT + name + '.png' }); };
  // A: grasper traction on the right tube with the left hand, at the first operative step
  await skip('mesoR'); await pose();
  await page.keyboard.press('x'); await T(0.2);
  let p = await ev(() => { const s = window.__sim, a = s.AN.side.R.cur.tubeCur; return s.proj(a[16].toArray()); });
  await mv(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await T(0.3);
  await mv(p.x + 10, p.y - 90); await T(0.6);
  let s = await st();
  ok('the grasper takes the tube and lifts it; nothing is injured by that', s.pulls.length === 1 && /^tube:/.test(s.pulls[0]) && +s.pulls[0].split(':')[1] > 0.5 && s.inj.length === 0 && s.bleeders === 0, { pulls: s.pulls });
  await shot('h-grasp');
  await page.mouse.down(); await page.mouse.up(); await T(0.4); await page.keyboard.press('x'); await T(0.2);
  // B: the round ligament cut without sealing bleeds, and the bleeding is controlled with the bipolar
  await skip('roundR'); await ev(() => { window.__sim.S.side.R.roofGoal = 1; }); await pose();
  let n = await ev(() => window.__sim.next());
  await mv(n.x, n.y); await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(2.5);
  s = await st(); const ebl0 = s.ebl;
  ok('the round ligament cut before it is sealed bleeds, and the step does not move on', s.round && s.bleeders >= 1 && s.unsealed === 1 && s.step === 'roundR', { round: s.round, bleeders: s.bleeders, unsealed: s.unsealed, step: s.step });
  await mv(box.width / 2, box.height * 0.8); await T(1.0); await shot('h-bleed');
  n = await ev(() => window.__sim.next());
  ok('the prompt goes to the bleeding point', n && n.act === 'bleed', n && { act: n.act, label: n.label });
  await mv(n.x, n.y); await page.mouse.down(); await T(1.8); await page.mouse.up(); await T(0.5);
  s = await st();
  ok('held on it, the bipolar stops the bleeding and the case goes on to the posterior leaf', s.bleeders === 0 && s.step === 'postR' && s.ebl > ebl0, { bleeders: s.bleeders, step: s.step, ebl: [ebl0, s.ebl] });
  // C: the hook on the bladder
  await ev(() => window.__sim.setInst('R', 'hook')); await T(1);
  p = await ev(() => { const s = window.__sim; return s.proj([s.BL.c.x, s.BL.c.y + 1.5, s.BL.c.z + 0.6]); });
  await mv(p.x, p.y); const pickB = (await st()).pick;
  await page.mouse.down(); await T(0.8); await page.mouse.up(); await T(0.3);
  s = await st();
  ok('the hook activated on the bladder injures it', pickB === 'bladder' && s.inj.includes('bladder'), { pick: pickB, inj: s.inj });
  // D: the bipolar on the ureter
  await ev(() => window.__sim.setInst('R', 'bipolar')); await T(1);
  await ev(() => window.__sim.setPoseGoal({ yaw: 0, pitch: 0.6, push: 0.3 })); await T(1.6);
  p = await ev(([w, h]) => { const s = window.__sim, a = s.URETER.L.arr, v = []; for (let i = 6; i < a.length - 6; i++) { const q = s.proj(a[i].toArray()); if (s.visibleAt(a[i], 0.5) && q.x > 40 && q.x < w - 40 && q.y > 40 && q.y < h - 40) v.push(q); } return v[v.length >> 1]; }, [box.width, box.height]); // a stretch of the ureter the scope sees
  await mv(p.x, p.y); const pickU = (await st()).pick;
  await page.mouse.down(); await T(1.0); await page.mouse.up(); await T(0.3);
  s = await st();
  ok('the bipolar activated on the ureter injures it, and both injuries are in the record', /ureter/.test(pickU) && s.inj.some(x => /ureter/.test(x)) && s.ev.filter(e => /^injury/.test(e)).length >= 2, { pick: pickU, inj: s.inj, events: s.ev.length });
  await shot('h-end');
}
