import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairChapterCard, chapterCardDuration, chapterCardTextLimits, type ChapterCardProps} from './chapter-card-contract.ts';
import {chapterCardState} from './chapter-card-state.ts';
export const ChapterCard: React.FC<ComponentRenderProps<ChapterCardProps>> = ({props, skin, context}) => {
  const safe = repairChapterCard(props);
  if (!safe || !validContext(context, chapterCardDuration)) return null;
  const state = chapterCardState(context, skin), token = skin.chapterCard;
  const scale = context.width / 1920;
  const width = 1920 - token.inset * 2 - token.numberWidth - token.gap;
  const title = skin.fonts.title, label = skin.fonts.label, body = skin.fonts.body;
  const titleSize = Math.min(token.titleSize, width * 2.2 / ((safe.title.length + 1) * 1.1));
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text,
    justifyContent: 'center', padding: token.inset * scale, boxSizing: 'border-box', overflow: 'hidden'}}>
    <div style={{display: 'grid', gridTemplateColumns: `${token.numberWidth * scale}px minmax(0, 1fr)`,
      gap: token.gap * scale, alignItems: 'center', opacity: state.opacity}}>
      <div style={{opacity: state.number, transform: `translateX(${state.numberX * scale}px)`,
        fontFamily: label.family, fontWeight: label.weight, letterSpacing: label.letterSpacing * scale,
        fontSize: token.numberSize * scale, lineHeight: 1.12, color: skin.palette.accent,
        fontVariantNumeric: 'tabular-nums', textAlign: 'center'}}>{safe.chapter}</div>
      <div style={{minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
        <div style={{opacity: state.title, transform: `translateY(${state.titleY * scale}px)`,
          fontFamily: title.family, fontWeight: title.weight, letterSpacing: title.letterSpacing * scale,
          fontSize: titleSize * scale, lineHeight: 1.15, paddingBottom: '0.12em'}}>{safe.title}</div>
        {safe.subtitle && <div style={{marginTop: token.subtitleGap * scale, opacity: state.subtitle,
          fontFamily: body.family, fontWeight: body.weight, letterSpacing: body.letterSpacing * scale,
          fontSize: token.subtitleSize * scale, lineHeight: 1.3, color: skin.palette.muted}}>{safe.subtitle}</div>}
      </div>
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const chapterCard: VisualComponent<ChapterCardProps> = {id: 'chapter-card', layer: 'fullscreen', duration: chapterCardDuration,
  textLimits: chapterCardTextLimits, repair: repairChapterCard, render: ChapterCard};
