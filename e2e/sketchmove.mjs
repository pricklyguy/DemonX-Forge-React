// Real-browser check of the sketch Move / Copy box (0.37.0): M opens it in a sketch, it previews, the X arrow in the view sets dx, a turn works, Copy keeps the original, Esc cancels.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/sketchmove.mjs
import { ready } from './wait.mjs';
import { chromium } from 'playwright';

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
const bbox = async () => { const lines = (await sketch()).curves.filter((c) => c.type === 'line'); const xs = lines.flatMap((c) => [c.start[0], c.end[0]]), ys = lines.flatMap((c) => [c.start[1], c.end[1]]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 100) / 100); };
const boxSelect = async () => { const [ax, ay] = await at([0, 0]), [bx, by] = await at([60, 40]); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await settle(400); };
const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.02);

await p.goto(URL); await ready(p);
await p.getByTestId('btn-sketch').click(); await settle();
const [px, py] = await proj([40, -40, 0]); await p.mouse.move(px, py); await p.mouse.click(px, py);
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
await p.mouse.wheel(0, 400); await settle(500);
await p.getByTestId('tool-rect').click(); await click([10, 10]); await click([50, 30]); await settle(800);
check(near(await bbox(), [10, 10, 50, 30]), 'a rectangle 40 x 20 away from the origin (one at the origin is pinned to it)', JSON.stringify(await bbox()));

// M with nothing selected says what to do
await p.keyboard.press('Escape'); await p.keyboard.press('m'); await settle(300);
check(!(await p.getByTestId('skmove-dialog').isVisible().catch(() => false)), 'M with nothing selected does not open the box');

// select the four sides with a box, then M
await boxSelect();
await p.keyboard.press('m'); await settle(400);
check(await p.getByTestId('skmove-dialog').isVisible(), 'M opens the Move / Copy box in a sketch');

// typing shows a preview and the arrows follow
await p.getByTestId('skmove-dx').fill('15'); await settle(400);
check(near(await bbox(), [10, 10, 50, 30]), 'typing alone does not change the sketch yet');
// the gizmo: grab the X arrow by its shaft and drag it 10 mm along X: dx goes to about 10
await p.getByTestId('skmove-dx').fill('0'); await settle(300);
{
  const tri = await p.evaluate(() => window.__forgeTriad());
  const [ox, oy] = await at([30, 20]), [x10, y10] = await at([40, 20]), pxmm = Math.hypot(x10 - ox, y10 - oy) / 10;
  const gx = tri.o[0] + (tri.arrowTip[0][0] - tri.o[0]) * 0.6, gy = tri.o[1] + (tri.arrowTip[0][1] - tri.o[1]) * 0.6;
  await p.mouse.move(gx, gy); await p.mouse.down(); await p.mouse.move(gx + 10 * pxmm, gy, { steps: 8 }); await p.mouse.up(); await settle(300);
  const dx = Number(await p.getByTestId('skmove-dx').inputValue());
  check(Math.abs(dx - 10) < 1.5, 'dragging the X arrow 10 mm sets dx to about 10', String(dx));
}
await p.getByTestId('skmove-dx').fill('15');
await p.getByTestId('skmove-ok').click();
check(await until(async () => near(await bbox(), [25, 10, 65, 30])), 'OK moves the rectangle 15 in X', JSON.stringify(await bbox()));
await p.keyboard.press('Control+z'); await settle(600);
check(near(await bbox(), [10, 10, 50, 30]), 'Ctrl+Z puts it back');

// Esc cancels
await p.keyboard.press('Escape'); await boxSelect(); await p.keyboard.press('m'); await settle(300);
await p.getByTestId('skmove-dy').fill('9'); await p.keyboard.press('Escape'); await settle(300);
check(!(await p.getByTestId('skmove-dialog').isVisible().catch(() => false)) && near(await bbox(), [10, 10, 50, 30]), 'Esc closes the box and changes nothing');

// a copy keeps the original; a turn of 90 about the middle
await boxSelect(); await p.keyboard.press('m'); await settle(300);
await p.getByTestId('skmove-dy').fill('50'); await p.getByTestId('skmove-copy').check(); await p.getByTestId('skmove-dy').press('Enter');
check(await until(async () => near(await bbox(), [10, 10, 50, 80])), 'Copy leaves the original and adds one 50 higher', JSON.stringify(await bbox()) + ' ' + (await sketch()).curves.map((c) => c.id + JSON.stringify(c.start)).join(' ') + ' ' + (await p.getByTestId('skmove-dialog').isVisible()) + ' ' + (await p.evaluate(() => document.querySelector('[data-testid=error]')?.textContent ?? '')));
// undo the copy, then turn the original 90 degrees about the middle of the selection (30, 20): 20 wide and 40 tall
await p.keyboard.press('Control+z'); await settle(600);
await p.keyboard.press('Escape'); await boxSelect(); await p.keyboard.press('m'); await settle(300);
await p.getByTestId('skmove-angle').fill('90'); await p.getByTestId('skmove-angle').press('Enter');
check(await until(async () => near(await bbox(), [20, 0, 40, 40])), 'a turn of 90 about the middle of the selection', JSON.stringify(await bbox()));
// a turn and a move together: turned about the middle first, then moved (as the preview draws it)
await p.keyboard.press('Escape'); await boxSelect(); await p.keyboard.press('m'); await settle(300);
await p.getByTestId('skmove-angle').fill('90'); await p.getByTestId('skmove-dx').fill('10'); await p.getByTestId('skmove-dx').press('Enter');
check(await until(async () => near(await bbox(), [20, 10, 60, 30])), 'a turn of 90 with a move of 10 in X: turned about the middle, then moved', JSON.stringify(await bbox()));
await b.close();
console.log(failed ? `== sketchmove: ${failed} FAILED` : '== sketchmove: all passed');
process.exit(failed ? 1 : 0);
