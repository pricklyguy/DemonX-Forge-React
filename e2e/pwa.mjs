// Real-browser check that Forge can be installed as an app: the manifest and icons are served, the service worker registers, and the "Install Forge as an app" buttons appear only while the browser offers the install.
// Needs: a built app (npm run build) and a FRESH server with the engine:   FORGE_PORT=8120 npm start      (stop it afterwards by port: fuser -k 8120/tcp)
// Run: node e2e/pwa.mjs
// Not covered: the real install question of Chrome / Edge (headless Chromium never shows it), so that part is tried by hand.
import { chromium } from 'playwright';
import { ready } from './wait.mjs';

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

const mres = await p.evaluate(async () => { const r = await fetch('/manifest.webmanifest'); return { ok: r.ok, type: r.headers.get('content-type'), j: await r.json() }; });
check(mres.ok && /manifest\+json/.test(mres.type), 'the manifest is served with its own type', mres.type);
check(mres.j.display === 'standalone' && mres.j.start_url === '/' && mres.j.name === 'DemonX Forge', 'it asks for its own window and starts at the front page');
for (const ic of mres.j.icons) {
  const r = await p.evaluate(async (src) => { const x = await fetch(src); return { ok: x.ok, type: x.headers.get('content-type') }; }, ic.src);
  check(r.ok && r.type === 'image/png', `icon ${ic.sizes} is served`, JSON.stringify(r));
}
check(await p.evaluate(() => !!document.querySelector('link[rel=manifest]')), 'the page links the manifest');
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }).catch(() => false);
check(sw, 'the service worker is registered and active');
const swr = await p.evaluate(async () => { const r = await fetch('/sw.js'); return r.headers.get('cache-control'); });
check(swr === 'no-cache', 'the service worker is always fetched fresh', String(swr));

// before the browser offers anything there is no install button
await ready(p);
await p.getByTestId('home-button').click();
check(await p.getByTestId('install-app').count() === 0, 'no install button on the Start page until the browser offers one');
await p.keyboard.press('Escape'); await settle();
// the browser's offer arrives
await p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__asked = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await settle();
await p.getByTestId('file-menu').click();
check(await p.getByText('Install Forge as an app…').isVisible(), 'File shows "Install Forge as an app…" once the browser offers it');
await p.getByText('Install Forge as an app…').click(); await settle();
check(await p.evaluate(() => window.__asked === true), 'choosing it shows the browser\'s install question');
await p.getByTestId('file-menu').click();
check(await p.getByText('Install Forge as an app…').count() === 0, 'and the item goes away after one use');
await p.keyboard.press('Escape');
await p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
await p.getByTestId('home-button').click();
check(await p.getByTestId('install-app').isVisible(), 'the Start page has the button too');
await p.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await settle();
check(await p.getByTestId('install-app').count() === 0, 'it disappears once Forge is installed');
await b.close();
console.log(failed ? `== pwa: ${failed} FAILED` : '== pwa: all passed');
process.exit(failed ? 1 : 0);
