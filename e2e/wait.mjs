// Wait until an async check run in the page comes out true. (page.waitForFunction with an async function returns at once, because a promise is always truthy.)
export async function waitAsync(p, fn, arg, opts = {}) {
  const until = Date.now() + (opts.timeout ?? 30000);
  for (;;) {
    const r = await p.evaluate(fn, arg);
    if (r) return r;
    if (Date.now() > until) throw new Error(`waitAsync: timed out after ${opts.timeout ?? 30000} ms: ${String(fn).slice(0, 160)}`);
    await p.waitForTimeout(150);
  }
}

/** The app is up: wait for the header, and put the Start page (shown when Forge opens) out of the way so the design can be worked on. */
export async function ready(p) {
  await p.getByTestId('file-menu').waitFor({ timeout: 30000 });
  await p.waitForTimeout(300);
  if (await p.getByTestId('start-overlay').isVisible().catch(() => false)) { await p.keyboard.press('Escape'); await p.getByTestId('start-overlay').waitFor({ state: 'hidden', timeout: 5000 }); }
}
