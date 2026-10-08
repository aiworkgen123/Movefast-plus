import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChartText} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairWaveTimeline, stackWords, waveTimelineDuration, waveTimelineTextLimits, type WaveTimelineProps} from './wave-timeline-contract.ts';
import {wavePath, waveTimelineSpec as k, waveTimelineState} from './wave-timeline-state.ts';

const CAP = 0.7; // Montserrat cap height (em)

export const WaveTimeline: React.FC<ComponentRenderProps<WaveTimelineProps>> = ({props, skin, context}) => {
  const safe = repairWaveTimeline(props);
  if (!safe || !validContext(context, waveTimelineDuration)) return null;
  const look = skin.stage, c = look.chart, s = context.width / 1920, t = context.frame / context.fps, st = waveTimelineState(t), path = wavePath();
  const glow = skin.id === 'documentary' ? '0 0 14px rgba(255,255,255,.35)' : undefined, L = k.label;
  // Labels: peaks (milestones 1, 3 and the end) stack upwards from the circle; dips (2, 4 and the start) hang below it.
  const labels = [safe.startLabel, ...safe.milestones, safe.endLabel].map((text, i) => {
    const [x, y] = k.nodes[i], lines = stackWords(text), above = i === 1 || i === 3 || i === 5;
    const first = above ? (i === 5 ? y - L.endRise : y - k.circle - L.gapAbove) - CAP * L.size - (lines.length - 1) * L.pitch
      : (i === 0 ? y + L.startDrop : y + k.circle + L.gapBelow);
    return lines.map((line, j) => <ChartText key={`${i}-${j}`} look={look} font="heavy" size={L.size} weight={L.weight} x={x} capTop={first + j * L.pitch}
      anchor="middle" opacity={st.labels[i]} shadow={glow}>{line}</ChartText>);
  });
  const title = (text: string, x: number, anchor: 'start' | 'end', opacity: number) => stackWords(text).map((line, j) =>
    <ChartText key={`${anchor}-${j}`} look={look} font="heavy" size={k.title.size} weight={k.title.weight} x={x} capTop={k.title.capTop + j * k.title.pitch}
      anchor={anchor} opacity={opacity} shadow={glow}>{line}</ChartText>);
  return <AbsoluteFill style={{backgroundColor: c.night}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0',
        transform: `translate(960px, 540px) scale(${st.camera.zoom}) translate(${-st.camera.x}px, -540px)`}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} aria-hidden="true">
          {st.draw > 0 ? <g fill="none" stroke={c.ink} strokeWidth={k.line} strokeLinecap="round" strokeDasharray={`${path.length * st.draw} ${path.length}`}>
            {glow ? <path d={path.d} opacity={0.35} style={{filter: 'blur(9px)'}} /> : null}
            <path d={path.d} />
          </g> : null}
          {st.pops.map((p, i) => p > 0 ? <g key={i} transform={`translate(${k.nodes[i + 1][0]} ${k.nodes[i + 1][1]}) scale(${p})`}>
            {glow ? <circle r={k.circle} fill={look.yellow} opacity={0.35} style={{filter: 'blur(8px)'}} /> : null}
            <circle r={k.circle} fill={look.yellow} />
          </g> : null)}
        </svg>
        {st.pops.map((p, i) => p > 0 ? <div key={i} style={{position: 'absolute', left: k.nodes[i + 1][0], top: k.nodes[i + 1][1], transform: `scale(${p})`, transformOrigin: '0 0'}}>
          <ChartText look={look} font="heavy" size={k.number.size} weight={k.number.weight} x={0} capTop={-0.35 * k.number.size} anchor="middle" color="#000">{i + 1}</ChartText>
        </div> : null)}
        {labels}
        {title(safe.leftTitle, k.title.leftRight, 'end', 1)}
        {title(safe.rightTitle, k.title.rightLeft, 'start', st.rightTitle)}
      </div>
    </div>
  </AbsoluteFill>;
};
export const waveTimeline: VisualComponent<WaveTimelineProps> = {id: 'wave-timeline', layer: 'fullscreen', duration: waveTimelineDuration,
  textLimits: waveTimelineTextLimits, repair: repairWaveTimeline, render: WaveTimeline};
