import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {blurFillDuration, repairBlurFill, type BlurFillProps} from './blur-fill-contract.ts';
/** Measured on WTC 31:05.97 (1080p): the sides are the same footage scaled to cover (1.78x for a square), blurred 45 px at 75%
 * brightness; the sharp footage is contained, full height, centred. No motion of its own. */
export const blurFillSpec = {blur: 45, brightness: 0.75} as const;
export const BlurFill: React.FC<ComponentRenderProps<BlurFillProps>> = ({props, context}) => {
  const safe = repairBlurFill(props);
  if (!safe || !validContext(context, blurFillDuration)) return null;
  const s = context.width / 1920;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <AbsoluteFill style={{filter: `blur(${blurFillSpec.blur * s}px) brightness(${blurFillSpec.brightness})`, transform: 'scale(1.06)'}}><FrameMediaView media={safe.media} context={context} fit="cover" /></AbsoluteFill>
    {/* Positioned so it paints above the (positioned) blurred layer. */}
    <AbsoluteFill><FrameMediaView media={safe.media} context={context} fit="contain" /></AbsoluteFill>
  </AbsoluteFill>;
};
export const blurFill: VisualComponent<BlurFillProps> = {id: 'blur-fill', layer: 'fullscreen', duration: blurFillDuration, textLimits: {}, repair: repairBlurFill, render: BlurFill};
