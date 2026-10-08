import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const WC11_ID = 'WC11_CAMPAIGN_TIMELINE_MAP_20260722';
export const WC11_COMPOSITION_ID = 'WarChessWC11CampaignTimeline';
export const WC11_FRAMES = 420;

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const colors = {stage: '#242220', paper: '#f1e7d2', gold: '#c69346', signal: '#a83c32', slate: '#8faeb7', muted: '#b5aa99', line: '#6f5a42', dark: '#1b1714'};
const asset = (path: string): string => staticFile(path);
const fade = (frame: number, start: number, end: number, hold = 8): number => Math.min(interpolate(frame, [start, start + hold], [0, 1], clamp), interpolate(frame, [end - hold, end], [1, 0], clamp));

type Stop = {place: string; date: string; x: number; y: number; start?: number; end?: number};
type TimedStop = Omit<Stop, 'start' | 'end'> & {start: number; end: number};
export type WarChessWC11Stop = Stop;
export type WarChessWC11Props = {map: string; stops: Stop[]; eyebrow?: string; rightTag?: string; mapCaption?: string; campaignStartLabel?: string; footer?: string};

type ArrowHead = {tip: [number, number]; angle: number};
const arrowHeadPath = ({tip, angle}: ArrowHead): string => {
  const [tipX, tipY] = tip; const length = 28; const halfWidth = 14;
  const dx = Math.cos(angle); const dy = Math.sin(angle); const px = -dy; const py = dx;
  const bx = tipX - dx * length; const by = tipY - dy * length;
  return `M ${tipX} ${tipY} L ${bx + px * halfWidth} ${by + py * halfWidth} L ${bx - px * halfWidth} ${by - py * halfWidth} Z`;
};
const Arrow: React.FC<{from: [number, number]; to: [number, number]; opacity: number}> = ({from, to, opacity}) => {
  const dx = to[0] - from[0]; const dy = to[1] - from[1]; const length = Math.hypot(dx, dy); const ux = dx / length; const uy = dy / length;
  const lineEnd: [number, number] = [to[0] - ux * 27, to[1] - uy * 27];
  const path = `M ${from[0]} ${from[1]} Q ${(from[0] + lineEnd[0]) / 2} ${(from[1] + lineEnd[1]) / 2 - 26} ${lineEnd[0]} ${lineEnd[1]}`;
  return <g opacity={opacity}>
    <path d={path} fill="none" stroke={colors.gold} strokeWidth="13" strokeLinecap="round" />
    <path d={arrowHeadPath({tip: to, angle: Math.atan2(dy, dx)})} fill={colors.gold} stroke={colors.gold} strokeWidth="2" strokeLinejoin="round" />
  </g>;
};

const MapSurface: React.FC<{map: string}> = ({map}) => <>
  <Img src={asset(map)} style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, objectFit: 'cover', opacity: 0.27, filter: 'grayscale(1) sepia(.35) contrast(.86) brightness(.64)', zIndex: 1}} />
  <div style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, backgroundColor: colors.dark, opacity: 0.43, border: `1px solid ${colors.line}`, boxSizing: 'border-box', zIndex: 2}} />
  <div style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, background: 'radial-gradient(ellipse at center, transparent 22%, rgba(23,19,15,.5) 100%)', zIndex: 2}} />
</>;

const Marker: React.FC<{stop: TimedStop; frame: number; index: number; campaignStartLabel?: string}> = ({stop, frame, index, campaignStartLabel}) => {
  const active = fade(frame, stop.start, stop.end, 8);
  const prior = frame >= stop.end ? 0.35 : 0;
  const future = frame < stop.start ? 0.18 : 0;
  const opacity = Math.max(active, prior, future);
  const current = active > 0.65;
  return <g opacity={opacity}>
    {current && <circle cx={stop.x} cy={stop.y} r="29" fill="none" stroke={colors.gold} strokeWidth="3" opacity=".75" />}
    <circle cx={stop.x} cy={stop.y} r={current ? 12 : 8} fill={current ? colors.gold : colors.slate} stroke={colors.paper} strokeWidth="2" />
    {current && <text x={stop.x + 22} y={stop.y - 18} fill={colors.paper} fontFamily="Arial, sans-serif" fontSize="18" fontWeight="700" letterSpacing="1.2">{stop.place}</text>}
    {index === 0 && campaignStartLabel && <text x={stop.x - 68} y={stop.y + 40} fill={colors.muted} fontFamily="Arial, sans-serif" fontSize="14" letterSpacing="1.2">{campaignStartLabel}</text>}
  </g>;
};

const Route: React.FC<{frame: number; stops: TimedStop[]; campaignStartLabel?: string}> = ({frame, stops, campaignStartLabel}) => <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, zIndex: 3, overflow: 'visible', pointerEvents: 'none'}}>
  {stops.slice(1).map((stop, index) => {
    const prev = stops[index]; const active = fade(frame, stop.start, stop.end, 8);
    const prior = frame >= stop.end ? 0.28 : 0;
    return <React.Fragment key={stop.place}>
      <path d={`M ${prev.x} ${prev.y} L ${stop.x} ${stop.y}`} stroke={colors.slate} strokeWidth="5" strokeDasharray="10 12" opacity={Math.max(active * 0.55, prior)} fill="none" />
      <Arrow from={[prev.x, prev.y]} to={[stop.x, stop.y]} opacity={active * 0.95} />
    </React.Fragment>;
  })}
  {stops.map((stop, index) => <Marker key={stop.place} stop={stop} frame={frame} index={index} campaignStartLabel={campaignStartLabel} />)}
</svg>;

const Timeline: React.FC<{frame: number; stops: TimedStop[]}> = ({frame, stops}) => {
  const activeStop = stops.find((stop) => frame >= stop.start && frame < stop.end) ?? (frame >= stops[stops.length - 1].end ? stops[stops.length - 1] : stops[0]);
  const currentOpacity = fade(frame, activeStop.start, activeStop.end, 8);
  return <>
    <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 98, opacity: currentOpacity, color: colors.gold, fontFamily: 'Arial, sans-serif', fontSize: 42, fontWeight: 700, letterSpacing: 2.6, zIndex: 6, whiteSpace: 'nowrap'}}>{activeStop.place} · {activeStop.date}</div>
    <div style={{position: 'absolute', left: 440, right: 440, bottom: 88, height: 2, backgroundColor: colors.line, zIndex: 6}} />
    {stops.map((stop, index) => {
      const x = 440 + index * (1040 / Math.max(1, stops.length - 1));
      const active = fade(frame, stop.start, stop.end, 8);
      return <div key={stop.place} style={{position: 'absolute', left: x - 8, bottom: 80, width: 16, height: 16, borderRadius: 99, backgroundColor: active > 0.6 ? colors.gold : colors.slate, opacity: frame >= stop.start ? 1 : 0.28, border: `2px solid ${colors.paper}`, zIndex: 7}}>
        <div style={{position: 'absolute', top: 22, left: -50, width: 116, textAlign: 'center', color: active > 0.6 ? colors.paper : colors.muted, fontFamily: 'Arial, sans-serif', fontSize: 15, letterSpacing: 0.8, lineHeight: 1.2}}>{stop.date}<br />{stop.place}</div>
      </div>;
    })}
  </>;
};

export const WarChessWC11CampaignTimeline: React.FC<WarChessWC11Props> = (props) => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 24], [0, 1], clamp);
  const segment = 360 / props.stops.length;
  const stops: TimedStop[] = props.stops.map((stop, index) => ({...stop, start: 24 + index * segment, end: 24 + (index + 0.82) * segment}));
  return <AbsoluteFill style={{backgroundColor: colors.stage, color: colors.paper, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(154,110,60,.18), transparent 66%)'}} />
    <MapSurface map={props.map} />
    {props.eyebrow && <div style={{position: 'absolute', left: 72, top: 48, fontFamily: 'Arial, sans-serif', fontSize: 27, letterSpacing: 4, color: colors.gold, opacity: intro, zIndex: 6}}>{props.eyebrow}</div>}
    {props.rightTag && <div style={{position: 'absolute', right: 72, top: 52, fontFamily: 'Arial, sans-serif', fontSize: 16, letterSpacing: 2, color: colors.muted, textAlign: 'right', opacity: intro, zIndex: 6}}>{props.rightTag}</div>}
    {props.mapCaption && <div style={{position: 'absolute', left: 382, top: 178, fontFamily: 'Arial, sans-serif', fontSize: 14, letterSpacing: 2.4, color: colors.muted, zIndex: 6}}>{props.mapCaption}</div>}
    <Route frame={frame} stops={stops} campaignStartLabel={props.campaignStartLabel} />
    <Timeline frame={frame} stops={stops} />
    {props.footer && <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 12, fontFamily: 'Arial, sans-serif', fontSize: 13, letterSpacing: 1.8, color: colors.muted, zIndex: 7}}>{props.footer}</div>}
  </AbsoluteFill>;
};
