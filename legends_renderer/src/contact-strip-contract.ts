import {repairText} from './contract.ts';
import {repairStaticImage,type StaticImage} from './media-contract.ts';
export type ContactStripProps=Readonly<{title:string;photos:readonly StaticImage[]}>;
export const contactStripTextLimits={title:{minWords:1,maxWords:8,maxChars:64}} as const;
export const contactStripDuration={minSeconds:3,maxSeconds:8};
export const repairContactStrip=(input:unknown):ContactStripProps|null=>{
 if(!input||typeof input!=='object')return null;const v=input as Record<string,unknown>,title=repairText(v.title,contactStripTextLimits.title);
 if(!title||!Array.isArray(v.photos)||v.photos.length<2||v.photos.length>3)return null;
 const photos=v.photos.map(repairStaticImage);return photos.some(p=>!p)?null:{title,photos:photos as StaticImage[]};
};
