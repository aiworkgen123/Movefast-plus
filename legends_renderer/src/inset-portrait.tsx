import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {progress} from './motion.ts';
import {insetPortraitDuration, insetPortraitTextLimits, repairInsetPortrait, type InsetPortraitProps} from './inset-portrait-contract.ts';
import {insetPortraitSpec, capTop, ascTop} from './inset-portrait-state.ts';
export const InsetPortrait: React.FC<ComponentRenderProps<InsetPortraitProps>> = ({props, skin, context}) => {
  const safe = repairInsetPortrait(props);
  if (!safe || !validContext(context, insetPortraitDuration)) return null;
  const s = context.width / 1920, look = skin.stage, k = insetPortraitSpec, t = context.frame / context.fps, fr = k.frame;
  const fade = (r: readonly number[]) => progress(t, r[0], r[1], 'out-cubic');
  const text = (value: string, l: typeof k.name | typeof k.role, weight: number, top: number) => <div style={{position: 'absolute', left: l.left * s,
    top: (l.inkTop - top * l.size) * s, fontFamily: look.heavy.family, fontWeight: weight, fontSize: l.size * s, lineHeight: 1,
    letterSpacing: `${l.tracking}em`, whiteSpace: 'pre', color: look.onMedia, opacity: fade(l.fade), textShadow: `0 ${2 * s}px ${10 * s}px rgba(0,0,0,.35)`}}>{value}</div>;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <AbsoluteFill style={{transform: `scale(${k.footage.scale})`, filter: `blur(${k.footage.blur * s}px) brightness(${k.footage.brightness})`}}>
      <FrameMediaView media={safe.media} context={context} fit="cover" />
    </AbsoluteFill>
    {text(safe.name, k.name, 800, capTop)}
    {safe.role ? text(safe.role, k.role, 500, ascTop) : null}
    <div style={{position: 'absolute', left: fr.x * s, top: fr.y * s, width: fr.width * s, height: fr.height * s, opacity: fade(fr.fade),
      boxSizing: 'border-box', border: `${fr.border * s}px solid ${look.blue}`, boxShadow: `0 ${8 * s}px ${16 * s}px rgba(0,0,0,.25)`}}>
      <Img src={staticFile(safe.portrait.path)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 0%'}} />
    </div>
  </AbsoluteFill>;
};
export const insetPortrait: VisualComponent<InsetPortraitProps> = {id: 'inset-portrait', layer: 'fullscreen', duration: insetPortraitDuration,
  textLimits: insetPortraitTextLimits, repair: repairInsetPortrait, render: InsetPortrait};
