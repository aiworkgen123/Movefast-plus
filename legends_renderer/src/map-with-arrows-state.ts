import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {MapWithArrowsProps, MapPoint} from './map-with-arrows-contract.ts';
import {containImage} from './image-framing.ts';
import {entranceOpacity, progress} from './motion.ts';
export const mapWithArrowsState = (context: FrameContext, skin: Skin, props: MapWithArrowsProps) => {
 const t = skin.map, s = context.width / 1920;
 const viewport = {x:t.inset*s,y:context.height*t.top,width:context.width-2*t.inset*s,height:context.height*t.height};
 const box = props.map.kind === 'plate' ? containImage(props.map.image.width,props.map.image.height,viewport) : viewport;
 const project = ([x,y]: MapPoint) => props.map.kind === 'plate' ? {x:box.x+x*box.width,y:box.y+y*box.height} : {x:box.x+(x-props.map.bounds.west)/(props.map.bounds.east-props.map.bounds.west)*box.width,y:box.y+(props.map.bounds.north-y)/(props.map.bounds.north-props.map.bounds.south)*box.height};
 const routes = props.routes.map((route,i) => {
  const points = route.map(project), lengths = points.slice(1).map((p,j) => Math.hypot(p.x-points[j].x,p.y-points[j].y));
  const reveal = progress(context.frame,context.durationInFrames*(t.start+i*t.stagger),context.durationInFrames*(t.end+i*t.stagger),skin.motion.camera);
  let distance = reveal * lengths.reduce((a,b)=>a+b,0), segment = 0;
  while (segment < lengths.length-1 && distance > lengths[segment]) distance -= lengths[segment++];
  const a = points[segment], b = points[segment+1], fraction = distance/lengths[segment];
  return {points,reveal,tip:{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction},angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
 });
 const polygons = props.map.kind === 'geometry' ? (props.map.geometry.type === 'Polygon' ? [props.map.geometry.coordinates] : props.map.geometry.coordinates).map(poly => poly.map(ring => ring.map(project))) : [];
 return {opacity:entranceOpacity(context,skin),box,plateStyle:{left:box.x,top:box.y,width:box.width,height:box.height},routes,polygons};
};
