// Real-browser check of the Start page: it fills an empty design, the Home button opens it over a design, a design that is saved shows up in Recent (with a picture),
// the list survives a reload, a click on a recent design opens it, and the list can be pruned.
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/start.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; }); // downloads and a plain file chooser
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 500) => p.waitForTimeout(ms);
const until = async (f, n = 40) => { for (let i = 0; i < n; i++) { if (await f()) return true; await settle(250); } return false; };
const state = () => p.evaluate(async () => (await fetch('/api/state')).json());

await p.goto(URL);
await p.getByTestId('demo').waitFor({ timeout: 30000 });
check(await p.getByTestId('start-page').isVisible() && await p.getByTestId('recent-none').isVisible(), 'an empty design shows the Start page with nothing recent yet');
check(await p.getByTestId('btn-sketch').isEnabled(), 'and the ribbon is still usable beside it');

await p.getByTestId('demo').click();
check(await until(async () => (await state()).bodies.length > 0), 'the Demo bracket sample loads');
check(await until(async () => !(await p.getByTestId('start-page').isVisible().catch(() => false))), 'and the Start page steps aside');

// ---- Home opens it over the design
await p.getByTestId('home-button').click();
check(await p.getByTestId('start-overlay').isVisible(), 'the Home button opens the Start page over a design');
check(/Back to/.test(await p.getByTestId('start-back').innerText()), 'with a way back');
await p.keyboard.press('Escape'); await settle(300);
check(!(await p.getByTestId('start-overlay').isVisible().catch(() => false)), 'Esc goes back to the design');

// ---- save it: it appears in Recent with a picture
await settle(1200);
const dl = p.waitForEvent('download'); await p.keyboard.press('Control+s'); const d = await dl;
const bytes = readFileSync(await d.path()); const fname = d.suggestedFilename();
await p.getByTestId('home-button').click();
await p.getByTestId('recent-list').waitFor({ timeout: 10000 });
const items = await p.locator('[data-testid^="recent-"]:not([data-testid="recent-list"]):not([data-testid="recent-none"])').count();
check(items === 1, 'the saved design is listed under Recent', String(items));
check(await p.locator('.srecent img').count() === 1, 'with a picture of it');
await p.keyboard.press('Escape');

// ---- it survives a reload, and a click opens it (through the file chooser here: a download keeps no file to reopen)
await p.reload(); await p.getByTestId('file-menu').waitFor({ timeout: 30000 }); await settle(1000);
await p.getByTestId('home-button').click();
check(await p.locator('.srecent li').count() === 1, 'the list is still there after reloading the page');
const fc = p.waitForEvent('filechooser'); await p.locator('.srecent .srow').click();
await (await fc).setFiles({ name: fname, mimeType: 'application/octet-stream', buffer: bytes });
check(await until(async () => (await state()).bodies.length > 0), 'clicking it opens the design (it asks for the file when the browser kept no handle)');
check(!(await p.getByTestId('start-overlay').isVisible().catch(() => false)), 'and the Start page closes');

// ---- remove it from the list
await p.getByTestId('home-button').click();
await p.locator('.sforget').click(); await settle(500);
check(await p.getByTestId('recent-none').isVisible(), 'the x removes it from the list (the file is untouched)');
console.log(failed ? `== start: ${failed} FAILED` : '== start: all passed');
await b.close(); process.exit(failed ? 1 : 0);
