import type {FrameContext} from './contract.ts';import type {Skin} from './skins.ts';import {entranceOpacity} from './motion.ts';export const newsTickerState=(c:FrameContext,skin:Skin,speed:number)=>({opacity:entranceOpacity(c,skin),offset:c.frame===0?0:-c.frame/c.fps*speed*c.width/1920});

export const newsTickerLayout=(c:FrameContext,skin:Skin,speed:number,textWidth:number)=>{
 const s=c.width/1920,tileWidth=textWidth+skin.newsTicker.gap*s,viewportWidth=c.width-skin.newsTicker.labelWidth*s,maxTravel=10*speed*s;
 const copies=Math.ceil((viewportWidth+maxTravel)/tileWidth)+1;
 return {tileWidth,viewportWidth,maxTravel,copies,trackWidth:copies*tileWidth};
};
