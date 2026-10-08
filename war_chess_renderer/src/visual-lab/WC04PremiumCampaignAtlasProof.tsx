import React, {useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AbsoluteFill,
  Easing,
  Interactive,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {WarChessEngravedPiece} from '../canonical/war-chess-engraved-piece';
import type {EngravedPieceSpec} from '../canonical/production-contracts';

export const WC04_PREMIUM_CAMPAIGN_ATLAS_DURATION = 210;

type Point = readonly [number, number];
type Route = {p0: Point; p1: Point; p2: Point; p3: Point};

const leftFlank: Route = {p0: [650, 682], p1: [478, 588], p2: [414, 372], p3: [676, 282]};
const rightFlank: Route = {p0: [1270, 680], p1: [1442, 584], p2: [1504, 370], p3: [1248, 280]};

const pathFor = ({p0, p1, p2, p3}: Route): string =>
  `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;

const pointAt = ({p0, p1, p2, p3}: Route, amount: number): Point => {
  const inverse = 1 - amount;
  return [
    inverse ** 3 * p0[0] + 3 * inverse ** 2 * amount * p1[0] + 3 * inverse * amount ** 2 * p2[0] + amount ** 3 * p3[0],
    inverse ** 3 * p0[1] + 3 * inverse ** 2 * amount * p1[1] + 3 * inverse * amount ** 2 * p2[1] + amount ** 3 * p3[1],
  ];
};

const tangentAt = ({p0, p1, p2, p3}: Route, amount: number): Point => {
  const inverse = 1 - amount;
  return [
    3 * inverse ** 2 * (p1[0] - p0[0]) + 6 * inverse * amount * (p2[0] - p1[0]) + 3 * amount ** 2 * (p3[0] - p2[0]),
    3 * inverse ** 2 * (p1[1] - p0[1]) + 6 * inverse * amount * (p2[1] - p1[1]) + 3 * amount ** 2 * (p3[1] - p2[1]),
  ];
};

const RealTerrainPlate: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [handle] = useState(() => delayRender('Loading WC04 real terrain plate'));
  const {width, height} = useVideoConfig();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const options: maplibregl.MapOptions = {
      container: containerRef.current,
      style: staticFile('map/war-chess-real-terrain-review-style.json'),
      center: [16.151667, 41.296389],
      zoom: 10,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      crossSourceCollisions: false,
    };
    (options as maplibregl.MapOptions & {canvasContextAttributes: WebGLContextAttributes}).canvasContextAttributes = {
      preserveDrawingBuffer: true,
    };

    const map = new maplibregl.Map(options);
    mapRef.current = map;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      continueRender(handle);
    };

    map.once('load', () => {
      map.resize();
      map.fitBounds([[16.015, 41.205], [16.295, 41.39]], {
        padding: {top: 35, right: 35, bottom: 35, left: 35},
        animate: false,
        maxZoom: 11.4,
      });
      map.triggerRepaint();
      map.once('idle', finish);
    });
    map.on('error', (event) => {
      if (!map.isStyleLoaded()) {
        completed = true;
        cancelRender(event.error ?? new Error('WC04 terrain tiles failed'));
      }
    });
  }, [handle]);

  return (
    <AbsoluteFill style={{backgroundColor: '#b9b39f'}}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width,
          height,
          filter: 'grayscale(.34) sepia(.1) saturate(.72) contrast(1.08) brightness(.96)',
        }}
      />
    </AbsoluteFill>
  );
};

const PremiumArrow: React.FC<{route: Route; progress: number}> = ({route, progress}) => {
  const point = pointAt(route, progress);
  const tangent = tangentAt(route, progress);
  const angle = Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI;
  const opacity = interpolate(progress, [0, 0.035], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <g opacity={opacity}>
      <path d={pathFor(route)} pathLength="1" fill="none" stroke="#f0e5cf" strokeWidth="20" strokeLinecap="butt" strokeDasharray="1" strokeDashoffset={1 - progress} />
      <path d={pathFor(route)} pathLength="1" fill="none" stroke="#913c32" strokeWidth="12" strokeLinecap="butt" strokeDasharray="1" strokeDashoffset={1 - progress} />
      <g transform={`translate(${point[0]} ${point[1]}) rotate(${angle})`}>
        <path d="M-35 -17C-9-15 17-10 39 0C17 10-9 15-35 17L-20 0Z" fill="#f0e5cf" />
        <path d="M-31-10C-8-9 13-6 29 0C13 6-8 9-31 10L-18 0Z" fill="#913c32" />
      </g>
    </g>
  );
};

const ChessPiece: React.FC<{
  id: string;
  pieceType: EngravedPieceSpec['pieceType'];
  side: EngravedPieceSpec['side'];
  position: Point;
  label?: string;
  opacity: number;
}> = ({id, pieceType, side, position, label, opacity}) => {
  const normalized: Point = [position[0] / 1920, position[1] / 1080];
  const scale = pieceType === 'pawn' ? 0.37 : pieceType === 'knight' || pieceType === 'king' ? 0.59 : 0.53;
  const piece: EngravedPieceSpec = {
    id,
    side,
    pieceType,
    start: [normalized[0], normalized[1]],
    end: [normalized[0], normalized[1]],
    startFrame: 0,
    endFrameExclusive: WC04_PREMIUM_CAMPAIGN_ATLAS_DURATION,
    scale,
  };

  return (
    <div style={{position: 'absolute', inset: 0, opacity}}>
      <WarChessEngravedPiece piece={piece} position={normalized} />
      {label ? (
        <div style={{position: 'absolute', left: position[0] - 92, top: position[1] + 54, width: 184, padding: '7px 10px 6px', boxSizing: 'border-box', color: '#f2e9d6', backgroundColor: 'rgba(26,28,24,.88)', borderBottom: '3px solid #913c32', textAlign: 'center', fontFamily: 'Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: 1.8}}>{label}</div>
      ) : null}
    </div>
  );
};

const RomanCentre: React.FC<{opacity: number}> = ({opacity}) => (
  <>
    {Array.from({length: 15}).map((_, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      return (
        <ChessPiece
          key={index}
          id={`roman-pawn-${index}`}
          pieceType="pawn"
          side="white"
          position={[822 + column * 69, 515 + row * 82 + Math.abs(2 - column) * 10]}
          opacity={opacity}
        />
      );
    })}
  </>
);

export const WC04PremiumCampaignAtlasProof: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const arrowProgress = interpolate(frame, [34, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });
  const overviewOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const detailOpacity = interpolate(frame, [22, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leftPosition = pointAt(leftFlank, arrowProgress);
  const rightPosition = pointAt(rightFlank, arrowProgress);

  return (
    <AbsoluteFill style={{backgroundColor: '#171913', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: -20,
          scale: interpolate(frame, [0, durationInFrames - 1], [1.015, 1.035], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.cubic),
            output: 'perceptual-scale',
          }),
          transformOrigin: '50% 50%',
        }}
      >
        <RealTerrainPlate />
        <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(35,36,30,.08), rgba(35,36,30,.01) 55%, rgba(35,36,30,.12))'}} />
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
          <PremiumArrow route={leftFlank} progress={arrowProgress} />
          <PremiumArrow route={rightFlank} progress={arrowProgress} />
        </svg>
        <RomanCentre opacity={detailOpacity} />
        <ChessPiece id="numidian-cavalry" pieceType="knight" side="black" position={leftPosition} label="NUMIDIAN CAVALRY" opacity={detailOpacity} />
        <ChessPiece id="iberian-cavalry" pieceType="knight" side="black" position={rightPosition} label="IBERIAN CAVALRY" opacity={detailOpacity} />
        <ChessPiece id="roman-centre" pieceType="king" side="white" position={[960, 792]} label="ROMAN CENTRE" opacity={detailOpacity} />
      </div>

      <AbsoluteFill style={{background: 'radial-gradient(circle at 51% 48%, transparent 47%, rgba(17,19,16,.27) 100%)', pointerEvents: 'none'}} />
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1px rgba(242,231,210,.18)', pointerEvents: 'none'}} />

      <Interactive.Div
        name="WC04 title"
        style={{
          position: 'absolute',
          left: 92,
          top: 64,
          color: '#292d29',
          opacity: overviewOpacity,
          translate: interpolate(frame, [0, 18], ['0px 10px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          }),
        }}
      >
        <div style={{fontFamily: 'Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: 4.8, color: '#913c32'}}>TACTICAL RECONSTRUCTION</div>
        <div style={{marginTop: 13, fontFamily: 'Iowan Old Style, Baskerville, Georgia, serif', fontSize: 72, fontWeight: 600, lineHeight: .92, letterSpacing: -.8}}>Cannae · 216 BC</div>
      </Interactive.Div>

      <Interactive.Div
        name="WC04 active beat"
        style={{
          position: 'absolute',
          left: 92,
          bottom: 68,
          width: 720,
          color: '#f0e5cf',
          opacity: detailOpacity,
          translate: interpolate(frame, [22, 42], ['-18px 0px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          }),
        }}
      >
        <div style={{display: 'inline-block', padding: '10px 15px 9px', backgroundColor: '#22241f', borderLeft: '5px solid #913c32', fontFamily: 'Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: 3.4}}>PHASE 03</div>
        <div style={{marginTop: 15, fontFamily: 'Iowan Old Style, Baskerville, Georgia, serif', fontSize: 56, fontWeight: 600, lineHeight: .94, textShadow: '0 2px 12px rgba(16,17,14,.55)'}}>Cavalry clears the flanks</div>
      </Interactive.Div>

      <Interactive.Div
        name="WC04 legend"
        style={{
          position: 'absolute',
          right: 90,
          top: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          color: '#2f342f',
          opacity: overviewOpacity,
          fontFamily: 'Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 2.5,
        }}
      >
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 9}}><span style={{width: 12, height: 12, borderRadius: 8, backgroundColor: '#f0e5cf', border: '2px solid #252823'}} />ROME</span>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 9}}><span style={{width: 12, height: 12, borderRadius: 8, backgroundColor: '#252823', border: '2px solid #f0e5cf'}} />CARTHAGE</span>
      </Interactive.Div>

      <div style={{position: 'absolute', right: 90, bottom: 42, color: '#353a35', opacity: .62, fontFamily: 'Avenir Next, Avenir, Helvetica Neue, Arial, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: 1.4}}>OPENFREEMAP · OPENSTREETMAP · AWS TERRAIN</div>
    </AbsoluteFill>
  );
};
