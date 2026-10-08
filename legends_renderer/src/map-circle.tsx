import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import {mapCircleDuration, mapCircleTextLimits, repairMapCircle, type MapCircleProps} from './map-circle-contract.ts';
import {mapCircleSpec as k, mapCircleState} from './map-circle-state.ts';
export const MapCircle: React.FC<ComponentRenderProps<MapCircleProps>> = ({props, skin, context}) => {
  const safe = repairMapCircle(props);
  if (!safe || !validContext(context, mapCircleDuration)) return null;
  const s = context.width / 1920, look = skin.stage, t = context.frame / context.fps, chars = Array.from(safe.caption), st = mapCircleState(t, chars.length);
  const cx = safe.centre ? safe.centre.x * 1920 : k.centre.x, cy = safe.centre ? safe.centre.y * 1080 : k.centre.y, len = 2 * Math.PI * k.r;
  return <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#000'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0'}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${cx}px ${cy}px`, transform: `scale(${st.zoom})`}}>
        <FrameMediaView media={safe.media} context={context} fit="cover" />
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
          <circle cx={cx} cy={cy} r={k.r} fill="none" stroke={look.mapRed} strokeWidth={k.stroke} strokeDasharray={`${len * st.arc} ${len}`} transform={`rotate(${k.startDeg} ${cx} ${cy})`} />
        </svg>
      </div>
      <div style={{position: 'absolute', left: k.caption.left - 0.06 * k.caption.size, top: k.caption.capTop - 0.1555 * k.caption.size, fontFamily: look.heavy.family, fontWeight: 800,
        fontSize: k.caption.size, lineHeight: 1, whiteSpace: 'pre', color: look.onMedia, textShadow: '0 2px 10px rgba(0,0,0,.5)'}}>
        {chars.slice(0, st.chars).join('')}{st.cursor ? '|' : ''}
      </div>
    </div>
    {chars.map((_, i) => i % 2 === 0 ? <Sequence key={i} from={Math.round((k.caption.start + i / k.caption.rate) * context.fps)} durationInFrames={3} layout="none">
      <Audio src={staticFile('sfx/type-click.wav')} volume={0.12} /></Sequence> : null)}
  </AbsoluteFill>;
};
export const mapCircle: VisualComponent<MapCircleProps> = {id: 'map-circle', layer: 'fullscreen', duration: mapCircleDuration,
  textLimits: mapCircleTextLimits, repair: repairMapCircle, render: MapCircle};
