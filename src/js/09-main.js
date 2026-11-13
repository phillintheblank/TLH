// ---------- input wiring, main loop, start-up ----------
function wire() {
  const pos = e => { const r = OV.getBoundingClientRect(); INP.x = e.clientX - r.left; INP.y = e.clientY - r.top; INP.ndc.set((INP.x / r.width) * 2 - 1, -((INP.y / r.height) * 2 - 1)); INP.inside = true; };
  // Free depth: the mouse steers by its travel, not its position, so the cursor is locked to the picture while
  // operating. Esc frees it. Where a browser will not lock the cursor, travel over the picture is used instead.
  const freeOn = () => CTRL.mode === 'mouse' && freeDepth() && S.running && !S.ended;
  const lockReq = () => {
    if (!OV.requestPointerLock) { INP.noLock = true; return; }
    try { const p = OV.requestPointerLock(); if (p && p.catch) p.catch(() => { INP.noLock = true; }); } catch (_) { INP.noLock = true; }
  };
  const up = () => { if (INP.down) { INP.down = false; if (CTRL.mode === 'mouse') primaryUp(activeHand()); } };
  document.addEventListener('pointerlockchange', () => { INP.lock = document.pointerLockElement === OV; if (!INP.lock) up(); });
  document.addEventListener('pointerlockerror', () => { INP.noLock = true; });
  OV.addEventListener('pointermove', e => {
    pos(e);
    if (freeOn() && (INP.lock || INP.noLock)) { const c = activeHand().cmd; c.dx += e.movementX || 0; c.dy += e.movementY || 0; }
  });
  OV.addEventListener('pointerdown', e => {
    pos(e);
    if (CTRL.mode !== 'mouse') return; // with hand control on, the mouse only works the panels
    const h = activeHand();
    if (freeDepth()) {
      if (freeOn() && !INP.lock && !INP.noLock) { lockReq(); return; } // the first click takes the instruments; it does not fire them
      freePick(h, 0);
    } else { routeMouse(); doPick(h); snapPick(h); }
    if (e.button === 2) { cutAction(); return; }
    if (e.button !== 0) return;
    try { OV.setPointerCapture(e.pointerId); } catch (_) {}
    INP.down = true; primaryDown(h);
  });
  OV.addEventListener('pointerup', up); OV.addEventListener('pointercancel', up);
  OV.addEventListener('pointerleave', () => { INP.inside = false; if (!INP.lock) up(); });
  OV.addEventListener('contextmenu', e => e.preventDefault());
  OV.addEventListener('wheel', e => {
    e.preventDefault();
    if (freeOn()) { // the wheel slides the instrument along its shaft: a slow turn for fine control, a fast spin for travel
      const d = e.deltaY * (e.deltaMode === 1 ? 30 : 1), step = Math.pow(Math.min(1, Math.abs(d) / 60), 0.6) * 0.34 * DEPTH.wheel;
      activeHand().cmd.dz += (d < 0 ? 1 : -1) * (DEPTH.flip ? -1 : 1) * step;
    } else if (CTRL.mode !== 'mouse' || !freeDepth()) CAM.userIns = clamp(CAM.userIns - e.deltaY * 0.006, -5, 6);
  }, { passive: false });
  wire.freeTick = () => { if (INP.lock && !freeOn() && document.exitPointerLock) document.exitPointerLock(); };
  // mouse settings
  // On a Mac the system default ("natural" scrolling) reverses the wheel, so start reversed there: wheel forward should push in.
  DEPTH.flip = /Mac/i.test(navigator.platform || navigator.userAgent || '');
  try { const d = JSON.parse(localStorage.getItem(DKEY) || 'null'); if (d) { DEPTH.auto = !!d.auto; DEPTH.fulcrum = !!d.fulcrum; DEPTH.flip = !!d.flip; if (d.wheel > 0.2 && d.wheel < 4) DEPTH.wheel = d.wheel; } } catch (_) {}
  const saveD = () => { try { localStorage.setItem(DKEY, JSON.stringify({ auto: DEPTH.auto, fulcrum: DEPTH.fulcrum, flip: DEPTH.flip, wheel: DEPTH.wheel })); } catch (_) {} };
  const dtog = (id, key) => { const b = $(id), sync = () => { b.classList.toggle('on', DEPTH[key]); b.setAttribute('aria-pressed', DEPTH[key] ? 'true' : 'false'); }; b.addEventListener('click', () => { DEPTH[key] = !DEPTH[key]; sync(); saveD(); uiDirty(); }); sync(); };
  dtog('btnAuto', 'auto'); dtog('btnFulcrum', 'fulcrum'); dtog('btnFlip', 'flip');
  $('mWheel').value = Math.round(DEPTH.wheel * 100);
  $('mWheel').addEventListener('input', e => { DEPTH.wheel = e.target.value / 100; saveD(); });
  $('handL').addEventListener('click', () => setActive('L')); $('handR').addEventListener('click', () => setActive('R'));
  $('btnCut').addEventListener('click', () => cutAction());
  $('btnSwitch').addEventListener('click', () => setActive(ACTIVE === 'L' ? 'R' : 'L'));
  $('btnBegin').addEventListener('click', () => startCase(false)); $('btnBeginHands').addEventListener('click', () => startCase(true));
  const toStart = () => { resetWorld(false); $('startCard').hidden = false; };
  $('btnRestart').addEventListener('click', toStart); $('dbRestart').addEventListener('click', toStart);
  $('dbClose').addEventListener('click', () => { $('debrief').hidden = true; });
  const tog = (id, get, set) => { const b = $(id); const sync = () => { b.classList.toggle('on', get()); b.setAttribute('aria-pressed', get() ? 'true' : 'false'); }; b.addEventListener('click', () => { set(!get()); sync(); uiDirty(); }); sync(); return sync; };
  const syncG = tog('btnGuide', () => S.guided, v => (S.guided = v)), syncL = tog('btnLabels', () => S.labels, v => (S.labels = v)), syncS = tog('btnSound', () => AU.on, v => { AU.on = v; if (!v) stopSustain(); });
  $('btnExpo').addEventListener('click', () => { const r = STEPS[S.step].rec; if (r) setPoseGoal(r); });
  $('stepBtn1').addEventListener('click', () => { const b = STEPS[S.step].button; if (b && S.running) b.fn(); });
  $('stepBtn2').addEventListener('click', () => { const b = STEPS[S.step].button2; if (b && S.running) b.fn(); });
  // a mouse click on a control must not leave it focused, or Space would re-fire it instead of switching hands
  document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('button')) e.preventDefault(); });
  // manipulator pad
  const pad = $('pad'); let padOn = false;
  const padSet = e => {
    const r = pad.getBoundingClientRect(), nx = clamp(((e.clientX - r.left) / r.width - 0.5) / 0.42, -1, 1), ny = clamp(((e.clientY - r.top) / r.height - 0.5) / 0.42, -1, 1), t = (1 - ny) / 2;
    setPoseGoal({ yaw: nx * LIM.yaw, pitch: t < 0.5 ? lerp(LIM.pMin, PITCH0, t * 2) : lerp(PITCH0, LIM.pMax, (t - 0.5) * 2) });
  };
  pad.addEventListener('pointerdown', e => { padOn = true; try { pad.setPointerCapture(e.pointerId); } catch (_) {} padSet(e); });
  pad.addEventListener('pointermove', e => { if (padOn) padSet(e); });
  pad.addEventListener('pointerup', () => (padOn = false)); pad.addEventListener('pointercancel', () => (padOn = false));
  $('push').addEventListener('input', e => setPoseGoal({ push: e.target.value / 100 }));
  document.querySelectorAll('[data-pose]').forEach(b => b.addEventListener('click', () => setPoseGoal(JSON.parse(b.getAttribute('data-pose')))));
  // keyboard
  const held = {};
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '=', '+', '-', '_'].includes(k)) { held[k] = true; if (k.startsWith('arrow') && S.running) e.preventDefault(); return; }
    if (!S.running) return;
    if (k >= '1' && k <= '5') { const t = Object.keys(INST)[+k - 1]; setInst(ACTIVE, t); }
    else if (k === ' ' || k === 'x') { if (e.target && /^(BUTTON|INPUT)$/.test(e.target.tagName) && k === ' ') return; e.preventDefault(); setActive(ACTIVE === 'L' ? 'R' : 'L'); }
    else if (k === 'c') cutAction();
    else if (k === 'l') { S.labels = !S.labels; syncL(); }
    else if (k === 'g') { S.guided = !S.guided; syncG(); uiDirty(); }
    else if (k === 'm') { AU.on = !AU.on; if (!AU.on) stopSustain(); syncS(); }
  });
  window.addEventListener('keyup', e => { held[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
  wire.keys = dt => {
    if (!S.running) return;
    const G = S.poseGoal, r = 0.9 * dt;
    if (held.a) setPoseGoal({ yaw: G.yaw - r }); if (held.d) setPoseGoal({ yaw: G.yaw + r });
    if (held.w) setPoseGoal({ pitch: G.pitch + r * 1.2 }); if (held.s) setPoseGoal({ pitch: G.pitch - r * 1.2 });
    if (held.e) setPoseGoal({ push: G.push + r * 1.4 }); if (held.q) setPoseGoal({ push: G.push - r * 1.4 });
    const pr = 5 * dt;
    if (held.arrowleft) CAM.pan.x = clamp(CAM.pan.x - pr, -5, 5); if (held.arrowright) CAM.pan.x = clamp(CAM.pan.x + pr, -5, 5);
    if (held.arrowup) CAM.pan.y = clamp(CAM.pan.y + pr, -4, 4); if (held.arrowdown) CAM.pan.y = clamp(CAM.pan.y - pr, -4, 4);
    if (held['='] || held['+']) CAM.userIns = clamp(CAM.userIns + 6 * dt, -5, 6); if (held['-'] || held['_']) CAM.userIns = clamp(CAM.userIns - 6 * dt, -5, 6);
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(VIEW); else window.addEventListener('resize', resize);
}

let lastNow = performance.now(), simTime = 0;
function tick(dt) {
  simTime += dt;
  wire.keys(dt);
  updateAnatomy(dt, simTime);
  updateCamera(dt, simTime);
  scene.updateMatrixWorld();
  const hm = CTRL.mode === 'hands';
  if (hm) htPointers(dt); else routeMouse();
  const free = freeDepth(), live = S.running && !S.ended;
  for (const h of HANDS) {
    if (!free) { doPick(h); snapPick(h); continue; }
    if (live && (hm ? HT.slot[h.key].engaged : h.key === ACTIVE)) freeDrive(h); else { h.cmd.dx = h.cmd.dy = h.cmd.dz = h.cmd.dv = 0; h.cmd.cart = false; }
    freePick(h, dt);
  }
  wire.freeTick();
  if (hm) htActions(dt);
  updateHands(dt);
  if (S.running) { actionTick(dt); updateSteps(dt); }
  updateFX(dt, simTime); updateSuture();
}
function frame(now) {
  const raw = (now - lastNow) / 1000, dt = Math.min(0.05, Math.max(0.001, raw)); lastNow = now;
  requestAnimationFrame(frame);
  if (window.__simPause) return; // automated checks drive tick() and render() themselves
  tick(dt);
  renderFrame(dt, simTime, S.haze); qualityTick(raw);
  drawOverlay(simTime); renderUI(dt); htRenderUI(dt, simTime);
}
S = freshState();
buildStatic(); wire(); htWire();
// everything lit throws and takes shadows from the scope light, except flat marks painted on a surface and the blood pool
scene.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = o !== POOL; o.receiveShadow = true; if (o.material.userData.depth) o.customDepthMaterial = o.material.userData.depth; } });
(function () {
  let q = null;
  try { q = new URLSearchParams(location.search).get('q') || localStorage.getItem(QKEY); } catch (e) {}
  setQuality(q || 'auto', false);
  $('selQ').addEventListener('change', e => { setQuality(e.target.value, true); e.target.blur(); });
})();
resetWorld(false);
window.__simBooted = performance.now(); $('nogl').hidden = true;
requestAnimationFrame(frame);

// ---------- hooks for automated checks ----------
function forceStep() {
  const st = STEPS[S.step], k = st.side, sd = k && S.side[k];
  if (st.id === 'survey') S.ureterID.R = S.ureterID.L = true;
  else if (st.seal && st.kind !== 'meso') { const e = sd[st.ent]; e.seals.push({ u: st.uT, w: SEALSPEC[st.ent].w }); e.cut = true; e.uc = st.uT; if (st.ent === 'uo') sd.roofCut = true; if (st.ent === 'ua' || st.ent === 'card') startRelease(AN.side[k], st.ent); }
  else if (st.kind === 'meso') { S.mesoBite[k] = 2; sd.meso.pGoal = 1; sd.tubeGoal = 1; }
  else if (st.which === 'ant') sd.antGoal = 1;
  else if (st.which === 'post') { sd.postGoal = 1; startRelease(AN.side[k], 'upper'); }
  else if (st.id === 'vuf') S.vufGoal = 1;
  else if (st.id === 'flap') { st.cnt = 6; S.flapGoal = 1; }
  else if (st.id === 'colp') { S.colp.fill(1); S.colpDone = true; VG.dirty = true; }
  else if (st.id === 'deliver') deliverSpecimen();
  else if (st.id === 'cuff') { for (const x of [1.5, 0.9, 0.3, -0.3, -0.9, -1.5]) S.cuff.stitches.push({ x, da: 0.8, dp: 0.8 }); S.cuff.frontGoal = -2.8; S.cuff.done = true; }
  else if (st.id === 'final') { S.lowP = true; S.ureterOK.R = S.ureterOK.L = true; endCase(); }
}
// A synthetic hand for tests: a fixed 3-D hand shape (wl, metres) drawn into camera o.cam's picture at (x, y) with
// its palm `size` picture-heights long. opn spreads the fingers, ap parts the thumb from the fingertips, and gz is the
// share of that gap lying along the camera's line of sight (0: the camera sees the grip side-on, clearly).
function fakeHand(o) {
  const lm = [], wl = [], P = 0.095, a = HT.cams[o.cam || 0].aspect, sz = o.size || 0.2, gz = o.gz || 0;
  for (let i = 0; i < 21; i++) wl.push({ x: 0, y: 0, z: 0 });
  wl[1] = { x: -0.03, y: -0.02, z: 0 };
  [[5, 8, -0.3], [9, 12, 0], [13, 16, 0.25], [17, 20, 0.5]].forEach(([m, t, an]) => { const dx = Math.sin(an), dy = -Math.cos(an); wl[m] = { x: dx * P, y: dy * P, z: 0 }; wl[t] = { x: dx * P * o.opn, y: dy * P * o.opn, z: 0 }; for (const q of [1, 2]) wl[m + q] = { x: lerp(wl[m].x, wl[t].x, q / 3), y: lerp(wl[m].y, wl[t].y, q / 3), z: 0 }; });
  wl[4] = { x: wl[8].x - o.ap * P * Math.sqrt(1 - gz * gz), y: wl[8].y, z: o.ap * P * gz };
  for (const q of [1, 2]) wl[1 + q] = { x: lerp(wl[1].x, wl[4].x, q / 3), y: lerp(wl[1].y, wl[4].y, q / 3), z: lerp(0, wl[4].z, q / 3) };
  const cx = (wl[0].x + wl[5].x + wl[17].x) / 3, cy = (wl[0].y + wl[5].y + wl[17].y) / 3, k = sz / P;
  for (let i = 0; i < 21; i++) lm.push({ x: o.x + ((wl[i].x - cx) * k) / a, y: o.y + (wl[i].y - cy) * k, z: (wl[i].z * k) / a });
  return { lm, wl };
}
window.__sim = {
  forceStep, visibleAt, colpPt, SEALSPEC, URETER, VG, UT, BL, HT, HANDS, CTRL, fakeHand, htIngest, htEnable, htDisable, calibFinish, calBuild, camFillPickers,
  get S() { return S; }, STEPS, HAND, CAM, AN, INP, tick, setPoseGoal, setInst, setActive, cutAction, startCase,
  get active() { return ACTIVE; }, get PICK() { return activeHand().pick; },
  next() { const st = STEPS[S.step]; if (S.bleeders.length) { const p = S.bleeders[0].pt(new V3()); project(p, _ps); return { act: 'bleed', x: _ps.x, y: _ps.y, p: p.toArray(), want: { spot: 0.35, avoid: ['ureter', 'iliac', 'rectum', 'bladder'] } }; } const n = st.next && st.next(); if (!n) return null; project(n.p, _ps); const um = /(right|left) ureter/.exec(n.label || ''), want = st.seal ? { ents: st.seal.ent === 'meso' ? ['meso', 'tube'] : [st.seal.ent], side: st.seal.side } : um ? { ents: ['ureter'], side: um[1] === 'right' ? 'R' : 'L' } : n.act === 'bite' ? { cuff: { edge: S.cuff.pending ? 'post' : 'ant', x: S.cuff.pending ? S.cuff.pending.x : st.nextX() } } : null; return { act: n.act, label: n.label, x: _ps.x, y: _ps.y, z: _ps.z, hidden: !!n.hidden, vis: visibleAt(n.p, 0.8), p: n.p.toArray(), want }; },
  proj(p) { project(new V3(p[0], p[1], p[2]), _ps); return { x: _ps.x, y: _ps.y }; },
  cuffAt(p) { const lp = new V3(p[0], p[1], p[2]).applyMatrix4(new THREE.Matrix4().copy(VG.M).invert()); return { x: lp.x, edge: lp.z < 0 ? 'ant' : 'post', depth: Math.max(0, -lp.y) }; }, // where on the vaginal cuff a point lies, as the bite check sees it
  render(dt) { renderFrame(dt == null ? 0.5 : dt, simTime, S.haze); drawOverlay(simTime); renderUI(1); htRenderUI(1, simTime); },
  setQuality, QUAL, GRADE, LIGHT, MAT, POST, head, scene, camera, renderer, THREE,
  DEPTH, DENT, freeDepth, freePick, poseFromPoint, primaryDown, primaryUp, nearTarget, PICKS, shown
};
