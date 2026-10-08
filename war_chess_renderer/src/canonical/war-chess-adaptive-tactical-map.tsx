import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {STRONG_GREY_MAP_TREATMENT, WC04_ADAPTIVE_STYLE, type EngravedPieceSpec, type WC04AdaptiveTacticalMapProps} from './production-contracts';
import {WarChessEngravedPiece} from './war-chess-engraved-piece';
import {WarChessTacticalArrow} from './war-chess-tactical-arrow';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const assetPath = (path: string): string => /^(?:data:|https?:|blob:|\/)/i.test(path) ? path : staticFile(path);
const movement = (frame: number, start: number, end: number): number => interpolate(frame, [start, end], [0, 1], {...clamp, easing: Easing.bezier(0.18, 0.84, 0.22, 1)});
const mix = (from: readonly [number, number], to: readonly [number, number], amount: number): [number, number] => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
];

const Text: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{fontFamily: 'Arial, Helvetica, sans-serif', ...style}}>{children}</div>
);

const MovingPiece: React.FC<{piece: EngravedPieceSpec}> = ({piece}) => {
  const frame = useCurrentFrame();
  const amount = movement(frame, piece.startFrame, piece.endFrameExclusive);
  const position = mix(piece.start, piece.end, amount);
  return <WarChessEngravedPiece piece={piece} position={position} />;
};

/** WC04's adaptive map surface. All coordinates and timing arrive in props. */
export const WarChessAdaptiveTacticalMap: React.FC<WC04AdaptiveTacticalMapProps> = (props) => {
  const {width, height} = useVideoConfig();
  const title = props.labels?.title;
  const subtitle = props.labels?.subtitle;
  const leftLabel = props.labels?.left ?? props.factions[0].name;
  const rightLabel = props.labels?.right ?? props.factions[1].name;
  const bottomLabel = props.labels?.bottom;
  return (
    <AbsoluteFill style={{backgroundColor: '#242220', overflow: 'hidden'}} data-map-rung={props.mapSelection.mapRung} data-style-version={WC04_ADAPTIVE_STYLE.schemaVersion}>
      <Img
        src={assetPath(props.map.path)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: STRONG_GREY_MAP_TREATMENT.filter,
        }}
      />
      <AbsoluteFill style={{backgroundColor: STRONG_GREY_MAP_TREATMENT.veil, zIndex: 1}} />
      <div style={{position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none'}}>
        {title && <Text style={{position: 'absolute', left: 64, top: 46, color: props.palette.paper, fontSize: 34, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase'}}>{title}</Text>}
        {subtitle && <Text style={{position: 'absolute', left: 66, top: 91, color: props.palette.paper, opacity: .82, fontSize: 16, letterSpacing: 1.5}}>{subtitle}</Text>}
        <Text style={{position: 'absolute', left: 58, bottom: 54, color: '#F6F1E8', backgroundColor: 'rgba(23,23,23,.76)', padding: '8px 12px', fontSize: 18, fontWeight: 800, letterSpacing: 2}}>{leftLabel}</Text>
        <Text style={{position: 'absolute', right: 58, bottom: 54, color: '#F6F1E8', backgroundColor: 'rgba(23,23,23,.76)', padding: '8px 12px', fontSize: 18, fontWeight: 800, letterSpacing: 2, textAlign: 'right'}}>{rightLabel}</Text>
        {bottomLabel && <Text style={{position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', color: props.palette.paper, opacity: .9, fontSize: 15, letterSpacing: 1.2}}>{bottomLabel}</Text>}
      </div>
      <div style={{position: 'absolute', inset: 0, zIndex: 4}}>
        {props.arrows.map((arrow) => <WarChessTacticalArrow key={arrow.id} arrow={arrow} />)}
      </div>
      <div style={{position: 'absolute', inset: 0, zIndex: 5}}>
        {props.pieces.map((piece) => <MovingPiece key={piece.id} piece={piece} />)}
      </div>
      <div style={{position: 'absolute', width, height, inset: 0, zIndex: 3, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
