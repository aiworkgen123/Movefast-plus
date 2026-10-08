import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {evidenceLeadersDuration, evidenceLeadersTextLimits, repairEvidenceLeaders, type EvidenceLeadersProps} from './evidence-leaders-contract.ts';
import {cardQuad, evidenceLeadersSpec as k, leaderProgress, quadMatrix} from './evidence-leaders-state.ts';
export const EvidenceLeaders: React.FC<ComponentRenderProps<EvidenceLeadersProps>> = ({props, skin, context}) => {
  const safe = repairEvidenceLeaders(props);
  if (!safe || !validContext(context, evidenceLeadersDuration)) return null;
  const s = context.width / 1920, look = skin.stage, t = context.frame / context.fps, c = k.card;
  return <AbsoluteFill style={{backgroundColor: look.stageBlack, overflow: 'hidden'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 75% at 50% 50%, rgba(255,255,255,.032) 55%, rgba(255,255,255,.012) 100%)'}} />
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: c.width, height: c.height, transformOrigin: '0 0', transform: quadMatrix(c.width, c.height, cardQuad(t)),
        boxSizing: 'border-box', border: `${c.border}px solid ${look.redLine}`, borderRadius: c.radius, overflow: 'hidden', backgroundColor: '#000'}}>
        <FrameMediaView media={safe.media} context={context} fit="cover" />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
        {safe.labels.map((_, i) => {
          const p = leaderProgress(t, i).line, pts = k.slots[i].path.map(([x, y]) => `${x},${y}`).join(' ');
          return p > 0 ? <polyline key={i} points={pts} pathLength={1} fill="none" stroke={look.redLine} strokeWidth={k.leaders.width} strokeLinejoin="round"
            strokeDasharray={`${p} 1`} /> : null;
        })}
      </svg>
      {safe.labels.map((label, i) => {
        const slot = k.slots[i], o = leaderProgress(t, i).chip;
        const pos = 'bottom' in slot.chip ? {left: slot.chip.left, bottom: 1080 - slot.chip.bottom} : {left: slot.chip.left, top: slot.chip.top - 1};
        return <div key={i} style={{position: 'absolute', ...pos, width: k.chip.width, boxSizing: 'border-box', opacity: o,
          padding: `${k.chip.padTop + 5 - (k.chip.pitch - 0.714 * k.chip.size) / 2 - 0.16 * k.chip.size}px ${k.chip.padX}px ${k.chip.padBottom - 9 - (k.chip.pitch - 0.714 * k.chip.size) / 2}px`,
          backgroundColor: look.chipDark, fontFamily: look.sans.family, fontWeight: 700, fontSize: k.chip.size, lineHeight: `${k.chip.pitch}px`,
          textAlign: slot.align, color: look.labelInk, textShadow: `0 0 6px ${look.redLine}AA, 0 0 2px ${look.redLine}`}}>{label}</div>;
      })}
    </div>
  </AbsoluteFill>;
};
export const evidenceLeaders: VisualComponent<EvidenceLeadersProps> = {id: 'evidence-leaders', layer: 'fullscreen', duration: evidenceLeadersDuration,
  textLimits: evidenceLeadersTextLimits, repair: repairEvidenceLeaders, render: EvidenceLeaders};
