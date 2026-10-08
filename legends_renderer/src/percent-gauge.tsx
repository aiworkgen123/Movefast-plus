import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GridStage} from './grid-stage.tsx';
import {percentGaugeDuration, percentGaugeTextLimits, repairPercentGauge, type PercentGaugeProps} from './percent-gauge-contract.ts';
import {percentGaugeSpec as spec, percentGaugeState, percentGaugeTicks} from './percent-gauge-state.ts';
// Poppins-like metrics with line-height 1: cap/digit tops sit 0.148/0.119 em below the box top.
const capOffset = 0.148, digitOffset = 0.119;
export const PercentGauge: React.FC<ComponentRenderProps<PercentGaugeProps>> = ({props, skin, context}) => {
  const safe = repairPercentGauge(props);
  if (!safe || !validContext(context, percentGaugeDuration)) return null;
  const s = context.width / 1920, look = skin.stage, state = percentGaugeState(context, safe), c = spec.column;
  const inner = c.height - 2 * c.border;
  const text = (size: number) => ({position: 'absolute' as const, fontSize: size * s, lineHeight: 1, whiteSpace: 'nowrap' as const});
  return <AbsoluteFill>
    <GridStage skin={skin} context={context} variant="navy" />
    <div style={{...text(spec.titleSize), left: 0, right: 0, textAlign: 'center', top: (spec.titleCapTop - capOffset * spec.titleSize) * s,
      fontFamily: look.display.family, fontWeight: look.display.weight, color: look.title, textTransform: 'uppercase'}}>{safe.title}</div>
    <div style={{position: 'absolute', left: c.left * s, top: c.top * s, width: c.width * s, height: c.height * s, boxSizing: 'border-box',
      border: `${c.border * s}px solid ${look.outline}`, boxShadow: `0 0 ${16 * s}px ${2 * s}px ${look.outline}66`}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: inner * state.fill * s, backgroundColor: look.accent}} />
    </div>
    <div style={{...text(spec.valueSize), left: spec.valueLeft * s, top: (spec.valueDigitTop - digitOffset * spec.valueSize) * s,
      fontFamily: look.display.family, fontWeight: 800, color: look.accent, textShadow: `0 0 ${12 * s}px ${look.accent}99`}}>{state.label}</div>
    {safe.caption ? <div style={{...text(spec.captionSize), left: 0, right: 0, textAlign: 'center', top: (spec.captionCapTop - capOffset * spec.captionSize) * s,
      fontFamily: look.sans.family, fontWeight: 600, color: look.caption, textTransform: 'uppercase'}}>{safe.caption}</div> : null}
    {percentGaugeTicks(context, safe).map((frame) => <Sequence key={frame} from={frame} durationInFrames={3} layout="none">
      <Audio src={staticFile('sfx/counter-tick.wav')} volume={0.35} />
    </Sequence>)}
  </AbsoluteFill>;
};
export const percentGauge: VisualComponent<PercentGaugeProps> = {id: 'percent-gauge', layer: 'fullscreen', duration: percentGaugeDuration,
  textLimits: percentGaugeTextLimits, repair: repairPercentGauge, render: PercentGauge};
