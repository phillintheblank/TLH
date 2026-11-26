// Syntax-check the inline script of each built page, and check that every element the review page's script and the
// lab page's script look up by id is in their page.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
let bad = false;
for (const [name, rel] of [['docs', '../docs/index.html'], ['review', '../dist/laparoscape/index.html'], ['lab', '../docs/lab/index.html']]) {
  const html = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const tag = '<script type="module">', a = html.lastIndexOf(tag) + tag.length, b = html.lastIndexOf('</script>'), js = html.slice(a, b);
  fs.writeFileSync('/tmp/tlh-app-' + name + '.mjs', js);
  try { execFileSync('node', ['--check', '/tmp/tlh-app-' + name + '.mjs'], { stdio: 'pipe' }); console.log(name + ': syntax ok'); }
  catch (e) { console.log(name + ': ' + String(e.stderr).split('\n').slice(0, 8).join('\n')); bad = true; }
  if (name === 'docs') continue; // the review site and the lab leave parts of the page out: is anything their script looks up missing?
  const ids = new Set([...html.slice(0, a).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const made = new Set([...js.matchAll(/\.id = '([\w-]+)'/g)].map(m => m[1])); // elements the script makes itself
  const miss = [...new Set([...js.replace(/if \(!SITE\) [^;]*;/g, '').matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]))].filter(id => !ids.has(id) && !made.has(id)); // leaving out what the script does only on the working site
  if (miss.length) { console.log(name + ': no element with id ' + miss.join(', ')); bad = true; } else console.log(name + ': every id the script uses is in the page');
  if (/mediapipe|getUserMedia|hand_landmarker/.test(html)) { console.log(name + ': hand-control code is in the page'); bad = true; }
}
// The lab was added beside Build 1.0 without changing it. Until the simulator or the review site is next changed on
// purpose, their pages must come out of the build exactly as they were: the simulator's as it is frozen in docs/v1.0/
// (which differs only in where it looks for the hand-tracking files), the review site's by its checksum (Review 1.0,
// as published at laparoscape.com). When either is changed on purpose, freeze it first and update this.
const REVIEW_SHA = '9e4aeee5960dfeb2f601af89676efb3dcabc6891b67da8f36658f02c1e9c8002';
const rd = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const same = rd('../docs/index.html').replace("lib: './vendor/mediapipe/vision_bundle.mjs', wasm: './vendor/mediapipe/wasm', model: './models/hand_landmarker.task'", "lib: '../vendor/mediapipe/vision_bundle.mjs', wasm: '../vendor/mediapipe/wasm', model: '../models/hand_landmarker.task'") === rd('../docs/v1.0/index.html');
console.log(same ? 'docs: the simulator\'s page is Build 1.0 as frozen' : 'docs: the simulator\'s page differs from Build 1.0 as frozen in docs/v1.0/'); if (!same) bad = true;
const sha = createHash('sha256').update(fs.readFileSync(new URL('../dist/laparoscape/index.html', import.meta.url))).digest('hex');
console.log(sha === REVIEW_SHA ? 'review: the page is Review 1.0 as published' : 'review: the page differs from Review 1.0 as published (' + sha + ')'); if (sha !== REVIEW_SHA) bad = true;
if (bad) process.exit(1);
