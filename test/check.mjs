// Syntax-check the inline script of each built page, and check that every element the review page's script looks up
// by id is in the review page.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
let bad = false;
for (const [name, rel] of [['docs', '../docs/index.html'], ['review', '../dist/laparoscape/index.html']]) {
  const html = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const tag = '<script type="module">', a = html.lastIndexOf(tag) + tag.length, b = html.lastIndexOf('</script>'), js = html.slice(a, b);
  fs.writeFileSync('/tmp/tlh-app-' + name + '.mjs', js);
  try { execFileSync('node', ['--check', '/tmp/tlh-app-' + name + '.mjs'], { stdio: 'pipe' }); console.log(name + ': syntax ok'); }
  catch (e) { console.log(name + ': ' + String(e.stderr).split('\n').slice(0, 8).join('\n')); bad = true; }
  if (name !== 'review') continue;
  const ids = new Set([...html.slice(0, a).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const made = new Set([...js.matchAll(/\.id = '([\w-]+)'/g)].map(m => m[1])); // elements the script makes itself
  const miss = [...new Set([...js.replace(/if \(!SITE\) [^;]*;/g, '').matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]))].filter(id => !ids.has(id) && !made.has(id)); // leaving out what the script does only on the working site
  if (miss.length) { console.log('review: no element with id ' + miss.join(', ')); bad = true; } else console.log('review: every id the script uses is in the page');
  if (/mediapipe|getUserMedia|hand_landmarker/.test(html)) { console.log('review: hand-control code is in the page'); bad = true; }
}
if (bad) process.exit(1);
