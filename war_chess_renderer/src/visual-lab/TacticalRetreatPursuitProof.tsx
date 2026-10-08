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

export const TACTICAL_RETREAT_PURSUIT_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const PursuingFormation: React.FC<{establish: number; pursuit: number}> = ({
  establish,
  pursuit,
}) => {
  const positions = [
    [45, 0, 70],
    [150, 8, 70],
    [255, 0, 70],
    [0, 94, 78],
    [108, 104, 78],
    [216, 94, 78],
    [324, 104, 78],
    [55, 207, 86],
    [175, 215, 86],
    [295, 207, 86],
  ] as const;

  return (
    <div
      style={{
        position: 'absolute',
        left: 250,
        top: 500,
        width: 440,
        height: 380,
        opacity: establish,
        translate: `${interpolate(pursuit, [0, 1], [0, 145])}px 0px`,
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`pursuing-${index}`}
          markerId={`pursuing-${index}`}
          x={x}
          y={y}
          size={size}
          color="#8f4e40"
          opacity={1 - index * 0.026}
        />
      ))}
    </div>
  );
};

const RetreatingFormation: React.FC<{establish: number; retreat: number}> = ({
  establish,
  retreat,
}) => {
  const positions = [
    [50, 0, 70, 0, -18],
    [155, 8, 70, 25, -58],
    [260, 0, 70, 58, -16],
    [0, 94, 78, -12, 30],
    [108, 104, 78, 34, 10],
    [216, 94, 78, 72, 42],
    [324, 104, 78, 105, 8],
    [55, 207, 86, 0, 74],
    [175, 215, 86, 52, 95],
    [295, 207, 86, 116, 68],
  ] as const;

  return (
    <div
      style={{
        position: 'absolute',
        left: 1190,
        top: 500,
        width: 520,
        height: 430,
        opacity: establish,
        translate: `${interpolate(retreat, [0, 1], [0, 135])}px ${interpolate(
          retreat,
          [0, 1],
          [0, -38],
        )}px`,
      }}
    >
      {positions.map(([x, y, size, driftX, driftY], index) => (
        <div
          key={`retreating-${index}`}
          style={{
            position: 'absolute',
            inset: 0,
            translate: `${interpolate(retreat, [0, 1], [0, driftX])}px ${interpolate(
              retreat,
              [0, 1],
              [0, driftY],
            )}px`,
            rotate: `${interpolate(retreat, [0, 1], [0, (index % 2 === 0 ? 1 : -1) * 7])}deg`,
          }}
        >
          <TacticalPawn
            markerId={`retreating-${index}`}
            x={x}
            y={y}
            size={size}
            color="#426d79"
            opacity={1 - index * 0.026}
          />
        </div>
      ))}
    </div>
  );
};

const PursuitKnight: React.FC<{progress: number}> = ({progress}) => (
  <div
    style={{
      position: 'absolute',
      left: interpolate(progress, [0, 1], [720, 1110]),
      top: interpolate(progress, [0, 1], [830, 635]),
      width: 215,
      height: 285,
      opacity: progress,
      scale: interpolate(progress, [0, 1], [0.82, 1]),
      filter: 'drop-shadow(0 20px 16px rgba(0,0,0,.68))',
      zIndex: 2,
    }}
  >
    <div
      style={{
        color: '#b94337',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 230,
        lineHeight: 1,
        textAlign: 'center',
        textShadow: '0 3px 0 #e07163',
      }}
    >
      ♞
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

export const TacticalRetreatPursuitProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 36], [0, 1], editorialEase);
  const retreat = interpolate(frame, [45, 104], [0, 1], editorialEase);
  const pursuit = interpolate(frame, [59, 112], [0, 1], editorialEase);
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

        <PursuingFormation establish={establish} pursuit={pursuit} />
        <RetreatingFormation establish={establish} retreat={retreat} />
        <PursuitKnight progress={pursuit} />
        <ForceLabel
          side="left"
          role="ADVANCING FORCE"
          label="PURSUIT"
          strength="27,000"
          color="#d27660"
          progress={establish}
        />
        <ForceLabel
          side="right"
          role="BROKEN POSITION"
          label="WITHDRAWAL"
          strength="19,000"
          color="#79aab7"
          progress={establish}
        />
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
        TACTICAL RELATIONSHIP · RETREAT
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
        The line gives ground.
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
        Withdrawal becomes pursuit.
      </div>
    </AbsoluteFill>
  );
};
