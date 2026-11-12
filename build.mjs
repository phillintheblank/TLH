// Builds the site into docs/ (served by GitHub Pages): one HTML page with the simulator script inlined,
// plus the vendored 3D library, hand-tracking runtime and hand model.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(root, 'src/js'), out = path.join(root, 'docs');
const js = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const html = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8').replace('/*__JS__*/', () => js);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
const copy = (from, to) => { if (!fs.existsSync(from)) return false; fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); return true; };
const nm = path.join(root, 'node_modules'), mp = path.join(nm, '@mediapipe/tasks-vision');
// three.js ships as two unminified ES modules; bundle and minify them into one file
try {
  const esbuild = await import('esbuild');
  await esbuild.build({ entryPoints: [path.join(nm, 'three/build/three.module.js')], bundle: true, format: 'esm', minify: true, legalComments: 'inline', outfile: path.join(out, 'vendor/three.module.min.js'), logLevel: 'warning' });
} catch (e) { console.log('three.js bundle failed: ' + e.message); }
fs.rmSync(path.join(out, 'vendor/three.min.js'), { force: true });
copy(path.join(mp, 'vision_bundle.mjs'), path.join(out, 'vendor/mediapipe/vision_bundle.mjs'));
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) copy(path.join(mp, 'wasm', f), path.join(out, 'vendor/mediapipe/wasm', f));
copy(path.join(root, 'models/hand_landmarker.task'), path.join(out, 'models/hand_landmarker.task'));
const need = ['vendor/three.module.min.js', 'vendor/mediapipe/vision_bundle.mjs', 'vendor/mediapipe/wasm/vision_wasm_internal.wasm', 'models/hand_landmarker.task'].filter(f => !fs.existsSync(path.join(out, f)));
console.log('built docs/index.html', (html.length / 1024).toFixed(1) + ' KiB' + (need.length ? '  MISSING: ' + need.join(', ') : ''));
