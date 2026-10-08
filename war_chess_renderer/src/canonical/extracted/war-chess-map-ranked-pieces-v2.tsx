import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const WAR_CHESS_MAP_RANKED_PIECES_V2_ID = 'WC_MAP_RANKED_PIECES_V2_20260722';
export const WAR_CHESS_MAP_RANKED_PIECES_V2_COMPOSITION_ID = 'WarChessMapRankedPiecesV2';
export const WAR_CHESS_MAP_RANKED_PIECES_V2_FRAMES = 318;

export type WarChessRankedFaction = {name: string; image: string; role?: string};
export type WarChessMapRankedPiecesV2Props = {
  map: string;
  factions: [WarChessRankedFaction, WarChessRankedFaction];
  eyebrow?: string;
  rightTag?: string;
  mapCaption?: string;
  footer?: string;
  stageLabels?: string[];
};

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.18, 0.84, 0.22, 1);
const colors = {
  stage: '#242220',
  paper: '#f1e7d2',
  ivory: '#eee3c9',
  obsidian: '#19353d',
  cyan: '#3f9db7',
  cyanRim: '#c3f3fa',
  gold: '#c69346',
  signal: '#a83c32',
  slate: '#8faeb7',
  muted: '#b5aa99',
  line: '#6f5a42',
};

const mapFrame = {left: 310, top: 198, width: 1300, height: 668};
const asset = (path: string): string => staticFile(path);
const progress = (frame: number, start: number, end: number): number => interpolate(frame, [start, end], [0, 1], {...clamp, easing: ease});
const fade = (frame: number, start: number, end: number, hold = 10): number => Math.min(interpolate(frame, [start, start + hold], [0, 1], clamp), interpolate(frame, [end - hold, end], [1, 0], clamp));
const point = (x: number, y: number): [number, number] => [x, y];
const mixPoint = (from: [number, number], to: [number, number], amount: number): [number, number] => [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];

type MarkerKind = 'pawn' | 'knight' | 'rook';
type Faction = 'rome' | 'carthage';

const V2Marker: React.FC<{kind: MarkerKind; faction: Faction; position: [number, number]; opacity?: number; size?: number}> = ({kind, faction, position, opacity = 1, size = 52}) => {
  const fill = faction === 'rome' ? colors.ivory : colors.cyan;
  const rim = faction === 'rome' ? '#fff6df' : colors.cyanRim;
  const stroke = faction === 'rome' ? '#4a3c2d' : '#07171d';
  return <svg width={size} height={size * 1.25} viewBox="0 0 72 92" aria-hidden="true" style={{position: 'absolute', left: position[0], top: position[1], opacity, transform: 'translate(-50%, -50%)', overflow: 'visible', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,.6))'}}>
    {kind === 'pawn' && <>
      <circle cx="36" cy="16" r="11" fill={fill} stroke={rim} strokeWidth="3" />
      <circle cx="32" cy="12" r="3" fill={rim} opacity=".8" />
      <path d="M27 29h18l4 19 8 13v10H15V61l8-13z" fill={fill} stroke={rim} strokeWidth="3" strokeLinejoin="round" />
      <path d="M31 33h7" stroke={rim} strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M12 72h48v8H12z" fill={fill} stroke={stroke} strokeWidth="3" />
    </>}
    {kind === 'knight' && <path d="M16 78h45v-8H50c4-10 3-20-2-28-4-7-10-12-18-15l7-10-12-5-9 14 8 8c-7 8-10 17-8 27l3 9H9v8zm17-48c7 4 11 9 12 16l-6 8-12-6c-1-6 1-12 6-18z" fill={fill} stroke={rim} strokeWidth="3" strokeLinejoin="round" />}
    {kind === 'rook' && <>
      <path d="M14 12h10v10h8V12h9v10h8V12h10v17H55l-3 29h8v10H12V58h8l-3-29h-3z" fill={fill} stroke={rim} strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 68h52v10H10z" fill={fill} stroke={stroke} strokeWidth="3" />
    </>}
  </svg>;
};

const HannibalOverlay: React.FC<{faction: WarChessRankedFaction}> = ({faction}) => <Img src={asset(faction.image)} style={{position: 'absolute', left: 44, top: 292, width: 280, height: 350, objectFit: 'contain', objectPosition: 'center bottom', zIndex: 4, filter: 'drop-shadow(0 12px 14px rgba(0,0,0,.75))'}} />;

const RomanEmblemOverlay: React.FC<{faction: WarChessRankedFaction}> = ({faction}) => <div style={{position: 'absolute', right: 42, top: 300, width: 270, height: 300, zIndex: 4, filter: 'drop-shadow(0 12px 14px rgba(0,0,0,.75))', textAlign: 'center'}}>
  <svg width="270" height="220" viewBox="0 0 98 110" aria-hidden="true">
  <path d="M49 5 L89 18 V52 C89 78 70 96 49 105 C28 96 9 78 9 52 V18 Z" fill={`${colors.signal}38`} stroke={colors.signal} strokeWidth="5" />
  <path d="M49 23 V83 M28 53 H70" stroke={colors.signal} strokeWidth="7" strokeLinecap="round" />
</svg><div style={{fontFamily: 'Arial, sans-serif', color: colors.signal, fontSize: 17, letterSpacing: 2, fontWeight: 800}}>{faction.name}</div>{faction.role && <div style={{fontFamily: 'Arial, sans-serif', color: colors.paper, fontSize: 14, letterSpacing: 1.7, marginTop: 5}}>{faction.role}</div>}</div>;

type ArrowHead = {tip: [number, number]; angle: number};
const arrowHeadPath = ({tip, angle}: ArrowHead): string => {
  const [tipX, tipY] = tip;
  const length = 44;
  const halfWidth = 24;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const perpendicularX = -directionY;
  const perpendicularY = directionX;
  const baseX = tipX - directionX * length;
  const baseY = tipY - directionY * length;
  const leftX = baseX + perpendicularX * halfWidth;
  const leftY = baseY + perpendicularY * halfWidth;
  const rightX = baseX - perpendicularX * halfWidth;
  const rightY = baseY - perpendicularY * halfWidth;
  return `M ${tipX} ${tipY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
};

const Arrow: React.FC<{path: string; opacity: number; color: string; head: ArrowHead}> = ({path, opacity, color, head}) => <g opacity={opacity}>
  <path d={path} fill="none" stroke={color} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
  <path d={arrowHeadPath(head)} fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" />
</g>;

const MovementArrowsV2: React.FC<{frame: number}> = ({frame}) => {
  const roman = fade(frame, 42, 100);
  const yieldMove = fade(frame, 101, 161);
  const left = fade(frame, 160, 220);
  const right = fade(frame, 215, 267);
  const rear = fade(frame, 258, 314);
  return <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 3}}>
    <Arrow path="M690 715 Q820 585 992 463" opacity={roman} color={colors.signal} head={{tip: [1032, 448], angle: -0.35}} />
    <Arrow path="M1090 500 Q1110 400 1147 323" opacity={yieldMove} color={colors.slate} head={{tip: [1165, 285], angle: -1.12}} />
    <Arrow path="M1000 400 Q760 220 512 318" opacity={left} color={colors.gold} head={{tip: [470, 330], angle: 2.85}} />
    <Arrow path="M1400 400 Q1480 230 1517 301" opacity={right} color={colors.gold} head={{tip: [1550, 330], angle: 0.73}} />
    <Arrow path="M1100 650 Q1100 750 1100 806" opacity={rear} color={colors.signal} head={{tip: [1100, 850], angle: 1.571}} />
  </svg>;
};

const romanStart = Array.from({length: 8}, (_, index) => point(680 + (index % 4) * 90, 690 + Math.floor(index / 4) * 85));
const romanEnd = Array.from({length: 8}, (_, index) => point(690 + (index % 4) * 90, 520 + Math.floor(index / 4) * 85));
const hannibalStart = Array.from({length: 6}, (_, index) => point(1100 + (index % 3) * 95, 325 + Math.floor(index / 3) * 85));
const hannibalYield = Array.from({length: 6}, (_, index) => point(1130 + (index % 3) * 95, 275 + Math.floor(index / 3) * 415));
const leftKnightStart = [point(1000, 320), point(1000, 400)];
const leftKnightEnd = [point(470, 450), point(470, 550)];
const rightKnightStart = [point(1400, 320), point(1400, 400)];
const rightKnightEnd = [point(1510, 450), point(1510, 550)];
const rookStart = point(1050, 700);
const rookEnd = point(1050, 820);

const PieceGrammarV2: React.FC<{frame: number}> = ({frame}) => {
  const roman = progress(frame, 42, 96);
  const yieldMove = progress(frame, 101, 153);
  const left = progress(frame, 160, 209);
  const right = progress(frame, 215, 262);
  const rear = progress(frame, 258, 307);
  return <>
    {romanStart.map((from, index) => <V2Marker key={`roman-${index}`} kind="pawn" faction="rome" position={mixPoint(from, romanEnd[index], roman)} size={50} />)}
    {hannibalStart.map((from, index) => <V2Marker key={`hannibal-${index}`} kind="pawn" faction="carthage" position={mixPoint(from, hannibalYield[index], yieldMove)} size={50} />)}
    {leftKnightStart.map((from, index) => <V2Marker key={`left-knight-${index}`} kind="knight" faction="carthage" position={mixPoint(from, leftKnightEnd[index], left)} size={62} />)}
    {rightKnightStart.map((from, index) => <V2Marker key={`right-knight-${index}`} kind="knight" faction="carthage" position={mixPoint(from, rightKnightEnd[index], right)} size={62} />)}
    <V2Marker kind="rook" faction="carthage" position={mixPoint(rookStart, rookEnd, rear)} size={62} />
  </>;
};

const StageLabelV2: React.FC<{frame: number; text: string; start: number; end: number; color?: string}> = ({frame, text, start, end, color = colors.paper}) => {
  const opacity = fade(frame, start, end, 12);
  return <div style={{position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)', opacity, color, fontFamily: 'Arial, sans-serif', fontSize: 36, fontWeight: 700, letterSpacing: 3.2, textAlign: 'center', whiteSpace: 'nowrap', zIndex: 5}}>{text}</div>;
};

export const WarChessMapRankedPiecesV2: React.FC<WarChessMapRankedPiecesV2Props> = (props) => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 24], [0, 1], clamp);
  return <AbsoluteFill style={{backgroundColor: colors.stage, color: colors.paper, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, rgba(154, 110, 60, 0.2), transparent 62%)'}} />
    <Img src={asset(props.map)} style={{position: 'absolute', left: mapFrame.left, top: mapFrame.top, width: mapFrame.width, height: mapFrame.height, objectFit: 'cover', objectPosition: 'center center', opacity: 0.36, filter: 'grayscale(1) sepia(.2) contrast(.86) brightness(.82)', zIndex: 1}} />
    <div style={{position: 'absolute', left: mapFrame.left, top: mapFrame.top, width: mapFrame.width, height: mapFrame.height, backgroundColor: '#17130f', opacity: 0.42, border: `1px solid ${colors.line}`, boxSizing: 'border-box', zIndex: 2}} />
    <div style={{position: 'absolute', left: mapFrame.left, top: mapFrame.top, width: mapFrame.width, height: mapFrame.height, background: 'radial-gradient(ellipse at center, transparent 28%, rgba(23,19,15,.5) 100%)', zIndex: 2}} />
    {props.eyebrow && <div style={{position: 'absolute', left: 72, top: 48, fontFamily: 'Arial, sans-serif', fontSize: 27, letterSpacing: 4, color: colors.gold, opacity: intro, zIndex: 5}}>{props.eyebrow}</div>}
    {props.rightTag && <div style={{position: 'absolute', right: 72, top: 52, fontFamily: 'Arial, sans-serif', fontSize: 16, letterSpacing: 2, color: colors.muted, textAlign: 'right', opacity: intro, zIndex: 5}}>{props.rightTag}</div>}
    <HannibalOverlay faction={props.factions[1]} />
    <RomanEmblemOverlay faction={props.factions[0]} />
    <PieceGrammarV2 frame={frame} />
    <MovementArrowsV2 frame={frame} />
    {props.mapCaption && <div style={{position: 'absolute', left: 325, top: 176, fontFamily: 'Arial, sans-serif', fontSize: 14, letterSpacing: 2.4, color: colors.muted, zIndex: 5}}>{props.mapCaption}</div>}
    {props.footer && <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 12, fontFamily: 'Arial, sans-serif', fontSize: 13, letterSpacing: 1.8, color: colors.muted, zIndex: 5}}>{props.footer}</div>}
    {props.stageLabels?.map((text, index) => { const count = props.stageLabels?.length ?? 1; const start = 28 + index * (332 / count); const end = start + (332 / count) + 12; return <StageLabelV2 key={`${text}-${index}`} frame={frame} text={text} start={start} end={end} color={index % 2 ? colors.gold : colors.paper} />; })}
  </AbsoluteFill>;
};
