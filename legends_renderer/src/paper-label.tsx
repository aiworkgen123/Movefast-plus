import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {paperLabelDuration, paperLabelTextLimits, repairPaperLabel, type PaperLabelProps} from './paper-label-contract.ts';
import {paperLabelSpec, paperLabelWipe, tornEdge} from './paper-label-state.ts';
export const PaperLabel: React.FC<ComponentRenderProps<PaperLabelProps>> = ({props, skin, context}) => {
  const safe = repairPaperLabel(props);
  if (!safe || !validContext(context, paperLabelDuration)) return null;
  const s = context.width / 1920, k = paperLabelSpec, look = skin.stage, p = paperLabelWipe(context.frame / context.fps);
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: k.left * s, top: k.top * s, height: k.height * s, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`}}>
      <div style={{position: 'absolute', inset: 0, backgroundColor: look.paperWhite, clipPath: tornEdge(safe.text)}} />
      <div style={{position: 'relative', padding: `${(k.capTop - k.top - 0.1555 * k.size) * s}px ${(k.padRight - k.tracking * k.size) * s}px 0 ${k.padLeft * s}px`,
        fontFamily: look.heavy.family, fontWeight: 800, fontSize: k.size * s, lineHeight: 1, letterSpacing: `${k.tracking}em`, whiteSpace: 'pre', color: look.paperText}}>{safe.text.toUpperCase()}</div>
    </div>
  </AbsoluteFill>;
};
export const paperLabel: VisualComponent<PaperLabelProps> = {id: 'paper-label', layer: 'fullscreen', duration: paperLabelDuration,
  textLimits: paperLabelTextLimits, repair: repairPaperLabel, render: PaperLabel};
