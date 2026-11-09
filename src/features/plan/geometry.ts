// SVG helpers for the day ring. 0° = top (midnight), angles grow clockwise.

export function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

/** Path of an arc on a circle of radius r from startAngle to endAngle (clockwise). Full circles are drawn in two halves. */
export function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const sweep = Math.max(0, Math.min(360, endAngle - startAngle));
  if (sweep <= 0) return '';
  const f = (n: number) => Math.round(n * 100) / 100;
  if (sweep >= 359.99) {
    const top = polar(cx, cy, r, startAngle);
    const bottom = polar(cx, cy, r, startAngle + 180);
    return `M ${f(top.x)} ${f(top.y)} A ${r} ${r} 0 1 1 ${f(bottom.x)} ${f(bottom.y)} A ${r} ${r} 0 1 1 ${f(top.x)} ${f(top.y)}`;
  }
  const s = polar(cx, cy, r, startAngle);
  const e = polar(cx, cy, r, startAngle + sweep);
  return `M ${f(s.x)} ${f(s.y)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${f(e.x)} ${f(e.y)}`;
}

/** Splits [start, end] at `at`: the part before (past) and the part after (future); either may be null. */
export function splitAt(start: number, end: number, at: number | null): { past: [number, number] | null; future: [number, number] | null } {
  if (at == null) return { past: null, future: [start, end] };
  if (at <= start) return { past: null, future: [start, end] };
  if (at >= end) return { past: [start, end], future: null };
  return { past: [start, at], future: [at, end] };
}

/** Angle (degrees, 0 = top, clockwise) of a point relative to the centre. */
export function angleOfPoint(cx: number, cy: number, x: number, y: number): number {
  return ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360;
}

/**
 * Which ring arc was tapped at (x, y)? The tap must be on the ring (radius r ± half the stroke plus
 * a little slack). Among overlapping arcs the shortest one wins. Returns the entry key or null.
 */
export function hitTestRing(
  arcs: { key: string; start_angle: number; end_angle: number }[],
  g: { cx: number; cy: number; r: number; width: number; x: number; y: number; slack?: number },
): string | null {
  const dist = Math.hypot(g.x - g.cx, g.y - g.cy);
  if (Math.abs(dist - g.r) > g.width / 2 + (g.slack ?? 8)) return null;
  const a = angleOfPoint(g.cx, g.cy, g.x, g.y);
  let best: { key: string; span: number } | null = null;
  for (const arc of arcs) {
    if (a < arc.start_angle || a > arc.end_angle) continue;
    const span = arc.end_angle - arc.start_angle;
    if (!best || span < best.span) best = { key: arc.key, span };
  }
  return best?.key ?? null;
}
