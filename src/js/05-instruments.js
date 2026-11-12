// ---------- instruments, input, tissue interaction, effects ----------
const INST = {
  grasper: { name: 'Atraumatic grasper', short: 'Grasper', key: '1', use: 'Mouse: click to grasp or release. Hands: pinch to hold, relax to let go.' },
  bipolar: { name: 'Advanced bipolar', short: 'Bipolar', key: '2', use: 'Hold to seal. Right-click, C, or a second pinch on the sealed zone fires the cut blade.' },
  hook: { name: 'Monopolar hook', short: 'Hook', key: '3', use: 'Hold to activate and trace the incision.' },
  suction: { name: 'Suction-irrigator', short: 'Suction', key: '4', use: 'Hold to aspirate blood and smoke. Doubles as a blunt dissector.' },
  needle: { name: 'Needle driver, barbed suture', short: 'Needle driver', key: '5', use: 'Click or pinch on the vaginal edge to place a bite.' }
};
const IM = {
  steel: new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.5 }),
  shaft: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.25, roughness: 0.42, envMapIntensity: 0.7 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xece8dc, roughness: 0.42, envMapIntensity: 0.4 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2d6fb3, roughness: 0.4, metalness: 0.1, envMapIntensity: 0.5 }),
  thread: new THREE.MeshStandardMaterial({ color: 0x6a3fb0, roughness: 0.5, vertexColors: false })
};
function zCyl(r0, r1, len, z0, mat, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg || 14), mat); m.rotation.x = Math.PI / 2; m.position.z = z0 + len / 2; return m; }
function jawGeo(w, h, len, taper) {
  const g = new THREE.BoxGeometry(w, h, len, 1, 1, 6); g.translate(0, 0, -len / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 - taper * Math.pow(-p.getZ(i) / len, 1.5); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * lerp(1, k, 0.5)); }
  g.computeVertexNormals(); return g;
}
function buildInst(type) {
  const g = new THREE.Group(), o = { g, jaws: [], needle: null };
  const addJaws = (w, h, len, taper, mat) => {
    for (const sg of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(0, 0, len);
      const j = new THREE.Mesh(jawGeo(w, h, len, taper), mat); j.position.y = sg * h * 0.5; piv.add(j);
      piv.userData.sg = sg; g.add(piv); o.jaws.push(piv);
    }
  };
  if (type === 'grasper') {
    addJaws(0.36, 0.11, 1.9, 0.45, IM.steel);
    g.add(zCyl(0.25, 0.25, 0.7, 1.9, IM.steel)); g.add(zCyl(0.25, 0.25, 40, 2.6, IM.shaft));
  } else if (type === 'bipolar') {
    addJaws(0.5, 0.17, 2.1, 0.3, IM.steel);
    for (const piv of o.jaws) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 1.7), IM.ceramic); e.position.set(0, piv.userData.sg * 0.02, -0.95); piv.add(e); }
    g.add(zCyl(0.27, 0.27, 1.2, 2.1, IM.blue)); g.add(zCyl(0.25, 0.25, 40, 3.3, IM.shaft));
  } else if (type === 'hook') {
    g.add(zCyl(0.05, 0.05, 1.0, 0, IM.steel, 8));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.46, 8), IM.steel); b.position.set(0, 0.21, 0.02); g.add(b);
    g.add(zCyl(0.13, 0.19, 1.1, 0.9, IM.ceramic)); g.add(zCyl(0.25, 0.25, 40, 2.0, IM.shaft));
  } else if (type === 'suction') {
    g.add(zCyl(0.26, 0.26, 1.6, 0, IM.steel, 18)); g.add(zCyl(0.25, 0.25, 40, 1.6, IM.shaft, 18));
    const hole = new THREE.MeshBasicMaterial({ color: 0x08090a });
    for (const a of [0, 2.1, 4.2]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hole); h.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.5 + a * 0.12); g.add(h); }
    const end = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), hole); end.position.z = -0.005; end.rotation.y = Math.PI; g.add(end);
  } else if (type === 'needle') {
    addJaws(0.32, 0.13, 1.3, 0.35, IM.steel);
    g.add(zCyl(0.25, 0.25, 0.9, 1.3, IM.steel)); g.add(zCyl(0.25, 0.25, 40, 2.2, IM.shaft));
    const ng = new THREE.Group(), arc = Math.PI * 0.9;
    const nd = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 26, arc), IM.steel);
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
    ptr: { x: 0, y: 0, on: false, ndc: new THREE.Vector2() }, ray: new THREE.Ray(), pick: newPick(), nearFlag: false, lastUp: -9
  };
  for (const t in INST) { h.sub[t] = buildInst(t); h.sub[t].g.visible = t === inst; h.grp.add(h.sub[t].g); }
  scene.add(h.grp); HAND[k] = h;
}
const HANDS = [HAND.L, HAND.R];
let ACTIVE = 'R'; // mouse mode: the hand the mouse drives. Hand mode: the hand that keyboard instrument changes apply to.
const activeHand = () => HAND[ACTIVE];
const otherHand = h => (h === HAND.L ? HAND.R : HAND.L);
const CTRL = { mode: 'mouse' }; // 'mouse' | 'hands'

// ---------- input + picking ----------
const INP = { x: 0, y: 0, inside: false, down: false, ndc: new THREE.Vector2(0, 0) };
const RAY = new THREE.Raycaster();
function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function routeMouse() { // mouse mode: the mouse is the active hand's pointer; the other hand holds
  if (CTRL.mode !== 'mouse') return;
  for (const h of HANDS) {
    h.ptr.on = h.key === ACTIVE && INP.inside;
    if (h.ptr.on) { h.ptr.x = INP.x; h.ptr.y = INP.y; h.ptr.ndc.copy(INP.ndc); }
  }
}
function doPick(h) {
  const P = h.pick;
  let hit = null;
  if (h.ptr.on) {
    RAY.setFromCamera(h.ptr.ndc, camera); h.ray.copy(RAY.ray);
    const hits = RAY.intersectObjects(PICKS, false);
    for (let i = 0; i < hits.length; i++) if (shown(hits[i].object)) { hit = hits[i]; break; }
  }
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
// When a pointer is over a working point of the current step (an incision line, the cup rim), the tip rides that
// point rather than dropping through the opened tissue onto whatever lies behind it.
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
const _cv = new V3(), _g = new V3();
function updateHands(dt) {
  for (const h of HANDS) {
    const act = h.ptr.on && S.running && !S.ended, P = h.pick;
    if (h.grab && h.grab.pull) {
      const pl = h.grab.pull;
      if (act) {
        camera.getWorldDirection(_cv);
        const den = h.ray.direction.dot(_cv), tt = _g.copy(pl.nat).sub(h.ray.origin).dot(_cv) / (den || 1);
        _g.copy(h.ray.origin).addScaledVector(h.ray.direction, tt).sub(pl.nat).clampLength(0, 1.6);
        pl.off.lerp(_g, 1 - Math.exp(-14 * dt));
      }
      h.goal.copy(pl.nat).add(pl.off); h.tip.copy(h.goal);
    } else if (act && h.exch <= 0) {
      if (P.hit) { h.surf.copy(P.point).addScaledVector(P.normal, 0.1); h.depth = P.dist; }
      else h.surf.copy(h.ray.origin).addScaledVector(h.ray.direction, h.depth);
      // The tip pulls back at once but only advances deeper at a finite speed, slower still with energy on:
      // slipping off the edge of a structure must not drop the instrument straight onto whatever lies behind it.
      const dG = h.surf.distanceTo(h.ray.origin), dP = h.goal.distanceTo(h.ray.origin), lim = (h.firing ? 2.5 : 12) * dt;
      if (dG > dP + lim) h.goal.copy(h.ray.origin).addScaledVector(h.ray.direction, dP + lim); else h.goal.copy(h.surf);
    }
    const r = 1 - Math.exp(-20 * dt); h.tip.lerp(h.goal, r);
    h.near = (h.grab && h.grab.pull) || h.tip.distanceTo(h.surf) < 0.7;
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

// ---------- effects: smoke, blood, char marks ----------
const FX = { smoke: [], blood: [], sm: 0, bl: 0 };
(function () {
  const st = dotTex('rgba(235,235,240,0.55)', 'rgba(235,235,240,0)'), bt = dotTex('rgba(150,4,10,1)', 'rgba(110,0,6,0)');
  for (let i = 0; i < 46; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); FX.smoke.push({ s, life: 0, v: new V3() }); }
  for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); FX.blood.push({ s, life: 0, v: new V3() }); }
  FX.src = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, transparent: true, depthWrite: false, depthTest: false, opacity: 0.9 })); s.visible = false; s.renderOrder = 5; scene.add(s); FX.src.push(s); }
})();
function emitSmoke(p) {
  const f = FX.smoke[FX.sm++ % FX.smoke.length];
  f.s.position.copy(p); f.s.visible = true; f.life = 1; f.v.set((Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.8, 0.5 + Math.random() * 0.8); f.s.scale.setScalar(0.35);
}
function emitBlood(p, speed) {
  const f = FX.blood[FX.bl++ % FX.blood.length];
  f.s.position.copy(p); f.s.visible = true; f.life = 1; f.v.set((Math.random() - 0.5) * speed * 0.7, speed * (0.5 + Math.random() * 0.5), speed * (0.25 + Math.random() * 0.5)); f.s.scale.setScalar(0.14 + Math.random() * 0.12);
}
const _bp = new V3();
function updateFX(dt, time) {
  for (const f of FX.smoke) if (f.life > 0) {
    f.life -= dt / 2.2; f.s.position.addScaledVector(f.v, dt); f.s.scale.setScalar(0.35 + (1 - f.life) * 2.4); f.s.material.opacity = 0.16 * Math.max(0, f.life) * (f.life > 0.85 ? (1 - f.life) / 0.15 : 1);
    if (f.life <= 0) f.s.visible = false;
  }
  for (const f of FX.blood) if (f.life > 0) {
    f.life -= dt / 0.75; f.v.y -= 22 * dt; f.s.position.addScaledVector(f.v, dt); f.s.material.opacity = Math.min(1, f.life * 3);
    if (f.life <= 0) f.s.visible = false;
  }
  for (let i = S.bleeders.length - 1; i >= 0; i--) {
    const b = S.bleeders[i]; b.t += dt;
    const vol = (b.rate * dt) / 60; S.ebl += vol; S.pool += vol;
    const p = b.pt(_bp);
    if (b.arterial) { if (pulse(time) > 0.35) { emitBlood(p, 6 + Math.random() * 3); if (Math.random() < 0.5) emitBlood(p, 5); } }
    else if (Math.random() < 0.45 + b.rate / 120) emitBlood(p, 1.6 + b.rate / 50);
    if (b.auto && b.t > b.auto) { S.bleeders.splice(i, 1); logEvent('info', b.autoMsg || 'Bleeding controlled'); }
  }
  for (let i = 0; i < FX.src.length; i++) {
    const b = S.bleeders[i], s = FX.src[i]; s.visible = !!b;
    if (b) { s.position.copy(b.pt(_bp)); s.scale.setScalar((0.32 + Math.min(0.5, b.rate / 400)) * (1 + 0.25 * pulse(time))); }
  }
  S.haze = Math.max(0, S.haze - dt * (HANDS.some(h => h.firing && h.inst === 'suction') ? 0.6 : 0.07));
  $('haze').style.opacity = (S.haze * 0.75).toFixed(3);
}
function addBleeder(pt, rate, arterial, label, extra) {
  const b = Object.assign({ pt, rate, arterial: !!arterial, seal: 0, t: 0, label }, extra || {});
  S.bleeders.push(b); return b;
}
const DECALS = [], decalGeo = new THREE.CircleGeometry(0.17, 10);
const decalMat = new THREE.MeshBasicMaterial({ color: 0x2c160d, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const holeMat = new THREE.MeshBasicMaterial({ color: 0x100404, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
let lastDecal = new V3(1e3, 0, 0);
function addDecal(h, big) {
  const P = h.pick;
  if (!P.hit || !P.mesh || !['uterus', 'bladder', 'wall', 'rectum'].includes(P.ent)) return;
  if (!big && lastDecal.distanceTo(P.point) < 0.14) return;
  lastDecal.copy(P.point);
  const m = new THREE.Mesh(decalGeo, big ? holeMat : decalMat);
  m.position.copy(P.point).addScaledVector(P.normal, 0.025); m.lookAt(_bp.copy(m.position).add(P.normal));
  if (big) m.scale.setScalar(2.2);
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
function nearTarget(h, p, r) { const d = h.tip.distanceTo(p); return d < r || (d < r + 1.6 && h.ptr.on && h.ray.distanceSqToPoint(p) < 0.2); }
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
  if (Math.random() < dt * 9) emitSmoke(h.tip);
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
  if (Math.random() < dt * 14) emitSmoke(h.tip);
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
