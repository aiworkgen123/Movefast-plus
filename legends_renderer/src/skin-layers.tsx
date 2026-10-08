import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import type {FrameContext} from './contract.ts';
import {activeSkinOverlays, type Skin} from './skins.ts';

/** CSS contrast/saturation plus SVG gamma; apply to media, never to text. */
export const SkinGrade: React.FC<{skin: Skin; children: React.ReactNode}> = ({skin, children}) => {
  const id = `template-grade-${skin.id}`;
  const {contrast, saturation, gamma, brightness, sepia} = skin.grade;
  return <>
    <svg width="0" height="0" style={{position: 'absolute'}}>
      <defs><filter id={id} colorInterpolationFilters="sRGB"><feComponentTransfer>
        <feFuncR type="gamma" amplitude="1" exponent={1 / gamma} offset="0" />
        <feFuncG type="gamma" amplitude="1" exponent={1 / gamma} offset="0" />
        <feFuncB type="gamma" amplitude="1" exponent={1 / gamma} offset="0" />
      </feComponentTransfer></filter></defs>
    </svg>
    <AbsoluteFill style={{filter: `sepia(${sepia}) saturate(${saturation}) contrast(${contrast}) brightness(${brightness}) url(#${id})`}}>{children}</AbsoluteFill>
  </>;
};

/** Reusable local grain asset; no opaque paint outside its parent's bounds. */
export const SkinPaper:React.FC<{skin:Skin}>=({skin})=><Img aria-hidden="true" src={staticFile(skin.surface.paperAsset)} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',opacity:skin.surface.paperOpacity,mixBlendMode:skin.surface.paperBlend}}/>;
/** Authored local dust/scratch assets move deterministically; documentary stays archive-only. */
export const SkinOverlays:React.FC<{skin:Skin;context:FrameContext;archive:boolean}>=({skin,context,archive})=><>{activeSkinOverlays(skin,archive).map(o=><Img key={o.kind} aria-hidden="true" src={staticFile(o.asset)} style={{position:'absolute',inset:-skin.surface.dustTravel,width:`calc(100% + ${2*skin.surface.dustTravel}px)`,height:`calc(100% + ${2*skin.surface.dustTravel}px)`,pointerEvents:'none',opacity:o.opacity,mixBlendMode:o.blend,transform:`translate(${(context.frame%7-3)*skin.surface.dustTravel/4}px,${(context.frame%5-2)*skin.surface.dustTravel/3}px)`}}/>)}</>;
/** Scene treatment stays in package components, including caller-rendered compositions. */
export const SkinSurface:React.FC<{skin:Skin;context:FrameContext;dust?:boolean}>=({skin,context,dust=true})=>{
 const t=skin.surface,s=context.width/1920,i=t.accentInset*s,l=t.accentLength*s,w=context.width,h=context.height;
 return <AbsoluteFill style={{pointerEvents:'none',overflow:'hidden'}}><SkinPaper skin={skin}/>{dust?<SkinOverlays skin={skin} context={context} archive={false}/>:null}{t.accentWidth>0?<svg width={w} height={h} style={{position:'absolute',inset:0}} aria-hidden="true"><path d={`M${i+l} ${i} H${i} V${i+l} M${w-i-l} ${h-i} H${w-i} V${h-i-l}`} fill="none" stroke={skin.palette.accent} strokeWidth={t.accentWidth*s}/><path d={`M${w-i} ${i} l${-28*s} 0 l${28*s} ${28*s} Z M${i} ${h-i} l${28*s} 0 l${-28*s} ${-28*s} Z`} fill={skin.palette.warn}/></svg>:null}</AbsoluteFill>;
};
