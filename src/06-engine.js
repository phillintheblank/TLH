/* ================= simulation state and engine ================= */
const S = {};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cur = () => TASKS[S.ti];
const PATHLEN = { ant: 11, post: 11, skel: 9, vu: 15, bl1: 13, bl2: 13, colpo: 40 };
const pathLen = id => PATHLEN[id.replace(/[LR]$/, '')];
function resetState() {
  const mode = S.mode || 'guided';
  for (const k of Object.keys(S)) delete S[k];
  const an = { bladderT: 0.34, cuffCollapse: 0, deliver: 0, blanch: 0, tubeFreeL: 0, tubeFreeR: 0, uoFreeL: 0, uoFreeR: 0 };
  Object.assign(S, {
    phase: 'brief', mode, ti: 0, tool: 'sealer', rtool: 'sealer', t: 0, time: 0, busy: 0, after: null, fade: 0, practice: false, outcome: null,
    manip: { tx: REST.x, ty: REST.y, x: REST.x, y: REST.y },
    cam: { x: 500, y: 500, z: 1, uz: 0, br: 0 },
    ptr: { sx: 660, sy: 380, x: 660, y: 380, down: false, inside: false },
    tipL: { x: 318, y: 292 }, tipR: { x: 668, y: 318 }, jawL: 1, jawR: 1, lOff: null, graspClosed: 0,
    grasp: null, graspHold: 0, seal: {}, cut: {}, cutA: {}, path: {}, an, anT: Object.assign({}, an),
    flags: {}, ports: {}, sut: 0, sutPts: [],
    bleeders: [], drops: [], smoke: [], chars: [], haze: 0, pool: 0, poolDil: 0,
    energy: false, suction: false, injuryLock: false, offT: 0, offCounted: false, nearLogged: false, hookT: 0, lastTip: null, lastChar: null, seqWarn: 0,
    ebl: 0, energyT: 0, activations: 0,
    counts: { wrong: 0, off: 0, near: 0, sloppy: 0 }, comps: [], compSet: {}, log: [], stepT: {}, stepStart: 0,
    vit: { hr: 72, sys: 118, dia: 72, spo2: 99, co2: 34 }, ins: { p: 0, set: 0, flow: 0, vol: 0, leak: 0 },
    ui: { dirty: true, want: null }, beat: 0
  });
}
function logEv(text, cls) { S.log.unshift({ t: S.time, text, cls: cls || '' }); if (S.log.length > 80) S.log.pop(); S.ui.logDirty = true; }

/* ---------- task flow ---------- */
function autoDone(t) { return (t.type === 'seal' && S.cut[t.target] && !S.bleeders.some(b => b.id === t.target)) || (t.type === 'cut' && S.cut[t.target]); }
function advance() {
  const t = cur(); if (t) applyDone(t, false);
  let n = S.ti + 1; while (n < TASKS.length && autoDone(TASKS[n])) n++;
  goTask(n);
}
function goTask(n) {
  const prev = cur(); S.ti = n;
  if (prev) S.stepT[prev.step] = (S.stepT[prev.step] || 0);
  if (n >= TASKS.length) { endCase('done'); return; }
  const t = cur();
  if (!prev || prev.step !== t.step) { if (prev && prev.step !== t.step) S.stepT[prev.step] = S.time - S.stepStart; S.stepStart = S.time; logEv(STEPS[stepIndex(t.step)].title, 'step'); }
  const ph = (t.step === 'timeout' || t.step === 'ports') ? 'ext' : 'scope';
  if (ph !== S.phase) { S.phase = ph; S.fade = 1; }
  if (CV) CV.classList.toggle('ext', S.phase === 'ext');
  if (t.type === 'incise' && !S.path[t.path]) S.path[t.path] = new Array(pathLen(t.path)).fill(false);
  if (t.type === 'suction') { S.pool = Math.max(S.pool, 70); S.poolDil = Math.max(S.poolDil, .75); }
  if (t.type === 'seal' && t.target === 'ooze' && !S.seal.ooze && !S.bleeders.some(b => b.id === 'ooze')) S.bleeders.push({ id: 'ooze', rate: BLEED.ooze, vol: 0, seal: 0, dir: 1 });
  S.cam.uz = 0; S.graspHold = 0; S.ui.dirty = true; S.ui.want = null;
}
function applyDone(t, instant) {
  if (t.type === 'seal') S.seal[t.target] = 1;
  else if (t.type === 'cut') { if (!S.cut[t.target]) doCut(t.target, instant); }
  else if (t.type === 'incise') { S.path[t.path] = new Array(pathLen(t.path)).fill(true); afterPath(t.path, instant); }
  else if (t.type === 'port') { if (t.site === 'umb') { S.ports.umb = 1; S.ins.set = 15; } else if (t.site === 'lat') { S.ports.L = S.ports.L || EXT.latL; S.ports.R = S.ports.R || EXT.latR; } else S.ports.sp = S.ports.sp || EXT.sp; }
  else if (t.type === 'suture') { if (instant) { G = buildGeo(); S.sut = 12; S.sutPts = G.cuff.bites.map(b => ({ x: b.x, y: b.y })); } }
  else if (t.type === 'suction') { S.pool = 0; S.poolDil = 0; }
  else if (t.type === 'action') {
    if (t.act === 'deliver') { S.flags.specimenOut = 1; S.an.deliver = S.anT.deliver = 1; S.anT.cuffCollapse = 1; S.ins.leak = 0; S.grasp = null; S.manip.tx = REST.x; S.manip.ty = REST.y; if (!instant) logEv('Specimen out, occluder in place', 'good'); }
    else if (t.act === 'lowp') S.ins.set = 8;
    else if (t.act === 'close') S.ins.set = 0;
  }
}
function doCut(id, quiet) { S.cut[id] = 1; S.cutA[id] = quiet ? 1 : 0; afterCut(id); if (!quiet) { Snd.blade(); S.ebl += 1.5; } }
function afterCut(id) {
  const k = (id.match(/[LR]/) || [''])[0];
  if (/^ms/.test(id) && S.cut['ms' + k + '1'] && S.cut['ms' + k + '2'] && S.cut['ms' + k + '3']) S.anT['tubeFree' + k] = 1;
  if (/^uo/.test(id)) S.anT['uoFree' + k] = 1;
  if (/^uter/.test(id) && S.cut.uterL && S.cut.uterR) S.anT.blanch = 1;
}
function afterPath(id, quiet) {
  if (id === 'vu') S.anT.bladderT = 0.24; else if (id === 'bl1') S.anT.bladderT = 0.14; else if (id === 'bl2') S.anT.bladderT = 0.0;
  else if (id === 'colpo') { S.ins.leak = 1; S.grasp = null; if (!quiet) S.ebl += 14; if (!quiet) logEv('Colpotomy complete. CO₂ is escaping through the vagina', 'warn'); }
}
function jumpTo(n) {
  resetState(); S.practice = n > 0; S.phase = 'ext';
  for (let i = 0; i < n; i++) applyDone(TASKS[i], true);
  for (const k in S.anT) S.an[k] = S.anT[k];
  S.ins.p = S.ins.set; G = buildGeo(); S.ti = Math.max(0, n - 1); S.log.length = 0;
  if (n === 0) { S.ti = -1; }
  goTask(n); S.fade = 1;
}
function endCase(kind) {
  if (S.phase === 'done') return;
  const t = TASKS[Math.min(S.ti, TASKS.length - 1)]; if (t) S.stepT[t.step] = S.time - S.stepStart;
  S.phase = 'done'; S.outcome = kind; S.energy = false; S.suction = false; Snd.hold('seal', false); Snd.hold('cut', false); Snd.hold('suction', false);
  showDebrief();
}

/* ---------- complications ---------- */
function complication(type, k) {
  S.injuryLock = true; const key = type + (k || '');
  if (S.compSet[key]) return; S.compSet[key] = 1;
  const C = COMP[type], title = C.title(k); S.comps.push({ type, k, t: S.time, step: cur() ? cur().step : '' });
  logEv(title, C.cls); say(title + '.', C.cls === 'crit' ? 'crit' : 'warn', 4.6); flash(); Snd.alarm();
  if (type === 'iliac') { S.ebl += 350; S.busy = 1.6; S.after = () => endCase('convert'); }
}
function bleedFrom(id) {
  if (S.cut[id]) return; doCut(id);
  const base = id.replace(/[LR]\d?$/, ''), k = (id.match(/[LR]/) || ['L'])[0];
  S.seal[id] = 0; S.bleeders.push({ id, rate: BLEED[base] || 2, vol: 0, seal: 0, dir: k === 'L' ? 1 : -1 });
  complication('bleed', id); S.injuryLock = true;
}
function wrongTool(need) { S.counts.wrong++; S.ui.want = need; say(`Wrong instrument. Select the ${TOOLS[need].name.toLowerCase()} (key ${TOOLS[need].key}).`, 'warn'); }
function inBladder(x, y) {
  if (G.out) { const dx = (x - 500) / 150, dy = (y - 392) / 84; return dx * dx + dy * dy < 1; }
  if (G.bladEdge && G.bladA > .3) { const e = G.bladEdge, poly = e.concat([{ x: 660, y: 330 }, { x: 340, y: 330 }]); if (inPoly(x, y, poly)) return polyDist(x, y, e) > 26; }
  const dx = (x - 500) / 150, dy = (y - 385) / 80; return dx * dx + dy * dy < 1;
}
function dangerAt(x, y, nearCur) {
  if (G.over(x, y)) return null;
  for (const [k] of SIDES) { const v = G.side[k].ov, c = Math.cos(-v.rot), s = Math.sin(-v.rot), dx = x - v.x, dy = y - v.y, ex = (dx * c - dy * s) / v.rx, ey = (dx * s + dy * c) / v.ry; if (ex * ex + ey * ey < .8) return nearCur ? null : { type: 'ovary', k }; }
  let near = null;
  for (const [k] of SIDES) { const d = polyDist(x, y, URE[k], 0, 44); if (d < 15) return { type: 'ureter', k }; if (d < 34) near = { near: true, k }; }
  if (near) return near; if (nearCur) return null;
  for (const [k] of SIDES) if (polyDist(x, y, ILIAC[k]) < 20) return { type: 'iliac', k };
  if (inBladder(x, y)) return { type: 'bladder' };
  for (let i = 0; i < 3; i++) if (segDist(x, y, SIG[i].x, SIG[i].y, SIG[i + 1].x, SIG[i + 1].y) < [78, 66, 54][i]) return { type: 'bowel' };
  return null;
}
function targetUnder(tip) { let best = null, bd = 1e9; for (const id in G.T) { if (id === 'ooze' || S.cut[id]) continue; const T = G.T[id], d = hyp(T.x - tip.x, T.y - tip.y); if (d < T.r && d < bd) { bd = d; best = id; } } return best; }
function nearPath(id, tip, r) { const pts = G.P[id]; if (!pts) return false; for (const q of pts) if (hyp(q.x - tip.x, q.y - tip.y) < r) return true; return false; }
function onCurrentTarget(t) {
  const tip = S.tipR;
  if (t.type === 'seal' || t.type === 'cut') { const T = G.T[t.target]; return !!T && hyp(T.x - tip.x, T.y - tip.y) < T.r + 6; }
  if (t.type === 'incise') return nearPath(t.path, tip, 26);
  if (t.type === 'grasp') { const g = G.grabs.find(g => g.id === t.id); if (!g) return false; const q = g.pts ? at(g.pts, .8) : g; return hyp(q.x - tip.x, q.y - tip.y) < 60; }
  if (t.type === 'suture') return !!G.cuff && hyp(G.cuff.x - tip.x, G.cuff.y - tip.y) < G.cuff.rx + 30;
  if (t.type === 'suction') return hyp(G.cul.x - tip.x, G.cul.y - tip.y) < 110;
  return false;
}

/* ---------- instrument actions ---------- */
function selectTool(name) {
  if (!TOOLS[name]) return; S.tool = name; if (name !== 'grasper') S.rtool = name;
  S.energy = false; S.suction = false; S.ptr.down = false;
  S.lOff = name === 'grasper' && S.grasp ? { x: S.tipL.x - S.ptr.x, y: S.tipL.y - S.ptr.y } : null;
  if (S.ui.want === name) S.ui.want = null; S.ui.dirty = true;
}
function snapTip() { const p = S.ptr; if (!p.inside) return; const w = s2w(p.sx, p.sy); p.x = w.x; p.y = w.y; if (S.tool === 'grasper') { if (!S.lOff) { S.tipL.x = w.x; S.tipL.y = w.y; } } else { S.tipR.x = w.x; S.tipR.y = w.y; } }
function primaryDown() {
  if (S.phase === 'ext') { portClick(); return; }
  if (S.phase !== 'scope' || S.busy > 0) return;
  Snd.init(); snapTip();
  const t = cur(), tool = S.tool; S.ptr.down = true;
  S.offT = 0; S.offCounted = false; S.injuryLock = false; S.nearLogged = false; S.hookT = 0; S.lastTip = null; S.lastChar = null; S.seqWarn = 0;
  if (t.type === 'identify') { identifyClick(t); return; }
  if (tool === 'grasper') { graspToggle(); return; }
  const need = NEED[t.type];
  if (need && need !== tool && onCurrentTarget(t)) { wrongTool(need); return; }
  if (tool === 'needle') { needleClick(t); return; }
  if (tool === 'suction') { S.suction = true; return; }
  S.energy = true; S.activations++;
}
function primaryUp() { S.ptr.down = false; S.energy = false; S.suction = false; }
function secondary() {
  if (S.phase !== 'scope' || S.busy > 0) return; Snd.init(); snapTip(); const t = cur();
  if (S.tool === 'sealer') {
    Snd.blade(); const id = targetUnder(S.tipR);
    if (!id) { say('Nothing between the jaws to divide.', 'warn'); return; }
    if ((S.seal[id] || 0) >= 1) { doCut(id); if (t.type === 'cut' && t.target === id) advance(); }
    else { say('Blade fired through unsealed tissue. Control the bleeding with the bipolar sealer.', 'crit', 4.6); bleedFrom(id); }
  } else if (S.tool === 'suction') {
    S.pool = Math.min(150, S.pool + 16); S.poolDil = Math.min(1, S.poolDil + .2);
    for (let i = 0; i < 14; i++) S.drops.push({ x: S.tipR.x, y: S.tipR.y, vx: (Math.random() - .5) * 140, vy: 40 + Math.random() * 120, r: 3, a: .7, w: 1, life: .7 });
  }
}
function graspToggle() {
  if (S.grasp) { S.grasp = null; S.lOff = null; Snd.tick(); return; }
  const tip = S.tipL; let best = null, bd = 1e9;
  for (const g of G.grabs) {
    if (g.pts) { for (let u = g.u0; u <= g.u1; u += .02) { const q = at(g.pts, u), d = hyp(q.x - tip.x, q.y - tip.y); if (d < g.r && d < bd) { bd = d; best = { id: g.id, u }; } } }
    else { const d = hyp(g.x - tip.x, g.y - tip.y); if (d < g.r && d < bd) { bd = d; best = { id: g.id, u: .5 }; } }
  }
  if (best) { S.grasp = { id: best.id, u: best.u, stretch: 0, t: 0 }; Snd.tick(); }
  else { S.graspClosed = .25; const t = cur(); if (t.type === 'grasp') say(t.id === 'bladder' ? (G.bladA > .3 ? 'Close the jaws on the bladder peritoneum, just above its edge on the cervix.' : t.expose + '.') : 'Close the jaws on the tube itself, near the fimbriated end.', 'warn'); }
}
function needleClick(t) {
  if (t.type !== 'suture') { say('Nothing to suture yet.', 'warn'); return; }
  const cf = G.cuff, b = cf.bites[S.sut], tip = S.tipR, d = hyp(b.x - tip.x, b.y - tip.y);
  if (Math.abs(tip.x - cf.x) > cf.rx + 26 && Math.abs(tip.y - cf.y) < 80) { S.counts.near++; logEv('Suture bite aimed lateral to the cuff angle', 'warn'); say('Too lateral. The ureter runs just outside the cuff angle. Stay on the cuff.', 'warn'); flash(); return; }
  if (d > 30) { say(`This bite goes on the ${b.edge} cuff edge, 5 to 10 mm back from the cut edge.`, 'warn'); return; }
  if (d > 16) S.counts.sloppy++;
  S.sutPts.push({ x: tip.x, y: tip.y }); S.sut++; Snd.tick(); if (S.sut % 2 === 0) Snd.ok();
  if (S.sut >= 12) { logEv('Cuff closed with a running barbed suture', 'good'); advance(); }
}
function identifyClick(t) {
  const k = t.what.slice(-1), o = k === 'L' ? 'R' : 'L', p = S.ptr.inside ? S.ptr : (S.tool === 'grasper' ? S.tipL : S.tipR);
  if (polyDist(p.x, p.y, URE[k], 1, 30) < 24) { Snd.ok(); logEv(`${cap(SIDENAME[k])} ureter identified, peristalsis seen`, 'good'); say(`${cap(SIDENAME[k])} ureter. Peristalsis seen.`, 'good'); advance(); }
  else if (polyDist(p.x, p.y, URE[o], 1, 30) < 24) say(`That is the ${SIDENAME[o]} ureter. The patient’s ${SIDENAME[k]} is on the ${k === 'L' ? 'right' : 'left'} of the screen.`, 'warn');
  else say('Not the ureter. Look for a pale tube with a travelling wave, crossing the pelvic brim medial to the infundibulopelvic ligament.', 'warn');
}
function portClick() {
  const t = cur(); if (!t || t.type !== 'port' || S.busy > 0) return; Snd.init();
  const x = S.ptr.sx, y = S.ptr.sy, off = Math.abs(x - 500);
  if (t.site === 'umb') {
    if (hyp(x - EXT.umb.x, y - EXT.umb.y) < 36) { S.ports.umb = 1; S.ins.set = 15; logEv('Umbilical entry, insufflating', 'good'); say('Entry confirmed. Insufflating to 15 mmHg.', 'good'); Snd.ok(); S.busy = 3; S.after = advance; S.ui.dirty = true; }
    else say('The primary entry goes through the umbilicus.', 'warn'); return;
  }
  if (y < 230 || y > 870 || off > 280) return;
  if (t.site === 'lat') {
    const k = x > 500 ? 'L' : 'R', a = EXT['asis' + k], g = EXT['lat' + k];
    if (S.ports[k]) { say('That side already has a port.', 'warn'); return; }
    if (off > 62 && off < 138 && y > 420) { if (S.compSet.epigastric) say('Still over the inferior epigastric vessels. Move lateral.', 'warn'); else complication('epigastric'); return; }
    if (hyp(x - a.x, y - a.y) < 54) { S.counts.wrong++; say('Too close to the iliac spine. The ilioinguinal and iliohypogastric nerves run here.', 'warn'); return; }
    if (hyp(x - g.x, y - g.y) < 54) { S.ports[k] = { x, y }; Snd.ok(); logEv(`${cap(SIDENAME[k])} lower quadrant port placed`, 'good'); if (S.ports.L && S.ports.R) advance(); return; }
    say('Aim lateral to the epigastric vessels, about 2 cm medial and superior to the iliac spine.', 'warn'); return;
  }
  if (t.site === 'sp') {
    if (hyp(x - EXT.sp.x, y - EXT.sp.y) < 46) { S.ports.sp = { x, y }; Snd.ok(); logEv('Suprapubic port placed', 'good'); S.busy = 1; S.after = advance; }
    else if (off < 70 && y > 738) say('Too low. The bladder dome sits there even with a Foley in.', 'warn');
    else say('Suprapubic midline, a few centimetres above the symphysis.', 'warn');
  }
}
function doAction() {
  const t = cur(); if (!t || t.type !== 'action' || S.busy > 0) return; Snd.init(); Snd.ok();
  if (t.act === 'deliver') { S.anT.deliver = 1; S.grasp = null; S.busy = 2.5; S.after = advance; say('Specimen delivered through the vagina.', 'good'); S.ui.dirty = true; }
  else if (t.act === 'cysto') showCysto();
  else advance();
}
function setManip(d) {
  if (S.phase !== 'scope' || S.flags.specimenOut) return; const m = S.manip;
  if (d === 'l') m.tx = m.tx > .5 ? 0 : -1; else if (d === 'r') m.tx = m.tx < -.5 ? 0 : 1;
  else if (d === 'u') m.ty = m.ty > .5 ? REST.y : -1; else if (d === 'd') m.ty = m.ty < -.5 ? REST.y : 1;
  else { m.tx = REST.x; m.ty = REST.y; }
  S.ui.dirty = true;
}

/* ---------- per-frame logic ---------- */
function inciseTick(t, tip) {
  const pts = G.P[t.path], m = S.path[t.path]; if (!pts || !m) return false;
  const lt = S.lastTip || tip; let near = false, blocked = false, hit = false;
  for (let i = 0; i < pts.length; i++) { const q = pts[i], d = segDist(q.x, q.y, lt.x, lt.y, tip.x, tip.y); if (d < 34) near = true; if (d < 19 && !m[i]) { if (q.ok) hit = true; else blocked = true; } }
  if (hit && t.needGrasp && !(S.grasp && S.grasp.id === t.needGrasp)) { say('Put the bladder peritoneum on traction with the grasper first.', 'warn'); S.lastTip = { x: tip.x, y: tip.y }; return true; }
  if (hit) for (let i = 0; i < pts.length; i++) { const q = pts[i]; if (!m[i] && q.ok && segDist(q.x, q.y, lt.x, lt.y, tip.x, tip.y) < 19) m[i] = true; }
  S.lastTip = { x: tip.x, y: tip.y };
  if (blocked && !hit) say(t.expose + '.', 'warn');
  if (hit && m.every(Boolean)) advance();
  return near;
}
function energyTick(dt, t, tool) {
  const tip = S.tipR; S.energyT += dt; S.haze = Math.min(1, S.haze + dt * (tool === 'hook' ? .15 : .09));
  if (Math.random() < dt * 28) S.smoke.push({ x: tip.x + (Math.random() - .5) * 14, y: tip.y, vx: (Math.random() - .5) * 26, vy: -28 - Math.random() * 40, r: 11 + Math.random() * 13, a: .17, g: 24 });
  if (tool === 'sealer') for (const b of S.bleeders) {
    const T = G.T[b.id];
    if (T && hyp(T.x - tip.x, T.y - tip.y) < 34) {
      b.seal += dt / (b.id === 'ooze' ? 1 : 1.3);
      if (b.seal >= 1) { S.bleeders.splice(S.bleeders.indexOf(b), 1); S.seal[b.id] = 1; Snd.sealDone(); logEv('Hemostasis secured', 'good'); say('Hemostasis secured.', 'good'); const c = cur(); if (c.type === 'seal' && c.target === b.id) advance(); }
      return;
    }
  }
  let nearCur = false;
  if (t.type === 'seal' && tool === 'sealer' && !S.cut[t.target]) {
    const T = G.T[t.target] || { r: 0, ok: false, hint: '' }, d = G.T[t.target] ? hyp(T.x - tip.x, T.y - tip.y) : 1e9;
    if (d < T.r + 4) {
      if (!T.ok) { say(T.hint + '.', 'warn'); return; }
      const v = S.seal[t.target] = Math.min(1, (S.seal[t.target] || 0) + dt / (t.dur || 1.5));
      if (v >= 1) { Snd.sealDone(); advance(); }
      return;
    }
    nearCur = d < T.r + 36;
  }
  if (t.type === 'incise' && tool === 'hook' && inciseTick(t, tip)) return;
  const under = targetUnder(tip);
  if (under && !nearCur) {
    if ((S.seal[under] || 0) >= 1) return;
    if (tool === 'hook') { S.hookT += dt; if (S.hookT > .45) { say('Monopolar current divided an unsealed pedicle. Control the bleeding with the bipolar sealer.', 'crit', 4.6); bleedFrom(under); } return; }
    if (!S.seqWarn) { S.seqWarn = 1; say('That pedicle comes later. Finish the current step first.', 'warn'); }
    return;
  }
  const dz = dangerAt(tip.x, tip.y, nearCur);
  if (dz) {
    if (!dz.near) { complication(dz.type, dz.k); return; }
    if (!S.nearLogged) { S.nearLogged = true; S.counts.near++; logEv(`Energy within millimetres of the ${SIDENAME[dz.k]} ureter`, 'warn'); say(`Thermal spread reaches the ${SIDENAME[dz.k]} ureter from here. Move medial.`, 'warn'); flash(); }
  }
  if (nearCur) { if (!S.seqWarn) { S.seqWarn = 1; say('Close. Centre the jaws on the pedicle.', 'warn'); } return; }
  S.offT += dt; if (S.offT > .3 && !S.offCounted) { S.offCounted = true; S.counts.off++; logEv('Energy activated off target', 'warn'); }
  if (!S.lastChar || hyp(S.lastChar.x - tip.x, S.lastChar.y - tip.y) > 16) { S.lastChar = { x: tip.x, y: tip.y }; S.chars.push({ x: tip.x, y: tip.y, r: 5 + Math.random() * 4, a: .5, rot: Math.random() * 3 }); if (S.chars.length > 60) S.chars.shift(); }
}
function camTarget() {
  const t = cur(); let x = 500, y = 500, z = 1;
  if (S.phase !== 'scope' || !t) return { x, y, z };
  if (S.bleeders.length && G.T[S.bleeders[0].id] && t.target !== 'ooze') { const T = G.T[S.bleeders[0].id]; x = T.x; y = T.y; z = 1.4; }
  else if (t.type === 'seal' || t.type === 'cut') { const T = G.T[t.target]; if (T) { x = T.x; y = T.y; z = 1.5; } }
  else if (t.type === 'incise') { const pts = G.P[t.path]; if (pts) { let sx = 0, sy = 0; for (const p of pts) { sx += p.x; sy += p.y; } x = sx / pts.length; y = sy / pts.length; z = t.path === 'colpo' ? 1.6 : 1.5; } }
  else if (t.type === 'grasp') { const g = G.grabs.find(g => g.id === t.id); if (g) { const q = g.pts ? at(g.pts, .8) : g; x = q.x; y = q.y - 30; z = 1.35; } else { y = 520; z = 1.2; } }
  else if (t.type === 'identify') { const u = at(URE[t.what.slice(-1)], .3); x = lerp(500, u.x, .6); y = lerp(500, u.y, .8); z = 1.15; }
  else if (t.type === 'suture' && G.cuff) { x = G.cuff.x; y = G.cuff.y; z = 1.9; }
  else if (t.type === 'suction') { y = 660; z = 1.25; }
  else if (t.type === 'action' && G.out) { y = 560; z = 1.3; }
  else if (t.type === 'action' && t.act === 'deliver') { y = 540; z = 1.25; }
  return { x: lerp(500, x, .8), y: lerp(500, y, .8), z };
}
function update(dt) {
  S.t += dt;
  const running = S.phase === 'ext' || S.phase === 'scope';
  if (running) S.time += dt;
  if (S.busy > 0) { S.busy -= dt; if (S.busy <= 0) { S.busy = 0; const f = S.after; S.after = null; if (f) f(); S.ui.dirty = true; } }
  if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 1.5);
  const m = S.manip;
  if (S.phase === 'brief') { m.tx = Math.sin(S.t * .23) * .6; m.ty = -.25 + Math.sin(S.t * .16 + 1) * .32; }
  const km = 1 - Math.exp(-dt * 3.4); m.x += (m.tx - m.x) * km; m.y += (m.ty - m.y) * km;
  for (const k in S.anT) { const d = S.anT[k] - S.an[k]; if (Math.abs(d) < .003) S.an[k] = S.anT[k]; else S.an[k] += d * (1 - Math.exp(-dt * (k === 'deliver' ? 1.7 : 2.6))); }
  for (const k in S.cutA) if (S.cutA[k] < 1) S.cutA[k] = Math.min(1, S.cutA[k] + dt * 2.6);
  G = buildGeo();
  /* camera */
  const c = S.cam, tg = camTarget(), z = clamp(tg.z + c.uz, 1, 2.6), kc = 1 - Math.exp(-dt * 2.2);
  c.z += (z - c.z) * kc; c.x += (tg.x - c.x) * kc; c.y += (tg.y - c.y) * kc;
  const hw = 500 / c.z; c.x = clamp(c.x, hw, 1000 - hw); c.y = clamp(c.y, hw, 1000 - hw); c.br = Math.sin(S.t * 1.26) * 1.5;
  if (S.phase === 'scope') {
    /* instruments follow the pointer */
    const p = S.ptr, w = s2w(p.sx, p.sy); p.x = w.x; p.y = w.y;
    const act = S.tool === 'grasper' ? S.tipL : S.tipR, kt = 1 - Math.exp(-dt * 24);
    if (p.inside) { const ox = S.tool === 'grasper' && S.lOff ? S.lOff.x : 0, oy = S.tool === 'grasper' && S.lOff ? S.lOff.y : 0; act.x += (w.x + ox - act.x) * kt; act.y += (w.y + oy - act.y) * kt; }
    const gr = S.grasp;
    if (gr) {
      gr.t += dt; const k = gr.id.slice(-1), free = gr.id === 'bladder' || S.anT['tubeFree' + k] === 1;
      if (!free && gr.stretch > 122 && !gr.warned) { gr.warned = true; say('Too much traction. Ease off before the tube tears.', 'warn'); }
      if (!free && gr.stretch > 158) { S.grasp = null; S.lOff = null; complication('tear', k); const id = ['ms' + k + '2', 'ms' + k + '3', 'ms' + k + '1'].find(i => !S.cut[i]); if (id) S.bleeders.push({ id, rate: BLEED.tear, vol: 0, seal: 0, dir: k === 'L' ? 1 : -1 }); }
    }
    if (S.graspClosed > 0) S.graspClosed -= dt;
    const kj = 1 - Math.exp(-dt * 20);
    S.jawL += ((S.grasp || S.graspClosed > 0 ? 0 : 1) - S.jawL) * kj;
    S.jawR += (((S.energy && S.rtool === 'sealer') ? 0 : 1) - S.jawR) * kj;
    /* energy, suction */
    const t = cur(), tool = S.tool, en = S.energy && !S.injuryLock && S.busy <= 0 && (tool === 'sealer' || tool === 'hook');
    Snd.hold('seal', en && tool === 'sealer'); Snd.hold('cut', en && tool === 'hook'); Snd.hold('suction', S.suction);
    if (en && t) energyTick(dt, t, tool);
    if (S.suction) {
      const tip = S.tipR, cu = G.cul, rx = 34 + Math.sqrt(Math.max(S.pool, 1)) * 9.5;
      if (hyp(tip.x - cu.x, (tip.y - cu.y) * 2) < rx + 26) { S.pool = Math.max(0, S.pool - dt * 34); if (S.pool < 6) S.poolDil = 0; }
      for (const b of S.bleeders) { const T = G.T[b.id]; if (T && hyp(T.x - tip.x, T.y - tip.y) < 50) b.vol = Math.max(0, b.vol - dt * 30); }
    }
    S.haze = Math.max(0, S.haze - dt * (S.suction ? .5 : .085));
    /* tasks that complete on a held state */
    if (t && S.busy <= 0) {
      if (t.type === 'grasp') {
        if (gr && S.grasp && gr.id === t.id && gr.stretch >= 30 && gr.stretch <= 125) { S.graspHold += dt; if (S.graspHold > .35) { Snd.ok(); logEv(t.id === 'bladder' ? 'Bladder peritoneum on traction' : 'Tube on traction', 'good'); say('Good traction. The grasper holds while your right hand works.', 'good'); advance(); const n = cur(); selectTool(S.mode === 'guided' && n && NEED[n.type] && NEED[n.type] !== 'grasper' ? NEED[n.type] : S.rtool); } }
        else S.graspHold = 0;
      } else if (t.type === 'suction' && S.pool < 2) { S.pool = 0; logEv('Pelvis irrigated and clear', 'good'); advance(); }
    }
  } else { Snd.hold('seal', false); Snd.hold('cut', false); Snd.hold('suction', false); }
  /* particles */
  for (let i = S.smoke.length - 1; i >= 0; i--) { const p = S.smoke[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.g * dt; p.a -= dt * .075; if (p.a <= 0) S.smoke.splice(i, 1); }
  for (let i = S.drops.length - 1; i >= 0; i--) { const p = S.drops[i]; p.vy += 320 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.a = Math.min(p.a, p.life * 1.4); if (p.life <= 0) S.drops.splice(i, 1); }
  for (const b of S.bleeders) {
    const T = G.T[b.id]; b.vol += b.rate * dt; S.ebl += b.rate * dt; S.pool = Math.min(260, S.pool + b.rate * dt * .55); S.poolDil = Math.max(0, S.poolDil - dt * .05 * b.rate);
    if (T && Math.random() < dt * (4 + b.rate * 3)) S.drops.push({ x: T.x + (Math.random() - .5) * 8, y: T.y, vx: b.dir * (10 + Math.random() * 50) * (b.rate > 3 ? 1.6 : .5), vy: -20 - Math.random() * 60 * (b.rate > 3 ? 1.5 : .4), r: 2.2 + Math.random() * 2, a: .9, life: .9 });
  }
  /* insufflator and vitals */
  const ins = S.ins, tgtP = ins.leak ? Math.min(ins.set, 5.5) : ins.set, dp = tgtP - ins.p; ins.p += clamp(dp, -dt * 8, dt * 5.4);
  const wantFlow = ins.set <= 0 ? 0 : (ins.leak ? 32 : Math.abs(ins.set - ins.p) > .5 && ins.set > ins.p ? 20 : 1.3 + S.haze * 2.5 + .4 * Math.sin(S.t * .7));
  ins.flow += (wantFlow - ins.flow) * (1 - Math.exp(-dt * 3)); if (running) ins.vol += ins.flow * dt / 60;
  const v = S.vit, e = S.ebl, pn = clamp(ins.p / 15, 0, 1);
  v.hr += (72 + pn * 4 + Math.min(64, e / 15) - v.hr) * Math.min(1, dt * .5); v.sys += (118 + pn * 6 - Math.min(54, e / 14) - v.sys) * Math.min(1, dt * .4); v.dia = v.sys * .6 + 2; v.co2 += (34 + pn * 4.5 - v.co2) * Math.min(1, dt * .2); v.spo2 = e > 700 ? 97 : 99;
  S.beat += dt * v.hr / 60; if (S.beat >= 1) { S.beat -= 1; if (running) Snd.pulse(v.spo2); }
  if (S.phase === 'scope' && S.ebl > 1100 && !S.compSet.hemo) { S.compSet.hemo = 1; logEv('Hemodynamic instability from blood loss', 'crit'); say('Blood loss is over a litre and the patient is unstable. Converting to laparotomy.', 'crit', 5); S.busy = 1.5; S.after = () => endCase('convert'); }
}
function requirements() {
  const t = cur(), out = []; if (!t || S.phase !== 'scope') return out;
  if (S.bleeders.length && t.target !== 'ooze') out.push({ label: 'Active bleeding. Hold the bipolar sealer on it until the tone', ok: false, alarm: true });
  const need = NEED[t.type];
  if (need) out.push({ label: `${TOOLS[need].name} (key ${TOOLS[need].key})`, ok: S.tool === need, tool: need });
  if (t.type === 'seal') { const T = G.T[t.target]; if (T && T.hint) out.push({ label: T.hint, ok: T.ok, manip: 1 }); }
  if (t.type === 'incise') {
    const pts = G.P[t.path], m = S.path[t.path]; let any = false, left = false;
    if (pts && m) for (let i = 0; i < pts.length; i++) if (!m[i]) { left = true; if (pts[i].ok) any = true; }
    if (t.expose) out.push({ label: t.expose, ok: any || !left, manip: 1 });
    if (t.needGrasp) out.push({ label: 'Bladder peritoneum on traction with the grasper', ok: !!(S.grasp && S.grasp.id === t.needGrasp) });
  }
  if (t.type === 'grasp' && t.expose) out.push({ label: t.expose, ok: G.bladA > .3, manip: 1 });
  return out;
}
function progress() {
  const t = cur(); if (!t) return null;
  if (t.type === 'seal') { const b = S.bleeders.find(b => b.id === t.target); return b ? b.seal : (S.seal[t.target] || 0); }
  if (t.type === 'incise') return pathFrac(t.path);
  if (t.type === 'suture') return S.sut / 12;
  if (t.type === 'suction') return 1 - clamp(S.pool / 70, 0, 1);
  if (t.type === 'port' && t.site === 'umb' && S.ports.umb) return S.ins.p / 15;
  return null;
}
function score() {
  const c = S.counts; let comp = 0; for (const k of S.comps) comp += COMP[k.type].sev;
  const dom = {
    'Energy safety': 100 - c.near * 14 - c.off * 5 - S.comps.filter(k => ['ureter', 'bladder', 'bowel', 'iliac', 'ovary'].includes(k.type)).reduce((a, k) => a + COMP[k.type].sev * 1.6, 0),
    'Hemostasis': 100 - clamp((S.ebl - 60) / 6, 0, 70) - S.comps.filter(k => k.type === 'bleed' || k.type === 'iliac').length * 15,
    'Tissue handling': 100 - S.comps.filter(k => k.type === 'tear').length * 25 - c.sloppy * 6 - S.comps.filter(k => k.type === 'epigastric').length * 20,
    'Instrument choice': 100 - c.wrong * 9
  };
  for (const k in dom) dom[k] = Math.round(clamp(dom[k], 0, 100));
  let s = 100 - comp - Math.min(12, c.near * 4) - Math.min(8, c.wrong * 1.5) - Math.min(10, c.off * 1.5) - Math.min(6, c.sloppy) - clamp((S.ebl - 100) / 40, 0, 15);
  if (S.outcome === 'convert') s = Math.min(s, 30);
  return { total: Math.max(0, Math.round(s)), dom };
}
