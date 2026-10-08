import {interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
/** Measured on WTC 03:57.97 (1080p), every 2nd frame: centre y and scale of the year from the moment it starts to fall.
 * Montserrat ExtraBold 476.6 px, +0.026 em tracking (CSS trailing space shifts the ink, so the box centre is 966); final digit height 347 px. A sub boom starts at t=0. */
export const yearDropSpec = {fontSize: 476.6, tracking: 0.026, centreX: 966, opacity: 0.9, boomVolume: 0.6} as const;
const curve = [
  [0, -290, 0.85], [4, -39, 0.86], [6, 86, 0.87], [8, 182, 0.879], [10, 260, 0.89], [12, 321, 0.902], [14, 372, 0.914],
  [16, 415, 0.928], [18, 450, 0.939], [20, 478, 0.948], [22, 501, 0.957], [24, 518, 0.963], [26, 530, 0.968],
  [28, 538.5, 0.971], [30, 542.5, 0.977], [36, 543, 0.986], [46, 543, 0.991], [60, 543.5, 1],
] as const; // [frame at 30 fps, centre y px, scale]
const lift = 3; // box vs ink baseline offset measured on full-resolution stills
export const yearDropState = (context: FrameContext) => {
  const f = context.frame / context.fps * 30, opt = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
  return {centreY: interpolate(f, curve.map((c) => c[0]), curve.map((c) => c[1]), opt) - lift, scale: interpolate(f, curve.map((c) => c[0]), curve.map((c) => c[2]), opt)};
};
