import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {boxedTitleDuration, boxedTitleTextLimits, repairBoxedTitle, type BoxedTitleProps} from './boxed-title-contract.ts';
import {boxedTitleSpec, boxedTitleState, capOffset} from './boxed-title-state.ts';
export const BoxedTitle: React.FC<ComponentRenderProps<BoxedTitleProps>> = ({props, skin, context}) => {
  const safe = repairBoxedTitle(props);
  if (!safe || !validContext(context, boxedTitleDuration)) return null;
  const s = context.width / 1920, k = boxedTitleSpec, look = skin.stage, chars = Array.from(safe.text);
  const st = boxedTitleState(context.frame / context.fps, chars.length);
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: 0, right: 0, top: (k.capTop - k.pad.top) * s, textAlign: 'center'}}>
      <div style={{position: 'relative', display: 'inline-block', padding: `${(k.pad.top - capOffset * k.size) * s}px ${k.pad.right * s}px 0 ${k.pad.left * s}px`,
        height: (k.pad.top + 0.7 * k.size * 1.04 + k.pad.bottom - 3) * s, boxSizing: 'border-box'}}>
        <div style={{position: 'absolute', inset: 0, backgroundColor: `rgba(0,0,0,${k.shade})`, clipPath: `inset(0 ${(1 - st.box) * 100}% 0 0)`}} />
        <div style={{position: 'relative', fontFamily: look.heavy.family, fontWeight: 800, fontSize: k.size * s, lineHeight: 1, whiteSpace: 'pre', color: look.onMedia, textShadow: `0 ${4 * s}px ${12 * s}px rgba(0,0,0,.45)`}}>
          {chars.map((c, i) => <span key={i} style={{opacity: i < st.chars ? 1 : 0}}>{c}</span>)}
        </div>
      </div>
    </div>
  </AbsoluteFill>;
};
export const boxedTitle: VisualComponent<BoxedTitleProps> = {id: 'boxed-title', layer: 'fullscreen', duration: boxedTitleDuration,
  textLimits: boxedTitleTextLimits, repair: repairBoxedTitle, render: BoxedTitle};
