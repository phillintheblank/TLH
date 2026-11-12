// Serve docs/ on localhost, load it in headless Chrome (with a fake camera), run an optional script, screenshot.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = 'http://127.0.0.1:' + server.address().port + '/';
const out = process.argv[2] || path.join(root, '../test/out/shot.png');
const script = process.argv[3] || '';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, permissions: ['camera'] });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|WebGL-|GroupMarkerNotSet/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
// Software rendering is slow, so the page's own frame loop stays paused unless LIVE=1; scripts drive tick() and render().
if (!process.env.LIVE) await page.addInitScript(() => { window.__simPause = true; });
await page.goto(url + (process.env.PAGE || '') + (process.env.QUERY ? '?' + process.env.QUERY : ''));
await page.waitForTimeout(1500);
let code = 0;
try { if (script) { const fn = (await import(path.resolve(script))).default; await fn(page); } }
catch (e) { console.log('SCRIPT ERROR: ' + (e.stack || e.message)); code = 1; }
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(errs.length ? 'CONSOLE:\n' + errs.slice(0, 12).join('\n') : 'no console errors');
await browser.close(); server.close(); process.exit(code);
