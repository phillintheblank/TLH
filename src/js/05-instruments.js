// ---------- instruments, input, tissue interaction, effects ----------
const INST = {
  grasper: { name: 'Atraumatic grasper', short: 'Grasper', key: '1', use: 'Mouse: click to grasp or release. Hands: pinch to hold, relax to let go.' },
  bipolar: { name: 'Advanced bipolar', short: 'Bipolar', key: '2', use: 'Hold to seal. Right-click, C, or a second pinch on the sealed zone fires the cut blade.' },
  hook: { name: 'Monopolar hook', short: 'Hook', key: '3', use: 'Hold to activate and trace the incision.' },
  suction: { name: 'Suction-irrigator', short: 'Suction', key: '4', use: 'Hold to aspirate blood and smoke. Doubles as a blunt dissector.' },
  needle: { name: 'Needle driver, barbed suture', short: 'Needle driver', key: '5', use: 'Click or pinch on the vaginal edge to place a bite.' }
};
// Instruments carry the environment map themselves so each can mirror the lit tissue around it at its own strength
// (the scene-wide setting is kept low, because for tissue it is only fill light).
const IM = {
  steel: new THREE.MeshStandardMaterial({ color: 0xb4cbdb, metalness: 0.85, roughness: 0.3, envMap: ENV, envMapIntensity: 1.5 }),
  shaft: new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0, roughness: 0.5, envMap: ENV, envMapIntensity: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x070809, metalness: 0.3, roughness: 0.7, envMap: ENV, envMapIntensity: 0.2 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.34, envMap: ENV, envMapIntensity: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2a6db5, roughness: 0.36, metalness: 0.1, envMap: ENV, envMapIntensity: 0.5 }),
  thread: new THREE.MeshStandardMaterial({ color: 0x4b2e83, roughness: 0.55 })
};
// parts are built along +z, which runs from the tip back up the shaft
function zCyl(r0, r1, len, z0, mat, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg || 20), mat); m.rotation.x = Math.PI / 2; m.position.z = z0 + len / 2; return m; }
function zBox(w, h, len, z0, mat, x, y) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat); m.position.set(x || 0, y || 0, z0 + len / 2); return m; }
function xPin(r, len, z, mat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat); m.rotation.z = Math.PI / 2; m.position.z = z; return m; }
// one jaw: a bar that narrows to the tip, with transverse serrations on the face that meets the other jaw (side sg)
function jawGeo(w, h, len, taper, sg, teeth) {
  const g = new THREE.BoxGeometry(w, h, len, 2, 1, 36); g.translate(0, 0, -len / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const q = -p.getZ(i) / len, k = 1 - taper * Math.pow(q, 1.5), inner = p.getY(i) * sg < 0;
    p.setX(i, p.getX(i) * k);
    let y = p.getY(i) * lerp(1, k, 0.5);
    if (inner && teeth) y += sg * teeth * (Math.abs(((q * 15) % 1) - 0.5) * 2 - 0.5) * sstep(0.1, 0.2, q);
    else if (!inner) y *= 1 - 0.5 * sstep(0.85, 1, q); // the nose rounds off
    p.setY(i, y);
  }
  g.computeVertexNormals(); return g;
}
function buildInst(type) {
  const g = new THREE.Group(), o = { g, jaws: [], needle: null };
  const addJaws = (w, h, len, taper, mat, teeth) => {
    for (const sg of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(0, 0, len);
      const j = new THREE.Mesh(jawGeo(w, h, len, taper, sg, teeth), mat); j.position.y = sg * h * 0.5; piv.add(j);
      piv.userData.sg = sg; g.add(piv); o.jaws.push(piv);
    }
  };
  // hinge: pin through a forked yoke, as on any jawed instrument
  const yoke = (z, wide) => { g.add(xPin(0.065, wide + 0.1, z, IM.steel)); for (const sx of [1, -1]) g.add(zBox(0.05, 0.36, 0.8, z - 0.18, IM.steel, sx * wide / 2)); };
  // ribbed joint between the jaws and the shaft
  const ribs = (z, n, mat) => { for (let i = 0; i < n; i++) { g.add(zCyl(0.255, 0.255, 0.1, z + i * 0.16, mat, 24)); g.add(zCyl(0.19, 0.19, 0.06, z + 0.1 + i * 0.16, IM.dark, 16)); } return z + n * 0.16; };
  const shaft = z => { g.add(zCyl(0.262, 0.262, 0.07, z, IM.steel, 24)); g.add(zCyl(0.25, 0.25, 40, z + 0.07, IM.shaft, 24)); };
  if (type === 'grasper') {
    addJaws(0.36, 0.11, 1.9, 0.45, IM.steel, 0.03);
    for (const piv of o.jaws) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.014, 0.85), IM.dark); w.position.set(0, piv.userData.sg * 0.108, -0.95); piv.add(w); } // fenestration
    yoke(1.9, 0.4); g.add(zCyl(0.2, 0.25, 0.3, 2.5, IM.steel, 24)); shaft(ribs(2.8, 4, IM.steel));
  } else if (type === 'bipolar') {
    addJaws(0.5, 0.17, 2.1, 0.3, IM.steel, 0.012);
    for (const piv of o.jaws) {
      const sg = piv.userData.sg;
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 1.7), IM.ceramic); e.position.set(0, sg * 0.02, -0.95); piv.add(e);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 1.5), IM.dark); slot.position.set(0, sg * 0.02, -0.9); piv.add(slot); // blade track
    }
    yoke(2.1, 0.52); g.add(zCyl(0.27, 0.27, 1.1, 2.7, IM.blue, 24)); shaft(ribs(3.8, 3, IM.ceramic));
  } else if (type === 'hook') {
    g.add(zCyl(0.05, 0.05, 1.0, 0, IM.steel, 10));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.46, 10), IM.steel); b.position.set(0, 0.21, 0.02); g.add(b);
    for (const y of [0, 0.44]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), IM.steel); k.position.set(0, y, 0.02); g.add(k); }
    g.add(zCyl(0.11, 0.2, 1.2, 0.9, IM.ceramic, 24)); shaft(2.1);
  } else if (type === 'suction') {
    g.add(zCyl(0.26, 0.26, 1.6, 0, IM.steel, 24)); g.add(zCyl(0.25, 0.25, 40, 1.6, IM.shaft, 24));
    const hole = new THREE.MeshBasicMaterial({ color: 0x020203 });
    for (const a of [0, 2.1, 4.2]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hole); h.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.5 + a * 0.12); g.add(h); }
    const end = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), hole); end.position.z = -0.005; end.rotation.y = Math.PI; g.add(end);
  } else if (type === 'needle') {
    addJaws(0.32, 0.13, 1.3, 0.35, IM.steel, 0.01);
    yoke(1.3, 0.36); g.add(zCyl(0.2, 0.25, 0.3, 1.9, IM.steel, 24)); shaft(ribs(2.2, 4, IM.steel));
    const ng = new THREE.Group(), arc = Math.PI * 0.9;
    const nd = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 8, 30, arc), IM.steel);
    nd.rotation.z = Math.PI - 0.3 * arc; nd.position.set(0.6, 0, 0); ng.add(nd); ng.position.z = 0.2; g.add(ng); o.needle = ng;
  }
  return o;
}
const newPick = () => ({ hit: false, point: new V3(), normal: new V3(), mesh: null, ent: null, side: null, piece: null, u: 0, v: 0, dist: 0 });
const HAND = {};
for (const [k, sx, inst] of [['L', -1, 'grasper'], ['R', 1, 'bipolar']]) {
  const h = {
    key: k, inst, port: V(8.5 * sx, 3.5, 13.5), tip: V(3.4 * sx, -0.4, 4.6), goal: V(3.4 * sx, -0.4, 4.6), grp: new THREE.Group(), sub: {},
    open: 0.7, openGoal: 0.7, grab: null, exch: 0, exchTo: null, firing: false, depth: 12, roll: 0, near: false, surf: new V3(),
    // each hand has its own pointer, view ray and pick so both instruments can work at once
    ptr: { x: 0, y: 0, on: false, ndc: new THREE.Vector2() }, ray: new THREE.Ray(), pick: newPick(), nearFlag: false, lastUp: -9,
    // pose about the port: direction, commanded insertion, the length actually reached, and contact with tissue
    dir: new V3(), ins: 0, len: 0, touch: false, press: 0, pressT: 0, give: 0, ahead: { hit: false, dist: 0 },
    // depth assist: resting on tissue (hold), net travel drawn back since then (rel). Target lock: pinned to the step's
    // target (lock), where that was (lockP), net sideways travel since (lockX, lockY), and whether it was just left (lockOut).
    hold: false, holdOn: '', rel: 0, lock: false, lockP: new V3(), lockX: 0, lockY: 0, lockOut: false, lockT: 0, lockK: 0, lockN: 0, limT: 0, hid: false, hidT: 0,
    // travel asked for this frame: dx, dy across the picture (pixels), dz along the shaft (cm), dv into the picture (pixels' worth); cart: the tip follows exactly
    cmd: { dx: 0, dy: 0, dz: 0, dv: 0, cart: false }
  };
  h.dir.copy(h.tip).sub(h.port); h.ins = h.len = h.dir.length(); h.dir.normalize();
  for (const t in INST) { h.sub[t] = buildInst(t); h.sub[t].g.visible = t === inst; h.grp.add(h.sub[t].g); }
  scene.add(h.grp); HAND[k] = h;
}
const HANDS = [HAND.L, HAND.R];
let ACTIVE = 'R'; // mouse mode: the hand the mouse drives. Hand mode: the hand that keyboard instrument changes apply to.
const activeHand = () => HAND[ACTIVE];
const otherHand = h => (h === HAND.L ? HAND.R : HAND.L);
const CTRL = { mode: 'mouse' }; // 'mouse' | 'hands'

// ---------- input + picking ----------
const INP = { x: 0, y: 0, inside: false, down: false, ndc: new THREE.Vector2(0, 0), lock: false, noLock: false };
const RAY = new THREE.Raycaster();
// Two ways of placing a tip.
// Free depth: each instrument pivots about its port and its tip is a point in space that touches tissue only when it
// is brought there. The mouse swings the instrument and the wheel slides it along its shaft. A hand moves the tip
// right, up and into the picture, as a robot console does, and the instrument pivots and slides to follow.
// Auto depth: the tip rides whatever tissue lies under a pointer on the screen.
const DEPTH = { auto: false, fulcrum: false, flip: false, wheel: 1, sens: 1, CONTACT: 0.22, GIVE: 0.55,
  assist: true, prio: true, // hand control: depth assist, and target lock (the latter only while guidance is on)
  SEAT: 0.08, SLOW: 1.6, REL: 0.5, JUMP: 0.8, ESC: 0.6, CAP: 0.6 };
const DKEY = 'tlh.depth.v1';
const freeDepth = () => !DEPTH.auto;
function poseFromPoint(h, p) { h.dir.copy(p).sub(h.port); h.ins = h.dir.length(); h.dir.normalize(); }
function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function routeMouse() { // mouse mode: the mouse drives the active hand; the other hand holds
  if (CTRL.mode !== 'mouse') return;
  const free = !DEPTH.auto;
  for (const h of HANDS) {
    h.ptr.on = h.key === ACTIVE && (free || INP.inside);
    if (h.ptr.on && !free) { h.ptr.x = INP.x; h.ptr.y = INP.y; h.ptr.ndc.copy(INP.ndc); }
  }
}
function fillPick(h, hit) {
  const P = h.pick;
  P.hit = !!hit;
  if (!hit) { P.mesh = null; P.ent = null; P.side = null; return; }
  const o = hit.object, ud = o.userData;
  P.mesh = o; P.ent = ud.ent; P.side = ud.side; P.piece = ud.piece || null; P.dist = hit.distance;
  P.point.copy(hit.point);
  P.normal.copy(hit.face.normal).transformDirection(o.matrixWorld);
  if (P.normal.dot(h.ray.direction) > 0) P.normal.negate();
  P.u = 0; P.v = 0;
  if (ud.tube) P.u = ud.tube.uAt(hit.face.a);
  else if (ud.strip) { const st = ud.strip.stAt(hit.face.a); if (ud.strip.map) { const m = ud.strip.map(st[0], st[1]); P.u = m[0]; P.v = m[1]; } else { P.u = st[0]; P.v = st[1]; } }
}
function firstShown(hits) { for (let i = 0; i < hits.length; i++) if (shown(hits[i].object)) return hits[i]; return null; }
function doPick(h) { // auto depth: what lies under this hand's pointer
  let hit = null;
  if (h.ptr.on) { RAY.setFromCamera(h.ptr.ndc, camera); h.ray.copy(RAY.ray); hit = firstShown(RAY.intersectObjects(PICKS, false)); }
  fillPick(h, hit);
}
// When a pointer is over a working point of the current step (an incision line, the cup rim), the tip rides that
// point rather than dropping through the opened tissue onto whatever lies behind it. Auto depth only.
const _sp = new V3();
function snapPick(h) {
  if (!S.running || !h.ptr.on) return;
  const st = STEPS[S.step], inst = h.inst, P = h.pick;
  if (!st.targets || (inst !== 'hook' && inst !== 'suction')) return;
  let bd = 0.2, bz = 0, found = false;
  for (const p of st.targets()) {
    const d2 = h.ray.distanceSqToPoint(p);
    if (d2 >= bd) continue;
    const depth = _sp.copy(p).sub(h.ray.origin).dot(h.ray.direction);
    if (P.hit && depth > P.dist + 0.35) continue;
    bd = d2; bz = depth; found = true;
  }
  if (!found) return;
  P.hit = true; P.mesh = null; P.ent = 'target'; P.side = null; P.piece = null; P.dist = bz;
  P.point.copy(h.ray.origin).addScaledVector(h.ray.direction, bz); P.normal.copy(h.ray.direction).negate();
}
const _cv = new V3(), _g = new V3(), _fr = new V3(), _fu = new V3(), _ft = new V3(), _fp = new V3(), _f0 = new V3(), _lv = new V3();
// ---------- working space ----------
// The tip stays in the cavity. It stops at the pelvic wall and slides along it, stays in the picture, and cannot be
// drawn back past the lens. Travel that a limit refuses is dropped, not stored, so reversing answers at once.
const WS = { LENS: 4.5, EDGE: 0.92, VIS: 4.5 };
function bowlClamp(p) { // keep p inside the pelvic wall: the wall's own cross-section at that depth
  p.z = clamp(p.z, -7.6, 21.5);
  const x = p.x, y = p.y - BOWL_YC; let th = Math.atan2(y, x), a = 1, b = 1;
  for (let it = 0; it < 2; it++) {
    const cs = Math.cos(th), sn = Math.sin(th), r = bowlR(p.z, Math.max(0, sn)), k = 1 + 0.07 * (fbm3(cs * 1.3 + 5, sn * 1.3 + 2, p.z * 0.16, 3) - 0.5);
    a = Math.max(0.4, r[0] * k); b = Math.max(0.4, r[1] * k); th = Math.atan2(y / b, x / a);
  }
  const rho = Math.hypot(x / a, y / b);
  if (rho > 1) { p.x = x / rho; p.y = BOWL_YC + y / rho; }
}
function inBowl(x, y, z) { // inside the wall's nominal cross-section (no surface ripple): quick enough to march along a shaft
  y -= BOWL_YC; let th = Math.atan2(y, x), a = 1, b = 1;
  for (let it = 0; it < 2; it++) { const r = bowlR(z, Math.max(0, Math.sin(th))); a = Math.max(0.4, r[0]); b = Math.max(0.4, r[1]); th = Math.atan2(y / b, x / a); }
  return (x / a) * (x / a) + (y / b) * (y / b) < 1;
}
// The ports lie outside the pelvic wall, so a shaft comes in through the wall. How much of the instrument, back from
// its tip at p, is inside the cavity where it can be seen?
function shaftShown(h, p) {
  const P = h.port, dx = p.x - P.x, dy = p.y - P.y, dz = p.z - P.z, L = Math.hypot(dx, dy, dz), N = 20;
  let t0 = 0, t1 = 1;
  for (let i = 0; i <= N; i++) { const t = i / N; if (inBowl(P.x + dx * t, P.y + dy * t, P.z + dz * t)) { t1 = t; t0 = Math.max(0, (i - 1) / N); break; } if (i === N) return 0; }
  for (let i = 0; i < 4; i++) { const t = (t0 + t1) / 2; if (inBowl(P.x + dx * t, P.y + dy * t, P.z + dz * t)) t1 = t; else t0 = t; }
  return (1 - t1) * L;
}
function limitTip(h, from, to) { // `to` is where the tip is asked to go from `from`; moved to the nearest place it may be
  _lv.copy(to);
  // not back past the lens
  const d0 = _g.copy(from).sub(camera.position).dot(_cv), d1 = _g.copy(to).sub(camera.position).dot(_cv), floor = Math.min(WS.LENS, d0);
  if (d1 < floor) to.addScaledVector(_cv, floor - d1);
  // not out of the picture: slide along its edge instead
  _fp.copy(from).project(camera); const bx = Math.max(WS.EDGE, Math.abs(_fp.x)), by = Math.max(WS.EDGE, Math.abs(_fp.y));
  _fp.copy(to).applyMatrix4(camera.matrixWorldInverse);
  const pe = camera.projectionMatrix.elements, w = -_fp.z, nx = (_fp.x * pe[0]) / w, ny = (_fp.y * pe[5]) / w;
  if (w > 0 && (Math.abs(nx) > bx || Math.abs(ny) > by)) { _fp.x = (clamp(nx, -bx, bx) * w) / pe[0]; _fp.y = (clamp(ny, -by, by) * w) / pe[5]; to.copy(_fp).applyMatrix4(camera.matrixWorld); }
  // not through the pelvic wall
  bowlClamp(to);
  // not so far to its own side that the instrument is lost in the wall it comes through: keep the tip toward the midline
  if (shaftShown(h, to) < WS.VIS) {
    const need = Math.min(WS.VIS, shaftShown(h, from)), sx = h.port.x > 0 ? 1 : -1, x1 = to.x;
    if (shaftShown(h, to) < need - 0.02) {
      let lo = 0, hi = 4;
      for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; to.x = x1 - sx * m; if (shaftShown(h, to) >= need - 0.02) hi = m; else lo = m; }
      to.x = x1 - sx * hi;
    }
  }
  if (_lv.distanceToSquared(to) > 0.0009) h.limT = 0.3;
}
// Free depth: apply this frame's travel to the pose. Travel across the picture is scaled by the tip's distance from
// the lens so the tip keeps pace with the mouse or hand at any zoom. The mouse swings the instrument about its port
// at a fixed insertion (with the fulcrum effect on, opposite to the mouse, as with a real handle); the wheel changes
// the insertion. A hand moves the tip itself (cart), so swing and insertion both follow.
// Depth assist (hands): forward travel slows as the tip nears tissue. Once the tip rests on tissue it stays on it,
// riding the surface as the hand moves sideways, until the hand has clearly drawn back.
function freeDrive(h) {
  const c = h.cmd;
  if ((c.dx || c.dy || c.dv || c.dz) && h.exch <= 0) {
    camera.getWorldDirection(_cv);
    _ft.copy(h.port).addScaledVector(h.dir, h.ins); _f0.copy(_ft);
    const depth = Math.max(2, _g.copy(_ft).sub(camera.position).dot(_cv));
    const k0 = ((2 * depth * Math.tan((camera.fov * DEG) / 2)) / VH) * DEPTH.sens, k = k0 * (DEPTH.fulcrum && !c.cart ? -1 : 1);
    _fr.setFromMatrixColumn(camera.matrixWorld, 0); _fu.setFromMatrixColumn(camera.matrixWorld, 1);
    if (c.cart) {
      let lx = c.dx * k, ly = -c.dy * k, dv = c.dv * k0, lift = false;
      if (h.hold || h.lock) {
        h.rel = clamp(h.rel - dv, 0, 9); dv = 0;
        if (h.lock) { if (h.lockT > 0) { h.lockX = h.lockY = h.rel = 0; } else { h.lockX += lx; h.lockY += ly; } } // the hand was still arriving when the tip settled: that travel does not count as leaving
        if (h.rel > DEPTH.REL) { h.hold = false; h.rel = 0; if (h.lock) { h.lock = false; h.lockOut = true; } lift = true; } // clearly drawn back: come off the tissue
        else if (h.lock) { if (Math.hypot(h.lockX, h.lockY) > DEPTH.ESC) { h.lock = false; h.lockOut = true; } else lx = ly = 0; } // pinned to the target until the hand has clearly moved off it
      } else if (DEPTH.assist && dv > 0 && h.ahead.hit && !(h.grab && h.grab.pull)) dv *= lerp(0.3, 1, clamp((h.ahead.dist - h.ins) / DEPTH.SLOW, 0, 1));
      _ft.addScaledVector(_fr, lx).addScaledVector(_fu, ly).addScaledVector(_cv, dv);
      limitTip(h, _f0, _ft);
      poseFromPoint(h, _ft); h.ins = clamp(h.ins, 3, 34);
      if (lift && h.ahead.hit) h.ins = Math.min(h.ins, Math.max(3, h.ahead.dist - DEPTH.CONTACT - 0.2));
    } else {
      _ft.addScaledVector(_fr, c.dx * k).addScaledVector(_fu, -c.dy * k);
      _ft.sub(h.port).setLength(clamp(h.ins + c.dz, 3, 34)).add(h.port);
      limitTip(h, _f0, _ft);
      poseFromPoint(h, _ft); h.ins = clamp(h.ins, 3, 34);
    }
  }
  c.dx = c.dy = c.dz = c.dv = 0; c.cart = false;
}
// What this step is asking for, the instrument that works there, and what kind of place it is. Worked out once a frame.
//   ents: a named structure (a pedicle to seal, a ureter to point out, the vaginal edge to bite)
//   spot: a bleeding point on tissue, with the structures that must not end up under the tip
//   neither: a working point in an opened plane (an incision line, the bladder flap, the cup rim, a pool of blood)
let AIM = null; const _aimP = new V3(), NO_ENERGY_ON = ['ureter', 'iliac', 'rectum', 'bladder'];
function stepAim() {
  AIM = null;
  if (!S.running || S.ended) return;
  if (S.bleeders.length) { AIM = { p: S.bleeders[0].pt(_aimP), tool: 'bipolar', spot: true, r: 0.4 }; return; }
  const st = STEPS[S.step], n = st.next && st.next();
  if (!n || n.act === 'button' || n.hidden) return;
  AIM = { p: n.p, tool: n.act === 'suction' ? 'suction' : st.tool };
  if (st.seal) { AIM.ents = st.seal.ent === 'meso' ? ['meso', 'tube'] : [st.seal.ent]; AIM.side = st.seal.side; AIM.r = 0.8; }
  else if (n.act === 'hover') { AIM.ents = ['ureter']; AIM.side = n.side; AIM.r = 0.8; }
  else if (n.act === 'bite') { AIM.ents = ['vagina']; AIM.r = 0.3; }
}
// Target lock (hand control, with guidance on): when the tip of the instrument this step needs comes close to the
// step's target, it settles onto the target and stays there, so a pinch acts on the target and not on its neighbour.
// It lets go when the hand has clearly moved off or drawn back. Returns what the instrument then rests on.
const RAYL = new THREE.Raycaster(), _ld = new V3(), _la = new V3(), _lb = new V3(), _lq = new V3(), LOCK_AIR = {};
const LOCK_RING = [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2], [0.14, 0.14], [-0.14, 0.14], [0.14, -0.14], [-0.14, -0.14], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]];
function lockHit(h, k) { // the tissue met on the line from this port to the k-th point of a small ring round the target
  _ld.copy(AIM.p).sub(h.port).normalize();
  _la.crossVectors(_ld, Math.abs(_ld.y) < 0.9 ? _lq.set(0, 1, 0) : _lq.set(1, 0, 0)).normalize(); _lb.crossVectors(_ld, _la);
  _lq.copy(AIM.p).addScaledVector(_la, LOCK_RING[k][0]).addScaledVector(_lb, LOCK_RING[k][1]).sub(h.port).normalize();
  RAYL.set(h.port, _lq); return firstShown(RAYL.intersectObjects(PICKS, false));
}
function lockOK(hit) { // is that the thing the step is after?
  if (!hit || hit.point.distanceTo(AIM.p) > AIM.r) return false;
  const ud = hit.object.userData;
  return AIM.spot ? !NO_ENERGY_ON.includes(ud.ent) : AIM.ents.includes(ud.ent) && (AIM.side == null || ud.side === AIM.side);
}
function targetLock(h, hands) {
  const ok = hands && DEPTH.prio && S.guided && AIM && (AIM.tool === 'any' || AIM.tool === h.inst) && !(h.grab && h.grab.pull) && h.exch <= 0;
  if (!ok) { h.lock = false; h.lockOut = false; return null; }
  if (h.lock && h.lockP.distanceTo(AIM.p) > 0.5) h.lock = false; // the step has moved on to another target
  _ld.copy(AIM.p).sub(h.tip); const along = _ld.dot(h.dir), lat = Math.sqrt(Math.max(0, _ld.lengthSq() - along * along));
  const cap = lat < DEPTH.CAP && along > -0.8 && along < 1.6;
  if (h.lockOut && lat > DEPTH.CAP + 0.25) h.lockOut = false;
  if (!h.lock && (!cap || h.lockOut || !HT.slot[h.key].engaged)) return null;
  const take = () => { if (!h.lock) { h.lock = true; h.lockX = h.lockY = 0; h.rel = 0; h.lockT = 0.3; } h.lockP.copy(AIM.p); };
  if (AIM.ents || AIM.spot) {
    // settle on the structure itself: the line to the target if that meets it, else the nearest line beside it that does
    let hit = lockHit(h, h.lockK);
    if (!lockOK(hit)) { hit = null; if (h.lock || (h.lockN = (h.lockN + 1) % 3) === 0) for (let k = 0; k < LOCK_RING.length && !hit; k++) { const f = lockHit(h, k); if (lockOK(f)) { hit = f; h.lockK = k; } } }
    if (!hit) { h.lock = false; return null; } // this port has no clear line to it
    take(); h.dir.copy(_lq); h.ins = hit.distance + DEPTH.SEAT; h.hold = true;
    return hit;
  }
  // a working point: hold the tip at the point itself, just clear of whatever lies beyond it
  const hit = lockHit(h, 0), L = h.port.distanceTo(AIM.p);
  if (hit && hit.distance < L - 0.2) { h.lock = false; return null; } // tissue lies between this port and the point
  take(); h.dir.copy(_lq); h.ins = Math.min(L, hit ? hit.distance - DEPTH.CONTACT - 0.11 : L); h.hold = false;
  return LOCK_AIR;
}
// Free depth: the first tissue along the shaft is what the tip will meet. Short of it the instrument touches
// nothing. At it the tip is in contact. Pushed further, the tissue gives a little and then stops the instrument.
function freePick(h, dt) {
  const P = h.pick, A = h.ahead;
  const hands = CTRL.mode === 'hands', held = !!(h.grab && h.grab.pull);
  let hit = targetLock(h, hands);
  if (!hit || hit === LOCK_AIR) { RAY.set(h.port, h.dir); hit = firstShown(RAY.intersectObjects(PICKS, false)); }
  h.ray.origin.copy(h.port); h.ray.direction.copy(h.dir);
  fillPick(h, hit);
  A.hit = !!hit; A.dist = hit ? hit.distance : 99;
  // depth assist: a tip resting on tissue stays on it and rides it; it is let go where the tissue falls away
  if (hands && DEPTH.assist && !held && h.exch <= 0) {
    const what = hit ? hit.object.userData.ent + '|' + (hit.object.userData.side || '') : '', gap = A.dist - h.ins;
    if (h.hold) {
      // Follow the structure the tip is resting on. Something nearer is simply in the way, so rest on that. But when
      // the tissue under the tip falls away or is drawn off it, stay put: never drop onto whatever lies behind.
      if (A.hit && (gap < DEPTH.SEAT + 0.02 || (what === h.holdOn && gap < DEPTH.JUMP))) { h.ins = A.dist + DEPTH.SEAT; h.holdOn = what; } else h.hold = false;
    } else if (A.hit && gap < DEPTH.CONTACT && HT.slot[h.key].engaged) { h.hold = true; h.rel = 0; h.ins = A.dist + DEPTH.SEAT; h.holdOn = what; }
  } else if (!h.lock) h.hold = false;
  h.limT = Math.max(0, h.limT - dt); h.lockT = Math.max(0, h.lockT - dt);
  if ((h.hidT -= dt) <= 0) { // now and then: has the tip gone behind tissue, as the camera sees it?
    h.hidT = 0.12; _g.copy(h.tip).sub(camera.position); const dd = _g.length(); RAYL.set(camera.position, _g.normalize());
    const f = firstShown(RAYL.intersectObjects(PICKS, false)); h.hid = !!f && dd - f.distance > 0.9;
  }
  const press = h.ins - A.dist;
  h.touch = A.hit && press > -(h.touch ? DEPTH.CONTACT + 0.08 : DEPTH.CONTACT); // a little slack once in contact, so tremor does not make and break it
  h.give = press > 0 ? DEPTH.GIVE * (1 - Math.exp(-press / DEPTH.GIVE)) : 0;
  h.len = A.hit ? Math.min(h.ins, A.dist + h.give) : h.ins;
  if (press > DEPTH.GIVE * 2.4) h.ins = A.dist + DEPTH.GIVE * 2.4; // so backing out answers at once
  h.press = clamp(press, 0, DEPTH.GIVE * 2.4);
  if (hit) h.surf.copy(hit.point);
  if (!h.touch) { P.hit = false; P.ent = null; P.side = null; P.mesh = null; }
  // the label and contact marker sit at the tip
  _fp.copy(h.port).addScaledVector(h.dir, h.len).project(camera);
  h.ptr.ndc.set(_fp.x, _fp.y); h.ptr.x = (_fp.x * 0.5 + 0.5) * VW; h.ptr.y = (-_fp.y * 0.5 + 0.5) * VH;
  if (h.press > DEPTH.GIVE * 1.3 && S.running && !h.grab) { h.pressT += dt; if (h.pressT > 1.2) { h.pressT = 0; hint('press', 'You are pressing the instrument into tissue. Back it out a little.'); } } else h.pressT = Math.max(0, h.pressT - dt);
}
function updateHands(dt) {
  const free = freeDepth();
  for (let i = 0; i < HANDS.length; i++) {
    const h = HANDS[i], act = h.ptr.on && S.running && !S.ended, P = h.pick;
    if (h.grab && h.grab.pull) {
      const pl = h.grab.pull;
      if (act) {
        if (free) { // the held tissue follows the tip, up to its stretch; past that the instrument is held back
          _g.copy(h.port).addScaledVector(h.dir, h.ins).sub(pl.nat);
          if (_g.length() > 1.6) { _g.setLength(1.6); poseFromPoint(h, _ft.copy(pl.nat).add(_g)); }
        } else {
          camera.getWorldDirection(_cv);
          const den = h.ray.direction.dot(_cv), tt = _g.copy(pl.nat).sub(h.ray.origin).dot(_cv) / (den || 1);
          _g.copy(h.ray.origin).addScaledVector(h.ray.direction, tt).sub(pl.nat).clampLength(0, 1.6);
        }
        pl.off.lerp(_g, 1 - Math.exp(-14 * dt));
      }
      h.goal.copy(pl.nat).add(pl.off); h.tip.copy(h.goal);
    } else if (free) {
      if (h.exch <= 0) h.goal.copy(h.port).addScaledVector(h.dir, h.len);
    } else if (act && h.exch <= 0) {
      if (P.hit) { h.surf.copy(P.point).addScaledVector(P.normal, 0.1); h.depth = P.dist; }
      else h.surf.copy(h.ray.origin).addScaledVector(h.ray.direction, h.depth);
      // The tip pulls back at once but only advances deeper at a finite speed, slower still with energy on:
      // slipping off the edge of a structure must not drop the instrument straight onto whatever lies behind it.
      const dG = h.surf.distanceTo(h.ray.origin), dP = h.goal.distanceTo(h.ray.origin), lim = (h.firing ? 2.5 : 12) * dt;
      if (dG > dP + lim) h.goal.copy(h.ray.origin).addScaledVector(h.ray.direction, dP + lim); else h.goal.copy(h.surf);
    }
    const r = 1 - Math.exp(-(free ? 30 : 20) * dt); h.tip.lerp(h.goal, r);
    const held = !!(h.grab && h.grab.pull);
    h.near = held || (free ? h.touch : h.tip.distanceTo(h.surf) < 0.7);
    // tissue under a pressing tip dents; a held or absent contact does not
    const dent = free && h.touch && !held && h.exch <= 0 ? h.give : 0;
    DENT.pos.value[i].set(h.surf.x, h.surf.y, h.surf.z, dent); DENT.dir.value[i].copy(h.dir);
    if (!free) { poseFromPoint(h, h.tip); h.len = h.ins; h.touch = h.near; h.press = 0; } // keep the pose current so switching modes is seamless
    let retract = 0;
    if (h.exch > 0) {
      h.exch -= dt / 0.55;
      if (h.exch <= 0.5 && h.exchTo) { h.sub[h.inst].g.visible = false; h.inst = h.exchTo; h.exchTo = null; h.sub[h.inst].g.visible = true; h.openGoal = 0.7; }
      retract = Math.sin(Math.PI * clamp(1 - h.exch, 0, 1)) * 15;
    }
    _g.copy(h.port).sub(h.tip).normalize();
    h.grp.position.copy(h.tip).addScaledVector(_g, retract);
    h.grp.lookAt(h.port);
    h.open = damp(h.open, h.firing && h.inst === 'bipolar' ? 0.06 : h.openGoal, 16, dt);
    const sub = h.sub[h.inst], ang = h.open * (h.inst === 'bipolar' ? 0.5 : 0.42);
    for (const piv of sub.jaws) piv.rotation.x = -piv.userData.sg * ang * (h.inst === 'bipolar' && piv.userData.sg < 0 ? 0.25 : 1);
    if (sub.needle) { h.roll = Math.max(0, h.roll - dt / 0.45); sub.needle.rotation.z = -Math.sin(Math.PI * h.roll) * 2.2; }
  }
}
function setInst(k, type) {
  const h = HAND[k];
  if (h.inst === type || h.exch > 0 || !S.running) return;
  if (h.grab) releaseGrab(h);
  h.firing = false; h.exch = 1; h.exchTo = type; S.stats.exchanges++; stopSustain();
  uiDirty();
}
function setActive(k) {
  if (ACTIVE === k) return;
  if (CTRL.mode === 'mouse') { HAND[ACTIVE].firing = false; stopSustain(); }
  ACTIVE = k; uiDirty();
}

// ---------- audio ----------
const AU = { ctx: null, on: true, sus: {} };
function auInit() {
  if (AU.ctx) return;
  try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(AU.ctx.destination); } catch (e) { AU.ctx = null; }
}
function tone(freq, dur, type, vol, delay) {
  if (!AU.ctx || !AU.on) return;
  const t0 = AU.ctx.currentTime + (delay || 0), o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || 0.08, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(AU.master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function sustain(key, freq, type, vol) {
  if (!AU.ctx || !AU.on) return;
  let n = AU.sus[key];
  if (!n) {
    n = { g: AU.ctx.createGain() }; n.g.gain.value = 0; n.g.connect(AU.master);
    if (type === 'noise') {
      const len = AU.ctx.sampleRate, buf = AU.ctx.createBuffer(1, len, len), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      n.o = AU.ctx.createBufferSource(); n.o.buffer = buf; n.o.loop = true;
      const f = AU.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; n.o.connect(f); f.connect(n.g);
    } else { n.o = AU.ctx.createOscillator(); n.o.type = type; n.o.connect(n.g); }
    n.o.start(); AU.sus[key] = n;
  }
  if (n.o.frequency) n.o.frequency.value = freq;
  n.g.gain.setTargetAtTime(vol, AU.ctx.currentTime, 0.02); n.live = 2;
}
function stopSustain() { if (!AU.ctx) return; for (const k in AU.sus) AU.sus[k].g.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.03); }
function tickAudio() { if (!AU.ctx) return; for (const k in AU.sus) { const n = AU.sus[k]; if (n.live > 0 && --n.live === 0) n.g.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.03); } }
const sfx = {
  sealDone: () => { tone(880, 0.12, 'sine', 0.09); tone(880, 0.14, 'sine', 0.09, 0.16); },
  cut: () => { tone(180, 0.05, 'square', 0.07); tone(1400, 0.03, 'square', 0.03, 0.01); },
  ok: () => { tone(660, 0.12, 'sine', 0.06); tone(990, 0.2, 'sine', 0.06, 0.1); },
  warn: () => { tone(520, 0.14, 'triangle', 0.09); tone(390, 0.22, 'triangle', 0.09, 0.15); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(740, 0.13, 'square', 0.06, i * 0.3); tone(520, 0.13, 'square', 0.06, i * 0.3 + 0.14); } },
  bite: () => tone(300, 0.06, 'triangle', 0.06), click: () => tone(1200, 0.03, 'square', 0.025)
};

// ---------- effects: smoke, steam, sparks, blood, burn marks ----------
const FX = { puff: [], blood: [], spark: [], blob: [], trail: [], pi: 0, bi: 0, si: 0, trailT: 0 };
// how brightly the scope lights a point: smoke and blood in the air are lit like everything else
const litAt = p => clamp(Math.pow(LIGHT.ref / Math.max(1.5, p.distanceTo(camera.position)), LIGHT.decay), 0.04, 5);
(function () {
  const N = 128, cv = mkCanvas(N), g = cv.getContext('2d'), img = g.createImageData(N, N), n = fbmTile(4, 4, 77);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { // a soft, ragged puff
    const r = Math.hypot(x / N - 0.5, y / N - 0.5) * 2, a = clamp((1 - sstep(0.1, 1, r)) * (0.2 + 1.5 * n(x / N, y / N)), 0, 1), i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const pt = new THREE.CanvasTexture(cv), dt = dotTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const spr = (map, extra) => { const s = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map, transparent: true, depthWrite: false, opacity: 0 }, extra))); s.visible = false; scene.add(s); return { s, life: 0, v: new V3() }; };
  for (let i = 0; i < 60; i++) FX.puff.push(spr(pt));
  for (let i = 0; i < 90; i++) FX.blood.push(spr(dt));
  for (let i = 0; i < 28; i++) FX.spark.push(spr(dt, { blending: THREE.AdditiveBlending }));
  for (let i = 0; i < 5; i++) { // a bleeding point: a welling bead of blood and the trickle running down from it
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), MAT.bloodWet); m.visible = false; scene.add(m); FX.blob.push(m);
    const t = new Tube(14, 6, MAT.bloodWet, 1, 1); t.mesh.visible = false; scene.add(t.mesh); FX.trail.push({ t, arr: vecArr(14), n: 0 });
  }
})();
function emitPuff(p, steam) { // steam: white, quick, from tissue being desiccated. Otherwise smoke: greyer, slower, lingers.
  const f = FX.puff[FX.pi++ % FX.puff.length];
  f.s.position.copy(p); f.s.visible = true; f.life = 1; f.steam = steam; f.dur = steam ? 0.8 + Math.random() * 0.4 : 2.2 + Math.random();
  f.v.set((Math.random() - 0.5) * (steam ? 2.6 : 0.9), (steam ? 2.0 : 0.9) + Math.random(), 0.3 + Math.random() * 0.9);
  f.s.material.rotation = Math.random() * TAU; f.s.scale.setScalar(0.2);
}
function emitSpark(p) {
  const f = FX.spark[FX.si++ % FX.spark.length];
  f.s.position.set(p.x + (Math.random() - 0.5) * 0.16, p.y + (Math.random() - 0.5) * 0.16, p.z + (Math.random() - 0.5) * 0.16);
  f.s.visible = true; f.life = 1; f.dur = 0.05 + Math.random() * 0.1; f.s.scale.setScalar(0.1 + Math.random() * 0.26);
  f.s.material.color.setRGB(18, 10 + 5 * Math.random(), 3);
}
function emitBlood(p, speed) {
  const f = FX.blood[FX.bi++ % FX.blood.length];
  f.s.position.copy(p); f.s.visible = true; f.life = 1; f.v.set((Math.random() - 0.5) * speed * 0.7, speed * (0.5 + Math.random() * 0.5), speed * (0.25 + Math.random() * 0.5)); f.s.scale.setScalar(0.1 + Math.random() * 0.1);
}
const _bp = new V3(), _bq = new V3(), _bc = new V3(), _b1 = new V3(), _b2 = new V3(), _b3 = new V3(), _bn = new V2(), RAYB = new THREE.Raycaster();
// the visible surface in front of world point p, if it lies within maxD of p
function surfaceNear(p, maxD, out) {
  _bq.copy(p).project(camera); if (_bq.z > 1 || Math.abs(_bq.x) > 1.05 || Math.abs(_bq.y) > 1.05) return false;
  _bn.set(_bq.x, _bq.y); RAYB.setFromCamera(_bn, camera);
  const hits = RAYB.intersectObjects(PICKS, false);
  for (let i = 0; i < hits.length; i++) if (shown(hits[i].object)) { if (hits[i].point.distanceTo(p) > maxD) return false; out.copy(hits[i].point); return true; }
  return false;
}
// Blood runs downhill: step down from the bleeding point, each time dropping back onto the surface seen there.
function bloodPath(b, tr) {
  const p0 = b.pt(_bp);
  if (!b.surf) b.surf = new V3();
  if (!surfaceNear(p0, 1.2, b.surf)) b.surf.copy(p0);
  _bc.copy(camera.position).sub(b.surf).normalize();
  tr.arr[0].copy(b.surf).addScaledVector(_bc, 0.03); tr.n = 0;
  _b1.copy(b.surf);
  for (let i = 1; i < tr.arr.length; i++) {
    _b2.copy(_b1); _b2.y -= 0.4;
    if (!surfaceNear(_b2, 1.3, _b3) || _b3.y > _b1.y + 0.05) break;
    _b1.copy(_b3); tr.arr[i].copy(_b1).addScaledVector(_bc, 0.03); tr.n = i;
  }
  for (let i = tr.n + 1; i < tr.arr.length; i++) tr.arr[i].copy(tr.arr[tr.n]);
  b.surf.addScaledVector(_bc, 0.05);
}
function updateFX(dt, time) {
  for (const f of FX.puff) if (f.life > 0) {
    f.life -= dt / f.dur; f.s.position.addScaledVector(f.v, dt); f.v.multiplyScalar(Math.exp(-1.1 * dt));
    const age = 1 - Math.max(0, f.life), l = litAt(f.s.position);
    f.s.scale.setScalar(f.steam ? 0.2 + 1.3 * age : 0.3 + 2.6 * Math.sqrt(age));
    f.s.material.opacity = (f.steam ? 0.34 : 0.2) * Math.max(0, f.life) * Math.min(1, age / 0.12);
    if (f.steam) f.s.material.color.setRGB(0.95 * l, 0.96 * l, l); else f.s.material.color.setRGB(0.74 * l, 0.77 * l, 0.84 * l);
    if (f.life <= 0) f.s.visible = false;
  }
  for (const f of FX.spark) if (f.life > 0) { f.life -= dt / f.dur; f.s.material.opacity = Math.max(0, f.life); if (f.life <= 0) f.s.visible = false; }
  for (const f of FX.blood) if (f.life > 0) {
    f.life -= dt / 0.75; f.v.y -= 22 * dt; f.s.position.addScaledVector(f.v, dt); f.s.material.opacity = Math.min(1, f.life * 3);
    const l = litAt(f.s.position); f.s.material.color.setRGB(0.36 * l, 0.012 * l, 0.018 * l);
    if (f.life <= 0) f.s.visible = false;
  }
  for (let i = S.bleeders.length - 1; i >= 0; i--) {
    const b = S.bleeders[i]; b.t += dt;
    const vol = (b.rate * dt) / 60; S.ebl += vol; S.pool += vol;
    const p = b.surf || b.pt(_bp);
    if (b.arterial) { if (pulse(time) > 0.35) { emitBlood(p, 6 + Math.random() * 3); if (Math.random() < 0.5) emitBlood(p, 5); } }
    else if (Math.random() < 0.3 + b.rate / 160) emitBlood(p, 1.2 + b.rate / 60);
    if (b.auto && b.t > b.auto) { S.bleeders.splice(i, 1); logEvent('info', b.autoMsg || 'Bleeding controlled'); }
  }
  FX.trailT -= dt; const due = FX.trailT <= 0; if (due) FX.trailT = 0.3;
  for (let i = 0; i < FX.blob.length; i++) {
    const b = S.bleeders[i], m = FX.blob[i], tr = FX.trail[i];
    if (!b) { m.visible = false; tr.t.mesh.visible = false; continue; }
    if (due || !b.surf) bloodPath(b, tr);
    const r = (0.15 + Math.min(0.2, b.rate / 900)) * (1 + 0.22 * pulse(time)) * Math.min(1, 0.35 + b.t);
    m.visible = true; m.position.copy(b.surf); m.quaternion.copy(camera.quaternion); m.scale.set(r, r, r * 0.4);
    if (tr.n > 0) tr.t.set(tr.arr, 0, Math.min(1, b.t / 1.5) * (tr.n / (tr.arr.length - 1)), u => 0.085 - 0.04 * u, null); else tr.t.mesh.visible = false;
  }
  S.haze = Math.max(0, S.haze - dt * (HANDS.some(h => h.firing && h.inst === 'suction') ? 0.6 : 0.07));
  $('haze').style.opacity = (S.haze * 0.75).toFixed(3);
}
function addBleeder(pt, rate, arterial, label, extra) {
  const b = Object.assign({ pt, rate, arterial: !!arterial, seal: 0, t: 0, label }, extra || {});
  S.bleeders.push(b); return b;
}
// Burn marks darken whatever is under them (they multiply it), so they sit correctly in light and in shadow.
function burnTex(hole) {
  const N = 64, cv = mkCanvas(N), g = cv.getContext('2d'), img = g.createImageData(N, N), n = fbmTile(5, 3, hole ? 91 : 83);
  const core = hole ? [22, 8, 8] : [70, 44, 28], rim = [226, 196, 150];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x / N - 0.5, y / N - 0.5) * 2 + (n(x / N, y / N) - 0.5) * 0.5, i = (y * N + x) * 4;
    const kr = 1 - sstep(0.55, 0.98, r), kc = 1 - sstep(hole ? 0.3 : 0.12, hole ? 0.75 : 0.62, r);
    for (let c = 0; c < 3; c++) img.data[i + c] = lerp(lerp(255, rim[c], kr * 0.8), core[c], kc);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const mulMat = (tex, off) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
const DECALS = [], decalGeo = new THREE.CircleGeometry(0.26, 14);
const decalMat = mulMat(burnTex(false), -3), holeMat = mulMat(burnTex(true), -4);
let lastDecal = new V3(1e3, 0, 0);
function addDecal(h, big) {
  const P = h.pick;
  if (!P.hit || !P.mesh || !['uterus', 'bladder', 'wall', 'rectum'].includes(P.ent)) return;
  if (!big && lastDecal.distanceTo(P.point) < 0.14) return;
  lastDecal.copy(P.point);
  const m = new THREE.Mesh(decalGeo, big ? holeMat : decalMat);
  m.position.copy(P.point).addScaledVector(P.normal, 0.025); m.lookAt(_bp.copy(m.position).add(P.normal)); m.rotateZ(Math.random() * TAU);
  m.scale.setScalar(big ? 2.2 : 0.8 + Math.random() * 0.5);
  scene.add(m); P.mesh.attach(m); DECALS.push(m);
  if (DECALS.length > 80) { const o = DECALS.shift(); o.parent && o.parent.remove(o); }
}

// ---------- events ----------
function fmtT(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
function logEvent(type, text) { S.events.push({ t: S.t, type, text }); toast(text, type); uiDirty(); }
let toastT = 0;
function toast(text, type) {
  const el = $('toast'); el.textContent = text; el.className = 'toast show ' + (type || 'info'); toastT = type === 'injury' ? 5 : 3.2;
}
const hintT = {};
function hint(key, text, type) { if ((hintT[key] || 0) > S.t) return; hintT[key] = S.t + 4; toast(text, type || 'tech'); }

// ---------- energy: hazards ----------
const HAZ = {
  ureter: { th: 0.45, text: k => 'Thermal injury to the ' + sideName(k) + ' ureter' },
  bladder: { th: 0.35, text: () => 'Bladder injury: energy applied to the bladder wall' },
  rectum: { th: 0.35, text: () => 'Thermal injury to the rectosigmoid' },
  iliac: { th: 0.3, text: k => 'Major vascular injury: ' + sideName(k) + ' external iliac vessels' },
  ovary: { th: 0.9, text: k => 'Thermal injury to the ' + sideName(k) + ' ovary' },
  ip: { th: 1.3, text: k => sideName(k, true) + ' infundibulopelvic ligament coagulated: ovarian blood supply compromised' }
};
const sideName = (k, cap) => (k === 'R' ? (cap ? 'Right' : 'right') : cap ? 'Left' : 'left');
function heatUp(h, type, k, dt, info) {
  const key = type + (k || '');
  if (S.injuries[key]) return;
  S.heat[key] = (S.heat[key] || 0) + dt * 1.5; // decays by 0.5/s below
  if (S.heat[key] >= HAZ[type].th) {
    S.injuries[key] = Object.assign({ t: S.t, type, side: k }, info || {});
    logEvent('injury', HAZ[type].text(k)); sfx.alarm();
    if (type === 'iliac') { const p = h.pick.point.clone(); addBleeder(o => o.copy(p), 420, true, 'iliac', { auto: 7, autoMsg: 'Pressure held on the vessel. In theatre: call for help, vascular surgery, prepare to convert.' }); }
    if (type === 'bladder' || type === 'rectum') addDecal(h, true);
  }
}
function thermal(h, dt, radius) {
  const P = h.pick;
  for (const k of ['R', 'L']) {
    const n = nearestOnArr(URETER[k].arr, h.tip), d = Math.max(0, n.d - 0.2);
    if (TRACK_URETER()) S.stats.minUreter[k] = Math.min(S.stats.minUreter[k], d);
    if (d < radius) heatUp(h, 'ureter', k, dt, { u: n.u });
    else if (d < 1.0 && !h.nearFlag) { h.nearFlag = true; S.stats.nearMiss++; logEvent('near', 'Energy within 1 cm of the ' + sideName(k) + ' ureter'); sfx.warn(); }
  }
  const e = P.ent;
  if (h.near && P.hit) {
    if (e === 'bladder') heatUp(h, 'bladder', '', dt * (h.inst === 'hook' ? 1 : 0.5));
    else if (e === 'rectum') heatUp(h, 'rectum', '', dt);
    else if (e === 'iliac') heatUp(h, 'iliac', P.side, dt);
    else if (e === 'ovary') heatUp(h, 'ovary', P.side, dt);
    else if (e === 'ip') heatUp(h, 'ip', P.side, dt);
    else if (e === 'ureter') heatUp(h, 'ureter', P.side, dt * 2, { u: P.u });
  }
}
// Is this tip at working point p? Auto depth also accepts a pointer aimed at it from just short of it, since the tip
// is still travelling there. Free depth wants the tip itself there: touching tissue beside it, or within 6 mm of the
// point when there is nothing to touch (the same distance at which the guidance ring turns green).
function nearTarget(h, p, r) {
  const d = h.tip.distanceTo(p);
  if (freeDepth()) return d < r && (h.touch || d < 0.6);
  return d < r || (d < r + 1.6 && h.ptr.on && h.ray.distanceSqToPoint(p) < 0.2);
}
function nearestUreter(p) { let best = 99, bk = 'R'; for (const k of ['R', 'L']) { const d = Math.max(0, nearestOnArr(URETER[k].arr, p).d - 0.2); if (d < best) { best = d; bk = k; } } return { d: best, k: bk }; }
function controlBleeders(h, dt) {
  let any = false;
  for (let i = S.bleeders.length - 1; i >= 0; i--) {
    const b = S.bleeders[i];
    if (b.pt(_bp).distanceTo(h.tip) < 1.0) { any = true; b.seal += dt / 1.2; if (b.seal >= 1) { S.bleeders.splice(i, 1); logEvent('info', 'Bleeding controlled'); sfx.sealDone(); } }
  }
  return any;
}

// ---------- energy: sealing and cutting pedicles ----------
const SEALSPEC = {
  round: { w: 0.09, T: 1.9, lo: 0.2, hi: 0.8, flow: 18, base: 2, label: 'round ligament' },
  uo: { w: 0.04, T: 2.1, lo: 0.04, hi: 0.17, flow: 80, base: 4, label: 'utero-ovarian pedicle' },
  ua: { w: 0.07, T: 2.5, lo: 0.05, hi: 0.4, flow: 300, base: 6, arterial: true, label: 'uterine vessels' },
  card: { w: 0.1, T: 2.0, lo: 0.1, hi: 0.4, flow: 55, base: 4, label: 'cardinal ligament' },
  meso: { w: 0.26, T: 1.7, lo: 0, hi: 1, flow: 28, base: 2, label: 'mesosalpinx' }
};
function sealTarget(h) {
  const P = h.pick;
  if (!P.hit || !h.near) return null;
  let ent = P.ent;
  const side = P.side, want = STEPS[S.step].seal;
  if (!side) return null;
  if (want && want.ent === 'meso' && ent === 'tube' && side === want.side) ent = 'meso';
  if (!SEALSPEC[ent]) return null;
  if (!want || want.ent !== ent || want.side !== side) return { wrong: true, ent, side };
  return { ent, side, u: P.u, v: P.v, e: S.side[side][ent], spec: SEALSPEC[ent] };
}
const PRESERVE = { wall: 1, bladder: 1, rectum: 1, ovary: 1, iliac: 1, ureter: 1, ip: 1, usl: 1 };
const covered = (e, u) => e.seals.some(z => Math.abs(u - z.u) <= z.w);
// the jaws are on a sealed, still undivided part of this step's pedicle
function canCleanCut(h) {
  if (h.inst !== 'bipolar' || h.exch > 0) return false;
  const tg = sealTarget(h);
  return !!tg && !tg.wrong && covered(tg.e, tg.u) && !(tg.e.cut && tg.ent !== 'meso');
}
function bipolarTick(h, dt) {
  const P = h.pick;
  S.stats.energyTime += dt; S.haze = Math.min(0.6, S.haze + dt * 0.05);
  if (h.near && Math.random() < dt * 16) emitPuff(h.tip, true);
  thermal(h, dt, 0.5);
  if (controlBleeders(h, dt)) { sustain('bip', 520, 'sine', 0.06); return; }
  const tg = sealTarget(h);
  if (!tg) { sustain('bip', 430, 'sine', 0.05); if (P.hit && h.near) { addDecal(h); if (PRESERVE[P.ent]) S.stats.nonTarget += dt; } return; }
  if (tg.wrong) { sustain('bip', 430, 'sine', 0.05); hint('wrong', 'That ' + SEALSPEC[tg.ent].label + ' is not this step\'s target'); return; }
  const e = tg.e;
  if (e.cut && tg.ent !== 'meso') { sustain('bip', 430, 'sine', 0.05); return; }
  if (covered(e, tg.u)) { sustain('bip', 640, 'sine', 0.035); return; }
  if (e.act && e.act.by !== h.key && otherHand(h).firing && Math.abs(e.act.u - tg.u) > tg.spec.w * 1.1) return; // the other hand is mid-seal elsewhere on this pedicle
  if (!e.act || Math.abs(e.act.u - tg.u) > tg.spec.w * 1.1) e.act = { u: tg.u, w: tg.spec.w, p: e.act && Math.abs(e.act.u - tg.u) < tg.spec.w * 2 ? e.act.p * 0.5 : 0 };
  e.act.by = h.key;
  e.act.p += dt / tg.spec.T;
  sustain('bip', 440 + 190 * e.act.p, 'sine', 0.07);
  if (e.act.p >= 1) {
    e.seals.push({ u: e.act.u, w: e.act.w }); e.act = null; sfx.sealDone();
    toast(CTRL.mode === 'hands' ? 'Seal complete. Relax, then pinch again on the sealed zone to fire the cut blade.' : 'Seal complete. Fire the cut blade (right-click or C) through the sealed zone.', 'ok');
    STEPS[S.step].onSeal && STEPS[S.step].onSeal(tg);
  }
}
// hand: fire that hand's blade. No argument: the cut key or button, which looks for a bipolar with tissue in its jaws.
function cutAction(hand) {
  if (!S.running || S.ended) return;
  const order = hand ? [hand] : CTRL.mode === 'mouse' ? [activeHand()] : [activeHand(), otherHand(activeHand())];
  const cands = order.filter(c => c.inst === 'bipolar' && c.exch <= 0);
  if (!cands.length) { if (order.some(c => c.inst === 'bipolar')) return; hint('cutinst', 'The cut blade is on the advanced bipolar'); return; }
  let h = null, tg = null, wrong = null;
  for (const c of cands) { const t = sealTarget(c); if (t && !t.wrong) { h = c; tg = t; break; } if (t && t.wrong) wrong = t; }
  if (!tg) { // no pointer on the tissue (mouse on the tray, or the hand on hold): the jaws are still clamped on the last seal
    const c = cands.find(c => !c.ptr.on), w = STEPS[S.step].seal, e = w && S.side[w.side][w.ent];
    if (c && e && e.seals.length && !(e.cut && w.ent !== 'meso')) { h = c; tg = { ent: w.ent, side: w.side, u: e.seals[e.seals.length - 1].u, v: 0.8, e, spec: SEALSPEC[w.ent], held: true }; }
  }
  if (!tg) { if (wrong) hint('wrong', 'That ' + SEALSPEC[wrong.ent].label + ' is not this step\'s target'); else hint('cutnone', 'Nothing in the jaws to divide here'); return; }
  const e = tg.e, sp = tg.spec, st = S.side[tg.side], sd = AN.side[tg.side];
  let q = covered(e, tg.u) ? 1 : e.act && Math.abs(e.act.u - tg.u) <= e.act.w ? e.act.p : 0;
  sfx.cut(); h.open = 0;
  const pt0 = (tg.held ? h.tip : h.pick.point).clone();
  if (tg.ent === 'meso') {
    const bite = S.mesoBite[tg.side];
    if (bite >= 2) return;
    if (bite === 0 && tg.u < 0.45) { hint('mesoorder', 'Start at the fimbrial end and work toward the cornu'); return; }
    if (bite === 1 && tg.u > 0.62) { hint('mesoorder2', 'That part is already divided. Take the next bite toward the cornu.'); return; }
    S.mesoBite[tg.side]++; st.meso.pGoal = S.mesoBite[tg.side] >= 2 ? 1 : 0.5; st.meso.seals = []; st.meso.act = null;
    if (S.mesoBite[tg.side] >= 2) st.tubeGoal = 1;
    if (tg.v < 0.3 && h.pick.ent !== 'tube') logEvent('tech', 'Mesosalpinx taken close to the ovary: stay just under the tube to protect the ovarian arcade');
  } else {
    if (e.cut) return;
    e.cut = true; e.uc = clamp(tg.u, sp.lo, sp.hi);
    if (tg.ent === 'uo') st.roofCut = true;
    if (tg.ent === 'ua') { const pp = sampleArr(sd.cur.ua, e.uc, new V3()); S.stats['uaDist' + tg.side] = nearestUreter(pp).d; if (tg.u > 0.32) logEvent('tech', 'Uterine pedicle taken lateral to the uterine margin: closer to the ureter'); startRelease(sd, 'ua'); }
    if (tg.ent === 'card') startRelease(sd, 'card');
    if (tg.ent === 'round' && (tg.u < 0.25 || tg.u > 0.75)) logEvent('tech', tg.u < 0.25 ? 'Round ligament divided close to the cornu: expect back-bleeding from the ascending uterine branches' : 'Round ligament divided far laterally, near the internal ring and iliac vessels');
  }
  S.ebl += sp.base * (0.6 + Math.random() * 0.8);
  if (q < 0.999) {
    S.stats.unsealedCuts++;
    const key = tg.ent, side = tg.side, uc = tg.ent === 'meso' ? 0 : e.uc;
    const getter = o => {
      const sdd = AN.side[side], stt = S.side[side];
      if (key === 'round') { const G = stt.rel.upper ? stt.rel.upper.lat : sdd.cur; return sampleArr(G.round, uc + 0.08, o); }
      if (key === 'uo') { const G = stt.rel.upper ? stt.rel.upper.lat : sdd.cur; return sampleArr(G.ridge, uc + 0.04, o); }
      if (key === 'ua') { const G = stt.rel.ua ? stt.rel.ua.lat : sdd.cur; return sampleArr(G.ua, uc + 0.06, o); }
      if (key === 'card') { const G = stt.rel.card ? stt.rel.card.lat : sdd.cur; return sampleArr(G.ua, uc + 0.1, o).lerp(sampleArr(G.cardLow, uc + 0.1, _g), 0.5); }
      return o.copy(pt0);
    };
    addBleeder(getter, sp.flow * (1 - q), sp.arterial, sp.label);
    logEvent('bleed', (q > 0.05 ? 'Incomplete seal' : 'No seal') + ' on the ' + sp.label + ': bleeding. Control it with bipolar on the bleeding point.');
    sfx.warn();
  }
  STEPS[S.step].onCut && STEPS[S.step].onCut(tg);
  uiDirty();
}

// ---------- monopolar hook, suction, grasper ----------
function hookTick(h, dt) {
  const P = h.pick;
  S.stats.energyTime += dt; S.haze = Math.min(0.6, S.haze + dt * 0.09);
  if (h.near) { if (Math.random() < dt * 11) emitPuff(h.tip, false); if (Math.random() < dt * 40) emitSpark(h.tip); if (Math.random() < dt * 25) emitSpark(h.tip); }
  sustain('mono', 310, 'sawtooth', 0.022);
  thermal(h, dt, 0.35);
  const st = STEPS[S.step];
  if (st.hook && st.hook(h, dt)) return;
  if (P.hit && h.near) {
    if (SEALSPEC[P.ent] || P.ent === 'tube') hint('hookped', 'Vascular pedicle: seal it with the advanced bipolar rather than the hook');
    else { addDecal(h); if (PRESERVE[P.ent]) S.stats.nonTarget += dt; }
  }
}
function suctionTick(h, dt) {
  sustain('suc', 900, 'noise', 0.035);
  if (S.pool > 0 && POOL.visible && h.tip.y < POOL.position.y + 1.0) { const v = Math.min(S.pool, 28 * dt); S.pool -= v; }
  const st = STEPS[S.step];
  if (st.blunt) st.blunt(h, dt);
}
function releaseGrab(h) {
  if (h.grab && h.grab.pull) { const i = S.pulls.indexOf(h.grab.pull); if (i >= 0) S.pulls.splice(i, 1); }
  h.grab = null; h.openGoal = 0.7;
}
function graspOn(h) {
  const P = h.pick;
  sfx.click();
  const map = { round: 'round', tube: 'tube', uo: 'ridge', ip: 'ridge', ovary: 'ridge' };
  if (P.hit && h.near && P.ent === 'uterus' && S.colpDone && S.specimen === 'in') { deliverSpecimen(); return; }
  h.openGoal = 0.02;
  if (P.hit && h.near && map[P.ent] && P.side && !S.side[P.side].rel.upper && !(P.ent === 'tube' && S.side[P.side].tubeGoal > 0)) {
    const side = P.side, pull = { curve: map[P.ent], s: AN.side[side].s, u: P.ent === 'ovary' ? 0.4 : clamp(P.u, 0.08, 0.92), off: new V3(), nat: P.point.clone() };
    S.pulls.push(pull); h.grab = { pull, ent: P.ent, side }; S.stats.traction++;
  } else h.grab = { pull: null };
}
function dropGrabsOnSide(side) { for (const h of HANDS) if (h.grab && h.grab.side === side) releaseGrab(h); }

// A press is a mouse click or a pinch. With the mouse the grasper toggles; with hand control it holds while pinched.
function primaryDown(h) {
  if (!S.running || S.ended || h.exch > 0) return;
  if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
  const st = STEPS[S.step]; stepPressed = true;
  if (st.click && st.click(h)) return;
  if (h.inst === 'grasper') { if (h.grab) { if (CTRL.mode === 'mouse') { releaseGrab(h); sfx.click(); } } else graspOn(h); }
  else if (h.inst === 'needle') { hint('needle', 'The needle driver is for closing the vaginal cuff'); }
  else if (h.inst === 'bipolar' && CTRL.mode === 'hands' && S.t - h.lastUp > 0.25 && canCleanCut(h)) cutAction(h);
  else { h.firing = true; h.nearFlag = false; if (h.inst !== 'suction') S.stats.activations++; }
}
function primaryUp(h) {
  h.lastUp = S.t;
  if (h.firing) { h.firing = false; stopSustain(); }
  if (CTRL.mode === 'hands' && h.inst === 'grasper' && h.grab) { releaseGrab(h); sfx.click(); }
}
function actionTick(dt) {
  for (const h of HANDS) if (h.firing && h.exch <= 0) {
    if (h.inst === 'bipolar') bipolarTick(h, dt);
    else if (h.inst === 'hook') hookTick(h, dt);
    else if (h.inst === 'suction') suctionTick(h, dt);
  }
  for (const k in S.heat) S.heat[k] = Math.max(0, S.heat[k] - dt * 0.5);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').className = 'toast'; }
  tickAudio();
}
