import {repairText} from './contract.ts';import {repairStaticImage,type StaticImage} from './media-contract.ts';
export type ObjectFlyInProps=Readonly<{title:string;source:StaticImage}>;
export const objectFlyInTextLimits={title:{minWords:1,maxWords:8,maxChars:64}} as const;export const objectFlyInDuration={minSeconds:2,maxSeconds:8};
export const repairObjectFlyIn=(input:unknown):ObjectFlyInProps|null=>{if(!input||typeof input!=='object')return null;const v=input as Record<string,unknown>,title=repairText(v.title,objectFlyInTextLimits.title),source=repairStaticImage(v.source);return title&&source&&/\.png$/iu.test(source.path)?{title,source}:null;};
