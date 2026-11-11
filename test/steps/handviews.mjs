// Screenshots of hand mode at work (synthetic hands).
import { installHandDriver, calibrate } from './handdriver.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  await installHandDriver(page);
  await ev(() => { window.__simPause = true; window.__sim.HT.sim = true; });
  await page.click('#btnBeginHands');
  // part-way through calibration
  await ev(() => { const d = window.__drv; d.step(60); for (let i = 0; i < 8; i++) { d.hands.R.x -= 0.012; d.step(1); } d.step(6); window.__sim.render(); });
  await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'hv-calib.png' });
  await ev(() => { const d = window.__drv; d.hands.R.x = 0.32; window.__sim.calibFinish(true); });
  await calibrate(page, 'upright').catch(() => {});
  await ev(() => {
    const d = window.__drv, S = window.__sim;
    S.forceStep(); d.step(40); S.setPoseGoal(S.STEPS[S.S.step].rec); d.step(50);
    const p = S.proj(S.AN.side.R.cur.tubeCur[16].toArray()); d.moveTo('L', p.x, p.y); d.step(10); d.hands.L.ap = 0.14; d.step(6); d.moveTo('L', p.x + 6, p.y - 60);
    const n = S.next(); d.moveTo('R', n.x, n.y); d.step(10); d.hands.R.ap = 0.14; d.step(30);
    S.render();
  });
  await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'hv-work.png' });
  await ev(() => { const d = window.__drv, S = window.__sim; d.hands.R.ap = 0.9; d.hands.R.opn = 1.95; d.step(12); S.render(); });
  await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'hv-hold.png' });
}
