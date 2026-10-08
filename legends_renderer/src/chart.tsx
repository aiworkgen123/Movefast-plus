import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext,type ComponentRenderProps,type VisualComponent} from './contract.ts';
import {repairChart,chartDuration,chartTextLimits,type ChartProps} from './chart-contract.ts';
import {chartState,formatChartValue,chartValueFontSize} from './chart-state.ts';
export const Chart:React.FC<ComponentRenderProps<ChartProps>>=({props,skin,context})=>{
 const safe=repairChart(props);if(!safe||!validContext(context,chartDuration))return null;
 const t=skin.chart,state=chartState(context,skin,safe),clipId=`template-line-${skin.id}`;
 return <AbsoluteFill style={{background:skin.palette.background,color:skin.palette.text}}><svg fill={skin.palette.text} viewBox="0 0 1920 1080" style={{width:'100%',height:'100%',opacity:state.opacity,fontFamily:skin.fonts.body.family}}>
 <foreignObject x={t.inset} y={46} width={1920-2*t.inset} height={170}><div style={{fontFamily:skin.fonts.title.family,fontWeight:skin.fonts.title.weight,fontSize:t.titleSize,lineHeight:1.05,overflowWrap:'anywhere'}}>{safe.title}</div></foreignObject>
 <text x={t.inset} y={250} fill={skin.palette.muted} fontSize={t.labelSize}>{safe.unit}</text>
 {state.ticks.map((tick,i)=>{const y=t.plotBottom-(tick-state.domain.low)/(state.domain.high-state.domain.low)*(t.plotBottom-t.plotTop);return <g key={i}><line x1={state.left} x2={1920-t.inset} y1={y} y2={y} stroke={skin.palette.muted} strokeOpacity={0.3}/><text x={state.left-t.textInset} y={y+10} textAnchor="end" fill={skin.palette.muted} fontSize={chartValueFontSize(formatChartValue(tick,4),t.tickSize,t.axisWidth)}>{formatChartValue(tick,4)}</text></g>;})}
 <line x1={state.left} x2={1920-t.inset} y1={state.baseline} y2={state.baseline} stroke={skin.palette.text} strokeWidth={t.baselineWidth}/>
 {safe.kind==='line'?<><defs><clipPath id={clipId}><rect x={state.left} y={t.plotTop-t.valueSize} width={state.width*state.lineReveal} height={t.plotBottom-t.plotTop+2*t.valueSize}/></clipPath></defs><g clipPath={`url(#${clipId})`}><polyline points={state.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={skin.palette.accent} strokeWidth={t.lineWidth}/>{state.points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={t.dotRadius} fill={skin.palette.accent}/>)}</g></>:null}
 {safe.values.map((v,i)=>{const value=formatChartValue(v.value),point=state.points[i],fontSize=chartValueFontSize(value,t.valueSize,state.slotWidth);return <g key={i}>
 {safe.kind!=='line'?<rect x={state.left+state.column*i+state.column*t.barInset} width={state.column*(1-2*t.barInset)} y={state.bars[i].y} height={state.bars[i].height} fill={v.value<0?skin.palette.warn:skin.palette.accent}/>:null}
 <text x={point.x} y={point.y+(v.value<0?38:-18)} textAnchor="middle" fontSize={fontSize} opacity={safe.kind==='line'?Number(point.x<=state.left+state.width*state.lineReveal):state.bars[i].amount}><title>{v.value.toString()}</title>{value}</text>
 <foreignObject x={point.x-state.slotWidth/2} y={t.plotBottom+72} width={state.slotWidth} height={128}><div style={{fontSize:t.labelSize,lineHeight:1.08,textAlign:'center',overflowWrap:'anywhere'}}>{v.label}</div></foreignObject>
 </g>;})}
 </svg><SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const chart:VisualComponent<ChartProps>={id:'chart',layer:'fullscreen',duration:chartDuration,textLimits:chartTextLimits,repair:repairChart,render:Chart};
