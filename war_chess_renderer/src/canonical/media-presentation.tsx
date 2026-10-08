import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {MediaPresentationPropsSchema, type MediaPresentationProps} from './production-contracts';

const WIDTH = 1920;
const HEIGHT = 1080;
const BASIC_FRAME_COLOR = '#F4F2EB';
const BASIC_FRAME_SIZE = 7;
const ANIMATED_FRAME_COLOR = '#FFEA00';
const ANIMATED_FRAME_SIZE = 10.5;
const MAX_FRAME_WIDTH = 1400;
const MAX_FRAME_HEIGHT = 788;

const seeded = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.17 + salt * 37.31) * 43758.5453;
  return value - Math.floor(value);
};

const grain = Array.from({length: 96}, (_, index) => ({
  x: seeded(index, 41),
  y: seeded(index, 42),
  size: 0.7 + seeded(index, 43) * 2.4,
  opacity: 0.035 + seeded(index, 44) * 0.12,
}));

const dust = Array.from({length: 126}, (_, index) => ({
  x: seeded(index, 11) * WIDTH,
  y: seeded(index, 12) * HEIGHT,
  size: 0.8 + seeded(index, 13) * 2,
  opacity: 0.05 + seeded(index, 14) * 0.16,
}));

const flakes = Array.from({length: 82}, (_, index) => ({
  x: seeded(index, 1) * WIDTH,
  startY: seeded(index, 2) * 1380 - 1380,
  speed: 1.4 + seeded(index, 3) * 3.3,
  size: 1.5 + seeded(index, 4) * 4.2,
  opacity: 0.1 + seeded(index, 5) * 0.42,
  drift: 7 + seeded(index, 6) * 25,
  phase: seeded(index, 7) * Math.PI * 2,
  blur: seeded(index, 8) * 1.4,
}));

const smokeClouds = Array.from({length: 7}, (_, index) => ({
  x: -100 + seeded(index, 21) * 1800,
  y: 80 + seeded(index, 22) * 800,
  width: 360 + seeded(index, 23) * 480,
  height: 160 + seeded(index, 24) * 250,
  opacity: 0.11 + seeded(index, 25) * 0.12,
  speed: 0.18 + seeded(index, 26) * 0.32,
  phase: seeded(index, 27) * Math.PI * 2,
}));

const ash = Array.from({length: 62}, (_, index) => ({
  x: seeded(index, 31) * WIDTH,
  startY: seeded(index, 32) * 1260 - 1260,
  speed: 0.7 + seeded(index, 33) * 1.9,
  size: 1.2 + seeded(index, 34) * 4,
  opacity: 0.18 + seeded(index, 35) * 0.32,
  drift: 12 + seeded(index, 36) * 36,
  phase: seeded(index, 37) * Math.PI * 2,
}));

const SurfaceEffect: React.FC<{
  readonly effect: MediaPresentationProps['surfaceEffect'];
  readonly intensity: number;
}> = ({effect, intensity}) => {
  const frame = useCurrentFrame();

  if (effect === 'vignette') {
    return (
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 48%, transparent 43%, rgba(10,7,4,.26) 70%, rgba(0,0,0,.884) 113%)',
          opacity: intensity,
        }}
      />
    );
  }

  if (effect === 'engraving_halftone') {
    return (
      <>
        <AbsoluteFill
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(25,18,10,.52) 1.1px, transparent 1.7px)',
            backgroundSize: '5px 5px',
            mixBlendMode: 'multiply',
            opacity: 0.72 * intensity,
          }}
        />
        <AbsoluteFill
          style={{
            backgroundColor: 'rgba(235,213,166,.1)',
            mixBlendMode: 'color',
            opacity: intensity,
          }}
        />
      </>
    );
  }

  return (
    <>
      {grain.map((particle, index) => (
        <div
          key={`grain-${index}`}
          style={{
            position: 'absolute',
            left: `${particle.x * 100}%`,
            top: `${particle.y * 100}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: 999,
            backgroundColor: index % 3 === 0 ? '#14110d' : '#fffdf3',
            opacity:
              particle.opacity *
              intensity *
              (0.55 + 0.45 * Math.abs(Math.sin(frame * 0.17 + index))),
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-radial-gradient(circle at 28% 34%, rgba(255,255,255,.12) 0 1px, rgba(0,0,0,.12) 1px 2px, transparent 2px 4px)',
          backgroundSize: '9px 9px',
          backgroundPosition: `${(Math.floor(frame / 2) * 7) % 18}px ${(Math.floor(frame / 2) * 11) % 18}px`,
          mixBlendMode: 'soft-light',
          opacity: 0.42 * intensity,
        }}
      />
    </>
  );
};

const FilmDust: React.FC<{readonly intensity: number}> = ({intensity}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {dust.map((particle, index) => (
        <div
          key={`dust-${index}`}
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            width: particle.size * 1.25,
            height: particle.size * 1.25,
            borderRadius: 999,
            backgroundColor: '#fff',
            opacity:
              Math.min(0.62, particle.opacity * 2.15 * intensity) *
              (0.35 + 0.65 * Math.abs(Math.sin(frame * 0.17 + index))),
          }}
        />
      ))}
      {[0, 1, 2].map((index) => (
        <div
          key={`scratch-${index}`}
          style={{
            position: 'absolute',
            left:
              310 +
              index * 590 +
              Math.sin(frame * 0.013 + index * 2.1) * 24,
            top: 70 + index * 45,
            width: index === 1 ? 2 : 1,
            height: 650 + index * 90,
            background:
              'linear-gradient(180deg, transparent, rgba(255,255,255,.52) 18%, rgba(255,255,255,.26) 72%, transparent)',
            opacity:
              (0.11 +
                0.12 * Math.abs(Math.sin(frame * 0.09 + index * 1.7))) *
              intensity,
          }}
        />
      ))}
    </>
  );
};

const Snowfall: React.FC<{readonly intensity: number}> = ({intensity}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {flakes.map((flake, index) => {
        const loopHeight = 1380;
        const y =
          ((flake.startY + frame * flake.speed + loopHeight * 4) %
            loopHeight) -
          100;
        const x =
          flake.x +
          Math.sin(frame * 0.022 + flake.phase) * flake.drift +
          frame * 0.045;
        return (
          <div
            key={`flake-${index}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: flake.size,
              height: flake.size * 1.45,
              borderRadius: 999,
              backgroundColor: '#fff',
              opacity: flake.opacity * intensity,
              filter: `blur(${flake.blur}px)`,
              rotate: `${-12 + Math.sin(frame * 0.026 + index) * 7}deg`,
            }}
          />
        );
      })}
    </>
  );
};

const SmokeAsh: React.FC<{readonly intensity: number}> = ({intensity}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {smokeClouds.map((cloud, index) => (
        <div
          key={`smoke-${index}`}
          style={{
            position: 'absolute',
            left:
              cloud.x +
              frame * cloud.speed +
              Math.sin(frame * 0.012 + cloud.phase) * 24,
            top: cloud.y + Math.sin(frame * 0.009 + cloud.phase) * 14,
            width: cloud.width,
            height: cloud.height,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(230,225,210,.72), rgba(145,140,128,.2) 48%, transparent 72%)',
            opacity: cloud.opacity * 1.2 * intensity,
            filter: 'blur(28px)',
          }}
        />
      ))}
      {ash.map((particle, index) => {
        const loopHeight = 1260;
        const y =
          ((particle.startY + frame * particle.speed + loopHeight * 4) %
            loopHeight) -
          80;
        const x =
          particle.x +
          Math.sin(frame * 0.018 + particle.phase) * particle.drift;
        return (
          <div
            key={`ash-${index}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: particle.size,
              height: particle.size * 0.65,
              borderRadius: 999,
              backgroundColor: '#d7d1c2',
              opacity: particle.opacity * 1.2 * intensity,
              rotate: `${frame * 0.55 + index * 13}deg`,
            }}
          />
        );
      })}
    </>
  );
};

const PresentationEffect: React.FC<{
  readonly effect: MediaPresentationProps['presentationEffect'];
  readonly intensity: number;
}> = ({effect, intensity}) => {
  if (effect === 'film_dust') {
    return <FilmDust intensity={intensity} />;
  }
  if (effect === 'snowfall') {
    return <Snowfall intensity={intensity} />;
  }
  if (effect === 'smoke_ash') {
    return <SmokeAsh intensity={intensity} />;
  }
  return null;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EmphasizedCopy: React.FC<{
  readonly text: string;
  readonly terms: readonly string[];
}> = ({text, terms}) => {
  const active = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  if (active.length === 0) {
    return <>{text}</>;
  }
  const expression = new RegExp(
    `(${active.map(escapeRegExp).join('|')})`,
    'gi',
  );
  const emphasis = new Set(active.map((term) => term.toLocaleLowerCase()));
  return (
    <>
      {text.split(expression).map((part, index) => (
        <span
          key={`${part}-${index}`}
          style={{
            color: emphasis.has(part.toLocaleLowerCase())
              ? '#d7b275'
              : 'inherit',
          }}
        >
          {part}
        </span>
      ))}
    </>
  );
};

const EditorialTextOverlay: React.FC<{
  readonly overlay: NonNullable<MediaPresentationProps['textOverlay']>;
  readonly durationFrames: number;
}> = ({overlay, durationFrames}) => {
  const frame = useCurrentFrame();
  const enterStart = Math.min(
    overlay.animation.enterStartFrame,
    Math.max(0, durationFrames - 2),
  );
  const enterEnd = Math.min(
    Math.max(enterStart + 1, durationFrames - 1),
    enterStart + overlay.animation.enterDurationFrames,
  );
  const exitStart = Math.max(
    enterEnd,
    durationFrames - overlay.animation.exitDurationFrames,
  );
  const enter = interpolate(frame, [enterStart, enterEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exit =
    durationFrames > 1
      ? interpolate(frame, [exitStart, durationFrames - 1], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.cubic),
        })
      : 1;
  const placement = overlay.placement;
  const alignment =
    placement.align === 'center'
      ? 'center'
      : placement.align === 'right'
        ? 'flex-end'
        : 'flex-start';
  const gradientDirection =
    placement.align === 'right' ? 'to left' : 'to right';

  return (
    <div
      style={{
        position: 'absolute',
        left: placement.x * WIDTH,
        top: placement.y * HEIGHT,
        width: placement.width * WIDTH,
        height: placement.height * HEIGHT,
        boxSizing: 'border-box',
        padding: '16px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: alignment,
        textAlign: placement.align,
        opacity: enter * exit,
        translate: `0 ${interpolate(enter, [0, 1], [18, 0])}px`,
        color: '#f4f2eb',
        background:
          placement.safeAreaSource === 'reviewed_safe_zone'
            ? `linear-gradient(${gradientDirection}, rgba(2,2,2,.68), rgba(2,2,2,.18) 78%, transparent)`
            : undefined,
        zIndex: 40,
      }}
    >
      <div
        style={{
          width: 46,
          height: 4,
          marginBottom: 16,
          backgroundColor: '#d7b275',
          alignSelf: alignment,
        }}
      />
      <div
        style={{
          maxWidth: '100%',
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: placement.headlineFontSize,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          textWrap: 'balance',
          textShadow: '0 3px 14px rgba(0,0,0,.9)',
        }}
      >
        <EmphasizedCopy
          text={overlay.headline}
          terms={overlay.emphasisTerms}
        />
      </div>
      {overlay.supportingText ? (
        <div
          style={{
            maxWidth: '100%',
            marginTop: 18,
            fontFamily: 'Arial, sans-serif',
            fontSize: placement.supportFontSize,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: 0.5,
            color: 'rgba(244,242,235,.9)',
            textShadow: '0 2px 10px rgba(0,0,0,.9)',
          }}
        >
          <EmphasizedCopy
            text={overlay.supportingText}
            terms={overlay.emphasisTerms}
          />
        </div>
      ) : null}
    </div>
  );
};

export const WarChessMediaPresentation: React.FC<MediaPresentationProps> = (
  input,
) => {
  const props = MediaPresentationPropsSchema.parse(input);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const animatedFrame = props.frameTreatment.style === 'animated_signal_yellow';
  const frameColor = animatedFrame ? ANIMATED_FRAME_COLOR : BASIC_FRAME_COLOR;
  const frameSize = animatedFrame ? ANIMATED_FRAME_SIZE : BASIC_FRAME_SIZE;
  const sourceRatio = props.sourceWidth / props.sourceHeight;
  const fittedWidth = Math.min(
    MAX_FRAME_WIDTH,
    MAX_FRAME_HEIGHT * sourceRatio,
  );
  const fittedHeight = fittedWidth / sourceRatio;
  const isExpanding =
    props.mediaKind === 'clip' &&
    props.presentationMode === 'expand_fullscreen';
  const expansion = isExpanding
    ? interpolate(frame, [9, 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.45, 0, 0.55, 1),
      })
    : 0;
  const initialWidth = isExpanding ? WIDTH * 0.35 : fittedWidth;
  const initialHeight = isExpanding ? initialWidth / sourceRatio : fittedHeight;
  const mediaWidth = interpolate(expansion, [0, 1], [initialWidth, WIDTH]);
  const mediaHeight = interpolate(expansion, [0, 1], [initialHeight, HEIGHT]);
  const mediaLeft = (WIDTH - mediaWidth) / 2;
  const mediaTop = (HEIGHT - mediaHeight) / 2;
  const frameOpacity = isExpanding
    ? interpolate(frame, [20, 29], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
      })
    : 1;
  const stillScale =
    props.mediaKind === 'still'
      ? interpolate(frame, [0, Math.max(1, props.durationFrames - 1)], [1.01, 1.07], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.45, 0, 0.55, 1),
        })
      : 1;
  const frameDrawEndFrame = Math.max(1, props.durationFrames - fps);
  const frameDrawProgress = animatedFrame
    ? interpolate(frame, [0, frameDrawEndFrame], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.linear,
      })
    : 1;
  const framePerimeter = 2 * (mediaWidth + mediaHeight);
  const source = staticFile(props.media.path);

  return (
    <AbsoluteFill style={{backgroundColor: '#020202', overflow: 'hidden'}}>
      {props.presentationEffect === 'white_grid' ? (
        <>
          <AbsoluteFill
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)',
              backgroundSize:
                '64px 64px, 64px 64px, 256px 256px, 256px 256px',
              opacity: props.presentationIntensity,
            }}
          />
          <AbsoluteFill
            style={{
              background:
                'radial-gradient(circle at 50% 50%, transparent 28%, rgba(0,0,0,.72) 100%)',
            }}
          />
        </>
      ) : null}

      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: mediaLeft - frameSize / 2,
          top: mediaTop - frameSize / 2,
          width: mediaWidth + frameSize,
          height: mediaHeight + frameSize,
          overflow: 'visible',
          filter: 'drop-shadow(0 26px 38px rgba(0,0,0,.82))',
          opacity: frameOpacity,
        }}
        viewBox={`0 0 ${mediaWidth + frameSize} ${mediaHeight + frameSize}`}
      >
        <rect
          x={frameSize / 2}
          y={frameSize / 2}
          width={mediaWidth}
          height={mediaHeight}
          fill="none"
          stroke={frameColor}
          strokeWidth={frameSize}
          strokeDasharray={framePerimeter}
          strokeDashoffset={framePerimeter * (1 - frameDrawProgress)}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: mediaLeft,
          top: mediaTop,
          width: mediaWidth,
          height: mediaHeight,
          overflow: 'hidden',
          backgroundColor: '#050505',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            scale: stillScale,
          }}
        >
          {props.mediaKind === 'clip' ? (
            <OffthreadVideo
              src={source}
              muted
              startFrom={props.startFromFrames}
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          ) : (
            <Img
              src={source}
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          )}
        </div>
        <SurfaceEffect
          effect={props.surfaceEffect}
          intensity={props.surfaceIntensity}
        />
      </div>
      <PresentationEffect
        effect={props.presentationEffect}
        intensity={props.presentationIntensity}
      />
      {props.textOverlay ? (
        <EditorialTextOverlay
          overlay={props.textOverlay}
          durationFrames={props.durationFrames}
        />
      ) : null}
    </AbsoluteFill>
  );
};
