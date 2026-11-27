// ---------- lab: mouse only, and its own corner of the page ----------
// Hand control (08-hands.js) is left out of this page. These stand in for the few parts of it that the rest of the
// page mentions, and the hooks it leaves are where the lab keeps its own read-outs up to date.
const HT = { status: 'off', cal: null, clock: 0, cams: [], slot: { L: { engaged: false, pinch: false, tSeen: -9 }, R: { engaged: false, pinch: false, tSeen: -9 } } };
const HCOL = { L: '#43c6c0', R: '#f0b24a' };
function htWire() {} function htPointers() {} function htActions() {} function htResetSlots() {} function htEnable() {} function htDisable() {}
function htFresh() { return false; } function htWarning() { return ''; }
for (let i = LABELS.length - 1; i >= 0; i--) if (['Right ureter', 'Right IP lig.', 'Right uterine vessels'].includes(LABELS[i][0])) LABELS.splice(i, 1); // these are the lab's own to name
const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
function htRenderUI() { // called after the simulator has drawn its own panels
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
}
function resultsText() { // the debrief as plain text
  const sc = CASE.score(), line = (k, v) => k + ': ' + String(v).replace(/<[^>]+>/g, '') + '\n', rows = CASE.debrief(line);
  return [SITE.name + ' ' + SITE.label + ': ' + CASE.name.toLowerCase(), 'Score: ' + sc.pts + ' / 100 (' + sc.grade + ')', 'Time: ' + fmtT(S.t) + '. Estimated blood loss: ' + Math.round(S.ebl) + ' mL', '', 'Deductions'].concat(sc.notes.length ? sc.notes.map(n => '- ' + n.replace(/<[^>]+>/g, '').replace(/&minus;/g, '-')) : ['None'], ['', 'Safety', rows[0].trim(), '', 'Technique', rows[1].trim(), '', 'Event log'], S.events.map(e => fmtT(e.t) + '  ' + e.text)).join('\n');
}
// for the automated checks
window.__lab = { PX, LB, LU, LW, LS, LV, LH, LR, LK, lbPart, lbBeat, lbId, lbU, lbRest, lbTri, lbTriC, lbReindex, lbMetrics, lbMid, lbClose, lbOpen, lbInjury, labCut, shaftShown, inBowl, get goal() { return S.lab.goal; }, get lab() { return S.lab; } };
