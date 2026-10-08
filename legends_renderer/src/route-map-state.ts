/** Measured on WTC 13:51.5 (E43), 1080p, at the final camera (full journey in view; sizes scale with the map zoom).
 * The route is a quadratic curve whose control point sits 22.6% of the chord off its midpoint, to the right of travel
 * (south for an eastward route). It draws on the measured curve below; the destination dot pops when 80% is drawn. */
export const routeMapSpec = {
  bulge: 0.226, line: 7, dot: 12, tip: 10, endDotAt: 0.8, pop: 0.15,
  tag: {size: 23, weight: 400, padX: 27, height: 51, drop: 10.5, radius: 6},
  // [seconds, fraction of the route drawn]
  draw: [[0, 0], [0.717, 0.125], [1.517, 0.259], [2.317, 0.379], [3.117, 0.488], [3.917, 0.586], [4.717, 0.674], [5.517, 0.752],
    [6.317, 0.819], [7.117, 0.877], [8.117, 0.93], [8.917, 0.967], [9.45, 0.99], [9.783, 1]] as const,
} as const;

export const routeDrawn = (t: number) => {
  const d = routeMapSpec.draw;
  if (t <= 0) return 0;
  for (let i = 1; i < d.length; i++) if (t <= d[i][0]) return d[i - 1][1] + ((d[i][1] - d[i - 1][1]) * (t - d[i - 1][0])) / (d[i][0] - d[i - 1][0]);
  return 1;
};

type Pt = readonly [number, number];
/** The route on screen: start, control point and the point at fraction `u` of its length (sampled). */
export const routeCurve = (a: Pt, b: Pt) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const c: Pt = [mx - (dy / len) * routeMapSpec.bulge * len, my + (dx / len) * routeMapSpec.bulge * len];
  const at = (t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const samples = Array.from({length: 129}, (_, i) => at(i / 128));
  const lengths = samples.map((p, i) => (i ? Math.hypot(p[0] - samples[i - 1][0], p[1] - samples[i - 1][1]) : 0));
  const total = lengths.reduce((s, x) => s + x, 0);
  return {d: `M ${a[0]} ${a[1]} Q ${c[0]} ${c[1]} ${b[0]} ${b[1]}`, total,
    pointAt: (u: number): Pt => {
      let left = u * total, i = 1;
      while (i < 128 && left > lengths[i]) left -= lengths[i++];
      const p = samples[i - 1], q = samples[i], f = lengths[i] ? left / lengths[i] : 0;
      return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    }};
};
