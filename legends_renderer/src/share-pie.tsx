import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChartBackground, ChartText} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairSharePie, sharePieDuration, sharePieTextLimits, type SharePieProps} from './share-pie-contract.ts';
import {sharePieSpec as k, sharePieState, sliceEdge, slicePath} from './share-pie-state.ts';

export const SharePie: React.FC<ComponentRenderProps<SharePieProps>> = ({props, skin, context}) => {
  const safe = repairSharePie(props);
  if (!safe || !validContext(context, sharePieDuration)) return null;
  const look = skin.stage, c = look.chart, s = context.width / 1920, t = context.frame / context.fps, st = sharePieState(t, safe.shares);
  return <AbsoluteFill>
    <ChartBackground look={look} flat />
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
        {st.slices.map(([a, b], i) => b - a > 0.01 ? <path key={i} d={slicePath(st.ellipse, a, b)} fill={c.slices[i % c.slices.length]} /> : null)}
        {st.slices.flatMap(([a, b], i) => b - a > 0.01 ? [a, b] : []).map((d, i) => {const e = sliceEdge(st.ellipse, d);
          return <line key={i} x1={k.vertex.x} y1={k.vertex.y} x2={e.x} y2={e.y} stroke={c.flat} strokeWidth={k.separator} opacity={0.6} />;})}
      </svg>
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${k.grow.x}px ${k.grow.y}px`, transform: `scale(${st.grow})`}}>
        {safe.label ? <ChartText look={look} font="heavy" size={k.label.size} weight={k.label.weight} x={k.label.left} capTop={st.top - k.label.aboveTop} anchor="start"
          tracking={k.label.tracking} opacity={st.label} color={c.soft}>{safe.label}</ChartText> : null}
      </div>
      <ChartText look={look} font="heavy" size={k.caption.size} weight={k.caption.weight} x={k.caption.x} capTop={k.caption.capTop} anchor="middle"
        slant={k.caption.slant} opacity={st.caption} color={c.soft}>{safe.caption}</ChartText>
    </div>
  </AbsoluteFill>;
};
export const sharePie: VisualComponent<SharePieProps> = {id: 'share-pie', layer: 'fullscreen', duration: sharePieDuration,
  textLimits: sharePieTextLimits, repair: repairSharePie, render: SharePie};
