import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const REAL_IMAGE_PHASE_PROGRESSION_DURATION = 557;

const C = {
  ink: '#090a08',
  paper: '#f1e9d9',
  muted: '#b7ad9b',
  amber: '#c89a4a',
  red: '#b44d3a',
  blue: '#78969a',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const phases = [
  {
    label: 'OPENING',
    title: 'First Command',
    detail: 'The position is established.',
    image: 'visual-lab/phase-progression-real/pexels-tima-6598739.jpg',
    credit: 'Tima Miroshnichenko · Pexels',
    accent: C.amber,
    start: 0,
    holdStart: 22,
    end: 196,
    objectPosition: '53% 53%',
    zoomFrom: 1.02,
    zoomTo: 1.11,
  },
  {
    label: 'MIDDLEGAME',
    title: 'Pure Calculation',
    detail: 'The prepared book runs out.',
    image: 'visual-lab/phase-progression-real/pexels-sudarson-36680436.jpg',
    credit: 'Sudarson Alwin · Pexels',
    accent: C.red,
    start: 170,
    holdStart: 198,
    end: 388,
    objectPosition: '54% 54%',
    zoomFrom: 1.03,
    zoomTo: 1.14,
  },
  {
    label: 'ENDGAME',
    title: 'Better Technique',
    detail: 'Fewer pieces. Less room for error.',
    image: 'visual-lab/phase-progression-real/pexels-cottonbro-8656670.jpg',
    credit: 'cottonbro studio · Pexels',
    accent: C.blue,
    start: 362,
    holdStart: 390,
    end: 520,
    objectPosition: '50% 68%',
    zoomFrom: 1.03,
    zoomTo: 1.12,
  },
] as const;

const PhotoPhase: React.FC<{
  phase: (typeof phases)[number];
  index: number;
}> = ({phase, index}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [phase.start, phase.holdStart], [0, 1], editorialEase);
  const leave = interpolate(frame, [phase.end - 28, phase.end], [1, 0], editorialEase);
  const opacity = enter * leave;
  const progress = interpolate(frame, [phase.start, phase.end], [0, 1], clamp);
  const copyEnter = interpolate(
    frame,
    [phase.holdStart + 5, phase.holdStart + 30],
    [0, 1],
    editorialEase,
  );

  return (
    <AbsoluteFill style={{opacity}}>
      <Img
        src={staticFile(phase.image)}
        style={{
          position: 'absolute',
          inset: -36,
          width: 1992,
          height: 1152,
          objectFit: 'cover',
          objectPosition: phase.objectPosition,
          scale: interpolate(progress, [0, 1], [phase.zoomFrom, phase.zoomTo]),
          translate:
            index === 0
              ? `${interpolate(progress, [0, 1], [-10, 18])}px ${interpolate(progress, [0, 1], [4, -10])}px`
              : index === 1
                ? `${interpolate(progress, [0, 1], [18, -16])}px 0px`
                : `0px ${interpolate(progress, [0, 1], [12, -16])}px`,
          filter: 'saturate(.66) contrast(1.12) brightness(.72)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(7,8,6,.94) 0%, rgba(7,8,6,.77) 29%, rgba(7,8,6,.20) 59%, rgba(7,8,6,.36) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(4,4,3,.42) 0%, transparent 29%, transparent 68%, rgba(4,4,3,.66) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 66% 47%, transparent 14%, rgba(5,5,4,.12) 55%, rgba(5,5,4,.42) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 116,
          width: 670,
          opacity: copyEnter,
          translate: `${interpolate(copyEnter, [0, 1], [-32, 0])}px 0px`,
        }}
      >
        <div
          style={{
            color: phase.accent,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: 5.2,
          }}
        >
          {phase.label}
        </div>
        <div
          style={{
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: -2.4,
            lineHeight: 0.88,
            marginTop: 24,
          }}
        >
          {phase.title}
        </div>
        <div
          style={{
            color: C.muted,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: 0.4,
            marginTop: 34,
            maxWidth: 540,
          }}
        >
          {phase.detail}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 76,
          bottom: 62,
          color: 'rgba(241,233,217,.58)',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 1.1,
        }}
      >
        {phase.credit}
      </div>
    </AbsoluteFill>
  );
};

const PhaseIndex: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        bottom: 62,
        display: 'flex',
        alignItems: 'center',
        gap: 34,
      }}
    >
      {phases.map((phase) => {
        const active = interpolate(
          frame,
          [phase.start, phase.holdStart, phase.end - 24, phase.end],
          [0.28, 1, 1, 0.28],
          clamp,
        );
        return (
          <div key={phase.label} style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 99,
                backgroundColor: phase.accent,
                opacity: active,
                scale: interpolate(active, [0.28, 1], [0.72, 1]),
              }}
            />
            <div
              style={{
                color: C.paper,
                fontFamily: WC_EDITORIAL_SANS,
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: 2.3,
                opacity: active,
              }}
            >
              {phase.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RealImagePhaseProgressionProof: React.FC = () => {
  const frame = useCurrentFrame();
  const close = interpolate(frame, [498, 532], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 10, 546, 556], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity: fade, overflow: 'hidden'}}>
      <Audio
        src={staticFile(
          'visual-lab/historical-documents/three-boards-opening-middle-end.wav',
        )}
      />
      {phases.map((phase, index) => (
        <PhotoPhase key={phase.label} phase={phase} index={index} />
      ))}
      <PhaseIndex />

      <AbsoluteFill style={{backgroundColor: C.ink, opacity: close}}>
        <div
          style={{
            position: 'absolute',
            left: 230,
            right: 230,
            top: 350,
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 112,
            fontWeight: 700,
            letterSpacing: -2.8,
            lineHeight: 0.94,
            textAlign: 'center',
            opacity: close,
            translate: `0px ${interpolate(close, [0, 1], [28, 0])}px`,
          }}
        >
          Same player. Sharper choices.
        </div>
        <div
          style={{
            position: 'absolute',
            left: 420,
            right: 420,
            top: 506,
            color: C.muted,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: 3,
            textAlign: 'center',
          }}
        >
          OPENING · MIDDLEGAME · ENDGAME
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
