import React, {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {decodeBorders, decodeTopology, type Camera, type GeoShape, type Topology} from './geo-state.ts';
import type {StageLook} from './skins.ts';

type GeoData = Readonly<{countries: GeoShape[]; borders: string}>;
let cache: GeoData | undefined;
let loading: Promise<GeoData> | undefined;
const load = () => loading ??= fetch(staticFile('geo/countries-50m.json')).then((r) => r.json() as Promise<Topology>)
  .then((c) => (cache = {countries: decodeTopology(c, 'countries'), borders: decodeBorders(c, 'countries')}));

/** Natural Earth 1:50m countries (public/geo; large lakes are holes that show the sea colour), loaded once per render process. */
export const useGeoData = (): GeoData | undefined => {
  const [data, setData] = useState(cache);
  useEffect(() => {
    if (data) return;
    const handle = delayRender('Load map data');
    load().then((d) => {setData(d); continueRender(handle);}).catch((e: Error) => cancelRender(e));
  }, [data]);
  return data;
};

export type Highlight = Readonly<{country: string; color: string; opacity: number}>;
/** The vector map under the E42-E44 overlays. 'world': flat light land on blue-grey sea (E42);
 * 'atlas': land with darker borders (E43/E44). A soft vignette darkens the corners, as in the references. */
export const GeoLayer: React.FC<{look: StageLook; data: GeoData; camera: Camera; style: 'world' | 'atlas'; highlights?: readonly Highlight[]; sea?: string; children?: React.ReactNode}> =
  ({look, data, camera, style, highlights = [], sea, children}) => {
    const m = look.map, world = style === 'world';
    const byId = new Map(data.countries.map((c) => [c.id, c]));
    return <>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
        <rect width={1920} height={1080} fill={sea ?? (world ? m.worldSea : m.atlasSea)} />
        <g transform={`matrix(${camera.scale} 0 0 ${camera.scale} ${camera.x} ${camera.y})`}>
          <g fill={world ? m.worldLand : m.atlasLand}>{data.countries.map((c) => <path key={c.id} d={c.path} />)}</g>
          {highlights.map((h) => {const c = byId.get(h.country); return c && h.opacity > 0
            ? <path key={h.country} d={c.path} fill={h.color} opacity={h.opacity} /> : null;})}
          <path d={data.borders} fill="none" stroke={world ? m.worldBorder : m.atlasBorder} strokeWidth={world ? 0.5 : 1.1} vectorEffect="non-scaling-stroke" />
        </g>
        {children}
      </svg>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle farthest-corner at 50% 50%, rgba(0,0,0,0) 20%, rgba(0,0,0,.29) 100%)'}} />
    </>;
  };

/** Typed caption: 15 characters a second from `start`, a "|" cursor while typing, then the cursor blinks on a 1 s cycle
 * locked to the edit's first frame (measured on E42 and E44). */
export const typedCaption = (text: string, frame: number, fps: number, start: number) => {
  const chars = Array.from(text), shown = Math.max(0, Math.min(chars.length, Math.floor(((frame / fps) - start) * 15) + 1));
  const typing = frame / fps >= start && shown < chars.length;
  return {text: chars.slice(0, frame / fps >= start ? shown : 0).join(''), cursor: frame / fps >= start && (typing || Math.floor((frame + 1) / 15) % 2 === 0)};
};
