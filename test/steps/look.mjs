// Screenshots of chosen steps for judging the picture. VIEWS=survey,roundR,...  Q=high|medium|low  TAG=name
// Each view may carry an action after a colon: fire (hold the instrument on its target), seal (seal, no cut),
// done (step forced complete, then look at the result).
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(q => window.__sim.setQuality(q), process.env.Q || 'high');
  await page.click('#btnBegin');
  await ev(() => { window.__simPause = true; window.__sim.S.guided = !!0; });
  if (process.env.GUIDE) await ev(() => { window.__sim.S.guided = true; });
  const box = await page.locator('#ov').boundingBox();
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const skip = id => ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, id);
  const pose = async () => { await ev(() => { const s = window.__sim, r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }); await T(1.6); };
  const want = (process.env.VIEWS || 'survey,roundR,mesoR,vuf,uaR,colp').split(',');
  const tag = process.env.TAG || 'look';
  if (process.env.EVAL) await ev(src => { (0, eval)(src); }, process.env.EVAL);
  let i = 0;
  for (const spec of want) {
    const [id, act] = spec.split(':');
    await ev(() => { const S = window.__sim.S; S.bleeders.length = 0; if (S.pool < 40) S.pool = 0; });
    await skip(id); await pose();
    const st = await ev(() => { const s = window.__sim, t = s.STEPS[s.S.step]; return { tool: t.tool }; });
    if (st.tool !== 'any') { await ev(t => window.__sim.setInst('R', t), st.tool); await T(1.0); }
    let n = await ev(() => window.__sim.next());
    const aim = async (dx, dy) => { n = await ev(() => window.__sim.next()); if (n) await page.mouse.move(box.x + n.x + (dx || 0), box.y + n.y + (dy || 0), { steps: 2 }); else await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await T(1.0); };
    if (act === 'fire' || act === 'seal') {
      await aim(); await page.mouse.down(); await T(act === 'seal' ? 3.2 : 1.2);
      if (act === 'seal') { await page.mouse.up(); await T(0.3); await page.mouse.move(box.x + n.x + 90, box.y + n.y - 70, { steps: 2 }); await T(0.8); }
    } else if (act === 'bleed') { // cut without sealing
      await aim(); await page.mouse.click(box.x + n.x, box.y + n.y, { button: 'right' }); await T(1.6); await page.mouse.move(box.x + n.x + 120, box.y + n.y - 90, { steps: 2 }); await T(0.5);
    } else if (act === 'done') {
      await ev(() => { const s = window.__sim; s.forceStep(); }); await T(2.5); await aim(70, 50);
    } else await aim(60, 40);
    await ev(() => { for (let k = 0; k < 4; k++) window.__sim.render(0.5); }); await page.waitForTimeout(200);
    await page.locator('#view').screenshot({ path: OUT + tag + '-' + i + '-' + id + '.png' });
    if (process.env.CROP && n) { const cw = 520, ch = 360; await page.screenshot({ path: OUT + tag + '-' + i + '-' + id + '-c.png', clip: { x: Math.max(box.x, Math.min(box.x + box.width - cw, box.x + n.x - cw / 2)), y: Math.max(box.y, Math.min(box.y + box.height - ch, box.y + n.y - ch / 2)), width: cw, height: ch } }); }
    i++;
    if (act === 'fire') { await page.mouse.up(); await T(0.3); }
  }
}
