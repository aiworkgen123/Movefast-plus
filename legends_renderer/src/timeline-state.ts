import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const timelineState = (context: FrameContext, skin: Skin, count: number) => {
  const start = context.durationInFrames * skin.timeline.startFraction;
  const span = context.durationInFrames * skin.timeline.revealFraction;
  const events = Array.from({length: count}, (_, i) => progress(context.frame,
    start + span * i / (count - 1), start + span * i / (count - 1) + context.durationInFrames * 0.1, skin.motion.entrance));
  const activeIndex = events.reduce((active, value, i) => value > 0 ? i : active, -1);
  return {opacity: entranceOpacity(context, skin),
    lineScale: progress(context.frame, start, start + span, skin.motion.camera), events, activeIndex};
};
