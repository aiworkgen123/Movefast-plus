import React,{useEffect,useRef,useState} from 'react';
import {AbsoluteFill,delayRender,continueRender,cancelRender} from 'remotion';
import {validContext,type ComponentRenderProps,type VisualComponent} from './contract.ts';
import {repairNewsTicker,newsTickerDuration,newsTickerTextLimits,type NewsTickerProps} from './news-ticker-contract.ts';
import {newsTickerState,newsTickerLayout} from './news-ticker-state.ts';
import {loadDocumentaryFonts} from './fonts.ts';
const TickerTrack:React.FC<ComponentRenderProps<NewsTickerProps>>=({props,skin,context})=>{
 const ref=useRef<HTMLSpanElement>(null),[handle]=useState(()=>delayRender('Measure loaded ticker font')),[textWidth,setTextWidth]=useState<number|null>(null);
 const s=context.width/1920,font=skin.fonts.body,t=skin.newsTicker;
 useEffect(()=>{let active=true;void(async()=>{
  try{if(skin.id==='documentary')await loadDocumentaryFonts();await document.fonts.ready;
   if(!active)return;const width=ref.current?.getBoundingClientRect().width;if(!width||!Number.isFinite(width))throw new Error('Cannot measure ticker text');
   setTextWidth(width);continueRender(handle);
  }catch(error){if(active)cancelRender(error instanceof Error?error:new Error(String(error)));}
 })();return()=>{active=false;};},[props.text,skin.id,font.family,t.textSize,s,handle]);
 const layout=textWidth===null?null:newsTickerLayout(context,skin,props.speed,textWidth),state=newsTickerState(context,skin,props.speed);
 return <div style={{fontFamily:font.family,fontWeight:font.weight,fontSize:t.textSize*s,whiteSpace:'pre'}}>
 <span ref={ref} aria-hidden="true" style={{position:'absolute',visibility:'hidden'}}>{props.text}</span>
 {layout?<div style={{display:'flex',flexShrink:0,transform:`translateX(${state.offset}px)`}}>{Array.from({length:layout.copies},(_,i)=><span key={i} style={{width:layout.tileWidth,flexShrink:0}}>{props.text}</span>)}</div>:null}
 </div>;
};
export const NewsTicker:React.FC<ComponentRenderProps<NewsTickerProps>>=({props,skin,context})=>{
 const safe=repairNewsTicker(props);if(!safe||!validContext(context,newsTickerDuration))return null;
 const t=skin.newsTicker,s=context.width/1920,state=newsTickerState(context,skin,safe.speed);
 return <AbsoluteFill><div style={{position:'absolute',left:0,right:0,bottom:t.bottom*s,height:t.height*s,background:skin.label.background,color:skin.palette.text,opacity:state.opacity,display:'flex',borderTop:`${t.border*s}px solid ${skin.palette.accent}`}}>
 <div style={{position:'relative',zIndex:1,width:t.labelWidth*s,boxSizing:'border-box',flexShrink:0,background:skin.palette.warn,color:skin.palette.background,padding:t.padding*s,fontFamily:skin.fonts.label.family,fontWeight:skin.fonts.label.weight,fontSize:t.labelSize*s,display:'flex',alignItems:'center'}}>{safe.label}</div>
 <div style={{overflow:'hidden',flex:1,minWidth:0,display:'flex',alignItems:'center'}}><TickerTrack props={safe} skin={skin} context={context}/></div>
 </div></AbsoluteFill>;
};
export const newsTicker:VisualComponent<NewsTickerProps>={id:'news-ticker',layer:'overlay',duration:newsTickerDuration,textLimits:newsTickerTextLimits,repair:repairNewsTicker,render:NewsTicker};
