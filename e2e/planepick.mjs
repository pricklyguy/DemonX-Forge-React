// Real-browser check of choosing a sketch plane: a flat face of the part wins over the origin plane sheets in front of it, and the sheets can be turned off in Preferences.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/planepick.mjs
import { chromium } from 'playwright';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 600) => p.waitForTimeout(ms);
const state = () => p.evaluate(async () => (await fetch('/api/state')).json());
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);

await p.goto(URL);
await p.getByTestId('demo').waitFor({ timeout: 30000 });
await p.evaluate(async () => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps: [{ command: 'solid.box', params: { length: 60, width: 40, height: 20, corner: [0, 0, 0], operation: 'new', body_name: 'Block' } }] }) }); });
await p.getByTestId('node-body-Block').waitFor({ timeout: 20000 });
await p.getByText(/changed by another program/).waitFor({ timeout: 20000 }); await settle(2500);

// the home view looks from the front-right and above: the XZ sheet (the plane y = 0) lies in front of the top face
await p.getByTestId('btn-sketch').click(); await p.getByTestId('plane-picker').waitFor(); await settle(600);
const [fx, fy] = await proj([30, 25, 20]); await p.mouse.move(fx, fy); await p.mouse.click(fx, fy);
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
let pl = (await state()).sketches.at(-1).plane;
check(Math.abs(pl.origin[2] - 20) < 1e-6 && Math.abs(pl.yDir[1] - 1) < 1e-6, 'clicking the top face picks the face although a plane sheet is in front of it', JSON.stringify(pl));
await p.getByTestId('btn-finish').click(); await settle(900);

// with the sheets off, none are drawn until the pointer is on a plane's button
await p.getByTestId('file-menu').click(); await p.getByText('Preferences…').click();
await p.getByTestId('pref-plane-sheets').uncheck(); await p.keyboard.press('Escape'); await settle(300);
await p.getByTestId('btn-sketch').click(); await p.getByTestId('plane-picker').waitFor(); await settle(600);
const sheets = () => p.evaluate(() => document.querySelectorAll('.planelabel').length);
check((await sheets()) === 0, 'the preference turns the sheets off while choosing');
await p.getByTestId('pick-plane-XZ').hover(); await settle(400);
check((await sheets()) === 1, 'the plane shows while the pointer is on its button', String(await sheets()));
await p.getByTestId('pick-plane-XZ').click(); await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
pl = (await state()).sketches.at(-1).plane;
check(Math.abs(pl.origin[1]) < 1e-6 && Math.abs(Math.abs(pl.yDir[2]) - 1) < 1e-6, 'and the button still picks it (the XZ plane)', JSON.stringify(pl));
console.log(failed ? `== planepick: ${failed} FAILED` : '== planepick: all passed');
await b.close(); process.exit(failed ? 1 : 0);
