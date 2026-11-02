// Real-browser check of two model-view behaviours: a left drag over empty space selects bodies (left to right: bodies wholly inside; right to left: bodies touched), and Move previews in the view without asking the engine until OK.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/bodybox.mjs
import { chromium } from 'playwright';
import { ready } from './wait.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 400) => p.waitForTimeout(ms);
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const selected = async () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="node-"][aria-selected="true"]')].map((n) => n.getAttribute('data-testid')));
const bodyNodes = async () => p.evaluate(() => [...document.querySelectorAll('[data-testid^="node-"]')].map((n) => n.getAttribute('data-testid')).filter((t) => /Body/.test(t)));

await p.goto(URL); await ready(p);
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await p.evaluate(async () => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps: [{ command: 'solid.box', params: { length: 40, width: 30, height: 10, corner: [0, 0, 0], body_name: 'A' } }, { command: 'solid.box', params: { length: 20, width: 20, height: 10, corner: [100, 0, 0], operation: 'new', body_name: 'B' } }] }) }); });
await p.reload(); await ready(p); await settle(1500);
const drag = async (a, c) => { await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(c[0], c[1], { steps: 8 }); await p.mouse.up(); await settle(500); };

// a window round B only (left to right) takes B
const lo = await proj([95, -5, -5]), hi = await proj([125, 25, 15]);
const x0 = Math.min(lo[0], hi[0]) - 25, x1 = Math.max(lo[0], hi[0]) + 25, y0 = Math.min(lo[1], hi[1]) - 40, y1 = Math.max(lo[1], hi[1]) + 40;
await drag([x0, y0], [x1, y1]);
let sel = await selected();
check(sel.length === 1 && /B/.test(sel[0]), 'a window drag round B selects B only', JSON.stringify(sel));
// a drag that takes nothing leaves the selection alone
await drag([20, 700], [60, 740]);
check((await selected()).length === 1, 'a drag over nothing keeps the selection', JSON.stringify(await selected()));
// a crossing drag (right to left) over the middle of A takes A; Shift adds it to B
const a = await proj([20, 15, 10]);
await p.keyboard.down('Shift'); await drag([a[0] + 10, a[1] + 10], [a[0] - 10, a[1] - 10]); await p.keyboard.up('Shift');
sel = await selected();
check(sel.length === 2, 'a crossing drag over A with Shift adds A', JSON.stringify(sel));

// Move previews in the view: no engine change until OK
await p.keyboard.press('m'); await p.getByTestId('modify-dialog').waitFor({ timeout: 8000 }); await settle(400);
await p.getByLabel('Move X', { exact: true }).fill('50'); await settle(1500);
console.log('   X box:', await p.getByLabel('Move X', { exact: true }).inputValue(), '| bodies line:', await p.getByTestId('modify-dialog').innerText().then((t) => t.slice(0, 80).replace(/\n/g, ' ')));
await p.screenshot({ path: '/tmp/bb1.png' });
const during = await p.evaluate(async () => (await (await fetch('/api/state')).json()).bodies.map((b) => { let m = 1e9; for (let i = 0; i < b.positions.length; i += 3) m = Math.min(m, b.positions[i]); return Math.round(m); }));
check(during.join() === '0,100', 'while the Move is typed the engine still has the bodies where they were', during.join());
await p.getByTestId('modify-ok').click(); await settle(1500);
console.log('   after OK:', await p.getByTestId('hint').innerText(), '|', await p.getByTestId('error').innerText().catch(() => '-'), '| dialog:', await p.getByTestId('modify-dialog').count());
const after = await p.evaluate(async () => (await (await fetch('/api/state')).json()).bodies.map((b) => { let m = 1e9; for (let i = 0; i < b.positions.length; i += 3) m = Math.min(m, b.positions[i]); return Math.round(m); }));
check(after.join() === '50,150', 'OK moves both bodies', after.join());
await b.close();
console.log(failed ? `== bodybox: ${failed} FAILED` : '== bodybox: all passed');
process.exit(failed ? 1 : 0);
