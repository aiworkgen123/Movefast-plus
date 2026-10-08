import {interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
/** Measured on TVA 22:55.77 (1080p). Date: Montserrat 800, 223 px, +0.008 em, ink centred at x 961 from y 363; fades in
 * 0.55-1.18 s (accelerating, the left half ~0.07 s ahead). Year: Montserrat 800, 148 px, +0.0135 em, centred, ink from y 626; fades
 * 1.37-2.0 s. Yellow #FDD600 bar (ink + 18/55/15/15 px) wipes left to right with a hard edge 2.18-2.83 s; a soft whoosh starts it. */
export const dateHighlightSpec = {
  date: {size: 223, tracking: 0.0082, inkTop: 363, fadeIn: [0.55, 1.18]},
  year: {size: 148, tracking: 0.0135, inkTop: 626, fadeIn: [1.37, 2.0]},
  bar: {padLeft: 18, padRight: 15, padTop: 55, padBottom: 15, start: 2.18}, lead: 0.07, whooshVolume: 0.25,
} as const;
const wipe = [[0, 0], [1.5, 0.38], [4.5, 0.64], [7.5, 0.82], [10.5, 0.92], [13.5, 0.98], [16.5, 0.998], [19.5, 1]] as const; // [frames after start, fraction]
export const dateHighlightState = (context: FrameContext) => {
  const t = context.frame / context.fps, k = dateHighlightSpec;
  const fade = (range: readonly number[], lead = 0) => progress(t + lead, range[0], range[1], [0.42, 0, 0.8, 1]);
  return {
    dateLeft: fade(k.date.fadeIn, k.lead), dateRight: fade(k.date.fadeIn), year: fade(k.year.fadeIn),
    bar: interpolate((t - k.bar.start) * 30, wipe.map((w) => w[0]), wipe.map((w) => w[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  };
};
