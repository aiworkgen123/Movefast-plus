import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairHeadlineArticle, headlineArticleDuration, headlineArticleTextLimits, type HeadlineArticleProps} from './headline-article-contract.ts';
import {headlineArticleState} from './headline-article-state.ts';
import {SkinGrade, SkinOverlays, SkinSurface} from './skin-layers.tsx';
export const HeadlineArticle: React.FC<ComponentRenderProps<HeadlineArticleProps>> = ({props, skin, context}) => {
  const safe = repairHeadlineArticle(props);
  if (!safe || !validContext(context, headlineArticleDuration)) return null;
  const state = headlineArticleState(context, skin, safe), token = skin.headlineArticle;
  const view = state.imageFrame, scale = context.width / 1920, label = skin.fonts.label;
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text, overflow: 'hidden'}}>
    <AbsoluteFill style={{opacity: state.opacity}}>
      <div style={{position: 'absolute', left: view.x, top: view.y, width: view.width, height: view.height, overflow: 'hidden'}}>
        <SkinGrade skin={skin}><Img src={staticFile(safe.source.path)} style={{position: 'absolute',
          left: -state.crop.x * view.scale, top: -state.crop.y * view.scale,
          width: safe.source.width * view.scale, height: safe.source.height * view.scale}} /></SkinGrade>
        <div aria-hidden="true" style={{position: 'absolute', left: state.marker.x, top: state.marker.y,
          width: state.marker.width, height: state.marker.height, backgroundColor: skin.palette.accent,
          opacity: token.markerOpacity, mixBlendMode: 'multiply', transform: `scaleX(${state.markerScale})`, transformOrigin: 'left center'}} />
      </div>
      <SkinOverlays skin={skin} context={context} archive={false} />
      <div style={{position: 'absolute', left: state.credit.x, top: state.credit.y, width: state.credit.width,
        boxSizing: 'border-box', padding: token.creditPadding * scale, backgroundColor: skin.label.background,
        fontFamily: label.family, fontWeight: label.weight, letterSpacing: label.letterSpacing * scale,
        fontSize: token.creditSize * scale, lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere'}}>{safe.sourceCredit}</div>
    </AbsoluteFill>
  <SkinSurface skin={skin} context={context} dust={false}/></AbsoluteFill>;
};
export const headlineArticle: VisualComponent<HeadlineArticleProps> = {id: 'headline-article', layer: 'fullscreen',
  duration: headlineArticleDuration, textLimits: headlineArticleTextLimits, repair: repairHeadlineArticle, render: HeadlineArticle};
