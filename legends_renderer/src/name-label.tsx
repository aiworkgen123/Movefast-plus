import {skinLabelClipPath} from './skins.ts';
import {SkinPaper} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {nameLabelDuration, nameLabelTextLimits, repairNameLabel, type NameLabelProps} from './name-label-contract.ts';
import {nameLabelState} from './name-label-state.ts';

/** Transparent overlay: only the compact label box paints a background. */
export const NameLabel: React.FC<ComponentRenderProps<NameLabelProps>> = ({props, skin, context}) => {
  const safe = repairNameLabel(props);
  if (!safe || !validContext(context, nameLabelDuration)) return null;
  const state = nameLabelState(context, skin, safe.position);
  const layout = skin.label.lowerThird;
  const scale = context.width / 1920;
  const nameFont = skin.fonts[layout.nameFont];
  const roleFont = skin.fonts[layout.roleFont];
  const accent = `${skin.label.accentWidth * scale}px solid ${skin.palette.accent}`;
  return <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
    <div style={{position: 'absolute', [safe.position]: layout.inset * scale,
      bottom: layout.bottom * context.height / 1080,
      maxWidth: Math.min(layout.maxWidth * scale, context.width - 2 * layout.inset * scale),
      boxSizing: 'border-box', padding: `${skin.label.padding[0] * scale}px ${skin.label.padding[1] * scale}px`,
      backgroundColor: skin.label.background, color: skin.palette.text, clipPath:skinLabelClipPath(skin,scale),overflow:'hidden',
      borderLeft: safe.position === 'left' ? accent : undefined,
      borderRight: safe.position === 'right' ? accent : undefined,
      textAlign: safe.position, opacity: state.opacity, transform: `translateX(${state.translateX * scale}px)`}}>
      <SkinPaper skin={skin}/>
      <div style={{position:'relative', fontFamily: nameFont.family, fontWeight: nameFont.weight, letterSpacing: nameFont.letterSpacing * scale,
        fontSize: layout.nameSize * scale, lineHeight: 1.08, overflowWrap: 'anywhere'}}>{safe.name}</div>
      {safe.role ? <div style={{fontFamily: roleFont.family, fontWeight: roleFont.weight, letterSpacing: roleFont.letterSpacing * scale,
        fontSize: layout.roleSize * scale, lineHeight: 1.08, marginTop: layout.roleGap * scale,
        color: skin.palette.muted, opacity: state.roleOpacity, overflowWrap: 'anywhere'}}>{safe.role}</div> : null}
    </div>
  </AbsoluteFill>;
};

export const nameLabel: VisualComponent<NameLabelProps> = {id: 'name-label', layer: 'overlay', duration: nameLabelDuration,
  textLimits: nameLabelTextLimits, repair: repairNameLabel, render: NameLabel};
