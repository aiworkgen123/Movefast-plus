import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairEmphasis, emphasisDuration, emphasisTextLimits, type EmphasisProps} from './emphasis-contract.ts';
import {emphasisState} from './emphasis-state.ts';
export const Emphasis: React.FC<ComponentRenderProps<EmphasisProps>> = ({props, skin, context}) => {
  const safe = repairEmphasis(props);
  if (!safe || !validContext(context, emphasisDuration)) return null;
  const state = emphasisState(context, skin);
  const scale = context.width / 1920;
  return <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: skin.emphasis.inset * scale,
      bottom: skin.emphasis.bottom * context.height / 1080,
      maxWidth: Math.min(skin.emphasis.maxWidth * scale, context.width - 2 * skin.emphasis.inset * scale),
      fontFamily: skin.fonts.title.family, fontWeight: skin.fonts.title.weight,
      letterSpacing: skin.fonts.title.letterSpacing * scale, fontSize: skin.emphasis.fontSize * scale,
      color: skin.palette.text, lineHeight: 1.08, paddingBottom: '0.12em', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      textShadow: `0 4px 20px ${skin.palette.background}`, opacity: state.opacity,
      transform: `translateY(${state.translateY * scale}px)`, clipPath: `inset(0 ${state.clipRightPercent}% 0 0)`}}>{safe.text}</div>
  </AbsoluteFill>;
};
export const emphasis: VisualComponent<EmphasisProps> = {id: 'emphasis', layer: 'overlay', duration: emphasisDuration,
  textLimits: emphasisTextLimits, repair: repairEmphasis, render: Emphasis};
