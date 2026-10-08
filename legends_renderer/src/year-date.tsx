import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairYearDate, yearDateDuration, yearDateTextLimits, type YearDateProps} from './year-date-contract.ts';
import {yearDateState} from './year-date-state.ts';
export const YearDate: React.FC<ComponentRenderProps<YearDateProps>> = ({props, skin, context}) => {
  const safe = repairYearDate(props);
  if (!safe || !validContext(context, yearDateDuration)) return null;
  const state = yearDateState(context, skin);
  const scale = context.width / 1920;
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text,
    justifyContent: 'center', padding: skin.date.inset * scale, overflow: 'hidden', boxSizing: 'border-box'}}>
    <div style={{opacity: state.opacity, transform: `translateY(${state.translateY * scale}px)`}}>
      <div style={{fontFamily: skin.fonts.title.family, fontWeight: skin.fonts.title.weight,
        letterSpacing: skin.fonts.title.letterSpacing * scale, lineHeight: 1.08, overflowWrap: 'anywhere',
        fontSize: Math.min(skin.date.titleSize, 1600 / Math.max(1, safe.display.length * 0.65)) * scale}}>{safe.display}</div>
      {safe.context ? <div style={{fontFamily: skin.fonts.label.family, fontWeight: skin.fonts.label.weight,
        letterSpacing: skin.fonts.label.letterSpacing * scale, color: skin.palette.muted,
        fontSize: skin.date.contextSize * scale, marginTop: skin.date.gap * scale,
        opacity: state.contextOpacity, overflowWrap: 'anywhere'}}>{safe.context}</div> : null}
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const yearDate: VisualComponent<YearDateProps> = {id: 'year-date', layer: 'fullscreen', duration: yearDateDuration,
  textLimits: yearDateTextLimits, repair: repairYearDate, render: YearDate};
