import {progress} from './motion.ts';
/** Measured on Diesel 20:39.5 (1080p): box 40% black, centred at (960, 539), padding 64/58/62/50 px around the ink;
 * it wipes in from the left in 0.1 s. Title Montserrat 800 129.8 px, white, cap top y 495, typed at 14 characters/s from 0.03 s. */
export const boxedTitleSpec = {size: 129.8, capTop: 495, centreY: 539, pad: {top: 64, right: 58, bottom: 62, left: 50}, shade: 0.4, wipe: 0.1, typeStart: 0.03, rate: 14} as const;
export const capOffset = 0.1555;
export const boxedTitleState = (t: number, chars: number) => ({
  box: progress(t, 0, boxedTitleSpec.wipe, 'out-cubic'),
  chars: Math.max(0, Math.min(chars, Math.floor((t - boxedTitleSpec.typeStart) * boxedTitleSpec.rate) + 1)),
});
