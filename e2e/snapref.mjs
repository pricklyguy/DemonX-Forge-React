// Real-browser check that a sketch snaps to what is already there: the straight edges of a body that lie in the sketch plane, and the corners of other sketches;
// and that the eye on a sketch in the browser really shows it (the engine hides a sketch once a feature has used it).
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/snapref.mjs
import { chromium } from 'playwright';
import { ready } from './wait.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 500) => p.waitForTimeout(ms);
const state = () => p.evaluate(async () => (await fetch('/api/state')).json());
const at = (q) => p.evaluate((q) => window.__forge.sketchToScreen(q), q);
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const until = async (f, n = 40) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };

await p.goto(URL);
await ready(p);
// a block 33 x 21 x 10 made from a sketch (its corner at 33,21 is not on the 5 or 10 mm grid), so its sketch is hidden by the engine afterwards
await p.evaluate(async () => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps: [
  { command: 'sketch.create', params: { plane: 'XY', name: 'Base' } }, { command: 'sketch.rectangle.two_point', params: { p0: [0, 0], p1: [33, 21] } }, { command: 'sketch.finish', params: {} },
  { command: 'solid.extrude', params: { sketch: 'Base', profiles: [0], distance: 10, operation: 'new' } }] }) }); });
await p.getByTestId('node-body-Body1').waitFor({ timeout: 20000 });
await p.getByText(/changed by another program/).waitFor({ timeout: 20000 }); await settle(2500);

// ---- the eye
check((await state()).sketches[0].visible === false, 'the engine hides a sketch once an extrude has used it');
const eye = p.getByTestId('node-sketch-Base').locator('.beye');
check((await eye.getAttribute('aria-label')).startsWith('Show'), 'and the browser shows its eye as off to match');
await eye.click();
check(await until(async () => (await state()).sketches[0].visible === true), 'a click on the eye shows it');

// ---- snapping to the body's own edges: a new sketch on the XY plane (the block's bottom edges are in it)
await p.getByTestId('btn-sketch').click(); await p.getByTestId('plane-picker').waitFor(); await p.getByTestId('pick-plane-XY').click();
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
await p.getByTestId('tool-line').click(); await settle(200);
const [x, y] = await at([33.3, 21.2]); await p.mouse.move(x - 2, y); await p.mouse.move(x, y); await settle(300); // about a third of a mm from the corner
check(await p.evaluate(() => window.__forge.snapKind()) === 'end', 'near the corner of the block the pointer snaps to its end');
const pt = await p.evaluate(() => window.__forge.pointerSnap());
check(Math.abs(pt[0] - 33) < 1e-6 && Math.abs(pt[1] - 21) < 1e-6, 'exactly onto it (33, 21)', JSON.stringify(pt));
console.log(failed ? `== snapref: ${failed} FAILED` : '== snapref: all passed');
await b.close(); process.exit(failed ? 1 : 0);
