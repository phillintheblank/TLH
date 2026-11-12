// A scripted pair of hands for tests. It generates landmark frames at 30 fps and feeds them to the page's
// hand-control pipeline, so everything from slot assignment to pinch and clutch detection is exercised.
// The hands move in real directions (right, up, forward); a camera model says what the camera sees of each:
//   'upright' = user-facing webcam: the picture is mirrored, lifting a hand moves it up the picture, and pushing
//               it forward (toward the camera) makes it look bigger.
//   'tilted'  = lid tilted down at the desk: pushing a hand forward moves it down the picture (and slightly nearer),
//               lifting it brings it toward the camera so it looks bigger (and drifts a little up the picture).
// Each entry is what the camera sees, as [x, y, depth signal], for one unit of travel in that direction.
export async function installHandDriver(page, cam) {
  await page.evaluate(cam => {
    const S = window.__sim, T3 = S.THREE;
    const CAMS = { upright: { r: [-1, 0, 0], u: [0, -1, 0], f: [0, 0, 1] }, tilted: { r: [-1, 0, 0], u: [0, -0.2, 1], f: [0, 1, 0.3] } };
    const HOME = { L: { x: 0.68, y: 0.55 }, R: { x: 0.32, y: 0.55 } };
    const drv = window.__drv = {
      t: 0, noise: 0, cam: CAMS[cam || 'upright'],
      hands: { L: { x: 0.68, y: 0.55, size: 0.2, ap: 0.62, opn: 1.45, vis: true }, R: { x: 0.32, y: 0.55, size: 0.2, ap: 0.62, opn: 1.45, vis: true } },
      step(n) {
        for (let i = 0; i < (n || 1); i++) {
          this.t += 1 / 30;
          const dets = [];
          for (const k of ['L', 'R']) { const h = this.hands[k]; if (h.vis) dets.push(S.fakeHand({ x: h.x + (Math.random() - 0.5) * this.noise, y: h.y + (Math.random() - 0.5) * this.noise, size: h.size * (1 + (Math.random() - 0.5) * this.noise * 3), ap: h.ap, opn: h.opn })); }
          S.htIngest(dets, this.t); S.tick(1 / 30);
        }
      },
      // move a hand by (right, up, forward), in picture-heights of travel; false if that would leave the working space
      move(k, a, b, c) {
        const h = this.hands[k], m = this.cam, ox = a * m.r[0] + b * m.u[0] + c * m.f[0], oy = a * m.r[1] + b * m.u[1] + c * m.f[1], oz = a * m.r[2] + b * m.u[2] + c * m.f[2];
        const nx = h.x + ox / S.HT.aspect, ny = h.y + oy, ns = h.size * Math.exp(oz / 1.1);
        if (nx < 0.08 || nx > 0.92 || ny < 0.1 || ny > 0.9 || ns < 0.11 || ns > 0.36) return false;
        const o = this.hands[k === 'R' ? 'L' : 'R']; // two real hands cannot pass through each other
        if (o.vis && Math.abs(nx - o.x) < 0.15 && Math.abs(ny - o.y) < 0.3 && Math.abs(nx - o.x) < Math.abs(h.x - o.x)) return false;
        h.x = nx; h.y = ny; h.size = ns; return true;
      },
      // open the hand flat (clutch), bring it back to a comfortable spot, curl it again
      clutch(k) { const h = this.hands[k], ap = h.ap; h.opn = 1.95; h.ap = 0.9; this.step(8); h.x = HOME[k].x; h.y = HOME[k].y; h.size = 0.2; this.step(8); h.opn = 1.45; h.ap = ap > 0.4 ? ap : 0.62; this.step(20); },
      // auto depth, closed loop: nudge the hand until that hand's pointer reaches (tx, ty) in view pixels
      moveTo(k, tx, ty) {
        const hand = S.HAND[k]; let clutches = 0, steady = 0;
        for (let i = 0; i < 320; i++) {
          if (!hand.ptr.on) { this.step(1); continue; }
          const ex = tx - hand.ptr.x, ey = ty - hand.ptr.y;
          if (Math.hypot(ex, ey) < 2) { if (++steady >= 8) return { ok: true, frames: i, clutches }; this.step(1); continue; } // wait for the smoothing filter to settle
          steady = 0;
          const g = S.HT.tune.gain * document.getElementById('ov').getBoundingClientRect().height;
          if (!this.move(k, (ex / g) * 0.45, (-ey / g) * 0.45, 0)) { this.clutch(k); clutches++; continue; }
          this.step(1);
        }
        return { ok: false, x: hand.ptr.x, y: hand.ptr.y, tx, ty, on: hand.ptr.on, clutches };
      },
      // free depth: one frame of steering the hand so that the instrument's commanded tip heads for world point W.
      // Returns how far the tip was from W. vm caps the hand's travel per frame.
      nudge(k, W, vm) {
        const hand = S.HAND[k], cam = S.camera, st = this._st || (this._st = { R: new T3.Vector3(), U: new T3.Vector3(), F: new T3.Vector3(), e: new T3.Vector3(), tip: new T3.Vector3() });
        const sl = S.HT.slot[k];
        if (!sl.engaged) { this.step(1); return -1; }
        const VH = document.getElementById('ov').getBoundingClientRect().height;
        st.R.setFromMatrixColumn(cam.matrixWorld, 0); st.U.setFromMatrixColumn(cam.matrixWorld, 1); cam.getWorldDirection(st.F);
        st.tip.copy(hand.port).addScaledVector(hand.dir, hand.ins); st.e.copy(W).sub(st.tip);
        const err = st.e.length(), depth = Math.max(2, st.tip.clone().sub(cam.position).dot(st.F)), k0 = (2 * depth * Math.tan((cam.fov * Math.PI) / 360)) / VH, g = S.HT.tune.gain * VH, zg = S.HT.tune.zgain;
        // The tracker smooths what it sees, so the instrument trails the hand a little. A person allows for that and
        // does not keep pushing while the tip catches up: steer by where the tip will settle for the hand as it is now.
        const inv = S.HT.cal.inv, band = 0.002 + 0.014 * S.HT.tune.zsteady, lx = sl.rawx - sl.x, ly = sl.rawy - sl.y, zr = sl.rawz - sl.zb, lz = zr > band ? zr - band : zr < -band ? zr + band : 0;
        st.e.addScaledVector(st.R, -(inv[0] * lx + inv[1] * ly + inv[2] * lz) * g * k0).addScaledVector(st.U, -(inv[3] * lx + inv[4] * ly + inv[5] * lz) * g * k0).addScaledVector(st.F, -(inv[6] * lx + inv[7] * ly + inv[8] * lz) * g * zg * k0);
        const lim = v => Math.max(-vm, Math.min(vm, v));
        const a = lim((st.e.dot(st.R) / k0 / g) * 0.5), b = lim((st.e.dot(st.U) / k0 / g) * 0.5), c = lim((st.e.dot(st.F) / k0 / (g * zg)) * 0.5);
        if (!this.move(k, a, b, c)) { this.clutch(k); this.clutches++; return err; }
        this.step(1); return err;
      },
      // bring the commanded tip to W. stopOnTouch: stop as soon as the tip is in contact with tissue.
      tipTo(k, W, tol, stopOnTouch, maxFrames, vmax) {
        const hand = S.HAND[k]; let steady = 0, best = 1e9, bestI = 0, err = 0; this.clutches = 0;
        for (let i = 0; i < (maxFrames || 420); i++) {
          if (stopOnTouch && hand.touch) return { ok: true, touch: true, frames: i, clutches: this.clutches };
          err = this.nudge(k, W, steady ? 0 : vmax || 0.018);
          if (err < 0) continue;
          if (err < tol) { if (++steady >= 6) return { ok: true, touch: hand.touch, frames: i, clutches: this.clutches }; continue; }
          steady = 0;
          if (err < best - 0.05) { best = err; bestI = i; } else if (i - bestI > 45) return { ok: false, stalled: true, touch: hand.touch, err: +err.toFixed(2), clutches: this.clutches }; // held up by tissue
        }
        return { ok: false, touch: hand.touch, err: +err.toFixed(2), clutches: this.clutches };
      },
      // slide in along the line from the port in direction d, to length L, keeping the tip on that line; stops on contact
      lineTo(k, d, L, maxFrames) {
        const hand = S.HAND[k], W = new T3.Vector3(), tip = new T3.Vector3(); let bestS = -1e9, bestI = 0; this.clutches = 0;
        for (let i = 0; i < (maxFrames || 600); i++) {
          if (hand.touch) return { ok: true, touch: true, frames: i };
          tip.copy(hand.port).addScaledVector(hand.dir, hand.ins); const sAlong = tip.sub(hand.port).dot(d), off = tip.addScaledVector(d, -sAlong).length();
          if (sAlong >= L - 0.04 && off < 0.12) return { ok: true, touch: false, frames: i };
          W.copy(hand.port).addScaledVector(d, Math.min(L, sAlong + (off > (sAlong > L - 2.5 ? 0.12 : 0.18) ? 0 : 0.5))); // off the line: get back on it before going further
          this.nudge(k, W, 0.006);
          if (sAlong > bestS + 0.03) { bestS = sAlong; bestI = i; } else if (i - bestI > 70) return { ok: false, stalled: true, touch: hand.touch };
        }
        return { ok: false, touch: hand.touch };
      },
      // reach a target the way a person would: come off whatever the tip is resting on, swing to line up with the
      // target from the port, then slide in to it. If tissue is met first, feel for the target: aim a little to the
      // side that the obstacle faces and try again. tryNo > 0 (the caller's retries) starts from a slightly different aim.
      reach(k, p, tryNo, want) {
        const hand = S.HAND[k], P = new T3.Vector3().fromArray(p), cam = S.camera;
        const cu = new T3.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), cr = new T3.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        // A person aims for the middle of the part of a structure they can get at, not for its very edge. Look around
        // the target for the aim point whose line from the port meets that structure with the most room around it.
        // want: the structure this step is after ({ ents, side }), when the step names one.
        const off = new T3.Vector3();
        const is = (ud, pt) => {
          if (!want || !ud) return false;
          if (want.cuff) { if (ud.ent !== 'vagina') return false; const c = S.cuffAt(pt.toArray()); const post = want.cuff.edge === 'post'; return c.edge === want.cuff.edge && Math.abs(c.x - want.cuff.x) < (post ? 0.45 : 0.3) && c.depth > (post ? 0.42 : 0.5) && c.depth < (post ? 1.45 : 1.2); } // a full bite, in line, on the right edge
          if (want.spot) return !want.avoid.includes(ud.ent) && pt.distanceTo(P) < want.spot; // a spot to coagulate, and what must not be under the tip
          return want.ents.includes(ud.ent) && ud.side === want.side;
        };
        const plan = tryNo => {
          off.set(0, 0, 0);
          const RC = new T3.Raycaster(), Q = new T3.Vector3(), v = new T3.Vector3(), N = 4, G = 0.15, cell = [];
          for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
            Q.copy(P).addScaledVector(cr, i * G).addScaledVector(cu, j * G); RC.set(hand.port, v.copy(Q).sub(hand.port).normalize());
            const f = RC.intersectObjects(S.PICKS, false).filter(x => S.shown(x.object))[0];
            const dP = f ? f.point.distanceTo(P) : 99; // with no structure named, the spot itself is the target: the line has to land on it
            cell.push({ i, j, on: !!f && (want ? is(f.object.userData, f.point) && dP < 0.9 : dP < 0.3), d: dP, hit: f ? f.distance : 0 });
          }
          const at = (i, j) => (Math.abs(i) > N || Math.abs(j) > N ? null : cell[(j + N) * (2 * N + 1) + i + N]);
          // the nearest aim point that has room around it; the caller's retries move on to the next nearest
          for (const c of cell) { c.room = 0; if (c.on) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const o = at(c.i + a, c.j + b); if (o && o.on) c.room++; } c.r = Math.hypot(c.i, c.j) * G; }
          let list = []; for (const need of [9, 7, 5, 4, 3, 2, 1]) { list = cell.filter(c => c.on && c.room >= need && c.r <= 0.5).sort((a, b) => a.r - b.r); if (list.length) break; }
          if (!list.length) list = cell.filter(c => c.on).sort((a, b) => a.r - b.r);
          if (want && want.cuff) { const nearP = cell.filter(c => c.on && c.room >= 3).sort((a, b) => a.r - b.r); if (nearP.length) list = nearP; } // a bite goes where it is asked for: place before room
          let pick = list[(tryNo || 0) % Math.min(list.length || 1, 4)];
          if (!want && !tryNo && at(0, 0).on && at(0, 0).room >= 4) pick = at(0, 0); // a named spot with room around it: go straight for it
          if (pick) off.addScaledVector(cr, pick.i * G).addScaledVector(cu, pick.j * G);
          meet = pick ? pick.hit : 0;
          return list.length;
        };
        let meet = 0; // how far along the chosen line the tissue is expected
        let nPlan = plan(tryNo || 0);
        const d = new T3.Vector3(); let L = 0; const aim = () => { d.copy(P).add(off).sub(hand.port); L = d.length(); d.normalize(); }; aim();
        // the tip cannot leave the picture, so every waypoint has to lie inside it
        const inView = W => { const q = W.clone().project(cam); return q.z < 1 && Math.abs(q.x) < 0.9 && Math.abs(q.y) < 0.9; };
        const own = len => hand.port.clone().addScaledVector(hand.dir, len), line = len => hand.port.clone().addScaledVector(d, len);
        const good = () => hand.touch && (want ? is(hand.pick, hand.pick.point) && hand.tip.distanceTo(P) < 1 : hand.tip.distanceTo(P) < 0.6);
        const lift = (by) => { for (let i = 0; i < 4 && hand.touch; i++) { const W = own(Math.max(4, Math.min(hand.ins, hand.len) - by)); if (!inView(W)) break; this.tipTo(k, W, 0.2, false, 90); } };
        const out = { tries: 0, feel: 0, aim: +off.length().toFixed(2) };
        // the other hand goes back to its own side first, as a person's would, so the two never cross in the picture
        { const ok = k === 'R' ? 'L' : 'R', oh = this.hands[ok]; if (oh.vis && oh.ap > 0.4 && Math.hypot(oh.x - HOME[ok].x, oh.y - HOME[ok].y) > 0.06) this.clutch(ok); }
        if (good() && !tryNo) return Object.assign(out, { ok: true, touch: true, good: true, hand: k, short: 0, off: +hand.tip.distanceTo(P).toFixed(2), ent: hand.pick.ent, press: +hand.press.toFixed(2) });
        lift(1);
        let s0 = L - 0.8; for (const c of [L - 2.5, L - 1.5]) if (c > 3 && inView(line(c))) { s0 = c; break; }
        const back = Math.min(hand.ins, s0); if (back < hand.ins - 0.3 && inView(own(back))) this.tipTo(k, own(back), 0.25, false, 200);
        // swing across to the target's line. If tissue is in the way (bowel in the midline, a stump), raise the tip
        // clear of it, carry it across at that height, then come down onto the line.
        const UP = new T3.Vector3(0, 1, 0);
        for (let up = 0; out.tries < 5; out.tries++) {
          const sw = this.tipTo(k, line(s0).addScaledVector(UP, up), 0.15, false, 300); out.swing = sw.ok;
          if (out.swing) { if (up > 0) this.tipTo(k, line(s0), 0.15, false, 200, 0.01); break; }
          up += 1.5; lift(1);
          const W = own(Math.min(hand.ins, hand.len)).addScaledVector(UP, 1.5); if (inView(W)) this.tipTo(k, W, 0.25, false, 120);
        }
        // slide in to just short of where the tissue is expected, line up carefully there, then come down onto it
        const land = () => {
          const stop = (meet || L) - 0.6;
          if (stop > hand.ins + 0.3) { const q = this.lineTo(k, d, stop); if (q.touch) return q; }
          if (!hand.touch) this.tipTo(k, line(Math.max(4, Math.min(stop, Math.max(hand.ins, stop - 1)))), 0.05, false, 90, 0.005);
          return this.lineTo(k, d, L + 0.2);
        };
        let r = land();
        // met something else first, or only brushed past: feel for the target. With a named structure, move on to
        // the next most open aim point; otherwise aim a little to the side that the obstacle faces.
        const nrm = new T3.Vector3();
        while (out.feel < 5 && (hand.touch || r.touch) && !good()) {
          out.feel++;
          if (want && nPlan > 1) plan((tryNo || 0) + out.feel);
          else { nrm.copy(hand.pick.normal).addScaledVector(d, -hand.pick.normal.dot(d)); if (nrm.lengthSq() < 0.01) nrm.copy(cu); nrm.normalize(); off.addScaledVector(nrm, 0.15); if (off.length() > 0.75) break; }
          aim(); lift(1.2);
          this.tipTo(k, line(Math.min((meet || L) - 0.6, Math.max(4, hand.ins))), 0.07, false, 220, 0.008);
          r = land();
        }
        // centre the tip on the aim point, as a person does before pinching; come back down if that lifted it off; then
        if (good()) { this.tipTo(k, line(hand.ins), 0.06, false, 60, 0.004); if (!hand.touch) r = this.lineTo(k, d, L + 0.2, 150); }
        // rest the tip on it firmly enough that a little tremor does not lift it off again
        for (let i = 0; i < 25 && hand.touch && hand.ins - hand.ahead.dist < 0; i++) this.nudge(k, own(hand.ins + 0.2), 0.002);
        if (hand.touch) this.step(4);
        return Object.assign(out, r, { good: good(), hand: k, short: +(L - hand.len).toFixed(2), off: +hand.tip.distanceTo(P).toFixed(2), ent: hand.pick.ent, press: +hand.press.toFixed(2) });
      }
    };
  }, cam);
}
// Walk through the on-screen calibration the way a user would.
export async function calibrate(page) {
  return page.evaluate(() => {
    const d = window.__drv, S = window.__sim, R = d.hands.R, HT = S.HT;
    const waitStep = (i, max) => { for (let k = 0; k < max && HT.calib && HT.calib.i === i; k++) d.step(1); return !HT.calib || HT.calib.i !== i; };
    const glide = (key, to, n) => { const from = R[key]; for (let i = 1; i <= n; i++) { R[key] = from + ((to - from) * i) / n; d.step(1); } };
    const travel = (a, b, c, n) => { for (let i = 0; i < n; i++) { d.move('R', a / n, b / n, c / n); d.step(1); } };
    d.step(5);
    if (!waitStep(0, 90)) return { fail: 'hands', note: HT.calib.note };
    travel(0.24, 0, 0, 10); if (!waitStep(1, 90)) return { fail: 'right', note: HT.calib.note, prog: HT.calib.prog };
    travel(0, 0.16, 0, 10); if (!waitStep(2, 90)) return { fail: 'up', note: HT.calib.note, prog: HT.calib.prog };
    travel(0, 0, 0.17, 10); if (!waitStep(3, 90)) return { fail: 'forward', note: HT.calib.note, prog: HT.calib.prog };
    glide('ap', 0.14, 6); if (!waitStep(4, 90)) return { fail: 'pinch', note: HT.calib.note };
    glide('ap', 0.62, 6); if (!waitStep(5, 90)) return { fail: 'grip', note: HT.calib.note };
    R.ap = 0.9; glide('opn', 1.95, 6); for (let k = 0; k < 90 && HT.calib; k++) d.step(1);
    if (HT.calib) return { fail: 'flat', note: HT.calib.note };
    glide('opn', 1.45, 5); R.ap = 0.62; d.clutch('R'); d.step(30);
    const c = HT.cal, r = v => +v.toFixed(2);
    return { status: HT.status, mode: S.CTRL.mode, running: S.S.running, r: [r(c.rx), r(c.ry), r(c.rz)], u: [r(c.ux), r(c.uy), r(c.uz)], f: [r(c.fx), r(c.fy), r(c.fz)], pinchOn: r(c.pinchOn), pinchOff: r(c.pinchOff), flatOn: r(c.flatOn), flatOff: r(c.flatOff), L: S.HAND.L.ptr.on, R: S.HAND.R.ptr.on };
  });
}
