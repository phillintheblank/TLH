// ---------- lab: position-based dynamics (XPBD) ----------
// Written for the lab. Particles joined by distance constraints, each with a compliance (how readily it gives) and,
// if it can part, a length at which it breaks. A particle may also be tethered to the place it rests, which is what
// brings displaced tissue back. Time goes in small steps with one pass over the constraints in each: stiffness then
// comes out the same whatever the frame rate. Nothing has weight: what lies under the peritoneum is held by what is
// round it, and tissue left alone is at rest exactly. Motion is damped heavily, as it is in wet tissue: what is let
// go of goes back to where it lay without swinging past it.
class XPBD {
  constructor(maxP, maxC) {
    this.n = 0; this.m = 0;
    this.x = new Float32Array(maxP * 3); this.o = new Float32Array(maxP * 3); this.v = new Float32Array(maxP * 3);
    this.r = new Float32Array(maxP * 3); // where each particle rests
    this.w = new Float32Array(maxP);     // inverse mass. 0: held where it is put (pinned, or in a pair of jaws)
    this.tk = new Float32Array(maxP);    // tether to the resting place: its compliance. 0: no tether. It pulls no harder past `give` cm than at it, as loose attachments do
    this.ci = new Int32Array(maxC); this.cj = new Int32Array(maxC);
    this.cl = new Float32Array(maxC);    // rest length
    this.ca = new Float32Array(maxC);    // compliance
    this.cb = new Float32Array(maxC);    // the length at which it breaks. 0: it does not break
    this.cf = new Uint8Array(maxC);      // 1: alive. 2: resists stretch only (a slack strand)
    this.broke = [];                     // what broke in the last step
    this.damp = 0.8; this.give = 0.4; this.H = 1 / 400; this.ms = 0; this.collide = null;
  }
  add(x, y, z, w, tk) {
    const i = this.n++, k = i * 3;
    this.x[k] = this.o[k] = this.r[k] = x; this.x[k + 1] = this.o[k + 1] = this.r[k + 1] = y; this.x[k + 2] = this.o[k + 2] = this.r[k + 2] = z;
    this.w[i] = w; this.tk[i] = tk || 0; return i;
  }
  dist(i, j) { const x = this.x, a = i * 3, b = j * 3; return Math.hypot(x[a] - x[b], x[a + 1] - x[b + 1], x[a + 2] - x[b + 2]); }
  // slack: how much longer than it lies it may get before it pulls. brk: how much longer than it lies before it breaks
  link(i, j, comp, stretchOnly, slack, brk) {
    const c = this.m++, d = this.dist(i, j);
    this.ci[c] = i; this.cj[c] = j; this.cl[c] = d + (slack || 0); this.ca[c] = comp; this.cb[c] = brk ? d + brk : 0; this.cf[c] = 1 | (stretchOnly ? 2 : 0);
    return c;
  }
  get(i, out) { const k = i * 3; return out.set(this.x[k], this.x[k + 1], this.x[k + 2]); }
  rest(i, out) { const k = i * 3; return out.set(this.r[k], this.r[k + 1], this.r[k + 2]); }
  put(i, p) { const k = i * 3; this.x[k] = p.x; this.x[k + 1] = p.y; this.x[k + 2] = p.z; }
  reset() { this.x.set(this.r); this.o.set(this.r); this.v.fill(0); this.broke.length = 0; }
  step(dt) {
    const t0 = performance.now(), sub = clamp(Math.round(dt / this.H), 3, 14), h = dt / sub, n = this.n, m = this.m;
    const x = this.x, o = this.o, v = this.v, r = this.r, w = this.w, tk = this.tk, ci = this.ci, cj = this.cj, cl = this.cl, ca = this.ca, cb = this.cb, cf = this.cf;
    const dk = this.damp / h, gv = this.give, gv2 = gv * gv;
    this.broke.length = 0;
    for (let s = 0; s < sub; s++) {
      for (let i = 0, k = 0; i < n; i++, k += 3) {
        if (w[i] === 0) { o[k] = x[k]; o[k + 1] = x[k + 1]; o[k + 2] = x[k + 2]; continue; }
        o[k] = x[k]; o[k + 1] = x[k + 1]; o[k + 2] = x[k + 2];
        x[k] += v[k] * h; x[k + 1] += v[k + 1] * h; x[k + 2] += v[k + 2] * h;
        const t = tk[i];
        if (t > 0) { const dx = r[k] - x[k], dy = r[k + 1] - x[k + 1], dz = r[k + 2] - x[k + 2], d2 = dx * dx + dy * dy + dz * dz, q = (d2 > gv2 ? gv / Math.sqrt(d2) : 1) / (1 + t); x[k] += dx * q; x[k + 1] += dy * q; x[k + 2] += dz * q; }
      }
      for (let c = 0; c < m; c++) {
        const f = cf[c]; if (!(f & 1)) continue;
        const i = ci[c], j = cj[c], a = i * 3, b = j * 3;
        const dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz), C = d - cl[c];
        if (C < 0 && (f & 2)) continue;
        if (cb[c] > 0 && d > cb[c]) { cf[c] &= 2; this.broke.push(c); continue; } // parted: no longer alive, but still the kind of thread it was
        const wi = w[i], wj = w[j], ws = wi + wj; if (ws === 0 || d < 1e-6) continue;
        const k = -C / ((ws + ca[c]) * d);
        x[a] += wi * k * dx; x[a + 1] += wi * k * dy; x[a + 2] += wi * k * dz;
        x[b] -= wj * k * dx; x[b + 1] -= wj * k * dy; x[b + 2] -= wj * k * dz;
      }
      if (this.collide) this.collide();
      for (let i = 0, k = 0; i < n; i++, k += 3) {
        if (w[i] === 0) { v[k] = v[k + 1] = v[k + 2] = 0; continue; }
        v[k] = (x[k] - o[k]) * dk; v[k + 1] = (x[k + 1] - o[k + 1]) * dk; v[k + 2] = (x[k + 2] - o[k + 2]) * dk;
      }
    }
    this.ms = this.ms * 0.95 + (performance.now() - t0) * 0.05;
  }
}
