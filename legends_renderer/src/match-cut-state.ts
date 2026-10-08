import type {FrameContext} from './contract.ts';
import type {Skin} from './skins.ts';
import type {AlignedPortrait} from './match-cut-contract.ts';
import {entranceOpacity} from './motion.ts';
export const alignPortrait = (p:AlignedPortrait, targetX:number,targetY:number, eyeDistance:number) => {
 const lx=p.leftEye.x*p.source.width,ly=p.leftEye.y*p.source.height,rx=p.rightEye.x*p.source.width,ry=p.rightEye.y*p.source.height;
 const dx=rx-lx,dy=ry-ly, length=Math.hypot(dx,dy),scale=eyeDistance/length, angle=-Math.atan2(dy,dx);
 const a=Math.cos(angle)*scale,b=Math.sin(angle)*scale,c=-b,d=a;
 return {a,b,c,d,tx:targetX-a*(lx+rx)/2-c*(ly+ry)/2,ty:targetY-b*(lx+rx)/2-d*(ly+ry)/2};
};
export const matchCutState = (context:FrameContext,skin:Skin,photos:readonly AlignedPortrait[]) => {
 const t=skin.matchCut,s=context.width/1920,index=Math.min(photos.length-1,Math.floor(context.frame/(context.durationInFrames*t.sequenceEnd)*photos.length));
 return {index,matrix:alignPortrait(photos[index],context.width/2,context.height*t.eyeTop,t.eyeDistance*s),opacity:entranceOpacity(context,skin)};
};
