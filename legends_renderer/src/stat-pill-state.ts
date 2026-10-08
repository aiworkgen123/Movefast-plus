import {interpolate} from 'remotion';
/** Measured on TVA 02:02.8 (1080p). Pill #15171C, 92 px tall, top y 904, centred at x 383, radius 18, padding 40/48 px.
 * Value and label Open Sans 700/600 46 px, white; cyan #0CDBEE 17 px dot with a soft glow, 37/39 px gaps. The pill opens as a
 * window from its middle: the left edge in 0.47 s, the right edge in 0.53 s. */
export const statPillSpec = {top: 904, height: 92, centreX: 383, radius: 18, padLeft: 40, padRight: 48, size: 47.6, dot: 17, gapBefore: 37, gapAfter: 39} as const;
// Window edges as fractions of the half-widths (0 = centre, 1 = final edge) at frames 0-16. The reference cuts in at frame 6
// (already part-open); frames 0-6 are our lead-in so the pill always opens from its middle.
const frames = [0, 3, 6, 8, 10, 12, 14, 16];
const left = [0, 0.5, 0.85, 0.9, 0.945, 0.98, 1, 1];
const right = [0, 0.15, 0.34, 0.34, 0.63, 0.78, 0.88, 1];
export const statPillWindow = (t: number) => {
  const f = t * 30, opt = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  return {left: interpolate(f, frames, left, opt), right: interpolate(f, frames, right, opt)};
};
