// Real-browser check of Construct planes: Offset Plane (from an origin plane and from a clicked face), Plane at Angle, Midplane, the Construction folder in the browser
// (eye, right-click menu), and sketching on a construction plane.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/construct.mjs
import { chromium } from 'playwright';
import { pick } from './menu.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 600) => p.waitForTimeout(ms);
const state = () => p.evaluate(async () => (await fetch('/api/state')).json());
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const dlg = () => p.getByTestId('modify-dialog');
const planeNamed = async (n) => (await state()).planes.find((q) => q.name === n);
const until = async (f, n = 40) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };
const ok = async () => { await dlg().getByRole('button', { name: 'OK' }).click(); await dlg().waitFor({ state: 'hidden', timeout: 20000 }); await settle(500); };

await p.goto(URL);
await p.getByTestId('demo').waitFor({ timeout: 30000 });
await p.evaluate(async () => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps: [{ command: 'solid.box', params: { length: 30, width: 20, height: 10, corner: [0, 0, 0], operation: 'new', body_name: 'Block' } }] }) }); });
await p.getByTestId('node-body-Block').waitFor({ timeout: 20000 });
await p.getByText(/changed by another program/).waitFor({ timeout: 20000 }); await settle(2500);

// ---- Offset Plane 25 above the XY plane
await p.getByTestId('btn-plane-offset').click(); await dlg().waitFor();
await dlg().getByLabel('Offset', { exact: true }).fill('25'); await dlg().getByLabel('Name', { exact: true }).fill('Up25'); await settle(900);
check((await planeNamed('Up25'))?.frame?.origin[2] === 25, 'while the box is open the new plane already shows (preview)', JSON.stringify((await planeNamed('Up25'))?.frame?.origin));
await ok();
const up = await planeNamed('Up25');
check(!!up && up.kind === 'offset' && Math.abs(up.frame.origin[2] - 25) < 1e-6, 'Offset Plane: Up25 sits 25 above XY', JSON.stringify(up?.frame?.origin));
check(await p.getByTestId('node-plane-Up25').isVisible(), 'it is listed in the browser under Construction');

// ---- Plane at Angle
await pick(p, 'btn-plane-angle'); await dlg().waitFor();
await dlg().getByLabel('Angle', { exact: true }).fill('30'); await dlg().getByLabel('Name', { exact: true }).fill('Tilt30'); await settle(900); await ok();
const tilt = await planeNamed('Tilt30');
check(!!tilt && tilt.kind === 'angle', 'Plane at Angle: Tilt30 made', JSON.stringify(tilt?.frame));
const n = tilt?.frame ? (() => { const x = tilt.frame.xDir, y = tilt.frame.yDir; return [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]; })() : [0, 0, 0];
check(Math.abs(Math.abs(n[2]) - Math.cos(Math.PI / 6)) < 1e-6, 'tipped 30 degrees from flat (its normal is 30 degrees from Z)', JSON.stringify(n));

// ---- Midplane between XY and Up25
await pick(p, 'btn-plane-mid'); await dlg().waitFor();
await dlg().getByLabel('Plane B', { exact: true }).selectOption('Up25'); await dlg().getByLabel('Name', { exact: true }).fill('Mid'); await settle(900); await ok();
check(Math.abs(((await planeNamed('Mid'))?.frame?.origin[2] ?? -1) - 12.5) < 1e-6, 'Midplane: halfway between XY and Up25 (12.5)', JSON.stringify((await planeNamed('Mid'))?.frame?.origin));

// ---- Offset Plane from a clicked face: 5 above the top of the box
await p.locator('[data-face=top]').click(); await settle(800);
await p.getByTestId('btn-plane-offset').click(); await dlg().waitFor();
const [fx, fy] = await proj([15, 10, 10]); await p.mouse.move(fx, fy); await p.mouse.click(fx, fy); await settle(500);
check((await dlg().getByLabel('Base plane', { exact: true }).inputValue()) === 'face', 'clicking the top face makes it the base');
await dlg().getByLabel('Offset', { exact: true }).fill('5'); await dlg().getByLabel('Name', { exact: true }).fill('AboveTop'); await settle(900); await ok();
check(Math.abs(((await planeNamed('AboveTop'))?.frame?.origin[2] ?? -1) - 15) < 1e-6, 'a plane 5 above the face (z = 15)', JSON.stringify((await planeNamed('AboveTop'))?.frame?.origin));

// ---- the browser: eye and right-click menu
await p.getByTestId('node-plane-Up25').locator('.beye').click(); await settle(300);
check(await p.getByTestId('node-plane-Up25').locator('.beye[aria-label^="Show"]').count() === 1, 'the eye hides a plane');
await p.getByTestId('node-plane-Up25').click({ button: 'right' });
const menu = p.getByTestId('context-menu');
check(await menu.getByRole('button', { name: 'Create Sketch' }).isVisible() && await menu.getByRole('button', { name: /Rename/ }).isVisible(), 'right-click offers Create Sketch and Rename');
await menu.getByRole('button', { name: 'Create Sketch' }).click();
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
check(Math.abs(((await state()).sketches.at(-1).plane.origin[2]) - 25) < 1e-6, 'Create Sketch from the menu opens a sketch on Up25 (z = 25)');

// ---- and the plane picker offers the construction planes too
await p.getByTestId('btn-finish').click(); await p.getByTestId('btn-sketch').waitFor({ timeout: 15000 }); await settle(900);
await p.getByTestId('btn-sketch').click(); await p.getByTestId('plane-picker').waitFor();
check(await p.getByTestId('pick-plane-Tilt30').isVisible(), 'Create Sketch lists the construction planes');
await p.getByTestId('pick-plane-Tilt30').click(); await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
const tp = (await state()).sketches.at(-1).plane, tn = [tp.xDir[1] * tp.yDir[2] - tp.xDir[2] * tp.yDir[1], tp.xDir[2] * tp.yDir[0] - tp.xDir[0] * tp.yDir[2], tp.xDir[0] * tp.yDir[1] - tp.xDir[1] * tp.yDir[0]];
check(Math.abs(Math.abs(tn[2]) - Math.cos(Math.PI / 6)) < 1e-6, 'a sketch on Tilt30 lies in the tilted plane', JSON.stringify(tn));
console.log(failed ? `== construct: ${failed} FAILED` : '== construct: all passed');
await b.close(); process.exit(failed ? 1 : 0);
