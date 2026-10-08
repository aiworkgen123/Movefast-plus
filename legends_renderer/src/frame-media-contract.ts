import {repairStaticImage,type StaticImage} from './media-contract.ts';import type {FrameContext} from './contract.ts';
export type FrameMedia=Readonly<{kind:'picture';source:StaticImage}>|Readonly<{kind:'clip';path:string;width:number;height:number;sourceFps:number;sourceDurationInFrames:number;startFrame:number}>;
export const repairFrameMedia=(input:unknown):FrameMedia|null=>{
 if(!input||typeof input!=='object')return null;const v=input as Record<string,unknown>;
 if(v.kind==='picture'){const source=repairStaticImage(v.source);return source?{kind:'picture',source}:null;}
 if(v.kind!=='clip'||typeof v.path!=='string'||!/[.](mp4|mov|webm)$/iu.test(v.path))return null;
 const dimensions=repairStaticImage({path:v.path.replace(/[.](mp4|mov|webm)$/iu,'.png'),width:v.width,height:v.height});
 if(!dimensions||typeof v.sourceFps!=='number'||!Number.isFinite(v.sourceFps)||v.sourceFps<1||v.sourceFps>120||!Number.isSafeInteger(v.sourceDurationInFrames)||!Number.isSafeInteger(v.startFrame))return null;
 const duration=v.sourceDurationInFrames as number,start=v.startFrame as number;
 if(duration<=0||start<0||start>=duration)return null;
 return {kind:'clip',path:v.path,width:dimensions.width,height:dimensions.height,sourceFps:v.sourceFps,sourceDurationInFrames:duration,startFrame:start};
};
export const mediaCovers=(media:FrameMedia,c:FrameContext):boolean=>media.kind==='picture'||(media.sourceDurationInFrames-media.startFrame)/media.sourceFps>=c.durationInFrames/c.fps;
export const frameMediaState=(media:FrameMedia,c:FrameContext)=>media.kind==='picture'?{kind:'picture' as const}:({kind:'clip' as const,sourceFrame:media.startFrame+Math.floor(c.frame/c.fps*media.sourceFps),trimBefore:media.startFrame/media.sourceFps*c.fps,seconds:media.startFrame/media.sourceFps+c.frame/c.fps});

export const frameMediaTiming=(media:FrameMedia,c:FrameContext,parentFrame:number,parentFps:number)=>({
 sequenceFrom:parentFrame-c.frame/c.fps*parentFps,
 trimBefore:media.kind==='clip'?media.startFrame/media.sourceFps*parentFps:0,
});
