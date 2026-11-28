// The pelvic anatomy case as a test of the learner. Find it: every structure is asked for and found with a real click
// on its mark; a miss names what was clicked and gives a hint, the wrong side is a miss, three misses or Show me give
// the answer. Name it: every structure and every question has four different names to choose from, one of them right,
// and is answered by a click or a number key. Then the results of each.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  await page.click('#caseList .case:nth-child(7)'); await page.waitForTimeout(60);
  await page.click('#caseOpts button:has-text("Find it")'); await page.click('#caseOpts button:has-text("Both")');
  // ---- a fresh order each time ----
  let m = await ev(() => { const s = window.__sim, ids = () => s.STEPS.map(x => x.q.id), views = () => s.STEPS.map(x => x.q.v + ':' + x.q.t); s.AX.fixed = false; s.startCase(false); const a = ids(), va = views(); s.startCase(false); const b = ids();
    const tiers = s.STEPS.map(x => x.q.t).join(''), blocks = va.filter((v, i) => i === 0 || v !== va[i - 1]).length; s.AX.fixed = true; s.AX.seed = 7; s.startCase(false);
    return { n: a.length, same: a.join() === b.join(), set: a.slice().sort().join() === b.slice().sort().join(), tiers: /^1+2+$/.test(tiers), blocks, views: new Set(va).size }; });
  ok('Find it asks for all 47, in a fresh order each time, the surface before the retroperitoneum and one view at a time', m.n === 47 && !m.same && m.set && m.tiers && m.blocks === m.views, m);
  await T(0.3);
  const box = await page.locator('#ov').boundingBox();
  const cur = () => ev(() => { const s = window.__sim, st = s.STEPS[s.S.step], V = new s.THREE.Vector3(), pr = s.proj(st.q.at(st.k, V).toArray()); s.ui();
    const o = st.q.bi ? s.proj(st.q.at(st.k === 'R' ? 'L' : 'R', V).toArray()) : null, alt = s.AXS.find(q => q !== st.q && q.v === st.q.v && !q.area), ap = alt ? s.proj(alt.at(alt.bi ? st.k || 'R' : null, V).toArray()) : null;
    return { i: s.S.step, n: s.STEPS.length, id: st.id, bi: !!st.q.bi, mid: !!{ survey: 1, ant: 1, post: 1, prom: 1, vvs: 1, rvs: 1 }[st.q.v], state: st.state, tries: st.tries, x: pr.x, y: pr.y, o, ap, alt: alt && alt.n, title: document.getElementById('stepTitle').textContent, text: document.getElementById('stepText').textContent, hint: st.q.f.join(''), li: document.getElementById('cl-' + s.S.step).textContent.trim(), b1: document.getElementById('stepBtn1').textContent, pearl: getComputedStyle(document.querySelector('.pearl')).display !== 'none' && !document.querySelector('.pearl').hidden, toast: document.getElementById('toast').textContent, ended: s.S.ended, nm: st.nm }; });
  const click = async (x, y) => { await page.mouse.move(box.x + x, box.y + y, { steps: 2 }); await T(0.35); await page.mouse.down(); await page.mouse.up(); await T(0.15); };
  const away = () => page.mouse.move(box.x + box.width + 50, box.y + 30); // with the pointer out of the picture nothing is picked, and the waits go faster
  const settle = async () => { await away(); await T(3.4); };
  await settle(); let c = await cur();
  ok('a structure is asked for by name, and neither the list nor the card gives anything else away', /^Point to the /.test(c.title) && c.li === 'Structure 1' && c.b1 === 'Show me' && !c.pearl && c.text.indexOf(c.hint) < 0, { title: c.title, li: c.li, b1: c.b1, pearl: c.pearl });
  // the first: a miss, then found
  await click(c.ap.x, c.ap.y); let d = await cur();
  ok('a click on something else is a miss: it says what that was, and the card gives a hint', d.state === 'ask' && d.tries === 1 && /^That is the /.test(d.toast) && d.toast.toLowerCase().indexOf(c.alt.toLowerCase()) > 0 && d.text === c.hint, { clicked: c.alt, toast: d.toast, tries: d.tries });
  await click(c.x, c.y); d = await cur();
  ok('found after a miss, it is named and explained, counted as not right first time, and waits for Next', d.state === 'found' && d.i === c.i && d.li === c.nm && d.b1 === 'Next' && d.pearl, { state: d.state, li: d.li, b1: d.b1 });
  await T(2); const stay = (await cur()).i; await page.keyboard.press('Enter'); await settle(); c = await cur();
  ok('Enter goes on', stay === 0 && c.i === 1 && c.state === 'ask', { stay, now: c.i });
  // the second: three misses
  for (let k = 0; k < 3; k++) await click(40 + 25 * k, 40);
  d = await cur();
  ok('after three misses the structure is shown', d.state === 'shown' && d.tries === 3 && d.li === c.nm && /here it is/.test(d.toast + ' ') || d.state === 'shown', { state: d.state, tries: d.tries, toast: d.toast });
  await page.click('#stepBtn1'); await settle(); c = await cur();
  // the third: Show me
  await page.click('#stepBtn1'); await T(0.2); d = await cur();
  ok('Show me gives the answer', d.state === 'shown' && d.tries === 0 && d.i === 2 && d.li === c.nm, { state: d.state });
  await page.keyboard.press(' '); await settle();
  // the rest: right first time, with one wrong side on the way, in a view that shows both
  const wrong = [], stuck = []; let side = null, right = 0;
  for (let g = 0; g < 60; g++) {
    c = await cur(); if (c.ended) break;
    if (!side && c.bi && c.mid) { await click(c.o.x, c.o.y); d = await cur(); side = { id: c.id, state: d.state, tries: d.tries, toast: d.toast }; await click(c.x, c.y); d = await cur(); side.then = d.state; await page.keyboard.press('Enter'); await settle(); continue; }
    await click(c.x, c.y); d = await cur();
    if (d.state !== 'right') { wrong.push(c.id + ':' + d.state + ' ' + d.toast); await ev(() => window.__sim.axGo(window.__sim.S.step + 1)); await settle(); continue; }
    right++; await away(); await T(1.6); d = await cur(); if (!d.ended && d.i !== c.i + 1) stuck.push(c.id); await T(2.6);
  }
  ok('the same structure on the other side is a miss, and says which side it was', !!side && side.state === 'ask' && side.tries === 1 && /That is the (left|right) /.test(side.toast) && side.then === 'found', side);
  ok('every other structure is found first time by a click on its mark, in the view it is asked in', !wrong.length && right === 43, { right, wrong });
  ok('a right answer moves on by itself', !stuck.length, stuck);
  m = await ev(() => { const s = window.__sim, t = id => document.getElementById(id).textContent; return { ended: s.S.ended, shown: !document.getElementById('debrief').hidden, title: t('dbTitle'), grade: t('dbGrade'), score: t('dbScore'), heads: [0, 1, 2, 3].map(i => t('dbH' + i)), notes: [...document.querySelectorAll('#dbNotes li')].map(l => l.textContent), a: t('dbA'), b: [...document.querySelectorAll('#dbB .row')].map(r => r.textContent), cRows: document.querySelectorAll('#dbC .row').length, miss: document.querySelectorAll('.checklist li.miss').length }; });
  ok('the results: 43 of 47 right first time, 91 of 100, with the four to revise and how each went', m.ended && m.shown && m.title === 'Results' && /^43 of 47 right first time\. Find it, both tiers\.$/.test(m.grade) && m.score === '91' && m.notes.length === 4 && m.notes.filter(n => /found after 1 miss/.test(n)).length === 2 && m.notes.filter(n => /shown after 3 misses/.test(n)).length === 1 && m.notes.filter(n => /: shown$/.test(n)).length === 1 && m.miss === 4, { grade: m.grade, score: m.score, notes: m.notes });
  const sum = m.b.map(r => r.match(/(\d+) of (\d+)$/)).reduce((a, x) => [a[0] + +x[1], a[1] + +x[2]], [0, 0]);
  ok('they are broken down by region, in the order of the tour, and by the slowest', m.heads.join() === 'To revise,Summary,By region,Slowest' && m.b.length === 8 && /^Uterus and adnexa/.test(m.b[0]) && /^Avascular spaces/.test(m.b[7]) && sum[0] === 43 && sum[1] === 47 && m.cRows === 6 && /Found after a miss2/.test(m.a) && /Shown2/.test(m.a), { regions: m.b, sum });
  // ---- Name it ----
  await page.click('#dbRestart'); await page.waitForTimeout(60);
  await page.click('#caseOpts button:has-text("Name it")'); await page.click('#btnBegin'); await T(0.3);
  const item = () => ev(() => { const s = window.__sim, st = s.STEPS[s.S.step], q = st.q, V = new s.THREE.Vector3(), p = q.at(st.k, V), pr = s.proj(p.toArray()), el = document.getElementById('ov').getBoundingClientRect(); s.ui();
    const ch = [...document.querySelectorAll('#stepChoices button')].map(b => ({ t: b.textContent.replace(/^\d\s+/, ''), cls: b.className })), want = q.a || q.n;
    return { i: s.S.step, n: s.STEPS.length, id: st.id, isQ: !!q.q, state: st.state, title: document.getElementById('stepTitle').textContent, ch, right: ch.findIndex(c => c.t === want), nRight: ch.filter(c => c.t === want).length, distinct: new Set(ch.map(c => c.t)).size, sided: ch.some(c => /^(Right|Left) /.test(c.t)), names: s.AXS.map(x => x.n),
      inPic: pr.x > 16 && pr.x < el.width - 16 && pr.y > 16 && pr.y < el.height - 16, vis: !!q.area || s.visibleAt(p, 0.8), li: document.getElementById('cl-' + s.S.step).textContent.trim(), ended: s.S.ended, want, q: q.q || '' }; });
  await T(4.3); let it = await item();
  ok('Name it has 55 items: the 47 structures and the 8 questions', it.n === 55 && await ev(() => window.__sim.STEPS.filter(x => x.q.q).length) === 8, { n: it.n });
  ok('a structure is marked and four names are offered; the list does not name it', it.title === (it.isQ ? it.q : 'What is the structure marked?') && it.ch.length === 4 && it.li === 'Structure 1', { title: it.title, ch: it.ch.map(c => c.t), li: it.li });
  // the first: a wrong name, by a click
  const w0 = (it.right + 1) % 4; await page.click('#stepChoices button:nth-child(' + (w0 + 1) + ')'); await T(0.2); let jt = await item();
  ok('a wrong name is marked wrong, the right one is shown, and it waits', jt.state === 'wrong' && /no/.test(jt.ch[w0].cls) && /ok/.test(jt.ch[it.right].cls) && jt.ch.filter(c => /dim/.test(c.cls)).length === 2 && jt.i === 0, { state: jt.state, cls: jt.ch.map(c => c.cls) });
  await T(2); await page.keyboard.press(' '); await T(4.3); it = await item();
  // the second: Show me
  await page.click('#stepBtn1'); await T(0.2); jt = await item(); const shown = jt.state; await page.keyboard.press('Enter'); await T(4.3);
  const bad = [], hid = [], notRight = [], qs = []; let n = 0;
  for (let g = 0; g < 70; g++) {
    it = await item(); if (it.ended) break;
    if (it.ch.length !== 4 || it.distinct !== 4 || it.nRight !== 1 || (!it.isQ && (it.sided || it.ch.some(c => !it.names.includes(c.t))))) bad.push(it.id + ': ' + it.ch.map(c => c.t).join(' | '));
    if (!it.inPic || !it.vis) hid.push(it.id);
    if (it.isQ) qs.push(it.title === it.q);
    if (n % 2) await page.keyboard.press(String(it.right + 1)); else await page.click('#stepChoices button:nth-child(' + (it.right + 1) + ')');
    await T(0.2); jt = await item(); if (jt.state !== 'right' || !/ok/.test(jt.ch[it.right].cls)) notRight.push(it.id + ':' + jt.state);
    n++; await T(1.6); await T(2.8);
  }
  ok('every item offers four different names, exactly one of them right; a structure\'s wrong names are other structures, without a side', !bad.length, bad);
  ok('what is asked about is in the picture and seen, every time', !hid.length, hid);
  ok('the eight questions are asked in words, where the structures they are about are in view', qs.length >= 7 && qs.every(x => x), { asked: qs.length });
  ok('the right name, by a click or by its number, is marked right and moves on', !notRight.length && n === 53 && shown === 'shown', { n, notRight, shown });
  m = await ev(() => { const s = window.__sim, t = id => document.getElementById(id).textContent; return { ended: s.S.ended, grade: t('dbGrade'), score: t('dbScore'), notes: [...document.querySelectorAll('#dbNotes li')].map(l => l.textContent), a: t('dbA'), b: [...document.querySelectorAll('#dbB .row')].map(r => r.textContent), log: document.querySelectorAll('#dbLog li').length }; });
  ok('the results: 53 of 55, 96 of 100, the wrong name that was given, and the questions as a region of their own', m.ended && /^53 of 55 right first time\. Name it, both tiers\.$/.test(m.grade) && m.score === '96' && m.notes.length === 2 && m.notes.some(x => /answered "/.test(x)) && m.notes.some(x => /: shown$/.test(x)) && m.b.length === 9 && /^Relationships/.test(m.b[8]) && /^Questions55/.test(m.a) && m.log === 55, { grade: m.grade, score: m.score, notes: m.notes, last: m.b[8] });
  // ---- one tier alone ----
  await page.click('#dbRestart'); await page.waitForTimeout(60); await page.click('#caseOpts button:has-text("Under the peritoneum")');
  m = await ev(() => { const s = window.__sim; return { n: s.STEPS.length, q: s.STEPS.filter(x => x.q.q).length, t: s.STEPS.every(x => x.q.t === 2), blurb: document.querySelector('#caseList .case.on span').textContent }; });
  ok('Under the peritoneum alone: the 18 structures and the 5 questions about them', m.n === 23 && m.q === 5 && m.t, m);
  await ev(() => { localStorage.removeItem('tlh.anat.v1'); });
}
