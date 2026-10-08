import React from 'react';
import {Img,OffthreadVideo,Sequence,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import type {FrameContext} from './contract.ts';
import {frameMediaTiming,mediaCovers,type FrameMedia} from './frame-media-contract.ts';
/** Parent fps controls decoding; the supplied local context controls the media time. */
export const FrameMediaView:React.FC<{media:FrameMedia;context:FrameContext;fit?:'contain'|'cover'}>=({media,context,fit='contain'})=>{
 const parentFrame=useCurrentFrame(),{fps:parentFps}=useVideoConfig();
 if(!mediaCovers(media,context))return null;
 const style={width:'100%',height:'100%',objectFit:fit};
 if(media.kind==='picture')return <Img src={staticFile(media.source.path)} style={style}/>;
 const timing=frameMediaTiming(media,context,parentFrame,parentFps);
 return <Sequence layout="none" from={timing.sequenceFrom}><OffthreadVideo src={staticFile(media.path)} trimBefore={timing.trimBefore} muted playbackRate={1} style={style}/></Sequence>;
};
