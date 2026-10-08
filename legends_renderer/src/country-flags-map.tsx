import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ChartText} from './chart-frame.tsx';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {countryFlagsMapDuration, countryFlagsMapTextLimits, repairCountryFlagsMap, type CountryFlagsMapProps} from './country-flags-map-contract.ts';
import {GeoLayer, typedCaption, useGeoData} from './geo-map.tsx';
import {cameraAt} from './geo-state.ts';
import {progress} from './motion.ts';

/** Measured on Diesel 12:26.8 (E44), 1080p. Flags (96 x 62, turned 10 degrees, soft shadow) sit in a loose 3 x 2 pile around
 * (958, 546) on screen, pop in 0.13 s each in the order given, and drift 17 px right over 7 s. The country fills #C36A6A
 * with an ease-out over 1.2 s. Caption Open Sans 400 80.5 px, ink from x 103, cap top 909. */
export const countryFlagsMapSpec = {
  flag: {width: 96, height: 62, angle: 10, pop: 0.13}, centre: {x: 958, y: 546},
  offsets: [[-106.6, -60.3], [6.4, -30], [122.5, -21.5], [-118.9, 13.4], [-7.1, 43.9], [109.5, 50.5]] as const,
  pops: [0.217, 0.35, 0.483, 0.667, 0.8, 1] as const, drift: {x: -17, y: 3.7, seconds: 7},
  fill: 1.2, caption: {size: 80.5, weight: 400, left: 103, capTop: 909},
} as const;

export const CountryFlagsMap: React.FC<ComponentRenderProps<CountryFlagsMapProps>> = ({props, skin, context}) => {
  const safe = repairCountryFlagsMap(props), data = useGeoData();
  if (!safe || !data || !validContext(context, countryFlagsMapDuration)) return null;
  const look = skin.stage, s = context.width / 1920, t = context.frame / context.fps, k = countryFlagsMapSpec;
  const fill = progress(t, safe.fillAt, safe.fillAt + k.fill, [0.5, 1, 0.89, 1]), drift = 1 - Math.min(1, Math.max(0, (t - k.pops[0]) / k.drift.seconds));
  const cap = typedCaption(safe.caption, context.frame, context.fps, safe.captionAt);
  return <AbsoluteFill style={{backgroundColor: look.map.worldSea}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', overflow: 'hidden'}}>
      <GeoLayer look={look} data={data} camera={cameraAt(safe.stops, t)} style="atlas" sea={look.map.worldSea}
        highlights={[{country: safe.country, color: look.map.fill, opacity: fill}]} />
      {safe.flags.map((f, i) => {
        const p = progress(t, k.pops[i], k.pops[i] + k.flag.pop, 'out-cubic'), [dx, dy] = k.offsets[i];
        return p > 0 ? <Img key={i} src={staticFile(f.path)} style={{position: 'absolute', width: k.flag.width, height: k.flag.height, objectFit: 'cover',
          left: k.centre.x + dx + k.drift.x * drift - k.flag.width / 2, top: k.centre.y + dy + k.drift.y * drift - k.flag.height / 2,
          transform: `rotate(${k.flag.angle}deg) scale(${p})`, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.35))'}} /> : null;
      })}
      <ChartText look={look} font="sans" size={k.caption.size} weight={k.caption.weight} x={k.caption.left - 0.04 * k.caption.size} capTop={k.caption.capTop}
        anchor="start" color={look.map.caption}>{cap.text}{cap.cursor ? '|' : ''}</ChartText>
    </div>
  </AbsoluteFill>;
};
export const countryFlagsMap: VisualComponent<CountryFlagsMapProps> = {id: 'country-flags-map', layer: 'fullscreen', duration: countryFlagsMapDuration,
  textLimits: countryFlagsMapTextLimits, repair: repairCountryFlagsMap, render: CountryFlagsMap};
