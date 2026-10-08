import React, {useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {AbsoluteFill, cancelRender, continueRender, delayRender, staticFile, useVideoConfig} from 'remotion';
import {z} from 'zod';

const coordinate = z.number().finite();

export const MapLibreGeographicPlatePropsSchema = z.object({
  bounds: z.tuple([coordinate, coordinate, coordinate, coordinate]),
});

export type MapLibreGeographicPlateProps = z.infer<
  typeof MapLibreGeographicPlatePropsSchema
>;

/**
 * Internal, one-frame geographic plate materializer.
 *
 * This is deliberately registered from a separate Remotion entry point: it
 * supports the map fallback but is not a public War Chess production
 * component. All story labels, pieces and arrows are rendered later by WC04.
 */
export const MapLibreGeographicPlate: React.FC<
  MapLibreGeographicPlateProps
> = ({bounds}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [handle] = useState(() => delayRender('Loading War Chess geography'));
  const {width, height} = useVideoConfig();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const [west, south, east, north] = bounds;
    const mapOptions: maplibregl.MapOptions = {
      container: containerRef.current,
      style: staticFile('map/war-chess-geographic-style.json'),
      center: [(west + east) / 2, (south + north) / 2],
      zoom: 6,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      crossSourceCollisions: false,
    };
    (mapOptions as maplibregl.MapOptions & {
      canvasContextAttributes: WebGLContextAttributes;
    }).canvasContextAttributes = {preserveDrawingBuffer: true};

    const map = new maplibregl.Map(mapOptions);
    mapRef.current = map;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      continueRender(handle);
    };
    map.once('load', () => {
      map.resize();
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: {top: 135, right: 155, bottom: 135, left: 155},
          animate: false,
          maxZoom: 10.5,
        },
      );
      map.triggerRepaint();
      map.once('idle', finish);
    });
    map.on('error', (event) => {
      if (!map.isStyleLoaded()) {
        completed = true;
        cancelRender(
          event.error ?? new Error('War Chess geographic tiles failed'),
        );
      }
    });
  }, [bounds, handle]);

  return (
    <AbsoluteFill style={{backgroundColor: '#d7c7a9'}}>
      <div
        ref={containerRef}
        style={{position: 'absolute', inset: 0, width, height}}
      />
    </AbsoluteFill>
  );
};
