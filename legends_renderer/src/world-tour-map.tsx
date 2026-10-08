import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ChartText} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GeoLayer, typedCaption, useGeoData} from './geo-map.tsx';
import {cameraAt} from './geo-state.ts';
import {repairWorldTourMap, worldTourMapDuration, worldTourMapTextLimits, type WorldTourMapProps} from './world-tour-map-contract.ts';

/** Measured on WTC 01:11.2 (E42), 1080p: Mercator, Natural Earth land without Antarctica, highlights fade in over 0.25 s,
 * caption Montserrat 500 99.4 px, ink from x 99, cap top 895. */
export const worldTourMapSpec = {fade: 0.25, caption: {size: 100.1, weight: 500, left: 101, capTop: 895}} as const;

export const WorldTourMap: React.FC<ComponentRenderProps<WorldTourMapProps>> = ({props, skin, context}) => {
  const safe = repairWorldTourMap(props), data = useGeoData();
  if (!safe || !data || !validContext(context, worldTourMapDuration)) return null;
  const look = skin.stage, s = context.width / 1920, t = context.frame / context.fps, k = worldTourMapSpec;
  const highlights = safe.highlights.map((h) => ({country: h.country, color: h.tone === 'red' ? look.map.red : look.map.blue,
    opacity: Math.max(0, Math.min(1, (t - h.at) / k.fade))}));
  const cap = typedCaption(safe.caption, context.frame, context.fps, safe.captionAt);
  return <AbsoluteFill style={{backgroundColor: look.map.worldSea}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', overflow: 'hidden'}}>
      <GeoLayer look={look} data={data} camera={cameraAt(safe.stops, t)} style="world" highlights={highlights} />
      <ChartText look={look} font="heavy" size={k.caption.size} weight={k.caption.weight} x={k.caption.left - 0.06 * k.caption.size} capTop={k.caption.capTop}
        anchor="start" color={look.map.caption}>{cap.text}{cap.cursor ? '|' : ''}</ChartText>
    </div>
  </AbsoluteFill>;
};
export const worldTourMap: VisualComponent<WorldTourMapProps> = {id: 'world-tour-map', layer: 'fullscreen', duration: worldTourMapDuration,
  textLimits: worldTourMapTextLimits, repair: repairWorldTourMap, render: WorldTourMap};
