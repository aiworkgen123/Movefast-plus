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

export const TACTICAL_FLANKING_DURATION = 150;

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
  progress: number;
}> = ({side, color, progress}) => {
  const positions = [
    [60, 0, 70],
    [165, 8, 70],
    [270, 0, 70],
    [5, 92, 78],
    [112, 104, 78],
    [219, 94, 78],
    [326, 104, 78],
    [60, 204, 86],
    [175, 214, 86],
    [290, 204, 86],
  ] as const;

  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? 260 : 1255,
        top: 490,
        width: 420,
        height: 380,
        opacity: progress,
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`${side}-${index}`}
          markerId={`flank-${side}-${index}`}
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

const Knight: React.FC<{progress: number}> = ({progress}) => (
  <div
    style={{
      position: 'absolute',
      left: interpolate(progress, [0, 1], [770, 1510]),
      top: interpolate(progress, [0, 0.55, 1], [890, 890, 610]),
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

export const TacticalFlankingProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 36], [0, 1], editorialEase);
  const fix = interpolate(frame, [34, 66], [0, 1], editorialEase);
  const flank = interpolate(frame, [54, 108], [0, 1], editorialEase);
  const turn = interpolate(frame, [84, 112], [0, 1], editorialEase);
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
            'radial-gradient(ellipse at 50% 52%, rgba(92,84,48,.34), transparent 62%), linear-gradient(125deg, #26271c, #14160f 55%, #222319)',
        }}
      >
        <svg viewBox="0 0 2000 1160" style={{position: 'absolute', inset: 0}}>
          <defs>
            <marker
              id="flanking-arrowhead"
              viewBox="0 0 44 40"
              refX="26"
              refY="20"
              markerWidth="52"
              markerHeight="48"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path
                d="M0 0 L44 20 L0 40 Z"
                fill="#d44f42"
                opacity={turn}
              />
            </marker>
          </defs>
          <g fill="none" stroke="#c0b78c" opacity=".1" strokeWidth="2">
            <path d="M-80 285 C240 120 405 405 705 230 S1140 350 1450 195 S1850 270 2110 115" />
            <path d="M-70 342 C230 180 410 470 720 285 S1160 415 1470 255 S1870 335 2120 175" />
            <path d="M-40 850 C280 670 480 940 810 725 S1290 885 1620 695 S1970 830 2160 680" />
          </g>
          <path
            d="M690 635 C850 600 1115 601 1250 635"
            fill="none"
            stroke="rgba(201,76,63,.28)"
            strokeWidth="25"
            strokeLinecap="round"
            opacity={fix}
          />
          <path
            d="M690 635 C850 600 1115 601 1250 635"
            fill="none"
            stroke="#c94c3f"
            strokeWidth="8"
            strokeLinecap="round"
            opacity={fix}
          />
          <path
            d="M872 1010 C1130 1042 1510 1000 1700 810 C1765 744 1764 656 1718 568"
            fill="none"
            stroke="rgba(185,67,55,.31)"
            strokeWidth="28"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - flank}
          />
          <path
            d="M872 1010 C1130 1042 1510 1000 1700 810 C1765 744 1764 656 1718 568"
            fill="none"
            stroke="#d44f42"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - flank}
            markerEnd="url(#flanking-arrowhead)"
          />
        </svg>

        <Formation side="left" color="#8f4e40" progress={establish} />
        <Formation side="right" color="#426d79" progress={establish} />
        <ForceLabel
          side="left"
          role="FIXING FORCE"
          label="MAIN BODY"
          strength="28,000"
          color="#d27660"
          progress={establish}
        />
        <ForceLabel
          side="right"
          role="DEFENDING LINE"
          label="POSITION"
          strength="24,000"
          color="#79aab7"
          progress={establish}
        />
        <Knight progress={flank} />

        <div
          style={{
            position: 'absolute',
            left: 840,
            top: 928,
            color: '#d86d60',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 4.5,
            opacity:
              interpolate(flank, [0.3, 0.72], [0, 1], editorialEase) *
              (1 - conclusion),
          }}
        >
          MOBILE WING
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
        TACTICAL RELATIONSHIP · FLANKING
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
        Hold the front. Turn the flank.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 130,
          right: 130,
          top: 846,
          color: '#eee3cf',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 48,
          fontStyle: 'italic',
          fontWeight: 500,
          textAlign: 'center',
          opacity: conclusion,
        }}
      >
        The front holds. The flank decides.
      </div>
    </AbsoluteFill>
  );
};
