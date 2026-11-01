// The construction planes of a design as frames (where each one sits), worked out from the definitions the engine keeps, so the view can draw them.
// The engine itself is the truth for a sketch made on a plane; these frames are only for showing and picking the plane.
import type { Vec3 } from './Engine';

export interface PlaneFrame { origin: Vec3; xDir: Vec3; yDir: Vec3 }
export interface ConstructionPlane {
  name: string;
  /** offset, angle, midplane or other (a kind the view cannot place yet: it is still in the list and can still be sketched on). */
  kind: 'offset' | 'angle' | 'midplane' | 'other';
  suppressed: boolean;
  frame: PlaneFrame | null;
}

export const ORIGIN_FRAMES: Record<string, PlaneFrame> = {
  XY: { origin: [0, 0, 0], xDir: [1, 0, 0], yDir: [0, 1, 0] },
  XZ: { origin: [0, 0, 0], xDir: [1, 0, 0], yDir: [0, 0, -1] },
  YZ: { origin: [0, 0, 0], xDir: [0, 1, 0], yDir: [0, 0, 1] },
};

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
const vec = (v: unknown): Vec3 | null => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? (v as Vec3) : null);
export const normalOf = (f: PlaneFrame): Vec3 => unit(cross(f.xDir, f.yDir));

/** Turn `v` about the unit `axis` by `deg` degrees (right-hand rule). */
function rotate(v: Vec3, axis: Vec3, deg: number): Vec3 {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), k = unit(axis), kv = cross(k, v), kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}

/** A plane reference in a definition: an origin plane, an earlier construction plane, a face's plane, or a wrapper holding one of those. */
function refFrame(ref: any, known: Map<string, PlaneFrame>): PlaneFrame | null {
  if (!ref || typeof ref !== 'object') return null;
  if (ref.type === 'origin') return ORIGIN_FRAMES[String(ref.name)] ?? null;
  // an earlier plane is named by its name (SolidCraft up to 0.19) or by its feature number (0.29), which the caller keeps in `known` as `#<number>`
  if (ref.type === 'construction') return known.get(ref.name !== undefined ? String(ref.name) : `#${ref.feature}`) ?? null;
  if (ref.type === 'plane') return refFrame(ref.plane, known);
  if (ref.type === 'face' && ref.plane) { const o = vec(ref.plane.origin), x = vec(ref.plane.x_dir), y = vec(ref.plane.y_dir); return o && x && y ? { origin: o, xDir: x, yDir: y } : null; }
  return null;
}

/** Where the plane a `timeline.inspect` definition describes is, if the view can tell. */
export function planeFromDefinition(def: any, known: Map<string, PlaneFrame>): { kind: ConstructionPlane['kind']; frame: PlaneFrame | null } {
  const pl = def?.plane;
  if (!pl || typeof pl !== 'object') return { kind: 'other', frame: null };
  if (pl.type === 'offset') {
    const base = refFrame(pl.base, known), d = num(pl.distance);
    if (!base || d === null) return { kind: 'offset', frame: null };
    const n = normalOf(base);
    return { kind: 'offset', frame: { origin: [base.origin[0] + n[0] * d, base.origin[1] + n[1] * d, base.origin[2] + n[2] * d], xDir: base.xDir, yDir: base.yDir } };
  }
  if (pl.type === 'at_angle') {
    const base = refFrame(pl.base, known), a = num(pl.angle), axis = vec(pl.axis_dir), through = vec(pl.axis_origin);
    if (!base || a === null || !axis || !through) return { kind: 'angle', frame: null };
    const n = rotate(normalOf(base), axis, a), x = unit(axis);
    return { kind: 'angle', frame: { origin: through, xDir: x, yDir: unit(cross(n, x)) } };
  }
  if (pl.type === 'midplane') {
    const a = refFrame(pl.a, known), b = refFrame(pl.b, known);
    if (!a || !b || Math.abs(Math.abs(dot(normalOf(a), normalOf(b))) - 1) > 1e-6) return { kind: 'midplane', frame: null }; // planes that meet at an angle: bisecting, not placed here
    return { kind: 'midplane', frame: { origin: [(a.origin[0] + b.origin[0]) / 2, (a.origin[1] + b.origin[1]) / 2, (a.origin[2] + b.origin[2]) / 2], xDir: a.xDir, yDir: a.yDir } };
  }
  return { kind: 'other', frame: null };
}
