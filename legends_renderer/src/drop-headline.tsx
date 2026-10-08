import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {dropHeadlineDuration, dropHeadlineTextLimits, repairDropHeadline, type DropHeadlineProps} from './drop-headline-contract.ts';
import {dropHeadlineCamera, dropHeadlineLetters, dropHeadlineSpec as spec} from './drop-headline-state.ts';
export const DropHeadline: React.FC<ComponentRenderProps<DropHeadlineProps>> = ({props, skin, context}) => {
  const safe = repairDropHeadline(props);
  if (!safe || !validContext(context, dropHeadlineDuration)) return null;
  const s = context.width / 1920, look = skin.stage, cam = dropHeadlineCamera(context), letters = dropHeadlineLetters(context, safe);
  const words = safe.text.toUpperCase().split(/\s+/u);
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <AbsoluteFill style={{transform: `scale(${cam.scale * spec.mediaScale})`}}>
      <FrameMediaView media={safe.media} context={context} fit="cover" />
      <AbsoluteFill style={{backgroundColor: `rgba(0,0,0,${cam.dim})`}} />
    </AbsoluteFill>
    <AbsoluteFill style={{transform: `scale(${cam.scale})`, transformOrigin: `${spec.centreX * s}px ${spec.centreY * s}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{maxWidth: spec.maxWidth * s, textAlign: 'center', fontFamily: look.heavy.family, fontWeight: look.heavy.weight,
        letterSpacing: `${spec.tracking}em`, whiteSpace: 'break-spaces', fontSize: spec.fontSize * s, lineHeight: spec.lineHeight, color: look.onMedia,
        textShadow: `0 ${3 * s}px ${16 * s}px ${look.shadow}`}}>
        {words.map((word, w) => <React.Fragment key={w}>
          <span style={{whiteSpace: 'nowrap'}}>{Array.from(word).map((ch, i) => {
            const l = letters[w][i];
            return <span key={i} style={{display: 'inline-block', opacity: l.opacity, transform: `translateY(${l.dy * s}px) rotate(${l.tilt}deg)`}}>{ch}</span>;
          })}</span>{w < words.length - 1 ? ' ' : ''}
        </React.Fragment>)}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
};
export const dropHeadline: VisualComponent<DropHeadlineProps> = {id: 'drop-headline', layer: 'fullscreen', duration: dropHeadlineDuration,
  textLimits: dropHeadlineTextLimits, repair: repairDropHeadline, render: DropHeadline};
