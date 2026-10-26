// Real-browser check of Box, Cylinder and Sphere: typed sizes and position, a click on a face to place, join, a named new body, undo.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/primitives.mjs
import { ready } from './wait.mjs';
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
const field = (name) => p.getByLabel(name, { exact: true });
const set = async (name, v) => { const f = field(name); await f.fill(v); await settle(300); };
const box = (body) => { const q = body.positions; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < q.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[i + k]); hi[k] = Math.max(hi[k], q[i + k]); } return { lo, hi, size: hi.map((v, k) => +(v - lo[k]).toFixed(3)) }; };
const waitBodies = async (n) => { for (let i = 0; i < 60; i++) { if ((await state()).bodies.length === n) return true; await settle(250); } return false; };

p.on('response', async (r) => { if (r.url().includes('/api/') && process.env.DBG) console.log('RESP', r.request().method(), r.url().replace(URL, ''), r.status(), (r.request().postData() ?? '').slice(0, 160)); });
await p.goto(URL);
await ready(p);

// ---- a box in an empty design, named, 30 x 20 x 10 with its corner at the origin
await p.getByTestId('btn-box').click(); await settle();
check(await p.getByTestId('modify-dialog').isVisible(), 'Box opens its dialog in an empty design');
await set('box length (x)', '30'); await set('box width (y)', '20'); await set('box height (z)', '10'); await set('box body name', 'Block');
await p.getByRole('button', { name: 'OK' }).click(); await p.getByTestId('modify-dialog').waitFor({ state: 'hidden', timeout: 20000 }); await settle(500);
let s = await state();
check(s.bodies.length === 1 && s.bodies[0].name === 'Block', 'the box is a body named Block', s.bodies.map((q) => q.name).join());
check(JSON.stringify(box(s.bodies[0]).size) === '[30,20,10]', 'it is 30 x 20 x 10', JSON.stringify(box(s.bodies[0]).size));
check(box(s.bodies[0]).lo.every((v) => Math.abs(v) < 1e-6), 'with its corner at the origin');

// ---- a cylinder stood on the box's top face by clicking it, joined
await p.locator('[data-face=top]').click(); await settle(800);
await p.getByTestId('btn-cylinder').click(); await settle();
const [fx, fy] = await proj([15, 10, 10]); await p.mouse.move(fx, fy); await p.mouse.click(fx, fy); await settle(500);
check(Math.abs(Number(await field('cylinder base centre z').inputValue()) - 10) < 0.05, 'clicking the top face puts the base centre at z = 10', await field('cylinder base centre z').inputValue());
check(await field('cylinder axis').inputValue() === 'Z', 'and the axis is Z');
await set('cylinder diameter', '6'); await set('cylinder height', '5');
check(await field('cylinder operation').inputValue() === 'join', 'Join is the default when there is a body');
await p.getByRole('button', { name: 'OK' }).click(); await p.getByTestId('modify-dialog').waitFor({ state: 'hidden', timeout: 20000 }); await settle(500);
s = await state();
check(s.bodies.length === 1 && Math.abs(box(s.bodies[0]).hi[2] - 15) < 0.01, 'the cylinder joined the box: 15 mm high', JSON.stringify(box(s.bodies[0]).hi));

// ---- a sphere as a new body away from it
await p.getByTestId('btn-sphere').click(); await settle();
await set('sphere diameter', '8'); await set('sphere centre x', '50'); await set('sphere centre y', '0'); await set('sphere centre z', '4');
await field('sphere operation').selectOption('new'); await set('sphere body name', 'Ball');
await p.getByRole('button', { name: 'OK' }).click(); await p.getByTestId('modify-dialog').waitFor({ state: 'hidden', timeout: 20000 }); await settle(500);
s = await state(); const ball = s.bodies.find((q) => q.name === 'Ball');
check(s.bodies.length === 2 && !!ball, 'the sphere is a second body named Ball');
check(ball && JSON.stringify(box(ball).size) === '[8,8,8]', 'it is 8 mm across', ball && JSON.stringify(box(ball).size));

// ---- a bad size is refused, Esc cancels, and undo takes one back
await p.getByTestId('btn-box').click(); await settle();
await set('box length (x)', '0'); await p.getByRole('button', { name: 'OK' }).click(); await settle(500);
check(await p.getByTestId('modify-dialog').isVisible(), 'a zero size keeps the dialog open');
await p.keyboard.press('Escape'); await settle(600);
check((await state()).bodies.length === 2 && !(await p.getByTestId('modify-dialog').isVisible()), 'Esc cancels and changes nothing');
await p.keyboard.press('Control+z'); await settle(1200);
check(await waitBodies(1), 'Ctrl+Z takes the sphere away');
console.log(failed ? `== primitives: ${failed} FAILED` : '== primitives: all passed');
await b.close(); process.exit(failed ? 1 : 0);
