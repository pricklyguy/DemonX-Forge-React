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
