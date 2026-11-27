// ---------- lab: mouse only, and its own corner of the page ----------
// Hand control (08-hands.js) is left out of this page. These stand in for the few parts of it that the rest of the
// page mentions, and the hooks it leaves are where the lab keeps its own read-outs up to date.
const HT = { status: 'off', cal: null, clock: 0, cams: [], slot: { L: { engaged: false, pinch: false, tSeen: -9 }, R: { engaged: false, pinch: false, tSeen: -9 } } };
const HCOL = { L: '#43c6c0', R: '#f0b24a' };
function htWire() {} function htPointers() {} function htActions() {} function htResetSlots() {} function htEnable() {} function htDisable() {}
function htFresh() { return false; } function htWarning() { return ''; }
// ---- names ----
// With labels on, every structure and every space is named where it lies, whether or not it has been uncovered. What is
// in the open is named in white; what is under the peritoneum, in grey until it is uncovered; a space in teal, filled
// once it has been developed. The lab draws all the names itself, the simulator's own among them, and keeps them off
// one another.
const SIM_LABELS = LABELS.splice(0, LABELS.length).filter(l => !['Right ureter', 'Right IP lig.', 'Right uterine vessels', 'Right ext. iliac vessels', 'Right round lig.'].includes(l[0])); // those five are the lab's own to name
const LBL = { t: 0, on: [], list: null };
// Can a place under the peritoneum be named? It can if nothing is in front of it but peritoneum and the other
// structures that lie under it: its name is then shown in grey, through them. Behind the uterus, an ovary, the tube,
// the bladder or the bowel it is not named.
const LBL_THRU = { iliac: 1, vessel: 1, nerve: 1, ureter: 1, ip: 1, round: 1, ant: 1, roof: 1, post: 1, meso: 1 };
function lbNameable(p) {
  _pv.copy(p).project(camera); if (_pv.z > 1 || Math.abs(_pv.x) > 0.98 || Math.abs(_pv.y) > 0.98) return false;
  _ndc.set(_pv.x, _pv.y); RAY2.setFromCamera(_ndc, camera); const hits = RAY2.intersectObjects(PICKS, false), d = camera.position.distanceTo(p);
  for (let i = 0; i < hits.length; i++) if (hits[i].object !== LB.pick && !LBL_THRU[hits[i].object.userData.ent] && shown(hits[i].object)) return hits[i].distance > d - 0.9;
  return true;
}
function labLabelList() {
  const G = () => S.lab.goal, on = (arr, u) => o => sampleArr(arr, u, o), L = [], add = (text, at, kind, lit, show) => L.push({ text, at, kind, lit, show });
  for (const l of SIM_LABELS) add(l[0], o => o.copy(l[1]()), 2, null, l[2]);
  for (const f of LB.folds) add(f.name, on(f.arr, f.name.charAt(0) === 'M' ? 0.22 : 0.16), 2);
  add('Right round ligament', o => sampleArr(LB.rlArr, LB.rl.cut ? Math.max(0.3, LB.rl.uc - 0.2) : 0.62, o), 2);
  add('Right IP ligament (ovarian vessels)', o => o.copy(LB.ipArr[9]), 2);
  add('Right ureter', o => PX.get(LU.i0 + 25, o), 0, () => G().found.ureter);
  for (const [k, u, name] of [['eia', 0.56, 'External iliac artery'], ['eiv', 0.62, 'External iliac vein'], ['gfn', 0.7, 'Genitofemoral nerve'], ['iia', 0.6, 'Internal iliac artery'], ['iiaP', 0.5, 'Posterior division'], ['iiaA', 0.3, 'Anterior division'], ['iiv', 0.6, 'Internal iliac vein'],
    ['umb', 0.45, 'Umbilical artery'], ['sva1', 0.6, 'Superior vesical arteries'], ['oua', 0.5, 'Obliterated umbilical artery (medial umbilical ligament)'], ['ua', 0.45, 'Uterine artery'], ['obn', 0.72, 'Obturator nerve'], ['oba', 0.6, 'Obturator artery'], ['obv', 0.5, 'Obturator vein']])
    add(name, on(LV[k].arr, u), 0, () => G().found[k === 'sva1' ? 'sva' : k]);
  add('Psoas muscle', o => bowlPoint(Math.cos((thA(4.5) + 13) * DEG), Math.sin((thA(4.5) + 13) * DEG), 4.5, 0.04, o), 0, () => G().found.gfn || G().found.eia);
  add('Obturator internus muscle', o => bowlPoint(Math.cos(-6 * DEG), Math.sin(-6 * DEG), 0.4, 0.04, o), 0, () => G().found.obn);
  const sp = (key, name) => add(name, o => o.copy(LB.sp[key][LB.sp[key].length >> 1].mid), 1, () => G()[key === 'prL' ? 'pr' : key]);
  sp('prL', 'Lateral pararectal space (Latzko)'); sp('pvL', 'Lateral paravesical space'); sp('pvM', 'Medial paravesical space');
  add('Medial pararectal space (Okabayashi)', o => LR.by.ureter[27].at(o).addScaledVector(LR.by.ureter[27].face, -0.3), 1, () => false); // between the ureter and its leaf: not opened here, where the ureter is left on the leaf
  return L;
}
const LBL_STYLE = [['#8e9fa8', 'rgba(8,12,15,0.62)'], ['#43c6c0', 'rgba(8,12,15,0.78)'], ['#dfe8ec', 'rgba(8,12,15,0.78)']]; // not yet uncovered; a space not yet developed; in the open
function labLabels(time) {
  if (!S.labels || !S.lab) return;
  const c = OV.getContext('2d'); if (!LBL.list) LBL.list = labLabelList();
  if (time > LBL.t || time < LBL.t - 1) { LBL.t = time + 0.3; LBL.on = LBL.list.filter(l => (!l.show || l.show()) && (l.kind === 2 ? visibleAt(l.at(_w), 0.7) : lbNameable(l.at(_w)))); }
  c.font = '500 12px "IBM Plex Sans", system-ui, sans-serif';
  const B = LBL.on.map(l => { project(l.at(_w), _ps); const w = c.measureText(l.text).width + 14, left = _ps.x < VW / 2; return { l, ax: _ps.x, ay: _ps.y, w, x: clamp(left ? _ps.x - 34 - w : _ps.x + 34, 4, VW - w - 4), y: _ps.y - 32 }; });
  // any two that lie on one another are moved apart, up and down
  for (let it = 0, any = true; it < 80 && any; it++) { any = false; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j]; if (a.x > b.x + b.w + 6 || b.x > a.x + a.w + 6 || Math.abs(a.y - b.y) >= 23) continue;
    const m = (23 - Math.abs(a.y - b.y)) / 2 + 0.5, s = a.y < b.y || (a.y === b.y && a.ay <= b.ay) ? -1 : 1; a.y += s * m; b.y -= s * m; any = true;
  } }
  LBL.box = B;
  for (const b of B) {
    b.y = clamp(b.y, 4, VH - 24); const lit = b.l.kind === 2 || (b.l.lit && b.l.lit()), st = b.l.kind === 1 ? (lit ? ['#0b1014', '#43c6c0'] : LBL_STYLE[1]) : lit ? LBL_STYLE[2] : LBL_STYLE[0];
    c.strokeStyle = 'rgba(223,232,236,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(b.ax, b.ay); c.lineTo(b.x < b.ax ? b.x + b.w : b.x, b.y + 10); c.stroke();
    c.fillStyle = st[0] === '#0b1014' ? '#43c6c0' : st[0]; c.beginPath(); c.arc(b.ax, b.ay, 2.2, 0, TAU); c.fill();
    pill(c, b.x, b.y, b.l.text, st[0], st[1]);
  }
}
const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
function htRenderUI(dt, time) { // called after the simulator has drawn its own panels and its overlay
  labLabels(time);
  for (const h of HANDS) {
    const st = LH[h.key], shut = h.openGoal < 0.3;
    const state = h.inst === 'suction' ? (h.firing ? 'ON' : 'READY') : h.inst === 'bipolar' ? (st.coag ? 'COAGULATING' : shut ? 'CLOSED' : 'OPEN') : shut ? (st.kind ? 'HOLDING ' + st.kind.toUpperCase() : st.vHold ? 'HOLDING VESSEL' : 'CLOSED') : 'OPEN';
    const tail = !S.running ? '' : (st.in ? '  UNDER PERITONEUM' : h.touch && !st.held.length ? (h.press > DEPTH.HARD ? '  PRESSING' : '  CONTACT') : '') + (h.limT > 0 ? '  AT LIMIT' : '');
    const e = $('hudDev' + h.key); setText(e, h.key + '  ' + INST[h.inst].hud + '  ' + state + tail);
    e.className = 'hudline' + (st.coag ? ' hot' : '') + (h.key !== ACTIVE ? ' dim' : '');
  }
  setText($('stepNo'), SITE.label);
  const G = S.lab && S.lab.goal, ul = $('labGoals'); if (!G || !ul) return;
  const found = Object.keys(LNAME).filter(k => G.found[k]).map(k => LNAME[k]);
  const html = '<li class="' + (S.lab.entry ? 'done' : '') + '"><i></i><span>Retroperitoneum opened</span></li>' +
    '<li class="' + (G.ureter ? 'done' : '') + '"><i></i><span>Ureter followed to the uterine artery <small>' + (G.ureterCm >= 0.3 ? G.ureterCm.toFixed(1) + ' cm uncovered' : '') + '</small></span></li>' +
    '<li class="' + (found.length ? 'done' : '') + '"><i></i><span>Uncovered so far: <small>' + (found.length ? found.join(', ') : 'nothing yet') + '</small></span></li>';
  if (ul.dataset.h !== html) { ul.dataset.h = html; ul.innerHTML = html; }
}
function reviewWire() { // the page calls this once at the start, on any site that is not the simulator itself
  const ul = el('ul', 'goals'); ul.id = 'labGoals'; $('stepText').after(ul);
  const g = el('div', 'db-grid'); g.id = 'dbGoals'; g.style.gridTemplateColumns = '1fr'; const h = el('h3', null, 'What was reached'); $('dbNotes').previousElementSibling.before(h, g);
  $('dbRestart').textContent = 'Start again'; $('btnRestart').textContent = 'Start again';
  // the scope's keys, for going in beyond the simulator's limit (labUpdate)
  const key = (e, v) => { if (e.key === '=' || e.key === '+') LB.keys.in = v; if (e.key === '-' || e.key === '_') LB.keys.out = v; };
  window.addEventListener('keydown', e => key(e, true)); window.addEventListener('keyup', e => key(e, false)); window.addEventListener('blur', () => { LB.keys.in = LB.keys.out = false; });
}
function resultsText() { // the debrief as plain text
  const sc = CASE.score(), line = (k, v) => k + ': ' + String(v).replace(/<[^>]+>/g, '') + '\n', rows = CASE.debrief(line);
  return [SITE.name + ' ' + SITE.label + ': ' + CASE.name.toLowerCase(), 'Score: ' + sc.pts + ' / 100 (' + sc.grade + ')', 'Time: ' + fmtT(S.t) + '. Estimated blood loss: ' + Math.round(S.ebl) + ' mL', '', 'Deductions'].concat(sc.notes.length ? sc.notes.map(n => '- ' + n.replace(/<[^>]+>/g, '').replace(/&minus;/g, '-')) : ['None'], ['', 'Safety', rows[0].trim(), '', 'Technique', rows[1].trim(), '', 'Event log'], S.events.map(e => fmtT(e.t) + '  ' + e.text)).join('\n');
}
// for the automated checks
window.__lab = { PX, LB, LU, LW, LS, LV, LH, LR, LK, BL, lbPart, lbBeat, lbId, lbU, lbRest, lbTri, lbTriC, lbReindex, lbMetrics, lbClose, LBL, lbOpen, lbInjury, labCut, shaftShown, inBowl, get goal() { return S.lab.goal; }, get lab() { return S.lab; } };
