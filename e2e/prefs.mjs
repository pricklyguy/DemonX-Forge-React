// Real-browser check of the Preferences dialog: turning off "Show initial start options" removes the empty-design message and demo button, and it is remembered.
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
await p.getByTestId('demo').waitFor({ timeout: 30000 });
check(true, 'the start options show on an empty design by default');
await p.getByTestId('file-menu').click(); await p.getByText('Preferences…').click();
check(await p.getByTestId('prefs-dialog').isVisible() && await p.getByTestId('pref-show-start').isChecked(), 'File > Preferences… opens the dialog with the box ticked');
await p.getByTestId('pref-show-start').uncheck(); await settle();
check(await p.getByTestId('demo').count() === 0, 'unticking removes the message and the demo button');
await p.keyboard.press('Escape'); await settle();
check(!(await p.getByTestId('prefs-dialog').isVisible().catch(() => false)), 'Esc closes the dialog');
await p.reload(); await p.getByTestId('file-menu').waitFor({ timeout: 30000 }); await settle(1500);
check(await p.getByTestId('demo').count() === 0, 'it is still off after reloading the page');
await p.getByTestId('file-menu').click(); await p.getByText('Preferences…').click();
await p.getByTestId('pref-show-start').check(); await settle();
check(await p.getByTestId('demo').count() === 1, 'ticking it again brings the start options back');
console.log(failed ? `== prefs: ${failed} FAILED` : '== prefs: all passed');
await b.close(); process.exit(failed ? 1 : 0);
