import {linearFade} from './chart-frame-state.ts';
import {progress} from './motion.ts';
/** Measured on TVA 32:27.8 (E39), 1080p. Slices meet at a fixed point (960, 540) and are cut by straight rays from it, starting
 * at 12 o'clock and running clockwise; each sweeps open on cubic-bezier(0.25, 1, 0.2, 1) over 1.9 s, 0.1 s after the previous
 * one. The outline is an ellipse that is not centred on that point: it starts round (rx 299.5, top 241, bottom 848) and its top
 * eases down to 268 while the slices open; from 2.5 s the outline and the label grow 10% about (959.5, 513) while the meeting
 * point stays put. Caption Montserrat 350 slanted 8 degrees (their italic), fixed below; the label is left-aligned and rides 57 px above the outline's top. */
export const sharePieSpec = {
  vertex: {x: 960, y: 540}, cx: 959.5, rx: 299.5, bottom: 848, top: {from: 241, to: 268, start: 0.15, seconds: 1.9, curve: [0.25, 0, 0.45, 1] as const},
  grow: {by: 0.1, x: 959.5, y: 513, start: 2.5, seconds: 2.3, curve: [0.3, 0.5, 0.25, 1] as const},
  sweep: {start: 0.008, every: 0.1, seconds: 1.9, curve: [0.25, 1, 0.2, 1] as const}, separator: 1.5,
  caption: {size: 102.2, weight: 350, slant: 8, x: 965.5, capTop: 946.5, fade: [0.517, 0.92] as const},
  label: {size: 46.8, weight: 300, tracking: 0.065, left: 897, aboveTop: 57, fade: [1.0, 0.8] as const},
} as const;

/** Final [start, end] angles in degrees (0 = 12 o'clock, clockwise). */
export const pieAngles = (shares: readonly number[]) => {
  const total = shares.reduce((a, b) => a + b, 0);
  let at = 0;
  return shares.map((v) => {const a = at; at += (v / total) * 360; return [a, at] as const;});
};

export const sharePieState = (t: number, shares: readonly number[]) => {
  const k = sharePieSpec, top = k.top.from + (k.top.to - k.top.from) * progress(t, k.top.start, k.top.start + k.top.seconds, k.top.curve);
  const sw = k.sweep, g = 1 + k.grow.by * progress(t, k.grow.start, k.grow.start + k.grow.seconds, k.grow.curve);
  // The outline grows about (grow.x, grow.y); the meeting point does not move.
  const ellipse = {cx: k.grow.x + (k.cx - k.grow.x) * g, cy: k.grow.y + ((top + k.bottom) / 2 - k.grow.y) * g, rx: k.rx * g, ry: ((k.bottom - top) / 2) * g};
  return {ellipse, grow: g, top,
    slices: pieAngles(shares).map(([a, b], i) => [a, a + (b - a) * progress(t, sw.start + i * sw.every, sw.start + i * sw.every + sw.seconds, sw.curve)] as const),
    caption: linearFade(t, ...k.caption.fade), label: linearFade(t, ...k.label.fade)};
};

type Ellipse = Readonly<{cx: number; cy: number; rx: number; ry: number}>;
/** Where the ray from the meeting point at angle d (0 = up, clockwise) leaves the ellipse. */
const exit = (e: Ellipse, d: number) => {
  const {x: vx, y: vy} = sharePieSpec.vertex, dx = Math.sin((d * Math.PI) / 180), dy = -Math.cos((d * Math.PI) / 180);
  const px = (vx - e.cx) / e.rx, py = (vy - e.cy) / e.ry, qx = dx / e.rx, qy = dy / e.ry;
  const a = qx * qx + qy * qy, b = 2 * (px * qx + py * qy), c = px * px + py * py - 1, s = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return {x: vx + dx * s, y: vy + dy * s};
};
/** SVG path of one slice: meeting point, ray out, clockwise along the ellipse, back. */
export const slicePath = (e: Ellipse, a: number, b: number) => {
  const {x: vx, y: vy} = sharePieSpec.vertex, p = exit(e, a), q = exit(e, b);
  const ang = (pt: {x: number; y: number}) => Math.atan2((pt.x - e.cx) / e.rx, -(pt.y - e.cy) / e.ry);
  let span = ang(q) - ang(p);
  while (span < 0) span += 2 * Math.PI;
  if (b - a >= 359.999) return `M ${e.cx} ${e.cy - e.ry} A ${e.rx} ${e.ry} 0 1 1 ${e.cx} ${e.cy + e.ry} A ${e.rx} ${e.ry} 0 1 1 ${e.cx} ${e.cy - e.ry} Z`;
  return `M ${vx} ${vy} L ${p.x} ${p.y} A ${e.rx} ${e.ry} 0 ${span > Math.PI ? 1 : 0} 1 ${q.x} ${q.y} Z`;
};
export const sliceEdge = (e: Ellipse, d: number) => exit(e, d);
