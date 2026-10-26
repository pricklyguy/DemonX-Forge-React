import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** True when Forge is already running as an installed app (its own window, no address bar). */
export const isInstalled = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches; } catch { return false; }
};

/** Register the service worker (it is what lets the browser offer to install) and catch the browser's install offer. Call once at start. */
export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPromptEvent; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !import.meta.env.DEV) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/** `canInstall` is true while the browser is offering to install Forge; `install()` shows the browser's own install question. */
export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const l = () => tick((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return {
    canInstall: deferred !== null && !isInstalled(),
    async install() { const d = deferred; if (!d) return; deferred = null; notify(); await d.prompt(); await d.userChoice.catch(() => {}); },
  };
}
