// Jump to chosen stages and take full-size screenshots.
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  await page.click('#btnBegin');
  await page.evaluate(() => { window.__simPause = true; });
  const box = await page.locator('#ov').boundingBox();
  const ev = (fn, a) => page.evaluate(fn, a);
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const skip = id => ev(id => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== id && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } }, id);
  const pose = async () => { await ev(() => { const s = window.__sim, r = s.STEPS[s.S.step].rec; if (r) s.setPoseGoal(r); }); await T(1.6); };
  const want = (process.env.VIEWS || 'survey,roundR,mesoR,vuf,uaR,colp').split(',');
  for (const id of want) {
    await skip(id); await pose();
    const n = await ev(() => window.__sim.next());
    if (n) await page.mouse.move(box.x + n.x + 60, box.y + n.y + 40, { steps: 2 }); else await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await T(1.2);
    if (process.env.LABELS) await ev(() => { window.__sim.S.labels = true; });
    await ev(() => window.__sim.render()); await page.waitForTimeout(250);
    await page.locator('#view').screenshot({ path: OUT + 'v-' + id + '.png' });
  }
}
