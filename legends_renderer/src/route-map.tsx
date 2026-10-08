import React from 'react';
import {AbsoluteFill} from 'remotion';
import {validContext, type ComponentRenderProps, type VisualComponent} from './contract.ts';
import {GeoLayer, useGeoData} from './geo-map.tsx';
import {cameraAt, project} from './geo-state.ts';
import {repairRouteMap, routeMapDuration, routeMapTextLimits, type RouteMapProps} from './route-map-contract.ts';
import {routeCurve, routeDrawn, routeMapSpec as k} from './route-map-state.ts';
import type {StageLook} from './skins.ts';

// A dark rounded tag centred under (x, y); `z` scales it with the map.
const Tag: React.FC<{look: StageLook; text: string; x: number; y: number; z: number}> = ({look, text, x, y, z}) => {
  const g = k.tag;
  return <div style={{position: 'absolute', left: x, top: y + g.drop * z, height: g.height * z, transform: 'translateX(-50%)', boxSizing: 'border-box',
    padding: `0 ${g.padX * z}px`, borderRadius: g.radius * z, backgroundColor: look.map.tag, color: look.map.tagInk, display: 'flex', alignItems: 'center',
    fontFamily: look.news.family, fontWeight: g.weight, fontSize: g.size * z, whiteSpace: 'pre'}}>{text}</div>;
};

export const RouteMap: React.FC<ComponentRenderProps<RouteMapProps>> = ({props, skin, context}) => {
  const safe = repairRouteMap(props), data = useGeoData();
  if (!safe || !data || !validContext(context, routeMapDuration)) return null;
  const look = skin.stage, s = context.width / 1920, t = context.frame / context.fps, camera = cameraAt(safe.stops, t);
  // Sizes are measured at the last stop's zoom and scale with the map.
  const z = camera.scale / (safe.stops[safe.stops.length - 1].zoom * (1920 / (2 * Math.PI)));
  const a = project(camera, safe.from.lon, safe.from.lat), b = project(camera, safe.to.lon, safe.to.lat), curve = routeCurve(a, b);
  const drawn = routeDrawn(t), tip = curve.pointAt(drawn), endPop = Math.min(1, Math.max(0, (drawn - k.endDotAt) / 0.02));
  return <AbsoluteFill style={{backgroundColor: look.map.atlasSea}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', overflow: 'hidden'}}>
      <GeoLayer look={look} data={data} camera={camera} style="atlas">
        <g style={{filter: `drop-shadow(0 ${5 * z}px ${5 * z}px rgba(0,0,0,.35))`}}>
        <path d={curve.d} fill="none" stroke={look.map.route} strokeWidth={k.line * z} strokeLinecap="round" strokeDasharray={`${curve.total * drawn} ${curve.total * 2}`} />
        {drawn > 0 && drawn < 1 ? <circle cx={tip[0]} cy={tip[1]} r={k.tip * z} fill={look.map.route} /> : null}
        <circle cx={a[0]} cy={a[1]} r={k.dot * z} fill={look.map.route} />
        {endPop > 0 ? <circle cx={b[0]} cy={b[1]} r={k.dot * z * endPop} fill={look.map.route} /> : null}
        </g>
      </GeoLayer>
      <Tag look={look} text={safe.from.label} x={a[0]} y={a[1]} z={z} />
      <Tag look={look} text={safe.to.label} x={b[0]} y={b[1]} z={z} />
    </div>
  </AbsoluteFill>;
};
export const routeMap: VisualComponent<RouteMapProps> = {id: 'route-map', layer: 'fullscreen', duration: routeMapDuration,
  textLimits: routeMapTextLimits as VisualComponent<RouteMapProps>["textLimits"], repair: repairRouteMap, render: RouteMap};
