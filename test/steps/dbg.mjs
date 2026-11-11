export default async function (page) {
  await page.click('#btnBegin');
  await page.evaluate(() => { window.__simPause = true; });
  const box = await page.locator('#ov').boundingBox();
  const ev = (fn, a) => page.evaluate(fn, a);
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  await ev(() => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== 'colp' && g++ < 40) { s.forceStep(); for (let i = 0; i < 90; i++) s.tick(0.033); } s.setInst('R', 'hook'); });
  await T(1.2);
  for (const p of [{ yaw: 0, pitch: -0.1, push: 1 }, { yaw: 0, pitch: 0.95, push: 1 }]) {
    await ev(p => window.__sim.setPoseGoal(p), p); await T(1.6);
    for (let i = 0; i < 12; i++) {
      const n = await ev(() => window.__sim.next());
      if (!n || n.hidden || !n.vis) break;
      await page.mouse.move(box.x + n.x, box.y + n.y, { steps: 2 }); await T(0.5);
      await page.mouse.down(); await T(0.1);
      const d = await ev(() => { const s = window.__sim, h = s.HAND.R; let best = 99, bi = 0, bk = ''; for (const k of ['R', 'L']) s.URETER[k].arr.forEach((q, i) => { const d = q.distanceTo(h.tip); if (d < best) { best = d; bi = i; bk = k; } }); return { tip: h.tip.toArray().map(x => +x.toFixed(2)), goal: h.goal.toArray().map(x => +x.toFixed(2)), ent: s.PICK.ent, d: +best.toFixed(2), at: bk + bi, up: s.URETER[bk].arr[bi].toArray().map(x => +x.toFixed(2)), tgt: null }; });
      await T(0.2); await page.mouse.up(); await T(0.1);
      console.log(JSON.stringify(p), 'target', n.p.map(x => +x.toFixed(2)).join(','), JSON.stringify(d));
    }
  }
}
