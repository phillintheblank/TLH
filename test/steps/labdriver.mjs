// A scripted pair of hands for the lab's tests. It steers the selected instrument the way the mouse does: travel
// across the picture and along the shaft, handed to the simulator's own free-depth drive, so the working-space
// limits, tissue contact and the rule about passing under the peritoneum all apply to it as they do to a person.
export async function install(page) {
  await page.evaluate(() => {
    const s = window.__sim, L = window.__lab, T = s.THREE, V = (x, y, z) => new T.Vector3(x, y, z);
    const D = window.__drv = {
      tick(n) { for (let i = 0; i < (n || 1); i++) s.tick(1 / 60); },
      // Move hand k's tip to p (an array) as a person would: draw back if the tip is deeper than the target, swing the
      // instrument until it points at the target, then slide it in. o.touch: stop at the first tissue met on the way in.
      to(k, p, o) {
        o = o || {}; s.setActive(k); const h = s.HAND[k], tgt = V(p[0], p[1], p[2]), tol = o.tol || 0.1, cam = s.camera;
        const r = V(), u = V(), f = V(), tip = V(), e = V(), want = V(), dT = tgt.clone().sub(h.port), LT = dT.length(); dT.normalize();
        let d = 0, phase = 0, best = 1e9, stall = 0;
        for (let i = 0; i < (o.max || 900); i++) {
          tip.copy(h.port).addScaledVector(h.dir, h.ins); d = tip.distanceTo(tgt);
          const ang = Math.acos(Math.min(1, h.dir.dot(dT))), short = Math.max(LT - (o.back == null ? 1.6 : o.back), Math.min(LT - 0.5, 9)); // not drawn back so far that the tip is at the wall it comes through
          if (phase === 0) { if (h.ins <= short + 0.05 || stall > 25) { phase = 1; stall = 0; best = 1e9; } else want.copy(h.port).addScaledVector(h.dir, short); }
          if (phase === 1) { if (ang < 0.004 || stall > 40) { phase = 2; stall = 0; best = 1e9; } else want.copy(h.port).addScaledVector(dT, Math.min(h.ins, short)); }
          if (phase === 2) { if (d < tol || stall > 40 || (o.touch && h.touch)) break; want.copy(tgt); }
          e.copy(want).sub(tip); const m = e.length(); if (m < best - 0.003) { best = m; stall = 0; } else stall++;
          r.setFromMatrixColumn(cam.matrixWorld, 0); u.setFromMatrixColumn(cam.matrixWorld, 1); cam.getWorldDirection(f);
          const depth = Math.max(2, tip.clone().sub(cam.position).dot(f)), k0 = (2 * depth * Math.tan((cam.fov * Math.PI) / 360)) / cam.userData.vh, sp = Math.min(1, (o.speed || 0.2) / (m || 1));
          const along = e.dot(h.dir); e.addScaledVector(h.dir, -along); // the part of the move that swings the instrument, and the part that slides it
          h.cmd.dx += (e.dot(r) * sp) / k0; h.cmd.dy += (-e.dot(u) * sp) / k0; h.cmd.dz += along * sp;
          s.tick(1 / 60);
        }
        return { d: +d.toFixed(3), touch: h.touch, in: L.LH[k].in, tip: h.tip.toArray().map(v => +v.toFixed(2)), lim: h.limT > 0, on: h.pick.ent };
      },
      // slide hand k along its shaft by cm (in is positive), or swing its tip by a vector, without the aim-first routine
      nudge(k, v, n) {
        s.setActive(k); const h = s.HAND[k], cam = s.camera, r = V(), u = V(), f = V(), tip = V(), e = V(), N = n || 30;
        for (let i = 0; i < N; i++) {
          tip.copy(h.port).addScaledVector(h.dir, h.ins); r.setFromMatrixColumn(cam.matrixWorld, 0); u.setFromMatrixColumn(cam.matrixWorld, 1); cam.getWorldDirection(f);
          const depth = Math.max(2, tip.clone().sub(cam.position).dot(f)), k0 = (2 * depth * Math.tan((cam.fov * Math.PI) / 360)) / cam.userData.vh;
          if (typeof v === 'number') h.cmd.dz += v / N; else { e.set(v[0] / N, v[1] / N, v[2] / N); const along = e.dot(h.dir); e.addScaledVector(h.dir, -along); h.cmd.dx += e.dot(r) / k0; h.cmd.dy += -e.dot(u) / k0; h.cmd.dz += along; }
          s.tick(1 / 60);
        }
        return h.tip.toArray().map(x => +x.toFixed(2));
      },
      // a press of the mouse button held for t seconds (the simulator sees the button as down for that long)
      press(k, t) { s.setActive(k); const h = s.HAND[k]; s.INP.down = true; s.primaryDown(h); D.tick(Math.max(1, Math.round((t || 0.05) * 60))); s.INP.down = false; s.primaryUp(h); D.tick(2); },
      cut(k) { s.setActive(k); s.cutAction(); D.tick(2); },
      rest(i, j) { const v = V(); L.PX.rest(L.lbId(i, j), v); return v.toArray(); },
      at(i, j) { const v = V(); L.PX.get(L.lbId(i, j), v); return v.toArray(); },
      nin(i, j) { const a = L.lbId(i, j) * 3; return [L.LB.nin[a], L.LB.nin[a + 1], L.LB.nin[a + 2]]; },
      ureter(q) { const v = V(); L.PX.get(L.LU.i0 + q, v); return v.toArray(); },
      add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
    };
    s.camera.userData.vh = document.getElementById('ov').getBoundingClientRect().height;
  });
}
export const ev = (page, fn, a) => page.evaluate(fn, a);
