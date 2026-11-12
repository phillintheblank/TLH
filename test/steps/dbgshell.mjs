// probe: what makes up the cavity shell, and where can a tip go that hides it?
export default async function (page) {
  await page.click('#btnBegin');
  const out = await page.evaluate(() => {
    window.__simPause = true; const s = window.__sim, T = s.THREE, rows = []; s.DEPTH.auto = false; s.INP.noLock = true; for (let i = 0; i < 10; i++) s.tick(0.033);
    const by = {};
    for (const m of s.PICKS) { const e = m.userData.ent + (m.userData.side || ''); const b = new T.Box3().setFromObject(m); const o = by[e] || (by[e] = { n: 0, b: new T.Box3(), side: m.material.side, shown: s.shown(m) }); o.n++; o.b.union(b); }
    for (const e in by) { const b = by[e].b, f = v => v.toArray().map(x => x.toFixed(1)).join(','); rows.push(e.padEnd(10) + ' n' + by[e].n + ' side' + by[e].side + (by[e].shown ? '' : ' hidden') + '  min ' + f(b.min) + '  max ' + f(b.max)); }
    // scene objects not in PICKS that might be the shell
    const others = {}; s.scene.traverse(o => { if (o.isMesh && !s.PICKS.includes(o) && o.visible) { const k = o.name || (o.userData && o.userData.ent) || o.geometry.type; others[k] = (others[k] || 0) + 1; } });
    rows.push('non-pick meshes: ' + JSON.stringify(others));
    rows.push('cam ' + s.camera.position.toArray().map(x => x.toFixed(1)) + ' fov ' + s.camera.fov + ' near ' + s.camera.near);
    return rows;
  });
  console.log(out.join('\n'));
}
