import { describe, expect, it } from 'vitest';
import { arrowShape, solve2, turnDegrees, wrapDeg } from './triad';

describe('the move and turn gizmo maths', () => {
  it('solves a drag in a plane from two arrow directions', () => {
    // one arrow points right, the other up and right (10 px per mm): a pointer move of (20, -10) is 1.5 mm along the first and 1 mm along the second
    const r = solve2([10, 0], [5, -10], [20, -10])!;
    expect(r[0]).toBeCloseTo(1.5, 9); expect(r[1]).toBeCloseTo(1, 9);
    expect(solve2([10, 0], [20, 0], [5, 5])).toBeNull(); // the same direction on the screen
  });
  it('wraps angles', () => { expect(wrapDeg(190)).toBeCloseTo(-170, 9); expect(wrapDeg(-190)).toBeCloseTo(170, 9); expect(wrapDeg(360)).toBeCloseTo(0, 9); });
  it('turns the right way round an axis that points at the viewer', () => {
    // from the right of the centre to above it is counter-clockwise on the screen: +90 about an axis towards the viewer, -90 for one pointing away
    expect(turnDegrees([100, 100], [150, 100], [100, 50], 1)).toBeCloseTo(90, 6);
    expect(turnDegrees([100, 100], [150, 100], [100, 50], -1)).toBeCloseTo(-90, 6);
  });
  it('draws an axis that points at the viewer as a dot', () => {
    expect(arrowShape([0, 0, 1], [0, 0, -1], [0, 0.01], 80).endOn).toBe('toward');
    expect(arrowShape([0, 0, 1], [0, 0, 1], [0, 0.01], 80).endOn).toBe('away');
    const a = arrowShape([1, 0, 0], [0, 1, 0], [1, 0], 80); expect(a.endOn).toBeNull(); expect(a.length).toBeCloseTo(80, 9);
  });
});
