import {interpolate} from 'remotion';
import {progress} from './motion.ts';
/** Measured on Diesel 00:03.3 (1080p). Background pushes in 21%/s towards (30%, 25%) from 0.37 s (the shot's first frame). Cut-out 610x950 at the bottom-left corner grows from it
 * (0.4-1 s, fast then settling). Name Montserrat 800 60.4 px +0.037 em, ink from (965, 485), one letter every 0.036 s from
 * 0.12 s; role Montserrat 500 37 px +0.064 em, ink from (964, 568), one letter every 0.034 s from 0.62 s; letters fade in over
 * 0.1 s. Arrow: 4 px white curve from (1229, 684) down through (1028, 755) to (708, 630), drawn 0.95-1.35 s, head at the end. */
export const doublePortraitSpec = {
  zoomPerSecond: 0.21, zoomOrigin: '30% 25%', portrait: {width: 610, height: 950},
  name: {size: 60.4, tracking: 0.037, left: 965, capTop: 485, start: 0.12, rate: 0.036},
  role: {size: 37, tracking: 0.064, left: 964, capTop: 568, start: 0.62, rate: 0.034},
  fade: 0.1, arrow: {path: 'M1229 684 C1170 772 830 790 708 630', draw: [0.95, 1.35]},
} as const;
const grow = [[12, 0], [15, 0.25], [18, 0.85], [19, 0.93], [21, 0.975], [23, 0.987], [25, 0.99], [29, 1]] as const; // [frame, scale]
export const doublePortraitState = (t: number) => ({
  zoom: 1 + doublePortraitSpec.zoomPerSecond * Math.max(0, t - 0.37),
  grow: interpolate(t * 30, grow.map((g) => g[0]), grow.map((g) => g[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  arrow: progress(t, doublePortraitSpec.arrow.draw[0], doublePortraitSpec.arrow.draw[1], 'in-out-cubic'),
});
export const letterAlpha = (t: number, start: number, rate: number, i: number) => progress(t, start + i * rate, start + i * rate + doublePortraitSpec.fade, 'out-cubic');
