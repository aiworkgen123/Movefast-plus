import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {ChartProps} from './chart-contract.ts';
import {entranceOpacity,progress} from './motion.ts';
/** Labels are presentation only; coordinates always use the unrounded values. */
export const formatChartValue=(value:number,precision=6):string=>{
 if(value===0)return '0';
 if(Math.abs(value)>=1e6||Math.abs(value)<1e-4)return value.toExponential(precision-1).replace(/(\.\d*?)0+(?=e)/u,'$1').replace('.e','e');
 return Number(value.toPrecision(precision)).toString();
};
/** Numeric SVG glyphs fit conservatively at at most one em per character. */
export const chartValueFontSize=(text:string,size:number,availableWidth:number)=>Math.min(size,availableWidth/text.length);
export const chartState=(c:FrameContext,skin:Skin,p:ChartProps)=>{
 const t=skin.chart,low=Math.min(0,...p.values.map(v=>v.value)),high=Math.max(0,...p.values.map(v=>v.value)),domain=high===low?{low:-1,high:1}:{low,high};
 const y=(v:number)=>t.plotBottom-(v-domain.low)/(domain.high-domain.low)*(t.plotBottom-t.plotTop),baseline=y(0),left=t.inset+t.axisWidth,width=1920-left-t.inset,column=width/p.values.length;
 const bars=p.values.map((v,i)=>{const amount=progress(c.frame,c.durationInFrames*(t.start+i*t.stagger),c.durationInFrames*(t.end+i*t.stagger),skin.motion.camera),end=y(v.value),current=baseline+(end-baseline)*amount;return {amount,y:Math.min(baseline,current),height:Math.abs(current-baseline),end};});
 return {opacity:entranceOpacity(c,skin),domain,baseline,left,width,column,slotWidth:column-2*t.textInset,ticks:[domain.low,(domain.low+domain.high)/2,domain.high],bars,
 lineReveal:progress(c.frame,c.durationInFrames*t.start,c.durationInFrames*(t.end+t.stagger*(p.values.length-1)),skin.motion.camera),
 points:bars.map((bar,i)=>({x:left+column*(i+0.5),y:bar.end}))};
};
