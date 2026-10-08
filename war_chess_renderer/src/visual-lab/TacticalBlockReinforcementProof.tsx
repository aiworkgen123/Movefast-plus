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
import {TacticalForceIdentity, TacticalPawn} from './TacticalCommandTableProof';

export const TACTICAL_BLOCK_REINFORCEMENT_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const PawnGroup: React.FC<{
  side: 'left' | 'right';
  color: string;
  opacity: number;
  advance: number;
}> = ({side, color, opacity, advance}) => {
  const positions = [
    [95, 0, 70],
    [200, 8, 70],
    [305, 0, 70],
    [40, 91, 78],
    [152, 103, 78],
    [264, 93, 78],
    [376, 102, 78],
    [95, 203, 86],
    [215, 213, 86],
    [335, 203, 86],
  ] as const;
  const baseX = side === 'left' ? 215 : 1240;
  const travel = side === 'right' ? interpolate(advance, [0, 0.63, 1], [130, -70, -42]) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: baseX,
        top: 490,
        width: 500,
        height: 380,
        opacity,
        translate: `${travel}px 0px`,
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`${side}-${index}`}
          markerId={`block-${side}-${index}`}
          x={x}
          y={y}
          size={size}
          color={color}
          opacity={1 - index * 0.027}
        />
      ))}
    </div>
  );
};

const Rook: React.FC<{progress: number}> = ({progress}) => (
  <div
    style={{
      position: 'absolute',
      left: 858,
      top: interpolate(progress, [0, 1], [1050, 584]),
      width: 210,
      height: 280,
      opacity: progress,
      scale: interpolate(progress, [0, 1], [0.78, 1]),
      filter: 'drop-shadow(0 20px 15px rgba(0,0,0,.68))',
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 180 250">
      <defs>
        <linearGradient id="block-rook" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e16c5d" />
          <stop offset="0.3" stopColor="#b94337" />
          <stop offset="0.76" stopColor="#8c2d25" />
          <stop offset="1" stopColor="#3a1210" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="235" rx="66" ry="11" fill="rgba(0,0,0,.4)" />
      <path d="M35 18 H59 V42 H78 V18 H102 V42 H121 V18 H145 V75 H35 Z" fill="url(#block-rook)" />
      <path d="M49 72 H131 L122 160 H58 Z" fill="url(#block-rook)" />
      <path d="M49 156 H131 L148 192 H32 Z" fill="url(#block-rook)" />
      <path d="M25 190 H155 L166 224 H14 Z" fill="url(#block-rook)" />
      <path d="M44 31 H56" stroke="rgba(255,255,255,.26)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  </div>
);

export const TacticalBlockReinforcementProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 35], [0, 1], editorialEase);
  const advance = interpolate(frame, [32, 81], [0, 1], editorialEase);
  const intercept = interpolate(frame, [59, 105], [0, 1], editorialEase);
  const blocked = interpolate(frame, [77, 105], [0, 1], editorialEase);
  const conclusion = interpolate(frame, [107, 129], [0, 1], editorialEase);
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
          <g fill="none" stroke="#c0b78c" opacity=".1" strokeWidth="2">
            <path d="M-80 285 C240 120 405 405 705 230 S1140 350 1450 195 S1850 270 2110 115" />
            <path d="M-70 342 C230 180 410 470 720 285 S1160 415 1470 255 S1870 335 2120 175" />
            <path d="M-40 850 C280 670 480 940 810 725 S1290 885 1620 695 S1970 830 2160 680" />
          </g>
          <path
            d="M655 516 C860 469 1090 470 1335 515"
            fill="none"
            stroke="rgba(223,210,165,.28)"
            strokeWidth="17"
            strokeLinecap="round"
            opacity={establish}
          />
          <path
            d="M655 516 C860 469 1090 470 1335 515"
            fill="none"
            stroke="#d0c79b"
            strokeWidth="5"
            strokeDasharray="22 15"
            strokeLinecap="round"
            opacity={establish}
          />
          <path
            d="M825 505 C890 488 1034 488 1100 505"
            fill="none"
            stroke="#c94c3f"
            strokeWidth="18"
            strokeLinecap="round"
            opacity={blocked}
          />
        </svg>

        <PawnGroup side="left" color="#8f4e40" opacity={establish} advance={advance} />
        <PawnGroup side="right" color="#426d79" opacity={establish} advance={advance} />
        <TacticalForceIdentity
          side="left"
          country="MAIN FORCE"
          commander="DEFENDING POSITION"
          strength="30,000"
          color="#d27660"
          establish={establish}
          fracture={0}
        />
        <TacticalForceIdentity
          side="right"
          country="RELIEF FORCE"
          commander="REINFORCEMENTS"
          strength="18,000"
          color="#79aab7"
          establish={establish}
          fracture={0}
        />
        <Rook progress={interpolate(intercept, [0.22, 0.85], [0, 1], editorialEase)} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 898,
            textAlign: 'center',
            opacity: interpolate(intercept, [0.55, 0.92], [0, 1], editorialEase),
          }}
        >
          <div
            style={{
              color: '#d86d60',
              fontFamily: WC_EDITORIAL_SANS,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 4.5,
            }}
          >
            INTERCEPTING FORCE
          </div>
          <div
            style={{
              marginTop: 7,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            The road is closed.
          </div>
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
        TACTICAL RELATIONSHIP · REINFORCEMENT
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
          translate: `0px ${interpolate(intro, [0, 1], [18, 0])}px`,
        }}
      >
        Help is on the way.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 264,
          textAlign: 'center',
          color: '#c7b994',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 4.8,
          opacity: establish * (1 - blocked),
        }}
      >
        RELIEF ROUTE OPEN
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 262,
          textAlign: 'center',
          color: '#d45245',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: 5.2,
          opacity: blocked,
        }}
      >
        RELIEF ROUTE BLOCKED
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 46,
          textAlign: 'center',
          color: '#eee3cf',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 49,
          fontStyle: 'italic',
          textShadow: '0 6px 22px rgba(0,0,0,.8)',
          opacity: conclusion,
          translate: `0px ${interpolate(conclusion, [0, 1], [18, 0])}px`,
        }}
      >
        He closes the road before the armies can combine.
      </div>
    </AbsoluteFill>
  );
};
