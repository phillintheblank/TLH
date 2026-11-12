// Screenshots for build 0.3c: calibration pose picture, target lock, hidden thumb and edge warnings.
import { installHandDriver, calibrate } from './handdriver.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  await installHandDriver(page, 'upright');
  await ev(() => { window.__simPause = true; window.__sim.HT.sim = true; window.__sim.DEPTH.auto = false; });
  await page.click('#btnBeginHands');
  const snap = async n => { await ev(() => window.__sim.render()); await page.waitForTimeout(300); await page.screenshot({ path: OUT + n + '.png' }); };
  await ev(() => window.__drv.step(12)); await snap('c-cal1');
  await ev(() => { const d = window.__drv; d.hands.L.hide = true; d.step(8); }); await snap('c-cal1-thumb');
  await ev(() => { window.__drv.hands.L.hide = false; });
  await ev(() => { const d = window.__drv, H = window.__sim.HT; d.step(40); for (let i = 0; i < 10; i++) { d.move('R', 0.024, 0, 0); d.step(1); } for (let k = 0; k < 60 && H.calib && H.calib.i === 1; k++) d.step(1); for (let i = 0; i < 10; i++) { d.move('R', 0, 0.016, 0); d.step(1); } for (let k = 0; k < 60 && H.calib.i === 2; k++) d.step(1); for (let i = 0; i < 10; i++) { d.move('R', 0, 0, 0.017); d.step(1); } for (let k = 0; k < 60 && H.calib.i === 3; k++) d.step(1); d.step(3); });
  await snap('c-cal-pinch');
  await ev(() => { window.__sim.calibFinish(true); });
  await ev(() => { const s = window.__sim, d = window.__drv; d.noise = 0.004; d.hands.R.x = 0.32; d.hands.R.y = 0.55; d.hands.R.size = 0.2; d.step(40); s.forceStep(); for (let i = 0; i < 60; i++) d.step(1); s.setPoseGoal(s.STEPS[s.S.step].rec); d.step(50); const n = s.next(); for (let t = 0; t < 4; t++) if (d.reach('R', n.p, t, n.want).good) break; d.step(10); });
  await snap('c-lock');
  await ev(() => { const d = window.__drv; d.hands.R.ap = 0.14; d.step(25); d.hands.R.hide = true; d.hands.L.y = 0.9; d.step(10); });
  await snap('c-hidden-edge');
  console.log(JSON.stringify(await ev(() => { const s = window.__sim; return { lock: s.HAND.R.lock, hidR: s.HT.slot.R.hid, pinchR: s.HT.slot.R.pinch, edgeL: s.HT.slot.L.edge, firing: s.HAND.R.firing }; })));
}
