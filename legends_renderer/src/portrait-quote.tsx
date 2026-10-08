import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {portraitQuoteDuration, portraitQuoteTextLimits, repairPortraitQuote, type PortraitQuoteProps} from './portrait-quote-contract.ts';
import {portraitQuoteSpec as k, portraitSpread, typedCount} from './portrait-quote-state.ts';
const Typed: React.FC<{text: string; from: number; shown: number}> = ({text, from, shown}) =>
  <>{Array.from(text).map((c, i) => <span key={i} style={{opacity: from + i < shown ? 1 : 0}}>{c}</span>)}</>;
export const PortraitQuote: React.FC<ComponentRenderProps<PortraitQuoteProps>> = ({props, skin, context}) => {
  const safe = repairPortraitQuote(props);
  if (!safe || !validContext(context, portraitQuoteDuration)) return null;
  const s = context.width / 1920, look = skin.stage, t = context.frame / context.fps, ry = portraitSpread(t), shown = typedCount(t), b = k.box, id = `pq-ink-${skin.id}`;
  const q = `"${safe.quote.replace(/^["“]|["”]$/gu, '')}" `, a = `— ${safe.author}`;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: look.stageNavy}}>
    <svg width="0" height="0" style={{position: 'absolute'}}><defs>
      <filter id={`${id}-f`}><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale={28 * s} /></filter>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={b.width * s} height={b.height * s}>
        <ellipse cx={(k.centre.x - b.x) * s} cy={(k.centre.y - b.y) * s} rx={ry * k.aspect * s} ry={ry * s} fill="white" filter={`url(#${id}-f)`} />
      </mask></defs></svg>
    <div style={{position: 'absolute', left: b.x * s, top: b.y * s, width: b.width * s, height: b.height * s}}>
      <svg width={b.width * s} height={b.height * s} style={{position: 'absolute', inset: 0}}>
        <image href={staticFile(safe.portrait.path)} x="0" y="0" width={b.width * s} height={b.height * s} preserveAspectRatio="xMidYMax meet" mask={`url(#${id})`} />
      </svg>
    </div>
    <div style={{position: 'absolute', left: k.quote.left * s, top: (k.quote.inkTop - 0.17 * k.quote.size - (k.quote.pitch - k.quote.size) / 2) * s, width: k.quote.width * s,
      fontSize: k.quote.size * s, lineHeight: `${k.quote.pitch * s}px`}}>
      <span style={{fontFamily: look.quote.family, fontStyle: 'italic', fontWeight: look.quote.weight, color: look.quoteText}}><Typed text={q} from={0} shown={shown} /></span>
      <span style={{fontFamily: look.news.family, fontStyle: 'italic', fontWeight: 800, fontSize: k.author.size * s, color: look.quoteBlue, whiteSpace: 'pre'}}><Typed text={a} from={q.length} shown={shown} /></span>
      {safe.role ? <div style={{marginTop: 26 * s, fontFamily: look.news.family, fontWeight: 400, fontSize: k.role.size * s, lineHeight: 1, color: look.quoteMuted}}>
        <Typed text={safe.role} from={q.length + a.length} shown={shown} /></div> : null}
    </div>
  </AbsoluteFill>;
};
export const portraitQuote: VisualComponent<PortraitQuoteProps> = {id: 'portrait-quote', layer: 'fullscreen', duration: portraitQuoteDuration,
  textLimits: portraitQuoteTextLimits, repair: repairPortraitQuote, render: PortraitQuote};
