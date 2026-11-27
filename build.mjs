// Builds two sites and a lab page from the same source.
//   docs/              the working simulator, served by GitHub Pages from this repository: every case, mouse and
//                      hand control, with the vendored 3D library, hand-tracking runtime and hand model
//   dist/laparoscape/  the review site (laparoscape.com): the hysterectomy alone, mouse only. Its files are copied
//                      into the laparoscape/laparoscape.github.io repository to publish a review round.
//   docs/lab/          the physics lab: a free-play dissection on the same pelvis, mouse only. It is part of the working
//                      site and shares its copy of the 3D library.
// One page each, with the simulator script inlined. In src/template.html, <!--@main-->...<!--@/main--> is kept only in
// the first, <!--@review-->...<!--@/review--> only in the second and <!--@lab-->...<!--@/lab--> only in the lab's.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(root, 'src/js'), out = path.join(root, 'docs'), rdir = path.join(root, 'src/review'), rout = path.join(root, 'dist/laparoscape');
const LAB = { name: 'MIGS Simulator', label: 'Lab 0.2' };
const REVIEW = {
  name: 'laparoscape', label: 'Review 1.0', email: 'feedback@laparoscape.com', by: 'Phillip Connell, MD', domain: 'laparoscape.com',
  asks: [ // what the reviewers are asked: on the welcome sheet, on the debrief, and at the head of the results they copy
    'Is the anatomy realistic enough to teach from?',
    'Is the order of steps how you would teach it?',
    'Do the instruments behave the way you expect?',
    'Are the teaching notes and pearls accurate?',
    'Were the controls easy to learn?',
    'Manual depth, where the wheel slides the instrument in and out, or Auto depth, where the tip follows the tissue: which would you want for your learners?',
    'What else would you change or add, and what options would you want, before sharing it with your learners?'
  ]
};
const LEFT_OUT = /^(06[b-f]-|08-hands\.js$)/; // the review site's page has no other cases and no hand control
const read = f => fs.readFileSync(f, 'utf8'), list = d => fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => path.join(d, f));
const join = files => files.sort((a, b) => path.basename(a).localeCompare(path.basename(b))).map(read).join('\n');
const template = read(path.join(root, 'src/template.html'));
const SITES = ['main', 'review', 'lab'];
const only = (html, keep) => SITES.reduce((h, v) => (v === keep ? h.replace(new RegExp('<!--@/?' + v + '-->', 'g'), '') : h.replace(new RegExp('<!--@' + v + '-->[\\s\\S]*?<!--@/' + v + '-->', 'g'), '')), html);
const page = (html, site, js) => html.replace('/*__JS__*/', () => 'const SITE = ' + JSON.stringify(site) + ';\n' + js);
const copy = (from, to) => { if (!fs.existsSync(from)) return false; fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); return true; };

// ---- the working simulator ----
const html = page(only(template, 'main'), null, join(list(dir)));
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
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

// ---- the review site ----
const fill = s => s.replaceAll('__ASKS__', REVIEW.asks.map(q => '<li>' + q + '</li>').join('')).replaceAll('__NAME__', REVIEW.name).replaceAll('__LABELQ__', encodeURIComponent(REVIEW.label)).replaceAll('__LABEL__', REVIEW.label).replaceAll('__EMAIL__', REVIEW.email).replaceAll('__BY__', REVIEW.by).replaceAll('__DOMAIN__', REVIEW.domain);
const rhtml = page(fill(only(template, 'review')), { name: REVIEW.name, label: REVIEW.label, asks: REVIEW.asks }, join(list(dir).filter(f => !LEFT_OUT.test(path.basename(f))).concat(list(rdir))));
fs.rmSync(rout, { recursive: true, force: true }); fs.mkdirSync(rout, { recursive: true });
fs.writeFileSync(path.join(rout, 'index.html'), rhtml);
fs.writeFileSync(path.join(rout, '.nojekyll'), '');
fs.writeFileSync(path.join(rout, 'CNAME'), REVIEW.domain + '\n');
fs.writeFileSync(path.join(rout, 'README.md'), fill(read(path.join(rdir, 'README.md'))));
const three = copy(path.join(out, 'vendor/three.module.min.js'), path.join(rout, 'vendor/three.module.min.js'));
console.log('built dist/laparoscape/index.html', (rhtml.length / 1024).toFixed(1) + ' KiB' + (three ? '' : '  MISSING: vendor/three.module.min.js'));

// ---- the lab ----
// The simulator's files less the other cases and hand control, as for the review site, plus the lab's own (src/lab).
const ldir = path.join(root, 'src/lab'), lout = path.join(out, 'lab');
const lhtml = page(only(template, 'lab').replaceAll('__LABEL__', LAB.label), { name: LAB.name, label: LAB.label, asks: [], lab: true }, join(list(dir).filter(f => !LEFT_OUT.test(path.basename(f))).concat(list(ldir)))).replace("'./vendor/three.module.min.js'", "'../vendor/three.module.min.js'");
fs.mkdirSync(lout, { recursive: true });
fs.writeFileSync(path.join(lout, 'index.html'), lhtml);
console.log('built docs/lab/index.html', (lhtml.length / 1024).toFixed(1) + ' KiB');
