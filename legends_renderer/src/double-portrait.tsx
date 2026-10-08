import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {doublePortraitDuration, doublePortraitTextLimits, repairDoublePortrait, type DoublePortraitProps} from './double-portrait-contract.ts';
import {doublePortraitSpec, doublePortraitState, letterAlpha} from './double-portrait-state.ts';
export const DoublePortrait: React.FC<ComponentRenderProps<DoublePortraitProps>> = ({props, skin, context}) => {
  const safe = repairDoublePortrait(props);
  if (!safe || !validContext(context, doublePortraitDuration)) return null;
  const s = context.width / 1920, look = skin.stage, k = doublePortraitSpec, t = context.frame / context.fps, st = doublePortraitState(t);
  const typed = (text: string, l: typeof k.name | typeof k.role, weight: number, offset: number) => <div style={{position: 'absolute', left: l.left * s,
    top: (l.capTop - offset * l.size) * s, fontFamily: look.heavy.family, fontWeight: weight, fontSize: l.size * s, lineHeight: 1, letterSpacing: `${l.tracking}em`,
    whiteSpace: 'pre', color: look.onMedia, textShadow: `0 ${2 * s}px ${10 * s}px rgba(0,0,0,.5)`}}>
    {Array.from(text.toUpperCase()).map((c, i) => <span key={i} style={{opacity: letterAlpha(t, l.start, l.rate, i)}}>{c}</span>)}</div>;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <AbsoluteFill style={{transform: `scale(${st.zoom})`, transformOrigin: k.zoomOrigin}}><FrameMediaView media={safe.media} context={context} fit="cover" /></AbsoluteFill>
    {typed(safe.name, k.name, 800, 0.1555)}
    {safe.role ? typed(safe.role, k.role, 500, 0.15) : null}
    <svg width={context.width} height={context.height} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}} aria-hidden="true">
      <defs><marker id={`dp-head-${skin.id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={look.onMedia} /></marker></defs>
      <path d={k.arrow.path} pathLength={1} fill="none" stroke={look.onMedia} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${st.arrow} 1`}
        style={{filter: `drop-shadow(0 0 4px rgba(255,255,255,.35))`}} markerEnd={st.arrow > 0.97 ? `url(#dp-head-${skin.id})` : undefined} />
    </svg>
    <Img src={staticFile(safe.portrait.path)} style={{position: 'absolute', left: 0, bottom: 0, width: k.portrait.width * s, height: k.portrait.height * s,
      objectFit: 'contain', objectPosition: '0% 100%', transformOrigin: '0% 100%', transform: `scale(${st.grow})`}} />
  </AbsoluteFill>;
};
export const doublePortrait: VisualComponent<DoublePortraitProps> = {id: 'double-portrait', layer: 'fullscreen', duration: doublePortraitDuration,
  textLimits: doublePortraitTextLimits, repair: repairDoublePortrait, render: DoublePortrait};
