// Real-browser check of the arrows round the view cube: four quarter turns (the model turns the way the arrow points) and two rolls about the line of sight.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/viewcube.mjs
import { chromium } from 'playwright';
import { ready } from './wait.mjs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 700) => p.waitForTimeout(ms);
const dir = () => p.evaluate(() => window.__forge.camDir());
const up = () => p.evaluate(() => window.__forge.up().map((v) => Math.round(v * 100) / 100));
const near = (a, c) => a.every((v, i) => Math.abs(v - c[i]) < 0.05);

await p.goto(URL); await ready(p);
await p.evaluate(() => fetch('/api/new', { method: 'POST', body: '{}' }));
await p.evaluate(async () => { await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps: [{ command: 'solid.box', params: { length: 40, width: 30, height: 10, corner: [0, 0, 0] } }] }) }); });
await p.reload(); await ready(p); await settle(1200);
for (const id of ['up', 'down', 'left', 'right', 'rollCW', 'rollCCW']) check(await p.getByTestId(`vc-${id}`).isVisible(), `the ${id} arrow is there`);

await p.locator('[data-face="front"]').click(); await settle();
check(near(await dir(), [0, -1, 0]), 'the Front face looks from -Y', JSON.stringify(await dir()));
await p.getByTestId('vc-right').click(); await settle(1000);
check(near(await dir(), [-1, 0, 0]), 'the right arrow turns the model to the right: the Left face now faces you', JSON.stringify(await dir()));
await p.getByTestId('vc-left').click(); await settle(1000);
check(near(await dir(), [0, -1, 0]), 'the left arrow turns it back', JSON.stringify(await dir()));
await p.getByTestId('vc-up').click(); await settle(1000);
check(near(await dir(), [0, 0, -1]), 'the up arrow turns the model up: the Bottom face now faces you', JSON.stringify(await dir()));
await p.getByTestId('vc-down').click(); await settle(1000);
check(near(await dir(), [0, -1, 0]), 'the down arrow turns it back', JSON.stringify(await dir()));
await p.getByTestId('vc-rollCW').click(); await settle(1000);
check(near(await dir(), [0, -1, 0]) && near(await up(), [-1, 0, 0]), 'a clockwise roll keeps the view direction and turns the model clockwise (what was on the left is now up)', JSON.stringify([await dir(), await up()]));
await p.getByTestId('vc-rollCCW').click(); await settle(1000);
check(near(await up(), [0, 0, 1]), 'the anticlockwise roll turns it back', JSON.stringify(await up()));
await p.getByTestId('vc-right').click(); await p.getByTestId('vc-right').click(); await settle(1500);
check(near(await dir(), [-1, 0, 0]), 'a second click while it is turning is ignored (one quarter turn, no jump)', JSON.stringify(await dir()));
await b.close();
console.log(failed ? `== viewcube: ${failed} FAILED` : '== viewcube: all passed');
process.exit(failed ? 1 : 0);
