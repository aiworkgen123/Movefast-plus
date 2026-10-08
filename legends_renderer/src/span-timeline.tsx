import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChartText} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairSpanTimeline, spanTimelineDuration, spanTimelineTextLimits, type SpanTimelineProps} from './span-timeline-contract.ts';
import {spanTimelineSpec as k, spanTimelineState} from './span-timeline-state.ts';
import type {StageLook} from './skins.ts';

const CAP = 0.7; // Montserrat cap height (em)
// A white tag with dark capitals, centred on x, its bottom edge at `bottom`.
const Tag: React.FC<{look: StageLook; text: string; x: number; bottom: number; spec: typeof k.tag | typeof k.endTag; opacity: number}> = ({look, text, x, bottom, spec, opacity}) =>
  <div style={{position: 'absolute', left: x, top: bottom - spec.height, height: spec.height, transform: 'translateX(-50%)', opacity, backgroundColor: look.chart.tag,
    boxSizing: 'border-box', padding: `${(spec.height - CAP * spec.size) / 2 - 0.1555 * spec.size}px ${spec.padX}px 0`, whiteSpace: 'pre',
    fontFamily: look.heavy.family, fontWeight: spec.weight, fontSize: spec.size, lineHeight: 1, letterSpacing: `${spec.tracking}em`, color: look.chart.tagInk}}>
    {text.toUpperCase()}
  </div>;

export const SpanTimeline: React.FC<ComponentRenderProps<SpanTimelineProps>> = ({props, skin, context}) => {
  const safe = repairSpanTimeline(props);
  if (!safe || !validContext(context, spanTimelineDuration)) return null;
  const look = skin.stage, c = look.chart, s = context.width / 1920, t = context.frame / context.fps, st = spanTimelineState(t), g = k.grid, d = k.dots;
  const xs = Array.from({length: 5}, (_, i) => d.x0 + i * d.step), doc = skin.id === 'documentary';
  const glow = (color: string) => (doc ? `0 0 10px ${color}, 0 0 22px ${color}99` : undefined);
  const lines: React.ReactNode[] = [];
  for (let x = g.originX - 3 * g.cellX; x < 1920 + 3 * g.cellX; x += g.cellX) lines.push(<line key={`v${x}`} x1={x} x2={x} y1={-400} y2={1480} />);
  for (let y = g.originY - 4 * g.cellY; y < 1080 + 4 * g.cellY; y += g.cellY) lines.push(<line key={`h${y}`} x1={-400} x2={2320} y1={y} y2={y} />);
  return <AbsoluteFill style={{backgroundColor: c.dark}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0',
        transform: `translate(${st.camera.x}px, ${st.camera.y}px) scale(${st.camera.scale})`}}>
          <div style={{position: 'absolute', inset: 0, transformOrigin: '960px 540px', transform: `rotate(${k.tilt}deg)`}}>
            <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}} aria-hidden="true">
              <g stroke={c.darkGrid} strokeWidth={g.stroke}>{lines}</g>
              {st.draw > 0 ? <line x1={xs[0]} x2={xs[0] + (xs[4] - xs[0]) * st.draw} y1={d.y} y2={d.y} stroke={c.wire} strokeWidth={k.line}
                style={doc ? {filter: `drop-shadow(0 0 4px ${c.wire})`} : undefined} /> : null}
              {st.pops.map((p, i) => p > 0 ? <circle key={i} cx={xs[i]} cy={d.y} r={d.r * p} fill={c.ink}
                style={doc ? {filter: 'drop-shadow(0 0 6px rgba(255,255,255,.7))'} : undefined} /> : null)}
            </svg>
            <Tag look={look} text={safe.startTag} x={xs[0]} bottom={d.y - k.tag.bottomGap} spec={k.tag} opacity={st.start} />
            <ChartText look={look} font="heavy" size={k.label.size} weight={k.label.weight} x={xs[0]} capTop={d.y + k.label.capGap} anchor="middle"
              opacity={st.start} color={c.glowBlue} shadow={glow(c.glowBlue)}>{safe.startLabel.toUpperCase()}</ChartText>
            <ChartText look={look} font="heavy" size={k.span.size} weight={k.span.weight} x={xs[2]} capTop={k.span.capTop} anchor="middle"
              opacity={st.span} color={c.ink} shadow={glow('rgba(160,220,255,.6)')}>{safe.span.toUpperCase()}</ChartText>
            <Tag look={look} text={safe.endTag} x={xs[4]} bottom={d.y - k.endTag.bottomGap} spec={k.endTag} opacity={st.endTag} />
            <ChartText look={look} font="heavy" size={k.label.size} weight={k.label.weight} x={xs[4]} capTop={d.y + k.label.capGap} anchor="middle"
              opacity={st.endLabel} color={c.glowViolet} shadow={glow(c.glowViolet)}>{safe.endLabel.toUpperCase()}</ChartText>
          </div>
      </div>
    </div>
  </AbsoluteFill>;
};
export const spanTimeline: VisualComponent<SpanTimelineProps> = {id: 'span-timeline', layer: 'fullscreen', duration: spanTimelineDuration,
  textLimits: spanTimelineTextLimits, repair: repairSpanTimeline, render: SpanTimeline};
