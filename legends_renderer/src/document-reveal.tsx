import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairDocumentReveal, documentRevealDuration, documentRevealTextLimits, type DocumentRevealProps} from './document-reveal-contract.ts';
import {documentRevealState} from './document-reveal-state.ts';
import {SkinGrade, SkinOverlays, SkinSurface} from './skin-layers.tsx';
export const DocumentReveal: React.FC<ComponentRenderProps<DocumentRevealProps>> = ({props, skin, context}) => {
  const safe = repairDocumentReveal(props);
  if (!safe || !validContext(context, documentRevealDuration)) return null;
  const state = documentRevealState(context, skin, safe), token = skin.documentReveal;
  const scale = context.width / 1920, title = skin.fonts.title, label = skin.fonts.label;
  const view = state.overview, detail = state.detailFrame;
  const src = staticFile(safe.source.path);
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, overflow: 'hidden', color: skin.palette.text}}>
    <AbsoluteFill style={{opacity: state.opacity}}>
      <div style={{position: 'absolute', left: view.x, top: view.y, width: view.width, height: view.height, overflow: 'hidden'}}>
        <SkinGrade skin={skin}><Img src={src} style={{width: '100%', height: '100%'}} /></SkinGrade>
        <div aria-hidden="true" style={{position: 'absolute', left: `${safe.detail.x * 100}%`, top: `${safe.detail.y * 100}%`,
          width: `${safe.detail.width * 100}%`, height: `${safe.detail.height * 100}%`, boxSizing: 'border-box',
          border: `${token.borderWidth * scale}px solid ${skin.palette.accent}`, opacity: state.detailOpacity}} />
      </div>
      <div style={{position: 'absolute', left: detail.x, top: detail.y, width: detail.width, height: detail.height,
        overflow: 'hidden', opacity: state.detailOpacity, outline: `${token.borderWidth * scale}px solid ${skin.palette.accent}`}}>
        <SkinGrade skin={skin}><Img src={src} style={{position: 'absolute', left: -state.crop.x * detail.scale,
          top: -state.crop.y * detail.scale, width: safe.source.width * detail.scale, height: safe.source.height * detail.scale}} /></SkinGrade>
      </div>
      <SkinOverlays skin={skin} context={context} archive={false} />
      <div style={{position: 'absolute', left: token.inset * scale, right: token.inset * scale,
        top: context.height * token.titleTopFraction, fontFamily: title.family, fontWeight: title.weight,
        letterSpacing: title.letterSpacing * scale, fontSize: token.titleSize * scale, lineHeight: 1.12,
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{safe.title}</div>
      {safe.detailLabel && <div style={{position: 'absolute', left: state.detailViewport.x, width: state.detailViewport.width,
        top: context.height * token.labelTopFraction, opacity: state.detailOpacity, fontFamily: label.family,
        fontWeight: label.weight, letterSpacing: label.letterSpacing * scale, fontSize: token.labelSize * scale,
        lineHeight: 1.25, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{safe.detailLabel}</div>}
    </AbsoluteFill>
  <SkinSurface skin={skin} context={context} dust={false}/></AbsoluteFill>;
};
export const documentReveal: VisualComponent<DocumentRevealProps> = {id: 'document-reveal', layer: 'fullscreen',
  duration: documentRevealDuration, textLimits: documentRevealTextLimits, repair: repairDocumentReveal, render: DocumentReveal};
