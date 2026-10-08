import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const GRAPHICS_ONLY_PHASE_PROGRESSION_DURATION = 557;

const C = {
  ink: '#0b0c09',
  field: '#1a1c14',
  paper: '#f0e8d8',
  muted: '#aaa18e',
  quiet: '#756f61',
  amber: '#c79b50',
  red: '#b94b39',
  blue: '#789194',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const smooth = {
  ...clamp,
  easing: Easing.bezier(0.45, 0, 0.55, 1),
};

const phases = [
  {
    label: 'OPENING',
    title: 'First Command',
    detail: 'The position is established.',
    glyph: '♟',
    accent: C.amber,
    start: 28,
    end: 205,
    board: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    label: 'MIDDLEGAME',
    title: 'Pure Calculation',
    detail: 'The prepared book runs out.',
    glyph: '♞',
    accent: C.red,
    start: 178,
    end: 376,
    board: [
      [0, 0, 0, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    label: 'ENDGAME',
    title: 'Better Technique',
    detail: 'Fewer pieces. Less room for error.',
    glyph: '♚',
    accent: C.blue,
    start: 350,
    end: 512,
    board: [
      [0, 0, 0, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
      [1, 0, 0, 0],
    ],
  },
] as const;

const Terrain: React.FC = () => (
  <svg
    viewBox="0 0 1920 1080"
    style={{position: 'absolute', inset: 0, width: 1920, height: 1080}}
  >
    <defs>
      <radialGradient id="phase-field" cx="47%" cy="48%" r="82%">
        <stop offset="0" stopColor="#323324" />
        <stop offset=".58" stopColor={C.field} />
        <stop offset="1" stopColor={C.ink} />
      </radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#phase-field)" />
    <g fill="none" stroke="#d8caa3" strokeWidth="2" opacity=".075">
      <path d="M-90 215 C145 60 332 275 546 128 S912 240 1145 90 S1650 170 2010 15" />
      <path d="M-70 286 C170 128 360 340 575 198 S945 310 1180 162 S1680 242 2020 88" />
      <path d="M-55 778 C170 642 360 842 590 704 S980 812 1220 655 S1700 720 2030 595" />
      <path d="M-20 850 C195 714 392 910 620 775 S1012 874 1255 726 S1730 792 2050 660" />
      <path d="M300 -50 C395 154 280 325 380 505 S326 845 430 1135" />
      <path d="M1530 -40 C1435 190 1540 350 1455 535 S1510 850 1410 1125" />
    </g>
  </svg>
);

const MiniBoard: React.FC<{phase: (typeof phases)[number]; index: number}> = ({phase, index}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [phase.start, phase.start + 24], [0, 1], editorialEase);
  const active = interpolate(
    frame,
    [phase.start - 20, phase.start + 16, phase.end - 18, phase.end + 18],
    [0.26, 1, 1, 0.42],
    smooth,
  );
  const resolve = interpolate(frame, [492, 530], [0, 1], editorialEase);
  const resolvedOpacity = interpolate(resolve, [0, 1], [1, 0.12]);
  const x = 218 + index * 526;
  const y = 286 + (index === 1 ? 28 : 0);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 420,
        height: 480,
        opacity: enter * active * resolvedOpacity,
        translate: `0px ${interpolate(enter, [0, 1], [38, 0])}px`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 340,
          height: 340,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          boxShadow: '0 28px 52px rgba(0,0,0,.38)',
          rotate: index === 0 ? '-2deg' : index === 2 ? '2deg' : '0deg',
          scale: interpolate(active, [0.26, 1], [0.94, 1]),
        }}
      >
        {phase.board.flatMap((rank, rankIndex) =>
          rank.map((occupied, fileIndex) => (
            <div
              key={`${rankIndex}-${fileIndex}`}
              style={{
                display: 'grid',
                placeItems: 'center',
                backgroundColor:
                  (rankIndex + fileIndex) % 2 === 0 ? '#cbbf9f' : '#6e694f',
                color: '#171611',
                fontFamily: WC_EDITORIAL_SERIF,
                fontSize: 48,
              }}
            >
              {occupied ? phase.glyph : ''}
            </div>
          )),
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 374,
          width: 380,
        }}
      >
        <div
          style={{
            color: phase.accent,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 4.4,
          }}
        >
          {phase.label}
        </div>
        <div
          style={{
            color: C.paper,
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 53,
            fontWeight: 700,
            letterSpacing: -1.1,
            lineHeight: 0.94,
            marginTop: 12,
          }}
        >
          {phase.title}
        </div>
        <div
          style={{
            color: C.muted,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 0.7,
            lineHeight: 1.2,
            marginTop: 14,
          }}
        >
          {phase.detail}
        </div>
      </div>
    </div>
  );
};

export const GraphicsOnlyPhaseProgressionProof: React.FC = () => {
  const frame = useCurrentFrame();
  const opening = interpolate(frame, [0, 24], [0, 1], editorialEase);
  const path = interpolate(frame, [48, 392], [0, 1], smooth);
  const close = interpolate(frame, [492, 530], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 10, 546, 556], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink, opacity: fade, overflow: 'hidden'}}>
      <Audio
        src={staticFile(
          'visual-lab/historical-documents/three-boards-opening-middle-end.wav',
        )}
      />
      <Terrain />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 44%, transparent 22%, rgba(4,4,3,.35) 76%, rgba(4,4,3,.68) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 64,
          color: C.amber,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: 5,
          opacity: opening,
        }}
      >
        CHESS PHASES · EXPLANATORY ANALOGY
      </div>
      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 112,
          color: C.paper,
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: -1.8,
          lineHeight: 0.94,
          opacity: opening * (1 - close),
        }}
      >
        One player. Three phases.
      </div>

      <svg
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, width: 1920, height: 1080}}
      >
        <path
          d="M 390 242 C 625 190, 740 330, 925 308 S 1250 190, 1440 252"
          fill="none"
          stroke={C.amber}
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - path}
          opacity={0.48 * (1 - close)}
        />
        {[390, 925, 1440].map((x, index) => (
          <circle
            key={x}
            cx={x}
            cy={index === 1 ? 308 : 252}
            r={11}
            fill={phases[index].accent}
            opacity={interpolate(
              frame,
              [phases[index].start, phases[index].start + 20],
              [0, 1],
              editorialEase,
            ) * (1 - close)}
          />
        ))}
      </svg>

      {phases.map((phase, index) => (
        <MiniBoard key={phase.label} phase={phase} index={index} />
      ))}

      <div
        style={{
          position: 'absolute',
          left: 220,
          right: 220,
          top: 356,
          color: C.paper,
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 104,
          fontWeight: 700,
          letterSpacing: -2.3,
          lineHeight: 0.96,
          textAlign: 'center',
          opacity: close,
          translate: `0px ${interpolate(close, [0, 1], [30, 0])}px`,
        }}
      >
        Same player. Sharper choices.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 420,
          right: 420,
          top: 502,
          color: C.muted,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 27,
          fontWeight: 600,
          letterSpacing: 2.2,
          lineHeight: 1.35,
          textAlign: 'center',
          opacity: close,
        }}
      >
        OPENING · MIDDLEGAME · ENDGAME
      </div>
    </AbsoluteFill>
  );
};
