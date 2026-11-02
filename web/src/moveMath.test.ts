import { describe, expect, it } from 'vitest';
import { moveMatrix } from './moveMath';

const apply = (m: number[], p: [number, number, number]) => [0, 1, 2].map((i) => m[i]! * p[0] + m[4 + i]! * p[1] + m[8 + i]! * p[2] + m[12 + i]!);

describe('the Move preview matrix', () => {
  it('moves by the shift when there is no turn', () => { expect(apply(moveMatrix([20, 15, 5], [10, -3, 2], null, 0), [1, 2, 3])).toEqual([11, -1, 5]); });
  it('turns about the middle: the middle stays where it is', () => {
    const m = moveMatrix([20, 15, 5], [0, 0, 0], [0, 0, 1], 90);
    const c = apply(m, [20, 15, 5]); expect(c[0]).toBeCloseTo(20, 9); expect(c[1]).toBeCloseTo(15, 9); expect(c[2]).toBeCloseTo(5, 9);
    const p = apply(m, [40, 15, 5]); expect(p[0]).toBeCloseTo(20, 9); expect(p[1]).toBeCloseTo(35, 9); // 20 to the right of the middle goes 20 up
  });
  it('turns, then moves', () => { const p = apply(moveMatrix([0, 0, 0], [100, 0, 0], [0, 0, 1], 90), [40, 0, 0]); expect(p[0]).toBeCloseTo(100, 9); expect(p[1]).toBeCloseTo(40, 9); });
});
