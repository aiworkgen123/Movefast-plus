import {bandCentres, linearFade, niceStep} from './chart-frame-state.ts';
import type {LinePlotProps} from './line-plot-contract.ts';
import {progress} from './motion.ts';
/** Measured on Empire State 06:27.2 (E37), 1080p. The y-axis draws down (0.12 s), the x-axis draws right (0.82 s), the dotted
 * grid is revealed by a left-to-right sweep, y ticks appear top-down every 2.5 frames and x ticks left-right every 5 frames.
 * Meanwhile the whole chart eases in from 94.1% to full size about the plot centre. Points and their labels pop in
 * left-right (every 2 frames from 1.85 s) and the line then draws through them over 1.95 s. Range = top value + 5%. */
export const linePlotSpec = {
  plot: {left: 320, right: 1680, top: 155, bottom: 907}, outer: 0.55, axis: 3, tick: 4, dot: 6, line: 3,
  title: {size: 62.8, weight: 800, capTop: 89}, ticks: {size: 15.6, weight: 400, right: 309}, labels: {size: 16.5, weight: 300, capTop: 915},
  values: {size: 16, weight: 600, gap: 6}, xTitle: {size: 31.7, weight: 400, capTop: 949.5}, yTitle: {size: 31.9, weight: 400, x: 197},
  yAxis: {start: 0.017, seconds: 0.117, curve: [0.6, 0.5, 0.8, 1] as const}, xAxis: {start: 0.125, seconds: 0.817, curve: [0.2, 1, 0.4, 1] as const},
  grid: {start: 0.3, seconds: 1.283, curve: [0.3, 1, 0.3, 1] as const}, yTicks: {start: 0.277, every: 0.0833, fade: 0.05}, xTicks: {start: 0.8, every: 0.167, fade: 0.067},
  title_: [1.237, 0.633] as const, xTitle_: [1.503, 0.29] as const, yTitle_: [1.53, 0.33] as const,
  zoom: {from: 1 / 1.0625, start: 0.792, seconds: 1.833, curve: [0.15, 0, 0.25, 1] as const, x: 1000, y: 531},
  points: {start: 1.85, every: 0.067, fade: 0.1}, draw: {start: 1.808, seconds: 1.95, curve: [0.25, 0.5, 0.3, 1] as const},
} as const;

export const linePlotLayout = (props: LinePlotProps) => {
  const k = linePlotSpec, p = k.plot, top = Math.max(...props.points.map((x) => x.value));
  const max = props.max ?? top * 1.05, step = props.tickStep ?? niceStep(max / 10);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  const y = (v: number) => p.bottom - (v / max) * (p.bottom - p.top), {centres} = bandCentres(props.points.length, p.left, p.right, k.outer);
  return {ticks, y, xs: centres, points: props.points.map((pt, i) => ({x: centres[i], y: y(pt.value)}))};
};

export const linePlotState = (t: number, props: LinePlotProps, tickCount: number) => {
  const k = linePlotSpec, at = (c: {start: number; seconds: number; curve: readonly [number, number, number, number]}) => progress(t, c.start, c.start + c.seconds, c.curve);
  return {yAxis: at(k.yAxis), xAxis: at(k.xAxis), grid: at(k.grid), draw: at(k.draw),
    zoom: k.zoom.from + (1 - k.zoom.from) * at(k.zoom),
    // y ticks are listed bottom-up but appear top-down.
    yTicks: Array.from({length: tickCount}, (_, i) => linearFade(t, k.yTicks.start + (tickCount - 1 - i) * k.yTicks.every, k.yTicks.fade)),
    xTicks: props.points.map((_, i) => linearFade(t, k.xTicks.start + i * k.xTicks.every, k.xTicks.fade)),
    points: props.points.map((_, i) => linearFade(t, k.points.start + i * k.points.every, k.points.fade)),
    title: linearFade(t, ...k.title_), xTitle: linearFade(t, ...k.xTitle_), yTitle: linearFade(t, ...k.yTitle_)};
};
