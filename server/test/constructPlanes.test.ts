// Construction planes: where each one is worked out from its definition, checked against the real engine's own idea of the plane (skipped when it is not installed).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SolidCraftEngine } from '../src/engine/solidcraft';
import { normalOf, planeFromDefinition, type PlaneFrame } from '../src/engine/constructPlanes';

const root = resolve(__dirname, '..', '..');
const exe = process.platform === 'win32' ? 'solidcraft-cli.exe' : 'solidcraft-cli';
const bin = process.env.FORGE_ENGINE ?? join(root, 'data', 'engine', exe);
const near = (a: number[], b: number[], tol = 1e-6) => a.every((v, i) => Math.abs(v - b[i]!) < tol);

describe('planeFromDefinition', () => {
  it('offsets an origin plane along its normal', () => {
    const r = planeFromDefinition({ plane: { type: 'offset', base: { type: 'origin', name: 'XY' }, distance: '25' } }, new Map());
    expect(r.kind).toBe('offset'); expect(r.frame!.origin).toEqual([0, 0, 25]);
  });
  it('cannot place an offset that is a parameter expression, but still says what it is', () => {
    const r = planeFromDefinition({ plane: { type: 'offset', base: { type: 'origin', name: 'XY' }, distance: 'height / 2' } }, new Map());
    expect(r).toEqual({ kind: 'offset', frame: null });
  });
  it('builds on an earlier plane, a face and halfway between two', () => {
    const known = new Map<string, PlaneFrame>([['Up25', { origin: [0, 0, 25], xDir: [1, 0, 0], yDir: [0, 1, 0] }]]);
    expect(planeFromDefinition({ plane: { type: 'offset', base: { type: 'construction', name: 'Up25' }, distance: '5' } }, known).frame!.origin).toEqual([0, 0, 30]);
    expect(planeFromDefinition({ plane: { type: 'offset', base: { type: 'face', plane: { origin: [0, 0, 10], x_dir: [1, 0, 0], y_dir: [0, 1, 0] } }, distance: '5' } }, known).frame!.origin).toEqual([0, 0, 15]);
    const mid = planeFromDefinition({ plane: { type: 'midplane', a: { type: 'plane', plane: { type: 'origin', name: 'XY' } }, b: { type: 'plane', plane: { type: 'construction', name: 'Up25' } } } }, known);
    expect(mid.kind).toBe('midplane'); expect(mid.frame!.origin).toEqual([0, 0, 12.5]);
  });
  it('tilts a plane about an axis', () => {
    const r = planeFromDefinition({ plane: { type: 'at_angle', base: { type: 'origin', name: 'XY' }, axis_dir: [1, 0, 0], axis_origin: [0, 0, 0], angle: '90' } }, new Map());
    const n = normalOf(r.frame!); expect(Math.abs(n[2])).toBeLessThan(1e-9); expect(Math.abs(n[1])).toBeCloseTo(1, 9); // turned up on edge: now facing Y
  });
});

describe.skipIf(!existsSync(bin))('construction planes in the real engine', () => {
  const e = new SolidCraftEngine(bin, undefined, 'test');
  beforeAll(async () => {
    await e.start();
    await e.run([
      { command: 'solid.box', params: { length: 30, width: 20, height: 10, corner: [0, 0, 0], operation: 'new', body_name: 'Block' } },
      { command: 'construct.plane.offset', params: { base: 'XY', offset: 25, name: 'Up25' } },
      { command: 'construct.plane.at_angle', params: { base: 'XY', axis: 'X', angle: 30, name: 'Tilt30' } },
      { command: 'construct.plane.midplane', params: { a: 'XY', b: 'Up25', name: 'Mid' } },
    ]);
  }, 60_000);
  afterAll(() => e.stop());

  it('lists the planes with frames that match where the engine puts a sketch on them', async () => {
    const snap = await e.snapshot();
    expect(snap.planes.map((p) => `${p.name}:${p.kind}`)).toEqual(['Up25:offset', 'Tilt30:angle', 'Mid:midplane']);
    for (const p of snap.planes) {
      expect(p.frame, p.name).not.toBeNull();
      await e.run([{ command: 'sketch.create', params: { plane: p.name, name: `On${p.name}` } }, { command: 'sketch.finish', params: {} }]);
      const sk = (await e.snapshot()).sketches.find((k) => k.name === `On${p.name}`)!;
      const mine = normalOf(p.frame!), theirs = normalOf({ origin: sk.plane.origin, xDir: sk.plane.xDir, yDir: sk.plane.yDir });
      const sameLine = Math.abs(Math.abs(mine[0] * theirs[0] + mine[1] * theirs[1] + mine[2] * theirs[2]) - 1) < 1e-6; // the same plane facing either way
      const dist = (o: number[], n: number[]) => o[0]! * n[0]! + o[1]! * n[1]! + o[2]! * n[2]!;
      expect(sameLine, `${p.name} faces the same way`).toBe(true);
      expect(Math.abs(Math.abs(dist(p.frame!.origin, theirs)) - Math.abs(dist(sk.plane.origin, theirs))) < 1e-6, `${p.name} is the same distance from the origin`).toBe(true);
    }
  });

  it('leaves out planes beyond the rolled-back marker', async () => {
    await e.run([{ command: 'timeline.roll_to', params: { feature: 'Up25' } }]);
    const names = (await e.snapshot()).planes.map((p) => p.name);
    expect(names).toContain('Up25'); expect(names).not.toContain('Mid');
    await e.run([{ command: 'timeline.roll_to', params: {} }]);
  });
});
