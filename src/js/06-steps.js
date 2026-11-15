// ---------- steps: what every case shares ----------
// The steps of the case in hand and the case itself (see CASES), words for the two sides, and the builders for steps
// that seal and divide a pedicle, which more than one operation uses.
const _w = new V3(), _w2 = new V3();
const curG = k => AN.side[k].cur;
const WORD = { R: 'right', L: 'left' }, OPP = { R: 'left', L: 'right' }, CAP = { R: 'Right', L: 'Left' };
const yawFor = k => (k === 'R' ? -0.5 : 0.5);
const exSide = k => ({ label: 'Uterus deviated to the patient\'s ' + OPP[k], ok: () => (k === 'R' ? S.pose.yaw < -0.25 : S.pose.yaw > 0.25) });
let STEPS = null, CASE = null; // the steps of the case in hand, and the case (see CASES)
const cutLabel = () => (CTRL.mode === 'hands' ? 'Cut: relax, then pinch again' : 'Cut');
// A place where the blood pool lies in view, for a prompt to aspirate it: the surface, where nothing stands in front of it.
const POOLSPOT = { p: new V3(), t: -9 };
const poolTop = z => POOL.position.y - 0.06 * (z + 1.5); // the pool's surface tips a little toward the scope
// where a bagged specimen is drawn to: up beside the scope and out of the top of the picture, on its way to the port
const BAGX = new V3();
const bagExit = () => BAGX.copy(camera.position).addScaledVector(_w.setFromMatrixColumn(camera.matrixWorld, 1), 8).addScaledVector(camera.getWorldDirection(_w2), 5);
function poolSpot() {
  const P = POOLSPOT, p = P.p; if (Math.abs(S.t - P.t) < 0.5) return p; P.t = S.t;
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
    onCut() { if (o.swing && S.mesoBite[k] >= 2) S.side[k].tubeGoal = 1; }, // swing: the tube, still on the uterus, falls forward out of the way
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
