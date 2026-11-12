// ---------- renderer, camera, scope light ----------
const GLC = $('gl'), VIEW = $('view');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: GLC, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }
if (!renderer) { $('nogl').hidden = false; throw new Error('WebGL unavailable'); }
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.NeutralToneMapping; // only used when the picture is drawn straight to the screen (Low quality)

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, 1.6, 0.25, 90);
scene.add(camera);

// The only real light in the abdomen leaves from around the lens. Tissue close to the scope is bright, tissue a few
// centimetres deeper is much darker, and the edges of the picture fall off. LIGHT.ref is the working distance at
// which a matte white surface comes out at a radiance of about 1.
const LIGHT = { decay: 2.3, ref: 11, gain: 1 };
const head = new THREE.SpotLight(0xffffff, 1, 0, 1.0, 0.62, LIGHT.decay);
head.intensity = Math.PI * Math.pow(LIGHT.ref, LIGHT.decay) * LIGHT.gain;
// The light fibres sit beside the lens, not on its axis, so everything throws a thin shadow to one side. Those
// shadows are the main depth cue in a flat picture: an instrument's shadow closes up as it nears the tissue.
head.position.set(0.3, 0.9, 0); head.target.position.set(0.3, 0.9, -1);
camera.add(head); camera.add(head.target);
head.castShadow = true; head.shadow.mapSize.set(2048, 2048); head.shadow.camera.near = 0.6; head.shadow.camera.far = 60;
head.shadow.bias = -0.0006; head.shadow.normalBias = 0.03; head.shadow.radius = 1.8;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

// Everything else is light that has already bounced off lit tissue: dim and red, strongest from the deep pelvis.
// It fills the shadows, and it is what steel and wet surfaces mirror.
const ENV = (function () {
  const sc = new THREE.Scene();
  const g = new THREE.SphereGeometry(40, 48, 32), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const d = new V3(), deep = V(0, -0.45, -0.89).normalize(), fat = V(0.55, -0.6, -0.3).normalize(), fat2 = V(-0.6, -0.5, 0.1).normalize();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const k = Math.pow(Math.max(0, d.dot(deep) * 0.5 + 0.5), 2.2);
    const f = Math.pow(Math.max(0, d.dot(fat)), 10) + 0.7 * Math.pow(Math.max(0, d.dot(fat2)), 14);
    const n = 0.75 + 0.5 * fbm3(d.x * 2.2 + 3, d.y * 2.2 + 1, d.z * 2.2 + 7, 3);
    col[i * 3] = (0.03 + 0.5 * k * n) + 0.4 * f; col[i * 3 + 1] = (0.012 + 0.2 * k * n) + 0.3 * f; col[i * 3 + 2] = (0.012 + 0.18 * k * n) + 0.1 * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false })));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.02).texture; pm.dispose(); g.dispose();
  return tex;
})();
scene.environment = ENV; scene.environmentIntensity = 0.3;

// ---------- camera rig (scope pivots at the umbilical port) ----------
const CAM = { pivot: V(0, 9.2, 17.5), tgt: V(0, -1.2, -1), goal: V(0, -1.2, -1), pan: V(0, 0, 0), ins: 5.5, insGoal: 5.5, userIns: 0, dist: 12 };
const _cd = new V3();
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateCamera(dt, t) {
  const g = _cd.copy(CAM.goal).add(CAM.pan);
  CAM.tgt.x = damp(CAM.tgt.x, g.x, 2.6, dt); CAM.tgt.y = damp(CAM.tgt.y, g.y, 2.6, dt); CAM.tgt.z = damp(CAM.tgt.z, g.z, 2.6, dt);
  CAM.ins = damp(CAM.ins, clamp(CAM.insGoal + CAM.userIns, 1.5, 21), 3, dt);
  const sway = REDUCED ? 0 : 1;
  _cd.copy(CAM.tgt).sub(CAM.pivot).normalize();
  camera.position.copy(CAM.pivot).addScaledVector(_cd, CAM.ins);
  camera.position.x += Math.sin(t * 0.9) * 0.035 * sway; camera.position.y += Math.sin(t * 1.3 + 1) * 0.03 * sway;
  camera.up.set(Math.sin(t * 0.5) * 0.006 * sway, 1, 0);
  camera.lookAt(CAM.tgt);
  camera.updateMatrixWorld(true);
  CAM.dist = camera.position.distanceTo(CAM.tgt);
}
let VW = 1, VH = 1;
function resize() {
  const r = VIEW.getBoundingClientRect();
  VW = Math.max(2, Math.floor(r.width)); VH = Math.max(2, Math.floor(r.height));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUAL.cur.pr));
  renderer.setSize(VW, VH, false);
  const asp = VW / VH; camera.aspect = asp;
  // keep roughly constant horizontal coverage on narrow views
  const hf = 2 * Math.atan(Math.tan((56 * DEG) / 2) * 1.6);
  camera.fov = asp >= 1.6 ? 56 : clamp((2 * Math.atan(Math.tan(hf / 2) / asp)) / DEG, 56, 84);
  camera.updateProjectionMatrix();
  const ov = $('ov'), pr = Math.min(window.devicePixelRatio || 1, 2);
  ov.width = VW * pr; ov.height = VH * pr;
  postResize();
}
