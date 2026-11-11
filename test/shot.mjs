// Load the built page in headless Chrome, report console errors, take a screenshot.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const three = fs.readFileSync('/home/claude/sim/node_modules/three/build/three.min.js', 'utf8');
const out = process.argv[2] || '/home/claude/sim/test/out/shot.png';
const script = process.argv[3] || '';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.route('**/three.min.js', r => r.fulfill({ contentType: 'application/javascript', body: three }));
await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
await page.goto('file:///home/claude/sim/dist/index.html');
await page.waitForTimeout(1500);
if (script) { const fn = (await import(script)).default; await fn(page); }
fs.mkdirSync('/home/claude/sim/test/out', { recursive: true });
await page.screenshot({ path: out });
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'no console errors');
await browser.close();
