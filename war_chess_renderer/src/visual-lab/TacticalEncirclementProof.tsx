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

export const TACTICAL_ENCIRCLEMENT_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const DefenderFormation: React.FC<{progress: number; pressure: number}> = ({
  progress,
  pressure,
}) => {
  const positions = [
    [80, 0, 70],
    [190, 0, 70],
    [300, 0, 70],
    [25, 94, 78],
    [135, 104, 78],
    [245, 104, 78],
    [355, 94, 78],
    [80, 205, 86],
    [190, 215, 86],
    [300, 205, 86],
  ] as const;

  return (
    <div
      style={{
        position: 'absolute',
        left: 735,
        top: 454,
        width: 470,
        height: 380,
        opacity: progress,
        scale: interpolate(pressure, [0, 1], [1, 0.9]),
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`encircled-${index}`}
          markerId={`encircled-${index}`}
          x={x}
          y={y}
          size={size}
          color="#426d79"
          opacity={1 - index * 0.025}
        />
      ))}
    </div>
  );
};

const Wing: React.FC<{
  side: 'left' | 'right';
  progress: number;
}> = ({side, progress}) => {
  const left = side === 'left' ? 360 : 1345;
  const travelX = side === 'left' ? 145 : -145;
  const travelY = -52;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 650,
        width: 230,
        height: 300,
        opacity: progress,
        translate: `${interpolate(progress, [0, 1], [0, travelX])}px ${interpolate(
          progress,
          [0, 1],
          [0, travelY],
        )}px`,
        scale: interpolate(progress, [0, 1], [0.84, 1]),
        filter: 'drop-shadow(0 20px 16px rgba(0,0,0,.68))',
      }}
    >
      <div
        style={{
          color: '#b94337',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 225,
          lineHeight: 1,
          textAlign: 'center',
          textShadow: '0 3px 0 #e07163',
        }}
      >
        ♞
      </div>
    </div>
  );
};

export const TacticalEncirclementProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 36], [0, 1], editorialEase);
  const sweep = interpolate(frame, [40, 92], [0, 1], editorialEase);
  const close = interpolate(frame, [72, 108], [0, 1], editorialEase);
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
            'radial-gradient(ellipse at 50% 54%, rgba(92,84,48,.34), transparent 61%), linear-gradient(125deg, #26271c, #14160f 55%, #222319)',
        }}
      >
        <svg viewBox="0 0 2000 1160" style={{position: 'absolute', inset: 0}}>
          <g fill="none" stroke="#c0b78c" opacity=".1" strokeWidth="2">
            <path d="M-80 285 C240 120 405 405 705 230 S1140 350 1450 195 S1850 270 2110 115" />
            <path d="M-70 342 C230 180 410 470 720 285 S1160 415 1470 255 S1870 335 2120 175" />
            <path d="M-40 850 C280 670 480 940 810 725 S1290 885 1620 695 S1970 830 2160 680" />
          </g>
          <path
            d="M560 835 C585 615 682 446 820 384"
            fill="none"
            stroke="rgba(185,67,55,.3)"
            strokeWidth="27"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - sweep}
          />
          <path
            d="M1440 835 C1415 615 1318 446 1180 384"
            fill="none"
            stroke="rgba(185,67,55,.3)"
            strokeWidth="27"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - sweep}
          />
          <path
            d="M560 835 C585 615 682 446 820 384"
            fill="none"
            stroke="#c94c3f"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - sweep}
          />
          <path
            d="M1440 835 C1415 615 1318 446 1180 384"
            fill="none"
            stroke="#c94c3f"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - sweep}
          />
          <ellipse
            cx="1000"
            cy="650"
            rx={interpolate(close, [0, 1], [335, 278])}
            ry={interpolate(close, [0, 1], [270, 225])}
            fill="none"
            stroke="#d44f42"
            strokeWidth="9"
            strokeDasharray="28 18"
            opacity={close}
          />
        </svg>

        <DefenderFormation progress={establish} pressure={close} />
        <Wing side="left" progress={sweep} />
        <Wing side="right" progress={sweep} />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 302,
            textAlign: 'center',
            opacity: establish,
          }}
        >
          <div
            style={{
              color: '#79aab7',
              fontFamily: WC_EDITORIAL_SANS,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 4.5,
            }}
          >
            ISOLATED FORCE
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            22,000
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 292,
            right: 292,
            top: 920,
            display: 'flex',
            justifyContent: 'space-between',
            opacity: interpolate(sweep, [0.35, 0.78], [0, 1], editorialEase),
            color: '#d86d60',
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 4.5,
          }}
        >
          <span>LEFT WING</span>
          <span>RIGHT WING</span>
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
        TACTICAL RELATIONSHIP · ENCIRCLEMENT
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
        The wings close in.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 130,
          right: 130,
          bottom: 50,
          color: '#eee3cf',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 48,
          fontStyle: 'italic',
          fontWeight: 500,
          textAlign: 'center',
          opacity: conclusion,
        }}
      >
        Two wings become one closed trap.
      </div>
    </AbsoluteFill>
  );
};
