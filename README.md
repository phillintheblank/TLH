# TLH Simulator

A browser-based simulator of total laparoscopic hysterectomy with bilateral salpingectomy: a 3D scope view of the
pelvis, a uterine manipulator, five instruments, 21 steps, complications and an end-of-case debrief.

Two things set it apart. **Hand control:** the device camera tracks both hands, each hand drives its own instrument
at the same time, a pinch works the instrument, and an open, flat hand acts as a clutch. **A picture built to look
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
| Depth | Follows the tissue under the pointer (for now) | Wheel: slides the instrument in and out along its shaft |
| Grasp, seal, cut with the hook, aspirate, place a bite | Pinch thumb to first two fingers, hold as needed | Click, hold as needed |
| Fire the bipolar cut blade | Relax, then pinch again on the sealed zone, or `C` | Right-click or `C` |
| Hold an instrument still | Open that hand flat (clutch); curl it again to carry on | `Space` or `X` switches hands; the other holds |

Keyboard in either mode: `1` to `5` change the selected hand's instrument, `W A S D` tilt and deviate the uterus,
`Q E` push the cup, `+` and `-` advance and withdraw the scope, arrow keys aim it, `G` guidance, `L` anatomy labels,
`M` sound. With the mouse, `Esc` frees the cursor for the panels and a click on the picture takes the instruments again.

## Depth

With the mouse, an instrument's tip is a point in space. It pivots about its port, the wheel slides it along its
shaft, and it works only where the tip touches tissue: graspers need tissue in the jaws and energy needs contact.

- **Contact:** the first tissue along the shaft is what the tip meets. Pushed further, the tissue dents about half a
  centimetre and then stops the instrument; keep pressing and a warning appears.
- **Seeing depth in a flat picture:** each instrument throws a shadow that closes up as its tip nears the tissue, a
  ring appears at the tip on contact (amber when pressing in), and the tissue dents under pressure.
- **Guidance on:** a ring round the step's target closes in as the tip nears it in space and turns green on arrival.
  If tissue lies between the selected hand's port and the target and the other hand has a clear line, it says so.
- **Ports matter:** a structure can be out of reach from one side. Switch hands and take the instrument you need in
  the other hand.
- **Mouse control panel:** *Auto depth* brings back the earlier behaviour (the tip follows the tissue under the
  pointer and the wheel moves the scope). *Fulcrum effect* makes the tip move opposite to the mouse, as with a real
  laparoscopic handle; it is off by default because the goal is robotic control, which has no fulcrum effect.
  *Reverse wheel* swaps which way the wheel pushes in. *Wheel speed* scales the travel.
- Hand control still uses auto depth. Depth from the hands is the next step.

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
| 0.3a | Free-moving instrument tips with the mouse: wheel depth, contact, tissue give, fulcrum option | https://phillintheblank.github.io/TLH/ |
| 0.2 | Realism update: lighting, camera, tissue, energy effects, instruments | https://phillintheblank.github.io/TLH/v0.2/ |
| 0.1 | Hand control added to the mouse simulator | https://phillintheblank.github.io/TLH/v0.1/ |

Each build's source is kept on a `checkpoint/…` branch (`checkpoint/v0.1-hands`, `checkpoint/v0.2-realism`,
`checkpoint/v0.3a-depth`), and the built page of each
earlier build stays in `docs/` under its version number.

## Hand control

- **Calibration** takes about 20 seconds and runs before the case. You show both hands, move your right hand right and
  then "up", pinch, relax into a working grip, and open the hand flat. Directions are learned from your own movements,
  so the laptop lid can be upright or tilted down at your hands, and the display can be the laptop screen, a second
  monitor or XR glasses.
- **Relative control.** Taking an instrument never makes it jump. Clutch (open hand), move your hand somewhere
  comfortable, curl it again and carry on from where the instrument was.
- **A grasper keeps hold through a clutch.** Come back still pinched to keep holding; relax to let go.
- **Energy stops** the moment a hand opens or leaves the camera view.
- **Tuning** (right-hand panel): sensitivity, smoothing, pinch threshold and clutch threshold.
- **Privacy.** Video frames are analysed inside the browser and discarded. Nothing is recorded or uploaded.

### Limits of this build

- With the hands, only left-right and up-down are tracked: depth still comes from the tissue under each pointer, and
  wrist angle is not used yet. With the mouse, depth is yours to control.
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
3. Free-moving tips and depth with the mouse (this build)
4. Depth from the hands: hand size in the laptop camera first, a second camera only if that is too coarse
5. Side-by-side stereo for XR glasses and 3D displays
6. Wrist orientation driving a wristed instrument tip
7. Robotic instrument set and multiport robotic case flow
8. Voice commands for the uterine manipulator and instrument exchanges
9. Wristed suturing

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
- `test/steps/flow.mjs` plays the whole case: in free depth (`MODE=free`), with real mouse events in auto depth (`MODE=mouse`) or with synthetic hand landmarks
  pushed through the full hand-control pipeline (`MODE=hands`).
- `test/steps/bimanual.mjs` checks two-handed behaviour: simultaneous motion, traction with one hand while the other
  seals, the clutch, a lost hand, tracking jitter, and both camera orientations (`CAM=upright|tilted`).
- `test/steps/realcam.mjs` loads the real camera and model pipeline against Chrome's fake camera (`LIVE=1 QUERY=q=low`).
- `test/steps/look.mjs` takes screenshots of chosen steps at a chosen quality, for judging the picture.

The tests run on software rendering, so they check that the picture is produced and looks right in still frames. Frame
rate on a real graphics card, and hand tracking with real hands, need a person, a camera and a real machine.

## Third-party software

See [NOTICE.md](NOTICE.md).
