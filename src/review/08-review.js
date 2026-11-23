// ---------- the review site: a notice for touch devices, and the results to send back ----------
// The questions asked of a reviewer, then everything their run recorded, as plain text for an email. Nothing leaves
// the page unless they paste it.
function resultsText() {
  const sc = CASE.score(), s = S.stats, line = (k, v) => k + ': ' + String(v).replace(/<[^>]+>/g, '') + '\n', rows = CASE.debrief(line), out = [];
  out.push(SITE.name + ' ' + SITE.label + ' feedback', '');
  SITE.asks.forEach((q, i) => out.push((i + 1) + '. ' + q, '', '')); // room for an answer under each
  out.push('---- My results, copied from the simulator ----', SITE.name + ' ' + SITE.label + ': ' + CASE.name.toLowerCase());
  out.push('Score: ' + sc.pts + ' / 100 (' + sc.grade + ')');
  out.push('Operative time: ' + fmtT(S.t) + ', of it ' + fmtT(s.autoT) + ' with Auto depth on and ' + fmtT(Math.max(0, S.t - s.autoT)) + ' in manual depth');
  out.push('Estimated blood loss: ' + Math.round(S.ebl + (CASE.ebl0 || 0)) + ' mL');
  out.push('Energy: ' + s.activations + ' activations, ' + s.energyTime.toFixed(0) + ' s. Instrument exchanges: ' + s.exchanges);
  out.push('', 'Deductions'); for (const n of sc.notes.length ? sc.notes : ['None']) out.push('- ' + n.replace(/<[^>]+>/g, ''));
  out.push('', 'Safety', rows[0].trim(), '', 'Technique', rows[1].trim());
  out.push('', 'Time on each step');
  STEPS.forEach((st, i) => { const a = S.stepAt[i], b = i + 1 < S.stepAt.length ? S.stepAt[i + 1] : S.t; if (a != null) out.push((i + 1) + '. ' + st.short + ': ' + fmtT(b - a)); });
  out.push('', 'Event log'); for (const e of S.events) out.push(fmtT(e.t) + '  ' + e.text.replace(/<[^>]+>/g, ''));
  if (!S.events.length) out.push('No events');
  out.push('', 'Picture quality: ' + $('selQ').value + '. Browser: ' + navigator.userAgent);
  return out.join('\n');
}
function copyResults() {
  const text = resultsText(), note = $('dbCopied'), done = ok => { note.textContent = ok ? 'Copied. Paste it into your email.' : 'Could not copy here: select the text below and copy it.'; if (!ok) showResults(text); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); else done(false);
}
// Where the browser will not write to the clipboard, the results are shown to be copied by hand.
function showResults(text) {
  let ta = $('dbText');
  if (!ta) { ta = el('textarea'); ta.id = 'dbText'; ta.readOnly = true; ta.rows = 10; ta.style.cssText = 'width:100%;margin-top:10px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:6px;font:12px var(--mono);padding:8px'; $('dbCopy').closest('.sheet').appendChild(ta); }
  ta.value = text; ta.focus(); ta.select();
}
function reviewWire() {
  $('dbCopy').addEventListener('click', copyResults);
  const mq = q => window.matchMedia && window.matchMedia(q).matches;
  $('touchNote').hidden = !((mq('(pointer: coarse)') && !mq('(any-pointer: fine)')) || window.innerWidth < 700); // a phone or a tablet with no mouse or trackpad
}
