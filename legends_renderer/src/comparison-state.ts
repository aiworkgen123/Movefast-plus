import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const comparisonState = (context: FrameContext, skin: Skin) => {
  const reveal = progress(context.frame, 0, skin.motion.entranceSeconds * context.fps, skin.motion.entrance);
  return {opacity: entranceOpacity(context, skin), leftX: reveal === 1 ? 0 : -(1 - reveal) * skin.comparison.slideDistance,
    rightX: (1 - reveal) * skin.comparison.slideDistance,
    versusScale: progress(context.frame, skin.comparison.versusDelaySeconds * context.fps,
      (skin.comparison.versusDelaySeconds + skin.motion.entranceSeconds) * context.fps, skin.motion.entrance)};
};
