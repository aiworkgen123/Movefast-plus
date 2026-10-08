import {interpolate, random} from 'remotion';
/** Measured on Diesel 15:35.0 (1080p): strip #E8EFF5 from (81, 894), 104 px tall, padding 29/36 px around the ink; label
 * Montserrat 800 73.6 px, +0.1 em, #080B0E, cap top y 921. The strip and label wipe in left to right 0.17-1.43 s. */
export const paperLabelSpec = {left: 81, top: 894, height: 104, padLeft: 29, padRight: 39, size: 73.6, tracking: 0.1, capTop: 921} as const;
const wipe = [[0, 0], [4, 0.068], [8, 0.25], [12, 0.52], [16, 0.722], [20, 0.845], [24, 0.92], [28, 0.965], [32, 0.99], [36, 1]] as const; // frames from 0.17 s
export const paperLabelWipe = (t: number) => interpolate((t - 0.167) * 30, wipe.map((w) => w[0]), wipe.map((w) => w[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
/** A slightly torn outline: deterministic jitter along the top and bottom edges (percent units). */
export const tornEdge = (seed: string) => {
  const top = Array.from({length: 24}, (_, i) => `${(i / 23) * 100}% ${random(`${seed}t${i}`) * 4}%`);
  const bottom = Array.from({length: 24}, (_, i) => `${100 - (i / 23) * 100}% ${100 - random(`${seed}b${i}`) * 4}%`);
  return `polygon(${[...top, ...bottom].join(', ')})`;
};
