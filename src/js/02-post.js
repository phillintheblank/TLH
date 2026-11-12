// ---------- picture quality and the camera pipeline ----------
// With quality Medium or High the scene is drawn into a high-dynamic-range buffer and then put through what a
// laparoscope's camera does to it: automatic exposure, glare around highlights, edge enhancement, sensor noise,
// lens fall-off and the grey veil of smoke. Low draws straight to the screen.
const QPRE = {
  low: { name: 'Low', post: false, pr: 1, msaa: 0, trans: false, tscale: 0.5, sharp: 0, shadow: 0 },
  medium: { name: 'Medium', post: true, pr: 1.25, msaa: 2, trans: true, tscale: 0.5, sharp: 0.15, shadow: 1024 },
  high: { name: 'High', post: true, pr: 2, msaa: 4, trans: true, tscale: 1, sharp: 0.2, shadow: 2048 }
};
const QKEY = 'tlh.quality.v1';
const QUAL = { mode: 'auto', level: 'high', cur: QPRE.high, hdr: false, ema: 16, slowT: 0, note: '' };
QUAL.hdr = renderer.capabilities.isWebGL2 !== false && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
const GRADE = { key: 0.25, evMin: 0.25, evMax: 6, bloom: 0.07, vig: 0.38, sat: 0.9, desat: 0.3, con: 0.3, grain: 1, low: 0.8 };

const POST = { main: null, d: [], u: [], lum: null, reset: true, w: 0, h: 0, msaa: -1 };
const FSQ = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null) };
FSQ.mesh.frustumCulled = false; FSQ.scene.add(FSQ.mesh);
const FS_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const fsMat = (frag, uniforms, extra) => new THREE.ShaderMaterial(Object.assign({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false }, extra || {}));
const U = v => ({ value: v });
const PM = {
  // 2x reduction. The first one also tames single very bright pixels (they would flicker in the glare) and
  // records how far inside the near-focus limit each pixel is.
  down: fsMat(`
    uniform sampler2D t; uniform sampler2D tDepth; uniform vec2 px; uniform vec2 nf; uniform float first; varying vec2 vUv;
    float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec4 a = texture2D(t, vUv + px * vec2(-1.0, -1.0)), b = texture2D(t, vUv + px * vec2(1.0, -1.0)), c = texture2D(t, vUv + px * vec2(-1.0, 1.0)), d = texture2D(t, vUv + px * vec2(1.0, 1.0));
      if (first > 0.5) {
        float wa = 1.0 / (1.0 + lum(a.rgb)), wb = 1.0 / (1.0 + lum(b.rgb)), wc = 1.0 / (1.0 + lum(c.rgb)), wd = 1.0 / (1.0 + lum(d.rgb));
        float z = texture2D(tDepth, vUv).x, dist = nf.x * nf.y / (nf.y - z * (nf.y - nf.x));
        gl_FragColor = vec4((a.rgb * wa + b.rgb * wb + c.rgb * wc + d.rgb * wd) / (wa + wb + wc + wd), 1.0 - smoothstep(1.4, 4.2, dist));
      } else gl_FragColor = (a + b + c + d) * 0.25;
    }`, { t: U(null), tDepth: U(null), px: U(new V2()), nf: U(new V2()), first: U(0) }),
  up: fsMat(`
    uniform sampler2D t; uniform sampler2D tAdd; uniform vec2 px; uniform float gain; varying vec2 vUv;
    void main() {
      vec4 o = px.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
      vec3 s = texture2D(t, vUv - o.xy).rgb + 2.0 * texture2D(t, vUv - o.wy).rgb + texture2D(t, vUv - o.zy).rgb
        + 2.0 * texture2D(t, vUv + o.zw).rgb + 4.0 * texture2D(t, vUv).rgb + 2.0 * texture2D(t, vUv + o.xw).rgb
        + texture2D(t, vUv + o.zy).rgb + 2.0 * texture2D(t, vUv + o.wy).rgb + texture2D(t, vUv + o.xy).rgb;
      gl_FragColor = vec4((s / 16.0 + texture2D(tAdd, vUv).rgb) * gain, 1.0);
    }`, { t: U(null), tAdd: U(null), px: U(new V2()), gain: U(1) }),
  // centre-weighted light meter; written with alpha so the stored value eases toward the new reading
  meter: fsMat(`
    uniform sampler2D t; uniform float k;
    void main() {
      float s = 0.0, w = 0.0;
      for (int j = 0; j < 6; j++) for (int i = 0; i < 6; i++) {
        vec2 p = (vec2(float(i), float(j)) + 0.5) / 6.0;
        float ww = 1.0 - 0.75 * smoothstep(0.12, 0.62, distance(p, vec2(0.5)));
        vec3 c = texture2D(t, p).rgb;
        float l = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.55 * max(c.r, max(c.g, c.b)));
        if (l == l && l < 1.0e5) { s += ww * log(l + 0.003); w += ww; }
      }
      float L = w > 0.0 ? exp(s / w) : 0.2;
      gl_FragColor = vec4(L, L, L, k);
    }`, { t: U(null), k: U(1) }, { transparent: true, blending: THREE.NormalBlending }),
  out: fsMat(`
    uniform sampler2D tMain; uniform sampler2D tD1; uniform sampler2D tD2; uniform sampler2D tBloom; uniform sampler2D tLum; uniform sampler2D tDepth;
    uniform vec2 res; uniform vec2 nf; uniform vec2 evLim;
    uniform float time; uniform float haze; uniform float key; uniform float bloom; uniform float sharp; uniform float grain; uniform float vig; uniform float sat; uniform float desat; uniform float con;
    varying vec2 vUv;
    // Camera response: true colour through the mid-tones, then a soft knee where highlights wash out toward white
    vec3 tm(vec3 c) {
      float x = min(c.r, min(c.g, c.b)), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
      c -= off;
      float peak = max(c.r, max(c.g, c.b));
      if (peak < 0.76) return c;
      float d = 0.24, np = 1.0 - d * d / (peak + d - 0.76);
      c *= np / peak;
      return mix(c, vec3(np), 1.0 - 1.0 / (desat * (peak - np) + 1.0));
    }
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec3 col = texture2D(tMain, vUv).rgb;
      vec4 d1 = texture2D(tD1, vUv), d2 = texture2D(tD2, vUv);
      float cn = smoothstep(0.04, 0.75, d2.a);
      col = mix(col, mix(d1.rgb, d2.rgb, cn), cn);
      float L = texture2D(tLum, vec2(0.5)).r;
      float ev = clamp(key / max(L, 0.0001), evLim.x, evLim.y);
      float z = texture2D(tDepth, vUv).x, dist = nf.x * nf.y / (nf.y - z * (nf.y - nf.x));
      float f = haze * (1.0 - exp(-dist * 0.11));
      vec3 veil = vec3(0.93, 0.95, 1.0) * L * 2.3;
      col = mix(col, veil, f);
      vec3 bl = texture2D(tBloom, vUv).rgb;
      float ba = bloom + 0.3 * haze;
      col = mix(col, bl, ba);
      vec3 c = tm(col * ev);
      if (sharp > 0.0) { vec3 b = tm(mix(mix(d1.rgb, veil, f), bl, ba) * ev); c += (c - b) * sharp * (1.0 - cn); }
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      c = mix(c, c * c * (3.0 - 2.0 * c), con);
      vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0);
      float r = length(q) / (0.5 * length(vec2(res.x / res.y, 1.0)));
      c *= 1.0 - vig * smoothstep(0.5, 1.08, r);
      float n = hash(gl_FragCoord.xy + fract(time * 7.0) * vec2(1373.0, 719.0)) + hash(gl_FragCoord.yx + fract(time * 3.0) * vec2(311.0, 977.0)) - 1.0;
      c += n * grain * (0.006 + 0.009 * (1.0 - l)) * (1.0 + 0.35 * log2(max(ev, 1.0)));
      c = clamp(c, 0.0, 1.0);
      gl_FragColor = vec4(mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))), 1.0);
    }`, { tMain: U(null), tD1: U(null), tD2: U(null), tBloom: U(null), tLum: U(null), tDepth: U(null), res: U(new V2(1, 1)), nf: U(new V2()), evLim: U(new V2(0.25, 6)),
    time: U(0), haze: U(0), key: U(0.2), bloom: U(0.07), sharp: U(0.3), grain: U(1), vig: U(0.38), sat: U(1.06), desat: U(0.3), con: U(0.2) })
};
function mkRT(w, h, o) {
  return new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), Object.assign({ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false }, o));
}
function postDispose() {
  if (POST.main) { if (POST.main.depthTexture) POST.main.depthTexture.dispose(); POST.main.dispose(); }
  for (const r of POST.d.concat(POST.u)) r.dispose();
  POST.main = null; POST.d = []; POST.u = [];
}
function postResize() {
  const q = QUAL.cur;
  if (!q.post) { postDispose(); POST.w = POST.h = 0; return; }
  const sz = renderer.getDrawingBufferSize(new V2()), w = sz.x, h = sz.y;
  if (POST.main && POST.w === w && POST.h === h && POST.msaa === q.msaa) return;
  postDispose(); POST.w = w; POST.h = h; POST.msaa = q.msaa;
  POST.main = mkRT(w, h, { depthBuffer: true, samples: q.msaa, depthTexture: new THREE.DepthTexture(w, h) });
  for (let i = 1; i <= 5; i++) POST.d.push(mkRT(w >> i, h >> i));
  for (let i = 2; i <= 4; i++) POST.u.push(mkRT(w >> i, h >> i)); // glare accumulates into quarter size
  if (!POST.lum) POST.lum = mkRT(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  POST.reset = true;
}
function fsPass(mat, target) { FSQ.mesh.material = mat; renderer.setRenderTarget(target); renderer.render(FSQ.scene, FSQ.cam); }
const lowExposure = () => GRADE.low * clamp(Math.pow(CAM.dist / LIGHT.ref, LIGHT.decay * 0.8), 0.3, 1.5);
function renderFrame(dt, time, haze) {
  const q = QUAL.cur;
  if (!q.post || !POST.main) {
    renderer.setRenderTarget(null); renderer.toneMappingExposure = lowExposure();
    renderer.render(scene, camera); return;
  }
  renderer.setRenderTarget(POST.main); renderer.render(scene, camera);
  const D = POST.d, Uu = POST.u, dn = PM.down.uniforms, up = PM.up.uniforms;
  dn.nf.value.set(camera.near, camera.far); dn.tDepth.value = POST.main.depthTexture;
  let src = POST.main;
  for (let i = 0; i < D.length; i++) { dn.t.value = src.texture; dn.px.value.set(1 / src.width, 1 / src.height); dn.first.value = i === 0 ? 1 : 0; fsPass(PM.down, D[i]); src = D[i]; }
  // glare: blur pyramid from 1/32 back up to 1/4
  src = D[4];
  for (let i = 2; i >= 0; i--) { up.t.value = src.texture; up.px.value.set(1 / src.width, 1 / src.height); up.tAdd.value = D[i + 1].texture; up.gain.value = i === 0 ? 0.25 : 1; fsPass(PM.up, Uu[i]); src = Uu[i]; }
  // light meter
  const mu = PM.meter.uniforms; mu.t.value = D[4].texture; mu.k.value = POST.reset ? 1 : 1 - Math.exp(-dt * 3.2);
  PM.meter.transparent = !POST.reset; PM.meter.blending = POST.reset ? THREE.NoBlending : THREE.NormalBlending;
  renderer.autoClear = false; fsPass(PM.meter, POST.lum); renderer.autoClear = true; POST.reset = false;
  const o = PM.out.uniforms;
  o.tMain.value = POST.main.texture; o.tD1.value = D[0].texture; o.tD2.value = D[1].texture; o.tBloom.value = Uu[0].texture; o.tLum.value = POST.lum.texture; o.tDepth.value = POST.main.depthTexture;
  o.res.value.set(POST.w, POST.h); o.nf.value.set(camera.near, camera.far); o.evLim.value.set(GRADE.evMin, GRADE.evMax);
  o.time.value = time % 100; o.haze.value = haze; o.key.value = GRADE.key; o.bloom.value = GRADE.bloom; o.sharp.value = q.sharp; o.grain.value = REDUCED ? 0.4 * GRADE.grain : GRADE.grain; o.vig.value = GRADE.vig; o.sat.value = GRADE.sat; o.desat.value = GRADE.desat; o.con.value = GRADE.con;
  fsPass(PM.out, null);
}

// ---------- quality setting ----------
function applyQuality() {
  QUAL.cur = QUAL.hdr ? QPRE[QUAL.level] : QPRE.low;
  renderer.transmissionResolutionScale = QUAL.cur.tscale;
  const sh = QUAL.cur.shadow;
  head.castShadow = sh > 0;
  if (sh && head.shadow.mapSize.x !== sh) { head.shadow.mapSize.set(sh, sh); if (head.shadow.map) { head.shadow.map.dispose(); head.shadow.map = null; } }
  VIEW.classList.toggle('post', QUAL.cur.post);
  matQuality(QUAL.cur);
  resize();
  const sel = $('selQ');
  if (sel) { sel.value = QUAL.mode; sel.options[0].textContent = 'Quality: auto (' + QUAL.cur.name.toLowerCase() + ')'; }
}
function setQuality(mode, save) {
  if (mode !== 'auto' && !QPRE[mode]) mode = 'auto';
  QUAL.mode = mode; QUAL.level = mode === 'auto' ? 'high' : mode; QUAL.slowT = 0; QUAL.ema = 16;
  if (save) { try { localStorage.setItem(QKEY, mode); } catch (e) {} }
  applyQuality();
}
// Auto: step down when frames stay slow. It never steps back up by itself, so the picture does not keep changing.
function qualityTick(rawDt) {
  if (QUAL.mode !== 'auto' || document.hidden || rawDt > 0.25 || QUAL.level === 'low') return;
  QUAL.ema = lerp(QUAL.ema, rawDt * 1000, 0.06);
  QUAL.slowT = QUAL.ema > 30 ? QUAL.slowT + rawDt : Math.max(0, QUAL.slowT - rawDt * 2);
  if (QUAL.slowT > 4) {
    QUAL.level = QUAL.level === 'high' ? 'medium' : 'low'; QUAL.slowT = 0; QUAL.ema = 16; applyQuality();
    toast('Picture quality lowered to ' + QUAL.cur.name.toLowerCase() + ' to keep the motion smooth', 'info');
  }
}
