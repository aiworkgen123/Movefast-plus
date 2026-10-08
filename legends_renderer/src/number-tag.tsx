import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {numberTagDuration, numberTagTextLimits, repairNumberTag, type NumberTagProps} from './number-tag-contract.ts';
import {formatThousands, numberTagSpec as k, numberTagState} from './number-tag-state.ts';
export const NumberTag: React.FC<ComponentRenderProps<NumberTagProps>> = ({props, skin, context}) => {
  const safe = repairNumberTag(props);
  if (!safe || !validContext(context, numberTagDuration)) return null;
  const s = context.width / 1920, look = skin.stage, st = numberTagState(context.frame / context.fps, safe.value), n = k.number, g = k.tag;
  // Lay out with the final value (tabular width is not guaranteed), so the tag stays centred under the finished number.
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: (n.left - 0.06 * n.size) * s, top: (n.top - 0.134 * n.size) * s, display: 'inline-flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{position: 'relative', fontFamily: look.heavy.family, fontWeight: 900, fontSize: n.size * s, lineHeight: 1, letterSpacing: `${n.tracking}em`, whiteSpace: 'pre', color: look.onMedia,
        opacity: st.number, textShadow: `0 ${3 * s}px ${14 * s}px rgba(0,0,0,.35)`}}>
        <span style={{visibility: 'hidden'}}>{formatThousands(safe.value)}</span>
        <span style={{position: 'absolute', left: 0, top: 0}}>{formatThousands(st.shown)}</span>
      </div>
      <div style={{position: 'absolute', top: (g.top - (n.top - 0.134 * n.size)) * s, height: g.height * s, boxSizing: 'border-box', padding: `${(g.height - 0.728 * g.size) / 2 * s - 0.1555 * g.size * s - 4 * s}px ${g.padX * s}px 0`,
        backgroundColor: look.tagWhite, borderRadius: g.radius * s, fontFamily: look.heavy.family, fontWeight: 800, fontSize: g.size * s, lineHeight: 1, letterSpacing: `${g.tracking}em`,
        whiteSpace: 'pre', color: look.paperText, opacity: st.tag, transform: `translateX(${((st.tag - 1) * g.slide - n.tracking * n.size / 2) * s}px)`}}>{safe.unit.toUpperCase()}</div>
    </div>
  </AbsoluteFill>;
};
export const numberTag: VisualComponent<NumberTagProps> = {id: 'number-tag', layer: 'fullscreen', duration: numberTagDuration,
  textLimits: numberTagTextLimits, repair: repairNumberTag, render: NumberTag};
