import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {insetClipDuration, insetClipTextLimits, repairInsetClip, type InsetClipProps} from './inset-clip-contract.ts';
import {insetClipSpec, insetClipState} from './inset-clip-state.ts';
export const InsetClip: React.FC<ComponentRenderProps<InsetClipProps>> = ({props, skin, context}) => {
  const safe = repairInsetClip(props);
  if (!safe || !validContext(context, insetClipDuration)) return null;
  const s = context.width / 1920, look = skin.stage, k = insetClipSpec, st = insetClipState(context.frame / context.fps), c = k.card;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <AbsoluteFill style={{filter: `blur(${(safe.backdrop === 'dim' ? k.dim : k.bg).blur * s}px) brightness(${(safe.backdrop === 'dim' ? k.dim : k.bg).brightness})`}}><FrameMediaView media={safe.media} context={context} fit="contain" /></AbsoluteFill>
    <div style={{position: 'absolute', left: (c.x - c.width / 2) * s, top: (c.y - c.height / 2) * s, width: c.width * s, height: c.height * s,
      borderRadius: c.radius * s, overflow: 'hidden', backgroundColor: '#000', outline: `${1.5 * s}px solid rgba(255,255,255,.16)`, boxShadow: `0 ${10 * s}px ${30 * s}px rgba(0,0,0,.45)`,
      transform: `translateX(${st.dx * s}px) rotate(${st.rotate}deg) scale(${st.scale})`}}>
      <FrameMediaView media={safe.media} context={context} fit="contain" />
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: k.chip.top * s, textAlign: 'center', opacity: st.chip}}>
      <span style={{display: 'inline-block', height: k.chip.height * s, boxSizing: 'border-box', padding: `${(k.chip.capTop - k.chip.top - 0.1555 * k.chip.size) * s}px ${k.chip.padX * s}px 0`,
        backgroundColor: look.chip, borderRadius: 10 * s, fontFamily: look.heavy.family, fontWeight: 800, fontSize: k.chip.size * s, lineHeight: 1, letterSpacing: `${k.chip.tracking}em`,
        whiteSpace: 'pre', color: look.chipText}}>{safe.caption}</span>
    </div>
  </AbsoluteFill>;
};
export const insetClip: VisualComponent<InsetClipProps> = {id: 'inset-clip', layer: 'fullscreen', duration: insetClipDuration,
  textLimits: insetClipTextLimits, repair: repairInsetClip, render: InsetClip};
