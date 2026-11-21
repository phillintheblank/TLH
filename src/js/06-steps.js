// ---------- steps: what every case shares ----------
// The steps of the case in hand and the case itself (see CASES), words for the two sides, and the builders for steps
// that seal and divide a pedicle, which more than one operation uses.
const _w = new V3(), _w2 = new V3(), DOWN = V(0, -1, 0);
const curG = k => AN.side[k].cur;
const WORD = { R: 'right', L: 'left' }, OPP = { R: 'left', L: 'right' }, CAP = { R: 'Right', L: 'Left' };
const yawFor = k => (k === 'R' ? -0.5 : 0.5);
const exSide = k => ({ label: 'Uterus deviated to the patient\'s ' + OPP[k], ok: () => (k === 'R' ? S.pose.yaw < -0.25 : S.pose.yaw > 0.25) });
let STEPS = null, CASE = null; // the steps of the case in hand, and the case (see CASES)
const cutLabel = () => (CTRL.mode === 'hands' ? 'Cut: relax, then pinch again' : 'Cut');
// A soft irregular lump, r its half-size along each axis: a clot, or something else lying loose in the pelvis.
const lumpGeo = (seed, r) => paramSurface(22, 14, (u, v, p) => {
  const th = u * TAU, sv = Math.sin(Math.PI * v), cv = Math.cos(Math.PI * v), k = 1 + 0.34 * (fbm3(sv * Math.sin(th) * 1.8 + seed, cv * 1.8 + 1, sv * Math.cos(th) * 1.8, 2) - 0.5);
  p.set(-cv * r[0] * k, sv * Math.sin(th) * r[1] * k, sv * Math.cos(th) * r[2] * k);
}, { closedU: true, su: 2, sv: 1, flip: true });
// A place where the blood pool lies in view, for a prompt to aspirate it: the surface, where nothing stands in front of it.
const POOLSPOT = { p: new V3(), t: -9 };
// where a bagged specimen is drawn to: up beside the scope and out of the top of the picture, on its way to the port
const BAGX = new V3();
const bagExit = () => BAGX.copy(camera.position).addScaledVector(_w.setFromMatrixColumn(camera.matrixWorld, 1), 8).addScaledVector(camera.getWorldDirection(_w2), 5);
function poolSpot() {
  const P = POOLSPOT, p = P.p; if (Math.abs(S.t - P.t) < 0.5) return p; P.t = S.t;
  if (CASE.poolTilt) { // a pool in the cul-de-sac: its deepest place that the scope sees
    if (!PF.cols) poolFit();
    const c = PF.cols, L = POOL.position.y, deep = [];
    for (let i = 0; i < c.length; i += 4) if (L - c[i + 2] > 0.02) deep.push(i);
    deep.sort((a, b) => c[a + 3] - c[b + 3] || c[a + 2] - c[b + 2]); // clear of the rectum first, then the deepest
    for (let n = 0; n < Math.min(14, deep.length); n++) { const i = deep[n]; if (visibleAt(p.set(c[i], poolTop(c[i + 1]) + 0.05, c[i + 1]), 0.3)) return p; }
    return deep.length ? p.set(c[deep[0]], poolTop(c[deep[0] + 1]) + 0.05, c[deep[0] + 1]) : p.set(1, poolTop(-4) + 0.05, -4);
  }
  for (const z of [4, 3, 5, 2, 1, 6, 0, -1.5]) for (const x of [0, 1.2, -1.2, 2.4, -2.4]) if (visibleAt(p.set(x, poolTop(z) + 0.1, z), 0.3)) return p;
  return p.set(0, poolTop(3) + 0.1, 3);
}

function sealStep(o) {
  const k = o.side, ent = o.ent;
  const pointAt = (u, out) => {
    const G = curG(k);
    if (ent === 'round') return sampleArr(G.round, u, out);
    if (ent === 'uo') return sampleArr(G.ridge, u, out);
    if (ent === 'isth') return sampleArr(G.tubeAtt, u, out);
    if (ent === 'ua') return sampleArr(G.ua, u, out).lerp(sampleArr(G.uv, u, _w), 0.4);
    return sampleArr(G.cardLow, u, out).lerp(sampleArr(G.ua, u, _w), 0.55);
  };
  return Object.assign({
    kind: ent, tool: 'bipolar', seal: { ent, side: k },
    next() {
      const e = S.side[k][ent]; if (e.cut) return null;
      if (e.seals.length) return { p: pointAt(e.seals[e.seals.length - 1].u, new V3()), act: 'cut', label: cutLabel() };
      return { p: pointAt(e.act ? e.act.u : o.uT, new V3()), act: 'seal', label: 'Seal', prog: e.act ? e.act.p : 0 };
    },
    done() { return S.side[k][ent].cut; },
    progress() { const e = S.side[k][ent]; return e.cut ? 'Divided' : e.seals.length ? 'Sealed. Cut through the sealed zone.' : e.act ? 'Sealing ' + Math.round(e.act.p * 100) + '%' : 'Not sealed'; },
    frac() { const e = S.side[k][ent]; return e.cut ? 1 : e.seals.length ? 0.66 : e.act ? e.act.p * 0.6 : 0; },
    focus(out) { return pointAt(o.uT, out); }
  }, o);
}
function mesoStep(o) {
  const k = o.side;
  const pt = (w, out) => { const G = curG(k); return sampleArr(G.ridge, 0.6 * w, out).lerp(sampleArr(G.tubeAtt, w, _w), 0.82); };
  return Object.assign({
    kind: 'meso', tool: 'bipolar', seal: { ent: 'meso', side: k },
    onCut() { if (o.swing && S.mesoBite[k] >= 2) S.side[k].tubeGoal = 1; }, // swing: the tube, still on the uterus, falls back behind it
    next() {
      const b = S.mesoBite[k]; if (b >= 2) return null;
      const e = S.side[k].meso, w = b === 0 ? 0.78 : 0.3;
      if (e.seals.length) return { p: pt(e.seals[e.seals.length - 1].u, new V3()), act: 'cut', label: cutLabel() };
      return { p: pt(e.act ? e.act.u : w, new V3()), act: 'seal', label: b === 0 ? 'Seal: fimbrial bite' : 'Seal: bite toward cornu', prog: e.act ? e.act.p : 0 };
    },
    done() { return S.mesoBite[k] >= 2; },
    progress() { return 'Bite ' + Math.min(2, S.mesoBite[k] + 1) + ' of 2' + (S.side[k].meso.seals.length ? ': sealed, now cut' : ''); },
    frac() { const e = S.side[k].meso; return Math.min(1, S.mesoBite[k] / 2 + (e.seals.length ? 0.33 : e.act ? e.act.p * 0.3 : 0)); },
    focus(out) { return pt(0.55, out); }
  }, o);
}
