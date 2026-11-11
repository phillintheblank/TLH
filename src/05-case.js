/* ================= the case: instruments, steps, tasks ================= */
const TOOLS = {
  grasper: { label: 'Grasper', sub: 'left hand', key: '1', name: 'Atraumatic grasper', short: 'Grasper', hand: 'Left hand', a: 'Grasp / release', ak: 'CLICK', mode: 'plain', icon: '<path d="M4 30 18 16"/><path d="M18 16c2-6 7-10 12-12"/><path d="M18 16c6-2 10-7 12-12"/><circle cx="18" cy="16" r="1.6"/>' },
  sealer: { label: 'Sealer', sub: 'bipolar', key: '2', name: 'Bipolar vessel sealer', short: 'Bipolar sealer', hand: 'Right hand', a: 'Seal', ak: 'HOLD LEFT BUTTON', b: 'Cut blade', mode: 'coag', icon: '<path d="M4 30 16 18"/><path d="M16 18 30 5"/><path d="M16 18c4-5 9-8 15-9"/><path d="M12 22l-3-3"/>' },
  hook: { label: 'Hook', sub: 'monopolar', key: '3', name: 'Monopolar hook', short: 'Monopolar hook', hand: 'Right hand', a: 'Cut current', ak: 'HOLD LEFT BUTTON', mode: 'cut', icon: '<path d="M4 30 22 12"/><path d="M22 12l5-5v8"/>' },
  suction: { label: 'Suction', sub: 'irrigator', key: '4', name: 'Suction irrigator', short: 'Suction', hand: 'Right hand', a: 'Suction', ak: 'HOLD LEFT BUTTON', b: 'Irrigate', mode: 'plain', icon: '<path d="M4 30 28 6"/><path d="M8 30 30 8"/><circle cx="23" cy="13" r=".8"/><circle cx="19" cy="17" r=".8"/>' },
  needle: { label: 'Needle', sub: 'driver, 0 barbed', key: '5', name: 'Needle driver', short: 'Needle driver', hand: 'Right hand', a: 'Drive needle', ak: 'CLICK', mode: 'plain', icon: '<path d="M4 30 20 14"/><path d="M20 14l6-4"/><path d="M20 14l4-6"/><path d="M17 5a9 9 0 0 1 12 12"/>' }
};
const NEED = { seal: 'sealer', cut: 'sealer', incise: 'hook', grasp: 'grasper', suction: 'suction', suture: 'needle' };
const STEPS = [
  { id: 'timeout', title: 'Time-out and positioning' },
  { id: 'ports', title: 'Entry and port placement' },
  { id: 'survey', title: 'Pelvic survey and ureters' },
  { id: 'roundL', title: 'Left round ligament and anterior leaf' },
  { id: 'adnexL', title: 'Left salpingectomy and utero-ovarian ligament' },
  { id: 'roundR', title: 'Right round ligament and anterior leaf' },
  { id: 'adnexR', title: 'Right salpingectomy and utero-ovarian ligament' },
  { id: 'bladder', title: 'Bladder flap' },
  { id: 'uterL', title: 'Left uterine vessels' },
  { id: 'uterR', title: 'Right uterine vessels' },
  { id: 'colpo', title: 'Colpotomy' },
  { id: 'specimen', title: 'Specimen delivery' },
  { id: 'cuff', title: 'Vaginal cuff closure' },
  { id: 'final', title: 'Hemostasis, cystoscopy and closure' }
];
const TASKS = [];
(function buildTasks() {
  const add = (step, o) => { o.step = step; TASKS.push(o); };
  add('timeout', { type: 'action', btn: 'Run the time-out', text: 'Confirm patient, procedure, consent, antibiotic and VTE prophylaxis with the room.' });
  add('timeout', { type: 'action', btn: 'Position the patient', text: 'Dorsal lithotomy in stirrups, both arms tucked, anti-slip pad for steep Trendelenburg.', pearl: 'Check hip flexion and padding now. Positioning nerve injuries are set up before the first incision.' });
  add('timeout', { type: 'action', btn: 'Place Foley and manipulator', text: 'Drain the bladder, then seat the uterine manipulator with its colpotomy cup against the fornices.', pearl: 'The cup rim is your colpotomy landmark. Driving it cephalad moves the uterine arteries away from the ureters.' });
  add('ports', { type: 'port', site: 'umb', text: 'Make the primary entry. Click the umbilicus.', pearl: 'Confirm entry and a low opening pressure before raising the flow.' });
  add('ports', { type: 'action', btn: 'Tilt to steep Trendelenburg', act: 'trend', text: 'Pneumoperitoneum is established at 15 mmHg. Tilt head-down and sweep the bowel out of the pelvis.' });
  add('ports', { type: 'port', site: 'lat', text: 'Place a 5 mm port in each lower quadrant under direct vision. Click both sites.', pearl: 'Stay lateral to the inferior epigastric vessels, about 2 cm medial and superior to the anterior superior iliac spine.' });
  add('ports', { type: 'port', site: 'sp', text: 'Place a 5 mm suprapubic port in the midline, above the bladder dome.' });
  add('survey', { type: 'identify', what: 'ureterR', text: 'Find the right ureter through the peritoneum. Point at it and click.', pearl: 'It crosses the pelvic brim near the iliac bifurcation, medial to the infundibulopelvic ligament. Watch for peristalsis.' });
  add('survey', { type: 'identify', what: 'ureterL', text: 'Now find the left ureter and click it.', pearl: 'On the left it often hides under the sigmoid mesentery.' });
  const side = k => {
    const sd = SIDENAME[k], op = OPPNAME[k], dev = `Deviate the uterus to the patient’s ${op}`;
    add('round' + k, { type: 'seal', target: 'round' + k, text: `Seal the ${sd} round ligament at its mid-portion.`, pearl: 'The mid-portion keeps you away from the vessels along the uterine wall and from the sidewall.' });
    add('round' + k, { type: 'cut', target: 'round' + k, text: 'Divide the round ligament through the sealed zone.' });
    add('round' + k, { type: 'incise', path: 'ant' + k, text: 'Open the anterior leaf of the broad ligament down to the vesicouterine fold.', pearl: 'Divide peritoneum only. CO₂ opens the avascular space ahead of the hook.', expose: dev });
    add('adnex' + k, { type: 'grasp', id: 'tube' + k, text: `Grasp the ${sd} tube near its fimbriated end and lift it.`, pearl: 'Tension on the tube tents the mesosalpinx so each bite stays right under the tube.' });
    ['first', 'second', 'third'].forEach((w, i) => {
      add('adnex' + k, { type: 'seal', target: 'ms' + k + (i + 1), dur: 1.2, text: `Seal the mesosalpinx just under the tube: ${w} bite, working toward the cornu.`, pearl: i ? null : 'Hug the tube. The ovarian blood supply runs in the mesovarium just below.' });
      add('adnex' + k, { type: 'cut', target: 'ms' + k + (i + 1), text: 'Divide the sealed mesosalpinx.' });
    });
    add('adnex' + k, { type: 'seal', target: 'uo' + k, text: 'Seal the utero-ovarian ligament with the proximal tube, about 1 cm off the cornu.', pearl: 'Leave a short pedicle on the uterus so the seal does not sit on the cornual vessels.' });
    add('adnex' + k, { type: 'cut', target: 'uo' + k, text: 'Divide the utero-ovarian pedicle. The ovary stays with its infundibulopelvic blood supply.' });
    add('adnex' + k, { type: 'incise', path: 'post' + k, text: 'Open the posterior leaf of the broad ligament toward the uterosacral ligament.', pearl: 'Run parallel to the uterus. This drops the ureter laterally and exposes the uterine vessels.', expose: dev });
  };
  side('L'); side('R');
  const retro = 'Retrovert the uterus and push it cephalad to face the anterior cervix';
  add('bladder', { type: 'grasp', id: 'bladder', text: 'Retrovert the uterus, then grasp the bladder peritoneum in the midline and lift it.', expose: retro });
  add('bladder', { type: 'incise', path: 'vu', needGrasp: 'bladder', text: 'Incise the vesicouterine peritoneum from one anterior leaf to the other.', pearl: 'Enter where the peritoneum is loose, on the cervix. Fat belongs to the bladder.', expose: retro });
  add('bladder', { type: 'incise', path: 'bl1', style: 'sweep', text: 'Develop the vesicovaginal space. Sweep along the white pubocervical fascia.', pearl: 'Stay in the midline on the fascia. The bladder pillars carry vessels laterally.', expose: retro });
  add('bladder', { type: 'incise', path: 'bl2', style: 'sweep', text: 'Continue until the bladder sits 1 to 2 cm below the anterior rim of the cup.', expose: retro });
  const ut = k => {
    const sd = SIDENAME[k], op = OPPNAME[k], dev = `Deviate the uterus to the patient’s ${op} and keep the cup pushed cephalad`;
    add('uter' + k, { type: 'incise', path: 'skel' + k, style: 'sweep', text: `Skeletonize the ${sd} uterine vessels. Clear the areolar tissue along the side of the uterus.`, pearl: 'Thin the pedicle so the seal lands on vessel, not on a thick bundle.', expose: dev });
    add('uter' + k, { type: 'seal', target: 'uter' + k, dur: 2.4, text: 'Seal the ascending uterine vessels at the internal os, at a right angle, hugging the cervix.', pearl: 'Cephalad pressure on the cup and contralateral deviation keep the ureter away from this bite.' });
    add('uter' + k, { type: 'cut', target: 'uter' + k, text: 'Divide the pedicle. It should fall lateral.' });
    add('uter' + k, { type: 'seal', target: 'card' + k, text: 'Seal the cardinal ligament medial to the uterine pedicle, down to the cup.', pearl: 'Every bite from here stays inside the previous pedicle. That is what protects the ureter.' });
    add('uter' + k, { type: 'cut', target: 'card' + k, text: 'Divide the cardinal ligament on the cup.' });
  };
  ut('L'); ut('R');
  add('colpo', { type: 'incise', path: 'colpo', text: 'Incise the vagina on the rim of the cup, all the way around.', pearl: 'Keep the hook on the cup and use short bursts. Extra heat on the cuff raises the risk of dehiscence.', expose: 'Move the uterus to bring each quadrant into view: retrovert for anterior, deviate for the sides, antevert for posterior' });
  add('specimen', { type: 'action', btn: 'Deliver the specimen', act: 'deliver', text: 'The uterus is free. Deliver it with both tubes through the vagina, then place the occluder to hold the pneumoperitoneum.' });
  add('cuff', { type: 'suture', text: 'Close the cuff with a running 0 barbed suture. For each throw click the anterior edge, then the posterior edge.', pearl: 'Full-thickness bites that include mucosa, 5 to 10 mm from the edge. Take the uterosacral ligament at each angle.' });
  add('final', { type: 'suction', text: 'Irrigate and aspirate the pelvis until it is clear.' });
  add('final', { type: 'action', btn: 'Lower pressure to 8 mmHg', act: 'lowp', text: 'Drop the insufflation pressure and look again. Venous bleeding hides at 15 mmHg.' });
  add('final', { type: 'seal', target: 'ooze', dur: 1.0, text: 'A small ooze shows at the left round ligament stump. Coagulate it.' });
  add('final', { type: 'identify', what: 'ureterL', text: 'Confirm peristalsis in the left ureter. Click it.' });
  add('final', { type: 'identify', what: 'ureterR', text: 'And the right ureter.' });
  add('final', { type: 'action', btn: 'Perform cystoscopy', act: 'cysto', text: 'Check the bladder and both ureteral jets.' });
  add('final', { type: 'action', btn: 'Remove ports and close', act: 'close', text: 'Remove the ports under vision, close any fascial defect of 10 mm or more, and release the CO₂.' });
  /* which manipulator move each task wants, for the pad highlight */
  for (const t of TASKS) { if (/^(round|adnex|uter)[LR]$/.test(t.step)) t.mw = t.step.slice(-1) === 'L' ? 'l' : 'r'; else if (t.step === 'bladder') t.mw = 'd'; }
})();
const stepIndex = id => STEPS.findIndex(s => s.id === id);
const firstTaskOf = si => TASKS.findIndex(t => t.step === STEPS[si].id);
const BLEED = { round: 1.4, ms: 2.2, uo: 3.6, uter: 8.5, card: 3.2, ooze: .35, tear: 1.8 };
const COMP = {
  ureter: { sev: 30, cls: 'crit', title: k => `Thermal injury to the ${SIDENAME[k]} ureter`, teach: 'Energy landed on or beside the ureter. Deviate the uterus away, push the cup cephalad, and keep every bite medial to the previous pedicle.' },
  bladder: { sev: 22, cls: 'crit', title: () => 'Cystotomy', teach: 'Energy went into the bladder. Stay on the pubocervical fascia in the midline and keep the bladder on traction.' },
  bowel: { sev: 30, cls: 'crit', title: () => 'Thermal injury to the rectosigmoid', teach: 'Keep the active tip in view and off the bowel. Activate only when the tip is on its target.' },
  iliac: { sev: 45, cls: 'crit', title: k => `Injury to the ${SIDENAME[k]} external iliac vessels`, teach: 'The sidewall vessels sit just lateral to the round ligament and infundibulopelvic ligament. This needs conversion and vascular repair.' },
  bleed: { sev: 9, cls: 'warn', title: () => 'Pedicle divided before it was sealed', teach: 'Wait for the seal-complete tone, then fire the blade through the blanched zone.' },
  tear: { sev: 5, cls: 'warn', title: () => 'Tissue torn by traction', teach: 'Lift only until the mesosalpinx tents. Past that the tube avulses.' },
  ovary: { sev: 5, cls: 'warn', title: k => `Thermal injury to the ${SIDENAME[k]} ovary`, teach: 'The ovary is being conserved. Keep bites on the tube side of the mesosalpinx.' },
  epigastric: { sev: 8, cls: 'warn', title: () => 'Trocar aimed at the inferior epigastric vessels', teach: 'Transilluminate and look for the vessels lateral to the medial umbilical fold before placing lateral ports.' }
};
