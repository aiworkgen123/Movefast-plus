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

export const ARCHIVAL_CUTOUT_CONFRONTATION_DURATION = 150;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const Formation: React.FC<{
  color: string;
  side: 'left' | 'right';
  opacity: number;
}> = ({color, side, opacity}) => {
  const rows = [0, 1, 2];
  const figures = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? 100 : 1160,
        top: 402,
        width: 660,
        height: 360,
        opacity,
        scale: side === 'left' ? '1 1' : '-1 1',
        filter: 'drop-shadow(0 17px 18px rgba(0,0,0,.5))',
      }}
    >
      {rows.map((row) => (
        <div
          key={row}
          style={{
            position: 'absolute',
            left: row * 48,
            top: row * 78,
            display: 'flex',
            gap: 16,
            opacity: 1 - row * 0.22,
          }}
        >
          {figures.map((figure) => (
            <svg
              key={figure}
              width="70"
              height="170"
              viewBox="0 0 70 170"
              style={{overflow: 'visible'}}
            >
              <circle cx="34" cy="29" r="15" fill={color} />
              <path
                d="M21 49 C15 76 14 112 22 151 L47 151 C55 112 53 76 47 49 Z"
                fill={color}
              />
              <path d="M22 68 L4 119" stroke={color} strokeWidth="9" strokeLinecap="round" />
              <path d="M46 68 L60 118" stroke={color} strokeWidth="9" strokeLinecap="round" />
              <path d="M25 146 L18 171" stroke={color} strokeWidth="10" strokeLinecap="round" />
              <path d="M43 146 L51 171" stroke={color} strokeWidth="10" strokeLinecap="round" />
              <path d="M55 37 L67 151" stroke="#d6c09a" strokeWidth="3" opacity=".65" />
            </svg>
          ))}
        </div>
      ))}
    </div>
  );
};

const CoalitionPanel: React.FC<{
  side: 'left' | 'right';
  country: string;
  commander: string;
  strength: string;
  tint: string;
  establish: number;
  fracture: number;
}> = ({side, country, commander, strength, tint, establish, fracture}) => {
  const direction = side === 'left' ? -1 : 1;
  const movement = interpolate(fracture, [0, 1], [0, direction * 225]);
  const rotation = interpolate(fracture, [0, 1], [0, direction * 1.5]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: establish,
        translate: `${movement}px 0px`,
        rotate: `${rotation}deg`,
        transformOrigin: side === 'left' ? '0% 50%' : '100% 50%',
        clipPath:
          side === 'left'
            ? 'polygon(0 0, 57% 0, 48% 100%, 0 100%)'
            : 'polygon(43% 0, 100% 0, 100% 100%, 52% 100%)',
        background:
          side === 'left'
            ? `linear-gradient(100deg, ${tint}72 0%, ${tint}30 38%, transparent 68%)`
            : `linear-gradient(260deg, ${tint}72 0%, ${tint}30 38%, transparent 68%)`,
      }}
    >
      <Formation color={tint} side={side} opacity={0.45} />
      <div
        style={{
          position: 'absolute',
          left: side === 'left' ? 100 : undefined,
          right: side === 'right' ? 100 : undefined,
          top: 292,
          width: 630,
          textAlign: side,
          color: '#efe3cd',
        }}
      >
        <div
          style={{
            fontFamily: WC_EDITORIAL_SERIF,
            fontSize: 102,
            fontWeight: 700,
            letterSpacing: -2.5,
            lineHeight: 0.9,
            textShadow: '0 9px 30px rgba(0,0,0,.6)',
          }}
        >
          {country}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: WC_EDITORIAL_SANS,
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: 4.3,
            color: '#cdbfa7',
          }}
        >
          {`${commander} · ${strength}`}
        </div>
      </div>
    </div>
  );
};

export const ArchivalCutoutConfrontationProof: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 18], [0, 1], editorialEase);
  const establish = interpolate(frame, [10, 36], [0, 1], editorialEase);
  const fracture = interpolate(frame, [52, 91], [0, 1], editorialEase);
  const napoleon = interpolate(frame, [67, 111], [0, 1], editorialEase);
  const conclusion = interpolate(frame, [106, 129], [0, 1], editorialEase);
  const fade = interpolate(frame, [0, 7, 141, 149], [0, 1, 1, 0], clamp);
  const centerGlow = interpolate(fracture, [0, 0.65, 1], [0, 0.3, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        background: '#0c0b0a',
        color: '#efe3cd',
        overflow: 'hidden',
        opacity: fade,
      }}
    >
      <Audio src={staticFile('visual-lab/force-comparison/attack-the-seam.wav')} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 54%, rgba(129,42,30,.24), transparent 30%), radial-gradient(circle at 22% 52%, rgba(150,77,50,.17), transparent 40%), radial-gradient(circle at 78% 52%, rgba(55,91,103,.18), transparent 40%), linear-gradient(180deg, #171411, #090807)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            'repeating-linear-gradient(4deg, transparent 0 7px, rgba(255,255,255,.035) 8px), repeating-linear-gradient(91deg, transparent 0 20px, rgba(0,0,0,.18) 21px)',
          mixBlendMode: 'screen',
        }}
      />

      <CoalitionPanel
        side="left"
        country="AUSTRIA"
        commander="BEAULIEU"
        strength="30,000"
        tint="#a75845"
        establish={establish}
        fracture={fracture}
      />
      <CoalitionPanel
        side="right"
        country="PIEDMONT"
        commander="COLLI"
        strength="25,000"
        tint="#52798a"
        establish={establish}
        fracture={fracture}
      />

      <div
        style={{
          position: 'absolute',
          left: 795,
          top: 175,
          width: 330,
          height: 850,
          opacity: centerGlow,
          background:
            'radial-gradient(ellipse at 50% 60%, rgba(188,60,43,.32), transparent 56%)',
          filter: 'blur(28px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 810,
          top: 172,
          width: 300,
          height: 850,
          opacity: napoleon,
          translate: `0px ${interpolate(napoleon, [0, 1], [250, 18])}px`,
          scale: interpolate(napoleon, [0, 1], [0.76, 1.02]),
          filter: 'sepia(.28) contrast(1.08) drop-shadow(0 24px 26px rgba(0,0,0,.72))',
        }}
      >
        <Img
          src={staticFile(
            'visual-lab/historical-documents/napoleon-study-cutout-clean-v3-trimmed.png',
          )}
          style={{width: '100%', height: '100%', objectFit: 'contain'}}
        />
      </div>

      <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <path
          d="M961 1030 C929 851 988 697 959 520 C949 457 945 405 964 345"
          fill="none"
          stroke="#b84033"
          strokeWidth="13"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - napoleon}
          opacity={napoleon}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 58,
          color: '#bba98d',
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
          top: 103,
          color: '#efe3cd',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: -1.7,
          lineHeight: 0.95,
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
          top: 239,
          textAlign: 'center',
          color: '#c8b99f',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 4.8,
          opacity: establish * (1 - fracture),
        }}
      >
        55,000 · ONE CONNECTED MASS
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 235,
          textAlign: 'center',
          color: '#cb4a3d',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: 5.3,
          opacity: interpolate(fracture, [0.45, 0.8], [0, 1], clamp),
        }}
      >
        THE SEAM OPENS
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 55,
          textAlign: 'center',
          color: '#efe3cd',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: 50,
          fontStyle: 'italic',
          textShadow: '0 6px 22px rgba(0,0,0,.8)',
          opacity: conclusion,
          translate: `0px ${interpolate(conclusion, [0, 1], [18, 0])}px`,
        }}
      >
        He attacks the space between them.
      </div>
    </AbsoluteFill>
  );
};
