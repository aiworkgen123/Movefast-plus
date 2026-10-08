import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const chapterCardState = (context: FrameContext, skin: Skin) => {
  const duration = context.durationInFrames, token = skin.chapterCard;
  const number = progress(context.frame, 0, duration * token.numberEndFraction, skin.motion.entrance);
  const title = progress(context.frame, duration * token.titleStartFraction, duration * token.titleEndFraction, skin.motion.entrance);
  const subtitle = progress(context.frame, duration * token.subtitleStartFraction, duration * token.subtitleEndFraction, skin.motion.entrance);
  return {opacity: entranceOpacity(context, skin), number, title, subtitle,
    numberX: number === 1 ? 0 : -(1 - number) * token.slideDistance,
    titleY: (1 - title) * token.riseDistance};
};
