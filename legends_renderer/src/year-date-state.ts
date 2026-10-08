import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const yearDateState = (context: FrameContext, skin: Skin) => {
  const reveal = progress(context.frame, 0, skin.motion.entranceSeconds * context.fps, skin.motion.entrance);
  const labelStart = skin.motion.roleDelaySeconds * context.fps;
  return {opacity: entranceOpacity(context, skin), translateY: (1 - reveal) * skin.date.riseDistance,
    contextOpacity: progress(context.frame, labelStart, labelStart + skin.motion.roleEntranceSeconds * context.fps, skin.motion.entrance)};
};
