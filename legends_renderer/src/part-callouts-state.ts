import {interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
import {progress} from './motion.ts';
import type {PartCalloutsProps} from './part-callouts-contract.ts';
/** Measured on the WTC 13:18 lead (1080p): object, then leaders draw down, then the disc pops, then labels fade in left to right. */
export const partCalloutsSpec = {
  disc: {x: 960, y: 626, r: 362}, objectBox: {width: 560, height: 470}, labelSize: 54, labelInkTop: 107, labelDip: 16,
  leaderStartY: 190, leaderWidth: 5.5, dash: [13, 8], labelSpacing: {2: 520, 3: 449, 4: 380} as Record<number, number>,
  timing: {object: [0, 0.2], leaders: [0.1, 0.6], disc: [0.9, 1.17], labelStart: 1.3, labelStagger: 0.1, labelFade: 0.25},
  /** E33 (WTC 08:16.4): object box 1456x829 centred at (968, 643); labels 57 px, ink top 106, centre dip 22. It slides in from the right at 118% (0.2-0.75 s), then
   * shrinks to 100% (0.9-2.0 s); the leader/disc/label build starts 0.45 s later than E30's. Otherwise identical to E30. */
  large: {box: {width: 1456, height: 829, x: 968, y: 643}, delay: 0.45, labelSize: 57, labelInkTop: 106, labelDip: 22,
    slide: [[0.2, 528], [0.33, 187], [0.47, 55], [0.6, 20], [0.73, 9], [0.9, 0]] as const,
    scale: [[0.2, 1.18], [0.9, 1.178], [1.0, 1.159], [1.27, 1.127], [1.4, 1.076], [1.53, 1.038], [1.67, 1.017], [1.8, 1.007], [2.07, 1]] as const},
} as const;
export const partCalloutsLayout = (props: PartCalloutsProps) => {
  const n = props.labels.length, big = props.size === 'large', {disc, leaderStartY} = partCalloutsSpec;
  const labelInkTop = big ? partCalloutsSpec.large.labelInkTop : partCalloutsSpec.labelInkTop, labelDip = big ? partCalloutsSpec.large.labelDip : partCalloutsSpec.labelDip;
  const box = big ? partCalloutsSpec.large.box : {...partCalloutsSpec.objectBox, x: disc.x, y: disc.y};
  const fit = Math.min(box.width / props.object.width, box.height / props.object.height);
  const ow = props.object.width * fit, oh = props.object.height * fit, ox = box.x - ow / 2, oy = box.y - oh / 2;
  const labels = props.labels.map((label, i) => {
    const u = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
    const x = disc.x + (i - (n - 1) / 2) * partCalloutsSpec.labelSpacing[n];
    const tx = ox + label.target.x * ow, ty = oy + label.target.y * oh;
    const top = labelInkTop + labelDip * (1 - Math.abs(u)), sy = leaderStartY + labelDip * (1 - Math.abs(u));
    const path = `M${x} ${sy}C${x} ${sy + 0.55 * (ty - sy)} ${tx + 0.15 * (x - tx)} ${ty} ${tx} ${ty}`;
    return {text: label.text, x, top, path};
  });
  return {object: {x: ox, y: oy, width: ow, height: oh}, labels, labelSize: big ? partCalloutsSpec.large.labelSize : partCalloutsSpec.labelSize};
};
export const partCalloutsState = (context: FrameContext, labelCount: number, size: 'small' | 'large' = 'small') => {
  const big = size === 'large', t0 = context.frame / context.fps, t = big ? t0 - partCalloutsSpec.large.delay : t0, k = partCalloutsSpec.timing;
  const sl = partCalloutsSpec.large.slide;
  return {
    slide: big ? interpolate(t0, sl.map((p) => p[0]), sl.map((p) => p[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0,
    scale: big ? interpolate(t0, partCalloutsSpec.large.scale.map((p) => p[0]), partCalloutsSpec.large.scale.map((p) => p[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1,
    object: big ? (t0 >= sl[0][0] ? 1 : 0) : progress(t, k.object[0], k.object[1], 'out-cubic'),
    leaders: progress(t, k.leaders[0], k.leaders[1], 'in-out-cubic'),
    disc: progress(t, k.disc[0], k.disc[1], 'out-cubic'),
    labels: Array.from({length: labelCount}, (_, i) => progress(t, k.labelStart + i * k.labelStagger, k.labelStart + i * k.labelStagger + k.labelFade, 'out-cubic')),
  };
};
