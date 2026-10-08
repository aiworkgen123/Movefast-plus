import {progress} from './motion.ts';
/** Measured on WTC 01:47.0 (1080p). The map zooms in 11.7% about the circle centre over 8.5 s (ease-out). Red #C40630
 * circle, 10 px, radius 571 px around (948, 556) by default, drawn clockwise from -20° in 0.5 s from 0.03 s. Caption
 * Montserrat 800 84.5 px white, ink from (86, 921), typed at 15 characters/s from 0.43 s with a "|" cursor while typing. */
export const mapCircleSpec = {centre: {x: 948, y: 556}, r: 571, stroke: 10, startDeg: -20, drawStart: 0.03, draw: 0.5, zoom: 0.117, zoomSeconds: 8.5,
  caption: {size: 84.5, left: 86, capTop: 921, start: 0.43, rate: 15}} as const;
export const mapCircleState = (t: number, captionLength: number) => {
  const k = mapCircleSpec, chars = Math.max(0, Math.min(captionLength, Math.floor((t - k.caption.start) * k.caption.rate)));
  return {zoom: 1 + k.zoom * progress(t, 0, k.zoomSeconds, 'out-cubic'), arc: progress(t, k.drawStart, k.drawStart + k.draw, 'in-out-cubic'),
    chars, cursor: t >= k.caption.start && chars < captionLength};
};
