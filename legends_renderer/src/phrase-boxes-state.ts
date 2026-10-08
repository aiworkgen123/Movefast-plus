import {progress} from './motion.ts';
/** Measured on Diesel 01:04.67 (1080p). Boxes violet #625BD1, 121 px tall, from x 74, top y 114, rows 136 px apart, 40 px apart
 * within a row (a 10 px white dot sits in the gap after a phrase that ends in a full stop); padding 18/16 px. Lobster 71.3 px,
 * #1C1B26. Each box wipes left to right in 0.8 s (ease-out), ~0.6 s apart. A faint 27 px grid (white 9%) covers the top-left
 * area behind the text, fading out by 750 px from its centre. */
export const phraseBoxesSpec = {left: 74, top: 114, height: 121, rowGap: 12, gap: 40, padLeft: 18, padRight: 16, size: 72.5, maxWidth: 1100,
  wipe: 0.8, spacing: 0.6, dot: 10, grid: {cell: 27, alpha: 0.12, x: 420, y: 230, radius: 750}} as const;
export const phraseStartTimes = (count: number, given?: readonly number[]) => given ? [...given] : Array.from({length: count}, (_, i) => i * phraseBoxesSpec.spacing);
export const phraseWipe = (t: number, start: number) => progress(t, start, start + phraseBoxesSpec.wipe, 'out-cubic');
