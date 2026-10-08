import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
import type {WordRevealProps} from './word-reveal-contract.ts';
/** Measured: each word appears at ~45% brightness, then settles to full white over ~0.3 s. No exit animation (hard cut). */
export const wordRevealSpec = {left: 234, top: 392, maxWidth: 1460, fontSize: 98, lineHeight: 1.53, appear: 0.45, settleSeconds: 0.3, revealFraction: 0.7} as const;
export const wordStartsFor = (props: WordRevealProps, context: FrameContext): number[] => {
  const count = props.text.split(/\s+/u).length;
  if (props.wordStarts) return [...props.wordStarts];
  const span = context.durationInFrames / context.fps * wordRevealSpec.revealFraction;
  return Array.from({length: count}, (_, i) => i * span / count);
};
export const wordRevealState = (context: FrameContext, props: WordRevealProps) => {
  const now = context.frame / context.fps;
  return wordStartsFor(props, context).map((start) => {
    if (now < start) return 0;
    const settle = progress(now - start, 0, wordRevealSpec.settleSeconds, 'out-cubic');
    return wordRevealSpec.appear + (1 - wordRevealSpec.appear) * settle;
  });
};
