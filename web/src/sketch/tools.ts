// What a click (or a typed number) does for each sketch tool. Pure: the caller sends the steps to the engine.
import type { Vec2 } from '../api';
import type { Picked } from './pick';
import { round3 } from './snap';

export type DrawTool = 'line' | 'rect' | 'rectCenter' | 'circle' | 'circle2' | 'arc3' | 'slot' | 'rect3' | 'rectRound' | 'circle3' | 'arcC' | 'polyIn' | 'polyOut' | 'polyEdge' | 'ellipse' | 'point' | 'spline';
/** Settings the drawing tools read: how many sides the polygon tools make. */
export const drawOpts = { sides: 6 };
export type ConstraintTool = 'horizontal' | 'coincident' | 'parallel' | 'perpendicular' | 'tangent' | 'equal' | 'midpoint' | 'concentric' | 'fix';
export type PickTool = 'dimension' | 'trim' | 'extend' | 'offset' | 'fillet' | ConstraintTool;
export type Tool = DrawTool | PickTool;
export interface Step { command: string; params: Record<string, unknown> }
export interface Result { steps: Step[]; pending: Vec2[]; message?: string }

const DRAW: DrawTool[] = ['line', 'rect', 'rectCenter', 'circle', 'circle2', 'arc3', 'slot', 'rect3', 'rectRound', 'circle3', 'arcC', 'polyIn', 'polyOut', 'polyEdge', 'ellipse', 'point', 'spline'];
/** After press, drag and release these stay open (the first corner or centre is placed, the pointer still sets the size, a click or typed size finishes), as in Fusion. */
export const OPEN_ON_DRAG: readonly string[] = ['rect', 'rectCenter', 'circle', 'circle2'];
export const isDraw = (t: Tool | null): t is DrawTool => !!t && (DRAW as string[]).includes(t);
/** What the pointer can land on for a tool that picks existing geometry. */
export const PICK_MODE: Record<PickTool, 'curve' | 'point' | 'any'> = {
  dimension: 'any', trim: 'curve', extend: 'curve', offset: 'curve', fillet: 'point',
  horizontal: 'any', coincident: 'any', parallel: 'curve', perpendicular: 'curve', tangent: 'curve', equal: 'curve', midpoint: 'any', concentric: 'curve', fix: 'any',
};

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r3 = (p: Vec2): Vec2 => [round3(p[0]), round3(p[1])];
const EPS = 1e-6;
/** Distance from `p` to the infinite line through a and b. */
const lineDist = (a: Vec2, b: Vec2, p: Vec2) => { const l = dist(a, b); return l < EPS ? dist(a, p) : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / l; };

/** A click at `pt` while `pending` holds the points already placed by this tool. */
export function onClick(tool: DrawTool, pending: Vec2[], pt: Vec2): Result {
  const p = r3(pt);
  const a = pending[0], b = pending[1];
  switch (tool) {
    case 'line': {
      const last = pending[pending.length - 1];
      if (!last) return { steps: [], pending: [p] };
      if (dist(last, p) < EPS) return { steps: [], pending };
      // pending keeps every point of the chain; landing on the first one (after two segments) closes the shape and ends the tool
      const closes = pending.length >= 3 && dist(pending[0]!, p) < EPS;
      return { steps: [{ command: 'sketch.line', params: { points: [last, p] } }], pending: closes ? [] : [...pending, p] };
    }
    case 'rect':
      if (!a) return { steps: [], pending: [p] };
      if (Math.abs(a[0] - p[0]) < EPS || Math.abs(a[1] - p[1]) < EPS) return { steps: [], pending, message: 'A rectangle needs a width and a height' };
      return { steps: [{ command: 'sketch.rectangle.two_point', params: { p0: a, p1: p } }], pending: [] };
    case 'rectCenter':
      if (!a) return { steps: [], pending: [p] };
      if (Math.abs(a[0] - p[0]) < EPS || Math.abs(a[1] - p[1]) < EPS) return { steps: [], pending, message: 'A rectangle needs a width and a height' };
      return { steps: [{ command: 'sketch.rectangle.center', params: { center: a, corner: p } }], pending: [] };
    case 'circle': {
      if (!a) return { steps: [], pending: [p] };
      const r = dist(a, p);
      if (r < EPS) return { steps: [], pending, message: 'A circle needs a size' };
      return { steps: [{ command: 'sketch.circle.center', params: { center: a, diameter: round3(2 * r) } }], pending: [] };
    }
    case 'circle2':
      if (!a) return { steps: [], pending: [p] };
      if (dist(a, p) < EPS) return { steps: [], pending, message: 'A circle needs a size' };
      return { steps: [{ command: 'sketch.circle.two_point', params: { p0: a, p1: p } }], pending: [] };
    case 'arc3': // start, end, then a point the arc passes through
      if (!a) return { steps: [], pending: [p] };
      if (!b) return dist(a, p) < EPS ? { steps: [], pending } : { steps: [], pending: [a, p] };
      if (lineDist(a, b, p) < EPS) return { steps: [], pending, message: 'The third point must not lie on the line between the first two' };
      return { steps: [{ command: 'sketch.arc.three_point', params: { start: a, end: b, through: p } }], pending: [] };
    case 'slot': // the two end-circle centres, then a point that sets the width
      if (!a) return { steps: [], pending: [p] };
      if (!b) return dist(a, p) < EPS ? { steps: [], pending } : { steps: [], pending: [a, p] };
      if (lineDist(a, b, p) < EPS) return { steps: [], pending, message: 'Click away from the centre line to set the width' };
      return { steps: [{ command: 'sketch.slot.center_to_center', params: { p0: a, p1: b, width: round3(2 * lineDist(a, b, p)) } }], pending: [] };
    case 'rect3': // one edge (two clicks), then a point on the opposite edge
      if (!a) return { steps: [], pending: [p] };
      if (!b) return dist(a, p) < EPS ? { steps: [], pending } : { steps: [], pending: [a, p] };
      if (lineDist(a, b, p) < EPS) return { steps: [], pending, message: 'Click away from the first edge to set the width' };
      return { steps: [{ command: 'sketch.rectangle.three_point', params: { p0: a, p1: b, p2: p } }], pending: [] };
    case 'rectRound':
      if (!a) return { steps: [], pending: [p] };
      if (Math.abs(a[0] - p[0]) < EPS || Math.abs(a[1] - p[1]) < EPS) return { steps: [], pending, message: 'A rectangle needs a width and a height' };
      return { steps: [{ command: 'sketch.rectangle.rounded', params: { p0: a, p1: p, radius: roundedRadius(a, p) } }], pending: [] };
    case 'circle3':
      if (!a) return { steps: [], pending: [p] };
      if (!b) return dist(a, p) < EPS ? { steps: [], pending } : { steps: [], pending: [a, p] };
      if (!circleThrough(a, b, p)) return { steps: [], pending, message: 'The three points must not lie on one line' };
      return { steps: [{ command: 'sketch.circle.three_point', params: { p0: a, p1: b, p2: p } }], pending: [] };
    case 'arcC': // the centre, where the arc starts, then a point in the direction it ends (it runs counter-clockwise from the start)
      if (!a) return { steps: [], pending: [p] };
      if (!b) return dist(a, p) < EPS ? { steps: [], pending } : { steps: [], pending: [a, p] };
      if (dist(a, p) < EPS) return { steps: [], pending, message: 'Click away from the centre to set where the arc ends' };
      return { steps: [{ command: 'sketch.arc.center_point', params: { center: a, start: b, end: p } }], pending: [] };
    case 'polyIn': case 'polyOut': { // the centre, then the radius (to a corner, or to the middle of a side) and the way it turns
      if (!a) return { steps: [], pending: [p] };
      const r = dist(a, p); if (r < EPS) return { steps: [], pending, message: 'A polygon needs a size' };
      return { steps: [{ command: tool === 'polyIn' ? 'sketch.polygon.inscribed' : 'sketch.polygon.circumscribed', params: { center: a, radius: round3(r), sides: drawOpts.sides, angle: round3((Math.atan2(p[1] - a[1], p[0] - a[0]) * 180) / Math.PI) } }], pending: [] };
    }
    case 'polyEdge': // the polygon stands on the left of the way from the first click to the second
      if (!a) return { steps: [], pending: [p] };
      if (dist(a, p) < EPS) return { steps: [], pending, message: 'A polygon needs a size' };
      return { steps: [{ command: 'sketch.polygon.edge', params: { p0: a, p1: p, sides: drawOpts.sides } }], pending: [] };
    case 'ellipse': // the centre, the end of the long axis, then a point on the short side
      if (!a) return { steps: [], pending: [p] };
      if (!b) return dist(a, p) < EPS ? { steps: [], pending } : { steps: [], pending: [a, p] };
      if (lineDist(a, b, p) < EPS) return { steps: [], pending, message: 'Click away from the long axis to set the short one' };
      return { steps: [{ command: 'sketch.ellipse', params: { center: a, major: b, minor: p } }], pending: [] };
    case 'point': return { steps: [{ command: 'sketch.point', params: { point: p } }], pending: [] };
    case 'spline': { // a click adds a point; landing on the first one (after two more) closes the curve; Enter, right-click or Esc ends it open
      const last = pending[pending.length - 1];
      if (last && dist(last, p) < EPS) return { steps: [], pending };
      if (pending.length >= 3 && dist(pending[0]!, p) < EPS) return { steps: [splineStep(pending, true)!], pending: [] };
      return { steps: [], pending: [...pending, p] };
    }
  }
}

/** The corner radius a rounded rectangle gets when the radius has not been typed: a fifth of the shorter side. */
export const roundedRadius = (a: Vec2, p: Vec2) => round3(Math.max(0.1, Math.min(Math.abs(p[0] - a[0]), Math.abs(p[1] - a[1])) * 0.2));
/** The step for a spline through the clicked points, or null when there are not enough. */
export function splineStep(points: Vec2[], closed: boolean): Step | null {
  if (points.length < (closed ? 3 : 2)) return null;
  return { command: 'sketch.spline.fit_point', params: { points, ...(closed ? { periodic: true } : {}) } };
}

const nums = (text: string) => text.replace(/[x×;]/gi, ' ').replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).map(Number);

/** Numbers typed while a tool has its first point down: rectangle "40,30", circle "10" (diameter), line "25" or "25,45" (length, angle in degrees), slot width. The cursor only decides which way the shape goes. */
export function onTyped(tool: DrawTool, pending: Vec2[], cursor: Vec2, text: string): Result {
  const a = pending[0];
  const v = nums(text);
  if (!a || !v.length || v.some((x) => !Number.isFinite(x))) return { steps: [], pending, message: 'Type numbers, for example 40,30' };
  if (tool === 'rect' || tool === 'rectCenter') {
    const w = v[0]!, h = v.length > 1 ? v[1]! : v[0]!;
    if (!(w > 0) || !(h > 0)) return { steps: [], pending, message: 'Width and height must be above 0' };
    const sx = cursor[0] >= a[0] ? 1 : -1, sy = cursor[1] >= a[1] ? 1 : -1;
    if (tool === 'rect') return { steps: [{ command: 'sketch.rectangle.two_point', params: { p0: a, p1: r3([a[0] + sx * w, a[1] + sy * h]) } }], pending: [] };
    return { steps: [{ command: 'sketch.rectangle.center', params: { center: a, corner: r3([a[0] + sx * w / 2, a[1] + sy * h / 2]) } }], pending: [] }; // typed values are the full width and height
  }
  if (tool === 'circle') {
    if (!(v[0]! > 0)) return { steps: [], pending, message: 'The diameter must be above 0' };
    return { steps: [{ command: 'sketch.circle.center', params: { center: a, diameter: round3(v[0]!) } }], pending: [] };
  }
  if (tool === 'circle2') {
    if (!(v[0]! > 0)) return { steps: [], pending, message: 'The diameter must be above 0' };
    const ang = dist(a, cursor) < EPS ? 0 : Math.atan2(cursor[1] - a[1], cursor[0] - a[0]);
    return { steps: [{ command: 'sketch.circle.two_point', params: { p0: a, p1: r3([a[0] + v[0]! * Math.cos(ang), a[1] + v[0]! * Math.sin(ang)]) } }], pending: [] };
  }
  if (tool === 'line') {
    const from = pending[pending.length - 1]!;
    const len = v[0]!;
    if (!(len > 0)) return { steps: [], pending, message: 'The length must be above 0' };
    const ang = v.length > 1 ? (v[1]! * Math.PI) / 180 : Math.atan2(cursor[1] - from[1], cursor[0] - from[0]);
    const end = r3([from[0] + len * Math.cos(ang), from[1] + len * Math.sin(ang)]);
    return { steps: [{ command: 'sketch.line', params: { points: [from, end] } }], pending: [...pending, end] };
  }
  if (tool === 'rectRound') {
    const w = v[0]!, h = v.length > 1 ? v[1]! : v[0]!;
    if (!(w > 0) || !(h > 0)) return { steps: [], pending, message: 'Width and height must be above 0' };
    const sx = cursor[0] >= a[0] ? 1 : -1, sy = cursor[1] >= a[1] ? 1 : -1, c = r3([a[0] + sx * w, a[1] + sy * h]);
    const r = v.length > 2 ? v[2]! : roundedRadius(a, c);
    if (!(r > 0) || r >= Math.min(w, h) / 2) return { steps: [], pending, message: 'The corner radius must be above 0 and less than half the shorter side' };
    return { steps: [{ command: 'sketch.rectangle.rounded', params: { p0: a, p1: c, radius: r } }], pending: [] };
  }
  if (tool === 'polyIn' || tool === 'polyOut') {
    if (!(v[0]! > 0)) return { steps: [], pending, message: 'The radius must be above 0' };
    const ang = v.length > 1 ? v[1]! : (Math.atan2(cursor[1] - a[1], cursor[0] - a[0]) * 180) / Math.PI;
    return { steps: [{ command: tool === 'polyIn' ? 'sketch.polygon.inscribed' : 'sketch.polygon.circumscribed', params: { center: a, radius: round3(v[0]!), sides: drawOpts.sides, angle: round3(ang) } }], pending: [] };
  }
  if (tool === 'slot' && pending.length === 2) {
    if (!(v[0]! > 0)) return { steps: [], pending, message: 'The width must be above 0' };
    return { steps: [{ command: 'sketch.slot.center_to_center', params: { p0: pending[0], p1: pending[1], width: round3(v[0]!) } }], pending: [] };
  }
  return { steps: [], pending, message: 'Click to place this one' };
}

const ring = (c: Vec2, r: number, n = 64): Vec2[] => Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * Math.PI * 2; return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)] as Vec2; });
const arcPts = (c: Vec2, r: number, from: number, to: number, n = 24): Vec2[] => Array.from({ length: n + 1 }, (_, i) => { const t = from + ((to - from) * i) / n; return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)] as Vec2; });

/** The circle through three points, or null when they are in a line. */
export function circleThrough(a: Vec2, b: Vec2, c: Vec2): { center: Vec2; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] ** 2 + a[1] ** 2, b2 = b[0] ** 2 + b[1] ** 2, c2 = c[0] ** 2 + c[1] ** 2;
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { center: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) };
}

/** The outline to show while placing the next point: lists of points to join with lines. */
export function preview(tool: DrawTool, pending: Vec2[], cur: Vec2): Vec2[][] {
  const a = pending[0], b = pending[1];
  if (!a) return [];
  switch (tool) {
    case 'line': return [[pending[pending.length - 1]!, cur]];
    case 'rect': return [[a, [cur[0], a[1]], cur, [a[0], cur[1]], a]];
    case 'rectCenter': { const dx = Math.abs(cur[0] - a[0]), dy = Math.abs(cur[1] - a[1]); return [[[a[0] - dx, a[1] - dy], [a[0] + dx, a[1] - dy], [a[0] + dx, a[1] + dy], [a[0] - dx, a[1] + dy], [a[0] - dx, a[1] - dy]]]; }
    case 'circle': return [ring(a, dist(a, cur))];
    case 'circle2': return [ring([(a[0] + cur[0]) / 2, (a[1] + cur[1]) / 2], dist(a, cur) / 2)];
    case 'arc3': {
      if (!b) return [[a, cur]];
      const c = circleThrough(a, b, cur);
      if (!c) return [[a, b]];
      // the arc runs from a to b on the side of the pointer
      const ta = Math.atan2(a[1] - c.center[1], a[0] - c.center[0]), tb = Math.atan2(b[1] - c.center[1], b[0] - c.center[0]), tm = Math.atan2(cur[1] - c.center[1], cur[0] - c.center[0]);
      const ccw = (x: number, y: number) => ((y - x) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const throughCcw = ccw(ta, tm) < ccw(ta, tb);
      const pts = throughCcw ? arcPts(c.center, c.r, ta, ta + ccw(ta, tb), 40) : arcPts(c.center, c.r, ta, ta - ccw(tb, ta), 40);
      pts[0] = a; pts[pts.length - 1] = b; // end exactly on the clicked points
      return [pts];
    }
    case 'slot': {
      if (!b) return [[a, cur]];
      const w = lineDist(a, b, cur), len = dist(a, b);
      if (w < EPS || len < EPS) return [[a, b]];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
      const o = (p: Vec2, k: number): Vec2 => [p[0] + nx * w * k, p[1] + ny * w * k];
      return [[o(a, 1), o(b, 1)], [o(a, -1), o(b, -1)], arcPts(b, w, ang - Math.PI / 2, ang + Math.PI / 2, 16), arcPts(a, w, ang + Math.PI / 2, ang + (3 * Math.PI) / 2, 16)];
    }
    case 'rect3': {
      if (!b) return [[a, cur]];
      const w = lineDist(a, b, cur), n = sideOf(a, b, cur); if (w < EPS) return [[a, b]];
      const c: Vec2 = [b[0] + n[0] * w, b[1] + n[1] * w], d: Vec2 = [a[0] + n[0] * w, a[1] + n[1] * w];
      return [[a, b, c, d, a]];
    }
    case 'rectRound': {
      const x0 = Math.min(a[0], cur[0]), x1 = Math.max(a[0], cur[0]), y0 = Math.min(a[1], cur[1]), y1 = Math.max(a[1], cur[1]);
      const r = Math.min(roundedRadius(a, cur), (x1 - x0) / 2, (y1 - y0) / 2); if (!(r > 0)) return [[a, cur]];
      const q = Math.PI / 2;
      return [[...arcPts([x1 - r, y0 + r], r, -q, 0, 8), ...arcPts([x1 - r, y1 - r], r, 0, q, 8), ...arcPts([x0 + r, y1 - r], r, q, 2 * q, 8), ...arcPts([x0 + r, y0 + r], r, 2 * q, 3 * q, 8), [x1 - r, y0]]];
    }
    case 'circle3': {
      if (!b) return [[a, cur]];
      const c = circleThrough(a, b, cur);
      return c ? [ring(c.center, c.r), [a, b]] : [[a, b, cur]];
    }
    case 'arcC': {
      if (!b) return [[a, cur]];
      const r = dist(a, b), t0 = Math.atan2(b[1] - a[1], b[0] - a[0]), t1 = Math.atan2(cur[1] - a[1], cur[0] - a[0]);
      const sweep = (((t1 - t0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return [arcPts(a, r, t0, t0 + sweep, 48), [a, b], [a, [a[0] + r * Math.cos(t0 + sweep), a[1] + r * Math.sin(t0 + sweep)]]];
    }
    case 'polyIn': case 'polyOut': {
      const r = dist(a, cur); if (r < EPS) return [];
      const pts = polygonPoints(a, r, drawOpts.sides, Math.atan2(cur[1] - a[1], cur[0] - a[0]), tool === 'polyOut');
      return [[...pts, pts[0]!], [a, cur]];
    }
    case 'polyEdge': {
      if (dist(a, cur) < EPS) return [];
      const n = drawOpts.sides, pts: Vec2[] = [a, cur]; let dir = Math.atan2(cur[1] - a[1], cur[0] - a[0]); const len = dist(a, cur), turn = (Math.PI * 2) / n;
      for (let i = 2; i < n; i++) { dir += turn; const l = pts[pts.length - 1]!; pts.push([l[0] + len * Math.cos(dir), l[1] + len * Math.sin(dir)]); } // walks round, turning left, so the shape is on the left of a to cur
      return [[...pts, a]];
    }
    case 'ellipse': {
      if (!b) return [[a, cur]];
      const major = dist(a, b), minor = lineDist(a, b, cur); if (minor < EPS) return [[a, b]];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), ca = Math.cos(ang), sa = Math.sin(ang);
      return [Array.from({ length: 65 }, (_, i) => { const t = (i / 64) * Math.PI * 2, x = major * Math.cos(t), y = minor * Math.sin(t); return [a[0] + x * ca - y * sa, a[1] + x * sa + y * ca] as Vec2; }), [a, b]];
    }
    case 'point': return [];
    case 'spline': return [catmullRom([...pending, cur])];
  }
}

/** The corners of a regular polygon: the first corner at `angle` (inscribed) or the middle of a side there (circumscribed, where the radius reaches the sides). */
export function polygonPoints(c: Vec2, r: number, sides: number, angle: number, circumscribed: boolean): Vec2[] {
  const R = circumscribed ? r / Math.cos(Math.PI / sides) : r, a0 = circumscribed ? angle - Math.PI / sides : angle;
  return Array.from({ length: sides }, (_, i) => { const t = a0 + (i * Math.PI * 2) / sides; return [c[0] + R * Math.cos(t), c[1] + R * Math.sin(t)] as Vec2; });
}
/** A smooth curve through the points, for showing a spline being drawn (the engine fits the real one). */
function catmullRom(pts: Vec2[]): Vec2[] {
  if (pts.length < 3) return pts;
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j]! + (-p0[j]! + p2[j]!) * t + (2 * p0[j]! - 5 * p1[j]! + 4 * p2[j]! - p3[j]!) * t2 + (-p0[j]! + 3 * p1[j]! - 3 * p2[j]! + p3[j]!) * t3)) as Vec2);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Where a constraint tool is after the entities picked so far: ready with a step, still needing more picks, or refusing with a reason. */
export function constraintStep(tool: ConstraintTool, picks: Picked[]): { step?: Step; done: boolean; message?: string } {
  const [x, y] = picks;
  switch (tool) {
    case 'horizontal':
      if (!x) return { done: false };
      if (x.kind === 'curve') return x.type === 'line' ? { done: true, step: { command: 'sketch.constraint.horizontal_vertical', params: { line: x.id } } } : { done: true, message: 'Pick a line, or two points' };
      if (!y) return { done: false };
      return y.kind === 'point' ? { done: true, step: { command: 'sketch.constraint.horizontal_vertical', params: { points: [x.id, y.id] } } } : { done: true, message: 'Pick two points, or one line' };
    case 'coincident':
      if (!x || !y) return { done: false };
      return x.kind === 'curve' && y.kind === 'point' ? { done: true, step: { command: 'sketch.constraint.coincident', params: { a: y.id, b: x.id } } } : { done: true, step: { command: 'sketch.constraint.coincident', params: { a: x.id, b: y.id } } };
    case 'midpoint': {
      if (!x || !y) return { done: false };
      const pt = [x, y].find((q) => q.kind === 'point'), ln = [x, y].find((q) => q.kind === 'curve' && q.type === 'line');
      return pt && ln ? { done: true, step: { command: 'sketch.constraint.midpoint', params: { point: pt.id, line: ln.id } } } : { done: true, message: 'Pick a point and a line' };
    }
    case 'fix':
      return x ? { done: true, step: { command: 'sketch.constraint.fix', params: { entity: x.id } } } : { done: false };
    default: { // parallel, perpendicular, tangent, equal, concentric: two curves
      if (!x || !y) return { done: false };
      return { done: true, step: { command: `sketch.constraint.${tool}`, params: { a: x.id, b: y.id } } };
    }
  }
}

/** The dimension step for a clicked curve and the typed text. */
export function dimensionFor(curve: { id: string; type: string }, value: string): Step | null {
  const type = curve.type === 'line' ? 'length' : curve.type === 'circle' ? 'diameter' : curve.type === 'arc' ? 'radius' : null;
  if (!type) return null;
  const n = Number(value);
  return { command: 'sketch.dimension', params: { entities: [curve.id], type, value: value.trim() !== '' && Number.isFinite(n) ? n : value.trim() } };
}

export interface SizeBox { label: string; at: Vec2; value: number }

/** The unit normal of the line a-b on the side of c (to the left when c is on the line). */
function sideOf(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l, ny = dx / l;
  if ((c[0] - a[0]) * nx + (c[1] - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
}

/** The boxes on the shape being drawn for the stage it is at: each has a name, where it sits and the value the pointer gives it right now. Empty for a tool placed by clicking only. */
export function sizeBoxes(tool: Tool | null, pending: Vec2[], cursor: Vec2): SizeBox[] {
  if (!isDraw(tool)) return [];
  const a = pending[0], b = pending[1]; if (!a) return [];
  const dx = cursor[0] - a[0], dy = cursor[1] - a[1];
  const polar = (from: Vec2): SizeBox[] => [
    { label: 'Length', at: [(from[0] + cursor[0]) / 2, (from[1] + cursor[1]) / 2], value: Math.hypot(cursor[0] - from[0], cursor[1] - from[1]) },
    { label: 'Angle', at: [from[0], from[1]], value: (Math.atan2(cursor[1] - from[1], cursor[0] - from[0]) * 180) / Math.PI },
  ];
  switch (tool) {
    case 'rect': return [{ label: 'Width', at: [(a[0] + cursor[0]) / 2, a[1]], value: Math.abs(dx) }, { label: 'Height', at: [cursor[0], (a[1] + cursor[1]) / 2], value: Math.abs(dy) }];
    case 'rectCenter': return [{ label: 'Width', at: [a[0], a[1] - Math.abs(dy)], value: 2 * Math.abs(dx) }, { label: 'Height', at: [a[0] + Math.abs(dx), a[1]], value: 2 * Math.abs(dy) }];
    case 'circle': return [{ label: 'Diameter', at: [(a[0] + cursor[0]) / 2, (a[1] + cursor[1]) / 2], value: 2 * Math.hypot(dx, dy) }];
    case 'circle2': return [{ label: 'Diameter', at: [(a[0] + cursor[0]) / 2, (a[1] + cursor[1]) / 2], value: Math.hypot(dx, dy) }];
    case 'line': return polar(pending[pending.length - 1]!);
    case 'arc3': {
      if (!b) return polar(a);
      const c = circleThrough(a, b, cursor);
      return [{ label: 'Radius', at: cursor, value: c ? c.r : 0 }];
    }
    case 'slot': {
      if (!b) return polar(a);
      const w = lineDist(a, b, cursor), n = sideOf(a, b, cursor), m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return [{ label: 'Width', at: [m[0] + (n[0] * w) , m[1] + (n[1] * w)], value: 2 * w }];
    }
    case 'rectRound': return [{ label: 'Width', at: [(a[0] + cursor[0]) / 2, a[1]], value: Math.abs(dx) }, { label: 'Height', at: [cursor[0], (a[1] + cursor[1]) / 2], value: Math.abs(dy) }];
    case 'rect3': {
      if (!b) return polar(a);
      const w = lineDist(a, b, cursor), n = sideOf(a, b, cursor), m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return [{ label: 'Width', at: [m[0] + n[0] * w, m[1] + n[1] * w], value: w }];
    }
    case 'polyIn': case 'polyOut': return [{ label: 'Radius', at: [(a[0] + cursor[0]) / 2, (a[1] + cursor[1]) / 2], value: Math.hypot(dx, dy) }, { label: 'Angle', at: [a[0], a[1]], value: (Math.atan2(dy, dx) * 180) / Math.PI }];
    case 'polyEdge': return polar(a);
    case 'arcC': return b ? [] : [{ label: 'Radius', at: [(a[0] + cursor[0]) / 2, (a[1] + cursor[1]) / 2], value: Math.hypot(dx, dy) }, { label: 'Angle', at: [a[0], a[1]], value: (Math.atan2(dy, dx) * 180) / Math.PI }];
    case 'ellipse': return b ? [] : polar(a);
    default: return []; // circle3, point and spline are placed by clicking only
  }
}

/** What each box is called, for a tool at a stage. */
export const sizeFields = (tool: Tool | null, pendingCount = 1): string[] => sizeBoxes(tool, Array.from({ length: Math.max(1, pendingCount) }, (_, i) => [i, 0] as Vec2), [0.5, 1]).map((x) => x.label);

/** The sizes the shape has at `cursor`, in the order of the boxes (angle in degrees). */
export const liveSizes = (tool: DrawTool, pending: Vec2[], cursor: Vec2): number[] => sizeBoxes(tool, pending, cursor).map((x) => x.value);

/** The point the pointer would have to be at to give the typed sizes ('' keeps what the pointer gives). Which way the shape goes still follows the pointer. */
export function applyTyped(tool: DrawTool, pending: Vec2[], cursor: Vec2, typed: string[]): Vec2 {
  const a = pending[0]; if (!a) return cursor;
  const num = (i: number): number | null => { const s = (typed[i] ?? '').trim(); const n = Number(s); return s !== '' && Number.isFinite(n) ? n : null; };
  const pos = (i: number, live: number) => { const v = num(i); return v !== null && v > 0 ? v : live; };
  const live = liveSizes(tool, pending, cursor), b = pending[1];
  const sx = cursor[0] >= a[0] ? 1 : -1, sy = cursor[1] >= a[1] ? 1 : -1;
  const ang = Math.atan2(cursor[1] - a[1], cursor[0] - a[0]);
  const polarFrom = (f: Vec2): Vec2 => {
    const len = num(0), an = num(1);
    const L = len !== null && len > 0 ? len : live[0]!, A = an !== null ? (an * Math.PI) / 180 : Math.atan2(cursor[1] - f[1], cursor[0] - f[0]);
    return [f[0] + L * Math.cos(A), f[1] + L * Math.sin(A)];
  };
  switch (tool) {
    case 'rect': return [a[0] + sx * pos(0, live[0]!), a[1] + sy * pos(1, live[1]!)];
    case 'rectCenter': return [a[0] + (sx * pos(0, live[0]!)) / 2, a[1] + (sy * pos(1, live[1]!)) / 2];
    case 'circle': { const r = pos(0, live[0]!) / 2; return [a[0] + r * Math.cos(ang), a[1] + r * Math.sin(ang)]; }
    case 'circle2': { const r = pos(0, live[0]!); return [a[0] + r * Math.cos(ang), a[1] + r * Math.sin(ang)]; }
    case 'line': return polarFrom(pending[pending.length - 1]!);
    case 'arc3': {
      if (!b) return polarFrom(a);
      const R = num(0); if (R === null || !(R > 0)) return cursor;
      const half = dist(a, b) / 2; if (R < half - 1e-9 || half < EPS) return cursor; // a radius smaller than half the chord cannot reach
      const n = sideOf(a, b, cursor), m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.sqrt(Math.max(R * R - half * half, 0));
      const along = (cursor[0] - m[0]) * n[0] + (cursor[1] - m[1]) * n[1]; // past the middle of the circle: the long way round
      const h = along > R ? R + d : R - d;
      return [m[0] + n[0] * h, m[1] + n[1] * h];
    }
    case 'slot': {
      if (!b) return polarFrom(a);
      const w = num(0); if (w === null || !(w > 0)) return cursor;
      const n = sideOf(a, b, cursor), m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return [m[0] + (n[0] * w) / 2, m[1] + (n[1] * w) / 2];
    }
    case 'rectRound': return [a[0] + sx * pos(0, live[0]!), a[1] + sy * pos(1, live[1]!)];
    case 'rect3': {
      if (!b) return polarFrom(a);
      const w = num(0); if (w === null || !(w > 0)) return cursor;
      const n = sideOf(a, b, cursor), m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return [m[0] + n[0] * w, m[1] + n[1] * w];
    }
    case 'polyIn': case 'polyOut': case 'polyEdge': return polarFrom(a);
    case 'arcC': return b ? cursor : polarFrom(a);
    case 'ellipse': return b ? cursor : polarFrom(a);
    default: return cursor;
  }
}
