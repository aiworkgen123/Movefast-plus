import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {evidenceCalloutDuration, evidenceCalloutTextLimits, repairEvidenceCallout, type EvidenceCalloutProps} from './evidence-callout-contract.ts';
import {evidenceCalloutSpec, evidenceCalloutState} from './evidence-callout-state.ts';
export const EvidenceCallout: React.FC<ComponentRenderProps<EvidenceCalloutProps>> = ({props, skin, context}) => {
  const safe = repairEvidenceCallout(props);
  if (!safe || !validContext(context, evidenceCalloutDuration)) return null;
  const s = context.width / 1920, look = skin.stage, k = evidenceCalloutSpec, words = safe.body.split(/\s+/u);
  const st = evidenceCalloutState(context.frame / context.fps, words.length);
  const reach = Math.hypot(Math.max(k.circle.x, 1920 - k.circle.x), Math.max(k.circle.y, 1080 - k.circle.y)) * st.radius;
  const lead = (k.body.pitch - k.body.size) / 2;
  // Title, then a column whose left edge carries the bar; the bar and source follow the passage's real wrapped height.
  const text = (alpha: number, showWords: number, final: boolean) => <>
    <div style={{position: 'absolute', left: k.title.left * s, top: (k.title.capTop - 0.095 * k.title.size) * s, fontFamily: look.condensed.family,
      fontWeight: look.condensed.weight, fontSize: k.title.size * s, lineHeight: 1, letterSpacing: `${k.title.tracking}em`, whiteSpace: 'pre', color: look.onMedia, opacity: alpha}}>{safe.title}</div>
    <div style={{position: 'absolute', left: k.body.left * s, top: (k.body.capTop - 0.135 * k.body.size - lead) * s, width: k.body.width * s}}>
      <div style={{position: 'relative', fontFamily: look.news.family, fontWeight: look.news.weight, fontSize: k.body.size * s, lineHeight: `${k.body.pitch * s}px`,
        letterSpacing: `${k.body.tracking}em`, color: look.newsText, opacity: alpha}}>
        {final ? <div style={{position: 'absolute', left: (k.bar.left - k.body.left) * s, width: k.bar.width * s, top: (k.bar.top - (k.body.capTop - 0.135 * k.body.size - lead)) * s,
          bottom: (lead - k.bar.below) * s, borderRadius: k.bar.width * s / 2, backgroundColor: look.cyan, opacity: st.bar}} /> : null}
        {words.map((w, i) => <span key={i} style={{opacity: i < showWords ? 1 : 0}}>{w}{i < words.length - 1 ? ' ' : ''}</span>)}
      </div>
      {final && safe.source ? <div style={{marginTop: (k.source.gap - lead - 0.135 * k.source.size) * s, fontFamily: look.news.family, fontWeight: look.news.weight,
        fontSize: k.source.size * s, lineHeight: 1, letterSpacing: `${k.source.tracking}em`, whiteSpace: 'pre', color: look.newsSource, opacity: st.source}}>{safe.source}</div> : null}
    </div>
  </>;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    {st.ghost > 0 ? text(st.ghost, words.length, false) : null}
    <div style={{position: 'absolute', left: (k.circle.x - reach) * s, top: (k.circle.y - reach) * s, width: 2 * reach * s, height: 2 * reach * s,
      borderRadius: '50%', backgroundColor: `rgba(0,0,0,${k.circle.shade})`}} />
    {st.title ? text(1, st.words, true) : null}
  </AbsoluteFill>;
};
export const evidenceCallout: VisualComponent<EvidenceCalloutProps> = {id: 'evidence-callout', layer: 'fullscreen', duration: evidenceCalloutDuration,
  textLimits: evidenceCalloutTextLimits, repair: repairEvidenceCallout, render: EvidenceCallout};
