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

export const THREE_PHASE_PROGRESSION_PROOF_DURATION = 557;

const palette = {
  stage: '#0d0b09',
  paper: '#f4eee2',
  muted: '#b9afa0',
  quiet: '#8c8071',
  connector: '#a89880',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const smooth = {
  ...clamp,
  easing: Easing.bezier(0.45, 0, 0.55, 1),
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const phases = [
  {
    phase: 'OPENING',
    title: 'First Command',
    detail: 'The position is established.',
    start: 52,
    y: 188,
  },
  {
    phase: 'MIDDLE GAME',
    title: 'Pure Calculation',
    detail: 'The book runs out.',
    start: 257,
    y: 438,
  },
  {
    phase: 'END GAME',
    title: 'Better Technique',
    detail: 'The same player finishes sharper.',
    start: 425,
    y: 688,
  },
] as const;

const PhaseText: React.FC<{
  phase: (typeof phases)[number];
  index: number;
}> = ({phase, index}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(
    frame,
    [phase.start, phase.start + 26],
    [0, 1],
    editorialEase,
  );
  const nextStart = phases[index + 1]?.start;
  const priorPhaseDepth = nextStart
    ? interpolate(frame, [nextStart - 10, nextStart + 16], [1, 0.44], smooth)
    : 1;
  const close = interpolate(frame, [488, 520], [1, 0], smooth);

  return (
    <div
      style={{
        position: 'absolute',
        left: 1080,
        top: phase.y,
        width: 720,
        opacity: reveal * priorPhaseDepth * close,
        translate: `${interpolate(reveal, [0, 1], [38, 0])}px 0px`,
      }}
    >
      <div
        style={{
          color: palette.connector,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 4.2,
        }}
      >
        {phase.phase}
      </div>
      <div
        style={{
          color: palette.paper,
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: -1.2,
          lineHeight: 0.98,
          marginTop: 13,
        }}
      >
        {phase.title}
      </div>
      <div
        style={{
          color: palette.muted,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: 0.7,
          marginTop: 14,
        }}
      >
        {phase.detail}
      </div>
    </div>
  );
};

/**
 * Owner-review WC02 proof. It restores the transferred MG03 subject-recession
 * envelope and functional subject-to-story connectors while using the approved
 * no-rule, Type-1 editorial treatment.
 */
export const ThreePhaseProgressionProof: React.FC = () => {
  const frame = useCurrentFrame();
  const opening = interpolate(frame, [0, 26], [0, 1], editorialEase);
  const recede = interpolate(frame, [40, 102], [0, 1], smooth);
  const restore = interpolate(frame, [480, 520], [0, 1], smooth);
  const depth = recede * (1 - restore);
  const fade = interpolate(frame, [0, 10, 546, 556], [0, 1, 1, 0], clamp);
  const close = interpolate(frame, [496, 522], [0, 1], editorialEase);
  const subjectLeft = interpolate(depth, [0, 1], [76, 185]);
  const subjectTop = interpolate(depth, [0, 1], [54, 260]);
  const subjectWidth = interpolate(depth, [0, 1], [820, 600]);
  const subjectHeight = interpolate(depth, [0, 1], [1010, 710]);
  const anchorX = interpolate(depth, [0, 1], [682, 602]);
  const anchorY = interpolate(depth, [0, 1], [508, 558]);
  const connectorsClose = interpolate(frame, [488, 520], [1, 0], smooth);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.stage,
        color: palette.paper,
        overflow: 'hidden',
        opacity: fade,
      }}
    >
      <Audio
        src={staticFile(
          'visual-lab/historical-documents/three-boards-opening-middle-end.wav',
        )}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 27% 47%, rgba(168,152,128,.12), transparent 40%), linear-gradient(90deg, #0d0b09 0%, #0d0b09 38%, #090807 76%, #070605 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 52,
          color: palette.connector,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 4.6,
          opacity: opening,
        }}
      >
        THREE BOARDS · ONE PLAYER
      </div>

      <div
        style={{
          position: 'absolute',
          left: subjectLeft,
          top: subjectTop,
          width: subjectWidth,
          height: subjectHeight,
          opacity: opening,
        }}
      >
        <Img
          src={staticFile(
            'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
          )}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: interpolate(depth, [0, 1], [1, 0.84]),
            filter: `blur(${depth * 1.7}px) brightness(${interpolate(depth, [0, 1], [1, 0.8])}) contrast(${interpolate(depth, [0, 1], [1, 0.96])})`,
          }}
        />
      </div>

      <svg
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {phases.map((phase, index) => {
          const reveal = interpolate(
            frame,
            [phase.start, phase.start + 30],
            [0, 1],
            editorialEase,
          );
          const endY = phase.y + 58;
          const path = `M ${anchorX} ${anchorY} C 790 ${anchorY + (index - 1) * 34}, 930 ${endY}, 1048 ${endY}`;
          return (
            <path
              key={phase.phase}
              d={path}
              fill="none"
              stroke={palette.connector}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="900"
              strokeDashoffset={interpolate(reveal, [0, 1], [900, 0])}
              opacity={reveal * connectorsClose * (index === 0 ? 0.86 : 0.64)}
            />
          );
        })}
      </svg>

      {phases.map((phase, index) => (
        <PhaseText key={phase.phase} phase={phase} index={index} />
      ))}

      <div
        style={{
          position: 'absolute',
          left: 72,
          bottom: 66,
          opacity: opening,
        }}
      >
        <div
          style={{
            color: palette.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 70,
            fontWeight: 700,
            letterSpacing: -1.8,
            lineHeight: 0.94,
          }}
        >
          Napoleon’s Method
        </div>
        <div
          style={{
            color: palette.quiet,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: 2.5,
            marginTop: 17,
          }}
        >
          JACQUES-LOUIS DAVID · 1812
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 78,
          bottom: 76,
          width: 740,
          color: palette.paper,
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 54,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1,
          opacity: close,
          textAlign: 'right',
        }}
      >
        Not more force. Better technique.
      </div>
    </AbsoluteFill>
  );
};
