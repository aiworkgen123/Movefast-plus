import {random} from 'remotion';
import {progress} from './motion.ts';
/** Measured on WTC 06:37.0 (1080p). Faint 100 px grid; dark circle #1A1A1A centre (960, 540) r 581 with a 4 px green
 * #23AD60 rim drawn clockwise from -69° in 0.4 s. The cut-out (full frame) zooms 79% → 100% about (1826, 990) and
 * sharpens from a 14 px blur over 1 s (ease-out). Values Saira 600 (width 80) 93 px (slot 1) / 125 px (slot 2) green, decoding left to right
 * (random glyphs settle one by one); tags #F2F2F2 with torn ends, 144 px tall, padding 63 px, label Saira 600 77 px
 * +0.057 em #0A0A0A, typed at 10 characters/s with the tag growing with the text. Slot 1: value ink (103, 62), tag top
 * 154 from x 103. Slot 2: right-aligned to x 1823 / 1816, value ink top 658, tag top 779. A faint dot screen covers all. */
export const measureRadarSpec = {
  circle: {x: 960, y: 540, r: 581, stroke: 4, startDeg: -69, draw: 0.4},
  zoom: {from: 0.79, originX: 1826, originY: 990, seconds: 1, blur: 14},
  value: {size: 93, tracking: 0, nudgeX: -3, decodeRate: 5.3},
  tag: {height: 144, pad: 63, size: 77, tracking: 0.057, rate: 10, notch: 12, textDrop: 0},
  slots: [{valueLeft: 103, valueTop: 62, valueSize: 93, tagTop: 154, start: 0.3, tagStart: 0.37}, {valueRight: 1823, valueTop: 658, valueSize: 125, tagRight: 1816, tagTop: 779, start: 0.9, tagStart: 1.1}],
  dots: {pitch: 8, alpha: 0.18},
} as const;
const glyphs = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
/** Decoding text: settled characters, then up to two cycling random glyphs (frame-seeded, deterministic). */
export const decoded = (text: string, t: number, start: number, frame: number) => {
  const chars = Array.from(text), settled = Math.max(0, Math.min(chars.length, Math.floor((t - start) * measureRadarSpec.value.decodeRate)));
  if (t < start) return '';
  const tail = Array.from({length: Math.min(2, chars.length - settled)}, (_, i) => glyphs[Math.floor(random(`${text}:${frame >> 1}:${i}`) * glyphs.length)]);
  return chars.slice(0, settled).join('') + tail.join('');
};
export const typedChars = (t: number, start: number, total: number) => Math.max(0, Math.min(total, Math.floor((t - start) * measureRadarSpec.tag.rate) + (t >= start ? 1 : 0)));
export const radarZoom = (t: number) => {
  const p = progress(t, 0, measureRadarSpec.zoom.seconds, 'out-cubic');
  return {scale: measureRadarSpec.zoom.from + (1 - measureRadarSpec.zoom.from) * p, blur: measureRadarSpec.zoom.blur * (1 - p),
    arc: progress(t, 0, measureRadarSpec.circle.draw, 'out-cubic')};
};
