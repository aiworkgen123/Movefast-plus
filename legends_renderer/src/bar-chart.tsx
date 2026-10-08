import React from 'react';
import {AbsoluteFill, interpolateColors} from 'remotion';
import {barChartDuration, barChartTextLimits, repairBarChart, type BarChartProps} from './bar-chart-contract.ts';
import {barChartLayout, barChartScale, barChartSpec, barChartState, barValueLabel} from './bar-chart-state.ts';
import {ChartBackground, ChartText, SweepMask} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';

export const BarChart: React.FC<ComponentRenderProps<BarChartProps>> = ({props, skin, context}) => {
  const safe = repairBarChart(props);
  if (!safe || !validContext(context, barChartDuration)) return null;
  const look = skin.stage, c = look.chart, s = context.width / 1920, t = context.frame / context.fps, vertical = safe.orientation === 'vertical';
  const k = barChartSpec[safe.orientation], p = k.plot, st = barChartState(t, safe), {band, at, thickness} = barChartLayout(safe), {ticks} = barChartScale(safe);
  const grid = vertical ? ticks.filter((x) => x.v > 0).map((x) => at(x.v)) : band.centres;
  return <AbsoluteFill>
    <ChartBackground look={look} />
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
        <SweepMask id={`bar-grid-${skin.id}`} left={p.left} right={p.right} t={t} {...k.grid} />
        <g mask={`url(#bar-grid-${skin.id})`} stroke={c.grid} strokeWidth={1} strokeDasharray="3 3">
          {grid.map((y) => <line key={y} x1={p.left} x2={p.right} y1={y} y2={y} />)}
        </g>
        {safe.bars.map((b, i) => {
          const end = at(b.value * st.grow[i]), centre = band.centres[i];
          const fill = safe.highlight === i ? interpolateColors(st.highlight, [0, 1], [c.bar, c.highlight]) : c.bar;
          return vertical
            ? <rect key={i} x={centre - thickness / 2} y={end} width={thickness} height={p.bottom - end} fill={fill} />
            : <rect key={i} x={p.left} y={centre - thickness / 2} width={end - p.left} height={thickness} fill={fill} />;
        })}
        <g opacity={st.axes} stroke={c.axis} strokeWidth={k.axis}>
          <line x1={p.left - k.axis / 2} x2={p.left - k.axis / 2} y1={p.top - (vertical ? 1 : 0)} y2={p.bottom} />
          <line x1={p.left - k.axis} x2={p.right} y1={p.bottom - k.axis / 2} y2={p.bottom - k.axis / 2} />
        </g>
        <g opacity={st.ticks} stroke={c.axis} strokeWidth={1.5}>
          {vertical ? ticks.map((x) => <line key={x.v} x1={p.left - k.tick} x2={p.left} y1={at(x.v)} y2={at(x.v)} />)
            : ticks.map((x) => <line key={x.v} x1={at(x.v)} x2={at(x.v)} y1={p.bottom} y2={p.bottom + k.tick} />)}
        </g>
        <g opacity={st.labels} stroke={c.axis} strokeWidth={1.5}>
          {band.centres.map((x) => vertical ? <line key={x} x1={x} x2={x} y1={p.bottom} y2={p.bottom + k.tick} /> : <line key={x} x1={p.left - k.tick} x2={p.left} y1={x} y2={x} />)}
        </g>
      </svg>
      <ChartText look={look} font="heavy" size={k.title.size} weight={k.title.weight} x={960} capTop={k.title.capTop} anchor="middle" opacity={st.title}>{safe.title}</ChartText>
      {ticks.map((x) => vertical
        ? <ChartText key={x.v} look={look} font="heavy" size={k.ticks.size} weight={k.ticks.weight} x={barChartSpec.vertical.ticks.right} capTop={at(x.v) - 0.35 * k.ticks.size} anchor="end" opacity={st.ticks}>{x.label}</ChartText>
        : <ChartText key={x.v} look={look} font="heavy" size={k.ticks.size} weight={k.ticks.weight} x={at(x.v)} capTop={barChartSpec.horizontal.ticks.capTop} anchor="middle" opacity={st.ticks}>{x.label}</ChartText>)}
      {safe.bars.map((b, i) => vertical
        ? <ChartText key={i} look={look} font="heavy" size={k.labels.size} weight={k.labels.weight} x={band.centres[i]} capTop={barChartSpec.vertical.labels.capTop} anchor="middle" opacity={st.labels}>{b.label}</ChartText>
        : <ChartText key={i} look={look} font="sans" size={k.labels.size} weight={k.labels.weight} x={barChartSpec.horizontal.labels.right} capTop={band.centres[i] - 0.32 * k.labels.size} anchor="end" opacity={st.labels}>{b.label}</ChartText>)}
      {vertical ? safe.bars.map((b, i) => <ChartText key={i} look={look} font="heavy" size={k.values.size} weight={k.values.weight} x={band.centres[i]} capTop={at(b.value) - k.values.gap}
        anchor="middle" opacity={st.values[i]}>{barValueLabel(b.value, safe.unit)}</ChartText>) : null}
      {safe.valueTitle ? (vertical
        ? <ChartText look={look} font="heavy" size={k.valueTitle.size} weight={k.valueTitle.weight} x={barChartSpec.vertical.valueTitle.x} capTop={(p.top + p.bottom) / 2} anchor="middle" rotate opacity={st.labels}>{safe.valueTitle}</ChartText>
        : <ChartText look={look} font="heavy" size={k.valueTitle.size} weight={k.valueTitle.weight} x={(p.left + p.right) / 2} capTop={barChartSpec.horizontal.valueTitle.capTop} anchor="middle" opacity={st.ticks}>{safe.valueTitle}</ChartText>) : null}
      {vertical && safe.categoryTitle ? <ChartText look={look} font="heavy" size={k.categoryTitle.size} weight={k.categoryTitle.weight} x={(p.left + p.right) / 2}
        capTop={barChartSpec.vertical.categoryTitle.capTop} anchor="middle" opacity={st.labels}>{safe.categoryTitle}</ChartText> : null}
    </div>
  </AbsoluteFill>;
};
export const barChart: VisualComponent<BarChartProps> = {id: 'bar-chart', layer: 'fullscreen', duration: barChartDuration,
  textLimits: barChartTextLimits, repair: repairBarChart, render: BarChart};
