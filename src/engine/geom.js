import { PITCH } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// Distance d'un point P au segment AB, et paramètre de projection s dans [0, 1].
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let s = len2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  s = clamp(s, 0, 1);
  const cx = ax + s * dx, cy = ay + s * dy;
  return { d: Math.hypot(px - cx, py - cy), s };
}

// Angle sous lequel le but adverse est vu depuis (x, y), en radians.
export function goalAngle(x, y, goalX) {
  const a1 = Math.atan2(PITCH.goalY1 - y, goalX - x);
  const a2 = Math.atan2(PITCH.goalY2 - y, goalX - x);
  let a = Math.abs(a1 - a2);
  if (a > Math.PI) a = 2 * Math.PI - a;
  return a;
}

export function inPitch(x, y, margin = 0) {
  return x >= margin && x <= PITCH.length - margin && y >= margin && y <= PITCH.width - margin;
}

// Le point (x, y) est-il dans la surface de réparation du but situé en goalX ?
export function inBox(x, y, goalX) {
  const dx = Math.abs(x - goalX);
  return dx <= PITCH.boxDepth && Math.abs(y - PITCH.width / 2) <= PITCH.boxWidth / 2;
}
