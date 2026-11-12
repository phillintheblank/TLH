// ---------- procedural textures ----------
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const mkCanvas = S => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv; };
// tileable fractal value noise over the unit square; `per` lattice cells across at the coarsest octave
function fbmTile(per, oct, seed) {
  const L = [];
  for (let i = 0, p = per; i < oct; i++, p *= 2) { const a = new Float32Array(p * p), R = prng(seed * 131 + i * 977 + 5); for (let k = 0; k < a.length; k++) a[k] = R(); L.push(a); }
  return (u, v) => {
    let s = 0, amp = 0.5, n = 0, p = per;
    u -= Math.floor(u); v -= Math.floor(v);
    for (let i = 0; i < oct; i++, p *= 2, amp *= 0.5) {
      const a = L[i], X = u * p, Y = v * p, xf = Math.floor(X), yf = Math.floor(Y), fx = X - xf, fy = Y - yf;
      const x0 = xf % p, y0 = yf % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), r0 = y0 * p, r1 = y1 * p;
      s += amp * ((a[r0 + x0] * (1 - sx) + a[r0 + x1] * sx) * (1 - sy) + (a[r1 + x0] * (1 - sx) + a[r1 + x1] * sx) * sy); n += amp;
    }
    return s / n;
  };
}
// tileable cellular noise: o[0], o[1] = distance to the nearest and second-nearest cell centre, in cells
function cellTile(per, seed) {
  const px = new Float32Array(per * per), py = new Float32Array(per * per), R = prng(seed * 71 + 9);
  for (let i = 0; i < px.length; i++) { px[i] = 0.15 + 0.7 * R(); py[i] = 0.15 + 0.7 * R(); }
  return (u, v, o) => {
    u -= Math.floor(u); v -= Math.floor(v);
    const X = u * per, Y = v * per, cx = Math.floor(X), cy = Math.floor(Y);
    let f1 = 9, f2 = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = ((cy + dy + per) % per) * per + ((cx + dx + per) % per), ex = cx + dx + px[k] - X, ey = cy + dy + py[k] - Y, d = ex * ex + ey * ey;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    o[0] = Math.sqrt(f1); o[1] = Math.sqrt(f2);
  };
}
// tangent-space normal map from a tileable height function
function normalTex(S, hf, k) {
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) H[y * S + x] = hf(x / S, y / S);
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (H[y * S + (x + S - 1) % S] - H[y * S + (x + 1) % S]) * k, ny = (H[((y + S - 1) % S) * S + x] - H[((y + 1) % S) * S + x]) * k, l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = ANISO; t.needsUpdate = true;
  return t;
}
function drawVessel(g, S, R, x, y, ang, w, depth, col, wig, wm) {
  wm = wm || 1;
  const pts = [[x, y, w]], L = S / 170, steps = Math.floor((8 + R() * 30) * Math.min(1.7, 0.6 + w / (S / 600)));
  let a = ang, cx = x, cy = y, ww = w;
  for (let i = 0; i < steps; i++) {
    a += (R() - 0.5) * wig; cx += Math.cos(a) * L; cy += Math.sin(a) * L; ww *= 0.982; pts.push([cx, cy, ww]);
    if (depth > 0 && R() < 0.2) drawVessel(g, S, R, cx, cy, a + (R() < 0.5 ? 1 : -1) * (0.4 + R() * 0.8), ww * 0.62, depth - 1, col, wig * 1.15, wm);
  }
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0] + ox); x1 = Math.max(x1, p[0] + ox); y0 = Math.min(y0, p[1] + oy); y1 = Math.max(y1, p[1] + oy); }
    if (x1 < -4 || x0 > S + 4 || y1 < -4 || y0 > S + 4) continue;
    for (let i = 0; i < pts.length - 1; i += 3) { // short runs so the width can taper
      g.lineWidth = pts[i][2] * wm; g.beginPath(); g.moveTo(pts[i][0] + ox, pts[i][1] + oy);
      for (let j = i + 1; j <= Math.min(i + 3, pts.length - 1); j++) g.lineTo(pts[j][0] + ox, pts[j][1] + oy);
      g.stroke();
    }
  }
}
// Colour map for one tissue. Broad mottling is computed at half size and enlarged; vessels and grain are drawn at
// full size so they stay crisp. o.trans also returns a map of how much light the tissue lets through.
function tissueTex(o) {
  const S0 = 512, S = o.size || 1024, cv0 = mkCanvas(S0), g0 = cv0.getContext('2d'), img = g0.createImageData(S0, S0), d = img.data;
  const B = o.base, D = o.dark || o.base, P = o.pale, F = o.fat, seed = o.seed;
  const wx = fbmTile(4, 3, seed + 33), wy = fbmTile(4, 3, seed + 57), n1 = fbmTile(o.per || 4, 5, seed), n2 = fbmTile(8, 4, seed + 91), n3 = fbmTile(3, 4, seed + 12), n4 = fbmTile(26, 2, seed + 71);
  const cell = o.cells ? cellTile(o.cells, seed + 7) : null, co = [0, 0];
  const tr = o.trans ? new Uint8ClampedArray(S0 * S0) : null;
  for (let y = 0; y < S0; y++) for (let x = 0; x < S0; x++) {
    const u = x / S0, v = y / S0, ax = (wx(u, v) - 0.5) * 0.2, ay = (wy(u, v) - 0.5) * 0.2;
    const n = n1(u + ax * 0.5, v + ay * 0.5), t = sstep(0.3, 0.72, n) * (o.mottle == null ? 1 : o.mottle);
    let r = lerp(B[0], D[0], t), gg = lerp(B[1], D[1], t), b = lerp(B[2], D[2], t), f = 0;
    if (P) { const q = sstep(0.5, 0.74, n3(u + ax, v + ay)) * (o.paleAmt || 0.6); r = lerp(r, P[0], q); gg = lerp(gg, P[1], q); b = lerp(b, P[2], q); }
    if (F) { f = sstep(o.fatTh || 0.56, (o.fatTh || 0.56) + 0.14, n2(u + ax, v + ay)) * (o.fatAmt || 0.7); r = lerp(r, F[0], f); gg = lerp(gg, F[1], f); b = lerp(b, F[2], f); }
    if (cell) { cell(u + ax * 0.3, v + ay * 0.3, co); const cr = 1 - sstep(0.02, 0.22, co[1] - co[0]), k = cr * (F ? f : 1) * 0.5; r = lerp(r, 196, k); gg = lerp(gg, 112, k); b = lerp(b, 60, k); }
    if (o.streak) { const q = 1 - o.streak * sstep(0.35, 0.75, n4(u, v * 0.07)); r *= q; gg *= q * q; b *= q * q; }
    if (o.stripe) { const k = Math.exp(-Math.pow(((u + 0.5) % 1 - 0.5) / 0.05, 2)) * 0.5; r = lerp(r, 240, k); gg = lerp(gg, 208, k); b = lerp(b, 198, k); }
    const i = (y * S0 + x) * 4;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    if (tr) tr[y * S0 + x] = 255 * clamp(o.trans * (1 - f * 1.3) * (0.7 + 0.6 * n), 0, 1);
  }
  g0.putImageData(img, 0, 0);
  const cv = mkCanvas(S), g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cv0, 0, 0, S, S);
  const R = prng(seed * 7 + 3), k = S / 512;
  if (o.vessels) {
    const vc = o.vcol || [128, 24, 40], a = o.va || 0.5;
    // a faint wide stroke under each vessel reads as a vessel lying under the surface rather than on it
    for (let i = 0; i < o.vessels; i++) {
      const x = R() * S, y = R() * S, ang = R() * TAU, w = (o.vw || 1.5) * k * (0.45 + R()), dep = w > 1.2 * k ? 3 : 2;
      const rs = prng(seed * 977 + i * 31 + 1), rs2 = prng(seed * 977 + i * 31 + 1);
      drawVessel(g, S, rs, x, y, ang, w, dep, 'rgba(' + vc.join(',') + ',' + (a * 0.16).toFixed(3) + ')', o.wig || 0.7, 3.2);
      drawVessel(g, S, rs2, x, y, ang, w, dep, 'rgba(' + vc.join(',') + ',' + a + ')', o.wig || 0.7);
    }
    for (let i = 0; i < (o.veins || 0); i++) drawVessel(g, S, R, R() * S, R() * S, R() * TAU, 1.9 * k * (0.6 + R()), 2, 'rgba(74,52,118,0.3)', 0.6);
    // capillary blush: very fine, short, tortuous
    for (let i = 0; i < (o.caps || 0); i++) drawVessel(g, S, R, R() * S, R() * S, R() * TAU, 0.55 * k, 1, 'rgba(' + vc.join(',') + ',' + (a * 0.42).toFixed(3) + ')', 0.9);
  }
  // fine grain
  const gi = g.getImageData(0, 0, S, S), gd = gi.data;
  for (let i = 0, p = 0; i < gd.length; i += 4, p++) { const n = (hashI(p % S, (p / S) | 0, seed + 5) - 0.5) * 9; gd[i] += n; gd[i + 1] += n; gd[i + 2] += n; }
  g.putImageData(gi, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
  if (!tr) return tex;
  const tv = mkCanvas(S0), tg = tv.getContext('2d'), ti = tg.createImageData(S0, S0);
  for (let i = 0; i < tr.length; i++) { ti.data[i * 4] = ti.data[i * 4 + 1] = ti.data[i * 4 + 2] = tr[i]; ti.data[i * 4 + 3] = 255; }
  tg.putImageData(ti, 0, 0);
  tg.globalCompositeOperation = 'multiply'; tg.drawImage(cv, 0, 0, S0, S0); tg.globalCompositeOperation = 'source-over'; // vessels and fat block light
  const tt = new THREE.CanvasTexture(tv); tt.wrapS = tt.wrapT = THREE.RepeatWrapping;
  tex.userData.trans = tt;
  return tex;
}
function dotTex(inner, outer) {
  const S = 64, cv = mkCanvas(S), g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- surface relief ----------
const NRM = (function () {
  const fa = fbmTile(5, 2, 401), fb = fbmTile(22, 3, 402), fc = fbmTile(6, 4, 403), fd = fbmTile(3, 2, 404);
  const fe = fbmTile(40, 2, 405), cl = cellTile(9, 406), co = [0, 0], ff = fbmTile(28, 2, 407);
  const stretch = (u, v) => { // long streaks along v for ligaments and muscle
    let s = 0;
    for (let i = 0; i < 3; i++) s += fe(u * (1 + i), v * 0.06 * (1 + i) + i * 0.37) / (1 + i);
    return s;
  };
  return {
    // the wet film: shallow puddled undulation plus fine pebbling, which is what breaks a highlight into specks
    micro: normalTex(512, (u, v) => 0.8 * fa(u, v) + 0.05 * fb(u, v), 13),
    soft: normalTex(256, (u, v) => fc(u, v) + 0.5 * fd(u, v), 5),
    fat: normalTex(512, (u, v) => { cl(u, v, co); return 0.9 * Math.pow(Math.max(0, 1 - co[0] * 1.15), 0.55) * sstep(0, 0.16, co[1] - co[0]) + 0.12 * ff(u, v); }, 7),
    fiber: normalTex(512, (u, v) => stretch(u, v) + 0.25 * fc(u, v), 7)
  };
})();
// lacy web for loose areolar tissue: strands along cell borders plus a few solid lobules; used as an alpha map
const WEB = (function () {
  const N = 256, cv = mkCanvas(N), g = cv.getContext('2d'), img = g.createImageData(N, N), c1 = cellTile(6, 511), c2 = cellTile(13, 512), f = fbmTile(4, 3, 513), o = [0, 0];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N; c1(u, v, o); let a = 1 - sstep(0.05, 0.14, o[1] - o[0]);
    c2(u, v, o); a = Math.max(a, 0.8 * (1 - sstep(0.04, 0.1, o[1] - o[0])), sstep(0.56, 0.66, f(u, v)));
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = a * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
function rep(t, x, y) { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; }

const TEX = {
  uterus: tissueTex({ seed: 3, base: [214, 138, 138], dark: [180, 100, 112], pale: [234, 192, 180], paleAmt: 0.6, vessels: 34, vw: 1.5, vcol: [132, 22, 40], va: 0.48, veins: 5, caps: 44 }),
  perit: tissueTex({ seed: 8, base: [224, 164, 158], dark: [198, 128, 124], fat: [240, 206, 140], fatAmt: 0.32, fatTh: 0.6, mottle: 0.8, cells: 22, vessels: 16, vw: 1.5, vcol: [150, 40, 46], va: 0.36, veins: 5, caps: 14 }),
  leaf: tissueTex({ seed: 14, base: [238, 190, 180], dark: [214, 150, 144], fat: [240, 206, 138], fatAmt: 0.5, fatTh: 0.6, cells: 20, vessels: 26, vw: 1.2, vcol: [140, 24, 36], va: 0.55, caps: 36, trans: 0.85 }),
  bladder: tissueTex({ seed: 21, base: [220, 146, 122], dark: [190, 106, 96], fat: [234, 194, 122], fatAmt: 0.58, fatTh: 0.52, cells: 22, vessels: 38, vw: 1.5, vcol: [144, 26, 34], va: 0.5, veins: 6, caps: 48 }),
  bowel: tissueTex({ seed: 29, base: [222, 158, 142], dark: [190, 116, 108], vessels: 30, vw: 1.1, vcol: [146, 34, 44], va: 0.45, veins: 5, caps: 40, stripe: true }),
  ovary: tissueTex({ seed: 35, base: [238, 222, 210], dark: [214, 184, 174], vessels: 9, vw: 0.9, vcol: [172, 70, 80], va: 0.35, caps: 12 }),
  fat: tissueTex({ seed: 41, base: [244, 206, 118], dark: [224, 170, 86], cells: 14, vessels: 14, vw: 1.0, vcol: [164, 36, 36], va: 0.5, caps: 16, mottle: 0.9 }),
  card: tissueTex({ seed: 47, base: [234, 188, 160], dark: [206, 144, 128], fat: [240, 208, 138], fatAmt: 0.4, cells: 18, vessels: 24, vw: 1.3, vcol: [144, 26, 36], va: 0.55, veins: 6, caps: 24, trans: 0.55 }),
  cord: tissueTex({ seed: 61, base: [255, 250, 246], dark: [232, 214, 210], mottle: 0.7, streak: 0.07, vessels: 8, vw: 0.9, vcol: [150, 40, 50], va: 0.3, caps: 8 }),
  vag: tissueTex({ seed: 53, base: [228, 152, 148], dark: [198, 114, 118], vessels: 16, vw: 1.0, vcol: [142, 30, 44], va: 0.4, caps: 24 })
};

// ---------- materials ----------
// Two additions to the stock surface shader.
// 1. Sealed and charred tissue is dry: a per-vertex `dry` value takes the wet film off and roughens the surface.
// 2. Rounded organs (uterus, bladder, ovary, pelvic wall) are textured by position instead of by wrapped coordinates,
//    blending three flat projections. Wrapping a texture round an organ pinches it into a star at the poles.
const TRI_PARS = `
uniform vec3 triK; uniform mat3 normalMatrix; varying vec3 vOP; varying vec3 vON;
vec3 triTap( sampler2D t, vec2 p, float k, vec2 sc, float k2, vec2 sc2 ) {
	vec3 a = texture2D( t, p * k ).xyz * 2.0 - 1.0; a.xy *= sc;
	if ( k2 > 0.0 ) { vec3 b = texture2D( t, p * k2 + 0.5 ).xyz * 2.0 - 1.0; a.xy += b.xy * sc2; }
	return a;
}
// k2, sc2: an optional second, broader layer of the same relief
vec3 triNormal( sampler2D t, float k, vec2 sc, float k2, vec2 sc2, vec3 on, vec3 tw ) {
	vec3 a = triTap( t, vOP.zy, k, sc, k2, sc2 ), b = triTap( t, vOP.xz + 0.37, k, sc, k2, sc2 ), c = triTap( t, vOP.xy + 0.71, k, sc, k2, sc2 );
	a = vec3( a.xy + on.zy, abs( a.z ) * on.x ); b = vec3( b.xy + on.xz, abs( b.z ) * on.y ); c = vec3( c.xy + on.xy, abs( c.z ) * on.z );
	return normalize( normalMatrix * normalize( a.zyx * tw.x + b.xzy * tw.y + c.xyz * tw.z ) );
}`;
const TRI_MAP = `
	vec3 triON = normalize( vON );
	vec3 triW = pow( abs( triON ), vec3( 4.0 ) ); triW /= triW.x + triW.y + triW.z;
	diffuseColor *= texture2D( map, vOP.zy * triK.x ) * triW.x + texture2D( map, vOP.xz * triK.x + 0.37 ) * triW.y + texture2D( map, vOP.xy * triK.x + 0.71 ) * triW.z;`;
// 3. Tissue dents under a pressing instrument tip: vertices near the contact are pushed along the shaft and their
//    normals lean into the pit. One dent per hand: xyz = contact point, w = depth in cm (0 = none).
const DENT = { pos: { value: [new THREE.Vector4(), new THREE.Vector4()] }, dir: { value: [new V3(0, 0, -1), new V3(0, 0, -1)] } };
const DENT_PARS = `
#define DENT_R2 0.9
uniform vec4 dent[ 2 ]; uniform vec3 dentDir[ 2 ];
void dentApply( vec3 p, inout vec3 off, inout vec3 nrm ) {
	vec3 wp = ( modelMatrix * vec4( p, 1.0 ) ).xyz; mat3 m = mat3( modelMatrix );
	for ( int i = 0; i < 2; i ++ ) {
		float dep = dent[ i ].w;
		if ( dep > 0.0 ) {
			vec3 dv = wp - dent[ i ].xyz; float g = exp( - dot( dv, dv ) / DENT_R2 );
			off += ( dentDir[ i ] * ( dep * g ) ) * m;
			nrm += ( dv * ( - 2.0 * dep * g / DENT_R2 ) ) * m;
		}
	}
}`;
// the shadow pass must see the same dent, or the pit would fall inside the shadow of its own undented surface
function dentDepth() {
  const d = new THREE.MeshDepthMaterial();
  d.onBeforeCompile = sh => {
    sh.uniforms.dent = DENT.pos; sh.uniforms.dentDir = DENT.dir;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + DENT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvec3 dentOff = vec3( 0.0 ), dentN = vec3( 0.0 );\n\tdentApply( position, dentOff, dentN );\n\ttransformed += dentOff;');
  };
  d.customProgramCacheKey = () => 'dent-depth';
  return d;
}
function tissueHook(tri) {
  return sh => {
    sh.uniforms.dent = DENT.pos; sh.uniforms.dentDir = DENT.dir;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float dry;\nvarying float vDry;' + DENT_PARS + (tri ? '\nvarying vec3 vOP;\nvarying vec3 vON;' : ''))
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tvec3 dentOff = vec3( 0.0 );\n\tdentApply( position, dentOff, objectNormal );')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += dentOff;\n\tvDry = dry;' + (tri ? '\n\tvOP = position; vON = normal;' : ''));
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDry;' + (tri ? TRI_PARS : ''))
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n\tmaterial.roughness = mix( material.roughness, 0.93, vDry );\n\t#ifdef USE_CLEARCOAT\n\t\tmaterial.clearcoat *= 1.0 - vDry;\n\t#endif');
    if (tri) {
      sh.uniforms.triK = { value: new V3(tri.k, tri.n, tri.m) };
      f = f.replace('#include <map_fragment>', TRI_MAP)
        .replace('#include <normal_fragment_maps>', '\tnormal = triNormal( normalMap, triK.y, normalScale, 0.0, vec2( 0.0 ), triON, triW );')
        .replace('#include <clearcoat_normal_fragment_maps>', '\tclearcoatNormal = triNormal( clearcoatNormalMap, triK.z, clearcoatNormalScale, triK.z * 0.21, clearcoatNormalScale * 1.7, triON, triW );');
    }
    sh.fragmentShader = f;
  };
}
// Moist tissue: a fairly matte body under a thin, almost mirror-smooth film of fluid. `mr` is how many times the
// film's relief repeats across the mesh's texture square (about one repeat per centimetre).
function wet(o) {
  const mr = o.mr || [4, 4], ms = o.ms == null ? 1 : o.ms, base = o.relief || NRM.soft, bs = o.bs == null ? 0.7 : o.bs, br = o.br || [1, 1];
  const p = Object.assign({
    color: 0xffffff, roughness: 0.6, metalness: 0, vertexColors: true, specularIntensity: 0.5,
    clearcoat: 1, clearcoatRoughness: 0.17, clearcoatNormalMap: rep(NRM.micro, mr[0], mr[1]), clearcoatNormalScale: new V2(ms, ms),
    normalMap: rep(base, br[0], br[1]), normalScale: new V2(bs, bs)
  }, o);
  delete p.mr; delete p.ms; delete p.relief; delete p.bs; delete p.br; delete p.tri;
  const m = new THREE.MeshPhysicalMaterial(p);
  m.onBeforeCompile = tissueHook(o.tri); m.customProgramCacheKey = () => (o.tri ? 'tissue-tri' : 'tissue');
  m.userData.depth = dentDepth();
  return m;
}
const MAT = {
  uterus: wet({ map: TEX.uterus, tri: { k: 0.2, n: 0.3, m: 1 }, bs: 0.6 }),
  perit: wet({ map: TEX.perit, tri: { k: 0.15, n: 0.3, m: 1 }, bs: 0.8 }),
  leaf: wet({ map: TEX.leaf, side: THREE.DoubleSide, mr: [4, 4], bs: 0.4, roughness: 0.5, transmission: 0.45, transmissionMap: TEX.leaf.userData.trans, thickness: 0, ior: 1.4 }),
  bladder: wet({ map: TEX.bladder, tri: { k: 0.16, n: 0.45, m: 1 }, relief: NRM.fat, bs: 0.5 }),
  bowel: wet({ map: TEX.bowel, mr: [8, 5], br: [2, 2], bs: 0.8 }),
  ovary: wet({ map: TEX.ovary, tri: { k: 0.35, n: 0.8, m: 1 }, bs: 1.1, clearcoatRoughness: 0.22 }),
  fat: wet({ map: TEX.fat, side: THREE.DoubleSide, mr: [4, 3], relief: NRM.fat, br: [2.5, 2], bs: 1.2, roughness: 0.55 }),
  card: wet({ map: TEX.card, side: THREE.DoubleSide, mr: [4, 3], relief: NRM.fiber, br: [1, 1], bs: 0.8, transmission: 0.35, transmissionMap: TEX.card.userData.trans, thickness: 0, ior: 1.4 }),
  vag: wet({ map: TEX.vag, side: THREE.DoubleSide, mr: [4, 6], bs: 0.6 }),
  areolar: wet({ map: TEX.card, side: THREE.DoubleSide, mr: [4, 3], relief: NRM.fiber, bs: 0.8, alphaMap: rep(WEB, 2, 1.6), alphaTest: 0.45, alphaToCoverage: true, color: 0xfff2d8 }),
  cord: wet({ map: TEX.cord, mr: [1.2, 1.8], relief: NRM.fiber, br: [1, 0.6], bs: 0.7 }),
  blood: new THREE.MeshPhysicalMaterial({ color: 0x5e080c, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.95, clearcoatNormalMap: rep(NRM.micro, 5, 5), clearcoatNormalScale: new V2(0.9, 0.9), normalMap: rep(NRM.micro, 2, 2), normalScale: new V2(0.5, 0.5) }),
  bloodWet: new THREE.MeshPhysicalMaterial({ color: 0x6e0a10, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.14 })
};
const TRANSLUCENT = [[MAT.leaf, 0.45], [MAT.card, 0.35]];
function matQuality(q) {
  for (const [m, t] of TRANSLUCENT) { const v = q.trans ? t : 0; if ((m.transmission > 0) !== (v > 0)) m.needsUpdate = true; m.transmission = v; }
}
