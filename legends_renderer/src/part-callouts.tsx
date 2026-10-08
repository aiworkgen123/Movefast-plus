import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GridStage} from './grid-stage.tsx';
import {partCalloutsDuration, partCalloutsTextLimits, repairPartCallouts, type PartCalloutsProps} from './part-callouts-contract.ts';
import {partCalloutsLayout, partCalloutsSpec as spec, partCalloutsState} from './part-callouts-state.ts';
// Montserrat-like metrics with line-height 1: ascender ink sits 0.1165 em below the box top.
const inkOffset = 0.1165;
export const PartCallouts: React.FC<ComponentRenderProps<PartCalloutsProps>> = ({props, skin, context}) => {
  const safe = repairPartCallouts(props);
  if (!safe || !validContext(context, partCalloutsDuration)) return null;
  const s = context.width / 1920, look = skin.stage, layout = partCalloutsLayout(safe), state = partCalloutsState(context, safe.labels.length, safe.size);
  const id = `part-callouts-${skin.id}`;
  return <AbsoluteFill>
    <GridStage skin={skin} context={context} variant="faint" />
    <svg width={context.width} height={context.height} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}} aria-hidden="true">
      <g transform={`translate(${spec.disc.x} ${spec.disc.y}) scale(${state.disc})`}>
        <circle r={spec.disc.r} fill={look.disc} stroke={look.leader} strokeOpacity={0.75} strokeWidth={2.5} strokeDasharray="6 4" />
      </g>
      <defs>{layout.labels.map((label, i) => <mask key={i} id={`${id}-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
        <path d={label.path} pathLength={1} fill="none" stroke="white" strokeWidth={12} strokeDasharray={`${state.leaders} 1`} />
      </mask>)}</defs>
    </svg>
    <Img src={staticFile(safe.object.path)} style={{position: 'absolute', left: layout.object.x * s, top: layout.object.y * s,
      width: layout.object.width * s, height: layout.object.height * s, opacity: state.object, transform: `translateX(${state.slide * s}px) scale(${state.scale})`}} />
    <svg width={context.width} height={context.height} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}} aria-hidden="true">
      {layout.labels.map((label, i) => <path key={i} d={label.path} fill="none" stroke={look.leader} strokeWidth={spec.leaderWidth}
        strokeDasharray={spec.dash.join(' ')} strokeLinecap="round" mask={`url(#${id}-${i})`} />)}
    </svg>
    {layout.labels.map((label, i) => <div key={i} style={{position: 'absolute', left: (label.x - 400) * s, width: 800 * s, textAlign: 'center',
      top: (label.top - inkOffset * layout.labelSize) * s, fontSize: layout.labelSize * s, lineHeight: 1, whiteSpace: 'nowrap',
      fontFamily: look.heavy.family, fontWeight: look.heavy.weight, letterSpacing: look.heavy.letterSpacing * s, color: look.text,
      textShadow: `0 ${2 * s}px ${10 * s}px ${look.shadow}`, opacity: state.labels[i]}}>{label.text}</div>)}
  </AbsoluteFill>;
};
export const partCallouts: VisualComponent<PartCalloutsProps> = {id: 'part-callouts', layer: 'fullscreen', duration: partCalloutsDuration,
  textLimits: partCalloutsTextLimits, repair: repairPartCallouts, render: PartCallouts};
