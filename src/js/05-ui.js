// ---------- UI, overlay, main loop ----------
const OV = $('ov'), RAY2 = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _pv = new V3(), _ps = { x: 0, y: 0, z: 0 };
let UI_DIRTY = true, UI_FULL = true, uiClock = 0;
function uiDirty(full) { UI_DIRTY = true; if (full) UI_FULL = true; }
function project(p, o) { _pv.copy(p).project(camera); o.x = ((_pv.x + 1) / 2) * VW; o.y = ((1 - _pv.y) / 2) * VH; o.z = _pv.z; return o; }
function visibleAt(p, tol) {
  _pv.copy(p).project(camera);
  if (_pv.z > 1 || Math.abs(_pv.x) > 0.98 || Math.abs(_pv.y) > 0.98) return false;
  _ndc.set(_pv.x, _pv.y); RAY2.setFromCamera(_ndc, camera);
  const hits = RAY2.intersectObjects(PICKS, false), d = camera.position.distanceTo(p);
  for (let i = 0; i < hits.length; i++) if (shown(hits[i].object)) return hits[i].distance > d - (tol || 0.5);
  return true;
}
const ENT_NAME = {
  uterus: () => 'Uterus', round: k => CAP[k] + ' round ligament', tube: k => CAP[k] + ' fallopian tube', uo: k => CAP[k] + ' utero-ovarian ligament',
  ip: k => CAP[k] + ' infundibulopelvic ligament', ovary: k => CAP[k] + ' ovary', ua: k => CAP[k] + ' uterine vessels', card: k => CAP[k] + ' cardinal ligament',
  usl: k => CAP[k] + ' uterosacral ligament', ureter: k => CAP[k] + ' ureter', iliac: k => CAP[k] + ' external iliac vessels', bladder: () => 'Bladder',
  rectum: () => 'Rectosigmoid', ant: k => 'Broad ligament, anterior leaf', roof: k => 'Broad ligament', post: k => 'Broad ligament, posterior leaf',
  meso: k => CAP[k] + ' mesosalpinx', areolar: () => 'Areolar tissue', vuf: () => 'Vesicouterine peritoneum', vagina: () => (S.specimen === 'out' ? 'Vaginal cuff' : 'Vagina over the cup')
};
const LABELS = [
  ['Uterus', () => _w.set(0, 7.6, 0).applyMatrix4(UT.M), () => S.specimen !== 'out'],
  ['Bladder', () => _w.set(BL.c.x, BL.c.y + BL.r.y * 0.9, BL.c.z + 1.0)],
  ['Rectosigmoid', () => { sampleArr(AN.rectumArr, 0.42, _w); _w.y += 1.5; return _w; }],
  ['Vaginal cuff', () => _w.set(0, 0.1, 0).applyMatrix4(VG.M), () => S.specimen === 'out']
];
for (const k of ['R', 'L']) {
  const G = () => { const r = S.side[k].rel.upper; return r ? r.lat : curG(k); };
  LABELS.push(
    [CAP[k] + ' round lig.', () => sampleArr(G().round, 0.72, _w)], [CAP[k] + ' tube', () => sampleArr(curG(k).tubeCur, 0.5, _w), () => S.specimen !== 'out'],
    [CAP[k] + ' ovary', () => _w.copy(G().ovC)], [CAP[k] + ' IP lig.', () => sampleArr(G().ridge, 0.8, _w)],
    [CAP[k] + ' ureter', () => ureterMarker(k)], [CAP[k] + ' ext. iliac vessels', () => sampleArr(AN['iliac' + k].aA, 0.55, _w)],
    [CAP[k] + ' uterosacral lig.', () => sampleArr(AN.side[k].uslArr, 0.5, _w)], [CAP[k] + ' uterine vessels', () => sampleArr(curG(k).ua, 0.3, _w), () => !S.side[k].ua.cut]
  );
}
let labelVis = [], labelT = 0;
function pill(c, x, y, text, col, bg) {
  c.font = '500 12px "IBM Plex Sans", system-ui, sans-serif';
  const w = c.measureText(text).width + 14, h = 20, r = 6;
  x = clamp(x, 4, VW - w - 4); y = clamp(y, 4, VH - h - 4);
  c.fillStyle = bg || 'rgba(8,12,15,0.78)'; c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.fill();
  c.fillStyle = col || '#dfe8ec'; c.textBaseline = 'middle'; c.fillText(text, x + 7, y + h / 2 + 0.5);
}
const ACT_COL = { seal: '#f0b24a', cut: '#ffffff', trace: '#43c6c0', push: '#43c6c0', click: '#43c6c0', bite: '#b79cf0', suction: '#43c6c0' };
function drawOverlay(time) {
  const c = OV.getContext('2d'), pr = OV.width / VW;
  c.setTransform(pr, 0, 0, pr, 0, 0); c.clearRect(0, 0, VW, VH);
  if (INP.inside) { c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.2; c.beginPath(); c.arc(INP.x, INP.y, 5, 0, TAU); c.stroke(); }
  if (!S.running) return;
  const st = STEPS[S.step], pulseR = 1 + 0.12 * Math.sin(time * 5);
  if (S.guided) {
    if (S.bleeders.length) {
      for (const b of S.bleeders) {
        project(b.pt(_w), _ps);
        c.strokeStyle = '#ef5a56'; c.lineWidth = 2.5; c.beginPath(); c.arc(_ps.x, _ps.y, 17 * pulseR, 0, TAU); c.stroke();
        if (b.seal > 0) { c.beginPath(); c.arc(_ps.x, _ps.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * b.seal); c.stroke(); }
        pill(c, _ps.x + 22, _ps.y - 28, 'Bleeding: hold bipolar here', '#ffd9d7', 'rgba(90,10,10,0.85)');
      }
    } else {
      if (st.path) {
        const pts = st.path();
        if (pts.length > 1) { c.setLineDash([5, 6]); c.strokeStyle = 'rgba(67,198,192,0.85)'; c.lineWidth = 2; c.beginPath(); pts.forEach((p, i) => { project(p, _ps); i ? c.lineTo(_ps.x, _ps.y) : c.moveTo(_ps.x, _ps.y); }); c.stroke(); c.setLineDash([]); }
      }
      const n = st.next && st.next();
      if (st.dots) for (const d of st.dots()) {
        project(d.p, _ps); c.beginPath(); c.arc(_ps.x, _ps.y, d.done ? 3 : 4.5, 0, TAU);
        if (d.done) { c.fillStyle = 'rgba(95,207,142,0.9)'; c.fill(); } else if (d.vis) { c.strokeStyle = 'rgba(67,198,192,0.95)'; c.lineWidth = 2; c.stroke(); } else { c.strokeStyle = 'rgba(160,175,185,0.35)'; c.lineWidth = 1.5; c.stroke(); }
      }
      if (n && n.act !== 'button') {
        project(n.p, _ps);
        const col = n.hidden ? 'rgba(170,185,195,0.8)' : ACT_COL[n.act] || '#43c6c0';
        if (_ps.z < 1) {
          const x = clamp(_ps.x, 20, VW - 20), y = clamp(_ps.y, 20, VH - 20);
          c.strokeStyle = col; c.lineWidth = 2.5; if (n.hidden) c.setLineDash([4, 5]);
          c.beginPath(); c.arc(x, y, 16 * pulseR, 0, TAU); c.stroke(); c.setLineDash([]);
          if (n.prog > 0) { c.lineWidth = 4; c.beginPath(); c.arc(x, y, 23, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(n.prog, 0, 1)); c.stroke(); }
          pill(c, x + 24, y - 30, n.label, n.hidden ? '#c5d0d6' : '#0b1014', n.hidden ? 'rgba(8,12,15,0.78)' : col);
        }
      }
    }
  }
  if (S.labels) {
    if (time > labelT) { labelT = time + 0.3; labelVis = LABELS.map(l => (!l[2] || l[2]()) && visibleAt(l[1](), 0.7)); }
    LABELS.forEach((l, i) => {
      if (!labelVis[i]) return; project(l[1](), _ps);
      const dx = _ps.x < VW / 2 ? -1 : 1, lx = _ps.x + dx * 34, ly = _ps.y - 22;
      c.strokeStyle = 'rgba(223,232,236,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(_ps.x, _ps.y); c.lineTo(lx, ly); c.stroke();
      c.fillStyle = '#dfe8ec'; c.beginPath(); c.arc(_ps.x, _ps.y, 2.2, 0, TAU); c.fill();
      c.font = '500 12px "IBM Plex Sans", system-ui, sans-serif'; const w = c.measureText(l[0]).width + 14;
      pill(c, dx < 0 ? lx - w : lx, ly - 10, l[0]);
    });
  }
  if (INP.inside && S.guided && PICK.hit && ENT_NAME[PICK.ent] && !activeHand().firing) pill(c, INP.x + 14, INP.y + 12, ENT_NAME[PICK.ent](PICK.side));
}

// ---------- suture ----------
const SUT = { st: [], tail: new Tube(14, 5, IM.thread), arr: vecArr(9), tarr: vecArr(14) };
for (let i = 0; i < 9; i++) { const t = new Tube(9, 5, IM.thread); t.mesh.visible = false; scene.add(t.mesh); SUT.st.push(t); }
SUT.tail.mesh.visible = false; scene.add(SUT.tail.mesh);
function updateSuture() {
  const c = S.cuff, a = new V3(), b = new V3(), m = new V3();
  for (let i = 0; i < SUT.st.length; i++) {
    const t = SUT.st[i], s = c.stitches[i];
    if (!s) { t.mesh.visible = false; continue; }
    cuffPt(s.x, 'ant', Math.min(s.da, 0.82), a); cuffPt(s.x - 0.12, 'post', Math.min(s.dp, 0.82), b);
    m.set(s.x - 0.06, 0.24, 0).applyMatrix4(VG.M);
    spline([a, m, b], SUT.arr); t.set(SUT.arr, 0, 1, () => 0.035, null);
  }
  let nh = null; for (const k of ['L', 'R']) if (HAND[k].inst === 'needle' && HAND[k].exch <= 0) nh = HAND[k];
  const active = STEPS[S.step].id === 'cuff' && !c.done && nh;
  SUT.tail.mesh.visible = !!active;
  if (active) {
    if (c.pending) cuffPt(c.pending.x, 'ant', Math.min(c.pending.da, 0.82), a);
    else if (c.stitches.length) { const s = c.stitches[c.stitches.length - 1]; cuffPt(s.x - 0.12, 'post', Math.min(s.dp, 0.82), a); }
    else a.copy(nh.tip).add(_w.set(1.6, 1.2, 1.8));
    b.copy(nh.tip); m.lerpVectors(a, b, 0.5); m.y -= 0.5; m.z += 0.5;
    spline([a, m, b], SUT.tarr); SUT.tail.set(SUT.tarr, 0, 1, () => 0.03, null);
  }
}

// ---------- DOM ----------
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function buildStatic() {
  const tray = $('insts');
  for (const t in INST) {
    const b = el('button', 'inst', '<kbd>' + INST[t].key + '</kbd><span>' + INST[t].short + '</span>');
    b.type = 'button'; b.id = 'inst-' + t; b.title = INST[t].name + '. ' + INST[t].use; b.addEventListener('click', () => setInst(ACTIVE, t)); tray.appendChild(b);
  }
  const list = $('checklist'); let phase = null, ol = null;
  STEPS.forEach((s, i) => {
    if (s.phase !== phase) { phase = s.phase; list.appendChild(el('h4', null, phase)); ol = el('ol'); list.appendChild(ol); }
    const li = el('li', null, '<i></i><span>' + s.short + '</span>'); li.id = 'cl-' + i; ol.appendChild(li);
  });
}
function renderStepCard() {
  const st = STEPS[S.step];
  $('stepNo').textContent = 'Step ' + (S.step + 1) + ' of ' + STEPS.length; $('stepPhase').textContent = st.phase;
  $('stepTitle').textContent = st.title;
  $('stepText').innerHTML = st.text.map(t => '<li>' + t + '</li>').join('');
  $('stepPearl').textContent = st.pearl;
  STEPS.forEach((s, i) => { const li = $('cl-' + i); li.className = i < S.step || S.ended ? 'done' : i === S.step ? 'cur' : ''; });
  $('side').scrollTop = 0;
}
const TOOL_NAME = { bipolar: 'Advanced bipolar', hook: 'Monopolar hook', needle: 'Needle driver' };
function renderUI(dt) {
  uiClock -= dt;
  if (UI_FULL) { renderStepCard(); UI_FULL = false; UI_DIRTY = true; }
  if (!UI_DIRTY && uiClock > 0) return;
  uiClock = 0.12; UI_DIRTY = false;
  const st = STEPS[S.step], h = activeHand();
  // chips
  let chips = '';
  if (st.tool !== 'any') { const ok = h.inst === st.tool || (st.id === 'flap' && h.inst === 'suction'); chips += '<span class="chip ' + (ok ? 'ok' : 'no') + '">' + TOOL_NAME[st.tool] + ' in the active hand</span>'; }
  let allOk = true;
  for (const e of st.expo || []) { const ok = e.ok(); allOk = allOk && ok; chips += '<span class="chip ' + (ok ? 'ok' : 'no') + '">' + e.label + '</span>'; }
  if (S.bleeders.length) chips += '<span class="chip crit">Active bleeding: control it first</span>';
  if ($('stepChips').innerHTML !== chips) $('stepChips').innerHTML = chips;
  $('btnExpo').hidden = !(S.guided && st.rec && !allOk && S.running && !S.manipOut);
  $('stepBar').style.width = Math.round(clamp(st.frac ? st.frac() : 0, 0, 1) * 100) + '%';
  $('stepProg').textContent = st.progress ? st.progress() : '';
  const b1 = $('stepBtn1'), b2 = $('stepBtn2');
  const show1 = S.running && st.button && !(st.button.hide && st.button.hide()) && !(st.id === 'deliver' && S.specimen !== 'in');
  b1.hidden = !show1; if (show1) b1.textContent = st.button.label;
  const show2 = S.running && st.button2 && st.button2.show(); b2.hidden = !show2; if (show2) b2.textContent = st.button2.label;
  $('stepPearl').parentElement.hidden = false;
  // tray
  for (const k of ['L', 'R']) { const e = $('hand' + k); e.classList.toggle('on', ACTIVE === k); e.querySelector('b').textContent = INST[HAND[k].exchTo || HAND[k].inst].short + (HAND[k].grab && HAND[k].grab.pull ? ' (holding)' : ''); }
  for (const t in INST) $('inst-' + t).classList.toggle('on', (h.exchTo || h.inst) === t);
  $('btnCut').disabled = h.inst !== 'bipolar';
  // HUD
  $('hudT').textContent = fmtT(S.t); $('hudEBL').textContent = Math.round(S.ebl) + ' mL'; $('hudP').textContent = S.pressure.toFixed(0) + ' mmHg';
  const dev = { bipolar: 'BIPOLAR', hook: 'MONOPOLAR CUT', suction: 'SUCTION', grasper: 'GRASPER', needle: 'NEEDLE DRIVER' }[h.inst];
  let state = h.firing ? 'ON' : 'READY';
  const tg = st.seal ? S.side[st.seal.side][st.seal.ent] : null;
  if (h.inst === 'bipolar' && h.firing && tg && tg.act) state = 'SEAL ' + Math.round(tg.act.p * 100) + '%';
  if (h.inst === 'grasper') state = h.grab ? 'CLOSED' : 'OPEN';
  if (h.inst === 'needle') state = '';
  const hd = $('hudDev'); hd.textContent = (ACTIVE === 'L' ? 'L  ' : 'R  ') + dev + (state ? '  ' + state : ''); hd.className = 'hudline' + (h.firing && h.inst !== 'suction' ? ' hot' : '');
  const px = $('hudProx');
  if (S.guided && S.running && (h.inst === 'bipolar' || h.inst === 'hook')) { const n = nearestUreter(h.tip); px.hidden = false; px.textContent = 'URETER ' + n.d.toFixed(1) + ' cm ' + (n.k === 'R' ? 'right' : 'left'); px.className = 'hudline ' + (n.d < 1 ? 'crit' : n.d < 1.5 ? 'warn' : 'safe'); } else px.hidden = true;
  // metrics + log
  $('mAct').textContent = S.stats.activations; $('mEnergy').textContent = S.stats.energyTime.toFixed(0) + ' s'; $('mInj').textContent = Object.keys(S.injuries).length; $('mNear').textContent = S.stats.nearMiss;
  const ev = S.events.slice(-4).reverse().map(e => '<li class="' + e.type + '"><time>' + fmtT(e.t) + '</time>' + e.text + '</li>').join('');
  if ($('log').innerHTML !== ev) $('log').innerHTML = ev || '<li class="none">No events yet</li>';
  // manipulator
  const P = S.poseGoal, kx = P.yaw / LIM.yaw, ty = P.pitch < PITCH0 ? ((P.pitch - LIM.pMin) / (PITCH0 - LIM.pMin)) * 0.5 : 0.5 + ((P.pitch - PITCH0) / (LIM.pMax - PITCH0)) * 0.5;
  const knob = $('knob'); knob.style.left = (50 + kx * 42) + '%'; knob.style.top = (50 - (ty * 2 - 1) * 42) + '%';
  if (document.activeElement !== $('push')) $('push').value = Math.round(P.push * 100);
  $('manip').classList.toggle('off', S.manipOut);
  $('manipNote').textContent = S.manipOut ? 'Manipulator removed' : 'Uterine manipulator';
}
function setPoseGoal(p) { if (S.manipOut) return; if (p.yaw != null) S.poseGoal.yaw = clamp(p.yaw, -LIM.yaw, LIM.yaw); if (p.pitch != null) S.poseGoal.pitch = clamp(p.pitch, LIM.pMin, LIM.pMax); if (p.push != null) S.poseGoal.push = clamp(p.push, 0, 1); uiDirty(); }
function showDebrief() {
  const sc = score(), s = S.stats, c = S.cuff.stitches;
  const depths = c.flatMap(b => [b.da, b.dp]), mean = depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;
  const gaps = c.slice(1).map((b, i) => c[i].x - b.x), gmean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const row = (k, v, cls) => '<div class="row ' + (cls || '') + '"><span>' + k + '</span><b>' + v + '</b></div>';
  const uad = k => (s['uaDist' + k] != null ? s['uaDist' + k].toFixed(1) + ' cm' : 'n/a');
  $('dbGrade').textContent = sc.grade; $('dbScore').textContent = sc.pts;
  $('dbA').innerHTML = row('Operative time', fmtT(S.t)) + row('Estimated blood loss', Math.round(S.ebl) + ' mL', S.ebl > 100 ? 'warn' : '') + row('Energy activations', s.activations) + row('Energy time', s.energyTime.toFixed(0) + ' s') + row('Instrument exchanges', s.exchanges);
  const inj = Object.keys(S.injuries).length;
  $('dbB').innerHTML = row('Organ or vessel injuries', inj, inj ? 'crit' : 'ok') + row('Near misses at the ureter', s.nearMiss, s.nearMiss ? 'warn' : 'ok') + row('Pedicles cut without a full seal', s.unsealedCuts, s.unsealedCuts ? 'warn' : 'ok') + row('Seal to ureter, right uterine pedicle', uad('R')) + row('Seal to ureter, left uterine pedicle', uad('L')) + row('Closest energy to a ureter', Math.min(s.minUreter.R, s.minUreter.L) < 90 ? Math.min(s.minUreter.R, s.minUreter.L).toFixed(1) + ' cm' : 'n/a');
  $('dbC').innerHTML = row('Cuff stitches', c.length) + row('Mean bite depth', depths.length ? Math.round(mean * 10) + ' mm' : 'n/a') + row('Mean stitch spacing', gaps.length ? Math.round(gmean * 10) + ' mm' : 'n/a') + row('Steps started without exposure set', s.expoMiss, s.expoMiss ? 'warn' : 'ok') + row('Left-hand traction used', s.traction + ' time' + (s.traction === 1 ? '' : 's'));
  $('dbNotes').innerHTML = sc.notes.length ? sc.notes.map(n => '<li>' + n + '</li>').join('') : '<li class="good">No deductions. Clean case.</li>';
  $('dbLog').innerHTML = S.events.length ? S.events.map(e => '<li class="' + e.type + '"><time>' + fmtT(e.t) + '</time>' + e.text + '</li>').join('') : '<li class="none">No events recorded</li>';
  $('debrief').hidden = false; uiDirty(true);
}

// ---------- lifecycle ----------
function resetSteps() { for (const s of STEPS) { if (s.acc != null) s.acc = 0; if (s.cnt != null) s.cnt = 0; if (s.vis) { s.vis = []; s.visT = 0; } s.entered = false; } for (const k in _um) delete _um[k]; }
function resetHands() {
  for (const [k, sx, inst] of [['L', -1, 'grasper'], ['R', 1, 'bipolar']]) {
    const h = HAND[k]; h.sub[h.inst].g.visible = false; h.inst = inst; h.sub[inst].g.visible = true;
    h.tip.set(3.4 * sx, -0.4, 4.6); h.goal.copy(h.tip); h.surf.copy(h.tip); h.grab = null; h.exch = 0; h.exchTo = null; h.firing = false; h.open = h.openGoal = 0.7; h.roll = 0;
  }
  ACTIVE = 'R';
}
function resetWorld(running) {
  const keep = S ? { guided: S.guided, labels: S.labels } : { guided: true, labels: false };
  S = freshState(); S.guided = keep.guided; S.labels = keep.labels; S.running = running;
  resetSteps(); resetHands();
  for (const m of DECALS) m.parent && m.parent.remove(m); DECALS.length = 0;
  for (const f of FX.smoke.concat(FX.blood)) { f.life = 0; f.s.visible = false; }
  VG.dirty = true; VG.pose.yaw = 0; VG.pose.pitch = PITCH0; VG.pose.push = 0;
  CAM.userIns = 0; CAM.pan.set(0, 0, 0);
  for (const k in hintT) delete hintT[k];
  stopSustain(); $('toast').className = 'toast'; $('debrief').hidden = true;
  enterStep(0);
}
function startCase() { auInit(); resetWorld(true); $('startCard').hidden = true; sfx.ok(); }

// ---------- input wiring ----------
function wire() {
  const pos = e => { const r = OV.getBoundingClientRect(); INP.x = e.clientX - r.left; INP.y = e.clientY - r.top; INP.ndc.set((INP.x / r.width) * 2 - 1, -((INP.y / r.height) * 2 - 1)); INP.inside = true; };
  OV.addEventListener('pointermove', pos);
  OV.addEventListener('pointerdown', e => {
    pos(e); if (e.button === 2) { cutAction(); return; }
    if (e.button !== 0) return;
    try { OV.setPointerCapture(e.pointerId); } catch (_) {}
    INP.down = true; doPick(); snapPick(); primaryDown();
  });
  const up = () => { if (INP.down) { INP.down = false; primaryUp(); } };
  OV.addEventListener('pointerup', up); OV.addEventListener('pointercancel', up);
  OV.addEventListener('pointerleave', () => { INP.inside = false; up(); });
  OV.addEventListener('contextmenu', e => e.preventDefault());
  OV.addEventListener('wheel', e => { e.preventDefault(); CAM.userIns = clamp(CAM.userIns - e.deltaY * 0.006, -5, 6); }, { passive: false });
  $('handL').addEventListener('click', () => setActive('L')); $('handR').addEventListener('click', () => setActive('R'));
  $('btnCut').addEventListener('click', cutAction);
  $('btnSwitch').addEventListener('click', () => setActive(ACTIVE === 'L' ? 'R' : 'L'));
  $('btnBegin').addEventListener('click', startCase);
  $('btnRestart').addEventListener('click', () => { resetWorld(false); $('startCard').hidden = false; });
  $('dbRestart').addEventListener('click', () => { resetWorld(false); $('startCard').hidden = false; });
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
    if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { held[k] = true; if (k.startsWith('arrow') && S.running) e.preventDefault(); return; }
    if (!S.running) return;
    if (k >= '1' && k <= '5') { const t = Object.keys(INST)[+k - 1]; setInst(ACTIVE, t); }
    else if (k === ' ' || k === 'x') { if (e.target && /^(BUTTON|INPUT)$/.test(e.target.tagName) && k === ' ') return; e.preventDefault(); setActive(ACTIVE === 'L' ? 'R' : 'L'); }
    else if (k === 'c') cutAction();
    else if (k === 'l') { S.labels = !S.labels; syncL(); }
    else if (k === 'g') { S.guided = !S.guided; syncG(); uiDirty(); }
    else if (k === 'm') { AU.on = !AU.on; if (!AU.on) stopSustain(); syncS(); }
    else if (k === '=' || k === '+') CAM.userIns = clamp(CAM.userIns + 0.8, -5, 6);
    else if (k === '-') CAM.userIns = clamp(CAM.userIns - 0.8, -5, 6);
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
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(VIEW); else window.addEventListener('resize', resize);
}

// ---------- main loop ----------
let lastNow = performance.now(), simTime = 0;
function tick(dt) {
  simTime += dt;
  wire.keys(dt);
  updateAnatomy(dt, simTime);
  updateCamera(dt, simTime);
  scene.updateMatrixWorld();
  doPick(); snapPick(); updateHands(dt);
  if (S.running) { actionTick(dt); updateSteps(dt); }
  updateFX(dt, simTime); updateSuture();
}
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000)); lastNow = now;
  requestAnimationFrame(frame);
  if (window.__simPause) return; // automated checks drive tick() and render() themselves
  tick(dt);
  renderer.render(scene, camera);
  drawOverlay(simTime); renderUI(dt);
}
S = freshState();
buildStatic(); wire(); resize();
resetWorld(false);
requestAnimationFrame(frame);

// hooks for automated checks
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
window.__sim = { forceStep, visibleAt, colpPt, SEALSPEC, URETER, VG, UT, BL,
  get S() { return S; }, STEPS, HAND, PICK, CAM, AN, INP, tick, setPoseGoal, setInst, setActive, cutAction, startCase,
  get active() { return ACTIVE; },
  next() { const st = STEPS[S.step]; if (S.bleeders.length) { const p = S.bleeders[0].pt(new V3()); project(p, _ps); return { act: 'bleed', x: _ps.x, y: _ps.y }; } const n = st.next && st.next(); if (!n) return null; project(n.p, _ps); return { act: n.act, label: n.label, x: _ps.x, y: _ps.y, z: _ps.z, hidden: !!n.hidden, vis: visibleAt(n.p, 0.8), p: n.p.toArray() }; },
  proj(p) { project(new V3(p[0], p[1], p[2]), _ps); return { x: _ps.x, y: _ps.y }; },
  render() { renderer.render(scene, camera); drawOverlay(simTime); renderUI(1); }
};
