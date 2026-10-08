import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairQuote, quoteTokens, quoteDuration, quoteTextLimits, type QuoteProps} from './quote-contract.ts';
import {quoteState} from './quote-state.ts';
export const Quote: React.FC<ComponentRenderProps<QuoteProps>> = ({props, skin, context}) => {
  const safe = repairQuote(props);
  if (!safe || !validContext(context, quoteDuration)) return null;
  const words = quoteTokens(safe.quote);
  const state = quoteState(context, skin, words.length), token = skin.quote;
  const scale = context.width / 1920;
  const width = Math.min(token.maxWidth, 1920 - 2 * token.inset);
  const title = skin.fonts.title, label = skin.fonts.label, body = skin.fonts.body;
  const quoteSize = Math.min(token.fontSize, width * 4 / ((safe.quote.length + 1) * 1.1));
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text,
    justifyContent: 'center', padding: token.inset * scale, boxSizing: 'border-box', overflow: 'hidden'}}>
    <div style={{maxWidth: width * scale, opacity: state.opacity, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
      <div style={{fontFamily: title.family, fontWeight: title.weight, letterSpacing: title.letterSpacing * scale,
        fontSize: quoteSize * scale, lineHeight: 1.2, paddingBottom: '0.12em'}}>
        {words.map((word, i) => <span key={i} style={{opacity: state.words[i]}}>{word}</span>)}
      </div>
      <div style={{marginTop: token.gap * scale, opacity: state.attribution,
        transform: `translateY(${(1 - state.attribution) * token.riseDistance * scale}px)`,
        fontFamily: label.family, fontWeight: label.weight, letterSpacing: label.letterSpacing * scale,
        fontSize: token.attributionSize * scale, lineHeight: 1.25, color: skin.palette.accent}}>{safe.attribution}</div>
      {safe.context && <div style={{marginTop: token.gap * scale / 2, opacity: state.context,
        fontFamily: body.family, fontWeight: body.weight, letterSpacing: body.letterSpacing * scale,
        fontSize: token.contextSize * scale, lineHeight: 1.3, color: skin.palette.muted}}>{safe.context}</div>}
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const quote: VisualComponent<QuoteProps> = {id: 'quote', layer: 'fullscreen', duration: quoteDuration,
  textLimits: quoteTextLimits, repair: repairQuote, render: Quote};
