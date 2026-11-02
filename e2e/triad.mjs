// Real-browser check of the move / turn gizmo: in a sketch (Move / Copy, M) and on a body (Move). Arrows, the square between them, the centre dot and the ring each change the numbers in the box.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/triad.mjs
import { chromium } from 'playwright';
import { ready } from './wait.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 400) => p.waitForTimeout(ms);
const batch = (steps) => p.evaluate(async (steps) => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps }) }); }, steps);
const tri = () => p.evaluate(() => window.__forgeTriad());
const at = (q) => p.evaluate((q) => window.__forge.sketchToScreen(q), q);
const val = async (id) => Number(await p.getByTestId(id).inputValue());
const drag = async (from, to) => { await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(to[0], to[1], { steps: 10 }); await p.mouse.up(); await settle(300); };
const mid = (o, t, f) => [o[0] + (t[0] - o[0]) * f, o[1] + (t[1] - o[1]) * f];

await p.goto(URL); await ready(p);
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await batch([{ command: 'sketch.create', params: { plane: 'XY', name: 'S' } }, { command: 'sketch.rectangle.two_point', params: { p0: [10, 10], p1: [50, 30] } }, { command: 'sketch.finish' }, { command: 'sketch.edit', params: { sketch: 'S' } }]);
await p.reload(); await ready(p); await settle(1500);
// (the sketch is open again after the reload): select everything with a box, then M
await p.getByTestId('tab-sketch').waitFor({ timeout: 20000 });
await settle(800);
const [ax, ay] = await at([0, 0]), [bx, by] = await at([60, 40]);
await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await settle(400);
await p.keyboard.press('m'); await p.getByTestId('skmove-dialog').waitFor({ timeout: 5000 }); await settle(500);

let t = await tri();
check(t && t.arrowTip.length === 2 && t.ringAt.length === 1, 'the gizmo shows two arrows and one ring in a sketch', JSON.stringify(t && [t.arrowTip.length, t.ringAt.length]));
const [c0x, c0y] = await at([30, 20]), [c1x, c1y] = await at([40, 20]), [c2x, c2y] = await at([30, 30]);
const pxX = [(c1x - c0x) / 10, (c1y - c0y) / 10], pxY = [(c2x - c0x) / 10, (c2y - c0y) / 10];
// X arrow
await drag(mid(t.o, t.arrowTip[0], 0.6), [mid(t.o, t.arrowTip[0], 0.6)[0] + pxX[0] * 8, mid(t.o, t.arrowTip[0], 0.6)[1] + pxX[1] * 8]);
check(Math.abs(await val('skmove-dx') - 8) <= 1 && Math.abs(await val('skmove-dy')) < 0.6, 'the X arrow moves along X only', `${await val('skmove-dx')}, ${await val('skmove-dy')}`);
await p.getByTestId('skmove-dx').fill('0'); await settle(500);
// the square between the arrows: both
t = await tri(); const sq = t.planeAt.XY;
await drag(sq, [sq[0] + pxX[0] * 5 + pxY[0] * 7, sq[1] + pxX[1] * 5 + pxY[1] * 7]);
check(Math.abs(await val('skmove-dx') - 5) <= 1 && Math.abs(await val('skmove-dy') - 7) <= 1, 'the square between them moves in both directions', `${await val('skmove-dx')}, ${await val('skmove-dy')}`);
// the preview follows: the gizmo stands at the moved middle
t = await tri(); const [mx, my] = await at([30 + (await val('skmove-dx')), 20 + (await val('skmove-dy'))]);
check(Math.hypot(t.o[0] - mx, t.o[1] - my) < 3, 'the gizmo moves with the preview', `${t.o} vs ${[mx, my]}`);
await p.getByTestId('skmove-dx').fill('0'); await p.getByTestId('skmove-dy').fill('0'); await settle(600);
// the centre dot: free, in the plane
t = await tri();
await drag(t.o, [t.o[0] + pxX[0] * -6 + pxY[0] * 3, t.o[1] + pxX[1] * -6 + pxY[1] * 3]);
check(Math.abs(await val('skmove-dx') + 6) <= 1 && Math.abs(await val('skmove-dy') - 3) <= 1, 'the centre dot drags in the plane', `${await val('skmove-dx')}, ${await val('skmove-dy')}`);
await p.getByTestId('skmove-dx').fill('0'); await p.getByTestId('skmove-dy').fill('0'); await settle(600);
// the ring: a quarter turn anticlockwise on the screen is +90
t = await tri(); const d0 = t.ringAt[0][0], c = t.o, v = [d0[0] - c[0], d0[1] - c[1]];
await drag(d0, [c[0] + v[1], c[1] - v[0]]);
check(Math.abs(await val('skmove-angle') - 90) <= 15, 'the ring turns it: a quarter turn anticlockwise is about +90', `${await val('skmove-angle')}`);
console.log('   box:', await val('skmove-dx'), await val('skmove-dy'), await val('skmove-angle'));
await p.getByTestId('skmove-ok').click(); await settle(1200);
const bb = await p.evaluate(async () => { const l = (await (await fetch('/api/state')).json()).sketches.at(-1).curves.filter((c) => c.type === 'line'); const xs = l.flatMap((c) => [c.start[0], c.end[0]]), ys = l.flatMap((c) => [c.start[1], c.end[1]]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((q) => Math.round(q)); });
check(bb[2] - bb[0] <= 21 && bb[3] - bb[1] >= 39, 'OK turns the rectangle: it is now tall and narrow', JSON.stringify(bb));

// a body: three arrows, three rings
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await batch([{ command: 'solid.box', params: { length: 40, width: 30, height: 10, corner: [0, 0, 0] } }]);
await p.reload(); await ready(p); await settle(1500);
await p.keyboard.press('m'); await p.getByTestId('modify-dialog').waitFor({ timeout: 8000 }); await settle(500);
const [bxx, byy] = await p.evaluate(() => window.__forge.project([20, 15, 5]));
await p.mouse.click(bxx, byy); await settle(500);
t = await tri();
check(t && t.arrowTip.length === 3 && t.ringAt.length === 3, 'the body gizmo shows three arrows and three rings', JSON.stringify(t && [t.arrowTip.length, t.ringAt.length]));
const o3 = await p.evaluate(() => window.__forge.project([20, 15, 5])), x3 = await p.evaluate(() => window.__forge.project([30, 15, 5])), z3 = await p.evaluate(() => window.__forge.project([20, 15, 15]));
const pxZ = [(z3[0] - o3[0]) / 10, (z3[1] - o3[1]) / 10], pxX3 = [(x3[0] - o3[0]) / 10, (x3[1] - o3[1]) / 10];
await drag(mid(t.o, t.arrowTip[2], 0.65), [mid(t.o, t.arrowTip[2], 0.65)[0] + pxZ[0] * 10, mid(t.o, t.arrowTip[2], 0.65)[1] + pxZ[1] * 10]);
const mz = Number(await p.getByLabel('Move Z', { exact: true }).inputValue());
check(Math.abs(mz - 10) <= 1.5, 'the Z arrow lifts the body about 10 mm', String(mz));
await p.getByLabel('Move Z', { exact: true }).fill('0'); await settle(300);
t = await tri(); const sq2 = t.planeAt.XY;
await drag(sq2, [sq2[0] + pxX3[0] * 6, sq2[1] + pxX3[1] * 6]);
check(Math.abs(Number(await p.getByLabel('Move X', { exact: true }).inputValue())) >= 3, 'a square moves it in its plane', await p.getByLabel('Move X', { exact: true }).inputValue());
await b.close();
console.log(failed ? `== triad: ${failed} FAILED` : '== triad: all passed');
process.exit(failed ? 1 : 0);
