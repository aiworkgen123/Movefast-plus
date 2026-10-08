import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
/** Measured on WTC 11:40.5 (1080p): redness (1 - G/R) starts at the centre at 0.2 s and at the corners 0.23 s later;
 * each point ramps over 0.8 s. Red keeps the picture's brightness (R = luminance), green and blue go to zero. */
export const redWashSpec = {start: 0.2, spread: 0.23, ramp: 0.8} as const;
/** Mask opacity at elliptical distance 0, 0.25 ... 1 from the centre. */
export const redWashStops = (context: FrameContext): number[] => {
  const t = context.frame / context.fps, k = redWashSpec;
  return [0, 0.25, 0.5, 0.75, 1].map((d) => progress(t, k.start + k.spread * d, k.start + k.spread * d + k.ramp, 'out-cubic'));
};
