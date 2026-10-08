import {interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
import type {ImpactWordProps} from './impact-word-contract.ts';
/** Measured on Diesel 05:18.8 (1080p): Space Grotesk Bold 346.2 px, +0.028 em, ink centred at (952, 538) (box centre 960, 540: CSS trailing tracking), final ink 1690x250.
 * Letters arrive ~0.3 s apart, each at 45% and white within 0.1 s. Warm picture → deep red from 0.4 to 1.27 s.
 * The word pops from 72% to 81% in 0.4 s, holds, then grows to 100% between 1.3 and 3.45 s. */
export const impactWordSpec = {fontSize: 346.2, tracking: 0.028, centreX: 960, centreY: 540, letterGap: 0.3, appear: 0.45, settle: 0.1,
  warm: {r: 1.061, g: 0.611, b: 0.547, lift: 0}, gradeStart: 0.4, gradeEnd: 1.27} as const;
const scaleCurve = [[0, 0.72], [3, 0.768], [6, 0.796], [9, 0.804], [12, 0.812], [21, 0.816], [30, 0.824], [39, 0.84], [47, 0.856],
  [55, 0.876], [63, 0.896], [71, 0.92], [79, 0.944], [87, 0.968], [95, 0.992], [103, 1]] as const; // [frame at 30 fps, scale]
export const impactWordLetterStarts = (props: ImpactWordProps): number[] =>
  props.letterStarts ? [...props.letterStarts] : Array.from(props.word).map((_, i) => i * impactWordSpec.letterGap);
export const impactWordState = (context: FrameContext, props: ImpactWordProps) => {
  const t = context.frame / context.fps, k = impactWordSpec, f = t * 30;
  return {
    scale: interpolate(f, scaleCurve.map((c) => c[0]), scaleCurve.map((c) => c[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    grade: progress(t, k.gradeStart, k.gradeEnd, [0.33, 0, 0.67, 1]),
    letters: impactWordLetterStarts(props).map((s) => t < s ? 0 : k.appear + (1 - k.appear) * progress(t, s, s + k.settle, 'out-cubic')),
  };
};
