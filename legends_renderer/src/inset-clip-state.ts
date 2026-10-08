import {progress} from './motion.ts';
/** Measured on WTC 14:45.03 (1080p). Background: the footage, blurred 12 px at 75% brightness. Card 900x536, black, centred
 * at (962, 600), radius 8; it pops from 91% to 100% at 0.27-0.63 s, then sways ±1.8° (period 4.4 s) and drifts ±8 px.
 * Chip #111111 708x93 with its top at y 182, radius 10; caption Montserrat 800 51.8 px +0.035 em white, cap top 205; fades in 0.33-0.5 s. */
export const insetClipSpec = {
  card: {width: 900, height: 536, x: 962, y: 600, radius: 8, from: 0.91, pop: [0.27, 0.63], sway: 1.8, period: 4.4, peak: 0.95, drift: 8},
  chip: {top: 182, height: 93, padX: 28, size: 51.8, tracking: 0.035, capTop: 211.5, fade: [0.33, 0.5]},
  bg: {blur: 12, brightness: 0.75}, dim: {blur: 2, brightness: 0.55},
} as const;
export const insetClipState = (t: number) => {
  const k = insetClipSpec.card, pop = progress(t, k.pop[0], k.pop[1], 'out-cubic'), phase = 2 * Math.PI * (t - k.peak) / k.period;
  return {scale: k.from + (1 - k.from) * pop, rotate: k.sway * Math.cos(phase) * pop, dx: k.drift * Math.sin(phase) * pop,
    chip: progress(t, insetClipSpec.chip.fade[0], insetClipSpec.chip.fade[1], 'out-cubic')};
};
