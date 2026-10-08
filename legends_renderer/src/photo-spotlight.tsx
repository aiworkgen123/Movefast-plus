import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairPhotoSpotlight, photoSpotlightDuration, photoSpotlightTextLimits, type PhotoSpotlightProps} from './photo-spotlight-contract.ts';
import {photoSpotlightState} from './photo-spotlight-state.ts';
import {SkinGrade, SkinOverlays, SkinSurface} from './skin-layers.tsx';
export const PhotoSpotlight: React.FC<ComponentRenderProps<PhotoSpotlightProps>> = ({props, skin, context}) => {
  const safe = repairPhotoSpotlight(props);
  if (!safe || !validContext(context, photoSpotlightDuration)) return null;
  const state = photoSpotlightState(context, skin, safe), token = skin.photoSpotlight;
  const scale = context.width / 1920, label = skin.fonts.label;
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text, overflow: 'hidden'}}>
    <AbsoluteFill style={{opacity: state.opacity}}>
      <SkinGrade skin={skin}><Img src={staticFile(safe.source.path)} style={{position: 'absolute',
        left: state.x, top: state.y, width: state.width, height: state.height}} /></SkinGrade>
      <AbsoluteFill style={{opacity: state.vignetteOpacity, background: `radial-gradient(ellipse ${context.width * token.radiusXFraction}px ${context.height * token.radiusYFraction}px at ${state.focusScreen.x}px ${state.focusScreen.y}px, transparent ${token.clearFraction * 100}%, ${skin.palette.background} 100%)`}} />
      <SkinOverlays skin={skin} context={context} archive={false} />
      {safe.sourceCredit && <div style={{position: 'absolute', left: token.inset * scale, right: token.inset * scale,
        top: context.height * token.creditTopFraction, padding: token.creditPadding * scale, boxSizing: 'border-box',
        backgroundColor: skin.label.background, fontFamily: label.family, fontWeight: label.weight,
        letterSpacing: label.letterSpacing * scale, fontSize: token.creditSize * scale, lineHeight: 1.25,
        whiteSpace: 'normal', overflowWrap: 'anywhere'}}>{safe.sourceCredit}</div>}
    </AbsoluteFill>
  <SkinSurface skin={skin} context={context} dust={false}/></AbsoluteFill>;
};
export const photoSpotlight: VisualComponent<PhotoSpotlightProps> = {id: 'photo-spotlight', layer: 'fullscreen',
  duration: photoSpotlightDuration, textLimits: photoSpotlightTextLimits, repair: repairPhotoSpotlight, render: PhotoSpotlight};
