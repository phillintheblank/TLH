# MIGS Simulator

A browser-based simulator of laparoscopic gynaecological surgery: a 3D scope view of the pelvis, a uterine
manipulator, instruments driven by your hands or the mouse, complications and an end-of-case debrief. Two cases
share the one pelvis, and you choose between them on the start screen:

- **Total laparoscopic hysterectomy** with bilateral salpingectomy: 21 steps, five instruments.
- **Laparoscopic myomectomy** of a single anterior fundal fibroid: 9 steps, seven instruments.

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

Keyboard in either mode: the number keys change the selected hand's instrument (`1` to `5` in the hysterectomy,
`1` to `7` in the myomectomy), `W A S D` tilt and deviate the uterus,
`Q E` push the cup, `+` and `-` advance and withdraw the scope, arrow keys aim it, `G` guidance, `L` anatomy labels,
`M` sound. With the mouse, `Esc` frees the cursor for the panels and a click on the picture takes the instruments again.

## Cases

The start screen offers the cases; the choice is remembered, and `?case=tlh` or `?case=myo` in the address picks one.
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

A case is its list of steps (each with its own targets, checks and teaching text), the instruments on its tray, how
its uterus differs from the model's, and how it is scored. In the source that is one file per case
(`06a-hysterectomy.js`, `06b-myomectomy.js`), and `06z-cases.js` lists them.

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
| 0.5 | A second case, laparoscopic myomectomy, and a case chooser on the start screen. Laparoscopic tenaculum and injection needle. A fibroid uterus that opens, gives up its fibroid and is repaired in two layers. Each case in its own file | The single-case wiring: the fixed tray and number keys, the hysterectomy's own debrief and suture code inside the interface, and the name *TLH Simulator* on the page | https://phillintheblank.github.io/TLH/ |
| 0.4 | Second camera for hand control of depth; camera choosers; one calibration watched by both cameras, with a check of where the second camera sits; grip read from the camera with the clearer view; a hand lost by one camera keeps moving as the other sees it. Tissue contact with no hidden travel; structures across the shaft no longer pull the tip back | Depth from palm size, with its smoothing, dead band and the *Depth speed* and *Depth steadiness* sliders; depth assist; target lock; grip hold; the forward calibration step with one camera | https://phillintheblank.github.io/TLH/v0.4/ |
| 0.3c | Depth assist, target lock, working-space limits, hold-near ureter identification, grip hold, pose pictures in calibration | Pinch to identify a ureter | https://phillintheblank.github.io/TLH/v0.3c/ |
| 0.3b | Depth from the hands, read from palm size: push forward to go in | | https://phillintheblank.github.io/TLH/v0.3b/ |
| 0.3a | Free-moving instrument tips with the mouse: wheel depth, contact, tissue give, fulcrum option | | https://phillintheblank.github.io/TLH/v0.3a/ |
| 0.2 | Realism update: lighting, camera, tissue, energy effects, instruments | | https://phillintheblank.github.io/TLH/v0.2/ |
| 0.1 | Hand control added to the mouse simulator | | https://phillintheblank.github.io/TLH/v0.1/ |

Each build's source is kept on a `checkpoint/…` branch (`checkpoint/v0.1-hands`, `checkpoint/v0.2-realism`,
`checkpoint/v0.3a-depth`, `checkpoint/v0.3b-handdepth`, `checkpoint/v0.3c-assist`, `checkpoint/v0.4-twocam`,
`checkpoint/v0.5-myomectomy`), and
the built page of each earlier build stays in `docs/` under its version number.

Each build removes what it replaces. Size is tracked, with no target. Build 0.5 grew by a whole second case
(500 lines) and its tests:

| Build | Source (`src/`) | Tests (`test/`) | Built page |
|---|---|---|---|
| 0.3c | 3,832 lines | 1,044 lines | 269 KB |
| 0.4 | 3,901 lines | 1,047 lines | 274 KB |
| 0.5 | 4,493 lines | 1,157 lines | 327 KB |

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

- The myomectomy is new and has been played by script only: start to finish with the mouse in both depth modes and
  with simulated hands. No person has played it yet, and its clinical content (the case, the steps, the teaching
  text, what is scored) has not been reviewed by a surgeon.
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
7. A second case on the same pelvis, laparoscopic myomectomy, and a case chooser (this build)
8. Scope control with both hands: two open palms moved together pan, tilt and advance the view
9. Contact along the instrument shaft, lifting tissue with the side of an instrument, and instruments that cannot
   pass through each other
10. Side-by-side stereo for XR glasses and 3D displays
11. Wrist orientation driving a wristed instrument tip
12. Robotic instrument set and multiport robotic case flow
13. Voice commands for the uterine manipulator and instrument exchanges
14. Wristed suturing

If two webcams do not give steady enough depth with real hands, the fallback is a sensor made for hand tracking.

## Working on it

```
npm install            # three.js, the MediaPipe runtime and esbuild (dev dependencies)
npm run fetch-model    # Google's hand landmark model, into models/
npm run build          # writes docs/ (the published site); bundles and minifies three.js into docs/vendor
```

Serve `docs/` with any static web server and open it on `localhost`. Source is in `src/` (`template.html` plus the
numbered files in `src/js/`, concatenated in order; each case is one `06…` file). `docs/` is what GitHub Pages serves.

Tests drive a headless Chrome through Playwright (`test/shot.mjs <screenshot> <script>`):

- `test/steps/free.mjs` checks free depth through real mouse events: swing, fulcrum inversion, wheel travel, contact
  and the stop, working only in contact, traction, complications.
- `test/steps/flow.mjs` plays a whole case (`QUERY=case=myo` for the myomectomy): in free depth (`MODE=free`), with real mouse events in auto depth
  (`MODE=mouse`), or with scripted hands pushed through the full hand-control pipeline, seen by two simulated cameras
  (`MODE=hands`, free depth) or by one (`MODE=handsauto`, auto depth). `RIG` picks the cameras (`one`, `tilted`,
  `two`, `shallow`) and `NOISE=0.004` adds tracker jitter.
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
  eye when it misses, checks what it is resting on before pinching, and clutches when a hand runs out of room.
- `test/steps/bimanual.mjs` checks two-handed behaviour with one camera: simultaneous motion, traction with one hand
  while the other seals, the clutch, a lost hand and tracking jitter.
- `test/steps/hazards.mjs` exercises the hysterectomy's complication paths: bleeding from an unsealed cut and its
  control, and energy on the bladder.
- `test/steps/myo.mjs` checks the case chooser and the myomectomy's rules: energy held off during the survey,
  vasopressin before the warning, what the grasper and tenaculum will hold, no dissection without traction, blunt
  dissection, the pedicle (not divided bluntly; bleeding when divided unsealed, and its control), a fibroid let go
  in the wrong place, the cavity entered, bipolar on the wall, the order and matching of bites, energy on a tube,
  the score, and each case played to its debrief after the other.
- `test/steps/realcam.mjs` loads the real camera and model pipeline against Chrome's fake camera (`LIVE=1 QUERY=q=low`).
- `test/steps/handviews.mjs` takes screenshots of the setup screen and of hand control at work (`RIG=two|one`);
  `look.mjs` and `views.mjs` take screenshots of chosen steps for judging the picture.

The tests run on software rendering, with simulated hands and cameras. Frame rate on a real graphics card, and hand
tracking with real hands and real cameras, need a person and a real machine.

## Third-party software

See [NOTICE.md](NOTICE.md).
