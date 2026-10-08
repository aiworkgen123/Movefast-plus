import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {NumberStatisticProps} from './number-statistic-contract.ts';
import {entranceOpacity, progress} from './motion.ts';
export const numberStatisticState = (context: FrameContext, skin: Skin, props: NumberStatisticProps) => {
  const amount = progress(context.frame, skin.statistic.countStartSeconds * context.fps,
    context.durationInFrames * skin.statistic.countEndFraction, skin.motion.entrance);
  const value = amount === 0 ? 0 : amount === 1 ? props.value : props.value * amount;
  // Large finite magnitudes use scientific notation so the figure remains legible.
  const formatted = Math.abs(value) >= 1e12 ? value.toExponential(props.precision) : value.toFixed(props.precision);
  return {value, formatted, opacity: entranceOpacity(context, skin)};
};
