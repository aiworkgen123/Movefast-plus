import React from 'react';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {repairYearDrop, yearDropDuration, yearDropTextLimits, type YearDropProps} from './year-drop-contract.ts';
import {yearDropSpec as spec, yearDropState} from './year-drop-state.ts';
export const YearDrop: React.FC<ComponentRenderProps<YearDropProps>> = ({props, skin, context}) => {
  const safe = repairYearDrop(props);
  if (!safe || !validContext(context, yearDropDuration)) return null;
  const s = context.width / 1920, look = skin.stage, st = yearDropState(context);
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: spec.centreX * s, top: st.centreY * s, transform: `translate(-50%, -50%) scale(${st.scale})`,
      fontFamily: look.heavy.family, fontWeight: look.heavy.weight, fontSize: spec.fontSize * s, lineHeight: 1, letterSpacing: `${spec.tracking}em`,
      whiteSpace: 'nowrap', color: look.onMedia, opacity: spec.opacity, textShadow: `0 ${6 * s}px ${30 * s}px ${look.shadow}`}}>{safe.year}</div>
    <Audio src={staticFile('sfx/sub-boom.wav')} volume={spec.boomVolume} />
  </AbsoluteFill>;
};
export const yearDrop: VisualComponent<YearDropProps> = {id: 'year-drop', layer: 'fullscreen', duration: yearDropDuration,
  textLimits: yearDropTextLimits, repair: repairYearDrop, render: YearDrop};
