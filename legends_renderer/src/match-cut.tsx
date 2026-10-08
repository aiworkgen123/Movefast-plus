import React from 'react';
import {AbsoluteFill,Img,staticFile} from 'remotion';
import {validContext,type ComponentRenderProps,type VisualComponent} from './contract.ts';
import {repairMatchCut,matchCutDuration,matchCutTextLimits,type MatchCutProps} from './match-cut-contract.ts';
import {matchCutState} from './match-cut-state.ts';
import {SkinGrade, SkinSurface} from './skin-layers.tsx';
export const MatchCut:React.FC<ComponentRenderProps<MatchCutProps>>=({props,skin,context})=>{
 const safe=repairMatchCut(props);if(!safe || !validContext(context,matchCutDuration))return null;
 const state=matchCutState(context,skin,safe.photos),p=safe.photos[state.index],m=state.matrix,t=skin.matchCut,s=context.width/1920;
 return <AbsoluteFill style={{background:skin.palette.background,overflow:'hidden'}}>
  <SkinGrade skin={skin}><Img src={staticFile(p.source.path)} style={{position:'absolute',left:0,top:0,width:p.source.width,height:p.source.height,transformOrigin:'0 0',transform:`matrix(${m.a},${m.b},${m.c},${m.d},${m.tx},${m.ty})`}}/></SkinGrade>
  <div style={{position:'absolute',bottom:t.inset*s,left:t.inset*s,right:t.inset*s,padding:t.padding*s,background:skin.label.background,color:skin.palette.text,opacity:state.opacity,fontFamily:skin.fonts.title.family,fontWeight:skin.fonts.title.weight,fontSize:t.titleSize*s}}>{safe.title}</div>
 <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const matchCut:VisualComponent<MatchCutProps>={id:'match-cut',layer:'fullscreen',duration:matchCutDuration,textLimits:matchCutTextLimits,repair:repairMatchCut,render:MatchCut};
