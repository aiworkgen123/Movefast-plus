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

export const TACTICAL_BREAKTHROUGH_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const DefensiveHalf: React.FC<{
  side: 'left' | 'right';
  establish: number;
  breach: number;
}> = ({side, establish, breach}) => {
  const positions = [
    [0, 0, 72],
    [110, 0, 72],
    [220, 0, 72],
    [28, 105, 82],
    [138, 105, 82],
    [248, 105, 82],
  ] as const;

  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? 610 : 960,
        top: 500,
        width: 350,
        height: 250,
        opacity: establish,
        translate: `${interpolate(
          breach,
          [0, 1],
          [0, side === 'left' ? -138 : 138],
        )}px 0px`,
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`${side}-${index}`}
          markerId={`breakthrough-${side}-${index}`}
          x={x}
          y={y}
          size={size}
          color="#426d79"
          opacity={1 - index * 0.03}
        />
      ))}
    </div>
  );
};

const AssaultRook: React.FC<{progress: number}> = ({progress}) => (
  <div
    style={{
      position: 'absolute',
      left: 855,
      top: interpolate(progress, [0, 1], [1010, 570]),
      width: 210,
      height: 280,
      opacity: progress,
      scale: interpolate(progress, [0, 1], [0.78, 1]),
      filter: 'drop-shadow(0 20px 15px rgba(0,0,0,.68))',
      zIndex: 2,
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 180 250">
      <defs>
        <linearGradient id="breakthrough-rook" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e16c5d" />
          <stop offset="0.3" stopColor="#b94337" />
          <stop offset="0.76" stopColor="#8c2d25" />
          <stop offset="1" stopColor="#3a1210" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="235" rx="66" ry="11" fill="rgba(0,0,0,.4)" />
      <path d="M35 18 H59 V42 H78 V18 H102 V42 H121 V18 H145 V75 H35 Z" fill="url(#breakthrough-rook)" />
      <path d="M49 72 H131 L122 160 H58 Z" fill="url(#breakthrough-rook)" />
      <path d="M49 156 H131 L148 192 H32 Z" fill="url(#breakthrough-rook)" />
      <path d="M25 190 H155 L166 224 H14 Z" fill="url(#breakthrough-rook)" />
      <path d="M44 31 H56" stroke="rgba(255,255,255,.26)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  </div>
);

export const TacticalBreakthroughProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 36], [0, 1], editorialEase);
  const pressure = interpolate(frame, [38, 74], [0, 1], editorialEase);
  const breach = interpolate(frame, [62, 101], [0, 1], editorialEase);
  const advance = interpolate(frame, [69, 112], [0, 1], editorialEase);
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
            d="M610 740 C820 705 1178 705 1390 740"
            fill="none"
            stroke="rgba(121,170,183,.24)"
            strokeWidth="18"
            strokeLinecap="round"
            opacity={establish * (1 - breach)}
          />
          <path
            d="M610 740 C820 705 1178 705 1390 740"
            fill="none"
            stroke="#79aab7"
            strokeWidth="5"
            strokeDasharray="22 15"
            strokeLinecap="round"
            opacity={establish * (1 - breach)}
          />
          <path
            d="M610 740 C720 718 790 713 850 713 M1150 713 C1215 713 1285 718 1390 740"
            fill="none"
            stroke="#79aab7"
            strokeWidth="5"
            strokeDasharray="22 15"
            opacity={breach}
          />
          <ellipse
            cx="1000"
            cy="755"
            rx={interpolate(pressure, [0, 1], [26, 88])}
            ry="18"
            fill="rgba(201,76,63,.22)"
            opacity={pressure * (1 - breach)}
          />
        </svg>

        <DefensiveHalf side="left" establish={establish} breach={breach} />
        <DefensiveHalf side="right" establish={establish} breach={breach} />
        <AssaultRook progress={advance} />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 304,
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
            DEFENSIVE LINE
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 56,
              fontWeight: 700,
            }}
          >
            26,000
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 900,
            textAlign: 'center',
            opacity:
              interpolate(advance, [0.3, 0.78], [0, 1], editorialEase) *
              (1 - conclusion),
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
            ASSAULT COLUMN
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
        TACTICAL RELATIONSHIP · BREAKTHROUGH
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
        Break the center.
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
        Once the center breaks, the position opens.
      </div>
    </AbsoluteFill>
  );
};
