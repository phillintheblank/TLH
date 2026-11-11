// Syntax-check the inline script of the built page.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const html = fs.readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const a = html.lastIndexOf('<script>') + 8, b = html.lastIndexOf('</script>');
fs.writeFileSync('/tmp/tlh-app.js', html.slice(a, b));
try { execFileSync('node', ['--check', '/tmp/tlh-app.js'], { stdio: 'pipe' }); console.log('syntax ok'); }
catch (e) { console.log(String(e.stderr).split('\n').slice(0, 8).join('\n')); process.exit(1); }
