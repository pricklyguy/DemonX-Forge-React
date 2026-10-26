// Real-browser check of the drawing tools added after the first seven: 3-point rectangle, rounded rectangle, 3-point circle, centre-point arc, the three polygons
// (with the number of sides from the Sketch Palette), ellipse, point and fit-point spline. Each is drawn on its own part of one sketch and the engine's answer is checked.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/sketchtools.mjs
import { ready } from './wait.mjs';
import { chromium } from 'playwright';
import { pick } from './menu.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 500) => p.waitForTimeout(ms);
const sketch = async () => (await (await p.evaluate(async () => (await fetch('/api/state')).json())).sketches.at(-1));
const at = (q) => p.evaluate((q) => window.__forge.sketchToScreen(q), q);
const click = async (q) => { const [x, y] = await at(q); await p.mouse.move(x, y); await p.mouse.click(x, y); await settle(250); };
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const waitCurves = async (n) => { for (let i = 0; i < 40; i++) { if ((await sketch()).curves.length >= n) return true; await settle(250); } return false; };
const areas = async () => (await sketch()).profiles.map((q) => q.area);
const until = async (f, n = 30) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };
const near = (a, v, tol = 0.02) => Math.abs(a - v) <= Math.abs(v) * tol;
const has = async (v) => { for (let i = 0; i < 24; i++) { if ((await areas()).some((a) => near(a, v))) return true; await settle(250); } return false; };

await p.goto(URL);
await ready(p);
await p.getByTestId('btn-sketch').click(); await settle();
const [px, py] = await proj([40, -40, 0]); await p.mouse.move(px, py); await p.mouse.click(px, py);
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
await p.mouse.wheel(0, 400); await settle(500); // zoom out so the whole drawing is on screen

// ---- 3-point rectangle: one edge 40 long, then 20 out to the side (the pointer snaps to the grid, so sizes are multiples of 10)
await pick(p, 'tool-rect3'); await click([0, 0]); await click([40, 0]); await click([20, 20]);
check(await waitCurves(4) && await has(800), '3-Point Rectangle: 40 x 20', JSON.stringify(await areas()));

// ---- rounded rectangle: 40 x 30, corners a fifth of 30 = 6
await pick(p, 'tool-rectRound'); await click([60, 0]); await click([100, 30]);
check(await waitCurves(12) && await has(1200 - (4 - Math.PI) * 36), 'Rounded Rectangle: corners rounded by a fifth of the short side', JSON.stringify(await areas()));
check((await sketch()).curves.filter((c) => c.type === 'arc').length === 4, 'with four corner arcs');

// ---- 3-point circle through (0,40) (20,60) (0,80): centre (0,60), radius 20
await pick(p, 'tool-circle3'); await click([0, 40]); await click([20, 60]); await click([0, 80]);
check(await has(Math.PI * 400), '3-Point Circle through three points', JSON.stringify(await areas()));

// ---- centre-point arc: centre (60,60), starts at (80,60), turns counter-clockwise to straight up
await pick(p, 'tool-arcC'); await click([60, 60]); await click([80, 60]); await click([60, 90]);
const arc = (await sketch()).curves.filter((c) => c.type === 'arc').find((c) => Math.abs(c.center[0] - 60) < 1e-6 && Math.abs(c.center[1] - 60) < 1e-6);
check(!!arc && Math.abs(arc.radius - 20) < 1e-6 && Math.abs(arc.start[0] - 80) < 1e-6 && Math.abs(arc.end[0] - 60) < 1e-6 && Math.abs(arc.end[1] - 80) < 1e-6, 'Center Point Arc: radius 20 from (80,60) up to (60,80)', JSON.stringify(arc && [arc.start, arc.end]));

// ---- polygons: 5 sides (inscribed, radius 20), 6 sides (circumscribed, 20 to the sides), 4 sides on an edge of 20
await p.getByTestId('polygon-sides').fill('5');
await pick(p, 'tool-polyIn'); await click([120, 60]); await click([140, 60]);
check(await has(0.5 * 5 * 400 * Math.sin((2 * Math.PI) / 5)), 'Inscribed Polygon: 5 sides, radius 20 to the corners', JSON.stringify(await areas()));
await p.getByTestId('polygon-sides').fill('6');
await pick(p, 'tool-polyOut'); await click([-100, 60]); await click([-80, 60]);
check(await has(6 * 20 * 20 * Math.tan(Math.PI / 6)), 'Circumscribed Polygon: 6 sides, 20 to the middle of the sides', JSON.stringify(await areas()));
await p.getByTestId('polygon-sides').fill('4');
await pick(p, 'tool-polyEdge'); await click([0, 100]); await click([20, 100]);
check(await has(400), 'Edge Polygon: a square on an edge of 20, above the way it was drawn', JSON.stringify(await areas()));

// ---- ellipse: centre (60,110), long axis to (80,110), short side to (60,120): 20 x 10
await pick(p, 'tool-ellipse'); await click([60, 110]); await click([80, 110]); await click([60, 120]);
check(await has(Math.PI * 200), 'Ellipse: 20 x 10 half-axes', JSON.stringify(await areas()));

// ---- the options strip above the sketch: the sisters of the chosen tool are one click away
await p.getByTestId('tool-rect').click(); await settle(300);
check(await p.getByTestId('tool-options').isVisible() && await p.getByTestId('opt-rectRound').isVisible(), 'choosing a rectangle tool shows the strip with the other rectangles');
await p.getByTestId('opt-rect3').click(); await settle(200);
check(await p.getByTestId('opt-rect3').getAttribute('aria-pressed') === 'true', 'a click in the strip switches the tool');
await p.getByTestId('tool-line').click(); await p.getByTestId('opt-lineMid').click();
const linesBefore = (await sketch()).curves.filter((c) => c.type === 'line').length;
await click([-60, -20]); await click([-40, -20]); // the middle at (-60,-20), one end at (-40,-20)
check(await until(async () => { const l = (await sketch()).curves.filter((c) => c.type === 'line'); return l.length === linesBefore + 1 && l.some((q) => Math.abs(Math.min(q.start[0], q.end[0]) + 80) < 1e-6 && Math.abs(Math.max(q.start[0], q.end[0]) + 40) < 1e-6); }), 'Midpoint Line: the other end is the same distance the other way (-80 to -40)');

// ---- point
const pointsBefore = (await sketch()).points.length;
await pick(p, 'tool-point'); await click([0, 130]);
for (let i = 0; i < 20 && (await sketch()).points.length <= pointsBefore; i++) await settle(250);
check((await sketch()).points.some((q) => Math.abs(q.at[0]) < 1e-6 && Math.abs(q.at[1] - 130) < 1e-6), 'Point at (0,130)');

// ---- spline: three clicks, Enter ends it open; then one closed by clicking its first point
const other = async () => (await sketch()).curves.filter((c) => c.type === 'other').length;
const o0 = await other();
await pick(p, 'tool-spline'); await click([100, 100]); await click([115, 120]); await click([130, 100]); await p.keyboard.press('Enter'); await settle(800);
for (let i = 0; i < 20 && (await other()) <= o0; i++) await settle(250);
check((await other()) === o0 + 1, 'Fit Point Spline: Enter ends it open', String(await other()));
const a0 = (await areas()).length;
await pick(p, 'tool-spline'); await click([140, 100]); await click([160, 100]); await click([150, 120]); await click([140, 100]); await settle(800);
for (let i = 0; i < 20 && (await areas()).length <= a0; i++) await settle(250);
check((await areas()).length > a0, 'a spline closed on its first point makes a shape', JSON.stringify(await areas()));
await p.screenshot({ path: '/tmp/sketchtools.png' });
console.log(failed ? `== sketchtools: ${failed} FAILED` : '== sketchtools: all passed');
await b.close(); process.exit(failed ? 1 : 0);
