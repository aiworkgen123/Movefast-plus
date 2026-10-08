import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairComparison, comparisonDuration, comparisonTextLimits, type ComparisonProps} from './comparison-contract.ts';
import {comparisonState} from './comparison-state.ts';
export const Comparison: React.FC<ComponentRenderProps<ComparisonProps>> = ({props, skin, context}) => {
  const safe = repairComparison(props);
  if (!safe || !validContext(context, comparisonDuration)) return null;
  const state = comparisonState(context, skin), token = skin.comparison;
  const scale = context.width / 1920;
  const panelWidth = (1920 - 2 * token.inset - token.centerWidth) / 2;
  const contentWidth = panelWidth - 2 * token.padding;
  const title = skin.fonts.title, label = skin.fonts.label, body = skin.fonts.body;
  // Conservative size caps reserve room for every bounded field and its descenders.
  const fit = (text: string, size: number) => Math.min(size, contentWidth * 1.5 / ((text.length + 1) * 1.1));
  return <AbsoluteFill style={{backgroundColor: skin.palette.background, color: skin.palette.text, overflow: 'hidden'}}>
    {safe.title && <div style={{position: 'absolute', left: token.inset * scale, right: token.inset * scale,
      top: context.height * 0.12, textAlign: 'center', opacity: state.opacity,
      fontFamily: title.family, fontWeight: title.weight, letterSpacing: title.letterSpacing * scale,
      fontSize: token.titleSize * scale, lineHeight: 1.12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{safe.title}</div>}
    <div style={{position: 'absolute', left: token.inset * scale, right: token.inset * scale,
      top: context.height * 0.32, height: context.height * 0.53, display: 'grid',
      gridTemplateColumns: `minmax(0, 1fr) ${token.centerWidth * scale}px minmax(0, 1fr)`, alignItems: 'stretch', opacity: state.opacity}}>
      {safe.sides.map((side, i) => <React.Fragment key={i}>
        {i === 1 && <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: label.family, fontWeight: label.weight, letterSpacing: label.letterSpacing * scale,
          fontSize: token.versusSize * scale, transform: `scale(${state.versusScale})`}}>VS</div>}
        <div style={{borderTop: `${token.borderWidth * scale}px solid ${i === 0 ? skin.palette.accent : skin.palette.secondary}`,
          padding: token.padding * scale, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: token.gap * scale, textAlign: 'center', minWidth: 0,
          transform: `translateX(${(i === 0 ? state.leftX : state.rightX) * scale}px)`,
          backgroundColor: skin.label.background, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
          <div style={{fontFamily: title.family, fontWeight: title.weight, letterSpacing: title.letterSpacing * scale,
            fontSize: fit(side.name, token.nameSize) * scale, lineHeight: 1.15}}>{side.name}</div>
          <div style={{fontFamily: label.family, fontWeight: label.weight, letterSpacing: label.letterSpacing * scale,
            fontSize: fit(side.value, token.valueSize) * scale, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums',
            color: i === 0 ? skin.palette.accent : skin.palette.secondary}}>{side.value}</div>
          {side.description && <div style={{fontFamily: body.family, fontWeight: body.weight,
            letterSpacing: body.letterSpacing * scale, fontSize: fit(side.description, token.descriptionSize) * scale,
            lineHeight: 1.3, color: skin.palette.muted}}>{side.description}</div>}
        </div>
      </React.Fragment>)}
    </div>
  <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const comparison: VisualComponent<ComparisonProps> = {id: 'comparison', layer: 'fullscreen', duration: comparisonDuration,
  textLimits: comparisonTextLimits, repair: repairComparison, render: Comparison};
