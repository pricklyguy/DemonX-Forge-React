// DemonX Forge service worker. It only makes the app installable. It caches nothing: the design lives in the local server and the engine, so a cached page could show an old design or an old version of the app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
