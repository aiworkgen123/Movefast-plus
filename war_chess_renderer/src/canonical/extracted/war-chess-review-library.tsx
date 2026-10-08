import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CannaeForceComparisonProofV2, CannaeSurfaceTreatmentProofV2, type ForceComparisonProps, type SurfaceTreatmentProps} from './war-chess-candidate-library';

// Pinned visual envelope from the tested MG03 motion adaptation.  It is
// copied as a value so this production package has no dependency on the
// unrelated Leonardo proof lab.
const mg03SubjectVisual = {receded: {maxBlurPx: 1.7, minOpacity: 0.84, minBrightness: 0.8, minContrast: 0.96}} as const;

export const WAR_CHESS_WC01_ID = 'WC01';
export const WAR_CHESS_WCFX01_ID = 'WCFX01';
export const WAR_CHESS_WC02_ID = 'WC02';
export const WAR_CHESS_WC07_ID = 'WC07';
export const WAR_CHESS_WC08_ID = 'WC08';
export const WAR_CHESS_WC09_ID = 'WC09';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const palette = {
  stage: '#17130f',
  paper: '#f1e7d2',
  amber: '#d7b275',
  signal: '#b94b39',
  slate: '#7b8a8e',
  muted: '#a8977f',
  line: '#5c4934',
};

const Caption: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{fontFamily: 'Arial, Helvetica, sans-serif', ...style}}>{children}</div>
);

/**
 * Resolve an approved media path for Remotion without treating inline data or
 * externally hosted URLs as public-file names.  Public assets are intentionally
 * resolved through Remotion's staticFile helper so ordinary `assets/...`
 * project props work in both bundle and render contexts.
 */
export const resolveApprovedAsset = (path: string): string => {
  const isUrl = /^(?:data:|https?:|blob:)/i.test(path);
  return path.startsWith('/') || isUrl ? path : staticFile(path);
};

const asset = (path: string): string => resolveApprovedAsset(path);
const reveal = (frame: number, start: number, end: number): number => interpolate(frame, [start, Math.min(end, start + 28)], [0, 1], {...clamp, easing: ease});

/** Approved production aliases. Their behavior remains the already-approved v2 proof. */
export type WarChessWC01Props = ForceComparisonProps;
export const WarChessWC01ForceComparison: React.FC<WarChessWC01Props> = (props) => <CannaeForceComparisonProofV2 {...props} />;
export const WCFX01_PRESETS = {
  normal: {grain: 0.21, vignette: 0.45, dust: 0.24},
  painting: {grain: 0.189, vignette: 0.405, dust: 0.216},
  evidence_safe: {grain: 0.05, vignette: 0.1, dust: 0.05},
  off: {grain: 0, vignette: 0, dust: 0},
} as const;

export type WCFX01Preset = keyof typeof WCFX01_PRESETS;
export type WCFX01Props = Omit<SurfaceTreatmentProps, 'grainOpacity' | 'vignetteOpacity' | 'dustOpacity'> & {preset: WCFX01Preset};

/** WCFX01 applies exactly one surface treatment; all panel labels remain above it. */
export const WarChessWCFX01SurfaceTreatment: React.FC<WCFX01Props> = ({preset, imageSrc, showComparison, title, status, cleanLabel, treatedLabel}) => {
  const values = WCFX01_PRESETS[preset];
  return <CannaeSurfaceTreatmentProofV2 imageSrc={imageSrc} showComparison={showComparison} grainOpacity={values.grain} vignetteOpacity={values.vignette} dustOpacity={values.dust} title={title} status={status} cleanLabel={cleanLabel} treatedLabel={treatedLabel} />;
};

export type WarChessSubjectIntroProps = {
  subjectImage: string;
  subjectCutout: string;
  subjectName: string;
  role: string;
  storyPoints: [string, string, string];
  palette: {stage: string; paper: string; amber: string; signal: string; muted: string};
  identityNote?: string;
  eyebrow?: string;
  motionTag?: string;
  assetTag?: string;
};

const IntroCard: React.FC<{copy: string; index: number; props: WarChessSubjectIntroProps}> = ({copy, index, props}) => {
  const frame = useCurrentFrame();
  const start = 78 + index * 38;
  const cardReveal = reveal(frame, start, start + 34);
  const exit = interpolate(frame, [214, 246], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});
  return (
    <div style={{
      position: 'absolute', left: '58%', top: `${22 + index * 22}%`, width: '35%', minHeight: 132, boxSizing: 'border-box',
      padding: '24px 28px', border: `1px solid ${props.palette.muted}`, borderLeft: `5px solid ${index === 0 ? props.palette.amber : props.palette.signal}`,
      backgroundColor: 'rgba(5,5,5,0.94)', color: props.palette.paper, opacity: cardReveal * exit,
      transform: `translateX(${interpolate(cardReveal, [0, 1], [36, 0])}px)`, fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      <Caption style={{fontSize: 16, color: index === 0 ? props.palette.amber : props.palette.signal, letterSpacing: 3, fontWeight: 700, marginBottom: 10}}>{`0${index + 1} / 03`}</Caption>
      <Caption style={{fontSize: 30, lineHeight: 1.08, fontWeight: 800, letterSpacing: 1.5}}>{copy}</Caption>
    </div>
  );
};

/** War Chess adapter of the tested Leonardo MG03 causal-story motion envelope. */
export const WarChessWC02SubjectIntroduction: React.FC<WarChessSubjectIntroProps> = (props) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const opening = reveal(frame, 0, 34);
  const recede = interpolate(frame, [36, 90], [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1)});
  const restore = interpolate(frame, [214, 246], [0, 1], {...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1)});
  const depth = recede * (1 - restore);
  const x = interpolate(restore, [0, 1], [interpolate(recede, [0, 1], [0.06, 0.08]), 0.06]);
  const y = interpolate(restore, [0, 1], [interpolate(recede, [0, 1], [0.13, 0.26]), 0.13]);
  const subjectWidth = interpolate(restore, [0, 1], [interpolate(recede, [0, 1], [0.46, 0.32]), 0.46]);
  const exit = interpolate(frame, [214, 246], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});
  const sourceWidth = subjectWidth * width;
  const sourceHeight = sourceWidth * 323 / 291;
  const anchor = {x: width * 0.38, y: height * 0.58};
  const sourcePath = asset(props.subjectImage);
  const cutoutPath = asset(props.subjectCutout);
  return (
    <AbsoluteFill style={{backgroundColor: props.palette.stage, color: props.palette.paper, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 42% 48%, ${props.palette.amber}20, transparent 56%)`}} />
      {props.eyebrow && <Caption style={{position: 'absolute', left: 72, top: 48, fontSize: 28, letterSpacing: 4, color: props.palette.amber, opacity: opening}}>{props.eyebrow}</Caption>}
      {props.motionTag && <Caption style={{position: 'absolute', right: 72, top: 52, fontSize: 18, letterSpacing: 2, color: props.palette.muted, opacity: opening}}>{props.motionTag}</Caption>}
      <div style={{position: 'absolute', left: x * width, top: y * height, width: sourceWidth, height: sourceHeight, opacity: opening * exit}}>
        <Img src={sourcePath} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.22, filter: 'grayscale(1)'}} />
        <Img src={cutoutPath} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: interpolate(depth, [0, 1], [1, mg03SubjectVisual.receded.minOpacity]), filter: `blur(${depth * mg03SubjectVisual.receded.maxBlurPx}px) brightness(${interpolate(depth, [0, 1], [1, mg03SubjectVisual.receded.minBrightness])}) contrast(${interpolate(depth, [0, 1], [1, mg03SubjectVisual.receded.minContrast])})`}} />
      </div>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
        {props.storyPoints.map((_, index) => {
          const start = 78 + index * 38;
          const cardY = height * (0.22 + index * 0.22) + 68;
          const path = `M ${anchor.x} ${anchor.y} C ${width * 0.47} ${height * (0.52 + index * 0.02)}, ${width * 0.53} ${height * (0.31 + index * 0.21)}, ${width * 0.58} ${cardY}`;
          const amount = reveal(frame, start, start + 34);
          return <path key={index} d={path} fill="none" stroke={index === 0 ? props.palette.amber : props.palette.signal} strokeWidth={3} strokeLinecap="round" strokeDasharray="900" strokeDashoffset={interpolate(amount, [0, 1], [900, 0])} opacity={amount * exit} />;
        })}
      </svg>
      {props.storyPoints.map((copy, index) => <IntroCard key={copy} copy={copy} index={index} props={props} />)}
      <div style={{position: 'absolute', left: 72, bottom: 58, opacity: opening * exit}}>
        <Caption style={{fontSize: 44, letterSpacing: 3, fontWeight: 800, color: props.palette.paper}}>{props.subjectName}</Caption>
        <Caption style={{fontSize: 22, letterSpacing: 2, color: props.palette.amber, marginTop: 9}}>{props.role}</Caption>
        {props.identityNote && <Caption style={{fontSize: 15, letterSpacing: 1, color: props.palette.muted, marginTop: 15, maxWidth: 560}}>{props.identityNote}</Caption>}
      </div>
      {props.assetTag && <Caption style={{position: 'absolute', right: 72, bottom: 58, fontSize: 16, letterSpacing: 2, color: props.palette.muted, opacity: opening * exit}}>{props.assetTag}</Caption>}
    </AbsoluteFill>
  );
};

export type WarChessWC07Props = {subjects: [{name: string; image: string}, {name: string; image: string}, {name: string; image: string}]; eyebrow?: string; sideNote?: string; footer?: string};
export const WarChessWC07ArchivalLayoutProof: React.FC<WarChessWC07Props> = (props) => {
  const frame = useCurrentFrame();
  const intro = reveal(frame, 0, 30);
  return <AbsoluteFill style={{backgroundColor: '#15120f', color: palette.paper, padding: '62px 76px'}}>
    {props.eyebrow && <Caption style={{fontSize: 28, letterSpacing: 4, color: palette.amber, opacity: intro}}>{props.eyebrow}</Caption>}
    {props.sideNote && <Caption style={{position: 'absolute', right: 76, top: 70, fontSize: 18, letterSpacing: 2, color: palette.signal}}>{props.sideNote}</Caption>}
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 58, height: 760}}>
      {props.subjects.map((subject, index) => {
        const amount = reveal(frame, 24 + index * 38, 58 + index * 38);
        return <div key={index} style={{position: 'relative', backgroundColor: '#0c0a08', border: `1px solid ${palette.line}`, opacity: intro * amount, transform: `translateY(${interpolate(amount, [0, 1], [26, 0])}px)`}}>
          <Img src={asset(subject.image)} style={{width: '100%', height: '100%', objectFit: 'contain', filter: index === 1 ? 'sepia(0.35)' : 'none', opacity: 0.9}} />
          <Caption style={{position: 'absolute', left: 20, right: 20, bottom: 18, fontSize: 15, lineHeight: 1.3, letterSpacing: 1.5, color: palette.paper, textShadow: '0 2px 8px #000'}}>{subject.name}</Caption>
        </div>;
      })}
    </div>
    {props.footer && <Caption style={{position: 'absolute', left: 76, bottom: 48, fontSize: 15, letterSpacing: 1.4, color: palette.muted}}>{props.footer}</Caption>}
  </AbsoluteFill>;
};

export type WarChessWC08Props = {underlyingMedia: string; labels?: {key: string; value: string}[]; eyebrow?: string; rightTag?: string; footer?: string};
export const WarChessWC08LowerThird: React.FC<WarChessWC08Props> = (props) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor: 'transparent', color: palette.paper}}>
    <Img src={asset(props.underlyingMedia)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
    {props.eyebrow && <Caption style={{position: 'absolute', left: 86, top: 70, fontSize: 28, letterSpacing: 4, color: palette.amber}}>{props.eyebrow}</Caption>}
    {props.rightTag && <Caption style={{position: 'absolute', right: 86, top: 76, fontSize: 17, letterSpacing: 2, color: palette.muted}}>{props.rightTag}</Caption>}
    <div style={{position: 'absolute', left: 86, bottom: 126, width: 1300, height: 160, borderTop: `2px solid ${palette.amber}`, borderBottom: `1px solid ${palette.line}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26, padding: '28px 0', boxSizing: 'border-box', background: 'linear-gradient(90deg, rgba(10, 8, 6, 0.84) 0%, rgba(10, 8, 6, 0.68) 68%, rgba(10, 8, 6, 0.2) 100%)', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.24)'}}>
      {props.labels?.map(({key, value}, index) => { const amount = reveal(frame, 24 + index * 28, 58 + index * 28); return <div key={key} style={{opacity: amount, transform: `translateX(${interpolate(amount, [0, 1], [42, 0])}px)`, borderLeft: `4px solid ${index === 0 ? palette.signal : palette.amber}`, paddingLeft: 18}}><Caption style={{fontSize: 16, color: palette.muted, letterSpacing: 3}}>{key}</Caption><Caption style={{fontSize: 34, color: palette.paper, fontWeight: 800, letterSpacing: 2, marginTop: 10}}>{value}</Caption></div>; })}
    </div>
    {props.footer && <div style={{position: 'absolute', left: 86, bottom: 66}}><div aria-hidden="true" style={{position: 'absolute', inset: '-7px -18px -7px -12px', borderRadius: 3, background: 'linear-gradient(90deg, rgba(10, 8, 6, 0.64), rgba(10, 8, 6, 0.18) 82%, transparent)', boxShadow: '0 5px 14px rgba(0, 0, 0, 0.18)'}} /><Caption style={{position: 'relative', fontSize: 15, letterSpacing: 1.5, color: palette.muted, textShadow: '0 2px 6px rgba(0, 0, 0, 0.82)'}}>{props.footer}</Caption></div>}
  </AbsoluteFill>;
};

type NormalizedSafeZone = {x: number; y: number; width: number; height: number};
type OverlayPlacement = {left: number; top: number; width: number};

const WC09_PLACEMENTS: OverlayPlacement[] = [
  {left: 88, top: 340, width: 1120},
  {left: 1000, top: 650, width: 832},
  {left: 920, top: 340, width: 912},
  {left: 88, top: 650, width: 912},
];

const overlapArea = (placement: OverlayPlacement, zone: NormalizedSafeZone): number => {
  const overlay = {x: placement.left, y: placement.top - 22, width: placement.width, height: 300};
  const safe = {x: zone.x * 1920, y: zone.y * 1080, width: zone.width * 1920, height: zone.height * 1080};
  const overlapWidth = Math.max(0, Math.min(overlay.x + overlay.width, safe.x + safe.width) - Math.max(overlay.x, safe.x));
  const overlapHeight = Math.max(0, Math.min(overlay.y + overlay.height, safe.y + safe.height) - Math.max(overlay.y, safe.y));
  return overlapWidth * overlapHeight;
};

export const chooseWC09OverlayPlacement = (faceSafeZone?: NormalizedSafeZone): OverlayPlacement => {
  if (!faceSafeZone) return WC09_PLACEMENTS[0];
  return WC09_PLACEMENTS.reduce((best, candidate) =>
    overlapArea(candidate, faceSafeZone) < overlapArea(best, faceSafeZone) ? candidate : best
  );
};

export type WarChessWC09Props = {underlyingMedia: string; statistic?: string; eyebrow?: string; rightTag?: string; footer?: string; faceSafeZone?: NormalizedSafeZone};
export const WarChessWC09CasualtyProof: React.FC<WarChessWC09Props> = (props) => {
  const frame = useCurrentFrame();
  const amount = reveal(frame, 0, 36);
  const placement = chooseWC09OverlayPlacement(props.faceSafeZone);
  return <AbsoluteFill style={{backgroundColor: 'transparent', color: palette.paper, padding: '72px 88px'}}>
    <Img src={asset(props.underlyingMedia)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
    {props.eyebrow && <Caption style={{fontSize: 30, letterSpacing: 4, color: palette.amber, opacity: amount}}>{props.eyebrow}</Caption>}
    {props.rightTag && <Caption style={{position: 'absolute', right: 88, top: 80, fontSize: 18, letterSpacing: 2, color: palette.signal, opacity: amount}}>{props.rightTag}</Caption>}
    <div style={{position: 'absolute', left: placement.left, top: placement.top, width: placement.width, opacity: amount, transform: `translateY(${interpolate(amount, [0, 1], [30, 0])}px)`}}>
      <div aria-hidden="true" style={{position: 'absolute', left: -18, top: -22, width: 'calc(100% + 36px)', height: 182, borderRadius: 4, background: 'linear-gradient(90deg, rgba(10, 8, 6, 0.86) 0%, rgba(10, 8, 6, 0.66) 67%, rgba(10, 8, 6, 0.16) 100%)', boxShadow: '0 12px 30px rgba(0, 0, 0, 0.24)'}} />
      {props.statistic && <Caption style={{position: 'relative', fontSize: 70, fontWeight: 800, lineHeight: 1.08, letterSpacing: 2, textShadow: '0 3px 10px rgba(0, 0, 0, 0.86)'}}>{props.statistic}</Caption>}
      <div style={{height: 3, width: '68%', backgroundColor: palette.amber, marginTop: 34}} />
      {props.footer && <Caption style={{position: 'relative', fontSize: 18, letterSpacing: 2, color: palette.muted, marginTop: 24, textShadow: '0 2px 8px rgba(0, 0, 0, 0.86)'}}>{props.footer}</Caption>}
    </div>
  </AbsoluteFill>;
};
