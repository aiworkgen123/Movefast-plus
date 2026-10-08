import {interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
/** Measured on TVA 03:55.17 (1080p). Frame 604x632 at (658, 110) with soft blue edge lines (bottom strongest).
 * It falls at ~600 px/s and stops at f34. Background dims to 57% by f22. Name: Montserrat 800, 98.9 px, +0.0087 em,
 * ink 793-864 centred at x 955 (box 960), revealed by a left-to-right wipe at 1000 px/s from 0 s. Role: Montserrat 600, 41.3 px,
 * +0.0225 em, ink 898-936 centred at x 958.5, wiped at 426 px/s from 0.3 s. Ink appears at 45% and whitens over 0.12 s of wipe. */
export const portraitNameSpec = {
  frame: {x: 658, y: 110, width: 604, height: 632}, line: '#33425A',
  name: {size: 98.9, tracking: 0.0087, inkTop: 795, centreX: 960, start: 0, speed: 1000},
  role: {size: 41.3, tracking: 0.0225, inkTop: 901, centreX: 958.5, start: 0.3, speed: 426},
  appear: 0.45, settle: 0.12,
} as const;
const fall = [[0, 83], [13, 343], [22, 522], [28, 640], [31, 700], [34, 742]] as const; // frame bottom y at 30 fps
const dim = [[0, 1], [3, 0.94], [6, 0.86], [9, 0.78], [12, 0.7], [15, 0.64], [18, 0.59], [21, 0.57]] as const;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const portraitNameState = (context: FrameContext) => {
  const t = context.frame / context.fps, f = t * 30, k = portraitNameSpec;
  return {
    drop: interpolate(f, fall.map((p) => p[0]), fall.map((p) => p[1]), clamp) - (k.frame.y + k.frame.height),
    brightness: interpolate(f, dim.map((p) => p[0]), dim.map((p) => p[1]), clamp),
    // Wipe front in px from the text's left edge (1920 units).
    nameWipe: Math.max(0, t - k.name.start) * k.name.speed,
    roleWipe: Math.max(0, t - k.role.start) * k.role.speed,
  };
};
