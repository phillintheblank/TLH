// Screenshots of hand control with scripted hands: the setup screen, working, a hand on hold, and (two cameras)
// a hand that one camera has lost. RIG=two (default) or one. Files go to test/out as hv-<rig>-*.png.
import { installHandDriver, calibrate } from './handdriver.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a), rig = process.env.RIG || 'two', two = rig !== 'one';
  const snap = async n => { await ev(() => window.__sim.render()); await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'hv-' + rig + '-' + n + '.png' }); };
  await installHandDriver(page, rig);
  await ev(two => {
    window.__simPause = true; const s = window.__sim; s.HT.sim = true;
    // a stand-in camera list, as the choosers would show it on a laptop with a webcam plugged in
    s.HT.devices = [{ id: 'a', label: 'FaceTime HD Camera' }, { id: 'b', label: 'OBSBOT Meet 2' }];
    document.getElementById('btnBeginHands').click(); s.HT.cams[0].id = 'a'; if (two) s.HT.cams[1].id = 'b'; s.camFillPickers(); window.__drv.step(12);
  }, two);
  await snap('setup');
  await ev(() => { const d = window.__drv, H = window.__sim.HT; d.step(40); for (let i = 0; i < 10; i++) { d.move('R', 0.017, 0, 0); d.step(1); } for (let k = 0; k < 60 && H.calib.i === 1; k++) d.step(1); for (let i = 0; i < 6; i++) { d.move('R', 0, 0.014, 0); d.step(1); } });
  await snap('setup-move');
  await ev(() => { const s = window.__sim, d = window.__drv; s.htDisable(); s.tick(0.033); d.hands.R.X = d.HOME.R.slice(); document.getElementById('btnHands').click(); });
  const cal = await calibrate(page); console.log('cal ' + JSON.stringify({ status: cal.status, n: cal.n, free: cal.free, depthNoise: cal.depthNoise, fail: cal.fail, note: cal.note }));
  await ev(free => {
    const s = window.__sim, d = window.__drv; d.noise = 0.004; s.forceStep(); d.step(60); s.setPoseGoal(s.STEPS[s.S.step].rec); d.step(50);
    const n = s.next(); if (free) { for (let t = 0; t < 4; t++) if (d.reach('R', n.p, t, n.want).good) break; } else { d.moveTo('R', n.x, n.y); d.step(10); } // one camera: point at it on the screen
    d.hands.R.ap = 0.14; d.step(30);
  }, cal.free);
  await snap('work'); await page.locator('.handpanel').screenshot({ path: OUT + 'hv-' + rig + '-panel.png' });
  await ev(() => { const d = window.__drv; d.hands.L.opn = 1.95; d.hands.L.ap = 0.9; d.step(14); });
  await snap('hold');
  if (two) { await ev(() => { const d = window.__drv; d.hands.L.opn = 1.2; d.hands.L.ap = 0.5; d.step(14); d.hands.L.lost[1] = true; d.step(20); }); await snap('lost'); }
}
