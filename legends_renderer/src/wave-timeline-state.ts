import {progress} from './motion.ts';
/** Measured on Diesel 02:31.1 (E40), 1080p, in "world" units = the frame at camera scale 1 (1.0 s into the hold).
 * Nodes: start, four milestones (peak, dip, peak, dip), end; each gap is an S-curve with horizontal handles at 0.45 of the gap.
 * The line (14.5 px, soft glow) draws along its length on the measured curve below (slow start, fast middle, long tail).
 * Circles (r 39, #FDD600) pop on their own beat; labels fade in 0.17 s apart. The camera pans left with the drawing,
 * then from 2.83 s zooms out to 75% while still drifting left; the right title fades in during the zoom. */
export const waveTimelineSpec = {
  nodes: [[332.6, 540], [503.4, 339.7], [659.9, 789.5], [871.3, 389.6], [1092.2, 714.3], [1258.5, 540]] as const, handle: 0.45,
  line: 14.5, circle: 39, number: {size: 30, weight: 800},
  label: {size: 47.3, weight: 800, pitch: 58, gapAbove: 13.7, gapBelow: 14.3, startDrop: 50, endRise: 52},
  title: {size: 117.4, weight: 800, pitch: 145, capTop: 426.5, leftRight: 226.6, rightLeft: 1391.4},
  // [seconds, fraction of the line drawn]
  draw: [[0.617, 0], [0.733, 0.006], [0.8, 0.012], [0.867, 0.044], [0.933, 0.098], [1, 0.164], [1.067, 0.238], [1.133, 0.31], [1.2, 0.388],
    [1.267, 0.455], [1.333, 0.521], [1.4, 0.58], [1.467, 0.636], [1.533, 0.681], [1.6, 0.723], [1.667, 0.764], [1.7, 0.782], [1.8, 0.873],
    [1.933, 0.888], [2.067, 0.911], [2.2, 0.936], [2.4, 0.966], [2.667, 0.985], [2.9, 0.994], [3.133, 1]] as const,
  pops: [1.067, 1.227, 1.413, 1.57] as const, pop: {seconds: 0.433, curve: [0.45, 0.5, 0, 1] as const},
  labels: {start: 0.72, first: 0.967, every: 0.167, seconds: 0.683, curve: [0.25, 1, 0.55, 1] as const}, rightTitle: [2.8, 0.833] as const,
  // [seconds, camera centre x in world units]; the centre's y stays at 540.
  pan: [[0.7, 1209], [1.2, 1193.2], [1.3, 1188.6], [1.4, 1182], [1.5, 1173.2], [1.6, 1161.3], [1.7, 1146.8], [1.8, 1127.7], [1.9, 1105.1],
    [2, 1078.2], [2.1, 1049.9], [2.2, 1026], [2.3, 1006.1], [2.4, 989.9], [2.5, 977.1], [2.6, 967.2], [2.7, 960], [2.8, 946.1], [4.3, 847]] as const,
  zoom: {to: 0.75, start: 2.825, seconds: 2.033, curve: [0.25, 0.5, 0.25, 1] as const},
} as const;

const lerpTable = (table: readonly (readonly [number, number])[], t: number) => {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (t <= table[i][0]) {
    const [t0, v0] = table[i - 1], [t1, v1] = table[i];
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return table[table.length - 1][1];
};

type P = readonly [number, number];
const segment = (a: P, b: P, u: number): P => {
  const h = (b[0] - a[0]) * waveTimelineSpec.handle, v = 1 - u;
  return [v ** 3 * a[0] + 3 * v * v * u * (a[0] + h) + 3 * v * u * u * (b[0] - h) + u ** 3 * b[0], v ** 3 * a[1] + 3 * v * v * u * a[1] + 3 * v * u * u * b[1] + u ** 3 * b[1]];
};
/** SVG path of the whole line and its length (for the draw-on dash). */
export const wavePath = () => {
  const n = waveTimelineSpec.nodes, h = waveTimelineSpec.handle;
  let d = `M ${n[0][0]} ${n[0][1]}`, length = 0;
  for (let i = 1; i < n.length; i++) {
    const a = n[i - 1], b = n[i], dx = (b[0] - a[0]) * h;
    d += ` C ${a[0] + dx} ${a[1]} ${b[0] - dx} ${b[1]} ${b[0]} ${b[1]}`;
    let prev: P = a;
    for (let k = 1; k <= 64; k++) {const p = segment(a, b, k / 64); length += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p;}
  }
  return {d, length};
};

export const waveTimelineState = (t: number) => {
  const k = waveTimelineSpec;
  return {draw: lerpTable(k.draw, t), camera: {x: lerpTable(k.pan, t), zoom: 1 - (1 - k.zoom.to) * progress(t, k.zoom.start, k.zoom.start + k.zoom.seconds, k.zoom.curve)},
    pops: k.pops.map((s) => progress(t, s, s + k.pop.seconds, k.pop.curve)),
    // start label, four milestone labels, end label
    labels: [k.labels.start, ...Array.from({length: 5}, (_, i) => k.labels.first + i * k.labels.every)].map((s) => progress(t, s, s + k.labels.seconds, k.labels.curve)),
    rightTitle: Math.max(0, Math.min(1, (t - k.rightTitle[0]) / k.rightTitle[1]))};
};
