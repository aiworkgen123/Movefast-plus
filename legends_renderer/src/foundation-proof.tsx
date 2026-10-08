import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {foundationTextLimits as textLimits, foundationDuration as duration, repairFoundation as repair, type FoundationProps} from './foundation-contract.ts';
import {entranceOpacity, progress} from './motion.ts';
import {SkinGrade, SkinOverlays, SkinSurface} from './skin-layers.tsx';

/** Token proof only: this is not a catalogue archetype or a production scene. */
export const FoundationProof: React.FC<ComponentRenderProps<FoundationProps>> = ({props, skin, context}) => {
  const safe = repair(props);
  if (!safe || !validContext(context, duration)) return null;
  const opacity = entranceOpacity(context, skin);
  const camera = progress(context.frame, 0, context.durationInFrames - 1, skin.motion.camera);
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, overflow: 'hidden'}}>
    <SkinGrade skin={skin}>
      <AbsoluteFill style={{transform: `scale(${1 + camera * 0.12})`, background: `radial-gradient(ellipse at 78% 35%, ${skin.palette.secondary}, ${skin.palette.background} 75%)`}}>
        <div style={{position: 'absolute', right: 220, top: 210, width: 300, height: 600, backgroundColor: skin.palette.accent, opacity: 0.3, transform: `translateY(${camera * -60}px)`}} />
      </AbsoluteFill>
    </SkinGrade>
    <SkinOverlays skin={skin} context={context} archive={safe.archive} />
    <div style={{position: 'absolute', left: 138, bottom: 180, maxWidth: 1350, opacity, transform: `translateY(${(1 - opacity) * 24}px)`}}>
      <div style={{display: 'inline-block', fontFamily: skin.fonts.label.family, fontWeight: skin.fonts.label.weight, letterSpacing: skin.fonts.label.letterSpacing, fontSize: 54, color: skin.palette.text, backgroundColor: skin.label.background, padding: `${skin.label.padding[0]}px ${skin.label.padding[1]}px`, borderLeft: skin.label.accentWidth ? `${skin.label.accentWidth}px solid ${skin.palette.accent}` : undefined}}>{safe.label}</div>
      <div style={{marginTop: 32, color: skin.palette.text, fontFamily: skin.fonts.title.family, fontWeight: skin.fonts.title.weight, letterSpacing: skin.fonts.title.letterSpacing, fontSize: 110, lineHeight: 1.04, overflowWrap: 'anywhere'}}>{safe.title}</div>
      <div style={{marginTop: 24, display: 'flex', gap: 14}}>{[skin.palette.accent, skin.palette.secondary, skin.palette.warn, skin.palette.good].map((color, i) => <div key={i} style={{width: 70, height: 12, backgroundColor: color}} />)}</div>
    </div>
  <SkinSurface skin={skin} context={context} dust={false}/></AbsoluteFill>;
};

export const foundationProof: VisualComponent<FoundationProps> = {id: 'foundation-proof', layer: 'fullscreen', duration, textLimits, repair, render: FoundationProof};
