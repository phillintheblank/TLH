/* ================= anatomy model =================
   The uterus is a chain of spheres on an axis that pivots at the cervix with the manipulator.
   Ligaments, tubes and vessels are 3D curves between points on the uterus and fixed pelvic points.
   Everything is projected with one pinhole camera, so exposure and ureter distance fall out of the pose. */
const C3 = v3(0, -15, 260), LU = 86;
const T_RING = 0.095, T_ISTH = 0.30, T_CORNU = 0.64;
const PROF = [[-0.2, 15.5, 2], [-0.05, 16.6, 2.4], [0.04, 18.4, 3], [0.095, 19, 3], [0.15, 17, 2.6], [0.30, 13.5, 2], [0.42, 15, 4.6], [0.56, 17.8, 8.2], [0.66, 18.8, 9.8], [0.70, 18.8, 9.8], [0.75, 17, 8.4], [0.79, 13.6, 6], [0.82, 9.5, 3.4]];
function prof(t) {
  if (t <= PROF[0][0]) return [PROF[0][1], PROF[0][2]];
  for (let i = 1; i < PROF.length; i++) if (t <= PROF[i][0]) { const a = PROF[i - 1], b = PROF[i], k = (t - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k); return [lerp(a[1], b[1], s), lerp(a[2], b[2], s)]; }
  const z = PROF[PROF.length - 1]; return [z[1], z[2]];
}
function frame(mx, my) {
  const a = mx * 38 * DEG, e = (my < 0 ? 22 - my * 30 : 22 - my * 54) * DEG;
  const ce = Math.cos(e), se = Math.sin(e), ca = Math.cos(a), sa = Math.sin(a);
  return { u: v3(ce * sa, se, -ce * ca), l: v3(ca, 0, sa), g: v3(-se * sa, ce, se * ca), a, e };
}
const facing = (n, p) => -(n.x * p.x + n.y * p.y + n.z * p.z) / hyp(p.x, p.y, p.z);
const SIDES = [['L', 1], ['R', -1]];
const SIDENAME = { L: 'left', R: 'right' }, OPPNAME = { L: 'right', R: 'left' };
const URE = {}, ILIAC = {}, NEUT = {};
const SIG = [[965, 1012], [800, 905], [655, 812], [560, 738], [508, 676]].map(p => ({ x: p[0], y: p[1] }));
const REST = { x: 0, y: -0.2 };
function initStatic() {
  const fr = frame(REST.x, REST.y);
  for (const [k, s] of SIDES) {
    const c = [v3(s * 56, -50, 186), v3(s * 47, -44, 220), v3(s * 40, -34, 246), v3(s * 36, -24, 259), v3(s * 31, -13, 265), v3(s * 22, -2, 268), v3(s * 12, 6, 269)];
    URE[k] = samp(t => catmull3(c, t), 48);
    ILIAC[k] = [[985, 700], [900, 520], [848, 380], [800, 250]].map(p => ({ x: s > 0 ? p[0] : 1000 - p[0], y: p[1] }));
    const pr = prof(T_CORNU), r = pr[0] + pr[1] - 1;
    NEUT[k] = v3(C3.x + fr.u.x * LU * T_CORNU + fr.l.x * s * r, C3.y + fr.u.y * LU * T_CORNU, C3.z + fr.u.z * LU * T_CORNU + fr.l.z * s * r);
  }
}

let G = null;
function buildGeo() {
  const out = !!S.flags.specimenOut, del = S.an.deliver || 0;
  const fr = out ? frame(REST.x, REST.y) : frame(S.manip.x, S.manip.y);
  const { u, l, g } = fr, mx = out ? 0 : S.manip.x;
  const ctr = t => v3(C3.x + u.x * LU * t, C3.y + u.y * LU * t, C3.z + u.z * LU * t);
  const surf = (t, phi, ex) => { const pr = prof(t), c = ctr(t), cl = Math.cos(phi) * (pr[0] + pr[1] + (ex || 0)), sg = Math.sin(phi) * (pr[0] + (ex || 0)); return v3(c.x + l.x * cl + g.x * sg, c.y + l.y * cl + g.y * sg, c.z + l.z * cl + g.z * sg); };
  const nrm = phi => { const c = Math.cos(phi), s = Math.sin(phi); return v3(l.x * c + g.x * s, l.y * c + g.y * s, l.z * c + g.z * s); };
  const Gn = { fr, out, T: {}, P: {}, side: {}, grabs: [], medA: clamp(1 - del * 5, 0, 1) };

  /* uterus spheres; the specimen slides down the axis through the colpotomy while it is delivered */
  const tsh = del * 0.98, rs = 1 - 0.42 * del;
  const p0 = proj(ctr(0)), p1 = proj(ctr(0.7 - tsh));
  let ax = p1.x - p0.x, ay = p1.y - p0.y; const al = hyp(ax, ay); let px = 1, py = 0; if (al > 12) { px = -ay / al; py = ax / al; }
  const lp = Math.abs(l.x * px - l.y * py);
  Gn.axis = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, len: al, px, py };
  const sp = [];
  for (let i = 0; i <= 25; i++) {
    const t = -0.18 + i * 0.04, spec = t > 0.11;
    if (spec && (out || t - tsh < 0.06)) continue;
    const pr = prof(t), pw = t > 0.7 ? prof(0.7) : pr, c = spec ? ctr(t - tsh) : ctr(t), pc = proj(c), k = spec ? rs : 1, W = (pw[0] + pw[1] * lp) * pc.s * k;
    for (const j of [-1, -.5, 0, .5, 1]) { if (j && pr[1] < 1) continue; const p = v3(c.x + l.x * j * pr[1] * k, c.y + l.y * j * pr[1] * k, c.z + l.z * j * pr[1] * k), q = proj(p); sp.push({ x: q.x, y: q.y, r: pr[0] * q.s * k, z: p.z, cx: pc.x, cy: pc.y, W, t, spec }); }
  }
  sp.sort((a, b) => b.z - a.z); Gn.sp = sp;
  const occ = (p, q) => { q = q || proj(p); for (let i = 0; i < sp.length; i++) { const s = sp[i]; if (s.z < p.z - 5) { const dx = q.x - s.x, dy = q.y - s.y; if (dx * dx + dy * dy < s.r * s.r * 0.9) return true; } } return false; };
  Gn.over = (x, y) => { for (let i = 0; i < sp.length; i++) { const s = sp[i], dx = x - s.x, dy = y - s.y; if (dx * dx + dy * dy < s.r * s.r) return true; } return false; };
  Gn.fund = proj(ctr(0.62 - tsh)); Gn.fundR = 29 * Gn.fund.s * rs;
  Gn.surfP = (t, phi, ex) => { const p = surf(t, phi, ex), q = proj(p); q.f = facing(nrm(phi), p); return q; };
  const sampP = (fn, n) => { const o = []; for (let i = 0; i <= n; i++) { const p = fn(i / n), q = proj(p); q.ok = !occ(p, q); q.u = i / n; o.push(q); } return o; };
  const arc = (t, d0, d1, n, ex, minF) => { const o = []; for (let i = 0; i <= n; i++) { const d = lerp(d0, d1, i / n) * DEG, p = surf(t, d, ex), q = proj(p); q.f = facing(nrm(d), p); q.ok = q.f > minF && !occ(p, q); o.push(q); } return o; };
  const gr = S.grasp;

  for (const [k, s] of SIDES) {
    const o = Gn.side[k] = { k, s }, lat = s > 0 ? 0 : Math.PI, ph = d => (s > 0 ? d : 180 - d) * DEG, opp = OPPNAME[k];
    const cornu = surf(T_CORNU, lat, -1), rA = surf(0.59, ph(24), -1), uA = surf(0.59, ph(-24), -1);
    o.latFace = facing(v3(l.x * s, l.y * s, l.z * s), surf(T_ISTH, lat, 0));
    o.near = o.latFace > -0.2;
    const stretch = !out && s * mx < -0.42;
    /* round ligament to the deep inguinal ring */
    const ring = v3(s * 58, 50, 212), rl3 = t => qbez3(rA, v3((rA.x + ring.x) / 2, (rA.y + ring.y) / 2 - 5, (rA.z + ring.z) / 2 + 4), ring, t);
    o.round = samp(rl3, 16);
    /* ovary, utero-ovarian and infundibulopelvic ligaments */
    const nc = NEUT[k], uf = S.an['uoFree' + k] || 0, pull = (out ? 0 : 0.3) * (1 - uf);
    const O = v3(s * 50 + (cornu.x - nc.x) * pull + s * 5 * uf, -25 + (cornu.y - nc.y) * pull - 3 * uf, 244 + (cornu.z - nc.z) * pull);
    const po = proj(O); o.ov = { x: po.x, y: po.y, rx: 14.5 * po.s, ry: 9.6 * po.s, rot: -s * 0.28 };
    const Omed = off3(O, -s * 13, 1.5, 0), Olat = off3(O, s * 13.5, -2, 0), brim = v3(s * 66, -42, 184);
    const uo3 = t => qbez3(uA, v3((uA.x + Omed.x) / 2, (uA.y + Omed.y) / 2 - 3, (uA.z + Omed.z) / 2), Omed, t);
    o.uo = samp(uo3, 10);
    o.ip = samp(t => qbez3(Olat, v3((Olat.x + brim.x) / 2, (Olat.y + brim.y) / 2 + 5, (Olat.z + brim.z) / 2 - 3), brim, t), 12);
    /* tube; once the mesosalpinx is divided it hangs from the cornu */
    const tf = S.an['tubeFree' + k] || 0;
    const fim = mix3(off3(O, s * 13, 6, -7), off3(cornu, -s * 12, 15, -12), tf), c2 = mix3(off3(O, s * 3, 19, -6), off3(cornu, s * 9, 24, -10), tf), c1 = off3(cornu, s * 16, 9 + 4 * tf, -3 - 4 * tf);
    o.tube = samp(t => cbez3(cornu, c1, c2, fim, t), 22);
    o.tubeRest = o.tube.map(p => ({ x: p.x, y: p.y, s: p.s, u: p.u }));
    if (gr && gr.id === 'tube' + k) {
      const o0 = at(o.tube, gr.u), dx = S.tipL.x - o0.x, dy = S.tipL.y - o0.y; gr.stretch = hyp(dx, dy);
      for (const p of o.tube) { const w = Math.exp(-Math.pow((p.u - gr.u) / 0.45, 2)) * smooth(0, 0.14, p.u); p.x += dx * w; p.y += dy * w; }
    }
    /* uterosacral ligament */
    const usA = surf(0.1, ph(-58), -2), usE = v3(s * 34, -57, 236);
    o.us = samp(t => qbez3(usA, v3((usA.x + usE.x) / 2 - s * 5, (usA.y + usE.y) / 2 - 4, (usA.z + usE.z) / 2 + 6), usE, t), 12);
    /* uterine artery: sidewall, over the ureter, then up the lateral wall */
    const ua0 = v3(s * 54, -15, 250), uaX = v3(s * 35, -17.5, 259);
    o.utIn = samp(t => qbez3(ua0, uaX, surf(T_ISTH - 0.01, lat, 1.5), t), 10);
    o.utUp = []; for (let t = T_ISTH - 0.01; t <= 0.6; t += 0.028) o.utUp.push(proj(surf(t, lat + 0.2 * Math.sin(t * 58), 1.6)));
    /* broad ligament curtain */
    o.bl = []; for (let i = 0; i <= 9; i++) o.bl.push(o.round[i]);
    o.bl.push(proj(v3(s * 63, 14, 236)), proj(v3(s * 61, -18, 252)), proj(v3(s * 42, -27, 258)));
    for (const t of [0.04, 0.12, 0.2, 0.3, 0.4, 0.5, 0.58]) o.bl.push(proj(surf(t, lat, -3)));
    if (out) continue;

    /* targets */
    const T = Gn.T, rm = at(o.round, 0.5);
    T['round' + k] = { x: rm.x, y: rm.y, r: 27, ok: stretch, hint: `Deviate the uterus to the patient’s ${opp} to stretch the ligament` };
    const tr = !!(gr && gr.id === 'tube' + k && gr.stretch >= 28);
    const bx = o.uo[0].x, by = o.uo[0].y, ex = o.ov.x, ey = o.ov.y - o.ov.ry * 0.75;
    [0.86, 0.62, 0.38].forEach((uu, i) => { const tp = at(o.tube, uu); T['ms' + k + (i + 1)] = { x: lerp(tp.x, lerp(bx, ex, uu), 0.36), y: lerp(tp.y, lerp(by, ey, uu), 0.36), r: 25, ok: tr, hint: 'Grasp the tube and lift it to tent the mesosalpinx' }; });
    const um = at(o.uo, 0.42);
    T['uo' + k] = { x: um.x, y: um.y, r: 25, ok: stretch, hint: `Deviate the uterus to the patient’s ${opp}` };
    const ut3 = surf(T_ISTH + 0.03, lat, 2), cd3 = surf(0.19, lat, 1.5), ut = proj(ut3), cd = proj(cd3), lf = o.latFace > 0.22;
    const hintU = `Deviate the uterus to the patient’s ${opp} and keep the cup pushed cephalad`;
    T['uter' + k] = { x: ut.x, y: ut.y, r: 25, ok: lf && !occ(ut3, ut), hint: hintU };
    T['card' + k] = { x: cd.x, y: cd.y, r: 23, ok: lf && !occ(cd3, cd), hint: hintU };
    /* peritoneal incisions */
    Gn.P['ant' + k] = sampP(t => qbez3(rl3(0.5), surf(0.45, ph(16), 13), surf(T_ISTH + 0.01, ph(25), 0.5), t), 10);
    Gn.P['post' + k] = sampP(t => qbez3(uo3(0.42), surf(0.4, ph(-26), 9), surf(0.12, ph(-52), 1), t), 10);
    const sk = []; for (let i = 0; i <= 8; i++) { const p = surf(lerp(0.56, 0.24, i / 8), lat, 3), q = proj(p); q.ok = lf && !occ(p, q); sk.push(q); }
    Gn.P['skel' + k] = sk;
    /* graspable part of the tube */
    Gn.grabs.push({ id: 'tube' + k, pts: o.tube, u0: 0.45, u1: 0.98, r: 26 });
  }

  if (!out) {
    Gn.P.vu = arc(T_ISTH + 0.01, 25, 155, 14, 0.5, 0.1);
    Gn.P.bl1 = arc(0.21, 32, 148, 12, 0.5, 0.1);
    Gn.P.bl2 = arc(0.1, 36, 144, 12, 4, 0.1);
    Gn.P.colpo = arc(T_RING, 0, 351, 39, 1.5, 0.2);
    /* bladder reflection on the anterior cervix */
    const tb = S.an.bladderT, lift = smooth(0.34, 0, tb) * 5 + 1;
    const e = arc(tb, 10, 170, 16, lift, -9);
    Gn.bladA = smooth(0.02, 0.2, -g.z);
    const mid = e[8]; Gn.bladMid = { x: mid.x, y: mid.y };
    if (gr && gr.id === 'bladder') {
      let dx = S.tipL.x - mid.x, dy = S.tipL.y - mid.y; const d = hyp(dx, dy); gr.stretch = d; if (d > 80) { dx *= 80 / d; dy *= 80 / d; }
      e.forEach((p, i) => { const w = Math.exp(-Math.pow((i - 8) / 4.5, 2)); p.x += dx * w; p.y += dy * w; });
    }
    Gn.bladEdge = e;
    if (Gn.bladA > 0.3) Gn.grabs.push({ id: 'bladder', x: mid.x, y: mid.y - 12, r: 34 });
  } else {
    const cc = proj(ctr(T_RING)), col = S.an.cuffCollapse;
    const cf = Gn.cuff = { x: cc.x, y: cc.y, rx: 22 * cc.s, ry: lerp(18 * cc.s, 6.4 * cc.s, col), bites: [] };
    for (let i = 0; i < 6; i++) { const f = 0.84 - i * 0.336, h = cf.ry * Math.sqrt(1 - f * f); cf.bites.push({ x: cf.x + cf.rx * f, y: cf.y - h - 11, edge: 'anterior' }, { x: cf.x + cf.rx * f, y: cf.y + h + 11, edge: 'posterior' }); }
    const st = at(Gn.side.L.round, 0.6); Gn.T.ooze = { x: st.x, y: st.y, r: 26, ok: true };
  }
  Gn.cul = { x: 500, y: 720 };
  return Gn;
}
