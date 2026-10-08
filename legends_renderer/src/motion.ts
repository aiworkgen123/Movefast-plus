import {Easing, interpolate} from 'remotion';
import type {FrameContext} from './contract.ts';
import type {MotionCurve, Skin} from './skins.ts';

const easing = (curve: MotionCurve) => typeof curve !== 'string'
  ? Easing.bezier(...curve)
  : curve === 'out-cubic' ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic);

export const progress = (frame: number, start: number, end: number, curve: MotionCurve): number =>
  interpolate(frame, [start, end], [0, 1], {easing: easing(curve), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const entranceOpacity = (context: FrameContext, skin: Skin): number => Math.min(
  progress(context.frame, 0, skin.motion.entranceSeconds * context.fps, skin.motion.entrance),
  1 - progress(context.frame, context.durationInFrames - 1 - skin.motion.exitSeconds * context.fps, context.durationInFrames - 1, skin.motion.entrance),
);
