// The matrix of a Move as the engine does it, for the live preview in the view: turn about the body's own middle, then move. Column-major, as Three.js wants it.
import type { Vec3 } from '../../server/src/engine/Engine';

/** `centre` is the pivot of the turn, `shift` the move, `axis` a unit vector (or null for no turn) and `deg` the right-handed turn about it. */
export function moveMatrix(centre: Vec3, shift: Vec3, axis: Vec3 | null, deg: number): number[] {
  let r = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // row-major 3x3
  if (axis && deg) {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), k = 1 - c, [x, y, z] = axis;
    r = [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  }
  const rc = [0, 1, 2].map((i) => r[i * 3]! * centre[0] + r[i * 3 + 1]! * centre[1] + r[i * 3 + 2]! * centre[2]);
  const t = [0, 1, 2].map((i) => centre[i]! + shift[i]! - rc[i]!); // p' = R (p - c) + c + s
  return [r[0]!, r[3]!, r[6]!, 0, r[1]!, r[4]!, r[7]!, 0, r[2]!, r[5]!, r[8]!, 0, t[0]!, t[1]!, t[2]!, 1];
}
