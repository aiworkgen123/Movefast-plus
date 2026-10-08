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
import {TacticalPawn} from './TacticalCommandTableProof';

export const TACTICAL_COUNTERATTACK_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const Formation: React.FC<{
  side: 'left' | 'right';
  color: string;
  establish: number;
  advance: number;
  reversal: number;
}> = ({side, color, establish, advance, reversal}) => {
  const positions = [
    [50, 0, 70],
    [155, 8, 70],
    [260, 0, 70],
    [0, 94, 78],
    [108, 104, 78],
    [216, 94, 78],
    [324, 104, 78],
    [55, 207, 86],
    [175, 215, 86],
    [295, 207, 86],
  ] as const;
  const movement =
    side === 'left'
      ? interpolate(advance, [0, 1], [0, 135]) - interpolate(reversal, [0, 1], [0, 105])
      : interpolate(reversal, [0, 1], [0, -70]);

  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? 240 : 1260,
        top: 500,
        width: 440,
        height: 380,
        opacity: establish,
        translate: `${movement}px 0px`,
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`${side}-${index}`}
          markerId={`counter-${side}-${index}`}
          x={x}
          y={y}
          size={size}
          color={color}
          opacity={1 - index * 0.026}
        />
      ))}
    </div>
  );
};

const ReserveQueen: React.FC<{progress: number}> = ({progress}) => (
  <div
    style={{
      position: 'absolute',
      left: interpolate(progress, [0, 1], [1475, 935]),
      top: interpolate(progress, [0, 1], [960, 615]),
      width: 245,
      height: 300,
      opacity: progress,
      scale: interpolate(progress, [0, 1], [0.78, 1]),
      filter: 'drop-shadow(0 20px 16px rgba(0,0,0,.68))',
      zIndex: 2,
    }}
  >
    <div
      style={{
        color: '#426d79',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 245,
        lineHeight: 1,
        textAlign: 'center',
        textShadow: '0 3px 0 #79aab7',
      }}
    >
      ♛
    </div>
  </div>
);

const ForceLabel: React.FC<{
  side: 'left' | 'right';
  role: string;
  label: string;
  strength: string;
  color: string;
  progress: number;
}> = ({side, role, label, strength, color, progress}) => (
  <div
    style={{
      position: 'absolute',
      top: 304,
      left: side === 'left' ? 142 : undefined,
      right: side === 'right' ? 142 : undefined,
      width: 650,
      opacity: progress,
      textAlign: side,
    }}
  >
    <div
      style={{
        color,
        fontFamily: WC_EDITORIAL_SANS,
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 4.5,
      }}
    >
      {role}
    </div>
    <div
      style={{
        marginTop: 8,
        color: '#eee3cf',
        fontFamily: WC_EDITORIAL_SERIF,
        fontSize: 56,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label} · {strength}
    </div>
  </div>
);

export const TacticalCounterattackProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 36], [0, 1], editorialEase);
  const advance = interpolate(frame, [33, 70], [0, 1], editorialEase);
  const reserve = interpolate(frame, [58, 104], [0, 1], editorialEase);
  const reversal = interpolate(frame, [78, 112], [0, 1], editorialEase);
  const conclusion = interpolate(frame, [108, 130], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 7, 141, 149], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#12120d',
        color: '#eee3cf',
        overflow: 'hidden',
        opacity: fade,
      }}
    >
      <Audio src={staticFile('visual-lab/force-comparison/attack-the-seam.wav')} />
      <div
        style={{
          position: 'absolute',
          inset: -40,
          background:
            'radial-gradient(ellipse at 50% 53%, rgba(92,84,48,.34), transparent 62%), linear-gradient(125deg, #26271c, #14160f 55%, #222319)',
        }}
      >
        <svg viewBox="0 0 2000 1160" style={{position: 'absolute', inset: 0}}>
          <g fill="none" stroke="#c0b78c" opacity=".1" strokeWidth="2">
            <path d="M-80 285 C240 120 405 405 705 230 S1140 350 1450 195 S1850 270 2110 115" />
            <path d="M-70 342 C230 180 410 470 720 285 S1160 415 1470 255 S1870 335 2120 175" />
            <path d="M-40 850 C280 670 480 940 810 725 S1290 885 1620 695 S1970 830 2160 680" />
          </g>
        </svg>

        <Formation
          side="left"
          color="#8f4e40"
          establish={establish}
          advance={advance}
          reversal={reversal}
        />
        <Formation
          side="right"
          color="#426d79"
          establish={establish}
          advance={0}
          reversal={reversal}
        />
        <ReserveQueen progress={reserve} />
        <ForceLabel
          side="left"
          role="ADVANCING FORCE"
          label="ATTACK"
          strength="29,000"
          color="#d27660"
          progress={establish}
        />
        <ForceLabel
          side="right"
          role="DEFENDING FORCE"
          label="POSITION"
          strength="21,000"
          color="#79aab7"
          progress={establish}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 906,
            textAlign: 'center',
            color: '#79aab7',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 4.5,
            opacity:
              interpolate(reserve, [0.3, 0.75], [0, 1], editorialEase) *
              (1 - conclusion),
          }}
        >
          FRESH RESERVE
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 58,
          color: '#b8aa90',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 4.8,
          opacity: intro * (1 - conclusion),
        }}
      >
        TACTICAL RELATIONSHIP · COUNTERATTACK
      </div>
      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 102,
          color: '#eee3cf',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: -1.7,
          opacity: intro * (1 - conclusion),
        }}
      >
        The reserve strikes back.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 130,
          right: 130,
          top: 866,
          color: '#eee3cf',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 48,
          fontStyle: 'italic',
          fontWeight: 500,
          textAlign: 'center',
          opacity: conclusion,
        }}
      >
        Momentum changes sides.
      </div>
    </AbsoluteFill>
  );
};
