import {interpolate} from 'remotion';
import {progress} from './motion.ts';
/** Measured on Diesel 01:27.0 (1080p). Wide shot: Montserrat 600 110 px, +0.025 em, #F90234, cap top y 500; sentence starts at
 * x 375 and the camera stops when it ends at x 1523. Close shot (after a 0.4 s empty-grid cut): 252 px, cap top 455, start
 * x 654, ends at x 1142. The pan takes 2.9 s (measured ease curve). A word rises 65 px into place, sharpening from a 10 px blur,
 * over 0.27 s, at its narration time (else when its left edge reaches x 1150). Grid lines #2A2A2A move with the camera (cells 207 / 400 px). */
export type Shot = Readonly<{size: number; capTop: number; startX: number; endRight: number; cell: number; originY: number; stroke: number}>;
const wide: Shot = {size: 110, capTop: 500, startX: 375, endRight: 1528, cell: 207, originY: 418, stroke: 2.5};
const close: Shot = {size: 252, capTop: 455, startX: 654, endRight: 1161, cell: 400, originY: 291, stroke: 4};
export const panSentenceSpec = {
  wide, close,
  tracking: 0.025, weight: 600, panStart: 0.1, panSeconds: 2.83, revealX: 1150, rise: 65, blur: 10, entrance: 0.27, gap: 0.4, cutAt: 4.97, clickVolume: 0.3,
} as const;
// Measured camera travel (px) at frames since the pan began (30 fps), normalised by the total 1899 px.
const travel = [0, 7, 34, 68, 110, 161, 221, 290, 368, 454, 547, 647, 753, 862, 973, 1083, 1190, 1292, 1388, 1476, 1557, 1629, 1692, 1746, 1791, 1827, 1857, 1878, 1893, 1899];
const travelFrames = travel.map((_, i) => (i === 0 ? 0 : 1 + 3 * (i - 1)));
export const panFraction = (t: number) => interpolate(t * 30, travelFrames, travel.map((v) => v / 1899), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
/** Camera offset (px, 1920 units) at time t (seconds since the shot started) for a sentence of the given width. */
export const panCamera = (shot: Shot, width: number, t: number) => Math.max(0, shot.startX + width - shot.endRight) * panFraction(t - panSentenceSpec.panStart);
/** When each word (left edge at offset x within the sentence) starts rising: first time its screen x reaches revealX. */
export const panRevealTimes = (shot: Shot, width: number, offsets: readonly number[]) => offsets.map((x) => {
  for (let t = 0; t <= panSentenceSpec.panStart + panSentenceSpec.panSeconds; t += 1 / 60) if (shot.startX + x - panCamera(shot, width, t) <= panSentenceSpec.revealX) return t;
  return panSentenceSpec.panStart + panSentenceSpec.panSeconds;
});
export const panWordState = (t: number, revealAt: number) => {
  const p = progress(t, revealAt, revealAt + panSentenceSpec.entrance, 'out-cubic');
  return {dy: (1 - p) * panSentenceSpec.rise, blur: (1 - p) * panSentenceSpec.blur, opacity: t < revealAt ? 0 : Math.min(1, 0.2 + p)};
};
