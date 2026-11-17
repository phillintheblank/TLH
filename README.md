# MIGS Simulator

A browser-based simulator of laparoscopic gynaecological surgery: a 3D scope view of the pelvis, a uterine
manipulator, instruments driven by your hands or the mouse, complications and an end-of-case debrief. Six cases
share the one pelvis, and you choose between them on the start screen:

- **Total laparoscopic hysterectomy** with bilateral salpingectomy: 21 steps, five instruments.
- **Laparoscopic myomectomy** of a single anterior fundal fibroid: 9 steps, seven instruments.
- **Laparoscopic salpingectomy** for a ruptured right tubal ectopic pregnancy with haemoperitoneum: 7 steps, three
  instruments.
- **Laparoscopic ovarian cystectomy** for a dermoid cyst of the right ovary, keeping the ovary: 7 steps, four
  instruments.
- **Laparoscopic supracervical hysterectomy** with bilateral salpingectomy, for prolapse, keeping the cervix: 19
  steps, four instruments.
- **Laparoscopic sacrocolpopexy**, which carries on from the supracervical hysterectomy in the same patient: a
  Y-shaped mesh from the vagina and cervix to the sacral promontory. 11 steps, five instruments.

Two things set it apart. **Hand control:** cameras track both hands, each hand drives its own instrument at the
same time, a pinch works the instrument, and an open, flat hand acts as a clutch. With two cameras a hand also
drives depth: push it forward and the instrument goes in. With one camera the tip follows the tissue under it.
**A picture built to look like a scope view:** light that comes from the scope tip, a camera pipeline with automatic
exposure and glare, wet translucent tissue, and sealing, smoke and bleeding that behave like the real thing.

**Try it:** https://phillintheblank.github.io/TLH/ (Chrome or Edge on a laptop or desktop; the camera needs the
`https` address or `localhost`).

It is an educational rehearsal tool with simplified anatomy and tissue behaviour. It is not a validated assessment and
does not replace supervised training. The score comes from the simulator's own rules.

## Controls

| | Hands | Mouse |
|---|---|---|
| Move an instrument | Move that hand; both work at once | Move the mouse: the selected instrument swings about its port |
| Depth | Two cameras: push that hand forward to go in, draw it back to come out. One camera: the tip follows the tissue under it | Wheel: slides the instrument in and out along its shaft |
| Grasp, seal, cut with the hook, aspirate, place a bite | Pinch thumb to first two fingers, hold as needed | Click, hold as needed |
| Fire the bipolar cut blade | Relax, then pinch again on the sealed zone, or `C` | Right-click or `C` |
| Hold an instrument still | Open that hand flat (clutch); curl it again to carry on | `Space` or `X` switches hands; the other holds |

Keyboard in either mode: the number keys change the selected hand's instrument (`1` up to the number of instruments
on the case's tray), `W A S D` tilt and deviate the uterus, `Q E` push it cephalad (in the sacrocolpopexy these move
the vault on its probe), `+` and `-` advance and withdraw the scope, arrow keys aim it, `G` guidance, `L` anatomy labels,
`M` sound. With the mouse, `Esc` frees the cursor for the panels and a click on the picture takes the instruments again.

## Cases

The start screen offers the cases; the choice is remembered, and `?case=tlh`, `?case=myo`, `?case=ect`, `?case=cyst`,
`?case=lsh` or `?case=scp` in the address picks one.
Everything outside the case is shared: the pelvis, the instruments, hand and mouse control, depth, the picture,
bleeding, the step engine and the debrief.

**Total laparoscopic hysterectomy.** Survey and both ureters, then each side in turn (round ligament, anterior leaf,
salpingectomy, utero-ovarian ligament, posterior leaf), the bladder flap, the uterine vessels and cardinal ligaments,
colpotomy on the cup, delivery through the vagina, cuff closure and a low-pressure check.

**Laparoscopic myomectomy.** A 4.5 cm fibroid in the anterior fundal wall of a larger uterus, in a woman who wishes
to conceive.

| Step | What you do | What it teaches |
|---|---|---|
| Survey | Hold a tip beside the fibroid and each cornu | Map the fibroid and the tubes before cutting |
| Vasopressin | Tell anaesthesia (a button), then inject three sites with the injection needle until they blanch | The warning comes first; aspirate before injecting |
| Hysterotomy | Trace a transverse incision across the summit with the hook | Depth: stop at the white, whorled fibroid |
| Enucleation | Lock the tenaculum on the fibroid with one hand; with the other divide the attachments (hook, or bluntly with the suction tip); seal the pedicle at the base with the bipolar, then divide it; carry the fibroid to the marked spot | Traction and counter-traction; the vessels are at the base; do not lose the specimen |
| Haemostasis | Bipolar on the two bleeding edges only | Sparing energy on myometrium |
| Deep layer | Three stitches, near edge then far edge | Close the dead space |
| Serosa | Four stitches, about 5 mm from the edge | Edges together, little raw surface |
| Extraction | Bag the fibroid (a button) | Contained removal |
| Final check | Lower the pressure, control the ooze, aspirate, adhesion barrier | Look again at low pressure |

- **Two more instruments:** a laparoscopic tenaculum, which locks on the fibroid and stays locked until it is
  clicked or pinched again, and an injection needle. An atraumatic grasper slips off the fibroid, and the tenaculum
  does not lock on anything else.
- **Traction is required.** No attachment divides until the fibroid is held. The fibroid gives about a centimetre
  to the pull, comes up out of its bed as it is freed, and follows the tenaculum once the last attachment is cut.
  Pulling it away from an attachment brings that attachment into view.
- **What counts against you:** energy on a tube, an ovary, the bladder or bowel; the cavity entered (the hook held
  on the floor of the bed); the pedicle divided without a seal, which bleeds briskly; vasopressin before anaesthesia
  was told; more than six seconds of bipolar on the uterine wall away from a bleeding point; stitches placed off the
  layer or at the very edge; the fibroid let go away from the marked spot; blood loss above 200 mL.
- **The uterus** swells smoothly over the fibroid, opens along the incision, drapes over the fibroid as it comes
  up, is left with a bed, and sinks back as each layer of the repair goes in. Vasopressin blanches it.

**Laparoscopic salpingectomy for a ruptured tubal ectopic.** A 7-week pregnancy in the ampulla of the right tube
has ruptured. About 500 mL of blood and clot lie in the pelvis and the tube is still bleeding. The uterus, the left
tube and both ovaries are normal, and the uterine manipulator is in place.

| Step | What you do | What it teaches |
|---|---|---|
| Aspirate | Put the suction tip in the blood; hold it on the clot over the right adnexa until the clot clears | Clear the view first; the pelvis will not stay dry while the tube bleeds |
| Find the pregnancy | Hold a tip beside the uterus, the swollen right tube and the left tube | Confirm the diagnosis and look at the other tube before removing anything |
| Lift the tube | Grasp the tube beside the pregnancy, toward its fimbrial end, lift it, and keep hold | Hold the tube, not the pregnancy; lifting stands the mesosalpinx up |
| Mesosalpinx | With the bipolar in the other hand, two bites just under the tube, fimbrial end first: seal, then cut | Stay on the tube and off the ovary's supply; the same bites stop the bleeding |
| Isthmus | Seal the tube about 1 cm from the cornu, then cut | A short stump, off the cornu; the tube comes away in the grasper |
| Remove the tube | Bag it (a button) | Contained removal; histology |
| Wash out and check | Lower the pressure, control the ooze from the stump, aspirate the remaining blood and clot | Look again at low pressure |

- **The blood** starts at 500 mL and covers the floor of the pelvis. Suction takes it down. Four clots, one of them
  over the right adnexa, clear only with the suction tip held on them. The estimated blood loss on the screen and in
  the debrief counts the 500 mL that was there on entry.
- **The rupture bleeds until its supply is sealed:** 30 mL a minute, 12 after the first bite of mesosalpinx, none
  after the second. Time spent before the mesosalpinx is blood lost.
- **Grasping the pregnancy itself** tears it: the jaws let go, 12 mL is lost at once and the rupture bleeds half as
  fast again.
- **Once the tube is divided** it goes where the grasper that holds it goes. Let go, it falls onto whatever lies
  under it.
- **What counts against you:** energy on the left tube, an ovary, an infundibulopelvic ligament, the bladder, the
  bowel, a ureter or the iliac vessels; mesosalpinx or isthmus cut without a full seal (the stump bleeds briskly);
  the pregnancy grasped; the tube let go before it is bagged; the isthmus divided flush with the cornu, or leaving a
  long stump; a step started without its exposure (uterus deviated to the patient's left, tube lifted); more than
  150 mL lost during the operation.

**Laparoscopic ovarian cystectomy.** A 4 cm dermoid cyst in the right ovary of a woman who wants the ovary kept.
The aim is to take the cyst out whole and leave as much working ovary as possible. The uterus, both tubes and the
left ovary are normal.

| Step | What you do | What it teaches |
|---|---|---|
| Survey | Hold a tip beside the uterus, the cyst and the left ovary | Look before you touch, and check that it looks benign |
| Steady the ovary | Grasp the utero-ovarian ligament and keep hold | Hold the ligament, never the cyst |
| Incise the cortex | Hook along the marked line on the free border, in short bursts; stop when the cortex parts | Depth: the cyst wall is directly under the cortex |
| Enucleate | Let go of the ligament, hold the cut edge of the cortex, and push the cyst off it with the suction tip, place by place, round to its base | Traction and counter-traction; blunt dissection; no energy in the plane |
| Remove the cyst | Bag it (a button) | Contained removal: the cyst is opened only inside the bag |
| Haemostasis of the bed | Touch each of two bleeding vessels with the bipolar | The least energy that stops it, for the sake of the ovary |
| Wash out and check | Lower the pressure, control the ooze, aspirate, and clear anything spilled | A second look at low pressure; washing out a spill |

- **The ovary and its cyst.** The right ovary is drawn stretched over the cyst. The incision parts the cortex. As the
  plane is worked the cortex draws back and the cyst comes through it, then rolls off its bed and, once free, comes
  to rest in the pelvis. The ovary is left as an open cup with a raw bed, and is not sutured.
- **Three ways to rupture the cyst:** energy held on cortex that is already cut (about a second), energy on the cyst
  wall (under half a second), or a grasper closed on the cyst itself. A ruptured cyst lies slack, three lumps of its
  contents land in the pelvis, and the case cannot be ended until suction has cleared them.
- **Counter-traction.** The suction tip opens the plane only while the grasper holds the cut edge of the cortex. The
  jaws go with the edge as it draws back.
- **Energy on this ovary** is not an injury but is counted. The seconds of bipolar on it are in the debrief, and more
  than 8 counts against you. Stopping the case's three bleeding points takes under 4.
- **What counts against you:** the cyst ruptured; more than 8 s of bipolar on the ovary; energy on the other ovary,
  either tube, an infundibulopelvic ligament, the bladder, the bowel, a ureter or the iliac vessels; hook energy on
  the cortex off the marked line; a step started without its exposure (uterus deviated to the patient's left, ovary
  steadied); more than 100 mL lost.

**Laparoscopic supracervical hysterectomy.** A woman with stage III uterovaginal prolapse who is to have a
sacrocolpopexy. The body of the uterus comes out and the cervix stays, as the anchor for the mesh. The case ends with
the specimen out and the stump dry.

It is the total hysterectomy as far as the uterine vessels and uses the same steps for that: the survey and both
ureters, each side in turn (round ligament, anterior leaf, salpingectomy, utero-ovarian ligament, posterior leaf)
and the vesicouterine fold. From there it differs:

| Step | What you do | What it teaches |
|---|---|---|
| Mobilize the bladder | Three sweeps where the total hysterectomy takes six | Only as far as the amputation needs |
| Uterine vessels, each side | Seal and divide at the internal os | The ascending branch, against the uterus. The cardinal and uterosacral ligaments are left alone |
| Amputate | Hook round the cervix at the internal os: the front first, then the back with the uterus anteverted | The level of the cut; exposing the back of the cervix |
| Remove the specimen | Bag it (a button) | Contained extraction, never open morcellation |
| Secure the stump | Bipolar on the bleeding vessel, then held on the canal until it is coagulated | Haemostasis of the stump, and why the canal is treated |
| Low-pressure check | Lower the pressure, control the ooze, confirm both ureters | A second look at low pressure |

- **What stays.** When the cut is complete the body of the uterus lifts off and the manipulator is withdrawn. The
  cervix stays on the vagina with its cardinal and uterosacral ligaments, and rests near neutral where a vaginal cuff
  would fall back. There is no cup, no colpotomy and no cuff, and no needle driver on the tray.
- **Shared with the total hysterectomy:** the sealing rules, bleeding from a pedicle cut unsealed, near misses at the
  ureter, the distance from each uterine seal to the ureter, the injuries and the scoring.

**Laparoscopic sacrocolpopexy.** The same patient, straight after the supracervical hysterectomy: the pelvis starts
as that case leaves it. A probe in the vagina takes the manipulator's place and moves the vault, with the same pad
and keys.

| Step | What you do | What it teaches |
|---|---|---|
| Move the sigmoid | Three pushes with the suction tip sweep it to the patient's left | Exposing the promontory. Bowel is swept, not grasped |
| Identify the landmarks | Hold a tip beside the promontory, the right ureter at the brim and the left common iliac vein | What bounds the safe ground, before any incision |
| Open the promontory | Hook down the marked line, then two sweeps to clear the fat | The anterior longitudinal ligament has to be seen bare |
| Incise down the gutter | Hook from the promontory down the right pararectal gutter to the cul-de-sac | Medial to the ureter and the uterosacral ligament, lateral to the rectum |
| Posterior dissection | Vault pushed up and tipped forward; four sweeps on the vaginal side | The rectovaginal space: stay on the vagina |
| Anterior dissection | Vault tipped back; three sweeps take the bladder flap further down | The vesicovaginal space |
| Fix the posterior leaf | Needle driver: a suture at each far corner of the leaf and one on the cervix | Each bite takes the mesh |
| Fix the anterior leaf | The same, with the vault tipped back | The bladder lies just beyond the leaf |
| Fix the mesh to the promontory | Hold the vault at its natural level, then two bites through the mesh into the ligament over S1 | Tension; S1, not the disc; clear of the midline vessels |
| Close the peritoneum | Four bites from the promontory to the cul-de-sac | No mesh is left uncovered |
| Low-pressure check | Lower the pressure, control the ooze, confirm both ureters | A second look. Cystoscopy follows |

- **The promontory.** This case adds a sacral promontory to the posterior wall, the left common iliac vein crossing
  above it and the middle sacral vessels in the midline. The sigmoid starts across it.
- **The incision** opens as a window over the promontory, which shows fat until it is swept and then the white
  ligament, and as a bed down the gutter. The closure draws it shut from the top, and the arm of the mesh goes under.
- **The mesh** comes in at the first fixing step: two leaves over the cervical stump and an arm along the gutter. The
  posterior leaf lies between the uterosacral ligaments. A corner suture is taken by the hand on that side, and the
  guidance changes hands for it.
- **Tension** is read from where the probe holds the vault when the first promontory suture goes in: pushed hard up
  (the last fifth of its travel) fixes the mesh under tension, and low (the first third) leaves it slack. After the
  second suture the probe is out and the vault stays where the mesh holds it.
- **What can go wrong:** the hook on, or a needle into, the left common iliac vein (a major vascular injury); the
  middle sacral vessels opened by energy or by a bite at the medial edge of the mesh (presacral bleeding, controlled
  with bipolar); a bite at the L5 to S1 disc; a needle through the bladder, the bowel or a ureter; and energy on the
  bowel, the bladder, a ureter or the iliac vessels, as in every case.
- **What counts against you:** all of those, mesh fixed tight or slack, a step started without its exposure, energy
  off target, and more than 100 mL lost.
- **Sources** for the figures in this case's teaching text, found through PubMed: the left common iliac vein lies a
  mean 27 mm above the mid-promontory and the middle sacral vessels within a few millimetres of it (Wieslander et al.
  2006, [doi:10.1016/j.ajog.2006.07.045](https://doi.org/10.1016/j.ajog.2006.07.045)); the right ureter, right common
  iliac artery and left common iliac vein are all within 3 cm of it (Good et al. 2013,
  [doi:10.1016/j.ajog.2013.02.039](https://doi.org/10.1016/j.ajog.2013.02.039)); and mesh erosion after
  sacrocolpopexy is less common with a supracervical than with a total hysterectomy (Nassif et al. 2022, a
  meta-analysis, [doi:10.1097/AOG.0000000000004901](https://doi.org/10.1097/AOG.0000000000004901)).

A case is its list of steps (each with its own targets, checks and teaching text), the instruments on its tray, how
its pelvis differs from the model's (a fibroid in the wall, blood and clot, a swollen tube, an ovary with a cyst in
it, a cervix left on its ligaments, a promontory and a mesh), and how it is scored. In the source that is one file
per case (`06a-hysterectomy.js`, `06b-myomectomy.js`, `06c-ectopic.js`, `06d-cystectomy.js`,
`06e-supracervical.js`, `06f-sacrocolpopexy.js`). A case may also build on another: the supracervical hysterectomy
takes most of its steps from the total hysterectomy, and the sacrocolpopexy starts in the state the supracervical
hysterectomy ends in.
`06-steps.js` holds what the cases share, such as the steps that seal and divide a pedicle, and `06z-cases.js`
lists the cases and runs their steps.

## Depth

An instrument's tip is a point in space, and it works only where the tip touches tissue: graspers need tissue in
the jaws and energy needs contact. There are three ways to drive it.

| | Depth | How |
|---|---|---|
| Mouse | Free | The instrument pivots about its port and the wheel slides it along its shaft. *Auto depth* (Depth and mouse panel) makes the tip follow the tissue under the pointer instead |
| Hands, two cameras | Free | The tip follows the hand, as on a robot console: right, up, and into the picture when the hand is pushed forward |
| Hands, one camera | Automatic | The hand points at the picture and the tip follows the tissue under it. One camera cannot measure forward movement well enough to drive depth |

- **Contact:** the tip touches the first tissue it meets. Pushed on, the tissue dents about half a centimetre and
  then stops the instrument. The tip is always where the hand or mouse has put it: there is no hidden travel to take
  up, so drawing back answers at once. Pushing on against tissue does not walk the tip sideways.
- **While an instrument is working** (sealing, cutting with the hook), it holds on to the tissue it is on: as the
  tissue shrinks under the heat, or the hand trembles, the tip stays in contact. Drawing the hand clearly away lets go.
- **Depth is never locked while grasping.** A grasper that holds tissue still moves in and out, so the tissue can
  be drawn toward the camera or pushed away. To hold a position, open the hand flat (clutch). The clutch also lets
  you ratchet: push in, open the hand, bring it back, curl it and push in again.
- **The side of the shaft:** only the tip meets tissue. A cord, a fold of peritoneum, the adnexa or the cuff that
  comes to lie across the shaft behind the tip is passed through, and never pulls the tip back to itself. The shaft
  cannot sweep sideways through the pelvic wall, the iliac vessels, the uterus, the bladder or the rectum: the
  sideways part of such a move is refused, and in and out still answer.
- **Working space:** the tip stops at the pelvic wall, stays inside the picture, cannot be drawn back past the lens,
  and cannot go so far to its own side that the instrument is lost in the wall it comes through. A limit only ever
  holds the tip back; it never moves it. Travel that a limit refuses is discarded, so reversing answers at once.
  Corner marks appear round a tip that is at a limit, and a dashed ring shows where a tip is when it has gone behind
  tissue.
- **Seeing depth in a flat picture:** each instrument throws a shadow that closes up as its tip nears the tissue, a
  ring appears at the tip on contact (amber when pressing in), and the tissue dents under pressure. With hand
  control and two cameras, the simplest way onto a target is by eye: put the tip over it in the picture, then push
  into the picture until CONTACT shows.
- **Guidance on:** a ring round the step's target closes in as the tip nears it in space and turns green on arrival.
  If tissue lies between the selected hand's port and the target and the other hand has a clear line, it says so.
- **Ports matter:** a structure can be out of reach from one side. Switch hands and take the instrument you need in
  the other hand.
- **Depth and mouse panel:** *Auto depth* (mouse only) makes the tip follow the tissue under the pointer; the wheel
  then moves the scope. *Fulcrum effect* makes the tip move opposite to the mouse, as with a real laparoscopic
  handle; it is off by default because the goal is robotic control, which has no fulcrum effect. *Reverse wheel*
  swaps which way the wheel pushes in. *Wheel speed* scales the travel.
- **Identifying the ureters:** hold a driven instrument tip within about a centimetre of a ureter for a second and
  it is marked; a ring fills as you hold. No pinch or click is needed, so nothing beside the ureter is grasped by
  mistake. The same applies when confirming the ureters at the end. During the survey a click or pinch never fires
  the bipolar or hook.

## Picture

- **Light** comes only from the scope: tissue near the lens is bright, deeper tissue is darker, and the light post
  beside the lens throws thin shadows that close up as an instrument nears the tissue.
- **Camera:** automatic exposure, glare around highlights, edge enhancement, sensor noise, lens fall-off, and smoke
  as a grey veil that suction clears.
- **Tissue:** a matte body under a wet film that breaks highlights into specks; translucent broad ligament; fat,
  vessels and surface relief generated in the browser (there are no image files).
- **Energy:** a bipolar seal leaves a tan, dry, slightly shrunken band with scorched margins; cut edges are pale
  and dry with a scorched rim; the hook sparks and smokes; a bleeding point wells and trickles downhill.
- **Quality** (top bar): Auto starts at High and steps down if the frame rate drops. Medium halves the resolution of
  the heavier effects. Low draws straight to the screen with no camera pipeline, translucency or shadows.

## Versions

| Build | Added | Removed | Play it |
|---|---|---|---|
| 0.8 | Two cases for one patient. A fifth, laparoscopic supracervical hysterectomy: the hysterectomy as far as the uterine vessels, then amputation at the internal os, the specimen out in a bag, and a cervix left on its cardinal and uterosacral ligaments. A sixth, laparoscopic sacrocolpopexy, which starts where the fifth ends: a vaginal probe, a sigmoid to sweep off the promontory, the promontory with the left common iliac vein and the middle sacral vessels, a peritoneal incision that opens and is closed again, rectovaginal and vesicovaginal dissection, a Y-shaped mesh sutured to the vagina, the cervix and the anterior longitudinal ligament, and tension judged from where the vault is held | The bladder flap's fixed six sweeps (the step is now a builder that each case sets); the rectosigmoid as a fixed shape (a case may now lay it elsewhere); the rule that the cardinal ligament's inner half always leaves with the specimen; the cuff's fall-back applied to whatever is left on the vagina (a cervix on its ligaments rests near neutral); the limit of nine suture threads | https://phillintheblank.github.io/TLH/ |
| 0.7 | A fourth case: laparoscopic ovarian cystectomy for a dermoid. An ovary stretched over a cyst that opens along an incision, gives up its cyst and is left as an open cup; three ways to rupture the cyst, and spilled contents to wash out; counter-traction on the cut edge of the cortex; the seconds of bipolar on the ovary counted | The ectopic's own builder for clot shapes (now shared, and used for spilled contents too); the fibroid's line inside the grasper's code (now the myomectomy's own); an ovary snapping to its ligament when grasped (it is now held where the jaws close); the flow test waiting without end on a bleeding point its player cannot reach | https://phillintheblank.github.io/TLH/v0.7/ |
| 0.6 | A third case: laparoscopic salpingectomy for a ruptured right tubal ectopic. Haemoperitoneum to aspirate, clots, a rupture that bleeds until the mesosalpinx is sealed, a swollen tube, a tube divided at the isthmus and carried out in the grasper | The myomectomy's own specimen bag and its own search for a place where the blood pool is in view (both now shared by the cases); the rule inside the cut blade that swung the tube free (now the hysterectomy step's own); a bagged specimen travelling into the lens (it now leaves by the top of the picture) | https://phillintheblank.github.io/TLH/v0.6/ |
| 0.5 | A second case, laparoscopic myomectomy, and a case chooser on the start screen. Laparoscopic tenaculum and injection needle. A fibroid uterus that opens, gives up its fibroid and is repaired in two layers. Each case in its own file | The single-case wiring: the fixed tray and number keys, the hysterectomy's own debrief and suture code inside the interface, and the name *TLH Simulator* on the page | https://phillintheblank.github.io/TLH/v0.5/ |
| 0.4 | Second camera for hand control of depth; camera choosers; one calibration watched by both cameras, with a check of where the second camera sits; grip read from the camera with the clearer view; a hand lost by one camera keeps moving as the other sees it. Tissue contact with no hidden travel; structures across the shaft no longer pull the tip back | Depth from palm size, with its smoothing, dead band and the *Depth speed* and *Depth steadiness* sliders; depth assist; target lock; grip hold; the forward calibration step with one camera | https://phillintheblank.github.io/TLH/v0.4/ |
| 0.3c | Depth assist, target lock, working-space limits, hold-near ureter identification, grip hold, pose pictures in calibration | Pinch to identify a ureter | https://phillintheblank.github.io/TLH/v0.3c/ |
| 0.3b | Depth from the hands, read from palm size: push forward to go in | | https://phillintheblank.github.io/TLH/v0.3b/ |
| 0.3a | Free-moving instrument tips with the mouse: wheel depth, contact, tissue give, fulcrum option | | https://phillintheblank.github.io/TLH/v0.3a/ |
| 0.2 | Realism update: lighting, camera, tissue, energy effects, instruments | | https://phillintheblank.github.io/TLH/v0.2/ |
| 0.1 | Hand control added to the mouse simulator | | https://phillintheblank.github.io/TLH/v0.1/ |

Each build's source is kept on a `checkpoint/…` branch (`checkpoint/v0.1-hands`, `checkpoint/v0.2-realism`,
`checkpoint/v0.3a-depth`, `checkpoint/v0.3b-handdepth`, `checkpoint/v0.3c-assist`, `checkpoint/v0.4-twocam`,
`checkpoint/v0.5-myomectomy`, `checkpoint/v0.6-ectopic`, `checkpoint/v0.7-cystectomy`,
`checkpoint/v0.8-sacrocolpopexy`), and the built page of each
earlier build stays in `docs/` under its version number.

Each build removes what it replaces. Size is tracked, with no target. Builds 0.5 to 0.7 each grew by a whole case
and its tests (the salpingectomy is 251 lines and the cystectomy 321, against 492 for the myomectomy: the first
reuses the steps that seal and divide a pedicle, and the second draws its ovary from two simple shapes). Build 0.8
added two cases: the supracervical hysterectomy is 152 lines, because most of its steps are the total
hysterectomy's, and the sacrocolpopexy 402:

| Build | Source (`src/`) | Tests (`test/`) | Built page |
|---|---|---|---|
| 0.3c | 3,832 lines | 1,044 lines | 269 KB |
| 0.4 | 3,901 lines | 1,047 lines | 274 KB |
| 0.5 | 4,493 lines | 1,157 lines | 327 KB |
| 0.6 | 4,773 lines | 1,276 lines | 354 KB |
| 0.7 | 5,102 lines | 1,399 lines | 388 KB |
| 0.8 | 5,664 lines | 1,662 lines | 445 KB |

## Hand control

- **Cameras.** The setup screen has a chooser for the camera in front of you and one for a second camera. With one
  camera the tip follows the tissue; with two, your hands drive depth. Put the second camera in front of you too,
  higher than your hands and tilted down at them, so that it sees a hand's forward travel as movement across its
  picture. Both cameras must see both hands over the whole space you work in. Switch off auto-framing and
  auto-zoom in the second camera's own app, then quit that app, so the picture holds still and the browser can
  open the camera. The choice is remembered.
- **Calibration** takes about half a minute and runs before the case. You show both hands in your working grip (as
  if loosely holding a small ball: a clear gap between the thumb and the first two fingertips, ring and little
  fingers curled), move your right hand right, then up, then (with two cameras) forward, pinch, relax into the grip,
  and open the hand flat. Each step shows a small picture of the pose it wants and a preview from each camera.
  Directions are learned from your own movements, so the cameras need no measuring or levelling. Calibrate with
  your hands where you will work. A saved calibration is offered again while the same cameras are chosen; if a
  camera has been moved, calibrate again. *Skip: standard webcam* (one camera) assumes an upright lid facing you.
- **Where the second camera sits is checked.** If it sees forward travel too nearly end-on (too low, or too level),
  the forward step says so and asks you to raise or tilt it. After calibration the panel rates its view of depth as
  good, fair or poor; fair and poor still work, with a shakier tip in depth.
- **A hand that one camera loses** keeps moving in the directions the other camera can see, and a line at the top
  of the picture says which hand and which camera. When the camera finds the hand again it carries on with no jump.
  With both cameras lost, that instrument holds still.
- **The grip is read from whichever camera sees it better:** the one that looks across the gap between thumb and
  fingertips, not along it. That is what a second view is for when the fingers hide the thumb from the first.
- **Relative control.** Taking an instrument never makes it jump. Clutch (open hand), move your hand somewhere
  comfortable, curl it again and carry on from where the instrument was.
- **A grasper keeps hold through a clutch.** Come back still pinched to keep holding; relax to let go.
- **Energy stops** the moment a hand opens or leaves the cameras' view.
- **Edges of view:** each preview marks the thumb tip and the two fingertips it is reading, and a bar marks the
  side of that camera's view a hand is about to leave by.
- **Tuning** (right-hand panel): sensitivity, smoothing, pinch threshold and clutch threshold.
- **Privacy.** Video frames are analysed inside the browser and discarded. Nothing is recorded or uploaded.

### Limits of this build

- The supracervical hysterectomy and the sacrocolpopexy are new and have been played by script only: start to
  finish with the mouse in both depth modes and with simulated hands. No person has played them yet, and their
  clinical content (the patient, the order of steps, the teaching text, where the sutures go, what counts as
  tension, what is scored) has not been reviewed by a surgeon. Nor has the cystectomy's, from the build before.
- The supracervical hysterectomy is simplified. The amputation is twelve places on a fixed line: it cannot be made
  too high or too low, and the cone toward the canal is drawn, not cut. The manipulator stays in until the cut is
  complete, where in theatre its tip is drawn back before the cut reaches the canal. The body of the uterus does not
  blanch when its vessels are sealed. Bagging is a button and tissue extraction is not shown. The ovaries are kept,
  as in the total hysterectomy.
- The sacrocolpopexy is simplified. The promontory is a rise on the posterior wall. The aortic bifurcation and the
  right common iliac vessels are not drawn, and the vessels on each side wall carry the name of the external iliacs
  all the way up. The sigmoid takes three pushes and then stays where it is put. The peritoneum is not lifted before
  it is cut, and both incisions follow fixed lines. Each dissection is a few sweeps in a fixed order and never
  bleeds. The mesh arrives in place: it is not introduced, trimmed or laid out, and it does not move. Three sutures
  stand for six or more on each leaf, two for the promontory, and four bites for a running peritoneal closure. A
  suture is one bite and ties itself, and how deep a bite goes into the vaginal wall is not judged. Tension is read
  only from how far the probe is pushed when the first promontory suture goes in. The peritoneum is closed along
  the gutter but not over the mesh on the vagina. The posterior leaf is narrower than in theatre, to lie between
  this model's uterosacral ligaments. Cystoscopy and the vaginal examination are a line of text.
- The cystectomy is simplified. The cyst is a ball and the cortex an even shell over it: there is no thick and thin
  side, and no island of normal ovary to find and keep. The plane is eight places worked in a fixed order, all on
  the working hand's side of the cyst; it never bleeds and cannot be lost into the ovary. Irrigation is not an
  action, so there is no hydrodissection. The ovary is drawn already facing the scope: the grasper steadies it but
  does not turn it. A rupture is all or nothing, and always spills the same three lumps. Bagging is a button, and
  the cyst is not decompressed. The cyst is large for this pelvis, so the tube and ligaments run into the ovary's
  surface where they meet it. Only a dermoid is modelled.
- The salpingectomy is simplified. Blood is a level pool that the suction lowers, with no irrigation, and clot is
  four separate lumps. The rupture bleeds at a fixed rate that the two bites of mesosalpinx turn down and off. The
  tube does not tear when pulled, only when the pregnancy itself is grasped. The mesosalpinx is always two bites.
  Bagging is a button. The patient's pulse and pressure do not change. The other tube and the ovaries are always
  normal, so the choice between salpingectomy and salpingotomy never arises.
- A tube that is lifted is a thin target for the other hand in free depth, about 3 mm across at the isthmus and
  standing clear of everything else: the bipolar has to meet it in depth as well as on the screen.
- With two cameras and tracker jitter the scripted hands do not finish every run cleanly. On this build they
  finished the sacrocolpopexy in 3 of 3 runs and the supracervical hysterectomy in 2 of 2, but in one of those two
  the hook strayed onto the bladder while it was being mobilized: the same place, under the same jitter, as in the
  total hysterectomy on build 0.7. The total hysterectomy, the myomectomy, the salpingectomy and the cystectomy were
  run once each and finished clean. On earlier builds a run now and then stopped at the cuff, at the isthmus or at a
  bite on the serosal edge. With the mouse, and with hands and one camera, every case plays through every time.
- The myomectomy is simplified. One fibroid, modelled as a ball. Its attachments are eight separate strands, the
  last a single pedicle. A stitch is two bites and ties itself. Aspiration before injecting, bagging and tissue
  extraction are a line of text or a button. The cavity is entered only by energy on the floor of the bed. The
  fibroid passes through the wall and the instruments once it is free.
- Two-camera hand control has been tested with simulated hands and simulated cameras only. Not yet tried: two real
  cameras running together in the browser (and the frame rate of two trackers at once), a real second camera's
  angle, real tracker jitter in depth, and how well the clearer-view rule picks the camera for the grip.
- Sensitivity changes with a hand's distance from each camera, by up to about a third across 14 cm. Calibrate where
  you work, and clutch back to that spot when a hand has wandered.
- A push into the picture gains a little as the tip goes deeper, because travel is scaled by the tip's distance from
  the lens. It gives the same back on the way out.
- Only the tip meets tissue. The side of the shaft passes through cords, folds and the adnexa, and a tip can end up
  behind them (the dashed ring shows where). The shaft does not push or lift tissue yet.
- A thin target (a cord, the edge of the cuff) has to be met by the tip itself, in depth as well as on the screen.
  Earlier builds pulled a tip back onto whatever its shaft crossed, which made thin targets easier to find and made
  the instrument jump.
- Each camera sees a limited space. The clutch lets you bring a hand back to the middle without moving its instrument.
- Keep your hands side by side. If one hand passes over the other in a camera's view, the tracker can swap them.
- Wrist angle is not used yet.
- The instruments are the laparoscopic set, not wristed robotic instruments.
- The scope, the uterine manipulator and instrument exchanges still use the keyboard or mouse.
- Tissue movement is still simplified: a grasped ligament is pulled, but sheets of tissue do not tent or stretch.
- The picture has been checked in still frames on software rendering. Frame rate on a real graphics card is untested.
- A hand hovering over the keyboard inside a camera's view can take its instrument after about a third of a second
  of holding still. Open the hand flat before reaching for keys.

## Roadmap

1. Hand control, left-right and up-down, two hands (done)
2. Realism: lighting, camera, tissue, energy effects, instruments (done)
3. Free-moving tips and depth with the mouse (done)
4. Depth from the hands, from palm size in one camera (tried in 0.3b and 0.3c; too coarse; removed in 0.4)
5. Assists for one-camera depth: depth assist, target lock, grip hold (tried in 0.3c; removed in 0.4)
6. A second camera for hand control of depth (done)
7. A second case on the same pelvis, laparoscopic myomectomy, and a case chooser (done)
8. A third case, salpingectomy for a ruptured tubal ectopic with haemoperitoneum (done)
9. A fourth case, ovarian cystectomy for a dermoid (done)
10. A fifth and a sixth case for one patient: supracervical hysterectomy, and the sacrocolpopexy that carries on
    from it (this build)
11. Scope control with both hands: two open palms moved together pan, tilt and advance the view
12. Contact along the instrument shaft, lifting tissue with the side of an instrument, and instruments that cannot
    pass through each other
13. Side-by-side stereo for XR glasses and 3D displays
14. Wrist orientation driving a wristed instrument tip
15. Robotic instrument set and multiport robotic case flow
16. Voice commands for the uterine manipulator and instrument exchanges
17. Wristed suturing

If two webcams do not give steady enough depth with real hands, the fallback is a sensor made for hand tracking.

## Working on it

```
npm install            # three.js, the MediaPipe runtime and esbuild (dev dependencies)
npm run fetch-model    # Google's hand landmark model, into models/
npm run build          # writes docs/ (the published site); bundles and minifies three.js into docs/vendor
```

Serve `docs/` with any static web server and open it on `localhost`. Source is in `src/` (`template.html` plus the
numbered files in `src/js/`, concatenated in order; each case is one `06…` file, beside `06-steps.js` for what they
share). `docs/` is what GitHub Pages serves.

Tests drive a headless Chrome through Playwright (`test/shot.mjs <screenshot> <script>`):

- `test/steps/free.mjs` checks free depth through real mouse events: swing, fulcrum inversion, wheel travel, contact
  and the stop, working only in contact, traction, complications.
- `test/steps/flow.mjs` plays a whole case (`QUERY=case=myo` for the myomectomy, and likewise `ect`, `cyst`, `lsh`
  and `scp`): in free depth (`MODE=free`), with real mouse events in auto depth
  (`MODE=mouse`), or with scripted hands pushed through the full hand-control pipeline, seen by two simulated cameras
  (`MODE=hands`, free depth) or by one (`MODE=handsauto`, auto depth). `RIG` picks the cameras (`one`, `tilted`,
  `two`, `shallow`) and `NOISE=0.004` adds tracker jitter. Jitter is random, so a jittered run differs each time;
  a line of script in `EVAL` that replaces `Math.random` with a seeded generator makes one repeatable.
- `test/steps/twocam.mjs` checks two-camera hand control: calibration under jitter, the mapping from hand travel to
  tip travel in each direction and for each hand, both hands at once, that a pinch or a change in how large a hand
  looks does not move the tip, no creep at rest, the clutch, each camera losing a hand and finding it again, the
  grip read from the clearer view, hold-near identification, pressing on tissue (the stop, no walking, no slack on
  the way back), sealing and cutting, traction in depth, and an organ across the shaft behind the tip. With
  `RIG=shallow` it checks that a second camera placed too low is flagged.
- `test/steps/limits.mjs` checks the working space: each instrument pushed out in every direction and drawn back to
  the lens stays in the cavity and in view, and reversing answers at once; also with the real mouse and wheel.
- `test/steps/handdriver.mjs` is the scripted pair of hands and the simulated cameras those tests use. It steers the
  way a person does: it lines the tip up with the target, slides in until the tip touches, comes at a thin target by
  eye when it misses, checks what it is resting on before pinching, and clutches when a hand runs out of room. Its
  two hands cannot cross: the idle one goes back to its own side first, and one that is holding clutches back still
  pinched. When tremor breaks a contact it has just made, it closes the last few millimetres again. `flow.mjs`
  pinches for the cut blade only once the jaws sit steady on the sealed zone, and opens a grasper that closed on
  nothing.
- `test/steps/bimanual.mjs` checks two-handed behaviour with one camera: simultaneous motion, traction with one hand
  while the other seals, the clutch, a lost hand and tracking jitter.
- `test/steps/hazards.mjs` exercises the hysterectomy's complication paths: bleeding from an unsealed cut and its
  control, and energy on the bladder.
- `test/steps/myo.mjs` checks the case chooser and the myomectomy's rules: energy held off during the survey,
  vasopressin before the warning, what the grasper and tenaculum will hold, no dissection without traction, blunt
  dissection, the pedicle (not divided bluntly; bleeding when divided unsealed, and its control), a fibroid let go
  in the wrong place, the cavity entered, bipolar on the wall, the order and matching of bites, energy on a tube,
  the score, and each case played to its debrief after the other.
- `test/steps/ect.mjs` checks the salpingectomy's rules: the blood and clot on entry and what suction does to them,
  the rupture's bleeding and how each bite of mesosalpinx turns it down, energy held off while identifying, the
  pregnancy grasped, the exposure checks, the isthmus (where it may be divided; bleeding from the stump when it is
  divided unsealed, and its control), the tube carried, let go and bagged, the ooze at low pressure, energy on the
  other tube, the score, and each case played to its debrief after another.
- `test/steps/cyst.mjs` checks the cystectomy's rules: the ovary that stands in for the model's, energy held off
  while surveying, the ligament and then the cut edge held, the incision, the three ways the cyst ruptures and what
  a rupture leaves to clear, the plane that opens only against counter-traction, the cyst coming out whole and
  being bagged, the bed's bleeding points, bipolar on the operated ovary counted and on the other ovary an injury,
  the score, the debrief, and each case played to its debrief after another.
- `test/steps/lsh.mjs` checks the supracervical hysterectomy: its place among the six cases, the steps it shares
  and the ones it drops, the shorter bladder mobilization, the amputation (the groove, the back of the cervix out of
  reach from in front, the body coming off and the cervix staying on its ligaments), the bag, the stump's bleeding
  vessel and its canal, the low-pressure check, the debrief, energy on the bladder, and the uterus and cup put back
  on leaving the case.
- `test/steps/scp.mjs` checks the sacrocolpopexy: the pelvis it starts in, the probe, the sigmoid grasped and then
  swept, energy held off while the landmarks are found, the vein and the middle sacral vessels under the hook, the
  window over the promontory and its clearing, the gutter, the exposure check and both dissections, the mesh
  arriving, bites that fix nothing, a needle into the rectum or the bladder, each leaf fixed, tension, a second
  suture on top of the first, a bite at the medial edge of the mesh, a bite at the disc, the peritoneal closure and
  what it covers, the low-pressure check, the debrief, and the pelvis put back on leaving the case.
- `test/steps/realcam.mjs` loads the real camera and model pipeline against Chrome's fake camera (`LIVE=1 QUERY=q=low`).
- `test/steps/handviews.mjs` takes screenshots of the setup screen and of hand control at work (`RIG=two|one`);
  `look.mjs` and `views.mjs` take screenshots of chosen steps for judging the picture.

The tests run on software rendering, with simulated hands and cameras. Frame rate on a real graphics card, and hand
tracking with real hands and real cameras, need a person and a real machine.

## Third-party software

See [NOTICE.md](NOTICE.md).
