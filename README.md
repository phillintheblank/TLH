# TLH Simulator

A browser-based simulator of total laparoscopic hysterectomy with bilateral salpingectomy: a 3D scope view of the
pelvis, a uterine manipulator, five instruments, 21 steps, complications and an end-of-case debrief.

Two things set it apart. **Hand control:** the device camera tracks both hands, each hand drives its own instrument
at the same time in all three directions (pushing a hand forward drives its instrument in), a pinch works the
instrument, and an open, flat hand acts as a clutch. Assists make it forgiving: the tip settles onto tissue and onto
the step's target, and it cannot be lost outside the working space. **A picture built to look
like a scope view:** light that comes from the scope tip, a camera pipeline with automatic exposure and glare, wet
translucent tissue, and sealing, smoke and bleeding that behave like the real thing.

**Try it:** https://phillintheblank.github.io/TLH/ (Chrome or Edge on a laptop or desktop; the camera needs the
`https` address or `localhost`).

It is an educational rehearsal tool with simplified anatomy and tissue behaviour. It is not a validated assessment and
does not replace supervised training. The score comes from the simulator's own rules.

## Controls

| | Hands | Mouse |
|---|---|---|
| Move an instrument | Move that hand; both work at once | Move the mouse: the selected instrument swings about its port |
| Depth | Push that hand forward to go in, draw it back to come out | Wheel: slides the instrument in and out along its shaft |
| Grasp, seal, cut with the hook, aspirate, place a bite | Pinch thumb to first two fingers, hold as needed | Click, hold as needed |
| Fire the bipolar cut blade | Relax, then pinch again on the sealed zone, or `C` | Right-click or `C` |
| Hold an instrument still | Open that hand flat (clutch); curl it again to carry on | `Space` or `X` switches hands; the other holds |

Keyboard in either mode: `1` to `5` change the selected hand's instrument, `W A S D` tilt and deviate the uterus,
`Q E` push the cup, `+` and `-` advance and withdraw the scope, arrow keys aim it, `G` guidance, `L` anatomy labels,
`M` sound. With the mouse, `Esc` frees the cursor for the panels and a click on the picture takes the instruments again.

## Depth

An instrument's tip is a point in space, and it works only where the tip touches tissue: graspers need tissue in
the jaws and energy needs contact. With the mouse the instrument pivots about its port and the wheel slides it along
its shaft. With the hands the tip follows the hand, as on a robot console: right, up, and into the picture when the
hand is pushed forward.

- **Depth from a hand** is read from how large the palm looks to the camera, so it needs no second camera. It is a
  coarser signal than left-right and up-down, so it is smoothed harder and passes through a small dead band: the
  tip holds still against tracker jitter and follows once the hand has clearly moved. *Depth speed* and *Depth
  steadiness* in the hand control tuning panel set how far and how readily it responds.
- **Depth is never locked while grasping.** A grasper that holds tissue still moves in and out, so the tissue can
  be drawn toward the camera or pushed away. To hold a depth, open the hand flat (clutch). The clutch also lets you
  ratchet: push in, open the hand, bring it back, curl it and push in again.
- **Depth assist** (hand control, on by default): forward travel slows as the tip nears tissue. Once the tip rests on
  tissue it stays there and rides over the surface as the hand moves sideways, so the last few millimetres are not a
  balancing act and pushing on does not dig in. Draw the hand clearly back (about half a centimetre of tip travel)
  to lift off. If the tissue under the tip is cut or drawn away, the tip stays where it is; it never drops onto
  whatever lies behind.
- **Target lock** (hand control, on by default, only while guidance is on): when the instrument the step needs
  comes within about half a centimetre of the step's target, it settles onto the target and the status line shows
  ON TARGET. A pinch then acts on the target and not on its neighbour, and tracker jitter no longer moves the tip.
  It settles only on the structure the step is after; at a working point in an opened plane (an incision line, the
  bladder flap, the cup rim) it holds the tip at the point, clear of what lies beyond. Move the hand clearly
  sideways, or draw it back, to let go. The other hand's instrument is never caught.
- **Working space:** the tip stops at the pelvic wall and slides along it, stays inside the picture, cannot be drawn
  back past the lens, and cannot go so far to its own side that the instrument is lost in the wall it comes through.
  Travel that a limit refuses is discarded, so reversing answers at once. Corner marks appear round a tip that is at
  a limit, and a dashed ring shows where a tip is when it has gone behind tissue. Mouse and hands alike.

- **Contact:** the first tissue along the shaft is what the tip meets. Pushed further, the tissue dents about half a
  centimetre and then stops the instrument; keep pressing and a warning appears.
- **Seeing depth in a flat picture:** each instrument throws a shadow that closes up as its tip nears the tissue, a
  ring appears at the tip on contact (amber when pressing in), and the tissue dents under pressure.
- **Guidance on:** a ring round the step's target closes in as the tip nears it in space and turns green on arrival.
  If tissue lies between the selected hand's port and the target and the other hand has a clear line, it says so.
- **Ports matter:** a structure can be out of reach from one side. Switch hands and take the instrument you need in
  the other hand.
- **Depth and mouse panel:** *Auto depth* brings back the earlier behaviour for mouse and hands alike (the tip
  follows the tissue under the pointer; the wheel moves the scope). *Fulcrum effect* makes the tip move opposite to the mouse, as with a real
  laparoscopic handle; it is off by default because the goal is robotic control, which has no fulcrum effect.
  *Reverse wheel* swaps which way the wheel pushes in. *Wheel speed* scales the travel.
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

| Build | What changed | Play it |
|---|---|---|
| 0.3c | Hand control made easier: depth assist, target lock, working-space limits, hold-near ureter identification, grip hold | https://phillintheblank.github.io/TLH/ |
| 0.3b | Depth from the hands: push forward to go in, calibration learns the forward direction | https://phillintheblank.github.io/TLH/v0.3b/ |
| 0.3a | Free-moving instrument tips with the mouse: wheel depth, contact, tissue give, fulcrum option | https://phillintheblank.github.io/TLH/v0.3a/ |
| 0.2 | Realism update: lighting, camera, tissue, energy effects, instruments | https://phillintheblank.github.io/TLH/v0.2/ |
| 0.1 | Hand control added to the mouse simulator | https://phillintheblank.github.io/TLH/v0.1/ |

Each build's source is kept on a `checkpoint/…` branch (`checkpoint/v0.1-hands`, `checkpoint/v0.2-realism`,
`checkpoint/v0.3a-depth`, `checkpoint/v0.3b-handdepth`, `checkpoint/v0.3c-assist`), and the built page of each
earlier build stays in `docs/` under its version number.

## Hand control

- **Calibration** takes about 25 seconds and runs before the case. You show both hands in your working grip (as if
  loosely holding a small ball: a clear gap between the thumb and the first two fingertips, ring and little fingers
  curled), move your right hand right, then up, then forward, pinch, relax into the grip, and open the hand flat.
  Each step shows a small picture of the pose it wants. All three directions are learned
  from your own movements, so the laptop lid can be upright or tilted down at your hands, and the display can be the
  laptop screen, a second monitor or XR glasses. A calibration saved by an earlier build has no forward direction,
  so it is asked for once more. *Skip: standard webcam* assumes an upright lid facing you.
- **Relative control.** Taking an instrument never makes it jump. Clutch (open hand), move your hand somewhere
  comfortable, curl it again and carry on from where the instrument was.
- **A grasper keeps hold through a clutch.** Come back still pinched to keep holding; relax to let go.
- **Energy stops** the moment a hand opens or leaves the camera view.
- **Grip hold** (on by default): when the camera cannot see the thumb (it is behind the fingers, or the hand is
  side-on), the tracker is only guessing where it is. The instrument then keeps its open or closed state until the
  thumb is seen again. An open flat hand always works and always releases.
- **What the camera is losing** is shown as it happens: the preview marks the thumb tip and the two fingertips it
  is reading (hollow amber rings when the thumb is hidden), a bar marks the side of the view a hand is about to
  leave by, and a line on the picture says which hand and which edge.
- **Tuning** (right-hand panel): depth assist, target lock and grip hold switches; sensitivity, smoothing, depth
  speed, depth steadiness, pinch threshold and clutch threshold.
- **Privacy.** Video frames are analysed inside the browser and discarded. Nothing is recorded or uploaded.

### Limits of this build

- Hand depth and the assists have been tested with simulated hands only (both lid positions, with tracker jitter
  added). How steady the palm-size signal is from a real camera, and how the assists feel, need real hands.
- Grip hold decides that the thumb is hidden from the tracker's own depth estimates. It has not been tried on a
  real camera: if a grip sticks or flickers, switch it off in the tuning panel.
- One camera sees a limited space. A hand that drops out of its view is lost until it comes back; the clutch lets
  you bring a hand back to the middle without moving its instrument.
- With the lid tilted down at the desk, forward is read from where the hand is in the picture and lift from how
  large it looks, so lifting becomes the coarser direction instead of depth.
- Keep your hands side by side. If one hand passes over the other in the camera's view, the tracker can swap them.
- Wrist angle is not used yet.
- Contact is judged along the shaft: an instrument cannot pass through tissue, but its side does not push tissue away.
- The instruments are the laparoscopic set, not wristed robotic instruments.
- The uterine manipulator and instrument exchanges still use the keyboard or mouse.
- Tissue movement is still simplified: a grasped ligament is pulled, but sheets of tissue do not tent or stretch.
- The picture has been checked in still frames on software rendering. Frame rate on a real graphics card is untested.
- A hand hovering over the keyboard inside the camera view can take its instrument after about a third of a second of
  holding still. Open the hand flat before reaching for keys.

## Roadmap

1. Hand control, left-right and up-down, two hands (done)
2. Realism: lighting, camera, tissue, energy effects, instruments (done)
3. Free-moving tips and depth with the mouse (done)
4. Depth from the hands, from palm size in the laptop camera (done)
5. Hand control made easier: depth assist, target lock, working-space limits (this build)
6. Scope control with both hands: two open palms moved together pan, tilt and advance the view
7. A second camera (a phone) for a better view of the thumb and of depth, if one camera is not enough
8. Contact along the instrument shaft, lifting tissue with the side of an instrument, and instruments that cannot
   pass through each other
9. Side-by-side stereo for XR glasses and 3D displays
10. Wrist orientation driving a wristed instrument tip
11. Robotic instrument set and multiport robotic case flow
12. Voice commands for the uterine manipulator and instrument exchanges
13. Wristed suturing

## Working on it

```
npm install            # three.js, the MediaPipe runtime and esbuild (dev dependencies)
npm run fetch-model    # Google's hand landmark model, into models/
npm run build          # writes docs/ (the published site); bundles and minifies three.js into docs/vendor
```

Serve `docs/` with any static web server and open it on `localhost`. Source is in `src/` (`template.html` plus the
numbered files in `src/js/`, concatenated in order). `docs/` is what GitHub Pages serves.

Tests drive a headless Chrome through Playwright (`test/shot.mjs <screenshot> <script>`):

- `test/steps/free.mjs` checks free depth through real mouse events: swing, fulcrum inversion, wheel travel, contact
  and give, working only in contact, traction, complications.
- `test/steps/flow.mjs` plays the whole case: in free depth (`MODE=free`), with real mouse events in auto depth
  (`MODE=mouse`), or with synthetic hand landmarks pushed through the full hand-control pipeline, in free depth
  (`MODE=hands`, add `ASSIST=0` to switch the assists off) or auto depth (`MODE=handsauto`), for either lid position
  (`CAM=upright|tilted`) and with tracker jitter (`NOISE=0.004`).
- `test/steps/handdepth.mjs` checks hand depth: calibration of all three directions under jitter, the mapping from
  hand travel to tip travel, both hands at once, that a pinch does not move the tip, no creep at rest, the clutch
  and ratcheting, contact and give, sealing and cutting in contact, and traction in depth (`CAM=upright|tilted`).
- `test/steps/assist.mjs` checks the assists with scripted hands: hold-near identification, the slow approach, resting
  on and riding over tissue, lifting off, target lock and letting go, grip hold when the thumb is hidden, and the
  edge-of-view flag (`CAM=upright|tilted`).
- `test/steps/limits.mjs` checks the working space: each instrument pushed out in every direction and drawn back to
  the lens stays in the cavity and in view, and reversing answers at once; also with the real mouse and wheel.
- `test/steps/handdriver.mjs` is the scripted pair of hands those tests use. It steers the way a person does: it
  lines the tip up with the target from the port, slides in until the tip touches, checks what it is resting on
  before pinching, and clutches when a hand runs out of room.
- `test/steps/bimanual.mjs` checks two-handed behaviour in auto depth: simultaneous motion, traction with one hand
  while the other seals, the clutch, a lost hand and tracking jitter.
- `test/steps/realcam.mjs` loads the real camera and model pipeline against Chrome's fake camera (`LIVE=1 QUERY=q=low`).
- `test/steps/look.mjs` takes screenshots of chosen steps at a chosen quality, for judging the picture.

The tests run on software rendering, so they check that the picture is produced and looks right in still frames. Frame
rate on a real graphics card, and hand tracking with real hands, need a person, a camera and a real machine.

## Third-party software

See [NOTICE.md](NOTICE.md).
