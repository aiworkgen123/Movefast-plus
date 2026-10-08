import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {repairStatPill, statPillDuration, statPillTextLimits, type StatPillProps} from './stat-pill-contract.ts';
import {statPillSpec as k, statPillWindow} from './stat-pill-state.ts';
export const StatPill: React.FC<ComponentRenderProps<StatPillProps>> = ({props, skin, context}) => {
  const safe = repairStatPill(props);
  if (!safe || !validContext(context, statPillDuration)) return null;
  const s = context.width / 1920, look = skin.stage, w = statPillWindow(context.frame / context.fps);
  const clip = `inset(0 ${(1 - w.right) * 50}% 0 ${(1 - w.left) * 50}%)`;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <FrameMediaView media={safe.media} context={context} fit="cover" />
    <div style={{position: 'absolute', left: 0, width: 2 * k.centreX * s, top: k.top * s, display: 'flex', justifyContent: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', height: k.height * s, padding: `0 ${k.padRight * s}px 0 ${k.padLeft * s}px`, borderRadius: k.radius * s,
        backgroundColor: look.pill, clipPath: clip, fontFamily: look.sans.family, fontSize: k.size * s, lineHeight: 1, whiteSpace: 'pre', color: look.onMedia}}>
        <span style={{fontWeight: 700}}>{safe.value}</span>
        <span style={{width: k.dot * s, height: k.dot * s, margin: `0 ${k.gapAfter * s}px 0 ${k.gapBefore * s}px`, borderRadius: '50%', backgroundColor: look.dotCyan,
          boxShadow: `0 0 ${18 * s}px ${10 * s}px ${look.dotCyan}33`}} />
        <span style={{fontWeight: 600}}>{safe.label.toUpperCase()}</span>
      </div>
    </div>
  </AbsoluteFill>;
};
export const statPill: VisualComponent<StatPillProps> = {id: 'stat-pill', layer: 'fullscreen', duration: statPillDuration,
  textLimits: statPillTextLimits, repair: repairStatPill, render: StatPill};
