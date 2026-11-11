/* ================= interface ================= */
let toastT = 0;
function say(text, cls, dur) { const el = $('toast'); el.textContent = text; el.className = 'toast on ' + (cls || ''); toastT = dur || 3.6; }
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function hideSheet() { const s = $('sheet'); s.hidden = true; s.innerHTML = ''; }
function showSheet(html) { const s = $('sheet'); s.innerHTML = html; s.hidden = false; const b = s.querySelector('.btn'); if (b) b.focus({ preventScroll: true }); }

function renderGuide() {
  const g = $('guide');
  if (S.phase === 'brief') {
    g.innerHTML = `<p class="count">Case briefing</p><h3>44-year-old with a 10-week fibroid uterus</h3>
      <p class="do">G2P2, heavy menstrual bleeding despite medical management, childbearing complete. Plan: total laparoscopic hysterectomy, bilateral salpingectomy, ovaries conserved, cystoscopy.</p>
      <dl class="keys"><dt><kbd>Mouse</kbd></dt><dd>Steer the active instrument</dd><dt><kbd>Left button</kbd></dt><dd>Hold for energy or suction. Click to grasp or drive the needle</dd><dt><kbd>Right click</kbd></dt><dd>Fire the sealer blade</dd><dt><kbd>W A S D</kbd></dt><dd>Move the uterus with the manipulator</dd></dl>
      <div class="row"><div class="seg" role="group" aria-label="Guidance level"><button type="button" data-mode="guided" aria-pressed="${S.mode === 'guided'}">Guided</button><button type="button" data-mode="expert" aria-pressed="${S.mode === 'expert'}">Expert</button></div></div>
      <button class="btn" id="beginBtn" type="button">Begin case</button>`;
    $('beginBtn').addEventListener('click', () => startCase(0));
    g.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    return;
  }
  if (S.phase === 'done') {
    g.innerHTML = `<p class="count">Case closed</p><h3>${S.outcome === 'convert' ? 'Converted to laparotomy' : 'Hysterectomy complete'}</h3><p class="do">Open the debrief for the score and teaching points, or jump to any step to practice it again.</p><div class="row"><button class="btn" id="dbBtn" type="button">Open debrief</button><button class="btn ghost" id="reBtn" type="button">New case</button></div>`;
    $('dbBtn').addEventListener('click', showDebrief); $('reBtn').addEventListener('click', () => startCase(0));
    return;
  }
  const t = cur(), si = stepIndex(t.step), guided = S.mode === 'guided';
  g.innerHTML = `<p class="count">Step ${si + 1} of ${STEPS.length}${S.practice ? ' · practice run' : ''}</p><h3>${esc(STEPS[si].title)}</h3><p class="do">${esc(t.text)}</p>${guided && t.pearl ? `<p class="pearl">${esc(t.pearl)}</p>` : ''}<div class="chips" id="chips"></div><div class="prog" id="prog" hidden><i></i></div>${t.type === 'action' ? `<button class="btn" id="actBtn" type="button"${S.busy > 0 ? ' disabled' : ''}>${esc(t.btn)}</button>` : ''}`;
  const b = $('actBtn'); if (b) b.addEventListener('click', () => { b.blur(); doAction(); });
  const li = $('st-' + si); if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
}
function setMode(m) { S.mode = m; $('btnGuide').setAttribute('aria-pressed', m === 'guided'); S.ui.dirty = true; }
function startCase(n) { Snd.init(); hideSheet(); jumpTo(n || 0); $('toast').classList.remove('on'); if (!n) say('Time-out first. Use the button in the guide panel on the right.', '', 5); }

let chipsHTML = '', logHTML = '';
function updateHUD() {
  const v = S.vit, ins = S.ins, run = S.phase === 'scope' || S.phase === 'ext';
  $('vHR').textContent = Math.round(v.hr); $('vBP').textContent = Math.round(v.sys) + '/' + Math.round(v.dia); $('vSP').textContent = v.spo2; $('vCO').textContent = Math.round(v.co2);
  $('mTime').textContent = mmss(S.time); $('mEBL').textContent = Math.round(S.ebl) + ' mL'; $('mEBLbox').classList.toggle('alert', S.bleeders.some(b => b.id !== 'ooze'));
  $('insP').textContent = Math.round(ins.p); $('insF').textContent = ins.flow.toFixed(1); $('insV').textContent = ins.vol.toFixed(1);
  $('insState').textContent = ins.set <= 0 ? 'Standby' : ins.leak ? 'Leak: pressure lost' : Math.abs(ins.p - ins.set) > .6 ? 'Set ' + ins.set + ' mmHg' : 'Holding ' + ins.set + ' mmHg';
  const scope = S.phase !== 'ext';
  $('edgeL').style.display = $('edgeR').style.display = scope && S.mode === 'guided' ? '' : 'none';
  $('osdTL').innerHTML = scope ? `TLH + BS  <b>SIM</b>${S.practice ? '\nPRACTICE RUN' : ''}${S.phase === 'brief' ? '\nPREVIEW' : ''}` : 'OR CAMERA';
  $('osdTR').innerHTML = `CO₂ <b>${Math.round(ins.p)}</b> mmHg\n${ins.flow.toFixed(1)} L/min`;
  const en = S.energy && !S.injuryLock;
  $('osdBL').innerHTML = scope && S.phase !== 'brief' ? `L  GRASPER${S.grasp ? ' <b>HOLD</b>' : ''}\nR  ${TOOLS[S.rtool].short.toUpperCase()}${en ? (S.rtool === 'hook' ? ' <span class="hot">● CUT</span>' : ' <span class="cool">● SEAL</span>') : ''}` : '';
  $('osdBR').innerHTML = scope ? `ZOOM ${S.cam.z.toFixed(1)}×\n${mmss(S.time)}` : mmss(S.time);
  CV.classList.toggle('idle', !run);
  /* tray */
  const reqs = run ? requirements() : [], guided = S.mode === 'guided';
  const wantTool = S.ui.want || (guided ? (reqs.find(r => r.tool && !r.ok) || {}).tool : null);
  for (const id in TOOLS) { const b = $('tool-' + id); b.setAttribute('aria-pressed', S.tool === id && S.phase === 'scope'); b.classList.toggle('want', wantTool === id && S.phase === 'scope'); b.disabled = S.phase !== 'scope'; }
  const T = TOOLS[S.tool], a = $('pedA'), b2 = $('pedB');
  $('pedAt').textContent = T.a; $('pedAk').textContent = T.ak; a.className = 'pedal a ' + (T.mode === 'cut' ? 'cutmode' : T.mode === 'plain' ? 'plain' : '') + (S.ptr.down && S.phase === 'scope' ? ' live' : '');
  a.disabled = S.phase !== 'scope'; $('pedBt').textContent = T.b || 'No second action'; b2.disabled = S.phase !== 'scope' || !T.b;
  const m = S.manip, t = run ? cur() : null, mw = guided && t && t.mw && reqs.some(r => r.manip && !r.ok) ? t.mw : null, locked = S.phase !== 'scope' || !!S.flags.specimenOut;
  document.querySelectorAll('#manip button').forEach(b => { const d = b.dataset.m; b.disabled = locked; b.classList.toggle('on', !locked && (d === 'l' ? m.tx < -.5 : d === 'r' ? m.tx > .5 : d === 'u' ? m.ty < -.5 : d === 'd' ? m.ty > .5 : (Math.abs(m.tx) < .5 && Math.abs(m.ty - REST.y) < .3))); b.classList.toggle('want', !locked && mw === d); });
  /* steps */
  const si = run && t ? stepIndex(t.step) : S.phase === 'done' ? STEPS.length : -1;
  STEPS.forEach((s, i) => { const li = $('st-' + i); li.className = i < si ? 'done' : i === si ? 'cur' : ''; });
  $('stepsNote').textContent = S.practice && run ? 'Practice run' : '';
  /* guide chips and progress */
  const ch = $('chips');
  if (ch) {
    const html = (guided || reqs.some(r => r.alarm) ? reqs.filter(r => guided || r.alarm) : []).map(r => `<div class="chip ${r.ok ? 'ok' : ''} ${r.alarm ? 'alarm' : ''}">${esc(r.label)}</div>`).join('');
    if (html !== chipsHTML) { chipsHTML = html; ch.innerHTML = html; }
    const p = progress(), pe = $('prog'); if (pe) { pe.hidden = p == null; if (p != null) pe.firstElementChild.style.width = Math.round(clamp(p, 0, 1) * 100) + '%'; }
    const ab = $('actBtn'); if (ab) ab.disabled = S.busy > 0;
  } else chipsHTML = '';
  if (S.ui.logDirty) { S.ui.logDirty = false; $('log').innerHTML = S.log.slice(0, 30).map(e => `<li class="${e.cls}"><time>${mmss(e.t)}</time><span>${esc(e.text)}</span></li>`).join(''); }
}

function showCysto() {
  const u = k => S.compSet['ureter' + k], bl = S.compSet.bladder, bad = u('L') || u('R') || bl;
  const jet = k => u(k) ? `<li class="crit"><b>${cap(SIDENAME[k])} ureteral orifice: no efflux</b>Urology is called in. The thermal injury is stented and repaired before closing.</li>` : `<li class="good"><b>${cap(SIDENAME[k])} ureteral orifice</b>Brisk jet.</li>`;
  showSheet(`<div class="card" role="dialog" aria-label="Cystoscopy"><h3>Cystoscopy</h3><h2>${bad ? 'An injury is found' : 'Bladder intact, both jets brisk'}</h2><ul class="findings">${bl ? '<li class="crit"><b>Cystotomy at the dome</b>Repaired in two layers. The Foley stays in for 7 to 10 days.</li>' : '<li class="good"><b>Bladder mucosa</b>Intact, no suture or thermal marks.</li>'}${jet('L')}${jet('R')}</ul><button class="btn" id="cystoOk" type="button">Continue</button></div>`);
  $('cystoOk').addEventListener('click', () => { hideSheet(); logEv(bad ? 'Cystoscopy: injury identified and repaired' : 'Cystoscopy normal, bilateral jets', bad ? 'crit' : 'good'); advance(); });
}
function showDebrief() {
  const sc = score(), c = S.counts, conv = S.outcome === 'convert', crit = S.comps.some(k => COMP[k.type].cls === 'crit');
  const head = conv ? 'Converted to laparotomy' : crit ? 'Completed with a major complication' : S.comps.length ? 'Completed with minor events' : 'Uncomplicated hysterectomy';
  const sum = conv ? 'The case could not be finished laparoscopically.' : S.comps.length ? 'The uterus is out and the cuff is closed. Review the events below before the next run.' : 'Uterus and both tubes out, ovaries conserved, cuff closed, cystoscopy done.';
  const f = [];
  for (const k of S.comps) { const C = COMP[k.type]; f.push(`<li class="${C.cls}"><b>${esc(C.title(k.k))} · ${mmss(k.t)}, ${esc((STEPS[stepIndex(k.step)] || {}).title || '')}</b>${esc(C.teach)}</li>`); }
  if (c.near) f.push(`<li class="warn"><b>${c.near} near miss${c.near > 1 ? 'es' : ''} at the ureter</b>Energy or a suture bite came within a few millimetres. Contralateral deviation and cephalad pressure on the cup buy distance.</li>`);
  if (c.off) f.push(`<li class="warn"><b>${c.off} off-target activation${c.off > 1 ? 's' : ''}</b>Put the tip on tissue first, then step on the pedal.</li>`);
  if (c.wrong) f.push(`<li class="warn"><b>${c.wrong} wrong-instrument attempt${c.wrong > 1 ? 's' : ''}</b>Bipolar for pedicles, monopolar hook for peritoneum and the colpotomy.</li>`);
  if (c.sloppy) f.push(`<li class="warn"><b>${c.sloppy} cuff bite${c.sloppy > 1 ? 's' : ''} off the ideal line</b>Aim 5 to 10 mm from the edge, full thickness, about 1 cm apart.</li>`);
  if (!f.length) f.push('<li class="good"><b>No complications, no near misses</b>Every activation landed on its target.</li>');
  showSheet(`<div class="card" role="dialog" aria-label="Debrief"><h3>Debrief${S.practice ? ' · practice run, partial case' : ''}</h3><h2>${head}</h2><p>${sum}</p>
    <div class="grid4"><div class="stat"><span>Score</span><b>${sc.total}</b></div><div class="stat"><span>Case time</span><b>${mmss(S.time)}</b></div><div class="stat"><span>Blood loss</span><b>${Math.round(S.ebl)} mL</b></div><div class="stat"><span>Energy on</span><b>${Math.round(S.energyT)} s</b></div></div>
    <h3>Performance</h3><div class="bars">${Object.entries(sc.dom).map(([k, v]) => `<span>${k}</span><i><u style="width:${v}%"></u></i><b>${v}</b>`).join('')}</div>
    <h3>Findings</h3><ul class="findings">${f.join('')}</ul>
    <div class="row"><button class="btn" id="againBtn" type="button">Run the case again</button><button class="btn ghost" id="closeSheet" type="button">Look at the field</button></div></div>`);
  $('againBtn').addEventListener('click', () => startCase(0)); $('closeSheet').addEventListener('click', hideSheet);
  S.ui.dirty = true;
}

function fit() {
  const mon = $('monitor'), r = mon.getBoundingClientRect(), size = Math.max(240, Math.floor(Math.min(r.width, r.height)) - 2), w = $('wrap');
  w.style.width = w.style.height = size + 'px';
  const px = Math.round(Math.min(1500, size * Math.min(2, window.devicePixelRatio || 1)));
  if (CV.width !== px) { CV.width = CV.height = px; }
  CVK = px / 1000; ensureBackdrop(CVK);
}
function buildUI() {
  const tb = $('tools');
  tb.innerHTML = Object.entries(TOOLS).map(([id, t]) => `<button class="tool" type="button" id="tool-${id}" data-tool="${id}" aria-pressed="false" title="${t.name} (key ${t.key})"><svg viewBox="0 0 34 34" aria-hidden="true">${t.icon}</svg><kbd>${t.key}</kbd><span class="nm">${t.label}</span><span class="sub">${t.sub}</span></button>`).join('');
  tb.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { b.blur(); selectTool(b.dataset.tool); } });
  $('steps').innerHTML = STEPS.map((s, i) => `<li id="st-${i}"><span>${esc(s.title)}</span><button type="button" data-jump="${i}" aria-label="Jump to step ${i + 1}, ${esc(s.title)}">Jump</button></li>`).join('');
  $('steps').addEventListener('click', e => { const b = e.target.closest('[data-jump]'); if (b) { b.blur(); startCase(firstTaskOf(+b.dataset.jump)); } });
  $('manip').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { b.blur(); setManip(b.dataset.m); } });
  const pa = $('pedA'), pb = $('pedB');
  pa.addEventListener('pointerdown', e => { e.preventDefault(); primaryDown(); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) pa.addEventListener(ev, () => { if (S.ptr.down) primaryUp(); });
  pa.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) primaryDown(); }); pa.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') primaryUp(); });
  pb.addEventListener('click', () => { pb.blur(); secondary(); });
  $('btnGuide').addEventListener('click', e => { e.currentTarget.blur(); setMode(S.mode === 'guided' ? 'expert' : 'guided'); });
  $('btnSound').addEventListener('click', e => { const b = e.currentTarget; b.blur(); const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); Snd.set(on); });
  /* pointer on the field */
  const pos = e => { const r = CV.getBoundingClientRect(); S.ptr.sx = (e.clientX - r.left) / r.width * 1000; S.ptr.sy = (e.clientY - r.top) / r.height * 1000; S.ptr.inside = true; };
  CV.addEventListener('pointermove', pos);
  CV.addEventListener('pointerdown', e => { pos(e); try { CV.setPointerCapture(e.pointerId); } catch (x) { } if (e.button === 2) secondary(); else if (e.button === 0) primaryDown(); e.preventDefault(); });
  CV.addEventListener('pointerup', e => { if (e.button === 0) primaryUp(); });
  CV.addEventListener('pointercancel', primaryUp);
  CV.addEventListener('pointerleave', () => { if (!S.ptr.down) S.ptr.inside = false; });
  CV.addEventListener('contextmenu', e => e.preventDefault());
  CV.addEventListener('wheel', e => { if (S.phase !== 'scope') return; S.cam.uz = clamp(S.cam.uz - e.deltaY * .0012, -.5, .9); e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onBtn = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (S.phase === 'brief' || S.phase === 'done' || !$('sheet').hidden) return;
    if (k >= '1' && k <= '5') selectTool(Object.keys(TOOLS)[+k - 1]);
    else if (k === 'w' || k === 'arrowup') setManip('u'); else if (k === 's' || k === 'arrowdown') setManip('d');
    else if (k === 'a' || k === 'arrowleft') setManip('l'); else if (k === 'd' || k === 'arrowright') setManip('r'); else if (k === 'x') setManip('c');
    else if (k === ' ' && !onBtn) { if (!e.repeat) secondary(); }
    else if (k === 'enter' && !onBtn) { if (!e.repeat) doAction(); }
    else return;
    e.preventDefault();
  });
  window.addEventListener('blur', primaryUp);
  if (window.ResizeObserver) new ResizeObserver(fit).observe($('monitor')); window.addEventListener('resize', fit);
}

let lastTs = 0, uiAcc = 1;
function loop(ts) {
  const dt = Math.min(.05, lastTs ? (ts - lastTs) / 1000 : .016); lastTs = ts;
  update(dt); render();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  uiAcc += dt; if (S.ui.dirty) { S.ui.dirty = false; renderGuide(); uiAcc = 1; }
  if (uiAcc > .1) { uiAcc = 0; updateHUD(); }
  requestAnimationFrame(loop);
}
function start(data) {
  CV = $('cv'); CTX = CV.getContext('2d'); initStatic(); resetState(); initTextures(CTX); buildUI(); fit(); G = buildGeo();
  if (data && data.ti > 0 && (data.phase === 'scope' || data.phase === 'ext')) {
    S.mode = data.mode === 'expert' ? 'expert' : 'guided'; jumpTo(Math.min(data.ti, TASKS.length - 1));
    S.time = data.time || 0; S.ebl = data.ebl || 0; S.practice = !!data.practice; if (data.counts) Object.assign(S.counts, data.counts);
    $('btnGuide').setAttribute('aria-pressed', S.mode === 'guided');
  }
  window.__sim = { S, TASKS, STEPS, get G() { return G; }, update, cur, jumpTo, startCase, w2s, selectTool, setManip, primaryDown, primaryUp, secondary, doAction };
  requestAnimationFrame(loop);
}
const HOT = window.claude && window.claude.hot;
if (HOT && HOT.snapshot) HOT.snapshot(() => ({ ti: S.ti, phase: S.phase, mode: S.mode, time: S.time, ebl: S.ebl, practice: S.practice, counts: S.counts }));
if (HOT && HOT.ready) HOT.ready(start); else start((HOT && HOT.data) || {});
