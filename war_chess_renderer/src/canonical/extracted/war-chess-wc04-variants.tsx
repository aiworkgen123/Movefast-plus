import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const colors = {
  stage: '#17130f',
  paper: '#f1e7d2',
  amber: '#d7b275',
  signal: '#b94b39',
  slate: '#7b8a8e',
  muted: '#a8977f',
  line: '#5c4934',
};

const Text: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{fontFamily: 'Arial, Helvetica, sans-serif', ...style}}>{children}</div>
);

const asset = (path: string): string => path.startsWith('/') || path.startsWith('http') ? path : staticFile(path);
const progress = (frame: number, start: number, end: number): number => interpolate(frame, [start, end], [0, 1], {...clamp, easing: ease});
export const WAR_CHESS_WC04C_CHESS_ENHANCED_COMPOSITION_ID = 'WarChessWC04CChessEnhanced';

export type WC04Faction = {name: string; image: string; role?: string};
export type WarChessWC04MovementProps = {
  map: string;
  factions: [WC04Faction, WC04Faction];
  stageLabels: string[];
  eyebrow?: string;
  rightTag?: string;
  reconstructionLabel?: string;
  evaluationLabel?: string;
  leftAdvantageLabel?: string;
  rightAdvantageLabel?: string;
  threatenedCenterLabel?: string;
  rearCloseLabel?: string;
  footer?: string;
};

type ChessPieceKind = 'pawn' | 'knight' | 'rook';

const ChessPieceSilhouette: React.FC<{
  kind: ChessPieceKind;
  x: number;
  y: number;
  color: string;
  opacity?: number;
  scale?: number;
}> = ({kind, x, y, color, opacity = 1, scale = 1}) => {
  const fill = `${color}e8`;
  const stroke = '#110d0a';
  return (
    <svg
      width="72"
      height="92"
      viewBox="0 0 72 92"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        overflow: 'visible',
      }}
    >
      {kind === 'pawn' && (
        <>
          <circle cx="36" cy="16" r="11" fill={fill} stroke={stroke} strokeWidth="3" />
          <path d="M27 29h18l4 19 8 13v10H15V61l8-13z" fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
          <path d="M12 72h48v8H12z" fill={fill} stroke={stroke} strokeWidth="3" />
        </>
      )}
      {kind === 'knight' && (
        <path
          d="M16 78h45v-8H50c4-10 3-20-2-28-4-7-10-12-18-15l7-10-12-5-9 14 8 8c-7 8-10 17-8 27l3 9H9v8zm17-48c7 4 11 9 12 16l-6 8-12-6c-1-6 1-12 6-18z"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      {kind === 'rook' && (
        <>
          <path d="M14 12h10v10h8V12h9v10h8V12h10v17H55l-3 29h8v10H12V58h8l-3-29h-3z" fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
          <path d="M10 68h52v10H10z" fill={fill} stroke={stroke} strokeWidth="3" />
        </>
      )}
    </svg>
  );
};

const ChessEnhancedHannibalAnchor: React.FC<{faction: WC04Faction}> = ({faction}) => (
  <div style={{position: 'absolute', left: 62, top: 766, width: 198, height: 230, border: `1px solid ${colors.amber}`, backgroundColor: '#0d0a08e8', boxSizing: 'border-box', padding: 14}}>
    <Img src={asset(faction.image)} style={{display: 'block', width: '100%', height: 146, objectFit: 'contain', objectPosition: 'center top'}} />
    <Text style={{fontSize: 20, color: colors.paper, letterSpacing: 2.6, fontWeight: 800, marginTop: 8}}>{faction.name}</Text>
    {faction.role && <Text style={{fontSize: 14, color: colors.amber, letterSpacing: 1.7, marginTop: 5}}>{faction.role}</Text>}
  </div>
);

const ChessEnhancedRomanAnchor: React.FC<{faction: WC04Faction}> = ({faction}) => (
  <div style={{position: 'absolute', right: 62, top: 774, width: 184, height: 222, border: `1px solid ${colors.signal}`, backgroundColor: '#0d0a08e8', boxSizing: 'border-box', padding: 14, textAlign: 'center'}}>
    <svg width="88" height="108" viewBox="0 0 98 110" style={{display: 'block', margin: '0 auto'}}>
      <path d="M49 5 L89 18 V52 C89 78 70 96 49 105 C28 96 9 78 9 52 V18 Z" fill={`${colors.signal}33`} stroke={colors.signal} strokeWidth="5" />
      <path d="M49 23 V83 M28 53 H70" stroke={colors.signal} strokeWidth="7" strokeLinecap="round" />
    </svg>
    <Text style={{fontSize: 17, color: colors.signal, letterSpacing: 2, fontWeight: 800, marginTop: 4}}>{faction.name}</Text>
    {faction.role && <Text style={{fontSize: 14, color: colors.paper, letterSpacing: 1.7, marginTop: 5}}>{faction.role}</Text>}
  </div>
);

export const WarChessWC04CChessEnhanced: React.FC<WarChessWC04MovementProps> = (props) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const intro = interpolate(frame, [0, 30], [0.9, 1], clamp);
  const stageCount = props.stageLabels.length;
  const stageSpan = 205 / stageCount;
  const stageStart = (index: number): number => 34 + index * stageSpan;
  const stageEnd = (index: number): number => stageStart(index) + stageSpan;
  const phase = (startIndex: number, endIndex: number): number => progress(frame, stageStart(startIndex), stageEnd(endIndex - 1));
  const romeAdvance = phase(0, 1);
  const centerYield = phase(0, Math.min(stageCount, 2));
  const flankClear = phase(Math.max(0, stageCount - 3), stageCount);
  const rearClose = phase(Math.max(0, stageCount - 2), stageCount);
  const trapped = phase(Math.max(0, stageCount - 1), stageCount);
  const danger = progress(frame, stageStart(Math.max(0, Math.floor(stageCount * 0.55))), stageEnd(stageCount - 1));
  const activeStage = Math.min(stageCount - 1, Math.max(0, Math.floor(Math.max(frame - 34, 0) / stageSpan)));
  const mapDarken = interpolate(danger, [0, 1], [0.26, 0.52], clamp);
  const evalX = interpolate(frame, [0, 48, 92, 134, 180, 224, 239], [770, 746, 820, 922, 1030, 1135, 1170], clamp);
  const romeCenterX = interpolate(romeAdvance, [0, 1], [1144, 922]);
  const leftKnightX = interpolate(flankClear, [0, 1], [690, 430]);
  const rightKnightX = interpolate(flankClear, [0, 1], [1300, 1550]);
  const leftRearX = interpolate(rearClose, [0, 1], [430, 770]);
  const rightRearX = interpolate(rearClose, [0, 1], [1550, 1190]);
  const flankY = interpolate(flankClear, [0, 1], [548, 398]);
  const rearY = interpolate(rearClose, [0, 1], [398, 725]);
  const centerDangerOpacity = interpolate(danger, [0, 1], [0, 0.22]);
  const visible = (start: number, end: number): number => progress(frame, start, end);

  return (
    <AbsoluteFill style={{backgroundColor: '#0c0907', color: colors.paper, overflow: 'hidden'}}>
      <Img
        src={asset(props.map)}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.54, filter: 'sepia(0.28) saturate(0.68) contrast(0.9)'}}
      />
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#080605', opacity: mapDarken}} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 52% 52%, transparent 0%, #090604 76%)', opacity: interpolate(danger, [0, 1], [0.18, 0.46], clamp)}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 292, backgroundColor: '#0b0806', opacity: 0.84}} />

      {props.eyebrow && <Text style={{position: 'absolute', left: 66, top: 40, fontSize: 27, letterSpacing: 4, color: colors.amber, opacity: intro}}>{props.eyebrow}</Text>}
      {props.rightTag && <Text style={{position: 'absolute', right: 66, top: 44, fontSize: 16, letterSpacing: 2, color: colors.muted, opacity: intro}}>{props.rightTag}</Text>}
      {props.reconstructionLabel && <div style={{position: 'absolute', left: 66, top: 110, padding: '10px 14px', border: `1px solid ${colors.signal}`, backgroundColor: '#0b0807d9', color: colors.signal, fontSize: 16, letterSpacing: 2, fontWeight: 700, opacity: intro}}>{props.reconstructionLabel}</div>}

      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {props.evaluationLabel && <text x="960" y="124" fill={colors.muted} textAnchor="middle" fontSize="14" letterSpacing="3" opacity={intro}>{props.evaluationLabel}</text>}
        {props.leftAdvantageLabel && <text x="642" y="148" fill={colors.signal} textAnchor="start" fontSize="17" letterSpacing="2.4" opacity={intro}>{props.leftAdvantageLabel}</text>}
        {props.rightAdvantageLabel && <text x="1278" y="148" fill={colors.slate} textAnchor="end" fontSize="17" letterSpacing="2.4" opacity={intro}>{props.rightAdvantageLabel}</text>}
        <rect x="640" y="160" width="640" height="24" rx="12" fill="#120f0d" stroke={colors.line} strokeWidth="2" opacity={intro} />
        <rect x="644" y="164" width="312" height="16" rx="8" fill={`${colors.signal}c7`} opacity={intro} />
        <rect x="956" y="164" width="320" height="16" rx="8" fill={`${colors.slate}c7`} opacity={intro} />
        <line x1={evalX} y1="155" x2={evalX} y2="189" stroke={colors.paper} strokeWidth="3" opacity={intro} />
        <circle cx={evalX} cy="172" r="8" fill={colors.paper} stroke="#120f0d" strokeWidth="3" opacity={intro} />

        <rect x="315" y="290" width="1290" height="540" rx="22" fill="#0e0b09" fillOpacity="0.2" stroke={colors.line} strokeWidth="2" opacity={intro * 0.75} />
        <text x="960" y="330" fill={activeStage === 4 ? colors.signal : colors.amber} textAnchor="middle" fontSize={activeStage === 4 ? 29 : 26} letterSpacing="3.5" opacity={intro}> {props.stageLabels[activeStage]} </text>

        <path d={`M 1238 530 Q ${1080 - romeAdvance * 26} 414 ${romeCenterX - 65} 530`} fill="none" stroke={colors.signal} strokeWidth="8" strokeDasharray="22 18" strokeDashoffset={interpolate(romeAdvance, [0, 1], [680, 0])} opacity={romeAdvance * 0.8} />
        <path d={`M 768 532 Q ${890 + centerYield * 34} 438 ${1008 + centerYield * 55} 544`} fill="none" stroke={colors.slate} strokeWidth="7" strokeDasharray="19 17" strokeDashoffset={interpolate(centerYield, [0, 1], [580, 0])} opacity={centerYield * 0.85} />
        <path d={`M 670 546 Q ${535 - flankClear * 72} 332 ${leftKnightX} ${flankY}`} fill="none" stroke={colors.slate} strokeWidth="7" strokeDasharray="20 18" strokeDashoffset={interpolate(flankClear, [0, 1], [650, 0])} opacity={flankClear * 0.8} />
        <path d={`M 1302 546 Q ${1438 + flankClear * 72} 332 ${rightKnightX} ${flankY}`} fill="none" stroke={colors.slate} strokeWidth="7" strokeDasharray="20 18" strokeDashoffset={interpolate(flankClear, [0, 1], [650, 0])} opacity={flankClear * 0.8} />
        <path d={`M ${leftRearX} ${rearY} Q 960 920 ${rightRearX} ${rearY}`} fill="none" stroke={colors.amber} strokeWidth="8" strokeLinecap="round" strokeDasharray="22 18" strokeDashoffset={interpolate(rearClose, [0, 1], [900, 0])} opacity={rearClose * 0.9} />

        <ellipse cx={romeCenterX} cy="562" rx={240 + danger * 54} ry={145 + danger * 34} fill={colors.signal} opacity={centerDangerOpacity} />
        <ellipse cx={romeCenterX} cy="562" rx={240 + danger * 54} ry={145 + danger * 34} fill="none" stroke={colors.signal} strokeWidth="4" strokeDasharray="15 12" opacity={danger * 0.88} />
        {props.threatenedCenterLabel && <text x={romeCenterX} y="416" fill={colors.signal} textAnchor="middle" fontSize="18" letterSpacing="2.8" opacity={danger * 0.9}>{props.threatenedCenterLabel}</text>}
        {props.rearCloseLabel && <text x="960" y="866" fill={colors.amber} textAnchor="middle" fontSize="20" letterSpacing="3.4" opacity={rearClose}>{props.rearCloseLabel}</text>}
      </svg>

      <div style={{position: 'absolute', left: 408, right: 408, top: 218, height: 56, display: 'flex', gap: 8, opacity: intro}}>
        {props.stageLabels.map((label, index) => {
          const completed = index < activeStage;
          const active = index === activeStage;
          return <div key={label} style={{flex: 1, minWidth: 0, padding: '10px 9px', border: `1px solid ${active ? colors.amber : colors.line}`, backgroundColor: active ? '#20170ed9' : '#0c0907b8', color: active ? colors.amber : completed ? colors.paper : colors.muted, fontSize: index === 2 ? 13 : 14, fontWeight: active ? 800 : 600, letterSpacing: 1.05, lineHeight: 1.18, textAlign: 'center', boxSizing: 'border-box'}}>{`0${index + 1} · ${label}`}</div>;
        })}
      </div>

      {[
        {x: 1040, y: 505, opacity: visible(27, 38)},
        {x: 1095, y: 568, opacity: visible(34, 46)},
        {x: 1150, y: 631, opacity: visible(40, 52)},
      ].map((piece, index) => (
        <ChessPieceSilhouette key={`rome-pawn-${index}`} kind="pawn" x={piece.x - romeAdvance * 220} y={piece.y} color={colors.signal} opacity={piece.opacity} scale={0.72} />
      ))}
      {[
        {x: 810, y: 476, opacity: visible(54, 66)},
        {x: 865, y: 539, opacity: visible(60, 72)},
        {x: 920, y: 602, opacity: visible(66, 78)},
      ].map((piece, index) => (
        <ChessPieceSilhouette key={`hannibal-pawn-${index}`} kind="pawn" x={piece.x + centerYield * 180} y={piece.y} color={colors.slate} opacity={piece.opacity} scale={0.68} />
      ))}

      <ChessPieceSilhouette kind="knight" x={leftKnightX} y={flankY} color={colors.slate} opacity={visible(118, 132)} scale={0.74} />
      <ChessPieceSilhouette kind="knight" x={rightKnightX} y={flankY} color={colors.slate} opacity={visible(118, 132)} scale={0.74} />
      <ChessPieceSilhouette kind="knight" x={leftRearX} y={rearY} color={colors.slate} opacity={rearClose * 0.95} scale={0.68} />
      <ChessPieceSilhouette kind="knight" x={rightRearX} y={rearY} color={colors.slate} opacity={rearClose * 0.95} scale={0.68} />
      <ChessPieceSilhouette kind="rook" x={760 + rearClose * 200} y={742} color={colors.amber} opacity={rearClose} scale={0.68} />
      <ChessPieceSilhouette kind="rook" x={1160 - rearClose * 200} y={742} color={colors.amber} opacity={rearClose} scale={0.68} />

      <ChessEnhancedHannibalAnchor faction={props.factions[1]} />
      <ChessEnhancedRomanAnchor faction={props.factions[0]} />
      {props.footer && <Text style={{position: 'absolute', left: 280, right: 280, bottom: 43, textAlign: 'center', color: trapped > 0.5 ? colors.signal : colors.muted, fontSize: 17, letterSpacing: 2.2, fontWeight: 700, opacity: intro}}>{props.footer}</Text>}
    </AbsoluteFill>
  );
};
