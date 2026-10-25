// The drawing tools added after the first seven: 3-point rectangle, rounded rectangle, 3-point circle, centre-point arc, polygons, ellipse, point and spline.
import { describe, expect, it } from 'vitest';
import { drawOpts, isDraw, onClick, onTyped, polygonPoints, preview, roundedRadius, sizeBoxes, splineStep } from './tools';

describe('more drawing tools', () => {
  it('knows they are drawing tools', () => {
    for (const t of ['rect3', 'rectRound', 'circle3', 'arcC', 'polyIn', 'polyOut', 'polyEdge', 'ellipse', 'point', 'spline'] as const) expect(isDraw(t), t).toBe(true);
  });

  it('3-point rectangle: an edge, then a point on the far side', () => {
    let r = onClick('rect3', [], [0, 0]); r = onClick('rect3', r.pending, [10, 0]);
    expect(r.pending).toEqual([[0, 0], [10, 0]]);
    expect(onClick('rect3', r.pending, [5, 0]).message).toMatch(/away from the first edge/);
    expect(onClick('rect3', r.pending, [5, 6]).steps[0]).toEqual({ command: 'sketch.rectangle.three_point', params: { p0: [0, 0], p1: [10, 0], p2: [5, 6] } });
    const shape = preview('rect3', r.pending, [5, 6])[0]!;
    expect(shape).toHaveLength(5); expect(Math.max(...shape.map((q) => q[1]))).toBeCloseTo(6, 6);
    expect(sizeBoxes('rect3', r.pending, [5, 6])[0]).toMatchObject({ label: 'Width', value: 6 });
  });

  it('rounded rectangle: two corners and a radius of a fifth of the shorter side, or a typed one', () => {
    expect(roundedRadius([0, 0], [40, 30])).toBe(6);
    expect(onClick('rectRound', [[0, 0]], [40, 30]).steps[0]).toEqual({ command: 'sketch.rectangle.rounded', params: { p0: [0, 0], p1: [40, 30], radius: 6 } });
    expect(onTyped('rectRound', [[0, 0]], [1, 1], '40,30,4').steps[0]!.params).toEqual({ p0: [0, 0], p1: [40, 30], radius: 4 });
    expect(onTyped('rectRound', [[0, 0]], [1, 1], '40,30,15').message).toMatch(/less than half/);
    expect(preview('rectRound', [[0, 0]], [40, 30])[0]!.length).toBeGreaterThan(20);
  });

  it('3-point circle needs three points that are not in a line', () => {
    let r = onClick('circle3', [], [0, 0]); r = onClick('circle3', r.pending, [10, 0]);
    expect(onClick('circle3', r.pending, [20, 0]).message).toMatch(/one line/);
    expect(onClick('circle3', r.pending, [5, 5]).steps[0]).toEqual({ command: 'sketch.circle.three_point', params: { p0: [0, 0], p1: [10, 0], p2: [5, 5] } });
    expect(sizeBoxes('circle3', r.pending, [5, 5])).toEqual([]);
  });

  it('centre-point arc runs counter-clockwise from the start to the direction of the third click', () => {
    let r = onClick('arcC', [], [0, 0]); r = onClick('arcC', r.pending, [10, 0]);
    expect(onClick('arcC', r.pending, [0, 12]).steps[0]).toEqual({ command: 'sketch.arc.center_point', params: { center: [0, 0], start: [10, 0], end: [0, 12] } });
    const arc = preview('arcC', r.pending, [0, 5])[0]!;
    expect(arc[0]![0]).toBeCloseTo(10, 6); expect(arc[arc.length - 1]![1]).toBeCloseTo(10, 6); // ends on the circle, straight up
    const long = preview('arcC', r.pending, [0, -5])[0]!; expect(Math.min(...long.map((q) => q[1]))).toBeCloseTo(-10, 0); // below: the long way round
  });

  it('polygons use the number of sides in drawOpts', () => {
    drawOpts.sides = 5;
    expect(onClick('polyIn', [[0, 0]], [10, 0]).steps[0]).toEqual({ command: 'sketch.polygon.inscribed', params: { center: [0, 0], radius: 10, sides: 5, angle: 0 } });
    expect(onClick('polyOut', [[0, 0]], [0, 10]).steps[0]).toEqual({ command: 'sketch.polygon.circumscribed', params: { center: [0, 0], radius: 10, sides: 5, angle: 90 } });
    expect(onTyped('polyIn', [[0, 0]], [3, 4], '8').steps[0]!.params).toMatchObject({ radius: 8, sides: 5 });
    expect(onClick('polyEdge', [[0, 0]], [10, 0]).steps[0]).toEqual({ command: 'sketch.polygon.edge', params: { p0: [0, 0], p1: [10, 0], sides: 5 } });
    drawOpts.sides = 4;
    const sq = polygonPoints([0, 0], 10, 4, 0, false); expect(sq[0]![0]).toBeCloseTo(10, 6); expect(sq[1]![1]).toBeCloseTo(10, 6);
    const out = polygonPoints([0, 0], 10, 4, 0, true); expect(out[0]![0]).toBeCloseTo(10, 6); expect(out[0]![1]).toBeCloseTo(-10, 6); // corners at 45 degrees, the side facing +X
    const edge = preview('polyEdge', [[0, 0]], [10, 0])[0]!; expect(Math.max(...edge.map((q) => q[1]))).toBeCloseTo(10, 6); // stands above (to the left of) the way from 0,0 to 10,0
    drawOpts.sides = 6;
  });

  it('ellipse: centre, end of the long axis, a point on the short side', () => {
    let r = onClick('ellipse', [], [0, 0]); r = onClick('ellipse', r.pending, [10, 0]);
    expect(onClick('ellipse', r.pending, [5, 0]).message).toMatch(/away from the long axis/);
    expect(onClick('ellipse', r.pending, [0, 5]).steps[0]).toEqual({ command: 'sketch.ellipse', params: { center: [0, 0], major: [10, 0], minor: [0, 5] } });
    const e = preview('ellipse', r.pending, [0, 5])[0]!; expect(Math.max(...e.map((q) => q[0]))).toBeCloseTo(10, 6); expect(Math.max(...e.map((q) => q[1]))).toBeCloseTo(5, 6);
  });

  it('point is placed by one click, and a spline by several', () => {
    expect(onClick('point', [], [3, 4])).toEqual({ steps: [{ command: 'sketch.point', params: { point: [3, 4] } }], pending: [] });
    let r = onClick('spline', [], [0, 0]); r = onClick('spline', r.pending, [10, 10]); r = onClick('spline', r.pending, [20, 0]);
    expect(r.pending).toHaveLength(3); expect(r.steps).toEqual([]);
    expect(onClick('spline', r.pending, [20, 0]).pending).toHaveLength(3); // the same point again is ignored
    expect(onClick('spline', r.pending, [0, 0]).steps[0]).toEqual({ command: 'sketch.spline.fit_point', params: { points: [[0, 0], [10, 10], [20, 0]], periodic: true } }); // back on the first point closes it
    expect(splineStep([[0, 0]], false)).toBeNull();
    expect(splineStep(r.pending, false)).toEqual({ command: 'sketch.spline.fit_point', params: { points: r.pending } });
    expect(preview('spline', r.pending, [30, 5])[0]!.length).toBeGreaterThan(30);
  });
});
