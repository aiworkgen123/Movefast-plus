import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
import type {DropHeadlineProps} from './drop-headline-contract.ts';
/** Measured on WTC 01:37.0 (1080p): Montserrat ExtraBold 150.5 px, +0.032 em tracking, line pitch 184 px, block centred; wrapped lines
 * keep their trailing space when centring (lines 1-2 sit ~24 px left of centre, the last line is centred).
 * Letters fall ~130 px with a slight tilt, 0.012 s apart, settling in 0.35 s. The footage is held at 121% and dimmed;
 * 1.6-0.2 s before the cut everything pulls back to 100% (text ends at 82.6%). */
export const dropHeadlineSpec = {
  fontSize: 150.5, lineHeight: 1.2226, tracking: 0.032, maxWidth: 1600, centreX: 960, centreY: 540,
  drop: 130, tilt: -10, letterStagger: 0.012, settle: 0.35, fade: 0.15, wordGap: 0.33, dim: 0.16, dimIn: 0.3,
  mediaScale: 1.21, pullBackStart: 1.6, pullBackEnd: 0.2,
} as const;
export const dropHeadlineWordStarts = (props: DropHeadlineProps): number[] =>
  props.wordStarts ? [...props.wordStarts] : props.text.split(/\s+/u).map((_, i) => i * dropHeadlineSpec.wordGap);
/** Per letter (in reading order, spaces skipped): offset in px, tilt in degrees, opacity. */
export const dropHeadlineLetters = (context: FrameContext, props: DropHeadlineProps) => {
  const t = context.frame / context.fps, k = dropHeadlineSpec, starts = dropHeadlineWordStarts(props);
  return props.text.split(/\s+/u).map((word, w) => Array.from(word).map((_, i) => {
    const start = starts[w] + i * k.letterStagger, p = progress(t, start, start + k.settle, 'out-cubic');
    return {dy: -(1 - p) * k.drop, tilt: (1 - p) * k.tilt, opacity: progress(t, start, start + k.fade, 'out-cubic')};
  }));
};
export const dropHeadlineCamera = (context: FrameContext) => {
  const t = context.frame / context.fps, end = context.durationInFrames / context.fps, k = dropHeadlineSpec;
  const pull = progress(t, end - k.pullBackStart, end - k.pullBackEnd, 'in-out-cubic');
  return {scale: 1 - pull * (1 - 1 / k.mediaScale), dim: k.dim * progress(t, 0, k.dimIn, 'out-cubic')};
};
