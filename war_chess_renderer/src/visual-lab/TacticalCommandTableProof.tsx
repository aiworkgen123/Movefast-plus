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

export const TACTICAL_COMMAND_TABLE_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

export const TacticalPawn: React.FC<{
  markerId: string;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
}> = ({markerId, x, y, size, color, opacity}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size * 1.36,
      opacity,
      filter: 'drop-shadow(0 15px 10px rgba(0,0,0,.5))',
    }}
  >
    <svg width="100%" height="100%" viewBox="0 0 100 136">
      <defs>
        <linearGradient id={markerId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9c69b" />
          <stop offset="0.22" stopColor={color} />
          <stop offset="0.72" stopColor={color} />
          <stop offset="1" stopColor="#17140e" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="126" rx="38" ry="8" fill="rgba(0,0,0,.34)" />
      <circle cx="50" cy="24" r="20" fill={`url(#${markerId})`} />
      <path
        d="M35 42 C38 59 35 72 26 86 L74 86 C65 72 62 59 65 42 Z"
        fill={`url(#${markerId})`}
      />
      <path d="M24 84 L76 84 L84 105 L16 105 Z" fill={`url(#${markerId})`} />
      <path d="M12 105 L88 105 L94 122 L6 122 Z" fill={`url(#${markerId})`} />
      <path
        d="M34 18 C41 10 55 7 64 16"
        fill="none"
        stroke="rgba(255,255,255,.22)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

const PawnFormation: React.FC<{
  side: 'left' | 'right';
  color: string;
  establish: number;
  fracture: number;
}> = ({side, color, establish, fracture}) => {
  const direction = side === 'left' ? -1 : 1;
  const baseX = side === 'left' ? 235 : 1200;
  const positions = [
    [120, 0, 70],
    [225, 8, 70],
    [330, 0, 70],
    [62, 92, 78],
    [174, 104, 78],
    [286, 94, 78],
    [398, 103, 78],
    [119, 204, 86],
    [239, 214, 86],
    [359, 204, 86],
  ] as const;
  const shift = interpolate(fracture, [0, 1], [0, direction * 118]);

  return (
    <div
      style={{
        position: 'absolute',
        left: baseX,
        top: 480,
        width: 520,
        height: 390,
        opacity: establish,
        translate: `${shift}px ${interpolate(fracture, [0, 1], [0, 12])}px`,
        rotate: `${interpolate(fracture, [0, 1], [0, direction * 1.2])}deg`,
      }}
    >
      {positions.map(([x, y, size], index) => (
        <TacticalPawn
          key={`${x}-${y}`}
          markerId={`pawn-${side}-${index}`}
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

export const TacticalForceIdentity: React.FC<{
  side: 'left' | 'right';
  country: string;
  commander: string;
  strength: string;
  color: string;
  establish: number;
  fracture: number;
}> = ({side, country, commander, strength, color, establish, fracture}) => {
  const direction = side === 'left' ? -1 : 1;
  const shift = interpolate(fracture, [0, 1], [0, direction * 100]);
  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? 182 : undefined,
        right: side === 'right' ? 182 : undefined,
        top: 300,
        width: 590,
        opacity: establish,
        translate: `${shift}px 0px`,
        textAlign: side,
        color: '#eee3cf',
        textShadow: '0 8px 24px rgba(0,0,0,.62)',
      }}
    >
      <div
        style={{
          color,
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: 4.6,
        }}
      >
        {commander}
      </div>
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          flexDirection: side === 'left' ? 'row' : 'row-reverse',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 30,
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: -1.5,
            whiteSpace: 'nowrap',
          }}
        >
          {country}
        </div>
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 57,
            fontWeight: 700,
          }}
        >
          {strength}
        </div>
      </div>
    </div>
  );
};

const KnightMarker: React.FC<{progress: number}> = ({progress}) => (
  <div
    style={{
      position: 'absolute',
      left: 844,
      top: interpolate(progress, [0, 1], [1040, 677]),
      width: 230,
      height: 260,
      opacity: progress,
      scale: interpolate(progress, [0, 1], [0.78, 1]),
      color: '#b94337',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: 235,
      lineHeight: 1,
      textAlign: 'center',
      textShadow: '0 18px 18px rgba(0,0,0,.7), 0 2px 0 #e07163',
    }}
  >
    ♞
  </div>
);

export const TacticalCommandTableProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [11, 36], [0, 1], editorialEase);
  const fracture = interpolate(frame, [55, 91], [0, 1], editorialEase);
  const drive = interpolate(frame, [60, 112], [0, 1], editorialEase);
  const conclusion = interpolate(frame, [107, 129], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 7, 141, 149], [0, 1, 1, 0], clamp);
  const camera = interpolate(frame, [42, 137], [1, 1.025], editorialEase);
  const broken = interpolate(fracture, [0.3, 0.66], [0, 1], clamp);

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
          scale: camera,
          transformOrigin: '50% 56%',
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
            d="M714 492 C845 444 1085 449 1216 497"
            fill="none"
            stroke="rgba(223,210,165,.27)"
            strokeWidth="17"
            strokeLinecap="round"
            opacity={establish * (1 - broken)}
          />
          <path
            d="M714 492 C845 444 1085 449 1216 497"
            fill="none"
            stroke="#d0c79b"
            strokeWidth="5"
            strokeDasharray="22 15"
            strokeLinecap="round"
            opacity={establish * (1 - broken)}
          />
          <path
            d="M714 492 C790 465 829 456 867 456 M1054 459 C1100 464 1138 478 1216 497"
            fill="none"
            stroke="#d0c79b"
            strokeWidth="5"
            strokeDasharray="22 15"
            opacity={broken}
          />
          <path
            d="M965 1130 C951 920 997 790 967 626 C954 556 947 504 967 445"
            fill="none"
            stroke="rgba(61,14,11,.5)"
            strokeWidth="29"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - drive}
          />
          <path
            d="M965 1130 C951 920 997 790 967 626 C954 556 947 504 967 445"
            fill="none"
            stroke="#b94337"
            strokeWidth="14"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - drive}
          />
        </svg>

        <PawnFormation side="left" color="#8f4e40" establish={establish} fracture={fracture} />
        <PawnFormation side="right" color="#426d79" establish={establish} fracture={fracture} />
        <TacticalForceIdentity
          side="left"
          country="AUSTRIA"
          commander="BEAULIEU"
          strength="30,000"
          color="#d27660"
          establish={establish}
          fracture={fracture}
        />
        <TacticalForceIdentity
          side="right"
          country="PIEDMONT"
          commander="COLLI"
          strength="25,000"
          color="#79aab7"
          establish={establish}
          fracture={fracture}
        />
        <KnightMarker progress={interpolate(drive, [0.28, 0.88], [0, 1], editorialEase)} />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 905,
            textAlign: 'center',
            opacity: interpolate(drive, [0.5, 0.9], [0, 1], editorialEase),
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
            BONAPARTE · ARMY OF ITALY
          </div>
          <div
            style={{
              marginTop: 7,
              fontFamily: WC_EDITORIAL_SERIF,
              fontSize: 49,
              fontWeight: 700,
            }}
          >
            38,000
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
        ITALIAN CAMPAIGN · MARCH 1796
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
        Outnumbered on paper.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 265,
          textAlign: 'center',
          color: '#c7b994',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 4.8,
          opacity: establish * (1 - fracture),
        }}
      >
        55,000 · MUTUAL SUPPORT
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 263,
          textAlign: 'center',
          color: '#d45245',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: 5.2,
          opacity: interpolate(fracture, [0.48, 0.8], [0, 1], clamp),
        }}
      >
        SUPPORT LINE BROKEN
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
          fontSize: 50,
          fontStyle: 'italic',
          textShadow: '0 6px 22px rgba(0,0,0,.8)',
          opacity: conclusion,
          translate: `0px ${interpolate(conclusion, [0, 1], [18, 0])}px`,
        }}
      >
        He attacks the seam.
      </div>
    </AbsoluteFill>
  );
};
