// Working-space limits: the tip stays in the cavity and in the picture, slides along the wall, cannot be drawn back
// past the lens, and answers at once when travel is reversed. Driven as a hand drives it (the tip follows exactly)
// and with the real mouse and wheel.
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await page.click('#btnBegin');
  await ev(() => {
    window.__simPause = true; const s = window.__sim, T = s.THREE; s.DEPTH.auto = false; s.INP.noLock = true; for (let i = 0; i < 10; i++) s.tick(0.033);
    const R = new T.Raycaster(), F = new T.Vector3(), v = new T.Vector3();
    window.__lim = {
      // push the hand's tip for n frames by (right, up, into the picture) pixels' worth per frame
      push(k, dx, dy, dv, n) { const h = s.HAND[k]; s.setActive(k); for (let i = 0; i < n; i++) { h.cmd.dx = dx; h.cmd.dy = -dy; h.cmd.dv = dv; h.cmd.cart = true; s.tick(0.033); } const lim = h.limT > 0; for (let i = 0; i < 12; i++) s.tick(0.033); return Object.assign(this.state(k), { lim }); },
      state(k) {
        const h = s.HAND[k], cam = s.camera, tip = h.tip.clone(), q = tip.clone().project(cam); cam.getWorldDirection(F);
        v.copy(tip).sub(cam.position); const dist = v.length(); R.set(cam.position, v.normalize());
        // what hides the tip from the lens; a cord or the adnexa lying in front of it does not count as the tip being lost
        const f = R.intersectObjects(s.PICKS, false).filter(x => s.shown(x.object) && !x.object.userData.tube && !/^(ovary|meso)$/.test(x.object.userData.ent))[0];
        return { tip: tip.toArray().map(x => +x.toFixed(2)), ndc: [+q.x.toFixed(3), +q.y.toFixed(3)], lens: +tip.clone().sub(cam.position).dot(F).toFixed(2), hidden: f ? +(dist - f.distance).toFixed(2) : 0, by: f && dist - f.distance > 0.3 ? f.object.userData.ent : '', ins: +h.ins.toFixed(2), lim: h.limT > 0, touch: h.touch };
      },
      home(k) { const h = s.HAND[k]; s.poseFromPoint(h, new T.Vector3(k === 'R' ? 3.4 : -3.4, -0.4, 4.6)); for (let i = 0; i < 15; i++) s.tick(0.033); }
    };
  });
  const shot = async n => { await ev(() => window.__sim.render()); await page.waitForTimeout(250); await page.screenshot({ path: OUT + n + '.png' }); };
  const inside = (r, what) => ok(Math.abs(r.ndc[0]) <= 0.97 && Math.abs(r.ndc[1]) <= 0.97 && r.lens >= 4.4 && r.hidden < 0.75, what + ' ' + JSON.stringify(r));
  let r;
  for (const k of ['R', 'L']) {
    const sx = k === 'R' ? 1 : -1, side = k === 'R' ? 'right' : 'left';
    r = await ev(([k, sx]) => window.__lim.push(k, 14 * sx, 0, 0, 220), [k, sx]); inside(r, side + ' instrument pushed out to its own side stays in the cavity and in view'); ok(r.lim, 'and shows that it is at a limit');
    if (k === 'R') await shot('lim-own-side');
    const a = await ev(k => window.__lim.state(k).tip, k), b = await ev(([k, sx]) => { const h = window.__sim.HAND[k]; for (let i = 0; i < 4; i++) { h.cmd.dx = -14 * sx; h.cmd.cart = true; window.__sim.tick(0.033); } for (let i = 0; i < 8; i++) window.__sim.tick(0.033); return window.__lim.state(k).tip; }, [k, sx]);
    ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 0.5, 'reversing after a long push against the wall answers at once (' + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2) + ' cm in 4 frames)');
    await ev(k => window.__lim.home(k), k);
    r = await ev(([k, sx]) => window.__lim.push(k, -14 * sx, 0, 0, 220), [k, sx]); inside(r, side + ' instrument pushed across to the far side');
    await ev(k => window.__lim.home(k), k);
    r = await ev(k => window.__lim.push(k, 0, 14, 0, 220), k); inside(r, side + ' instrument pushed up'); if (k === 'R') await shot('lim-up');
    await ev(k => window.__lim.home(k), k);
    r = await ev(k => window.__lim.push(k, 0, -14, 0, 220), k); inside(r, side + ' instrument pushed down');
    await ev(k => window.__lim.home(k), k);
    r = await ev(k => window.__lim.push(k, 0, 0, -16, 260), k); inside(r, side + ' instrument drawn back toward the lens stops short of it'); if (k === 'R') await shot('lim-back');
    r = await ev(([k, sx]) => window.__lim.push(k, 10 * sx, 10, -10, 220), [k, sx]); inside(r, side + ' instrument drawn back, out and up together'); if (k === 'R') await shot('lim-corner');
    await ev(k => window.__lim.home(k), k);
    r = await ev(k => window.__lim.push(k, 0, 0, 16, 260), k); ok(r.touch, side + ' instrument pushed in deep comes to rest on tissue ' + JSON.stringify(r));
    await ev(k => window.__lim.home(k), k);
  }
  // the real mouse and wheel
  await ev(() => { window.__sim.INP.noLock = false; window.__sim.setActive('R'); window.__lim.home('R'); });
  const box = await page.locator('#ov').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await ev(() => window.__sim.tick(0.033)); await page.mouse.up(); await page.waitForTimeout(400);
  if (await ev(() => window.__sim.INP.lock)) {
    for (let i = 0; i < 50; i++) { await page.mouse.move(cx + 28 * (i + 1), cy); await ev(() => window.__sim.tick(0.033)); }
    r = await ev(() => { for (let i = 0; i < 12; i++) window.__sim.tick(0.033); return window.__lim.state('R'); }); inside(r, 'mouse: swung far out to the right');
    const out = await ev(() => (window.__sim.DEPTH.flip ? -1 : 1) * 120);
    for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, out); await ev(() => window.__sim.tick(0.033)); }
    r = await ev(() => { for (let i = 0; i < 12; i++) window.__sim.tick(0.033); return window.__lim.state('R'); });
    inside(r, 'mouse: wheeled all the way out'); ok(r.ins < 9, 'the wheel did draw the instrument back (insertion ' + r.ins + ' cm)');
    await shot('lim-mouse-out');
  } else console.log('NOTE pointer lock not granted here: mouse limits not exercised');
  console.log(fails ? fails + ' CHECKS FAILED' : 'ALL CHECKS PASSED');
}
