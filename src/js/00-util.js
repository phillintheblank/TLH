// ---------- utilities ----------
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const V3 = THREE.Vector3;
const V = (x, y, z) => new V3(x, y, z);
const V2 = THREE.Vector2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
const $ = id => document.getElementById(id);
const lin = c => Math.pow(c / 255, 2.2);
const C = (r, g, b) => [lin(r), lin(g), lin(b)];

function prng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashI(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// periodic 2D value noise (tileable with period `per`)
function pnoise(x, y, per, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const X0 = ((x0 % per) + per) % per, X1 = (X0 + 1) % per;
  const Y0 = ((y0 % per) + per) % per, Y1 = (Y0 + 1) % per;
  const a = hashI(X0, Y0, seed), b = hashI(X1, Y0, seed), c = hashI(X0, Y1, seed), d = hashI(X1, Y1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}
function pfbm(x, y, per, oct, seed) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * pnoise(x * f, y * f, per * f, seed + i * 17); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
function hash3(ix, iy, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const n = (i, j, k) => hash3(x0 + i, y0 + j, z0 + k);
  return lerp(
    lerp(lerp(n(0, 0, 0), n(1, 0, 0), sx), lerp(n(0, 1, 0), n(1, 1, 0), sx), sy),
    lerp(lerp(n(0, 0, 1), n(1, 0, 1), sx), lerp(n(0, 1, 1), n(1, 1, 1), sx), sy), sz);
}
function fbm3(x, y, z, oct) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; }
  return s / n;
}

// ---------- geometry helpers ----------
// uniform Catmull-Rom through ctrl points, written into preallocated array `out`
function spline(ctrl, out) {
  const n = ctrl.length - 1, N = out.length;
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * n;
    const k = Math.min(Math.floor(t), n - 1), f = t - k, f2 = f * f, f3 = f2 * f;
    const p0 = ctrl[Math.max(k - 1, 0)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(k + 2, n)];
    const o = out[i];
    o.x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3);
    o.y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3);
    o.z = 0.5 * (2 * p1.z + (-p0.z + p2.z) * f + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * f3);
  }
  return out;
}
function vecArr(n) { const a = []; for (let i = 0; i < n; i++) a.push(new V3()); return a; }
function sampleArr(A, u, out) {
  const x = clamp(u, 0, 1) * (A.length - 1), i = Math.min(Math.floor(x), A.length - 2), f = x - i;
  return out.lerpVectors(A[i], A[i + 1], f);
}
function nearestOnArr(A, p) { // returns {u, d}
  let best = 1e9, bi = 0;
  for (let i = 0; i < A.length; i++) { const d = A[i].distanceToSquared(p); if (d < best) { best = d; bi = i; } }
  return { u: bi / (A.length - 1), d: Math.sqrt(best) };
}
const BIG_SPHERE = () => new THREE.Sphere(new V3(), 1e4);

class Tube {
  constructor(n, m, mat, uvU, uvV) {
    this.n = n; this.m = m; const cols = m + 1, count = n * cols;
    this.pos = new Float32Array(count * 3); this.nor = new Float32Array(count * 3); this.col = new Float32Array(count * 3).fill(1); this.dry = new Float32Array(count);
    const uv = new Float32Array(count * 2), idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < cols; j++) { uv[(i * cols + j) * 2] = (j / m) * (uvU || 1); uv[(i * cols + j) * 2 + 1] = (i / (n - 1)) * (uvV || 3); }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('dry', new THREE.BufferAttribute(this.dry, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.boundingSphere = BIG_SPHERE();
    this.geo = g; this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false;
    this.pts = vecArr(n); this.ua = 0; this.ub = 1; this.on = true;
    this._T = new V3(); this._N = new V3(); this._B = new V3(); this._c = [1, 1, 1, 0];
  }
  // A: samples for u in [0,1]; radFn(u)->radius; colFn(u, c) optional, c = [r, g, b, dry]; flatK: second-axis scale
  set(A, ua, ub, radFn, colFn, flatK) {
    this.ua = ua; this.ub = ub;
    if (!this.on || ub - ua < 0.004) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const n = this.n, m = this.m, cols = m + 1, P = this.pts, T = this._T, N = this._N, B = this._B, c = this._c;
    for (let i = 0; i < n; i++) sampleArr(A, ua + ((ub - ua) * i) / (n - 1), P[i]);
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, n - 1)];
      T.subVectors(b, a); if (T.lengthSq() < 1e-10) T.set(0, 0, 1); T.normalize();
      if (i === 0) { N.set(0, 1, 0); if (Math.abs(T.y) > 0.9) N.set(1, 0, 0); }
      N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(T, N);
      const u = ua + ((ub - ua) * i) / (n - 1), r = radFn(u), rb = r * (flatK || 1);
      c[3] = 0; if (colFn) colFn(u, c); else { c[0] = c[1] = c[2] = 1; }
      for (let j = 0; j < cols; j++) {
        const ph = (j / m) * TAU, cs = Math.cos(ph), sn = Math.sin(ph), k = (i * cols + j) * 3;
        this.pos[k] = P[i].x + N.x * cs * r + B.x * sn * rb;
        this.pos[k + 1] = P[i].y + N.y * cs * r + B.y * sn * rb;
        this.pos[k + 2] = P[i].z + N.z * cs * r + B.z * sn * rb;
        this.nor[k] = N.x * cs + B.x * sn; this.nor[k + 1] = N.y * cs + B.y * sn; this.nor[k + 2] = N.z * cs + B.z * sn;
        this.col[k] = c[0]; this.col[k + 1] = c[1]; this.col[k + 2] = c[2]; this.dry[k / 3] = c[3];
      }
    }
    const at = this.geo.attributes; at.position.needsUpdate = true; at.normal.needsUpdate = true; at.color.needsUpdate = true; at.dry.needsUpdate = true;
  }
  uAt(vi) { return this.ua + ((this.ub - this.ua) * Math.floor(vi / (this.m + 1))) / (this.n - 1); }
}

class Strip {
  constructor(ns, nt, mat, uvS, uvT) {
    this.ns = ns; this.nt = nt; const count = ns * nt;
    this.pos = new Float32Array(count * 3); this.col = new Float32Array(count * 3).fill(1); this.dry = new Float32Array(count);
    const uv = new Float32Array(count * 2), idx = [];
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) { uv[(j * ns + i) * 2] = (i / (ns - 1)) * (uvS || 1); uv[(j * ns + i) * 2 + 1] = (j / (nt - 1)) * (uvT || 1); }
    for (let j = 0; j < nt - 1; j++) for (let i = 0; i < ns - 1; i++) { const a = j * ns + i, b = a + 1, c = a + ns, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('dry', new THREE.BufferAttribute(this.dry, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.boundingSphere = BIG_SPHERE();
    this.geo = g; this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false;
    this._p = new V3(); this._c = [1, 1, 1, 0]; this.map = null; // map(s,t)->[u,v] for picking
  }
  update(fn) {
    const { ns, nt, pos, col, dry, _p: p, _c: c } = this;
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
      c[0] = c[1] = c[2] = 1; c[3] = 0;
      fn(i / (ns - 1), j / (nt - 1), p, c);
      const k = (j * ns + i) * 3;
      pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z; col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2]; dry[j * ns + i] = c[3];
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; this.geo.attributes.dry.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  stAt(vi) { return [(vi % this.ns) / (this.ns - 1), Math.floor(vi / this.ns) / (this.nt - 1)]; }
}

// static parametric surface; normal = dP/du x dP/dv
function paramSurface(nu, nv, fn, o) {
  o = o || {};
  const cols = nu + 1, rows = nv + 1, count = cols * rows;
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3).fill(1), uv = new Float32Array(count * 2), idx = [];
  const p = new V3(), c = [1, 1, 1];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u = i / nu, v = j / nv, k = j * cols + i;
    c[0] = c[1] = c[2] = 1;
    fn(u, v, p, c);
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    uv[k * 2] = u * (o.su || 1); uv[k * 2 + 1] = v * (o.sv || 1);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * cols + i, b = a + 1, cc = a + cols, d = cc + 1;
    if (o.flip) idx.push(a, cc, b, b, cc, d); else idx.push(a, b, cc, b, d, cc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (o.closedU) {
    const nr = g.attributes.normal.array;
    for (let j = 0; j < rows; j++) {
      const a = (j * cols) * 3, b = (j * cols + nu) * 3;
      const x = nr[a] + nr[b], y = nr[a + 1] + nr[b + 1], z = nr[a + 2] + nr[b + 2], l = Math.hypot(x, y, z) || 1;
      nr[a] = nr[b] = x / l; nr[a + 1] = nr[b + 1] = y / l; nr[a + 2] = nr[b + 2] = z / l;
    }
  }
  g.computeBoundingSphere();
  return g;
}
