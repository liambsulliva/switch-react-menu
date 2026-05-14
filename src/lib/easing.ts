/**
 * CSS-style cubic Bézier from (0,0) to (1,1) with control points (x1,y1), (x2,y2).
 * Maps linear time `u` in [0,1] to eased progress in [0,1] (clamped).
 * Good for ease-out: e.g. (0.22, 1, 0.36, 1) — quick start, soft landing.
 */
function bezierX(t: number, x1: number, x2: number): number {
  const o = 1 - t;
  return 3 * o * o * t * x1 + 3 * o * t * t * x2 + t * t * t;
}

function bezierY(t: number, y1: number, y2: number): number {
  const o = 1 - t;
  return 3 * o * o * t * y1 + 3 * o * t * t * y2 + t * t * t;
}

export function cubicBezierEased(
  u: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) * 0.5;
    if (bezierX(mid, x1, x2) < u) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) * 0.5;
  return Math.min(1, Math.max(0, bezierY(t, y1, y2)));
}

export function easeOutDetailEntrance(linearT: number): number {
  return cubicBezierEased(linearT, 0.22, 1, 0.36, 1);
}
