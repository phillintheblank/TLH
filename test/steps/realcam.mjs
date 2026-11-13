// Real pipeline smoke test: Chrome's fake camera -> getUserMedia -> MediaPipe wasm + model -> detectForVideo.
// The fake camera shows a test pattern, so no hands are found; this checks that everything loads and runs.
export default async function (page) {
  await page.evaluate(() => document.getElementById('btnBeginHands').click()); // not page.click: with the frame loop live on a software renderer, its wait for a quiet page can time out
  const t0 = Date.now(); let st = '';
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); st = await page.evaluate(() => window.__sim.HT.status + '|' + window.__sim.HT.msg); if (!st.startsWith('loading')) break; }
  console.log('status after ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s: ' + st);
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => { const H = window.__sim.HT, c = H.cams[0], v = c.video; return { status: H.status, cameras: H.n, devices: H.devices.length, frames: c.fpsN, fps: c.fps, video: v ? [v.videoWidth, v.videoHeight, v.readyState] : null, landmarker: !!c.landmarker, pickers: [document.getElementById('camSelA').options.length, document.getElementById('camSelB').options.length], note: H.calib ? H.calib.note : null, mode: window.__sim.CTRL.mode }; });
  console.log(JSON.stringify(r));
  console.log(r.status === 'calibrating' && r.landmarker && r.video && r.video[2] >= 2 && (r.frames > 0 || r.fps > 0) ? 'PASS real camera + model pipeline runs' : 'FAIL real pipeline');
  if (r.devices < 2) { console.log('NOTE one camera here (CAMS=2 gives Chrome a second fake camera): the two-camera path was not exercised'); return; }
  // choose the second camera, as the setup screen's chooser does: both streams open and each gets its own tracker
  await page.evaluate(() => { const B = document.getElementById('camSelB'); B.value = [...B.options].map(o => o.value).filter(Boolean)[0]; B.dispatchEvent(new Event('change', { bubbles: true })); });
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); st = await page.evaluate(() => window.__sim.HT.status + '|' + window.__sim.HT.n); if (st === 'calibrating|2') break; }
  await page.waitForTimeout(5000);
  const q = await page.evaluate(() => { const H = window.__sim.HT; return { status: H.status, cameras: H.n, steps: document.getElementById('calCount').textContent, second: !document.getElementById('calCanvas2').hidden, cams: H.cams.map(c => ({ label: c.label, ready: c.video ? c.video.readyState : -1, size: c.video ? [c.video.videoWidth, c.video.videoHeight] : null, tracker: !!c.landmarker, frames: c.fpsN, fps: c.fps })) }; });
  console.log(JSON.stringify(q));
  console.log(q.status === 'calibrating' && q.cameras === 2 && q.second && q.cams.every(c => c.ready >= 2 && c.tracker && (c.frames > 0 || c.fps > 0)) && q.cams[0].label !== q.cams[1].label ? 'PASS two cameras open together, each with its own tracker running' : 'FAIL two cameras');
}
