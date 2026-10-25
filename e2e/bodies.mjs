// Real-browser check of working with whole bodies: select (browser row, Ctrl+click, double-click in the view), rename (double-click, F2, right-click), hide / isolate,
// the Torus tool, and the Export dialog (chosen bodies, one STL per body in a zip, 3MF) and Open in slicer (only when a slicer is installed: to try it, start the
// server with a stand-in `prusa-slicer` script first on the PATH).
// Needs: the engine (FORGE_ENGINE or data/engine/), a built app (npm run build), and a FRESH server:
//   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/bodies.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
await p.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; }); // downloads, not the native Save window
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 600) => p.waitForTimeout(ms);
const state = () => p.evaluate(async () => (await fetch('/api/state')).json());
const names = async () => (await state()).bodies.map((q) => q.name).sort();
const proj = (w) => p.evaluate((w) => window.__forge.project(w), w);
const batch = (steps) => p.evaluate(async (steps) => (await fetch('/api/batch', { method: 'POST', body: JSON.stringify({ steps }) })).ok, steps);
const row = (n) => p.getByTestId(`node-body-${n}`);
const waitNames = async (want) => { for (let i = 0; i < 60; i++) { if (JSON.stringify(await names()) === JSON.stringify(want)) return true; await settle(250); } return false; };
const selected = () => p.locator('[data-testid^="node-body-"][aria-selected="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').replace('node-body-', '')).sort());

await p.goto(URL);
await p.getByTestId('demo').waitFor({ timeout: 30000 });
await batch([
  { command: 'solid.box', params: { length: 30, width: 20, height: 10, corner: [0, 0, 0], operation: 'new', body_name: 'Block' } },
  { command: 'solid.cylinder', params: { diameter: 8, height: 12, base: [60, 10, 0], axis: 'Z', operation: 'new', body_name: 'Peg' } },
]);
await row('Block').waitFor({ timeout: 20000 }); await row('Peg').waitFor({ timeout: 20000 });
await p.getByText(/changed by another program/).waitFor({ timeout: 20000 }); await settle(2500); // the app notices a change made from outside, as an AI client would

// ---- the Torus tool makes a third body
await p.getByTestId('btn-torus').click(); await settle();
check(await p.getByLabel('torus operation', { exact: true }).inputValue() === 'new', 'a torus starts as a new body');
await p.getByLabel('torus major radius', { exact: true }).fill('12'); await p.getByLabel('torus minor radius', { exact: true }).fill('3');
await p.getByLabel('torus centre x', { exact: true }).fill('100'); await p.getByLabel('torus centre z', { exact: true }).fill('3');
await p.getByLabel('torus body name', { exact: true }).fill('Ring'); await settle(800);
await p.getByRole('button', { name: 'OK' }).click(); await p.getByTestId('modify-dialog').waitFor({ state: 'hidden', timeout: 20000 }); await settle(600);
check(await waitNames(['Block', 'Peg', 'Ring']), 'Torus makes a body named Ring', (await names()).join());

// ---- selecting bodies
await row('Peg').click(); await settle(300);
check(JSON.stringify(await selected()) === '["Peg"]', 'a click on a body row selects it');
await row('Ring').click({ modifiers: ['Control'] }); await settle(300);
check(JSON.stringify(await selected()) === '["Peg","Ring"]', 'Ctrl + click adds a second body');
await p.keyboard.press('Escape'); await settle(300);
check((await selected()).length === 0, 'Esc clears the selection');
await p.locator('[data-face=top]').click(); await settle(800);
const [bx, by] = await proj([15, 10, 10]); await p.mouse.move(bx, by); await p.mouse.dblclick(bx, by); await settle(500);
check(JSON.stringify(await selected()) === '["Block"]', 'a double-click on a body in the view selects the whole body', JSON.stringify(await selected()));

// ---- renaming: double-click, F2, right-click
await row('Block').dblclick(); await p.getByTestId('rename-box').fill('Base'); await p.keyboard.press('Enter');
check(await waitNames(['Base', 'Peg', 'Ring']), 'double-click then Enter renames Block to Base', (await names()).join());
await row('Base').click(); await settle(200); await p.keyboard.press('F2'); await p.getByTestId('rename-box').fill('Tray'); await p.keyboard.press('Enter');
check(await waitNames(['Peg', 'Ring', 'Tray']), 'F2 renames the selected body', (await names()).join());
await row('Tray').click({ button: 'right' }); await p.getByText('Rename   F2').click(); await p.getByTestId('rename-box').fill('Peg'); await p.keyboard.press('Enter'); await settle(800);
check((await names()).join() === 'Peg,Ring,Tray' && /exist|already|use/i.test((await p.getByTestId('error').innerText().catch(() => '')) || 'x') || (await names()).join() === 'Peg,Ring,Tray', 'a name that is already taken is refused and nothing changes');
await p.keyboard.press('Escape');
await row('Tray').click({ button: 'right' }); await p.getByText('Isolate', { exact: true }).click(); await settle(500);
const hidden = await p.locator('[data-testid^="node-body-"] .beye[aria-label^="Show"]').count();
check(hidden === 2, 'Isolate hides the others', String(hidden));
await row('Tray').click({ button: 'right' }); await p.getByText('Show all', { exact: true }).click(); await settle(300);
check(await p.locator('[data-testid^="node-body-"] .beye[aria-label^="Show"]').count() === 0, 'Show all brings them back');

// ---- Export: the chosen bodies as one STL per body, and as one 3MF
await p.getByTestId('btn-export').click(); await p.getByTestId('export-dialog').waitFor({ timeout: 10000 });
await p.getByRole('button', { name: 'All' }).click(); await p.getByLabel('Export Ring', { exact: true }).uncheck();
await p.getByLabel('Export file type', { exact: true }).selectOption('stl');
await p.getByLabel('One file per body', { exact: true }).check();
let dl = p.waitForEvent('download'); await p.getByTestId('export-ok').click(); let d = await dl;
const zip = unzipSync(new Uint8Array(readFileSync(await d.path())));
const files = Object.keys(zip).sort();
check(d.suggestedFilename().endsWith('.zip') && files.length === 2 && files.every((f) => f.endsWith('.stl')), 'one file per body gives a zip of two STL files', files.join(' | '));
check(files.some((f) => f.includes('Peg')) && files.some((f) => f.includes('Tray')) && !files.some((f) => f.includes('Ring')), 'named after the bodies, and without the one that was unticked');
const tri = (u) => new DataView(u.buffer, u.byteOffset).getUint32(80, true);
check(Object.entries(zip).some(([f, u]) => f.includes('Tray') && tri(u) === 12), 'the box is 12 triangles on its own');
await p.getByTestId('export-dialog').waitFor({ state: 'hidden', timeout: 10000 });

await row('Ring').click(); await p.getByTestId('btn-export').click(); await p.getByTestId('export-dialog').waitFor();
check(JSON.stringify(await p.locator('[aria-label^="Export "][type=checkbox]:checked').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Export ', '')))) === '["Ring"]', 'the dialog starts with the selected body ticked');
await p.getByLabel('Export Ring', { exact: true }).uncheck();
check(await p.getByTestId('export-ok').isDisabled(), 'Export is greyed out with no body chosen');
await p.getByRole('button', { name: 'All' }).click();
dl = p.waitForEvent('download'); await p.getByTestId('export-ok').click(); d = await dl;
check(d.suggestedFilename().endsWith('.3mf'), '3MF is the default file type', d.suggestedFilename());
await p.getByTestId('export-dialog').waitFor({ state: 'hidden', timeout: 10000 });

// ---- Open in slicer (only with a slicer installed)
await p.getByTestId('btn-slicer-mesh').count() ? 0 : await p.getByTestId('tab-mesh').click();
await p.getByTestId('tab-mesh').click(); await settle(300);
await p.getByTestId('btn-slicer-mesh').click(); await p.getByTestId('export-dialog').waitFor();
await settle(800);
const slicerCount = await p.getByLabel('Slicer', { exact: true }).locator('option').count();
if (slicerCount) {
  await p.getByTestId('export-ok').click();
  const said = await p.getByTestId('notice').filter({ hasText: /Opened .* in / }).first().innerText({ timeout: 20000 }).catch(() => '');
  check(/Opened .* in /.test(said), 'Open in slicer reports the file and the slicer', said);
} else { console.log('skip  Open in slicer (no slicer installed on this computer)'); await p.getByRole('button', { name: 'Cancel' }).click(); }
console.log(failed ? `== bodies: ${failed} FAILED` : '== bodies: all passed');
await b.close(); process.exit(failed ? 1 : 0);
