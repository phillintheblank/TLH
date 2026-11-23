// ---------- the cases ----------
// A case is its steps (each with its own targets, checks and teaching text), the instruments on its tray, how its
// pelvis differs from the model's, and how it is scored. Everything else is shared.
const BUILD = 'Build 1.0';
const CASES = SITE ? { tlh: TLH } : { tlh: TLH, myo: MYO, ect: ECT, cyst: CYS, lsh: LSH, scp: SCP }; // the review site carries the hysterectomy alone: the other cases' files are not in its page

// ---------- step engine (every case) ----------
let stepExpoChecked = false, stepPressed = false;
function enterStep(i) {
  S.step = i; stepExpoChecked = false; stepPressed = false; S.stepAt[i] = S.t; // when each step was begun, for the results
  const st = STEPS[i];
  if (st.acc != null) st.acc = 0;
  if (st.enter && S.running) st.enter();
  CAM.pan.set(0, 0, 0); CAM.userIns = 0;
  uiDirty(true);
}
function checkExposure() {
  if (stepExpoChecked) return; stepExpoChecked = true;
  const st = STEPS[S.step];
  if (st.expo && st.expo.some(e => !e.ok())) { S.stats.expoMiss++; if (S.guided) hint('expo', 'Exposure is not set for this step. See the checklist on the right.'); }
}
function updateSteps(dt) {
  if (!S.running || S.ended) return;
  S.t += dt; if (DEPTH.auto && CTRL.mode === 'mouse') S.stats.autoT += dt;
  S.pressure = damp(S.pressure, S.pressureGoal, 1.2, dt);
  const st = STEPS[S.step];
  if (st.tick) st.tick(dt);
  if (stepPressed && HANDS.some(h => h.firing && h.inst !== 'suction')) checkExposure();
  if (!S.bleeders.length && st.done()) {
    if (S.step < STEPS.length - 1) { sfx.ok(); toast('Done: ' + st.short, 'ok'); enterStep(S.step + 1); }
  }
  const f = st.focus(_w); CAM.goal.copy(f); CAM.goal.y -= 0.2;
  CAM.insGoal = CAM.goal.distanceTo(CAM.pivot) - (st.dist || 12);
}
function endCase() {
  if (S.ended) return;
  S.ended = true; S.running = false; stopSustain();
  showDebrief();
}
