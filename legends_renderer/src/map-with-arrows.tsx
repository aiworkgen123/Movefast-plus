import {SkinSurface} from './skin-layers.tsx';
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {repairMapWithArrows, mapWithArrowsDuration, mapWithArrowsTextLimits, type MapWithArrowsProps} from './map-with-arrows-contract.ts';
import {mapWithArrowsState} from './map-with-arrows-state.ts';
export const MapWithArrows: React.FC<ComponentRenderProps<MapWithArrowsProps>> = ({props,skin,context}) => {
 const safe = repairMapWithArrows(props); if (!safe || !validContext(context,mapWithArrowsDuration)) return null;
 const state = mapWithArrowsState(context,skin,safe), t = skin.map, s = context.width/1920;
 return <AbsoluteFill style={{background:skin.palette.background,color:skin.palette.text}}>
  <div style={{position:'absolute',top:context.height*0.08,left:t.inset*s,fontFamily:skin.fonts.title.family,fontWeight:skin.fonts.title.weight,fontSize:t.titleSize*s,opacity:state.opacity}}>{safe.title}</div>
  {safe.map.kind === 'plate' ? <Img src={staticFile(safe.map.image.path)} style={{position:'absolute',...state.plateStyle,opacity:state.opacity}}/> : null}
  <svg width={context.width} height={context.height} style={{position:'absolute',opacity:state.opacity}}>
   {state.polygons.map((poly,i) => <path key={i} d={poly.map(ring => 'M'+ring.map(p=>`${p.x},${p.y}`).join(' L')+' Z').join(' ')} fill={skin.palette.secondary} fillOpacity={t.landOpacity} stroke={skin.palette.muted} strokeWidth={t.border*s} fillRule="evenodd"/>)}
   {state.routes.map((route,i) => <g key={i} stroke={i%2 ? skin.palette.accent : skin.palette.warn} fill={i%2 ? skin.palette.accent : skin.palette.warn}>
    <polyline points={route.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" strokeWidth={t.routeWidth*s} pathLength={1} strokeDasharray={1} strokeDashoffset={1-route.reveal}/>
    {route.reveal > 0 ? <path d={`M0,0 L${-t.arrowSize*s},${-t.arrowSize*s*0.45} L${-t.arrowSize*s},${t.arrowSize*s*0.45} Z`} transform={`translate(${route.tip.x},${route.tip.y}) rotate(${route.angle})`} stroke="none"/> : null}
   </g>)}
  </svg>
 <SkinSurface skin={skin} context={context} dust={true}/></AbsoluteFill>;
};
export const mapWithArrows: VisualComponent<MapWithArrowsProps> = {id:'map-with-arrows',layer:'fullscreen',duration:mapWithArrowsDuration,textLimits:mapWithArrowsTextLimits,repair:repairMapWithArrows,render:MapWithArrows};
