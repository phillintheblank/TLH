/* ================= rendering: instruments, smoke, scope optics ================= */
const PIV = { L: { x: -200, y: 20 }, R: { x: 1200, y: 20 } };
function w2s(x, y) { const c = S.cam; return { x: (x - c.x) * c.z + 500, y: (y - c.y + c.br) * c.z + 500 }; }
function s2w(x, y) { const c = S.cam; return { x: (x - 500) / c.z + c.x, y: (y - 500) / c.z + c.y - c.br }; }
function metal(c, h) { const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, '#4c585d'); g.addColorStop(.28, '#f1f5f6'); g.addColorStop(.55, '#a9b5b9'); g.addColorStop(1, '#3e494e'); return g; }
function shaft(c, x0, x1, w, steel) {
  const N = 7;
  for (let i = 0; i < N; i++) {
    const a = lerp(x0, x1, i / N), b = lerp(x0, x1, (i + 1) / N) + (i < N - 1 ? 1 : 0), wa = w * lerp(1.75, 1, i / N), wb = w * lerp(1.75, 1, (i + 1) / N), wm = (wa + wb) / 2;
    const g = c.createLinearGradient(0, -wm / 2, 0, wm / 2);
    if (steel) { g.addColorStop(0, '#39444a'); g.addColorStop(.25, '#e6ecee'); g.addColorStop(.5, '#9aa7ac'); g.addColorStop(.8, '#5d696e'); g.addColorStop(1, '#2a3338'); }
    else { g.addColorStop(0, '#040506'); g.addColorStop(.2, '#1a2023'); g.addColorStop(.36, '#55636a'); g.addColorStop(.5, '#252d31'); g.addColorStop(.85, '#0b0f11'); g.addColorStop(1, '#030405'); }
    c.fillStyle = g; c.beginPath(); c.moveTo(a, -wa / 2); c.lineTo(b, -wb / 2); c.lineTo(b, wb / 2); c.lineTo(a, wa / 2); c.closePath(); c.fill();
  }
}
const TDIM = { grasper: { back: 60, w: 21 }, sealer: { back: 86, w: 22 }, hook: { back: 68, w: 21 }, suction: { back: 0, w: 19 }, needle: { back: 44, w: 20 } };
function jaws(c, kind, open, active, flip) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'grasper') {
    const th = open * .27;
    for (const sg of [1, -1]) { c.save(); c.translate(-44, 0); c.scale(1, sg); c.rotate(-th);
      c.fillStyle = metal(c, 9); c.beginPath(); c.moveTo(0, -.8); c.lineTo(6, -9); c.lineTo(66, -9.5); c.quadraticCurveTo(89, -8, 86, -1); c.closePath(); c.fill(); c.strokeStyle = 'rgba(24,32,36,.7)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(30,12,14,.6)'; c.beginPath(); c.roundRect(26, -7.4, 46, 3.4, 1.7); c.fill();
      c.strokeStyle = 'rgba(36,46,50,.65)'; c.lineWidth = .8; for (let x = 10; x < 84; x += 4) { c.beginPath(); c.moveTo(x, -1); c.lineTo(x + 1.5, -2.8); c.stroke(); }
      c.restore(); }
    c.fillStyle = metal(c, 9); c.fillRect(-62, -8.5, 22, 17); c.fillStyle = '#20282c'; c.beginPath(); c.arc(-46, 0, 3, 0, TAU); c.fill();
  } else if (kind === 'sealer') {
    const th = open * .3;
    c.fillStyle = '#273034'; c.beginPath(); c.moveTo(-54, 1); c.lineTo(40, 1); c.quadraticCurveTo(51, 2, 48, 8.5); c.lineTo(-48, 11); c.closePath(); c.fill();
    c.fillStyle = '#eef0ee'; c.fillRect(-42, .6, 84, 2.4);
    c.save(); c.translate(-54, 0); c.rotate(-th); c.fillStyle = '#39444a'; c.beginPath(); c.moveTo(0, -1); c.lineTo(94, -1); c.quadraticCurveTo(105, -2, 102, -8.5); c.lineTo(6, -11.5); c.closePath(); c.fill();
    c.fillStyle = '#eef0ee'; c.fillRect(12, -3, 84, 2.4); c.strokeStyle = 'rgba(190,206,212,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(10, -9.6); c.lineTo(94, -7.4); c.stroke(); c.restore();
    c.fillStyle = metal(c, 10); c.fillRect(-78, -9.5, 26, 19); c.fillStyle = '#3f8ce0'; c.fillRect(-90, -11, 12, 22);
    if (active) { blob(c, 0, 0, 34, 'rgba(255,236,190,.75)', 'rgba(255,200,120,0)'); }
  } else if (kind === 'hook') {
    const sg = flip ? -1 : 1, g = c.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#a9a391'); g.addColorStop(.35, '#faf7ee'); g.addColorStop(1, '#b8b29f');
    c.fillStyle = g; c.beginPath(); c.roundRect(-70, -5.5, 46, 11, 4); c.fill();
    c.strokeStyle = '#aab6ba'; c.lineWidth = 4.4; c.beginPath(); c.moveTo(-26, 0); c.lineTo(-2, 0); c.quadraticCurveTo(3.5, 0, 3.5, 5 * sg); c.lineTo(3.5, 15 * sg); c.stroke();
    c.strokeStyle = '#f6fafb'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-26, -1); c.lineTo(-2, -1); c.stroke();
    if (active) { blob(c, 3.5, 9 * sg, 30, 'rgba(255,252,220,.98)', 'rgba(255,176,40,0)'); c.strokeStyle = 'rgba(255,240,170,.9)'; c.lineWidth = 1.3; for (let i = 0; i < 5; i++) { const a = Math.random() * TAU, l = 10 + Math.random() * 20; c.beginPath(); c.moveTo(3.5, 9 * sg); c.lineTo(3.5 + Math.cos(a) * l, 9 * sg + Math.sin(a) * l); c.stroke(); } }
  } else if (kind === 'suction') {
    c.fillStyle = metal(c, 8); c.beginPath(); c.arc(0, 0, 9.4, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill();
    c.fillStyle = '#131a1d'; for (const x of [-10, -26, -42]) { c.beginPath(); c.ellipse(x, -1.5, 3.2, 2.3, 0, 0, TAU); c.fill(); }
    if (active) blob(c, 6, 0, 16, 'rgba(210,230,240,.4)', 'rgba(210,230,240,0)');
  } else if (kind === 'needle') {
    const th = open * .2;
    if (S.phase === 'scope' && G && G.out && S.sut < 12) { c.strokeStyle = '#dfe6e8'; c.lineWidth = 2.8; c.beginPath(); c.arc(14, 25, 25, -Math.PI / 2 - 1.75, -Math.PI / 2 + 1.25); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = .9; c.beginPath(); c.arc(14, 25, 24, -Math.PI / 2 - 1.2, -Math.PI / 2 + .8); c.stroke(); }
    for (const sg of [1, -1]) { c.save(); c.translate(-30, 0); c.scale(1, sg); c.rotate(-th); c.fillStyle = metal(c, 6); c.beginPath(); c.moveTo(0, -.6); c.lineTo(4, -6.5); c.lineTo(40, -5.5); c.quadraticCurveTo(53, -4.5, 50, -.8); c.closePath(); c.fill(); c.strokeStyle = 'rgba(24,32,36,.7)'; c.lineWidth = .9; c.stroke(); c.restore(); }
    c.fillStyle = metal(c, 8); c.fillRect(-46, -7.5, 18, 15);
  }
}
function drawTool(c, kind, piv, tip, zs, open, active) {
  const ang = Math.atan2(tip.y - piv.y, tip.x - piv.x), L = hyp(tip.x - piv.x, tip.y - piv.y) / zs, D = TDIM[kind];
  c.save(); c.translate(tip.x, tip.y); c.rotate(ang); c.scale(zs, zs);
  c.save(); c.translate(10, 16); c.globalAlpha = .2; c.fillStyle = '#000'; c.beginPath(); c.moveTo(-L, -D.w * .8); c.lineTo(40, -6); c.lineTo(40, 6); c.lineTo(-L, D.w * .8); c.closePath(); c.fill(); c.restore();
  shaft(c, -L, -D.back, D.w, kind === 'suction');
  jaws(c, kind, open, active, Math.cos(ang) < 0);
  c.restore();
}
function drawTools(c) {
  const zs = Math.pow(S.cam.z, .82), a = S.tool === 'grasper' ? 'L' : 'R';
  const tl = w2s(S.tipL.x, S.tipL.y), tr = w2s(S.tipR.x, S.tipR.y);
  const order = a === 'L' ? ['R', 'L'] : ['L', 'R'];
  for (const h of order) {
    if (h === 'L') drawTool(c, 'grasper', PIV.L, tl, zs, S.jawL, false);
    else drawTool(c, S.rtool, PIV.R, tr, zs, S.jawR, (S.energy && !S.injuryLock) || S.suction);
  }
}
function drawSmoke(c) {
  for (const p of S.smoke) { const q = w2s(p.x, p.y), r = p.r * S.cam.z; const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); g.addColorStop(0, `rgba(226,228,232,${p.a})`); g.addColorStop(1, 'rgba(226,228,232,0)'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.fill(); }
}
let VIG = null;
function optics(c) {
  if (S.haze > .01) { c.fillStyle = `rgba(210,214,220,${S.haze * .3})`; c.fillRect(0, 0, 1000, 1000); }
  if (!VIG) { VIG = c.createRadialGradient(500, 500, 60, 500, 500, 492); VIG.addColorStop(0, 'rgba(0,0,0,0)'); VIG.addColorStop(.6, 'rgba(0,0,0,.06)'); VIG.addColorStop(.84, 'rgba(10,2,2,.42)'); VIG.addColorStop(.97, 'rgba(0,0,0,.9)'); VIG.addColorStop(1, '#000'); }
  c.fillStyle = VIG; c.fillRect(0, 0, 1000, 1000);
  c.save(); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(470, 450, 0, 500, 500, 380); g.addColorStop(0, 'rgba(255,238,224,.07)'); g.addColorStop(1, 'rgba(255,238,224,0)'); c.fillStyle = g; c.fillRect(0, 0, 1000, 1000); c.restore();
}
let CV = null, CTX = null, CVK = 1;
function render() {
  const c = CTX; c.setTransform(CVK, 0, 0, CVK, 0, 0);
  if (S.phase === 'ext') { drawExternal(c); if (S.fade > 0) { c.fillStyle = `rgba(0,0,0,${S.fade})`; c.fillRect(0, 0, 1000, 1000); } return; }
  c.fillStyle = '#000'; c.fillRect(0, 0, 1000, 1000);
  c.save(); c.beginPath(); c.arc(500, 500, 491, 0, TAU); c.clip();
  const cam = S.cam; c.save(); c.translate(500, 500); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y + cam.br);
  drawScene(c); c.restore();
  if (S.phase !== 'brief') drawTools(c);
  drawSmoke(c); optics(c);
  if (S.fade > 0) { c.fillStyle = `rgba(0,0,0,${S.fade})`; c.fillRect(0, 0, 1000, 1000); }
  c.restore();
}
