// Exporting chosen bodies, renaming a body and opening a mesh in a slicer, through the real engine (skipped when it is not installed).
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SolidCraftEngine } from '../src/engine/solidcraft';
import { parse3mf } from '../src/engine/mesh3mf';
import { BadRequest, checkStep, isAllowedCommand } from '../src/commands';

const root = resolve(__dirname, '..', '..');
const exe = process.platform === 'win32' ? 'solidcraft-cli.exe' : 'solidcraft-cli';
const bin = process.env.FORGE_ENGINE ?? join(root, 'data', 'engine', exe);
const triangles = (stl: Uint8Array) => new DataView(stl.buffer, stl.byteOffset, stl.byteLength).getUint32(80, true);

describe('which commands the browser may send', () => {
  it('allows renaming a body but not the engine commands that touch files', () => {
    expect(isAllowedCommand('body.rename')).toBe(true);
    expect(isAllowedCommand('body.delete')).toBe(false);
    expect(isAllowedCommand('solid.torus')).toBe(true);
    for (const id of ['file.export', 'file.save_mesh', 'sketch.export_dxf', 'sketch.insert_dxf', 'sketch.insert_svg', 'parameters.import', 'timeline.export_script']) expect(isAllowedCommand(id), id).toBe(false);
  });
});

describe('Text and fonts', () => {
  it('lets the browser name an installed font but never hand over a file', () => {
    expect(checkStep({ command: 'sketch.text', params: { text: 'Hi', at: [0, 0], font: 'Arial', bold: true } }).command).toBe('sketch.text');
    expect(checkStep({ command: 'sketch.text', params: { text: 'Hi', at: [0, 0] } }).command).toBe('sketch.text'); // no font: the built-in one
    for (const font of ['/etc/fonts/x.ttf', 'C:\\Windows\\Fonts\\arial.ttf', '~/a.otf', '%WINDIR%/Fonts/a', 'arial.ttf', '..\\x']) expect(() => checkStep({ command: 'sketch.text', params: { text: 'Hi', at: [0, 0], font } }), font).toThrow(BadRequest);
    expect(() => checkStep({ command: 'sketch.edit_text', params: { link: 't1', edits: [{ link: 't1', font: '/x.ttf' }] } })).toThrow(BadRequest);
  });
});

describe.skipIf(process.platform === 'win32' || !existsSync(bin))('chosen bodies, rename and slicer (real engine)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-slicer-test-'));
  const log = join(dir, 'opened.txt');
  const oldPath = process.env.PATH;
  const e = new SolidCraftEngine(bin, undefined, 'test');
  beforeAll(async () => {
    writeFileSync(join(dir, 'prusa-slicer'), `#!/bin/sh\necho "$@" > "${log}"\n`); chmodSync(join(dir, 'prusa-slicer'), 0o755); // a stand-in slicer on the PATH the engine inherits
    process.env.PATH = `${dir}${delimiter}${oldPath}`;
    await e.start();
    await e.run([
      { command: 'solid.box', params: { length: 30, width: 20, height: 10, corner: [0, 0, 0], operation: 'new', body_name: 'Block' } },
      { command: 'solid.sphere', params: { diameter: 8, center: [50, 0, 4], operation: 'new', body_name: 'Ball' } },
    ]);
  }, 60_000);
  afterAll(async () => { process.env.PATH = oldPath; await e.stop(); });

  it('exports only the bodies asked for', async () => {
    const all = triangles(await e.exportBodies('stl')), block = triangles(await e.exportBodies('stl', ['Block'])), ball = triangles(await e.exportBodies('stl', ['Ball']));
    expect(block).toBe(12); // a box is 12 triangles
    expect(ball).toBeGreaterThan(12);
    expect(all).toBe(block + ball);
  });

  it('keeps each body as its own object in a 3MF, and can choose one', async () => {
    expect(parse3mf(await e.exportBodies('3mf')).length).toBe(2);
    expect(parse3mf(await e.exportBodies('3mf', ['Ball'])).length).toBe(1);
    expect((await e.exportBodies('step', ['Block'])).length).toBeGreaterThan(100);
  });

  it('renames a body and the new name is what exports and the browser see', async () => {
    await e.run([{ command: 'body.rename', params: { body: 'Ball', name: 'Marble' } }]);
    expect((await e.snapshot()).bodies.map((b) => b.name).sort()).toEqual(['Block', 'Marble']);
    expect(triangles(await e.exportBodies('stl', ['Marble']))).toBeGreaterThan(12);
    await expect(e.exportBodies('stl', ['Ball'])).rejects.toThrow();
  });

  it('lists the slicer and opens a saved mesh in it', async () => {
    const list = await e.listSlicers();
    expect(list.some((s) => s.id === 'prusa')).toBe(true);
    const r = await e.openInSlicer({ bodies: ['Block'], format: '3mf', slicer: 'prusa', name: 'Test part' });
    expect(r.file).toBe('Test part.3mf');
    for (let i = 0; i < 40 && !existsSync(log); i++) await new Promise((ok) => setTimeout(ok, 100));
    expect(readFileSync(log, 'utf8')).toContain('Test part.3mf');
  });
});
