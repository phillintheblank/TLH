// Real pipeline smoke test: Chrome's fake camera -> getUserMedia -> MediaPipe wasm + model -> detectForVideo.
// The fake camera shows a test pattern, so no hands are found; this checks that everything loads and runs.
export default async function (page) {
  await page.click('#btnBeginHands');
  const t0 = Date.now(); let st = '';
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); st = await page.evaluate(() => window.__sim.HT.status + '|' + window.__sim.HT.msg); if (!st.startsWith('loading')) break; }
  console.log('status after ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s: ' + st);
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => { const H = window.__sim.HT, v = H.video; return { status: H.status, frames: H.fpsN, fps: H.fps, video: v ? [v.videoWidth, v.videoHeight, v.readyState] : null, landmarker: !!H.landmarker, note: H.calib && H.calib.note, dets: H.dets.length, mode: window.__sim.CTRL.mode }; });
  console.log(JSON.stringify(r));
  console.log(r.status === 'calibrating' && r.landmarker && r.video && r.video[2] >= 2 && (r.frames > 0 || r.fps > 0) ? 'PASS real camera + model pipeline runs' : 'FAIL real pipeline');
}
