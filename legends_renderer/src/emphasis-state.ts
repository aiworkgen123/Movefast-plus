import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const emphasisState = (context: FrameContext, skin: Skin) => {
  const reveal = progress(context.frame, 0, skin.motion.entranceSeconds * context.fps, skin.motion.entrance);
  return {opacity: entranceOpacity(context, skin), translateY: (1 - reveal) * skin.emphasis.riseDistance, clipRightPercent: (1 - reveal) * 100};
};
