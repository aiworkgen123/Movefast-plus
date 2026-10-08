import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairNumberStatistic, statisticDuration, statisticTextLimits, type NumberStatisticProps} from './number-statistic-contract.ts';
import {numberStatisticState} from './number-statistic-state.ts';
export const NumberStatistic: React.FC<ComponentRenderProps<NumberStatisticProps>> = ({props, skin, context}) => {
  const safe = repairNumberStatistic(props);
  if (!safe || !validContext(context, statisticDuration)) return null;
  const state = numberStatisticState(context, skin, safe);
  const scale = context.width / 1920;
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text,
    justifyContent: 'center', padding: skin.statistic.inset * scale, boxSizing: 'border-box', overflow: 'hidden'}}>
    <div style={{opacity: state.opacity}}>
      <div style={{fontFamily: skin.fonts.title.family, fontWeight: skin.fonts.title.weight,
        letterSpacing: skin.fonts.title.letterSpacing * scale, fontVariantNumeric: 'tabular-nums lining-nums',
        fontSize: Math.min(skin.statistic.valueSize, 1600 / Math.max(1, state.formatted.length * 0.65)) * scale, lineHeight: 1.08}}>{state.formatted}</div>
      <div style={{fontFamily: skin.fonts.label.family, fontWeight: skin.fonts.label.weight,
        letterSpacing: skin.fonts.label.letterSpacing * scale, color: skin.palette.accent,
        fontSize: skin.statistic.labelSize * scale, marginTop: skin.statistic.gap * scale, overflowWrap: 'anywhere'}}>{safe.label}</div>
      {safe.source ? <div style={{fontFamily: skin.fonts.body.family, fontWeight: skin.fonts.body.weight,
        color: skin.palette.muted, fontSize: skin.statistic.sourceSize * scale,
        marginTop: skin.statistic.gap * scale, overflowWrap: 'anywhere'}}>{safe.source}</div> : null}
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const numberStatistic: VisualComponent<NumberStatisticProps> = {id: 'number-statistic', layer: 'fullscreen',
  duration: statisticDuration, textLimits: statisticTextLimits, repair: repairNumberStatistic, render: NumberStatistic};
