// The pelvic anatomy case: the table of structures, the start sheet, and the tour on both sides. For every structure,
// in the tour's view of it and again in the view it is asked for in (which does not lean toward it): its mark is in
// the picture, the scope sees it there, a click on the mark falls on the structure itself, and it stands clear of the
// marks of the other structures in the same view. Then the window in the
// peritoneum, the names under the pointer, the probe, getting about the tour, and leaving the case as it was found.
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  await ev(() => { window.__simPause = true; });
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  const before = await ev(() => { const s = window.__sim; return { picks: s.PICKS.length, cls: document.getElementById('app').className }; });
  // ---- the table ----
  const tab = await ev(() => {
    const s = window.__sim, A = s.AXS, ids = A.map(q => q.id), bad = [];
    for (const q of A) { if (!q.n || !q.g || !s.AXV[q.v] || typeof q.at !== 'function' || typeof q.hit !== 'function' || !(q.f && q.f.length) || !q.w || ![1, 2].includes(q.t)) bad.push(q.id); }
    const qs = s.AXQ.map(q => ({ id: q.id, ok: !!q.q && !!q.a && !!q.s && !!q.w && q.d.length === 3 && !q.d.includes(q.a) && new Set(q.d).size === 3 && !!s.AXV[q.v] }));
    const groups = []; for (const q of A) if (!groups.includes(q.g)) groups.push(q.g);
    return { n: A.length, t1: A.filter(q => q.t === 1).length, t2: A.filter(q => q.t === 2).length, uniq: new Set(ids).size === ids.length, bad, qs, groups, left: A.filter(q => q.left).map(q => q.id) };
  });
  ok('47 structures, 29 seen at the surface and 18 under the peritoneum, each with a view, a place to mark, what to look for and why it matters', tab.n === 47 && tab.t1 === 29 && tab.t2 === 18 && tab.uniq && !tab.bad.length, { n: tab.n, t1: tab.t1, t2: tab.t2, bad: tab.bad });
  ok('they are listed under eight regions', tab.groups.length === 8, tab.groups);
  ok('eight questions on how structures lie to one another, each with one right answer and three different wrong ones', tab.qs.length === 8 && tab.qs.every(q => q.ok), tab.qs.filter(q => !q.ok));
  // ---- the start sheet ----
  await page.click('#caseList .case:nth-child(7)'); await page.waitForTimeout(60);
  let m = await ev(() => { const s = window.__sim; return { id: s.CASE.id, cases: document.querySelectorAll('#caseList .case').length, opts: [...document.querySelectorAll('#caseOpts button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), begin: document.getElementById('btnBegin').textContent, hands: getComputedStyle(document.getElementById('btnBeginHands')).display === 'none' || document.getElementById('btnBeginHands').hidden, keys: document.querySelectorAll('#helpKeys li').length, std: document.getElementById('helpStd').hidden, title: document.getElementById('stepTitle').textContent }; });
  ok('it is the seventh case on the start sheet, with its own choices: what to do, and which structures', m.id === 'anat' && m.cases === 7 && m.opts.length === 6 && /^Tour/.test(m.opts[0]) && /^Find it/.test(m.opts[1]) && /^Name it/.test(m.opts[2]), m.opts);
  ok('it has its own list of controls in place of the operating ones, and no hand-control start', m.keys >= 8 && m.std && m.hands, { keys: m.keys, std: m.std, hands: m.hands, begin: m.begin });
  await page.click('#caseOpts button:has-text("Find it")'); await page.click('#caseOpts button:has-text("At the surface")');
  m = await ev(() => { const s = window.__sim; return { mode: s.AX.mode, set: s.AX.set, n: s.STEPS.length, kept: localStorage.getItem('tlh.anat.v1'), title: document.getElementById('stepTitle').textContent }; });
  ok('choosing Find it and At the surface makes a list of the 29 surface structures, and the choice is kept for next time', m.mode === 'find' && m.set === 'surface' && m.n === 29 && /"mode":"find"/.test(m.kept) && /"set":"surface"/.test(m.kept), m);
  await page.click('#caseOpts button:has-text("Tour")'); await page.click('#caseOpts button:has-text("Both")');
  m = await ev(() => { const s = window.__sim; s.ui(); return { n: s.STEPS.length, title: document.getElementById('stepTitle').textContent, no: document.getElementById('stepNo').textContent, ids: s.STEPS.map(x => x.id).join() }; });
  ok('a tour of both tiers has 49 stops: the 47 structures, and the ureter at the brim and the hypogastric nerve again on the left, where they differ', m.n === 49 && /urbrimR,urbrimL/.test(m.ids) && /hgnR,hgnL/.test(m.ids), { n: m.n });
  ok('before it is begun the card already names the first stop', m.title === 'Uterine fundus' && /^1 of 49$/.test(m.no), { title: m.title, no: m.no });
  // ---- the tour: every mark, on the right and then on the left ----
  await page.click('#btnBegin'); await T(0.5);
  const walk = (side, mode) => ev(a => {
    const s = window.__sim, V3 = s.THREE.Vector3, out = { n: 0, off: [], hid: [], other: [], near: [], win: [], min: 999 }, MID = { survey: 1, ant: 1, post: 1, prom: 1, vvs: 1, rvs: 1 };
    const el = document.getElementById('ov').getBoundingClientRect(), W = el.width, H = el.height;
    for (let i = 0; i < s.STEPS.length; i++) {
      const st = s.STEPS[i], q = st.q, mid = MID[q.v]; if (a.mode === 'tour' && a.side === 'L' && (mid || st.k !== 'L')) continue;
      s.axGo(i); for (let t = 0; t < 135; t++) s.tick(0.033);
      const v = s.axV(st), k0 = st.k || 'R';
      if (!!v.win !== (s.AX.win[k0].g > 0.95) || s.AX.win[k0 === 'R' ? 'L' : 'R'].g > 0.01) out.win.push(st.id);
      for (const k of s.axSides(st)) {
        out.n++; const p = q.at(k, new V3()), pr = s.proj(p.toArray()), id = q.id + (k || '');
        if (pr.x < 20 || pr.x > W - 20 || pr.y < 20 || pr.y > H - 20) out.off.push(id + ' ' + Math.round(pr.x) + ',' + Math.round(pr.y));
        if (!s.visibleAt(p, 0.8)) out.hid.push(id);
        const P = s.axPickAt(p); if (!P.hit || !q.hit(P, q.bi ? k || 'R' : null)) out.other.push(id + ': ' + (s.axWhat(P) || P.ent));
        if (!q.area) for (const o of s.AXS) if (o !== q && o.v === q.v && !o.area) for (const j of o.bi ? (mid ? ['R', 'L'] : [k0]) : [null]) { const r = s.proj(o.at(j, new V3()).toArray()), d = Math.hypot(r.x - pr.x, r.y - pr.y); out.min = Math.min(out.min, d); if (d < 34) out.near.push(id + '-' + o.id + (j || '') + ' ' + d.toFixed(0)); }
      }
    }
    out.min = Math.round(out.min); return out;
  }, { side, mode });
  for (const side of ['R', 'L']) {
    if (side === 'L') { await ev(() => { const s = window.__sim; s.AX.tourSide = 'L'; s.startCase(false); }); await T(0.5); }
    const w = await walk(side, 'tour'), nm = side === 'R' ? 'right' : 'left';
    ok('the tour on the ' + nm + ': every mark is in the picture', w.n === (side === 'R' ? 57 : 29) && !w.off.length, { marks: w.n, off: w.off });
    ok('the tour on the ' + nm + ': the scope sees every structure where it is marked', !w.hid.length, w.hid);
    ok('the tour on the ' + nm + ': a click on each mark falls on the structure it marks', !w.other.length, w.other);
    ok('the tour on the ' + nm + ': no two structures are marked within a ring\'s width of each other in the same view', !w.near.length, { nearest: w.min, near: w.near });
    ok('the tour on the ' + nm + ': the sidewall\'s peritoneum is open in the views of the retroperitoneum, on that side only, and whole in the others', !w.win.length, w.win);
  }
  // ---- and as each is asked for: one side at a time, the scope not leaning toward it ----
  for (const side of ['R', 'L']) {
    await ev(k => { const s = window.__sim; s.AX.mode = 'find'; s.AX.fixed = true; s.AX.testSide = k; s.startCase(false); }, side); await T(0.5);
    const w = await walk(side, 'find');
    ok('asked for on the ' + (side === 'R' ? 'right' : 'left') + ': all 47 are in the picture, seen, their own under a click, and clear of each other', w.n === 47 && !w.off.length && !w.hid.length && !w.other.length && !w.near.length && !w.win.length, { marks: w.n, off: w.off, hid: w.hid, other: w.other, near: w.near, win: w.win, nearest: w.min });
  }
  // ---- the window in the peritoneum ----
  await ev(() => { const s = window.__sim; s.AX.mode = 'tour'; s.AX.testSide = null; s.AX.fixed = false; s.AX.tourSide = 'R'; s.startCase(false); }); await T(0.5);
  const box = await page.locator('#ov').boundingBox();
  const go = async id => { await ev(id => { const s = window.__sim; s.axGo(s.STEPS.findIndex(x => x.id === id)); }, id); await T(4.4); };
  const seen = id => ev(id => { const s = window.__sim, st = s.STEPS[s.S.step], p = st.q.at(st.k, new s.THREE.Vector3()), P = s.axPickAt(p); return { step: st.id, g: +s.AX.win.R.g.toFixed(2), peel: +s.peelAt(p).toFixed(2), vis: s.visibleAt(p, 0.3), own: !!P.hit && st.q.hit(P, st.k), what: s.axWhat(P), choice: [...document.querySelectorAll('#stepChoices button')].map(b => b.textContent).join() }; }, id);
  const shut = [];
  for (const id of ['iiaR', 'obnR', 'hgnR', 'lprR']) {
    await go(id); await ev(() => window.__sim.ui()); const a = await seen(id);
    await page.keyboard.press('p'); await T(2.5); await ev(() => window.__sim.ui()); const b = await seen(id);
    await page.click('#stepChoices button'); await T(2.5); const c = await seen(id);
    shut.push({ id, open: [a.g, a.own, a.choice], back: [b.g, b.own, b.what, b.choice], again: [c.g, c.own] });
  }
  ok('P puts the peritoneum back over an opened sidewall, and what lay under it can no longer be pointed at; the button on the card opens it again', shut.every(x => x.open[0] > 0.95 && x.open[1] && /Put the peritoneum back/.test(x.open[2]) && x.back[0] < 0.05 && !x.back[1] && /Open the peritoneum/.test(x.back[3]) && x.again[0] > 0.95 && x.again[1]), shut);
  await go('antleaf');
  m = await ev(() => { const s = window.__sim, A = s.AX.c.R.umb.A, V = new s.THREE.Vector3(); let n = 0; for (let i = 2; i < 24; i++) if (s.visibleAt(A[i], 0.25)) n++; const f = s.AXS.find(q => q.id === 'mfold'), P = s.axPickAt(f.at('R', V)); return { pelvic: n, fold: !!P.hit && f.hit(P, 'R') }; });
  ok('with the peritoneum whole, the obliterated umbilical artery is not seen in the pelvis: only the fold it raises on the front wall', m.pelvic === 0 && m.fold, m);
  await go('umbR');
  m = await ev(() => { const s = window.__sim, A = s.AX.c.R.umb.A; let n = 0; for (let i = 4; i < 24; i++) if (s.visibleAt(A[i], 0.25)) n++; return { pelvic: n }; });
  ok('with the sidewall opened it is seen as a cord from the internal iliac artery to the front wall', m.pelvic >= 10, m);
  // ---- names under the pointer, and the probe ----
  const point = async id => { const a = await ev(id => { const s = window.__sim, st = s.STEPS[s.S.step], q = s.AXS.find(x => x.id === id), p = q.at(st.k || 'R', new s.THREE.Vector3()), pr = s.proj(p.toArray()); return pr; }, id); await page.mouse.move(box.x + a.x, box.y + a.y, { steps: 3 }); await T(0.6); return ev(() => { const s = window.__sim; return { what: s.axWhat(s.PICK), active: s.active, L: s.HAND.L.grp.visible, R: s.HAND.R.grp.visible, x: s.PICK.hit }; }); };
  await go('ovaryR'); const names = [];
  for (const [id, want] of [['ovary', 'Right ovary'], ['tube', 'Right fallopian tube'], ['ip', 'Right infundibulopelvic ligament'], ['uo', 'Right utero-ovarian ligament']]) { const r = await point(id); names.push([want, r.what]); }
  ok('in a tour, pointing at a structure names it', names.every(x => x[0] === x[1]), names);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 3 }); await T(0.6); const pl = await ev(() => { const s = window.__sim; return [s.active, s.HAND.L.grp.visible, s.HAND.R.grp.visible, s.HAND.L.inst]; });
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 3 }); await T(0.6); const pr = await ev(() => { const s = window.__sim; return [s.active, s.HAND.L.grp.visible, s.HAND.R.grp.visible, s.HAND.R.inst]; });
  await page.mouse.move(box.x + box.width + 40, box.y + 10, { steps: 2 }); await T(0.4); const po = await ev(() => { const s = window.__sim; return [s.HAND.L.grp.visible, s.HAND.R.grp.visible]; });
  ok('the probe comes in from the side the pointer is on, one probe at a time, and leaves the picture when the pointer does', pl[0] === 'L' && pl[1] && !pl[2] && pl[3] === 'suction' && pr[0] === 'R' && !pr[1] && pr[2] && !po[0] && !po[1], { left: pl, right: pr, away: po });
  m = await ev(() => { const g = id => getComputedStyle(document.querySelector(id)).display; return { tools: g('.tools'), mouse: g('.mousepanel'), metrics: g('.metrics'), map: g('.axmap'), manip: g('#manip') }; });
  ok('the instrument tray, the depth controls and the energy record are put away; the manipulator stays, with the map of where the scope is looking', m.tools === 'none' && m.mouse === 'none' && m.metrics === 'none' && m.map !== 'none' && m.manip !== 'none', m);
  m = await ev(() => { const cv = document.getElementById('axMap'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let teal = 0, any = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 40) any++; if (d[i + 3] > 150 && d[i + 1] > 150 && d[i + 2] > 140 && d[i] < 120) teal++; } return { any, teal }; });
  ok('the map is drawn: the pelvis in outline, and the frame of the picture in hand', m.any > 1500 && m.teal > 60, m);
  // ---- getting about ----
  await ev(() => window.__sim.axGo(0)); await T(0.4); await ev(() => window.__sim.ui());
  const card = () => ev(() => { const s = window.__sim; s.ui(); return { i: s.S.step, title: document.getElementById('stepTitle').textContent, text: document.getElementById('stepText').textContent, pearl: document.getElementById('stepPearl').textContent, tag: document.getElementById('pearlTag').textContent, b1: document.getElementById('stepBtn1').textContent, b2: document.getElementById('stepBtn2').hidden, running: s.S.running, start: !document.getElementById('startCard').hidden }; });
  let c = await card(); const q0 = await ev(() => { const q = window.__sim.AXS[0]; return { f: q.f.join(''), w: q.w }; });
  ok('each stop shows the structure\'s name, where it is and how to know it, and why it matters', c.title === 'Uterine fundus' && c.text === q0.f && c.pearl === q0.w && c.tag === 'Why it matters' && c.b1 === 'Next' && c.b2, c);
  await page.click('#stepBtn1'); await T(0.2); const s1 = (await card()).i; await page.keyboard.press(' '); await T(0.2); const s2 = (await card()).i; await page.keyboard.press('b'); await T(0.2); const s3 = (await card()).i; await page.click('#stepBtn2'); await T(0.2); const s4 = (await card()).i;
  await page.click('#cl-20'); await T(0.2); const s5 = (await card()).i;
  ok('Next and Space go on, Back and B go back, and a click in the list goes straight to a structure', s1 === 1 && s2 === 2 && s3 === 1 && s4 === 0 && s5 === 20, [s1, s2, s3, s4, s5]);
  await page.keyboard.press('g'); await T(0.1); const g1 = await ev(() => window.__sim.S.guided); await page.keyboard.press('g'); await page.keyboard.press('l'); await T(0.1); const l1 = await ev(() => window.__sim.S.labels); await page.keyboard.press('l');
  ok('G hides the marks and L names everything in the view', g1 === false && l1 === true, { guided: g1, labels: l1 });
  await ev(() => window.__sim.axGo(48)); await T(0.3); c = await card();
  await page.click('#stepBtn1'); await T(0.3); const end = await card();
  ok('the last stop\'s button finishes the tour and returns to the start sheet, with no score', c.b1 === 'Finish the tour' && !end.running && end.start && await ev(() => document.getElementById('debrief').hidden), { b1: c.b1, running: end.running, start: end.start });
  // ---- leaving it as it was found ----
  await page.click('#caseList .case:nth-child(1)'); await page.waitForTimeout(60); await T(0.3);
  m = await ev(() => { const s = window.__sim; return { id: s.CASE.id, picks: s.PICKS.length, shown: s.AX.picks.filter(x => x.visible).length, open: s.PEEL.a.value.filter(v => v.w > 0).length, ur: s.URETER.R.tube.on && s.URETER.L.tube.on, il: s.AN.iliacR.ta.on && s.AN.iliacL.tv.mesh.visible, cls: document.getElementById('app').className, hands: [s.HAND.L.inst, s.HAND.R.inst, s.HAND.L.grp.visible, s.HAND.R.grp.visible], leaves: ['antL', 'roofL', 'postL'].every(p => s.AN.side.R.st[p].mesh.visible && s.AN.side.L.st[p].mesh.visible), tools: getComputedStyle(document.querySelector('.tools')).display, map: getComputedStyle(document.querySelector('.axmap')).display, begin: document.getElementById('btnBegin').textContent }; });
  ok('choosing the hysterectomy again puts everything back: nothing of the anatomy case is left in the scene or among what can be picked, no window is open, and the instruments and the tray return', m.id === 'tlh' && m.picks === before.picks && m.shown === 0 && m.open === 0 && m.ur && m.il && m.cls === before.cls && m.hands.join() === 'grasper,bipolar,true,true' && m.leaves && m.tools !== 'none' && m.map === 'none', m);
}
