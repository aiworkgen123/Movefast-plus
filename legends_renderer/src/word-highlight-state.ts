import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const wordHighlightState = (context: FrameContext, skin: Skin) => {
  const reveal = progress(context.frame, 0, skin.motion.entranceSeconds * context.fps, skin.motion.entrance);
  return {opacity: entranceOpacity(context, skin), translateY: (1 - reveal) * skin.highlight.riseDistance,
    markerScale: progress(context.frame, skin.highlight.markerStartSeconds * context.fps,
      (skin.highlight.markerStartSeconds + skin.highlight.markerDurationSeconds) * context.fps, skin.motion.entrance)};
};
