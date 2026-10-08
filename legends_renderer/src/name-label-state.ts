import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
import type {NameLabelProps} from './name-label-contract.ts';

/** The role follows the name; both slide toward their chosen screen edge on exit. */
export const nameLabelState = (context: FrameContext, skin: Skin, position: NameLabelProps['position']) => {
  const enter = progress(context.frame, 0, skin.motion.entranceSeconds * context.fps, skin.motion.entrance);
  const exit = progress(context.frame, context.durationInFrames - 1 - skin.motion.exitSeconds * context.fps, context.durationInFrames - 1, skin.motion.entrance);
  const roleStart = skin.motion.roleDelaySeconds * context.fps;
  return {
    opacity: entranceOpacity(context, skin),
    translateX: (position === 'left' ? -1 : 1) * skin.label.lowerThird.slideDistance * ((1 - enter) + exit),
    roleOpacity: progress(context.frame, roleStart, roleStart + skin.motion.roleEntranceSeconds * context.fps, skin.motion.entrance),
  };
};
