import type {BarChartProps} from './bar-chart-contract.ts';
import {bandCentres, formatTick, linearFade, niceStep, ticksTo} from './chart-frame-state.ts';
import {progress} from './motion.ts';
/** Vertical measured on Diesel 10:51.6 (E35), horizontal on TVA 14:34.1 (E36), 1080p. Both: categories sit one step apart with
 * 0.6 step of padding at each end; bars grow on cubic-bezier(0.25, 1, 0.25, 1) over 1.43 s with a 0.038 s stagger.
 * Fades are linear [start, seconds] unless noted; gridlines sweep in from the left while fading. Vertical: values fade in over their bars (out-cubic) and the highlighted bar
 * turns amber at 2.95 s. Horizontal: no value labels; categories (Open Sans) follow the ticks by 0.1 s. */
export const barChartSpec = {
  vertical: {plot: {left: 205, right: 1840, top: 200, bottom: 900}, outer: 0.6, thickness: 0.313, axis: 2, tick: 7,
    title: {size: 63.9, weight: 600, capTop: 76}, ticks: {size: 17.5, weight: 400, right: 196}, labels: {size: 36, weight: 700, capTop: 906},
    values: {size: 36.4, weight: 700, gap: 38}, valueTitle: {size: 26, weight: 600, x: 90}, categoryTitle: {size: 28, weight: 600, capTop: 984.5},
    grid: {start: 1.117, draw: 0.25, fade: 0.167}, fade: {title: [0.325, 0.45], axes: [0.643, 0.127], ticks: [1.42, 0.46], labels: [1.42, 0.46]}, growAt: 2.075, valuesAt: 2.467, highlightAt: 2.95},
  horizontal: {plot: {left: 380, right: 1820, top: 140, bottom: 940}, outer: 0.6, thickness: 0.792, axis: 2, tick: 7,
    title: {size: 69.9, weight: 600, capTop: 42}, ticks: {size: 21.7, weight: 500, capTop: 961}, labels: {size: 27.5, weight: 500, right: 373},
    values: {size: 0, weight: 0, gap: 0}, valueTitle: {size: 36, weight: 600, capTop: 989}, categoryTitle: {size: 0, weight: 0, capTop: 0},
    grid: {start: 0.85, draw: 0.217, fade: 0.167}, fade: {title: [0.23, 0.375], axes: [0.49, 0.12], ticks: [1.097, 0.375], labels: [1.197, 0.375]}, growAt: 1.617, valuesAt: 0, highlightAt: 0},
  growSeconds: 1.433, stagger: 0.038, curve: [0.25, 1, 0.25, 1] as const,
} as const;

/** Value range and ticks: max defaults to the top value + 5%, rounded up to half a tick step (E35 29.5% -> 35%, E36 20.9K -> 22K). */
export const barChartScale = (props: BarChartProps) => {
  const top = Math.max(...props.bars.map((b) => b.value));
  const step = props.tickStep ?? niceStep(top / (props.orientation === 'vertical' ? 3 : 10));
  const max = props.max ?? Math.ceil(top * 1.05 / (step / 2)) * (step / 2);
  return {max, ticks: ticksTo(max, step).map((v) => ({v, label: formatTick(v, props.unit ?? '', props.unit !== '%' && max >= 1000)}))};
};

export const barChartLayout = (props: BarChartProps) => {
  const k = barChartSpec[props.orientation], p = k.plot, vertical = props.orientation === 'vertical';
  const band = vertical ? bandCentres(props.bars.length, p.left, p.right, k.outer) : bandCentres(props.bars.length, p.top, p.bottom, k.outer);
  const {max} = barChartScale(props);
  const at = (v: number) => (vertical ? p.bottom - (v / max) * (p.bottom - p.top) : p.left + (v / max) * (p.right - p.left));
  return {band, at, thickness: band.step * k.thickness};
};

export const barChartState = (t: number, props: BarChartProps) => {
  const k = barChartSpec[props.orientation], fade = (f: readonly [number, number]) => linearFade(t, f[0], f[1]);
  const grow = props.bars.map((_, i) => progress(t, k.growAt + i * barChartSpec.stagger, k.growAt + i * barChartSpec.stagger + barChartSpec.growSeconds, barChartSpec.curve));
  const values = props.bars.map((_, i) => progress(t, k.valuesAt + i * barChartSpec.stagger, k.valuesAt + i * barChartSpec.stagger + 0.4, 'out-cubic'));
  return {title: fade(k.fade.title), axes: fade(k.fade.axes), ticks: fade(k.fade.ticks), labels: fade(k.fade.labels), grow, values, highlight: progress(t, k.highlightAt, k.highlightAt + 0.3, [0.5, 1, 0.89, 1])};
};

/** Bar values as shown above the bars: whole numbers with the unit (29.5% reads "30%", as in the reference). */
export const barValueLabel = (value: number, unit?: '%') => `${Math.round(value)}${unit ?? ''}`;
