// Real-browser check of the Preferences dialog: "Show initial start options" decides whether Forge opens on the Start page, and the choices are remembered.
// Needs: a built app (npm run build) and a FRESH server with the engine:   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/prefs.mjs
import { chromium } from 'playwright';

const URL = process.env.FORGE_URL || 'http://127.0.0.1:8120/';
let failed = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failed++; });
const settle = (ms = 400) => p.waitForTimeout(ms);
await p.goto(URL);
await p.getByTestId('file-menu').waitFor({ timeout: 30000 }); await settle();
check(await p.getByTestId('start-overlay').isVisible(), 'Forge opens on the Start page by default');
check(await p.getByTestId('demo').isVisible() && await p.getByTestId('start-page').isVisible(), 'with New, Open, Recent and the sample on it');
await p.keyboard.press('Escape'); await settle();
check(!(await p.getByTestId('start-overlay').isVisible().catch(() => false)) && await p.getByTestId('btn-sketch').isEnabled(), 'Esc goes to the design');
await p.getByTestId('file-menu').click(); await p.getByText('Preferences…').click();
check(await p.getByTestId('prefs-dialog').isVisible() && await p.getByTestId('pref-show-start').isChecked(), 'File > Preferences… opens the dialog with the box ticked');
await p.getByTestId('pref-show-start').uncheck(); await settle();
await p.keyboard.press('Escape'); await settle();
check(!(await p.getByTestId('prefs-dialog').isVisible().catch(() => false)), 'Esc closes the dialog');
await p.reload(); await p.getByTestId('file-menu').waitFor({ timeout: 30000 }); await settle(1200);
check(!(await p.getByTestId('start-overlay').isVisible().catch(() => false)), 'with the box unticked Forge opens on the design');
await p.getByTestId('home-button').click();
check(await p.getByTestId('start-overlay').isVisible(), 'the Home button still opens the Start page');
await p.keyboard.press('Escape');
// the other choices stay put after a reload
await p.getByTestId('file-menu').click(); await p.getByText('Preferences…').click();
check(!(await p.getByTestId('pref-origin').isChecked()) && await p.getByTestId('pref-axes').isChecked(), 'the origin planes start hidden and the sketch axes shown');
await p.getByTestId('pref-origin').check(); await p.getByTestId('pref-axes').uncheck(); await p.getByTestId('pref-show-start').check(); await settle(); await p.keyboard.press('Escape');
await p.reload(); await p.getByTestId('file-menu').waitFor({ timeout: 30000 }); await settle(1200);
check(await p.getByTestId('start-overlay').isVisible(), 'ticking the box again brings the Start page back at launch');
await p.keyboard.press('Escape'); await p.getByTestId('file-menu').click(); await p.getByText('Preferences…').click();
check(await p.getByTestId('pref-origin').isChecked() && !(await p.getByTestId('pref-axes').isChecked()), 'the origin and axes choices are remembered');
console.log(failed ? `== prefs: ${failed} FAILED` : '== prefs: all passed');
await b.close(); process.exit(failed ? 1 : 0);
