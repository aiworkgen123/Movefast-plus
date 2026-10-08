import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChartBackground, ChartText} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {linePlotDuration, linePlotTextLimits, repairLinePlot, type LinePlotProps} from './line-plot-contract.ts';
import {linePlotLayout, linePlotSpec as k, linePlotState} from './line-plot-state.ts';

export const LinePlot: React.FC<ComponentRenderProps<LinePlotProps>> = ({props, skin, context}) => {
  const safe = repairLinePlot(props);
  if (!safe || !validContext(context, linePlotDuration)) return null;
  const look = skin.stage, c = look.chart, s = context.width / 1920, t = context.frame / context.fps, p = k.plot;
  const lay = linePlotLayout(safe), st = linePlotState(t, safe, lay.ticks.length), first = lay.points[0], last = lay.points[lay.points.length - 1];
  const id = `line-plot-${skin.id}`;
  return <AbsoluteFill>
    <ChartBackground look={look} />
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0'}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${k.zoom.x}px ${k.zoom.y}px`, transform: `scale(${st.zoom})`}}>
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}} aria-hidden="true">
          <defs>
            <clipPath id={`${id}-grid`}><rect x={p.left} y={0} width={(p.right - p.left) * st.grid} height={1080} /></clipPath>
            <clipPath id={`${id}-line`}><rect x={first.x - 8} y={0} width={(last.x - first.x) * st.draw + 8} height={1080} /></clipPath>
          </defs>
          <g clipPath={`url(#${id}-grid)`} stroke={c.grid} strokeWidth={1} strokeDasharray="3 3">
            {lay.ticks.filter((v) => v > 0).map((v) => <line key={v} x1={p.left} x2={p.right} y1={lay.y(v)} y2={lay.y(v)} />)}
            {lay.xs.map((x) => <line key={x} x1={x} x2={x} y1={p.top} y2={p.bottom} />)}
          </g>
          <g stroke={c.axis} strokeWidth={k.axis}>
            <line x1={p.left - k.axis / 2} x2={p.left - k.axis / 2} y1={p.top} y2={p.top + (p.bottom + k.axis / 2 - p.top) * st.yAxis} />
            {st.xAxis > 0 ? <line x1={p.left - k.axis} x2={p.left - k.axis + (p.right - p.left + k.axis) * st.xAxis} y1={p.bottom + k.axis / 2 - 1} y2={p.bottom + k.axis / 2 - 1} /> : null}
          </g>
          {lay.ticks.map((v, i) => <line key={v} x1={p.left - k.tick - k.axis} x2={p.left - k.axis} y1={lay.y(v)} y2={lay.y(v)} stroke={c.axis} strokeWidth={1.5} opacity={st.yTicks[i]} />)}
          {lay.xs.map((x, i) => <line key={x} x1={x} x2={x} y1={p.bottom + k.axis} y2={p.bottom + k.axis + k.tick} stroke={c.axis} strokeWidth={1.5} opacity={st.xTicks[i]} />)}
          {st.draw > 0 ? <polyline clipPath={`url(#${id}-line)`} points={lay.points.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke={c.ink} strokeWidth={k.line} strokeLinejoin="round" /> : null}
          {lay.points.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={k.dot} fill={c.point} stroke={c.bgOuter} strokeWidth={1.5} opacity={st.points[i]} />)}
        </svg>
        <ChartText look={look} font="heavy" size={k.title.size} weight={k.title.weight} x={961.5} capTop={k.title.capTop} anchor="middle" opacity={st.title}>{safe.title}</ChartText>
        {lay.ticks.map((v, i) => <ChartText key={v} look={look} font="heavy" size={k.ticks.size} weight={k.ticks.weight} x={k.ticks.right} capTop={lay.y(v) - 0.29 * k.ticks.size}
          anchor="end" opacity={st.yTicks[i]}>{`${v}`}</ChartText>)}
        {safe.points.map((pt, i) => <React.Fragment key={i}>
          <ChartText look={look} font="heavy" size={k.labels.size} weight={k.labels.weight} x={lay.xs[i]} capTop={k.labels.capTop} anchor="middle" opacity={st.xTicks[i]}>{pt.label}</ChartText>
          <ChartText look={look} font="sans" size={k.values.size} weight={k.values.weight} x={lay.xs[i]} capTop={lay.points[i].y - k.dot - k.values.gap - 0.714 * k.values.size}
            anchor="middle" opacity={st.points[i]}>{`${pt.value}`}</ChartText>
        </React.Fragment>)}
        {safe.xTitle ? <ChartText look={look} font="heavy" size={k.xTitle.size} weight={k.xTitle.weight} x={(p.left + p.right) / 2} capTop={k.xTitle.capTop} anchor="middle" opacity={st.xTitle}>{safe.xTitle}</ChartText> : null}
        {safe.yTitle ? <ChartText look={look} font="heavy" size={k.yTitle.size} weight={k.yTitle.weight} x={k.yTitle.x} capTop={(p.top + p.bottom) / 2} anchor="middle" rotate opacity={st.yTitle}>{safe.yTitle}</ChartText> : null}
      </div>
    </div>
  </AbsoluteFill>;
};
export const linePlot: VisualComponent<LinePlotProps> = {id: 'line-plot', layer: 'fullscreen', duration: linePlotDuration,
  textLimits: linePlotTextLimits, repair: repairLinePlot, render: LinePlot};
