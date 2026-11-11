// A scripted pair of hands for tests. It generates landmark frames at 30 fps and feeds them to the page's
// hand-control pipeline, so everything from slot assignment to pinch and clutch detection is exercised.
// Camera models: 'upright' = user-facing webcam (image mirrored relative to the user, lifting the hand moves it up
// the image); 'tilted' = lid tilted down at the desk (pushing the hand away moves it DOWN the image).
export async function installHandDriver(page) {
  await page.evaluate(() => {
    const S = window.__sim;
    const drv = window.__drv = {
      t: 0, noise: 0,
      hands: { L: { x: 0.68, y: 0.55, ap: 0.62, opn: 1.45, vis: true }, R: { x: 0.32, y: 0.55, ap: 0.62, opn: 1.45, vis: true } },
      step(n) {
        for (let i = 0; i < (n || 1); i++) {
          this.t += 1 / 30;
          const dets = [];
          for (const k of ['L', 'R']) { const h = this.hands[k]; if (h.vis) dets.push(S.fakeHand({ x: h.x + (Math.random() - 0.5) * this.noise, y: h.y + (Math.random() - 0.5) * this.noise, ap: h.ap, opn: h.opn })); }
          S.htIngest(dets, this.t); S.tick(1 / 30);
        }
      },
      // open the hand flat (clutch), move it back to a comfortable spot, curl it again
      clutch(k) { const h = this.hands[k], ap = h.ap; h.opn = 1.95; h.ap = 0.9; this.step(8); h.x = k === 'R' ? 0.32 : 0.68; h.y = 0.55; this.step(8); h.opn = 1.45; h.ap = ap > 0.4 ? ap : 0.62; this.step(20); },
      // closed-loop: nudge the synthetic hand until that hand's pointer reaches (tx, ty) in view pixels
      moveTo(k, tx, ty) {
        const hand = S.HAND[k], h = this.hands[k]; let clutches = 0, steady = 0;
        for (let i = 0; i < 320; i++) {
          if (!hand.ptr.on) { this.step(1); continue; }
          const ex = tx - hand.ptr.x, ey = ty - hand.ptr.y;
          if (Math.hypot(ex, ey) < 2) { if (++steady >= 8) return { ok: true, frames: i, clutches }; this.step(1); continue; } // wait for the smoothing filter to settle
          steady = 0;
          const c = S.HT.cal, g = S.HT.tune.gain * document.getElementById('ov').getBoundingClientRect().height, a = (ex / g) * 0.45, b = (-ey / g) * 0.45;
          const dx = (a * c.rx + b * c.ux) / S.HT.aspect, dy = a * c.ry + b * c.uy;
          const nx = h.x + dx, ny = h.y + dy;
          if (nx < 0.08 || nx > 0.92 || ny < 0.1 || ny > 0.9) { this.clutch(k); clutches++; continue; }
          h.x = nx; h.y = ny; this.step(1);
        }
        return { ok: false, x: hand.ptr.x, y: hand.ptr.y, tx, ty, on: hand.ptr.on, clutches };
      }
    };
  });
}
// Walk through the on-screen calibration the way a user would.
export async function calibrate(page, cam) {
  return page.evaluate(cam => {
    const d = window.__drv, S = window.__sim, R = d.hands.R, HT = S.HT;
    const sx = cam === 'tilted' ? -1 : -1, sy = cam === 'tilted' ? 1 : -1; // image direction of "user's right" and "up"
    const waitStep = (i, max) => { for (let k = 0; k < max && HT.calib && HT.calib.i === i; k++) d.step(1); return !HT.calib || HT.calib.i !== i; };
    const glide = (key, to, n) => { const from = R[key]; for (let i = 1; i <= n; i++) { R[key] = from + ((to - from) * i) / n; d.step(1); } };
    const log = [];
    d.step(5); log.push(HT.status);
    if (!waitStep(0, 90)) return { fail: 'hands', note: HT.calib.note };
    glide('x', R.x + sx * 0.17 / HT.aspect * 1.4, 10); if (!waitStep(1, 90)) return { fail: 'right', note: HT.calib.note, prog: HT.calib.prog };
    glide('y', R.y + sy * 0.16, 10); if (!waitStep(2, 90)) return { fail: 'up', note: HT.calib.note, prog: HT.calib.prog };
    glide('ap', 0.14, 6); if (!waitStep(3, 90)) return { fail: 'pinch', note: HT.calib.note };
    glide('ap', 0.62, 6); if (!waitStep(4, 90)) return { fail: 'grip', note: HT.calib.note };
    R.ap = 0.9; glide('opn', 1.95, 6); for (let k = 0; k < 90 && HT.calib; k++) d.step(1);
    if (HT.calib) return { fail: 'flat', note: HT.calib.note };
    glide('opn', 1.45, 5); R.ap = 0.62; d.step(30);
    const c = HT.cal, r = v => +v.toFixed(2);
    return { status: HT.status, mode: S.CTRL.mode, running: S.S.running, r: [r(c.rx), r(c.ry)], u: [r(c.ux), r(c.uy)], pinchOn: r(c.pinchOn), pinchOff: r(c.pinchOff), flatOn: r(c.flatOn), flatOff: r(c.flatOff), L: S.HAND.L.ptr.on, R: S.HAND.R.ptr.on };
  }, cam);
}
