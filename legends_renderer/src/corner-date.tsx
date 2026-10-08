import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {progress} from './motion.ts';
import {cornerDateDuration, cornerDateTextLimits, repairCornerDate, type CornerDateProps} from './corner-date-contract.ts';
import {cornerDateSpec, type Line} from './corner-date-state.ts';
export const CornerDate: React.FC<ComponentRenderProps<CornerDateProps>> = ({props, skin, context}) => {
  const safe = repairCornerDate(props);
  if (!safe || !validContext(context, cornerDateDuration)) return null;
  const s = context.width / 1920, look = skin.stage, k = cornerDateSpec, o = progress(context.frame / context.fps, 0, k.fade, 'out-cubic');
  const line = (text: string, t: Line, weight: number) => <div style={{position: 'absolute', left: t.left * s, top: t.top * s, fontFamily: look.heavy.family,
    fontWeight: weight, fontSize: t.size * s, lineHeight: 1, letterSpacing: `${t.tracking}em`, whiteSpace: 'pre', color: look.onMedia, opacity: o,
    textShadow: `0 ${2 * s}px ${12 * s}px rgba(0,0,0,.5)`}}>{text}</div>;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    {line(safe.date, k.date, 700)}{safe.year ? line(safe.year, k.year, 400) : null}
  </AbsoluteFill>;
};
export const cornerDate: VisualComponent<CornerDateProps> = {id: 'corner-date', layer: 'fullscreen', duration: cornerDateDuration,
  textLimits: cornerDateTextLimits, repair: repairCornerDate, render: CornerDate};
