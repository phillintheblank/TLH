// ---------- renderer, camera, lights, materials ----------
const GLC = $('gl'), VIEW = $('view');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: GLC, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }
if (!renderer) { $('nogl').hidden = false; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x050101, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x160405, 11, 36);
const camera = new THREE.PerspectiveCamera(56, 1.6, 0.25, 90);
scene.add(camera);

const head = new THREE.SpotLight(0xfff1e4, 3.1, 48, 0.62, 0.95, 1.55);
head.position.set(0, 0, 0); head.target.position.set(0, 0, -1);
camera.add(head); camera.add(head.target);
scene.add(new THREE.HemisphereLight(0x6b3430, 0x1c0707, 0.5));

// soft environment so wet surfaces and steel pick up a broad sheen
const ENV = (function () {
  const sc = new THREE.Scene();
  const g = new THREE.SphereGeometry(40, 32, 20), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const d = new V3(), key = V(0, 0.45, 0.89).normalize();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const k = Math.pow(Math.max(0, d.dot(key)), 6);
    col[i * 3] = 0.16 + 2.6 * k; col[i * 3 + 1] = 0.035 + 2.0 * k; col[i * 3 + 2] = 0.03 + 1.7 * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.03).texture; pm.dispose();
  return tex;
})();

const BUMP = bumpTex(11, 8), BUMP2 = bumpTex(23, 16);
const TEX = {
  uterus: tissueTex({ seed: 3, base: [206, 116, 122], dark: [164, 78, 92], vessels: 26, vw: 1.5, vcol: 'rgba(118,24,40,0.42)', veins: 5 }),
  perit: tissueTex({ seed: 8, base: [198, 94, 90], dark: [146, 56, 60], fat: [216, 170, 108], fatAmt: 0.55, fatTh: 0.6, vessels: 30, vw: 1.5, vcol: 'rgba(128,20,30,0.5)', veins: 8 }),
  leaf: tissueTex({ seed: 14, base: [214, 122, 116], dark: [176, 84, 86], fat: [232, 192, 128], fatAmt: 0.35, fatTh: 0.62, vessels: 22, vw: 1.2, vcol: 'rgba(132,24,36,0.5)' }),
  bladder: tissueTex({ seed: 21, base: [212, 132, 116], dark: [184, 100, 94], fat: [224, 184, 120], fatAmt: 0.5, fatTh: 0.55, vessels: 34, vw: 1.4, vcol: 'rgba(138,26,34,0.5)', veins: 6 }),
  bowel: tissueTex({ seed: 29, base: [210, 142, 132], dark: [178, 104, 100], vessels: 26, vw: 1.1, vcol: 'rgba(140,34,44,0.45)', veins: 5, stripe: true }),
  ovary: tissueTex({ seed: 35, base: [232, 208, 198], dark: [208, 172, 166], vessels: 7, vw: 0.9, vcol: 'rgba(170,70,80,0.35)' }),
  fat: tissueTex({ seed: 41, base: [234, 198, 124], dark: [214, 160, 92], vessels: 14, vw: 1.0, vcol: 'rgba(160,36,36,0.5)', mottle: 0.9 }),
  card: tissueTex({ seed: 47, base: [228, 172, 152], dark: [202, 132, 120], fat: [234, 200, 130], fatAmt: 0.35, vessels: 22, vw: 1.3, vcol: 'rgba(140,26,36,0.55)', veins: 8 }),
  vag: tissueTex({ seed: 53, base: [226, 150, 146], dark: [196, 112, 116], vessels: 14, vw: 1.0, vcol: 'rgba(140,30,44,0.4)' })
};
function wet(o) {
  return new THREE.MeshPhysicalMaterial(Object.assign({
    color: 0xffffff, roughness: 0.52, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    envMap: ENV, envMapIntensity: 0.55, bumpMap: BUMP, bumpScale: 0.05, vertexColors: true
  }, o));
}
const MAT = {
  uterus: wet({ map: TEX.uterus, clearcoatRoughness: 0.12 }),
  perit: wet({ map: TEX.perit, bumpScale: 0.05 }),
  leaf: wet({ map: TEX.leaf, side: THREE.DoubleSide, bumpScale: 0.03 }),
  bladder: wet({ map: TEX.bladder }),
  bowel: wet({ map: TEX.bowel, clearcoatRoughness: 0.1, bumpMap: BUMP2, bumpScale: 0.07 }),
  ovary: wet({ map: TEX.ovary, clearcoatRoughness: 0.2, bumpMap: BUMP2, bumpScale: 0.05 }),
  fat: wet({ map: TEX.fat, side: THREE.DoubleSide, bumpMap: BUMP2, bumpScale: 0.07, roughness: 0.6 }),
  card: wet({ map: TEX.card, side: THREE.DoubleSide }),
  vag: wet({ map: TEX.vag, side: THREE.DoubleSide }),
  cord: wet({ bumpScale: 0.02 }),
  blood: new THREE.MeshPhysicalMaterial({ color: 0x5c0409, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, envMap: ENV, envMapIntensity: 0.9, transparent: true, opacity: 0.93 })
};

// ---------- camera rig (scope pivots at the umbilical port) ----------
const CAM = { pivot: V(0, 9.2, 17.5), tgt: V(0, -1.2, -1), goal: V(0, -1.2, -1), pan: V(0, 0, 0), ins: 5.5, insGoal: 5.5, userIns: 0 };
const _cd = new V3();
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
  // crude auto-exposure: the image would otherwise burn out as the scope closes in
  renderer.toneMappingExposure = 1.12 * clamp(Math.pow(camera.position.distanceTo(CAM.tgt) / 12, 0.55), 0.6, 1.12);
}
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let VW = 1, VH = 1;
function resize() {
  const r = VIEW.getBoundingClientRect();
  VW = Math.max(2, Math.floor(r.width)); VH = Math.max(2, Math.floor(r.height));
  renderer.setSize(VW, VH, false);
  const asp = VW / VH; camera.aspect = asp;
  // keep roughly constant horizontal coverage on narrow views
  const hf = 2 * Math.atan(Math.tan((56 * DEG) / 2) * 1.6);
  camera.fov = asp >= 1.6 ? 56 : clamp((2 * Math.atan(Math.tan(hf / 2) / asp)) / DEG, 56, 84);
  camera.updateProjectionMatrix();
  const ov = $('ov'), pr = Math.min(window.devicePixelRatio || 1, 2);
  ov.width = VW * pr; ov.height = VH * pr;
}
