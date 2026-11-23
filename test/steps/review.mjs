// The review site (laparoscape.com): the hysterectomy alone, mouse only, under its own name, with a welcome sheet
// that asks the reviewers' questions and a button that copies their results. Run with ROOT=dist/laparoscape.
const OUT = new URL('../out/', import.meta.url).pathname;
export default async function (page) {
  const ev = (fn, a) => page.evaluate(fn, a);
  const ok = (name, pass, info) => console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  const asked = []; page.on('request', r => asked.push(new URL(r.url()).host)); // every request the page makes, from a fresh load
  await page.reload(); await page.waitForTimeout(1500); const own = new URL(page.url()).host;
  await page.screenshot({ path: OUT + 'rv-1.png' });
  await ev(() => { const s = document.querySelector('#startCard .sheet'); s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + 'rv-2.png' });
  const w = await ev(() => ({ title: document.title, h1: document.querySelector('.brand h1').textContent, h1shown: getComputedStyle(document.querySelector('.brand h1')).textTransform, sub: document.getElementById('brandSub').textContent, robots: document.querySelector('meta[name=robots]').content,
    cases: Object.keys(window.__sim.CASES), caseList: document.getElementById('caseList').hidden, hands: !!document.getElementById('btnHands') || !!document.getElementById('btnBeginHands') || !!document.getElementById('calModal') || !!document.querySelector('video'),
    begin: document.getElementById('btnBegin').textContent, asks: document.querySelectorAll('#startCard .asks li').length, mail: document.querySelector('#startCard a[href^=mailto]').getAttribute('href'), by: document.querySelector('.by').textContent, touch: document.getElementById('touchNote').hidden,
    auto: window.__sim.DEPTH.auto, mode: window.__sim.CTRL.mode, text: document.querySelector('#startCard .sheet').textContent.replace(/\s+/g, ' ') }));
  ok('the page is named laparoscape, in lower case, with its review label', w.title.startsWith('laparoscape') && w.h1 === 'laparoscape' && w.h1shown === 'none' && w.sub.startsWith('Review 1.0'), { title: w.title, h1: w.h1, sub: w.sub });
  ok('it asks search engines not to list it', /noindex/.test(w.robots), w.robots);
  ok('it carries the hysterectomy alone, with nothing to choose between', w.cases.join() === 'tlh' && w.caseList, { cases: w.cases });
  ok('it has no hand control: no button, no calibration, no camera', !w.hands && w.mode === 'mouse' && !/hand control|camera/i.test(w.text), { hands: w.hands });
  ok('manual depth to start, and Auto depth is offered', w.auto === false && !!(await page.$('#btnAuto')) && /Auto depth/.test(w.text), { auto: w.auto });
  ok('the welcome sheet asks the seven questions, gives the address for feedback, and is signed small', w.asks === 7 && /which would you want for your learners/.test(w.text) && /before sharing it with your learners/.test(w.text) && w.mail.startsWith('mailto:feedback@laparoscape.com') && w.by === 'Phillip Connell, MD', { asks: w.asks, mail: w.mail, by: w.by });
  ok('it says what it is not, and that a trackpad works', /not been validated/.test(w.text) && /not for patient care/.test(w.text) && /a trackpad also works/.test(w.text) && w.touch);
  // ?case=myo in the address still gives the hysterectomy
  ok('another case named in the address is not there to be had', await ev(() => { window.__sim.setCase('myo'); return window.__sim.CASE.id === 'tlh'; }));
  // play it through by rule to the end, switching Auto depth on for a while, and read the debrief
  await page.click('#btnBegin');
  const T = dt => ev(n => { for (let i = 0; i < n; i++) window.__sim.tick(0.033); }, Math.ceil(dt / 0.033));
  await T(2); await page.click('#btnAuto'); await T(3); await page.click('#btnAuto'); await T(1);
  await ev(() => { const s = window.__sim; let g = 0; while (s.STEPS[s.S.step].id !== 'final' && g++ < 40) { s.forceStep(); for (let i = 0; i < 60; i++) s.tick(0.033); } s.S.lowP = true; s.S.ureterOK.R = s.S.ureterOK.L = true; s.STEPS[s.S.step].button2.fn(); s.render(); });
  await page.waitForTimeout(300); await page.screenshot({ path: OUT + 'rv-3.png' });
  await ev(() => { const s = document.querySelector('#debrief .sheet'); s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(200); await page.screenshot({ path: OUT + 'rv-4.png' });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('#dbCopy'); await page.waitForTimeout(400);
  const clip = await ev(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message)), said = await ev(() => document.getElementById('dbCopied').textContent);
  if (process.env.VERBOSE) console.log('---- clipboard ----\n' + clip + '\n---- end ----');
  ok('Copy my results puts the questions, the score, the time in each depth mode, the time on each of the 21 steps and the event log on the clipboard', /^laparoscape Review 1\.0 feedback/.test(clip) && (clip.match(/^\d\. .*\?$/gm) || []).length === 7 && /Score: \d+ \/ 100/.test(clip) && /0:0[23] with Auto depth on/.test(clip) && (clip.match(/^\d+\. .*: \d+:\d\d$/gm) || []).length === 21 && /Event log/.test(clip) && /Copied/.test(said), { said, length: clip.length });
  const others = [...new Set(asked.filter(h => h !== own))];
  ok('from load to debrief the page asked only for its own files and its typefaces', asked.length >= 2 && others.every(h => h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com'), { requests: asked.length, otherHosts: others });
  // a phone-sized window is told what it needs
  await page.setViewportSize({ width: 600, height: 900 }); await page.reload(); await page.waitForTimeout(1200);
  const t = await ev(() => { const n = document.getElementById('touchNote'); return { shown: !n.hidden, text: n.textContent }; });
  await page.screenshot({ path: OUT + 'rv-5.png' });
  ok('a small or touch-only screen is told that it needs a computer with a mouse or trackpad', t.shown && /mouse or trackpad/.test(t.text), t);
}
