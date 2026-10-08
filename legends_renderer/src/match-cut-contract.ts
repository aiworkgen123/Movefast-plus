import {repairText} from './contract.ts';
import {repairStaticImage, repairNormalizedPoint, type StaticImage, type NormalizedPoint} from './media-contract.ts';
export type AlignedPortrait = Readonly<{source:StaticImage; leftEye:NormalizedPoint; rightEye:NormalizedPoint}>;
export type MatchCutProps = Readonly<{title:string; photos:readonly AlignedPortrait[]}>;
export const matchCutTextLimits = {title:{minWords:1,maxWords:8,maxChars:64}} as const;
export const matchCutDuration = {minSeconds:3,maxSeconds:8};
export const repairMatchCut = (input:unknown):MatchCutProps|null => {
 if (!input || typeof input !== 'object') return null;
 const v = input as Record<string,unknown>, title=repairText(v.title,matchCutTextLimits.title);
 if (!title || !Array.isArray(v.photos) || v.photos.length<6 || v.photos.length>10) return null;
 const photos:AlignedPortrait[]=[];
 for (const p of v.photos) {
  if (!p || typeof p !== 'object') return null;
  const source=repairStaticImage(p.source),leftEye=repairNormalizedPoint(p.leftEye),rightEye=repairNormalizedPoint(p.rightEye);
  if (!source || !leftEye || !rightEye || leftEye.x>=rightEye.x || Math.hypot((rightEye.x-leftEye.x)*source.width,(rightEye.y-leftEye.y)*source.height)<2) return null;
  photos.push({source,leftEye,rightEye});
 }
 return {title,photos};
};
