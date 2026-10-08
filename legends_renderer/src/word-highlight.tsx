import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {findHighlightSpan, repairWordHighlight, wordHighlightDuration, wordHighlightTextLimits, type WordHighlightProps} from './word-highlight-contract.ts';
import {wordHighlightState} from './word-highlight-state.ts';
export const WordHighlight: React.FC<ComponentRenderProps<WordHighlightProps>> = ({props, skin, context}) => {
  const safe = repairWordHighlight(props);
  if (!safe || !validContext(context, wordHighlightDuration)) return null;
  const span = findHighlightSpan(safe.text, safe.highlight)!;
  const selected = safe.text.slice(span.start, span.end);
  const state = wordHighlightState(context, skin);
  const scale = context.width / 1920;
  const font = skin.fonts[skin.highlight.font];
  const width = Math.min(skin.highlight.maxWidth, 1920 - 2 * skin.highlight.inset);
  const size = Math.min(skin.highlight.fontSize, (width - selected.length * font.letterSpacing) / ((selected.length + 1) * 1.15));
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text,
    justifyContent: 'center', padding: skin.highlight.inset * scale, boxSizing: 'border-box', overflow: 'hidden'}}>
    <div style={{maxWidth: width * scale, opacity: state.opacity, transform: `translateY(${state.translateY * scale}px)`,
      fontFamily: font.family, fontWeight: font.weight, letterSpacing: font.letterSpacing * scale,
      fontSize: size * scale, lineHeight: 1.15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
      {safe.text.slice(0, span.start)}<span style={{position: 'relative', display: 'inline-block', whiteSpace: 'nowrap'}}>
        <span aria-hidden="true" style={{position: 'absolute', inset: 0, backgroundColor: skin.palette.accent,
          opacity: skin.highlight.markerOpacity, transform: `scaleX(${state.markerScale})`, transformOrigin: 'left center'}} />
        <span style={{position: 'relative'}}>{selected}</span>
      </span>{safe.text.slice(span.end)}
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const wordHighlight: VisualComponent<WordHighlightProps> = {id: 'word-highlight', layer: 'fullscreen',
  duration: wordHighlightDuration, textLimits: wordHighlightTextLimits, repair: repairWordHighlight, render: WordHighlight};
