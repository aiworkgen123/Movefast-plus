import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import {entranceOpacity, progress} from './motion.ts';
export const quoteState = (context: FrameContext, skin: Skin, count: number) => {
  const token = skin.quote, duration = context.durationInFrames;
  const words = Array.from({length: count}, (_, i) => progress(context.frame,
    duration * (token.wordStartFraction + token.wordSpanFraction * i / Math.max(1, count - 1)),
    duration * (token.wordStartFraction + token.wordSpanFraction * i / Math.max(1, count - 1) + token.wordRevealFraction), skin.motion.entrance));
  return {opacity: entranceOpacity(context, skin), words,
    attribution: progress(context.frame, duration * token.attributionStartFraction, duration * (token.attributionStartFraction + token.wordRevealFraction), skin.motion.entrance),
    context: progress(context.frame, duration * token.contextStartFraction, duration * (token.contextStartFraction + token.wordRevealFraction), skin.motion.entrance)};
};
