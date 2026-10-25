// Real-browser check of the sketch Modify, Pattern, Constraint and Insert tools added in 0.31.0: Chamfer, Break, Move / Copy, Scale, Mirror, Circular and Rectangular
// Pattern, Collinear, Symmetry, AutoConstrain, and Insert DXF / SVG (through the file chooser).
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/sketchmodify.mjs
import { chromium } from 'playwright';
import { pick } from './menu.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; }); // a plain file chooser
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 500) => p.waitForTimeout(ms);
const sketch = async () => (await p.evaluate(async () => (await fetch('/api/state')).json())).sketches.at(-1);
const at = (q) => p.evaluate((q) => window.__forge.sketchToScreen(q), q);
const click = async (q) => { const [x, y] = await at(q); await p.mouse.move(x, y); await p.mouse.click(x, y); await settle(250); };
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const until = async (f, n = 30) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };
const count = async (type) => (await sketch()).curves.filter((c) => c.type === type).length;
const answer = async (text, option) => { const box = p.getByLabel('Value', { exact: true }); await box.fill(text); if (option) await p.getByTestId('value-option').selectOption(option); await box.press('Enter'); };

await p.goto(URL);
await p.getByTestId('demo').waitFor({ timeout: 30000 });
await p.getByTestId('btn-sketch').click(); await settle();
const [px, py] = await proj([40, -40, 0]); await p.mouse.move(px, py); await p.mouse.click(px, py);
await p.getByTestId('tab-sketch').waitFor({ timeout: 15000 }); await settle(900);
await p.mouse.wheel(0, 400); await settle(500);

// ---- a rectangle 40 x 20, chamfered 10 at its top-right corner, then broken in the middle of its bottom edge
await p.getByTestId('tool-rect').click(); await click([0, 0]); await click([40, 20]); await settle(800);
await pick(p, 'tool-chamfer'); await click([40, 20]); await answer('10');
check(await until(async () => (await count('line')) === 5), 'Chamfer adds a fifth line at the corner', String(await count('line')));
check(await until(async () => (await sketch()).profiles.some((q) => Math.abs(q.area - 750) < 1)), 'and the shape is 800 less the corner (50)');
await pick(p, 'tool-break'); await click([20, 0]);
check(await until(async () => (await count('line')) === 6), 'Break splits the bottom edge in two', String(await count('line')));
await p.keyboard.press('Escape');

// ---- a circle: Scale it, Move / Copy a copy, Mirror, patterns
await p.getByTestId('tool-circle').click(); await click([80, 10]); await click([90, 10]); await settle(800);
check(await until(async () => (await count('circle')) === 1), 'a circle of diameter 20');
await click([90, 10]); // no tool: select it
await pick(p, 'tool-sscale'); await answer('2');
check(await until(async () => (await sketch()).curves.some((c) => c.type === 'circle' && Math.abs(c.radius - 20) < 1e-6)), 'Scale makes it twice as big (radius 20)', JSON.stringify((await sketch()).curves.filter((c) => c.type === 'circle').map((c) => c.radius)));
await click([100, 10]); // its edge is now 20 from the centre (80,10): (100,10)
await pick(p, 'tool-smove'); await answer('0, 60', 'Copy');
check(await until(async () => (await count('circle')) === 2), 'Move / Copy with Copy makes a second circle', String(await count('circle')));

// a vertical line to mirror about, then Mirror the original circle
await p.getByTestId('tool-line').click(); await click([140, -20]); await click([140, 90]); await p.keyboard.press('Escape'); await settle(600);
await click([100, 10]); await pick(p, 'tool-smirror'); await click([140, 40]);
check(await until(async () => (await count('circle')) === 3), 'Mirror about the line makes a third circle', String(await count('circle')));

// rectangular pattern of the first circle: 3 in a row 100 apart
await click([100, 10]); await pick(p, 'tool-srect'); await answer('3, 100');
check(await until(async () => (await count('circle')) === 5), 'Rectangular Pattern adds two copies', String(await count('circle')));

// ---- constraints: Collinear, Symmetry, AutoConstrain
const dof = async () => (await sketch()).dof;
await p.getByTestId('tool-line').click(); await click([-60, 40]); await click([-30, 50]); await p.keyboard.press('Escape');
await p.getByTestId('tool-line').click(); await click([-60, 60]); await click([-30, 80]); await p.keyboard.press('Escape'); await settle(600);
const d0 = await dof();
await p.getByTestId('tool-collinear').click(); await click([-45, 45]); await click([-45, 70]); await settle(800);
check(await until(async () => (await dof()) < d0), 'Collinear takes a degree of freedom away', `${d0} -> ${await dof()}`);
await p.keyboard.press('Escape');
const d1 = await dof();
await p.getByTestId('tool-auto').click(); await settle(1500);
check((await dof()) <= d1 && !(await p.getByTestId('error').count()), 'AutoConstrain runs without an error', `${d1} -> ${await dof()}`);
await p.getByTestId('tool-symmetry').click();
check(await p.getByTestId('tool-symmetry').getAttribute('aria-pressed') === 'true', 'the Symmetry tool can be chosen'); await p.keyboard.press('Escape');

// ---- Insert DXF and SVG through the file chooser
const lines0 = await count('line');
let fc = p.waitForEvent('filechooser'); await pick(p, 'tool-insert-dxf');
await (await fc).setFiles({ name: 'one.dxf', mimeType: 'application/octet-stream', buffer: Buffer.from('0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0.0\n20\n-80.0\n30\n0.0\n11\n30.0\n21\n-80.0\n31\n0.0\n0\nENDSEC\n0\nEOF\n') });
check(await until(async () => (await count('line')) === lines0 + 1), 'Insert DXF puts a line into the sketch', String(await count('line')));
fc = p.waitForEvent('filechooser'); await pick(p, 'tool-insert-svg');
await (await fc).setFiles({ name: 'box.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0 L20 0 L20 10 L0 10 Z"/></svg>') });
check(await until(async () => (await count('line')) >= lines0 + 5), 'Insert SVG puts a shape into the sketch', String(await count('line')));
console.log(failed ? `== sketchmodify: ${failed} FAILED` : '== sketchmodify: all passed');
await b.close(); process.exit(failed ? 1 : 0);
