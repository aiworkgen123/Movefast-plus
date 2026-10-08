import {interpolate} from 'remotion';
/** Measured on Diesel 13:17.43 (1080p). Stage #0E1317. Portrait box (154, 102)-(763, 982); it spreads from (495, 550) as a
 * ragged ellipse (width 0.68 of height) whose half-height grows 112 → 450 px over 0.3-1.6 s (accelerating). Quote Noto Sans
 * Italic 47.4 px, #D3D7DA, ink from (926, 421), lines 72 px apart, wrap 850 px; author Inter 800 italic 50 px #3CAFDF after the
 * closing quote; role Inter 400 29.8 px #9CA1A7 at ink top 648. Everything types at 40 characters/s from 0.47 s. */
export const portraitQuoteSpec = {
  box: {x: 154, y: 102, width: 610, height: 880}, centre: {x: 495, y: 550}, aspect: 0.68,
  quote: {size: 47.7, left: 926, inkTop: 421, pitch: 70, width: 850}, author: {size: 51.7}, role: {size: 29.8, inkTop: 648},
  typeStart: 0.47, rate: 40,
} as const;
const spread = [[9, 0], [10, 112], [13, 119], [16, 135], [19, 155], [22, 175], [25, 197], [28, 230], [31, 261], [34, 299], [37, 345], [40, 383], [43, 413], [48, 470], [52, 520]] as const;
export const portraitSpread = (t: number) => interpolate(t * 30, spread.map((p) => p[0]), spread.map((p) => p[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
export const typedCount = (t: number) => Math.max(0, Math.floor((t - portraitQuoteSpec.typeStart) * portraitQuoteSpec.rate));
