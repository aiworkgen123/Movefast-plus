import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
import type {PercentGaugeProps} from './percent-gauge-contract.ts';
/** Measured on the 1080p lead (Diesel 03:34): static layout; count runs 0.45-1.9 s with an ease-out. */
export const percentGaugeSpec = {
  titleCapTop: 80, titleSize: 94, valueLeft: 1290, valueDigitTop: 428, valueSize: 191.5, captionCapTop: 985, captionSize: 28.5,
  column: {left: 878, top: 333, width: 116, height: 496, border: 6}, countStart: 0.45, countEnd: 1.9,
} as const;
export const formatPercent = (value: number, precision: 0 | 1) => `${value.toFixed(precision)}%`;
export const percentGaugeState = (context: FrameContext, props: PercentGaugeProps) => {
  const t = progress(context.frame / context.fps, percentGaugeSpec.countStart, percentGaugeSpec.countEnd, 'out-cubic');
  const shown = Number((props.value * t).toFixed(props.precision));
  return {fill: shown / 100, label: formatPercent(shown, props.precision)};
};
/** Frames where the shown number changes: one counter tick each. */
export const percentGaugeTicks = (context: Omit<FrameContext, 'frame'>, props: PercentGaugeProps): number[] => {
  const ticks: number[] = [];
  let last = percentGaugeState({...context, frame: 0}, props).label;
  for (let frame = 1; frame < context.durationInFrames; frame++) {
    const label = percentGaugeState({...context, frame}, props).label;
    if (label !== last) ticks.push(frame);
    last = label;
  }
  return ticks;
};
