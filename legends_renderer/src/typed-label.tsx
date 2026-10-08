import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {repairTypedLabel, typedLabelDuration, typedLabelTextLimits, type TypedLabelProps} from './typed-label-contract.ts';
import {typedLabelSpec as k, typedLabelState} from './typed-label-state.ts';
export const TypedLabel: React.FC<ComponentRenderProps<TypedLabelProps>> = ({props, skin, context}) => {
  const safe = repairTypedLabel(props);
  if (!safe || !validContext(context, typedLabelDuration)) return null;
  const s = context.width / 1920, look = skin.stage, st = typedLabelState(context, safe.name, safe.role);
  const line = (text: string, chars: number, top: number, cursor: boolean) => <div style={{position: 'absolute', left: k.left * s, top: top * s,
    fontFamily: look.heavy.family, fontWeight: 700, fontSize: k.size * s, lineHeight: 1, letterSpacing: `${k.tracking}em`, whiteSpace: 'pre', color: look.onMedia,
    textShadow: `0 ${2 * s}px ${12 * s}px rgba(0,0,0,.5)`}}>{Array.from(text).slice(0, chars).join('')}{cursor ? '|' : ''}</div>;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    {line(safe.name, st.nameChars, st.nameUp ? k.lowerTop - k.pitch : k.lowerTop, st.cursorOn && st.cursorLine === 'name')}
    {safe.role && st.roleChars > 0 ? line(safe.role, st.roleChars, k.lowerTop, st.cursorOn && st.cursorLine === 'role') : null}
  </AbsoluteFill>;
};
export const typedLabel: VisualComponent<TypedLabelProps> = {id: 'typed-label', layer: 'fullscreen', duration: typedLabelDuration,
  textLimits: typedLabelTextLimits, repair: repairTypedLabel, render: TypedLabel};
