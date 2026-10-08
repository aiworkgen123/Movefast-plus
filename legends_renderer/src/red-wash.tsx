import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GradedMedia, gradeFromColour} from './red-grade.tsx';
import {redWashDuration, repairRedWash, type RedWashProps} from './red-wash-contract.ts';
import {redWashStops} from './red-wash-state.ts';
export const RedWash: React.FC<ComponentRenderProps<RedWashProps>> = ({props, skin, context}) => {
  const safe = repairRedWash(props);
  if (!safe || !validContext(context, redWashDuration)) return null;
  const stops = redWashStops(context);
  const mask = `radial-gradient(ellipse at 50% 50%, ${stops.map((a, i) => `rgba(0,0,0,${a.toFixed(3)}) ${i * 25}%`).join(', ')})`;
  return <AbsoluteFill style={{backgroundColor: '#000'}}>
    <GradedMedia media={safe.media} context={context} id={`red-wash-base-${skin.id}`} />
    <GradedMedia media={safe.media} context={context} id={`red-wash-${skin.id}`} grade={gradeFromColour(skin.stage.washRed)} mask={mask} />
  </AbsoluteFill>;
};
export const redWash: VisualComponent<RedWashProps> = {id: 'red-wash', layer: 'fullscreen', duration: redWashDuration,
  textLimits: {}, repair: repairRedWash, render: RedWash};
