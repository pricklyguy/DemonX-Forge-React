// Real-browser check of the bottom information bar (a face's area, an edge's length, the distance between two faces, a sketch line's length) and of the Front plane (XZ), which opens seen from the front with Z up.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/infobar.mjs
import { chromium } from 'playwright';
import { ready } from './wait.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 500) => p.waitForTimeout(ms);
const batch = (steps) => p.evaluate(async (steps) => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps }) }); }, steps);
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const info = async () => (await p.getByTestId('selection').innerText().catch(() => ''));
const until = async (f, n = 20) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };

await p.goto(URL); await ready(p);
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await batch([{ command: 'solid.box', params: { length: 40, width: 30, height: 10, corner: [0, 0, 0], body_name: 'A' } }, { command: 'solid.box', params: { length: 10, width: 10, height: 5, corner: [10, 10, 10], operation: 'new', body_name: 'B' } }]);
await p.reload(); await ready(p); await settle(1500);

const click = async (w, mods = []) => { const [x, y] = await proj(w); for (const m of mods) await p.keyboard.down(m); await p.mouse.click(x, y); for (const m of mods) await p.keyboard.up(m); await settle(500); };
await click([35, 25, 10]);
check(await until(async () => /Face \d+ · plane · area ≈ 1\d\d\d/.test(await info())), 'a face click shows its area in the bottom bar', await info());
await click([35, 25, 10]); // clicking it again keeps it
await click([15, 15, 15], ['Control']);
check(await until(async () => /Distance between the planes 5 mm/.test(await info())), 'Ctrl+click on a second face shows the distance between the two', await info());
await p.mouse.click(60, 300); await settle(500);
await click([20, 0, 10]);
check(await until(async () => /Edge \d+ of A · Length 40 mm/.test(await info())), 'an edge click shows its length', await info());

// a sketch: a line's length and angle
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await batch([{ command: 'sketch.create', params: { plane: 'XY', name: 'S' } }, { command: 'sketch.line', params: { points: [[0, 0], [30, 40]] } }]);
await p.reload(); await ready(p); await settle(1500);
const st = await p.evaluate(async () => (await (await fetch('/api/state')).json()).sketches.at(-1));
check(!!st && st.curves.length === 1, 'a sketch with a line is open', JSON.stringify(st?.curves?.map((c) => c.type)));
{ const [x1, y1] = await p.evaluate((q) => window.__forge.sketchToScreen(q), [15, 20]); await p.mouse.move(x1, y1); await p.mouse.click(x1, y1); }
check(await until(async () => /Line · length 50 mm · angle 53\.13/.test(await info())), 'a selected sketch line shows its length and angle', await info());

// the Front plane
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await p.reload(); await ready(p); await settle(1200);
await p.getByTestId('btn-sketch').click(); await settle();
await p.getByTestId('pick-plane-XZ').click(); await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(1200);
const pl = await p.evaluate(async () => (await (await fetch('/api/state')).json()).sketches.at(-1).plane);
check(JSON.stringify(pl.xDir) === '[1,0,0]' && JSON.stringify(pl.yDir) === '[0,0,1]', 'the Front plane sketch has x right and y up (world Z)', JSON.stringify(pl));
const o = await proj([0, 0, 0]), z = await proj([0, 0, 20]), x = await proj([20, 0, 0]);
check(z[1] < o[1] - 10 && x[0] > o[0] + 10, 'and it is seen from the front: Z up the screen, X to the right', `${o} ${z} ${x}`);
await b.close();
console.log(failed ? `== infobar: ${failed} FAILED` : '== infobar: all passed');
process.exit(failed ? 1 : 0);
