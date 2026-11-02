// The move / turn gizmo: where its parts sit on the screen, and what a drag of each part means. Pure functions (no browser, no Three.js), so they can be tested.
// Arrows go along the axes, a small square between two arrows drags in that plane, the centre dot drags freely in the view (or in the plane, for a sketch), and a ring round an axis turns about it.
import type { Vec3 } from '../../server/src/engine/Engine';

export type V2 = [number, number];
export type Phase = 'start' | 'move' | 'end';
export interface TriadAxis { dir: Vec3; color: string; label: string }
export interface TriadRing extends TriadAxis {
  /** Where the handle sits: a direction square to the axis, from the gizmo's centre, fixed in the object (it turns with the object). */
  anchor: Vec3;
}
export interface TriadSpec {
  origin: Vec3;
  /** The directions the arrows follow (unit vectors, at right angles to each other). */
  axes: TriadAxis[];
  /** The axes a ring turns about (a ring lies square to its axis). */
  rings?: TriadRing[];
  /** The move so far in mm along each axis (same order as `axes`), measured from where the drag began. */
  onMove(delta: number[], phase: Phase): void;
  /** The turn so far in degrees about `rings[ring]`, right-handed. */
  onTurn?(ring: number, degrees: number, phase: Phase): void;
  /** Snap size in mm (Shift: a tenth of it) and in degrees. */
  step?: number;
  angleStep?: number;
}

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len2 = (a: V2) => Math.hypot(a[0], a[1]);

/** Solve `a * ua + b * ub = d` for (a, b), or null when the two directions are (nearly) the same on the screen. */
export function solve2(ua: V2, ub: V2, d: V2): [number, number] | null {
  const det = ua[0] * ub[1] - ua[1] * ub[0];
  if (Math.abs(det) < 1e-6 * Math.max(1, len2(ua) * len2(ub))) return null;
  return [(d[0] * ub[1] - d[1] * ub[0]) / det, (ua[0] * d[1] - ua[1] * d[0]) / det];
}

/** An angle in degrees brought into -180 to 180. */
export const wrapDeg = (d: number) => { let r = d % 360; if (r > 180) r -= 360; if (r <= -180) r += 360; return r; };

/** The right-handed turn about an axis that moving the pointer from `m0` to `m` makes, round the screen point `c` (screen y points down). `facing` is the axis dotted with the direction to the camera: when the axis points at the viewer a counter-clockwise move on the screen is a positive turn. */
export function turnDegrees(c: V2, m0: V2, m: V2, facing: number): number {
  const a0 = Math.atan2(-(m0[1] - c[1]), m0[0] - c[0]), a1 = Math.atan2(-(m[1] - c[1]), m[0] - c[0]);
  return wrapDeg(((a1 - a0) * 180) / Math.PI) * (facing >= 0 ? 1 : -1);
}

/** How an arrow is drawn: its screen direction and length, or a dot when it points (almost) at the viewer or away from it. */
export function arrowShape(axisDir: Vec3, viewDir: Vec3, screenDir: V2, full: number): { dir: V2; length: number; endOn: 'toward' | 'away' | null } {
  const d = dot3(axisDir, viewDir), side = Math.sqrt(Math.max(0, 1 - d * d));
  const l = len2(screenDir) || 1;
  if (side < 0.2) return { dir: [screenDir[0] / l, screenDir[1] / l], length: 0, endOn: d < 0 ? 'toward' : 'away' }; // (viewDir points from the camera into the scene)
  return { dir: [screenDir[0] / l, screenDir[1] / l], length: full * Math.max(0.45, side), endOn: null };
}

export const snapTo = (v: number, step: number) => Math.round(v / step) * step;
