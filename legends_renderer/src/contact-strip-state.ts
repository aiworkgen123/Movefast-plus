import type {FrameContext} from './contract.ts';import type {Skin} from './skins.ts';import {entranceOpacity,progress} from './motion.ts';
export const contactStripState=(c:FrameContext,skin:Skin,count:number)=>({opacity:entranceOpacity(c,skin),photos:Array.from({length:count},(_,i)=>{const amount=progress(c.frame,c.durationInFrames*(skin.contactStrip.start+i*skin.contactStrip.stagger),c.durationInFrames*(skin.contactStrip.end+i*skin.contactStrip.stagger),skin.motion.entrance);return {amount,rotation:(1-amount)*(i%2?-1:1)*skin.contactStrip.tilt};})});

export const contactStripLayout=(c:FrameContext,skin:Skin)=>{
 const s=c.width/1920,t=skin.contactStrip;
 return {numberSize:t.numberSize*s,numberTop:t.numberTop*s,perforationHeight:t.perforationHeight*s,perforationWidth:t.perforationWidth*s,perforationPitch:t.perforationPitch*s,mediaReserve:t.mediaReserve*s};
};
