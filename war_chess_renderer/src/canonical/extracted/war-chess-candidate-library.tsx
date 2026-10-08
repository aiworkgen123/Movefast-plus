import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Caption: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{fontFamily: 'Arial, Helvetica, sans-serif', ...style}}>{children}</div>
);

/**
 * Qualitative force comparison proof. Bar lengths are deliberately unlabeled:
 * they establish relative scale without inventing troop counts.
 */
export type ForceComparisonSide = {name: string; facts: string[]; count?: number};
export type ForceComparisonProps = {sides: [ForceComparisonSide, ForceComparisonSide]; title: string; attackingFirstLabel: string};

const CannaeForceComparisonScene: React.FC<{attackingFirstPlacement: 'center' | 'rome'; props: ForceComparisonProps}> = ({attackingFirstPlacement, props}) => {
  const frame = useCurrentFrame();
  const establish = interpolate(frame, [0, 15], [0, 1], {...clamp, easing: ease});
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], clamp);
  const firstReveal = interpolate(frame, [10, 48], [0, 1], {...clamp, easing: ease});
  const firstPresence = interpolate(frame, [10, 26], [0, 1], {...clamp, easing: ease});
  const secondReveal = interpolate(frame, [38, 94], [0, 1], {...clamp, easing: ease});
  const secondPresence = interpolate(frame, [38, 56], [0, 1], {...clamp, easing: ease});
  const closeOpacity = interpolate(frame, [88, 126], [0, 1], clamp);
  const romeWidth = interpolate(firstReveal, [0, 1], [90, 760]);
  const carthageWidth = interpolate(secondReveal, [0, 1], [70, 470]);
  const firstShift = interpolate(firstPresence, [0, 1], [18, 0]);
  const secondShift = interpolate(secondPresence, [0, 1], [18, 0]);
  const firstStyle = {opacity: firstPresence, transform: `translateY(${firstShift}px)`};
  const secondStyle = {opacity: secondPresence, transform: `translateY(${secondShift}px)`};

  return (
    <AbsoluteFill style={{backgroundColor: '#191613', color: '#f1e7d2', padding: '74px 96px 76px', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, rgba(154, 110, 60, 0.18), transparent 55%)'}} />
      <div style={{position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column'}}>
        <Caption style={{fontSize: 74, letterSpacing: 2.5, fontWeight: 800, opacity: titleOpacity, textAlign: 'center'}}>{props.title}</Caption>
        <div style={{height: 2, backgroundColor: '#b88a52', width: `${establish * 100}%`, margin: '34px auto 52px', opacity: 0.75}} />
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 76, flex: 1, alignItems: 'center'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
            <div style={firstStyle}><Caption style={{fontSize: 42, letterSpacing: 5, color: '#d7b275', fontWeight: 700}}>{props.sides[0].name}</Caption></div>
            <div style={firstStyle}><Caption style={{fontSize: 32, letterSpacing: 1.4, color: '#f1e7d2'}}>{props.sides[0].facts[0]}</Caption></div>
            <div style={{height: 160, display: 'flex', alignItems: 'center'}}>
              <div style={{height: 104, width: romeWidth, maxWidth: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #9d342c, #c8673e)', boxShadow: '0 12px 34px rgba(157,52,44,0.28)'}} />
            </div>
            {props.sides[0].facts[1] && <div style={firstStyle}><Caption style={{fontSize: 31, letterSpacing: 1.2, color: '#d8c6ab'}}>{props.sides[0].facts[1]}</Caption></div>}
            <div style={{display: 'flex', gap: 10, height: 58, alignItems: 'end', opacity: firstReveal}}>
              {[0, 1, 2, 3, 4, 5].map((index) => <div key={index} style={{height: `${38 + index * 4}px`, width: 46, borderRadius: 3, backgroundColor: '#a84636'}} />)}
            </div>
            {attackingFirstPlacement === 'rome' && <Caption style={{fontSize: 30, letterSpacing: 2.1, color: '#d7b275', opacity: closeOpacity, marginTop: 26, alignSelf: 'flex-start'}}>{props.attackingFirstLabel}</Caption>}
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
            <div style={secondStyle}><Caption style={{fontSize: 42, letterSpacing: 5, color: '#d7b275', fontWeight: 700}}>{props.sides[1].name}</Caption></div>
            <div style={secondStyle}><Caption style={{fontSize: 32, letterSpacing: 1.4, color: '#f1e7d2'}}>{props.sides[1].facts[0]}</Caption></div>
            <div style={{height: 160, display: 'flex', alignItems: 'center', justifyContent: 'flex-end'}}>
              <div style={{height: 104, width: carthageWidth, maxWidth: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #59646a, #85939a)', boxShadow: '0 12px 34px rgba(91,111,119,0.24)'}} />
            </div>
            {props.sides[1].facts[1] && <div style={{...secondStyle, opacity: secondReveal}}><Caption style={{fontSize: 31, letterSpacing: 1.2, color: '#d8c6ab'}}>{props.sides[1].facts[1]}</Caption></div>}
            <div style={{height: 58, display: 'flex', gap: 10, alignItems: 'end', justifyContent: 'flex-end', opacity: secondReveal}}>
              {[0, 1, 2].map((index) => <div key={index} style={{height: `${38 + index * 5}px`, width: 46, borderRadius: 3, backgroundColor: '#6e7d82'}} />)}
            </div>
          </div>
        </div>
        {attackingFirstPlacement === 'center' && <Caption style={{fontSize: 38, letterSpacing: 2.4, textAlign: 'center', color: '#d7b275', opacity: closeOpacity, marginTop: 28}}>{props.attackingFirstLabel}</Caption>}
      </div>
    </AbsoluteFill>
  );
};

export const CannaeForceComparisonProof: React.FC<ForceComparisonProps> = (props) => <CannaeForceComparisonScene attackingFirstPlacement="center" props={props} />;
export const CannaeForceComparisonProofV2: React.FC<ForceComparisonProps> = (props) => <CannaeForceComparisonScene attackingFirstPlacement="rome" props={props} />;

export type SurfaceTreatmentProps = {
  imageSrc: string;
  grainOpacity: number;
  vignetteOpacity: number;
  dustOpacity: number;
  showComparison: boolean;
  title?: string;
  status?: string;
  cleanLabel?: string;
  treatedLabel?: string;
};

const Grain: React.FC<{opacity: number}> = ({opacity}) => {
  const {width, height} = useVideoConfig();
  const cells = useMemo(() => {
    const cellSize = 16;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    return Array.from({length: cols * rows}, (_, index) => ({
      key: index,
      x: (index % cols) * cellSize,
      y: Math.floor(index / cols) * cellSize,
      opacity: 0.24 + ((index * 37) % 17) / 100,
    }));
  }, [width, height]);
  return <svg aria-hidden="true" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none'}} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{cells.map((cell) => <rect key={cell.key} x={cell.x} y={cell.y} width={16} height={16} fill="#f2e7d5" opacity={cell.opacity} />)}</svg>;
};

const SurfaceTreatment: React.FC<{grainOpacity: number; vignetteOpacity: number; dustOpacity: number}> = ({grainOpacity, vignetteOpacity, dustOpacity}) => (
  <>
    <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(125deg, rgba(220, 185, 128, 0.1), transparent 42%, rgba(31, 20, 12, 0.14))', mixBlendMode: 'soft-light'}} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 56%, rgba(20, 12, 8, 0.58) 100%)', opacity: vignetteOpacity}} />
    <Grain opacity={grainOpacity} />
    <div aria-hidden="true" style={{position: 'absolute', inset: 0, opacity: dustOpacity, background: 'radial-gradient(circle at 18% 28%, rgba(241,214,165,0.42) 0 2px, transparent 3px), radial-gradient(circle at 73% 66%, rgba(241,214,165,0.28) 0 1px, transparent 2px), radial-gradient(circle at 84% 22%, rgba(241,214,165,0.24) 0 1px, transparent 2px)'}} />
  </>
);

export const CannaeSurfaceTreatmentProof: React.FC<SurfaceTreatmentProps> = ({imageSrc, grainOpacity, vignetteOpacity, dustOpacity, showComparison, title, status, cleanLabel, treatedLabel}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.8 * fps], [0, 1], clamp);
  const panelStyle: React.CSSProperties = {position: 'relative', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: '#18120e'};
  return (
    <AbsoluteFill style={{backgroundColor: '#18120e', color: '#f1e7d2', padding: '56px 72px', opacity}}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 22}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'end'}}>
          {title && <Caption style={{fontSize: 34, letterSpacing: 3.5, color: '#d7b275'}}>{title}</Caption>}
          {status && <Caption style={{fontSize: 22, letterSpacing: 2, color: '#b9a58b'}}>{status}</Caption>}
        </div>
        <div style={{display: 'flex', gap: 18, flex: 1, minHeight: 0}}>
          <div style={showComparison ? panelStyle : {...panelStyle, flex: 1}}>
            <Img src={imageSrc} style={{width: '100%', height: '100%', objectFit: 'contain', display: 'block'}} />
            {!showComparison && <SurfaceTreatment grainOpacity={grainOpacity} vignetteOpacity={vignetteOpacity} dustOpacity={dustOpacity} />}
            {showComparison && cleanLabel && <Caption style={{position: 'absolute', left: 28, bottom: 24, fontSize: 24, letterSpacing: 3.5, color: '#f1e7d2', textShadow: '0 2px 8px rgba(0,0,0,0.7)'}}>{cleanLabel}</Caption>}
            {!showComparison && treatedLabel && <Caption style={{position: 'absolute', left: 28, bottom: 24, fontSize: 24, letterSpacing: 3.5, color: '#f1e7d2', textShadow: '0 2px 8px rgba(0,0,0,0.7)'}}>{treatedLabel}</Caption>}
          </div>
          {showComparison && <div style={panelStyle}>
            <Img src={imageSrc} style={{width: '100%', height: '100%', objectFit: 'contain', display: 'block'}} />
            <SurfaceTreatment grainOpacity={grainOpacity} vignetteOpacity={vignetteOpacity} dustOpacity={dustOpacity} />
            {treatedLabel && <Caption style={{position: 'absolute', left: 28, bottom: 24, fontSize: 24, letterSpacing: 3.5, color: '#f1e7d2', textShadow: '0 2px 8px rgba(0,0,0,0.7)'}}>{treatedLabel}</Caption>}
          </div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CannaeSurfaceTreatmentProofV2: React.FC<SurfaceTreatmentProps> = (props) => <CannaeSurfaceTreatmentProof {...props} />;
