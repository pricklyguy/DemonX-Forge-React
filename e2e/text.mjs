// Real-browser check of the Text tool: place text, an installed font by name, a font that does not exist (refused, the box stays open), and a path (refused).
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/text.mjs
import { chromium } from 'playwright';
import { pick } from './menu.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 500) => p.waitForTimeout(ms);
const sketch = async () => (await p.evaluate(async () => (await fetch('/api/state')).json())).sketches.at(-1);
const at = (q) => p.evaluate((q) => window.__forge.sketchToScreen(q), q);
const click = async (q) => { const [x, y] = await at(q); await p.mouse.move(x, y); await p.mouse.click(x, y); await settle(250); };
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const until = async (f, n = 30) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };

await p.goto(URL);
await p.getByTestId('demo').waitFor({ timeout: 30000 });
await p.getByTestId('btn-sketch').click(); await settle();
const [px, py] = await proj([40, -40, 0]); await p.mouse.move(px, py); await p.mouse.click(px, py);
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
await p.mouse.wheel(0, 300); await settle(400);

await pick(p, 'tool-text'); await click([0, 0]);
check(await p.getByTestId('text-dialog').isVisible(), 'the Text tool opens its box where you click');
check(await p.evaluate(() => getComputedStyle(document.querySelector('.stage canvas')).cursor) === 'text', 'the pointer is a text cursor while the tool is chosen');
const c0 = (await sketch()).curves.length;
await p.getByLabel('Text', { exact: true }).fill('Hi'); await p.getByLabel('Text height').fill('10');
check(await until(async () => (await sketch()).curves.length > c0 + 8), 'the letters show in the sketch while the box is still open (preview)', String((await sketch()).curves.length - c0));
await p.getByRole('button', { name: 'Cancel' }).click(); await settle(1200);
check((await sketch()).curves.length === c0, 'Cancel takes the preview back');
await click([0, 0]); await p.getByLabel('Text', { exact: true }).fill('Hi'); await p.getByLabel('Text height').fill('10'); await settle(1500);
await p.getByTestId('text-ok').click();
check(await until(async () => (await sketch()).profiles.length >= 1 && (await sketch()).curves.length > 8), 'OK turns the text into sketch shapes you can extrude', `${(await sketch()).curves.length} curves, ${(await sketch()).profiles.length} profiles`);
check(!(await p.getByTestId('text-dialog').isVisible().catch(() => false)), 'and the box closes');
const shown = await p.evaluate(() => [...document.querySelectorAll('.dimlabel.measured')].filter((e) => getComputedStyle(e).display !== 'none').length);
check(shown < 6, 'the tiny lengths along the letters do not each get a label', String(shown));

const before = (await sketch()).curves.length;
await pick(p, 'tool-text'); await click([0, 30]);
await p.getByLabel('Text', { exact: true }).fill('No'); await p.getByLabel('Font', { exact: true }).fill('NoSuchFontXyz'); await p.getByTestId('text-ok').click(); await settle(1200);
check(/unknown font/i.test(await p.getByTestId('error').innerText().catch(() => '')) && await p.getByTestId('text-dialog').isVisible(), 'a font that is not installed is refused and the box stays open to fix it', await p.getByTestId('error').innerText().catch(() => ''));
await p.getByLabel('Font', { exact: true }).fill('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'); await p.getByTestId('text-ok').click(); await settle(800);
check(/installed font/i.test(await p.getByTestId('error').innerText().catch(() => '')) && (await sketch()).curves.length === before, 'a font file path is refused');
await p.getByLabel('Font', { exact: true }).fill('DejaVu Sans'); await p.getByLabel('Bold').check(); await p.getByTestId('text-ok').click(); await settle(1500);
const withFont = (await sketch()).curves.length > before;
const err = await p.getByTestId('error').innerText().catch(() => '');
check(withFont || /unknown font/i.test(err), 'an installed font is used by name (or reported missing on a computer without it)', withFont ? 'used' : err);
console.log(failed ? `== text: ${failed} FAILED` : '== text: all passed');
await b.close(); process.exit(failed ? 1 : 0);
