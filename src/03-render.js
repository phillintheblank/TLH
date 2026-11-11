/* ================= rendering: pelvis ================= */
const TEX = {};
let BACK = null, BACKK = 0;
function pathThrough(c, pts) {
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
  const z = pts[pts.length - 1]; c.lineTo(z.x, z.y);
}
function stroke(c, pts, w, style, alpha) { c.globalAlpha = alpha == null ? 1 : alpha; c.strokeStyle = style; c.lineWidth = w; c.beginPath(); pathThrough(c, pts); c.stroke(); c.globalAlpha = 1; }
/* a shaded cord: dark rim, body, soft highlight. col = [rim, body, light, spec] */
function cord(c, pts, w0, w1, col, alpha) {
  if (pts.length < 2) return; c.lineCap = 'round'; c.lineJoin = 'round';
  const n = pts.length - 1, wa = (w0 + w1) / 2, A = alpha == null ? 1 : alpha;
  if (Math.abs(w0 - w1) < 2) { stroke(c, pts, wa + 3.5, col[0], A); stroke(c, pts, wa, col[1], A); }
  else for (let pass = 0; pass < 2; pass++) { c.globalAlpha = A; c.strokeStyle = col[pass]; for (let i = 0; i < n; i++) { c.lineWidth = lerp(w0, w1, (i + .5) / n) + (pass ? 0 : 3.5); c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i + 1].x, pts[i + 1].y); c.stroke(); } }
  const sh = pts.map(p => ({ x: p.x - wa * .1, y: p.y - wa * .17 }));
  stroke(c, sh, wa * .52, col[2], .55 * A);
  stroke(c, pts.map(p => ({ x: p.x - wa * .16, y: p.y - wa * .27 })), Math.max(1, wa * .13), col[3] || '#fff3ea', .5 * A);
  c.globalAlpha = 1;
}
function blob(c, x, y, r, c0, c1) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function texture(c, x, y, w, h, alpha) { c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = alpha; c.fillStyle = TEX.pat; c.fillRect(x, y, w, h); c.restore(); }

function initTextures(c) { TEX.noise = noiseCanvas(256, 9); TEX.pat = c.createPattern(TEX.noise, 'repeat'); }
function ensureBackdrop(k) {
  const kk = Math.min(2.2, Math.max(1, k * 1.7));
  if (BACK && Math.abs(BACKK - kk) < 0.01) return;
  BACKK = kk; BACK = document.createElement('canvas'); BACK.width = BACK.height = Math.round(1000 * kk);
  const c = BACK.getContext('2d'); c.scale(kk, kk); paintBackdrop(c);
}
function paintBackdrop(c) {
  const R = rng(5); let g; c.lineCap = 'round'; c.lineJoin = 'round';
  const P = a => a.map(p => ({ x: p[0], y: p[1] }));
  /* deep pelvis */
  g = c.createRadialGradient(500, 640, 30, 500, 560, 720);
  g.addColorStop(0, '#260d11'); g.addColorStop(.25, '#5a2224'); g.addColorStop(.58, '#9c4f47'); g.addColorStop(1, '#bf7562');
  c.fillStyle = g; c.fillRect(-60, -60, 1120, 1120);
  /* pelvic sidewalls with the external iliac vessels under the peritoneum */
  for (const s of [1, -1]) {
    c.save(); if (s < 0) { c.translate(1000, 0); c.scale(-1, 1); }
    g = c.createLinearGradient(1010, 0, 650, 0); g.addColorStop(0, '#d39680'); g.addColorStop(.5, '#b96f5f'); g.addColorStop(1, 'rgba(156,82,74,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(1010, 60); c.bezierCurveTo(830, 150, 700, 320, 672, 520); c.bezierCurveTo(664, 700, 740, 870, 850, 1010); c.lineTo(1010, 1010); c.closePath(); c.fill();
    stroke(c, P([[1010, 735], [905, 525], [850, 380], [802, 240]]), 52, '#8c6f88', .2);
    stroke(c, P([[1010, 735], [905, 525], [850, 380], [802, 240]]), 34, '#6e6aa6', .34);
    stroke(c, P([[1002, 718], [900, 512], [846, 372], [800, 236]]), 9, '#a7a4d4', .22);
    stroke(c, P([[1020, 640], [938, 468], [888, 338], [842, 215]]), 24, '#b4484c', .42);
    stroke(c, P([[1016, 628], [934, 460], [884, 332], [840, 212]]), 6, '#f0a79c', .3);
    for (let i = 0; i < 9; i++) blob(c, 880 + R() * 110, 760 + R() * 190, 22 + R() * 34, 'rgba(238,203,118,.5)', 'rgba(238,203,118,0)');
    for (let i = 0; i < 5; i++) blob(c, 900 + R() * 90, 130 + R() * 120, 20 + R() * 30, 'rgba(238,206,130,.3)', 'rgba(238,206,130,0)');
    c.restore();
  }
  /* anterior abdominal wall, umbilical folds, bladder dome */
  g = c.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, '#dea48c'); g.addColorStop(.6, 'rgba(200,132,112,.75)'); g.addColorStop(1, 'rgba(190,122,104,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(-20, -20); c.lineTo(1020, -20); c.lineTo(1020, 190); c.bezierCurveTo(760, 330, 240, 330, -20, 190); c.closePath(); c.fill();
  for (const s of [1, -1]) {
    const fx = x => 500 + s * x;
    stroke(c, P([[fx(175), -10], [fx(190), 150], [fx(205), 300], [fx(190), 400]]), 34, '#8d4c47', .28);
    stroke(c, P([[fx(168), -10], [fx(182), 150], [fx(196), 300], [fx(184), 396]]), 22, '#ecc0aa', .5);
    stroke(c, P([[fx(164), -10], [fx(178), 150], [fx(192), 296]]), 5, '#fff0e6', .35);
  }
  stroke(c, P([[500, -10], [502, 120], [500, 250]]), 16, '#efc7b2', .32);
  g = c.createRadialGradient(500, 330, 10, 500, 372, 250);
  g.addColorStop(0, '#e9bda2'); g.addColorStop(.45, '#d69a83'); g.addColorStop(.8, 'rgba(190,118,102,.8)'); g.addColorStop(1, 'rgba(176,102,90,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(500, 378, 232, 124, 0, 0, TAU); c.fill();
  for (let i = 0; i < 16; i++) blob(c, 330 + R() * 340, 400 + R() * 80, 14 + R() * 26, 'rgba(240,208,128,.34)', 'rgba(240,208,128,0)');
  blob(c, 470, 310, 120, 'rgba(255,238,224,.3)', 'rgba(255,238,224,0)');
  /* sacral promontory and presacral peritoneum */
  blob(c, 330, 985, 260, 'rgba(232,186,166,.62)', 'rgba(232,186,166,0)');
  blob(c, 520, 1010, 190, 'rgba(226,176,156,.5)', 'rgba(226,176,156,0)');
  /* rectosigmoid, entering from the patient's left */
  const sg = SIG, wS = [230, 200, 168, 140, 112];
  c.strokeStyle = '#8a554d'; for (let i = 0; i < 4; i++) { c.lineWidth = (wS[i] + wS[i + 1]) / 2 + 10; c.beginPath(); c.moveTo(sg[i].x, sg[i].y); c.lineTo(sg[i + 1].x, sg[i + 1].y); c.stroke(); }
  c.strokeStyle = '#d19d8e'; for (let i = 0; i < 4; i++) { c.lineWidth = (wS[i] + wS[i + 1]) / 2; c.beginPath(); c.moveTo(sg[i].x, sg[i].y); c.lineTo(sg[i + 1].x, sg[i + 1].y); c.stroke(); }
  stroke(c, sg.map((p, i) => ({ x: p.x - wS[i] * .13, y: p.y - wS[i] * .2 })), 78, '#e9c4b4', .5);
  stroke(c, sg.map((p, i) => ({ x: p.x - wS[i] * .2, y: p.y - wS[i] * .3 })), 26, '#fbe6da', .34);
  stroke(c, sg.map((p, i) => ({ x: p.x + wS[i] * .08, y: p.y + wS[i] * .02 })), 20, '#f1d8cb', .32);       // taenia
  for (let i = 0; i < 9; i++) { const u = .08 + i * .1, p = at(sg, u), q = at(sg, u + .02), dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy), nx = -dy / d, ny = dx / d, w = lerp(230, 112, u) * .46; c.strokeStyle = 'rgba(120,62,58,.2)'; c.lineWidth = 6; c.beginPath(); c.moveTo(p.x + nx * w, p.y + ny * w); c.quadraticCurveTo(p.x + dx * .9, p.y + dy * .9, p.x - nx * w, p.y - ny * w); c.stroke(); }
  for (let i = 0; i < 13; i++) { const u = .03 + R() * .8, p = at(sg, u), w = lerp(230, 112, u) * (.36 + R() * .2), a = at(sg, u + .02), dx = a.x - p.x, dy = a.y - p.y, d = hyp(dx, dy); blob(c, p.x - dy / d * w, p.y + dx / d * w, 14 + R() * 20, 'rgba(242,208,116,.78)', 'rgba(236,196,104,0)'); }
  /* pouch of Douglas shadow */
  blob(c, 500, 668, 120, 'rgba(30,8,12,.62)', 'rgba(30,8,12,0)');
  /* capillaries */
  for (let i = 0; i < 90; i++) {
    let x = R() * 1000, y = R() * 1000, a = R() * TAU; c.strokeStyle = `rgba(${130 + R() * 40 | 0},${30 + R() * 20 | 0},${40 + R() * 20 | 0},${.1 + R() * .2})`; c.lineWidth = .7 + R() * 1.5;
    c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 8; j++) { a += (R() - .5) * 1.1; x += Math.cos(a) * (14 + R() * 20); y += Math.sin(a) * (14 + R() * 20); c.lineTo(x, y); } c.stroke();
  }
  c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = .6; c.fillStyle = c.createPattern(TEX.noise, 'repeat'); c.fillRect(0, 0, 1000, 1000); c.restore();
  /* wet specular flecks */
  for (let i = 0; i < 46; i++) { const x = 120 + R() * 760, y = 80 + R() * 840; c.fillStyle = `rgba(255,246,238,${.05 + R() * .13})`; c.beginPath(); c.ellipse(x, y, 3 + R() * 14, 1.2 + R() * 3, R() * 3, 0, TAU); c.fill(); }
}

const UT = { rim: ['#541d24', '#463044'], mid: ['#a04b4b', '#7b5a72'], lit: ['#cf766c', '#a5879a'], top: ['#e39484', '#b89aa8'] };
const UVES = (() => { const R = rng(42), o = []; for (let i = 0; i < 18; i++) { let t = .34 + R() * .34, ph = R() * TAU; const p = [], dt = (R() - .35) * .035, dp = (R() - .5) * .3; for (let j = 0; j < 8; j++) { p.push([t, ph]); t = clamp(t + dt + (R() - .5) * .03, .3, .76); ph += dp + (R() - .5) * .16; } o.push(p); } return o; })();
function drawUterus(c) {
  const sp = G.sp, A = G.axis, b = S.an.blanch || 0; if (!sp.length) return;
  const cr = mixHex(UT.rim[0], UT.rim[1], b), cm = mixHex(UT.mid[0], UT.mid[1], b), cl = mixHex(UT.lit[0], UT.lit[1], b), ct = mixHex(UT.top[0], UT.top[1], b);
  for (const s of sp) {
    const g = c.createLinearGradient(s.cx - A.px * s.W, s.cy - A.py * s.W, s.cx + A.px * s.W, s.cy + A.py * s.W);
    g.addColorStop(0, cr); g.addColorStop(.16, cm); g.addColorStop(.4, cl); g.addColorStop(.52, ct); g.addColorStop(.66, cl); g.addColorStop(.86, cm); g.addColorStop(1, cr);
    c.fillStyle = g; c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill();
  }
  c.save(); c.beginPath(); for (const s of sp) { c.moveTo(s.x + s.r, s.y); c.arc(s.x, s.y, s.r, 0, TAU); } c.clip();
  const f = G.fund, R = Math.max(G.fundR, 60);
  if (!G.out) {
    let g = c.createRadialGradient(f.x, f.y, R * .6, f.x, f.y, R * 2.4); g.addColorStop(0, 'rgba(40,8,14,0)'); g.addColorStop(.6, 'rgba(40,8,14,.14)'); g.addColorStop(1, 'rgba(34,6,12,.42)');
    c.fillStyle = g; c.fillRect(f.x - R * 3, f.y - R * 3, R * 6, R * 6);
    g = c.createRadialGradient(f.x - R * .18, f.y - R * .3, 0, f.x - R * .1, f.y - R * .2, R * .95); g.addColorStop(0, 'rgba(255,222,206,.4)'); g.addColorStop(1, 'rgba(255,222,206,0)');
    c.fillStyle = g; c.fillRect(f.x - R * 2, f.y - R * 2, R * 4, R * 4);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = b > .5 ? 'rgba(74,44,88,.26)' : 'rgba(150,40,52,.24)';
    for (const v of UVES) { let run = []; const flush = () => { if (run.length > 2) { c.lineWidth = .9 + run[0].f * 1.1; c.beginPath(); pathThrough(c, run); c.stroke(); } run = []; }; for (const [t, ph] of v) { const q = G.surfP(t, ph, .3); if (q.f > .12) run.push(q); else flush(); } flush(); }
    c.fillStyle = 'rgba(255,248,240,.5)'; c.beginPath(); c.ellipse(f.x - R * .3, f.y - R * .42, R * .2, R * .055, -.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,248,240,.3)'; c.beginPath(); c.ellipse(f.x + R * .22, f.y - R * .5, R * .1, R * .035, .3, 0, TAU); c.fill();
  }
  texture(c, f.x - 420, f.y - 420, 840, 840, .5);
  c.restore();
}

const COL = {
  round: ['#7a3c3a', '#c98377', '#e6ac9c'], tube: ['#7e2f33', '#cb6763', '#eca196'], uo: ['#763636', '#c0766d', '#e2a495'],
  ip: ['#864a44', '#cd8f7f', '#ecbba9'], us: ['#8d4f49', '#c58a7c', '#e5b3a3'], art: ['#5e141c', '#b0323b', '#e77a78'], vein: ['#2f2648', '#5f4f8c', '#9a8fc6']
};
function stump(c, p, r) { blob(c, p.x, p.y, r, '#efe1c6', '#cdb596'); c.fillStyle = 'rgba(70,44,32,.6)'; c.beginPath(); c.arc(p.x, p.y, r * .42, 0, TAU); c.fill(); }
function sealBand(c, pts, u, w, a) { if (a <= 0) return; c.lineCap = 'butt'; stroke(c, sub(pts, clamp(u - .085, 0, 1), clamp(u + .085, 0, 1)), w + 1, '#f0e2c6', Math.min(1, a) * .92); stroke(c, sub(pts, clamp(u - .02, 0, 1), clamp(u + .02, 0, 1)), w * .5, '#c9ad88', Math.min(1, a) * .5); c.lineCap = 'round'; }
/* a cord that may be sealed and divided at parameter u */
function cutCord(c, pts, w0, w1, col, id, u, hideMedial, alphaMedial) {
  const cut = S.cut[id], seal = S.seal[id] || 0;
  if (!cut) { cord(c, pts, w0, w1, col); sealBand(c, pts, u, lerp(w0, w1, u), seal); return; }
  const an = S.cutA[id] == null ? 1 : S.cutA[id], e = an * an * (3 - 2 * an), um = lerp(u - .03, u * .5, e), ul = lerp(u + .03, u + (1 - u) * .28, e), wm = lerp(w0, w1, u);
  if (!hideMedial && alphaMedial > 0.02) { const a = sub(pts, 0, um); c.globalAlpha = alphaMedial; cord(c, a, w0, wm, col, alphaMedial); sealBand(c, a, .86, wm, alphaMedial); stump(c, a[a.length - 1], wm * .5); c.globalAlpha = 1; }
  const bq = sub(pts, ul, 1); cord(c, bq, wm, w1, col); sealBand(c, bq, .12, wm, 1); stump(c, bq[0], wm * .5);
}
function drawOvary(c, o) {
  const v = o.ov; c.save(); c.translate(v.x, v.y); c.rotate(v.rot);
  c.fillStyle = 'rgba(60,20,22,.35)'; c.beginPath(); c.ellipse(4, 7, v.rx * 1.02, v.ry * 1.02, 0, 0, TAU); c.fill();
  const g = c.createRadialGradient(-v.rx * .25, -v.ry * .35, 2, 0, 0, v.rx * 1.05); g.addColorStop(0, '#fbf0e4'); g.addColorStop(.45, '#ecd6c6'); g.addColorStop(.85, '#c79e8e'); g.addColorStop(1, '#9d6f66');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, v.rx, v.ry, 0, 0, TAU); c.fill();
  const R = rng(o.s > 0 ? 3 : 8);
  for (let i = 0; i < 5; i++) { const a = R() * TAU, d = R() * .6, x = Math.cos(a) * v.rx * d, y = Math.sin(a) * v.ry * d, r = v.ry * (.16 + R() * .2); blob(c, x, y, r, 'rgba(255,250,244,.5)', 'rgba(232,208,194,0)'); }
  blob(c, v.rx * .4, v.ry * .2, v.ry * .34, 'rgba(238,196,120,.8)', 'rgba(238,196,120,0)');
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-v.rx * .3, -v.ry * .5, v.rx * .22, v.ry * .09, -.2, 0, TAU); c.fill();
  c.restore();
}
function drawSide(c, o) {
  const k = o.k, s = o.s, out = G.out, mA = G.medA;
  /* infundibulopelvic ligament with the ovarian vessels */
  cord(c, o.ip, 34, 44, COL.ip);
  stroke(c, o.ip.map((p, i) => ({ x: p.x + Math.sin(i * 1.3) * 3, y: p.y + 5 })), 5, '#6a5a92', .5);
  stroke(c, o.ip.map((p, i) => ({ x: p.x + Math.cos(i * 1.1) * 3, y: p.y - 4 })), 3.5, '#a8343c', .45);
  /* broad ligament */
  const skel = pathFrac('skel' + k), detached = S.cut['uter' + k] && S.cut['card' + k];
  if (!out) {
    const pts = o.bl.slice(); if (detached) { const w = o.bl[11]; for (let i = 13; i < pts.length; i++) pts[i] = { x: lerp(pts[i].x, w.x, .4), y: lerp(pts[i].y, w.y, .4) }; }
    c.save(); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
    const a = pts[pts.length - 3], b = pts[10], g = c.createLinearGradient(a.x, a.y, b.x, b.y);
    const al = lerp(.92, .5, skel), mc = `${lerp(176, 112, skel) | 0},${lerp(100, 46, skel) | 0},${lerp(90, 44, skel) | 0}`;
    g.addColorStop(0, `rgba(${mc},0)`); g.addColorStop(.1, `rgba(${mc},${al})`); g.addColorStop(.5, `rgba(190,116,102,${al})`); g.addColorStop(.82, 'rgba(196,124,108,.7)'); g.addColorStop(1, 'rgba(196,124,108,0)');
    c.fillStyle = g; c.fill(); c.clip();
    stroke(c, [o.utIn[0], o.utIn[4], o.utIn[8], o.utUp[2]], 16, '#5d4a86', .16 * (1 - skel)); stroke(c, [o.utIn[0], o.utIn[5], o.utIn[10]], 8, '#a8343c', .2 * (1 - skel));
    if (skel > 0) { const R = rng(k === 'L' ? 21 : 22); c.strokeStyle = `rgba(244,230,200,${.4 * skel})`; c.lineWidth = 1.3; for (let i = 0; i < 26; i++) { const p = at(o.utUp, R()), q = at(o.utIn, .3 + R() * .7); c.beginPath(); c.moveTo(p.x + (R() - .5) * 30, p.y + (R() - .5) * 30); c.lineTo(lerp(p.x, q.x, .5) + (R() - .5) * 40, lerp(p.y, q.y, .5) + (R() - .5) * 40); c.stroke(); } }
    texture(c, a.x - 300, a.y - 300, 600, 600, .4);
    c.restore();
  }
  /* uterine vessels once skeletonized */
  if (!out && skel > 0.05) {
    const uc = S.cut['uter' + k], us = S.seal['uter' + k] || 0, ga = S.cutA['uter' + k] == null ? 1 : S.cutA['uter' + k];
    const inn = sub(o.utIn, .34, uc ? 1 - .3 * ga : 1), up = uc ? o.utUp.slice(2) : o.utUp;
    c.globalAlpha = skel; const pu = 1 + .06 * Math.sin(S.t * (S.vit.hr / 60) * TAU);
    cord(c, inn.map(p => ({ x: p.x + 3, y: p.y + 7 })), 9, 9, COL.vein, skel); cord(c, inn, 10 * pu, 10 * pu, COL.art, skel);
    if (up.length > 1) { cord(c, up.map(p => ({ x: p.x - s * 5, y: p.y + 4 })), 8, 6, COL.vein, skel * (uc ? mA : 1)); cord(c, up, 9 * (uc ? 1 : pu), 6, COL.art, skel * (uc ? mA : 1)); }
    c.globalAlpha = 1;
    const T = G.T['uter' + k]; if (us > 0 && !uc) blob(c, T.x, T.y, 19, `rgba(240,226,198,${us * .95})`, `rgba(226,204,170,${us * .25})`);
    if (uc) { stump(c, inn[inn.length - 1], 8); if (up.length && mA > .1) stump(c, up[0], 7 * mA); }
  }
  if (!out) { const cs = S.seal['card' + k] || 0, T = G.T['card' + k]; if (cs > 0) blob(c, T.x, T.y, 17, `rgba(240,226,198,${cs * .9})`, `rgba(226,204,170,${cs * .2})`); if (S.cut['card' + k]) { c.strokeStyle = 'rgba(58,28,22,.8)'; c.lineWidth = 4; c.beginPath(); c.moveTo(T.x - s * 3, T.y - 13); c.lineTo(T.x + s * 3, T.y + 13); c.stroke(); } }
  /* mesosalpinx in four panels between tube and ovary */
  const tubeGone = out || mA < .02;
  if (!tubeGone) {
    const bx = o.uo[0].x, by = o.uo[0].y, ex = o.ov.x, ey = o.ov.y - o.ov.ry * .7, zones = [[.74, .98, 'ms' + k + '1'], [.5, .74, 'ms' + k + '2'], [.26, .5, 'ms' + k + '3'], [.06, .26, 'uo' + k]];
    for (const [u0, u1, id] of zones) {
      if (S.cut[id]) continue; const a = at(o.tube, u0), b = at(o.tube, u1), m = at(o.tube, (u0 + u1) / 2);
      c.fillStyle = 'rgba(176,84,80,.72)'; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(m.x, m.y, b.x, b.y); c.lineTo(lerp(bx, ex, u1), lerp(by, ey, u1)); c.lineTo(lerp(bx, ex, u0), lerp(by, ey, u0)); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,28,38,.45)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(lerp(bx, ex, (u0 + u1) / 2) + 6, lerp(by, ey, (u0 + u1) / 2)); c.stroke();
      const sl = S.seal[id] || 0, T = G.T[id]; if (sl > 0 && id[0] === 'm') blob(c, T.x, T.y, 20, `rgba(240,226,198,${sl * .95})`, `rgba(226,204,170,${sl * .3})`);
    }
  }
  /* utero-ovarian ligament, ovary */
  cutCord(c, o.uo, 19, 17, COL.uo, 'uo' + k, .42, out, mA);
  drawOvary(c, o);
  /* tube and fimbriae; it leaves with the specimen */
  if (!tubeGone) {
    c.globalAlpha = mA; cord(c, o.tube, 20, 36, COL.tube, mA);
    const e = o.tube[o.tube.length - 1], e0 = o.tube[o.tube.length - 3], an = Math.atan2(e.y - e0.y, e.x - e0.x);
    for (let i = -3; i <= 3; i++) { const a = an + i * .36, len = 22 - Math.abs(i) * 2; c.fillStyle = i % 2 ? '#d9736e' : '#e58d84'; c.globalAlpha = mA; c.beginPath(); c.ellipse(e.x + Math.cos(a) * len * .8, e.y + Math.sin(a) * len * .8, len * .62, 6.5, a, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
  /* round ligament */
  cutCord(c, o.round, 21, 17, COL.round, 'round' + k, .5, out, mA);
}
function pathFrac(id) { const m = S.path[id]; if (!m) return 0; let n = 0; for (const v of m) if (v) n++; return n / m.length; }

/* peritoneal windows, dissection planes, colpotomy */
function smoothClosed(c, P) { const n = P.length; c.beginPath(); c.moveTo((P[n - 1].x + P[0].x) / 2, (P[n - 1].y + P[0].y) / 2); for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); } c.closePath(); }
function ribbon(c, pts, w0, grow) {
  const n = pts.length, A = [], B = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b.x - a.x, dy = b.y - a.y; const d = hyp(dx, dy) || 1; dx /= d; dy /= d; const t = n > 1 ? i / (n - 1) : .5, w = (w0 * (.45 + .55 * Math.sin(Math.PI * clamp(t, .1, .9))) + grow) / 2; A.push({ x: pts[i].x - dy * w, y: pts[i].y + dx * w }); B.push({ x: pts[i].x + dy * w, y: pts[i].y - dx * w }); }
  const a0 = pts[0], a1 = pts[n - 1], d0 = pts[Math.min(1, n - 1)], d1 = pts[Math.max(0, n - 2)], e0 = hyp(a0.x - d0.x, a0.y - d0.y) || 1, e1 = hyp(a1.x - d1.x, a1.y - d1.y) || 1, cap = w0 * .3 + grow * .5;
  smoothClosed(c, A.concat([{ x: a1.x + (a1.x - d1.x) / e1 * cap, y: a1.y + (a1.y - d1.y) / e1 * cap }], B.reverse(), [{ x: a0.x + (a0.x - d0.x) / e0 * cap, y: a0.y + (a0.y - d0.y) / e0 * cap }]));
}
function drawPath(c, id, style) {
  const pts = G.P[id], m = S.path[id]; if (!pts || !m) return;
  const runs = []; let cur = null;
  for (let i = 0; i < pts.length; i++) { if (m[i] && pts[i].ok) { if (!cur) runs.push(cur = []); cur.push(pts[i]); } else cur = null; }
  for (const r of runs) {
    const q = r.length === 1 ? [{ x: r[0].x - 5, y: r[0].y }, { x: r[0].x + 5, y: r[0].y }] : r;
    for (const [w, grow, col] of style.layers) { ribbon(c, q, w, grow); c.fillStyle = col; c.fill(); }
    if (style.wisps) { const R = rng(id.length * 7 + id.charCodeAt(id.length - 1)); c.strokeStyle = 'rgba(250,236,214,.42)'; c.lineWidth = 1; c.lineCap = 'round'; for (let i = 0; i < q.length - 1; i++) for (let j = 0; j < 2; j++) { const u = R(), x = lerp(q[i].x, q[i + 1].x, u), y = lerp(q[i].y, q[i + 1].y, u), dx = q[i + 1].x - q[i].x, dy = q[i + 1].y - q[i].y, d = hyp(dx, dy) || 1, l = 4 + R() * 6, sk = (R() - .5) * .9; c.beginPath(); c.moveTo(x - dy / d * l - dx / d * sk * l, y + dx / d * l - dy / d * sk * l); c.lineTo(x + dy / d * l + dx / d * sk * l, y - dx / d * l + dy / d * sk * l); c.stroke(); } }
  }
}
const PSTY = {
  win: { wisps: true, layers: [[26, 9, 'rgba(70,22,24,.22)'], [24, 3, 'rgba(238,196,180,.5)'], [22, 0, '#8e3b38'], [13, 0, 'rgba(176,92,82,.75)']] },
  fascia: { layers: [[30, 12, 'rgba(255,238,228,.13)'], [26, 2, 'rgba(255,242,234,.2)'], [12, 0, 'rgba(255,248,242,.16)']] },
  colpo: { layers: [[17, '#30100f', 1], [13, '#1c0507', 1], [6, '#86c5dc', .95], [2, '#e8f6fb', .7]] }
};
function drawRing(c) {
  const r = G.P.colpo; if (!r) return; c.lineCap = 'round';
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; if (a.f > .05 && b.f > .05 && a.ok && b.ok) { c.strokeStyle = `rgba(255,226,214,${.2 * Math.min(1, a.f * 2)})`; c.lineWidth = 8; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); } }
  const m = S.path.colpo; if (!m) return;
  for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length, a = r[i], b = r[j]; if (m[i] && m[j] && a.f > 0 && b.f > 0) for (const [w, col, al] of PSTY.colpo.layers) { c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); } }
  c.globalAlpha = 1;
}
function drawBladderFlap(c) {
  const e = G.bladEdge, A = G.bladA; if (!e || A < .02) return;
  c.save(); c.globalAlpha = A; c.beginPath(); c.moveTo(e[0].x, e[0].y); for (let i = 1; i < e.length - 1; i++) c.quadraticCurveTo(e[i].x, e[i].y, (e[i].x + e[i + 1].x) / 2, (e[i].y + e[i + 1].y) / 2);
  const z = e[e.length - 1]; c.lineTo(z.x, z.y); c.quadraticCurveTo(z.x - 60, z.y - 60, Math.min(z.x, 400) - 80, 440); c.lineTo(330, 320); c.lineTo(670, 320); c.lineTo(Math.max(e[0].x, 600) + 80, 440); c.quadraticCurveTo(e[0].x + 60, e[0].y - 60, e[0].x, e[0].y); c.closePath();
  const g = c.createLinearGradient(0, 320, 0, e[8].y + 10); g.addColorStop(0, 'rgba(214,154,131,0)'); g.addColorStop(.3, '#d69a83'); g.addColorStop(.85, '#cc8c79'); g.addColorStop(1, '#ad6a60');
  c.fillStyle = g; c.fill(); c.clip();
  const R = rng(77); for (let i = 0; i < 10; i++) blob(c, 380 + R() * 240, e[8].y - 20 - R() * 70, 14 + R() * 22, 'rgba(242,210,128,.42)', 'rgba(242,210,128,0)');
  texture(c, 300, 300, 400, 400, .45);
  c.restore();
  stroke(c, e.slice(1, -1), 5, '#f1c9b6', .4 * A);
}
function drawCuff(c) {
  const cf = G.cuff, n = Math.floor(S.sut / 2), fb = n >= 6 ? -1.2 : 0.84 - (n - .5) * 0.336, xb = n === 0 ? cf.x + cf.rx + 20 : cf.x + cf.rx * fb;
  /* closed seam */
  if (n > 0) { const x1 = cf.x + cf.rx * .97, x0 = Math.max(xb, cf.x - cf.rx * .97); stroke(c, [{ x: x0, y: cf.y }, { x: (x0 + x1) / 2, y: cf.y + 3 }, { x: x1, y: cf.y }], 15, '#9b5a54', 1); stroke(c, [{ x: x0, y: cf.y }, { x: (x0 + x1) / 2, y: cf.y + 3 }, { x: x1, y: cf.y }], 8, '#e3a99b', 1); }
  if (n < 6) {
    c.save(); c.beginPath(); c.rect(cf.x - cf.rx - 30, cf.y - cf.ry - 40, xb - (cf.x - cf.rx - 30), cf.ry * 2 + 80); c.clip();
    c.beginPath(); c.ellipse(cf.x, cf.y, cf.rx, cf.ry, 0, 0, TAU);
    const g = c.createRadialGradient(cf.x, cf.y + cf.ry * .3, 2, cf.x, cf.y, cf.rx); g.addColorStop(0, '#3a1014'); g.addColorStop(.6, '#190508'); g.addColorStop(1, '#0d0204'); c.fillStyle = g; c.fill();
    c.save(); c.clip(); const oc = S.an.cuffCollapse; blob(c, cf.x - 10, cf.y + cf.ry * .5, cf.rx * .7, `rgba(196,222,236,${.5 * oc})`, 'rgba(150,190,214,0)'); c.restore();
    c.lineWidth = 9; c.strokeStyle = '#8f4a45'; c.beginPath(); c.ellipse(cf.x, cf.y, cf.rx + 2, cf.ry + 2, 0, 0, TAU); c.stroke();
    c.lineWidth = 6; c.strokeStyle = '#eab7a8'; c.beginPath(); c.ellipse(cf.x, cf.y, cf.rx + 2, cf.ry + 2, 0, 0, TAU); c.stroke();
    c.setLineDash([3, 9]); c.lineWidth = 3; c.strokeStyle = 'rgba(70,40,30,.55)'; c.beginPath(); c.ellipse(cf.x, cf.y, cf.rx + 1, cf.ry + 1, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    c.restore();
  }
  /* barbed suture */
  const pts = S.sutPts; c.lineCap = 'round';
  if (pts.length) {
    for (let i = 0; i + 1 < pts.length; i += 2) { const a = pts[i], b = pts[i + 1], sq = .42; const ya = lerp(a.y, cf.y - 5, sq), yb = lerp(b.y, cf.y + 6, sq); stroke(c, [{ x: a.x, y: ya }, { x: a.x - 5, y: cf.y }, { x: b.x - 9, y: yb }], 3.2, '#6a4fc0', 1); stroke(c, [{ x: a.x, y: ya - 1 }, { x: a.x - 5, y: cf.y - 1 }, { x: b.x - 9, y: yb - 1 }], 1, '#c9bcf5', .8); }
    const last = pts[pts.length - 1];
    if (pts.length % 2 === 1) { /* needle has passed the anterior edge only */ }
    if (S.tool === 'needle' && S.sut < 12) { const tp = S.tipR; c.strokeStyle = '#6a4fc0'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(last.x, last.y); c.quadraticCurveTo((last.x + tp.x) / 2 + 26, (last.y + tp.y) / 2 + 34, tp.x + 12, tp.y + 6); c.stroke(); }
  }
}

/* blood, burns, fluid */
function drawFluids(c) {
  for (const m of S.chars) { c.fillStyle = `rgba(52,34,26,${m.a})`; c.beginPath(); c.ellipse(m.x, m.y, m.r, m.r * .7, m.rot, 0, TAU); c.fill(); c.fillStyle = `rgba(236,220,190,${m.a * .5})`; c.beginPath(); c.arc(m.x, m.y, m.r * 1.5, 0, TAU); c.fill(); }
  const pool = S.pool;
  if (pool > 1) { const cu = G.cul, rx = 34 + Math.sqrt(pool) * 9.5, ry = rx * .46, d = S.poolDil; c.save(); c.translate(cu.x, cu.y);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, rx); g.addColorStop(0, `rgba(${lerp(96, 190, d) | 0},${lerp(6, 70, d) | 0},${lerp(14, 70, d) | 0},${lerp(.96, .62, d)})`); g.addColorStop(.8, `rgba(${lerp(120, 200, d) | 0},${lerp(10, 80, d) | 0},${lerp(18, 80, d) | 0},${lerp(.9, .5, d)})`); g.addColorStop(1, 'rgba(120,10,18,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,240,236,.36)'; c.beginPath(); c.ellipse(-rx * .3, -ry * .34, rx * .26, ry * .1, -.1, 0, TAU); c.fill(); c.restore(); }
  for (const b of S.bleeders) { const T = G.T[b.id]; if (!T) continue; const r = 9 + Math.sqrt(b.vol) * 3.4;
    blob(c, T.x, T.y + r * .35, r, 'rgba(120,6,14,.96)', 'rgba(140,10,18,0)'); c.fillStyle = 'rgba(255,220,214,.42)'; c.beginPath(); c.ellipse(T.x - r * .25, T.y + r * .1, r * .22, r * .09, -.3, 0, TAU); c.fill();
    if (b.rate > 3) { const ph = (S.t * (S.vit.hr / 60)) % 1, len = 26 + 30 * Math.max(0, Math.sin(ph * Math.PI)); c.strokeStyle = 'rgba(190,14,24,.9)'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(T.x, T.y); c.quadraticCurveTo(T.x + b.dir * len * .7, T.y - len * .7, T.x + b.dir * len, T.y + len * .2); c.stroke(); } }
  for (const d of S.drops) { c.fillStyle = d.w ? `rgba(214,232,240,${d.a})` : `rgba(150,8,18,${d.a})`; c.beginPath(); c.ellipse(d.x, d.y, d.r * .8, d.r * 1.2, 0, 0, TAU); c.fill(); }
}

/* target cues for guided mode */
function ringCue(c, x, y, r, ok, label) {
  const p = .5 + .5 * Math.sin(S.t * 5.2), col = ok ? '111,226,224' : '242,170,61';
  c.save(); c.lineWidth = 2.6 / S.cam.z + .6; c.setLineDash(ok ? [] : [7, 6]); c.strokeStyle = `rgba(${col},${.55 + .4 * p})`; c.beginPath(); c.arc(x, y, r + 3 + p * 4, 0, TAU); c.stroke(); c.setLineDash([]);
  c.strokeStyle = `rgba(${col},.25)`; c.lineWidth = 7; c.beginPath(); c.arc(x, y, r + 5 + p * 4, 0, TAU); c.stroke();
  if (label) { c.font = `700 ${13 / Math.sqrt(S.cam.z) + 3}px "Saira Condensed","Arial Narrow",sans-serif`; c.textAlign = 'center'; const w = c.measureText(label).width + 12, ly = y - r - 20; c.fillStyle = 'rgba(4,14,17,.82)'; c.fillRect(x - w / 2, ly - 12, w, 18); c.fillStyle = `rgb(${col})`; c.fillText(label, x, ly + 2); }
  c.restore();
}
function drawCues(c) {
  if (S.mode !== 'guided' || S.phase !== 'scope' || S.busy > 0) return; const t = cur(); if (!t) return;
  for (const b of S.bleeders) { const T = G.T[b.id]; if (T) ringCue(c, T.x, T.y, 24, true, 'BLEEDING · SEAL'); }
  if (t.type === 'seal' || t.type === 'cut') { const T = G.T[t.target]; if (T && !(t.type === 'seal' && S.bleeders.some(b => b.id === t.target))) ringCue(c, T.x, T.y, T.r - 4, T.ok, t.type === 'seal' ? (t.target === 'ooze' ? 'COAGULATE' : 'SEAL') : 'CUT'); }
  else if (t.type === 'incise') { const pts = G.P[t.path], m = S.path[t.path]; if (!pts) return; const p = .5 + .5 * Math.sin(S.t * 5.2);
    for (let i = 0; i < pts.length; i++) if (!m[i]) { const q = pts[i]; c.fillStyle = q.ok ? `rgba(111,226,224,${.6 + .4 * p})` : 'rgba(242,170,61,.5)'; c.beginPath(); c.arc(q.x, q.y, q.ok ? 4.4 : 3, 0, TAU); c.fill(); } }
  else if (t.type === 'grasp') { const gr = S.grasp;
    if (gr && gr.id === t.id) { const o = t.id === 'bladder' ? G.bladMid : null; const x = S.tipL.x, y = S.tipL.y; c.strokeStyle = 'rgba(111,226,224,.8)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x, y - 62); c.moveTo(x - 9, y - 50); c.lineTo(x, y - 64); c.lineTo(x + 9, y - 50); c.stroke(); }
    else { const gb = G.grabs.find(g => g.id === t.id); if (gb) { const q = gb.pts ? at(gb.pts, .82) : gb; ringCue(c, q.x, q.y, 22, true, 'GRASP'); } } }
  else if (t.type === 'identify') { const u = URE[t.what.slice(-1)], p = .5 + .5 * Math.sin(S.t * 4); const seg = sub(u, .05, .5); for (const d of [-21, 21]) { c.setLineDash([9, 7]); stroke(c, seg.map((q, i) => { const n = seg[Math.min(seg.length - 1, i + 1)], m = seg[Math.max(0, i - 1)], dx = n.x - m.x, dy = n.y - m.y, l = hyp(dx, dy) || 1; return { x: q.x - dy / l * d, y: q.y + dx / l * d }; }), 2.2, `rgba(111,226,224,${.5 + .4 * p})`); } c.setLineDash([]); }
  else if (t.type === 'suture' && G.cuff) { const b = G.cuff.bites[S.sut]; if (b) ringCue(c, b.x, b.y, 9, true, b.edge === 'anterior' ? 'ANTERIOR' : 'POSTERIOR'); }
  else if (t.type === 'suction') ringCue(c, G.cul.x, G.cul.y, 46, true, 'ASPIRATE');
}

function drawUreter(c, k) {
  const u = URE[k], vis = pathFrac('post' + k) > .9 || G.out ? .9 : .5, a = u[0], z = u[u.length - 5];
  const grad = (rgb, al) => { const g = c.createLinearGradient(a.x, a.y, z.x, z.y); g.addColorStop(0, `rgba(${rgb},${al})`); g.addColorStop(vis * .8, `rgba(${rgb},${al * .85})`); g.addColorStop(Math.min(1, vis + .25), `rgba(${rgb},0)`); return g; };
  const body = u.slice(0, -4); c.lineCap = 'butt';
  stroke(c, body.map(p => ({ x: p.x + 2, y: p.y + 5 })), 17, grad('70,24,28', .3));
  stroke(c, body, 14, grad('236,200,186', .6)); stroke(c, body.map(p => ({ x: p.x - 1.5, y: p.y - 2.5 })), 5, grad('255,240,232', .5));
  stroke(c, body.map((p, i) => ({ x: p.x + 2.5 * Math.sin(i * .9), y: p.y + 4 })), 1.2, grad('176,60,66', .5));
  const ph = ((S.t * .17 + (k === 'L' ? .45 : 0)) % 1) * 1.3 - .15;
  if (ph > .02 && ph < vis + .1) { c.lineCap = 'round'; stroke(c, sub(u, Math.max(0, ph - .05), Math.min(.9, ph + .05)), 20, 'rgba(250,224,212,.5)'); }
  c.lineCap = 'round';
}
function drawUS(c, o) {
  const p = o.us, a = p[0], z = p[p.length - 1], fade = (r, g2, b, al) => { const g = c.createLinearGradient(a.x, a.y, z.x, z.y); g.addColorStop(0, `rgba(${r},${g2},${b},${al})`); g.addColorStop(.55, `rgba(${r},${g2},${b},${al * .7})`); g.addColorStop(1, `rgba(${r},${g2},${b},0)`); return g; };
  c.lineCap = 'round'; stroke(c, p.map(q => ({ x: q.x + 3, y: q.y + 7 })), 30, fade(60, 20, 24, .4)); stroke(c, p, 24, fade(196, 128, 114, .95)); stroke(c, p.map(q => ({ x: q.x - 2, y: q.y - 4 })), 10, fade(240, 190, 172, .6));
}
function drawScene(c) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.drawImage(BACK, 0, 0, 1000, 1000);
  const L = G.side.L, Rr = G.side.R;
  drawUreter(c, 'L'); drawUreter(c, 'R');
  for (const o of [L, Rr]) drawUS(c, o);
  blob(c, 500, 690, 90, 'rgba(26,6,10,.5)', 'rgba(26,6,10,0)');
  for (const o of [L, Rr]) if (!o.near) drawSide(c, o);
  drawUterus(c);
  if (!G.out) drawRing(c);
  for (const o of [L, Rr]) if (o.near) drawSide(c, o);
  if (!G.out) {
    drawBladderFlap(c);
    for (const k of ['L', 'R']) { drawPath(c, 'ant' + k, PSTY.win); drawPath(c, 'post' + k, PSTY.win); }
    drawPath(c, 'vu', PSTY.win); drawPath(c, 'bl1', PSTY.fascia); drawPath(c, 'bl2', PSTY.fascia);
    drawRingFront(c);
  } else drawCuff(c);
  drawFluids(c);
  drawCues(c);
}
function drawRingFront(c) { /* colpotomy drawn over the dissection planes */ if (S.path.colpo && pathFrac('colpo') > 0) drawRing(c); }

/* ================= external view for entry and ports ================= */
const EXT = { umb: { x: 500, y: 408 }, asisL: { x: 752, y: 618 }, asisR: { x: 248, y: 618 }, pubis: { x: 500, y: 800 }, latL: { x: 690, y: 566 }, latR: { x: 310, y: 566 }, sp: { x: 500, y: 690 } };
function drawExternal(c) {
  let g = c.createLinearGradient(0, 0, 1000, 1000); g.addColorStop(0, '#1f6470'); g.addColorStop(1, '#0f3a44'); c.fillStyle = g; c.fillRect(0, 0, 1000, 1000);
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 26; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-50 + i * 190, -20); c.quadraticCurveTo(80 + i * 170, 500, -80 + i * 200, 1020); c.stroke(); }
  const ins = clamp(S.ins.p / 15, 0, 1);
  /* fenestration */
  c.save(); c.beginPath(); c.roundRect(212, 196, 576, 690, 46); c.fillStyle = 'rgba(0,0,0,.4)'; c.fill(); c.beginPath(); c.roundRect(222, 206, 556, 670, 40); c.clip();
  g = c.createRadialGradient(480, 470 - ins * 20, 30, 500, 520, 470); g.addColorStop(0, mixHex('#e6b592', '#f0c5a4', ins)); g.addColorStop(.5, '#d39c78'); g.addColorStop(1, '#93603f');
  c.fillStyle = g; c.fillRect(200, 190, 600, 700);
  blob(c, 500, 520, 330, 'rgba(206,120,50,.24)', 'rgba(206,120,50,0)');
  c.strokeStyle = 'rgba(120,70,40,.16)'; c.lineWidth = 3; c.beginPath(); c.moveTo(500, 210); c.lineTo(500, 870); c.stroke();
  blob(c, 440, 400 - ins * 12, 150 + ins * 40, `rgba(255,240,220,${.2 + ins * .2})`, 'rgba(255,240,220,0)');
  for (const a of [EXT.asisL, EXT.asisR]) blob(c, a.x, a.y, 44, 'rgba(255,236,214,.4)', 'rgba(255,236,214,0)');
  c.strokeStyle = 'rgba(110,60,36,.3)'; c.lineWidth = 5; c.beginPath(); c.moveTo(380, 830); c.quadraticCurveTo(500, 790, 620, 830); c.stroke();
  /* umbilicus */
  c.fillStyle = 'rgba(70,34,20,.75)'; c.beginPath(); c.ellipse(EXT.umb.x, EXT.umb.y, 13, 9, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,230,206,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(EXT.umb.x, EXT.umb.y + 3, 17, .3, 2.8); c.stroke();
  texture(c, 200, 190, 600, 700, .35);
  const t = cur(), guided = S.mode === 'guided';
  if (guided) {
    c.setLineDash([10, 8]); c.strokeStyle = 'rgba(190,40,50,.55)'; c.lineWidth = 4;
    for (const s of [1, -1]) { c.beginPath(); c.moveTo(500 + s * 78, 800); c.quadraticCurveTo(500 + s * 120, 600, 500 + s * 96, 400); c.stroke(); }
    c.setLineDash([]); c.font = '600 15px "Saira Condensed","Arial Narrow",sans-serif'; c.fillStyle = 'rgba(60,24,14,.78)'; c.textAlign = 'center';
    c.fillText('ASIS', EXT.asisL.x, EXT.asisL.y + 62); c.fillText('ASIS', EXT.asisR.x, EXT.asisR.y + 62); c.fillText('PUBIC SYMPHYSIS', 500, 852); c.fillText('INFERIOR EPIGASTRIC VESSELS', 500, 458);
    c.strokeStyle = 'rgba(60,24,14,.4)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(418, 464); c.lineTo(400, 490); c.moveTo(582, 464); c.lineTo(600, 490); c.stroke();
  }
  c.restore();
  /* ports */
  const port = (p, big) => { const r = big ? 22 : 16; c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x + 16, p.y + 20, r * 1.4, r * .9, .6, 0, TAU); c.fill(); c.strokeStyle = '#2b3438'; c.lineWidth = r * 1.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 40, p.y + 56); c.stroke(); c.strokeStyle = '#7d8c91'; c.lineWidth = 4; c.beginPath(); c.moveTo(p.x + 6, p.y - 6); c.lineTo(p.x + 44, p.y + 48); c.stroke(); blob(c, p.x, p.y, r, '#e9eef0', '#7b888d'); c.fillStyle = '#12181b'; c.beginPath(); c.arc(p.x, p.y, r * .46, 0, TAU); c.fill(); };
  if (S.ports.umb) port(EXT.umb, true); if (S.ports.L) port(S.ports.L); if (S.ports.R) port(S.ports.R); if (S.ports.sp) port(S.ports.sp);
  if (guided && t && t.type === 'port') {
    if (t.site === 'umb') ringCue(c, EXT.umb.x, EXT.umb.y, 20, true, 'UMBILICUS');
    if (t.site === 'lat') { if (!S.ports.L) ringCue(c, EXT.latL.x, EXT.latL.y, 30, true, '5 MM'); if (!S.ports.R) ringCue(c, EXT.latR.x, EXT.latR.y, 30, true, '5 MM'); }
    if (t.site === 'sp') ringCue(c, EXT.sp.x, EXT.sp.y, 26, true, '5 MM');
  }
  c.font = '600 17px "Saira Condensed","Arial Narrow",sans-serif'; c.fillStyle = 'rgba(214,236,240,.6)'; c.textAlign = 'center';
  c.fillText('HEAD', 500, 150); c.fillText('FEET', 500, 940); c.save(); c.translate(150, 540); c.rotate(-Math.PI / 2); c.fillText('PATIENT RIGHT', 0, 0); c.restore(); c.save(); c.translate(850, 540); c.rotate(Math.PI / 2); c.fillText('PATIENT LEFT', 0, 0); c.restore();
  g = c.createRadialGradient(500, 500, 300, 500, 500, 760); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = g; c.fillRect(0, 0, 1000, 1000);
}
