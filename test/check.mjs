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
// The simulator, the review site and the lab are built from shared files, and work on one must be seen to leave the
// others alone. Until the simulator or the review site is next changed on purpose, their pages must come out of the
// build exactly as they did at Build 1.1, by their checksums. When either is changed on purpose, freeze it first and
// update this.
// Build 1.1 changed shared files, so the review site's page as built is no longer Review 1.0 as published at
// laparoscape.com (that page's checksum was 9e4aeee5960dfeb2f601af89676efb3dcabc6891b67da8f36658f02c1e9c8002). The
// site itself has not been changed: it carries Review 1.0 until the next review round is published.
const SIM_SHA = '68f457ce96d6da0380150931f0e3518b634d6ea85bbc5fe8b18330bf543c7aab', REVIEW_SHA = '56f80b0a7663c0590257186c666b978fefd6b078f23c4a14563f22f8f0b476de';
const rd = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8'), sum = rel => createHash('sha256').update(fs.readFileSync(new URL(rel, import.meta.url))).digest('hex');
const sim = sum('../docs/index.html');
console.log(sim === SIM_SHA ? 'docs: the simulator\'s page is Build 1.1 as published' : 'docs: the simulator\'s page differs from Build 1.1 as published (' + sim + ')'); if (sim !== SIM_SHA) bad = true;
const sha = sum('../dist/laparoscape/index.html');
console.log(sha === REVIEW_SHA ? 'review: the page is as it was built at Build 1.1' : 'review: the page differs from the one built at Build 1.1 (' + sha + ')'); if (sha !== REVIEW_SHA) bad = true;
// Build 1.0 stays as it was frozen, under docs/v1.0/.
const V10_SHA = '0df4e8902cccd2669f4ef33e3bdffca31ac9768d3ab127a2ab00d395858983a6', v10 = sum('../docs/v1.0/index.html');
console.log(v10 === V10_SHA ? 'docs: Build 1.0 is kept as frozen in docs/v1.0/' : 'docs: docs/v1.0/ differs from Build 1.0 as frozen'); if (v10 !== V10_SHA) bad = true;
// The lab's earlier builds stay as they were published, under docs/lab/: each page differs only in where it looks for the shared 3D library.
const LAB01_SHA = '60cefca48cb615c55fb530ec1aaf7e277313bc69e5ea02576db1f22227b676d6';
const l01 = createHash('sha256').update(rd('../docs/lab/v0.1/index.html').replace("'../../vendor/three.module.min.js'", "'../vendor/three.module.min.js'")).digest('hex');
console.log(l01 === LAB01_SHA ? 'lab: Lab 0.1 is kept as published in docs/lab/v0.1/' : 'lab: docs/lab/v0.1/ differs from Lab 0.1 as published'); if (l01 !== LAB01_SHA) bad = true;
const LAB02_SHA = '2ac8ab443d018b98cc083636e9adb95c173761024cf3269ea5a6a8bfc32ab2df';
const l02 = createHash('sha256').update(rd('../docs/lab/v0.2/index.html').replace("'../../vendor/three.module.min.js'", "'../vendor/three.module.min.js'")).digest('hex');
console.log(l02 === LAB02_SHA ? 'lab: Lab 0.2 is kept as published in docs/lab/v0.2/' : 'lab: docs/lab/v0.2/ differs from Lab 0.2 as published'); if (l02 !== LAB02_SHA) bad = true;
if (bad) process.exit(1);
