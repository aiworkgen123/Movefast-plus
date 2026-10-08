import {interpolate} from 'remotion';
import {progress} from './motion.ts';
/** Measured on ESB 00:13.3 (1080p). Number Montserrat 900 153 px, +0.115 em, ink from (57, 741), white; it fades in 0-0.25 s and
 * counts (already 39% at the cut) to the value at 0.8 s. Tag: white, 74 px tall, top y 920, padding 48 px, radius 8, centred
 * under the number; unit Montserrat 800 41 px +0.065 em #050505; it fades and slides 15 px in 0.27-0.47 s. */
export const numberTagSpec = {
  number: {size: 153, tracking: 0.115, left: 66, top: 741, fade: 0.25},
  tag: {top: 920, height: 74, padX: 48, radius: 8, size: 41, tracking: 0.065, fade: [0.27, 0.47], slide: 15},
} as const;
const count = [[0, 0.39], [2, 0.517], [4, 0.625], [6, 0.713], [8, 0.783], [10, 0.838], [12, 0.88], [14, 0.911], [16, 0.935], [18, 0.953], [20, 0.966], [22, 0.975], [24, 1]] as const;
export const numberTagState = (t: number, value: number) => {
  const f = interpolate(t * 30, count.map((c) => c[0]), count.map((c) => c[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return {shown: Math.round(value * f), number: progress(t, 0, numberTagSpec.number.fade, 'out-cubic'),
    tag: progress(t, numberTagSpec.tag.fade[0], numberTagSpec.tag.fade[1], 'out-cubic')};
};
export const formatThousands = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
