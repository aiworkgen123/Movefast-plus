import {progress} from './motion.ts';
/** Measured on Diesel 05:05.4 (E41), 1080p. Layout is flat (deskewed) units; the whole scene, grid included, is turned 1.97 degrees
 * clockwise about the frame centre, and a camera pushes in from 77% to full size over the first 2 s (measured table below).
 * The start tag and label fade in first, the line draws left to right (measured curve), the dots pop on their own beats,
 * the span word fades in over the middle dot, then the end tag and label. */
export const spanTimelineSpec = {
  tilt: 1.97, dots: {x0: 308.6, step: 331.2, y: 569.6, r: 8.5}, line: 2,
  grid: {cellX: 112.1, cellY: 110.7, originX: 77, originY: 17, stroke: 2.5},
  tag: {size: 31.4, weight: 600, padX: 30.5, height: 62, bottomGap: 50, tracking: 0},
  endTag: {size: 32.9, weight: 600, padX: 23, height: 61, bottomGap: 50, tracking: 0.06},
  label: {size: 35, weight: 800, capGap: 26}, span: {size: 75, weight: 800, capTop: 378},
  // [seconds, fraction of the line drawn]
  draw: [[0.533, 0], [0.6, 0.009], [0.7, 0.054], [0.8, 0.115], [0.9, 0.19], [1, 0.25], [1.1, 0.31], [1.2, 0.4], [1.3, 0.47], [1.4, 0.55],
    [1.5, 0.7], [1.6, 0.84], [1.7, 0.92], [1.8, 0.96], [1.9, 1]] as const,
  pops: [1.3, 1.3, 1.667, 2.167, 2.7] as const, popSeconds: 0.2,
  startFade: [0.033, 0.183] as const, spanFade: [1.183, 0.4] as const, endTagFade: [1.517, 0.2] as const, endLabelFade: [1.533, 0.4] as const,
  // [seconds, scale, x, y]: screen = scale * scene + (x, y)
  camera: [[0, 0.765, 148, 198], [0.167, 0.8105, 128, 158.5], [0.267, 0.8384, 116.4, 134.3], [0.367, 0.8632, 105.7, 110.8], [0.467, 0.8843, 95.2, 91.6],
    [0.567, 0.9011, 85.8, 77.8], [0.667, 0.9122, 78.4, 68.7], [0.767, 0.9218, 70.7, 61.9], [0.867, 0.9275, 64.4, 56.9], [0.967, 0.9348, 57.1, 50.6],
    [1.067, 0.9457, 49, 42.6], [1.167, 0.9523, 42.2, 37.1], [1.267, 0.9617, 34.8, 30.2], [1.367, 0.9676, 28.5, 25.1], [1.467, 0.975, 22.5, 19.4],
    [1.567, 0.9811, 16.8, 14.7], [1.667, 0.9887, 11, 9], [1.767, 0.9939, 6.6, 4.7], [1.867, 0.9983, 2.8, 1.6], [2.067, 1, 0, 0]] as const,
} as const;

const table = <T extends readonly number[]>(rows: readonly T[], t: number): number[] => {
  if (t <= rows[0][0]) return [...rows[0]];
  for (let i = 1; i < rows.length; i++) if (t <= rows[i][0]) {
    const a = rows[i - 1], b = rows[i], u = (t - a[0]) / (b[0] - a[0]);
    return a.map((v, j) => v + (b[j] - v) * u);
  }
  return [...rows[rows.length - 1]];
};
const fade = (t: number, [start, seconds]: readonly [number, number], curve: 'linear' | 'out' = 'linear') =>
  curve === 'out' ? progress(t, start, start + seconds, 'out-cubic') : Math.max(0, Math.min(1, (t - start) / seconds));

export const spanTimelineState = (t: number) => {
  const k = spanTimelineSpec, [, scale, x, y] = table(k.camera, t);
  return {camera: {scale, x, y}, draw: table(k.draw, t)[1], pops: k.pops.map((s) => progress(t, s, s + k.popSeconds, 'out-cubic')),
    start: fade(t, k.startFade), span: fade(t, k.spanFade, 'out'), endTag: fade(t, k.endTagFade), endLabel: fade(t, k.endLabelFade, 'out')};
};
