import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const CAMPAIGN_CHRONOLOGY_DURATION = 240;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ease = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

type Point = readonly [number, number];

const events = [
  {
    phase: 'OPENING',
    place: 'RIDGE LINE',
    detail: 'The campaign enters contested ground',
    point: [332, 748] as Point,
    frame: 12,
  },
  {
    phase: 'FIRST CONTACT',
    place: 'MOUNTAIN PASS',
    detail: 'The advance meets the first defended position',
    point: [520, 555] as Point,
    frame: 60,
  },
  {
    phase: 'TURNING POINT',
    place: 'ROAD JUNCTION',
    detail: 'A captured crossing changes the direction of movement',
    point: [775, 625] as Point,
    frame: 108,
  },
  {
    phase: 'CAMPAIGN RESULT',
    place: 'LOWER VALLEY',
    detail: 'The route opens toward the operational objective',
    point: [1032, 402] as Point,
    frame: 156,
  },
] as const;

const segmentPaths = [
  'M 332 748 C 390 688 444 612 520 555',
  'M 520 555 C 598 505 690 590 775 625',
  'M 775 625 C 862 632 930 480 1012 422',
] as const;

const reveal = (frame: number, start: number, duration = 24) =>
  interpolate(frame, [start, start + duration], [0, 1], ease);

const Terrain: React.FC = () => (
  <svg
    viewBox="0 0 1280 1080"
    style={{position: 'absolute', inset: 0, width: 1280, height: 1080}}
  >
    <defs>
      <radialGradient id="chronology-field" cx="52%" cy="46%" r="75%">
        <stop offset="0" stopColor="#44402d" />
        <stop offset="0.58" stopColor="#25271d" />
        <stop offset="1" stopColor="#10110d" />
      </radialGradient>
      <filter id="chronology-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#000" floodOpacity=".58" />
      </filter>
    </defs>
    <rect width="1280" height="1080" fill="url(#chronology-field)" />
    <g fill="none" stroke="#d6caa4" strokeWidth="2" opacity=".115">
      <path d="M-80 174 C130 40 310 245 500 118 S835 222 1055 92 S1295 145 1380 35" />
      <path d="M-70 235 C145 105 325 305 520 180 S858 282 1076 155 S1310 210 1395 99" />
      <path d="M-65 300 C164 166 342 368 544 244 S884 344 1100 220 S1330 274 1410 165" />
      <path d="M-45 800 C160 668 345 874 553 748 S920 852 1155 698 S1330 716 1410 628" />
      <path d="M-35 866 C177 728 365 934 578 812 S950 914 1182 760 S1350 778 1420 690" />
      <path d="M148 -30 C236 145 130 290 225 450 S186 768 270 1110" />
      <path d="M1160 -40 C1098 176 1183 330 1115 490 S1110 820 1000 1120" />
    </g>
    <path
      d="M1050 -20 C996 182 1098 320 1028 485 S1025 800 920 1110"
      fill="none"
      stroke="#6d9290"
      strokeWidth="74"
      opacity=".1"
    />
    <path
      d="M1050 -20 C996 182 1098 320 1028 485 S1025 800 920 1110"
      fill="none"
      stroke="#96afaa"
      strokeWidth="3"
      opacity=".3"
    />
    <g opacity=".22" fill="#d6caa4">
      {[
        [205, 246], [288, 302], [440, 188], [650, 275], [1180, 285],
        [182, 886], [590, 874], [1120, 790], [888, 190],
      ].map(([x, y]) => (
        <React.Fragment key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="9" />
          <path d={`M ${x - 24} ${y + 18} Q ${x} ${y - 2} ${x + 24} ${y + 18}`} fill="none" stroke="#d6caa4" strokeWidth="3" />
        </React.Fragment>
      ))}
    </g>
  </svg>
);

const CampaignMap: React.FC<{frame: number}> = ({frame}) => {
  const activeIndex = Math.min(
    events.length - 1,
    Math.max(0, events.filter((event) => frame >= event.frame).length - 1),
  );
  const finalSummary = reveal(frame, 204, 20);

  return (
    <svg
      width="1280"
      height="1080"
      viewBox="0 0 1280 1080"
      style={{position: 'absolute', inset: 0, overflow: 'visible'}}
    >
      {segmentPaths.map((path, index) => {
        const progress = reveal(frame, events[index + 1].frame, 26);
        return (
          <path
            key={path}
            d={path}
            fill="none"
            stroke="#c89a47"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
            opacity={0.92}
          />
        );
      })}
      {events.map((event, index) => {
        const eventReveal = reveal(frame, event.frame, 16);
        const isActive = index === activeIndex && finalSummary < 0.5;
        const [x, y] = event.point;
        return (
          <g key={event.phase} opacity={eventReveal}>
            {isActive && (
              <circle cx={x} cy={y} r="42" fill="none" stroke="#c89a47" strokeWidth="3" opacity=".72" />
            )}
            <circle cx={x} cy={y} r="24" fill="#15150f" stroke={isActive ? '#e2c16f' : '#b9ae91'} strokeWidth="3" />
            <text x={x} y={y + 8} textAnchor="middle" fill={isActive ? '#e2c16f' : '#d4c8aa'} fontFamily={WC_EDITORIAL_SERIF} fontWeight="700" fontSize="25">
              {index + 1}
            </text>
            <text x={x} y={y + (index % 2 === 0 ? 70 : -55)} textAnchor="middle" fill="#dfd5ba" fontFamily={WC_EDITORIAL_SANS} fontWeight="700" fontSize="17" letterSpacing="3.2">
              {event.place}
            </text>
          </g>
        );
      })}
      <g transform="translate(234 850)" filter="url(#chronology-shadow)" opacity={reveal(frame, 4, 18)}>
        <circle r="46" fill="#161510" stroke="#e4d8ba" strokeWidth="2" />
        <text x="0" y="20" textAnchor="middle" fill="#d1a957" fontSize="68" fontFamily="Georgia, serif">♞</text>
      </g>
    </svg>
  );
};

const CopyPanel: React.FC<{frame: number}> = ({frame}) => {
  const finalSummary = reveal(frame, 204, 20);
  const currentIndex = Math.min(
    events.length - 1,
    Math.max(0, events.filter((event) => frame >= event.frame).length - 1),
  );
  const current = events[currentIndex];
  const currentOpacity = Math.min(
    reveal(frame, current.frame, 14),
    interpolate(frame, [current.frame + 37, current.frame + 47], [1, 0], clamp),
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 1280,
        top: 0,
        width: 640,
        height: 1080,
        background: 'linear-gradient(135deg, #191915 0%, #0e0f0c 100%)',
        boxSizing: 'border-box',
        padding: '98px 88px 86px 82px',
        color: '#eee4cc',
      }}
    >
      <div style={{fontFamily: WC_EDITORIAL_SANS, fontSize: 17, letterSpacing: 4.4, fontWeight: 700, color: '#c89a47'}}>
        CAMPAIGN CHRONOLOGY
      </div>
      <div style={{marginTop: 28, fontFamily: WC_EDITORIAL_SERIF, fontSize: 80, lineHeight: 0.95, fontWeight: 700, letterSpacing: -2.2}}>
        The route<br />unfolds.
      </div>
      <div style={{marginTop: 22, fontFamily: WC_EDITORIAL_SANS, color: '#aaa48f', fontSize: 19, lineHeight: 1.45, letterSpacing: 0.5}}>
        One verified event at a time.
      </div>

      <div style={{position: 'absolute', left: 82, right: 78, top: 535, bottom: 115}}>
        <div style={{position: 'absolute', inset: 0, opacity: currentOpacity * (1 - finalSummary)}}>
          <div style={{fontFamily: WC_EDITORIAL_SANS, color: '#c89a47', fontSize: 17, fontWeight: 700, letterSpacing: 4}}>
            {current.phase}
          </div>
          <div style={{marginTop: 22, fontFamily: WC_EDITORIAL_SERIF, fontSize: 60, lineHeight: 1.02, fontWeight: 700, letterSpacing: -1.2}}>
            {current.place}
          </div>
          <div style={{marginTop: 22, maxWidth: 430, fontFamily: WC_EDITORIAL_SANS, color: '#bcb39c', fontSize: 23, lineHeight: 1.4}}>
            {current.detail}
          </div>
        </div>

        <div style={{position: 'absolute', inset: 0, opacity: finalSummary}}>
          <div style={{fontFamily: WC_EDITORIAL_SANS, color: '#c89a47', fontSize: 17, fontWeight: 700, letterSpacing: 4}}>
            CAMPAIGN AT A GLANCE
          </div>
          <div style={{marginTop: 24, display: 'flex', flexDirection: 'column', gap: 21}}>
            {events.map((event, index) => (
              <div key={event.phase} style={{display: 'grid', gridTemplateColumns: '44px 1fr', gap: 15, alignItems: 'baseline'}}>
                <div style={{fontFamily: WC_EDITORIAL_SERIF, color: '#c89a47', fontWeight: 700, fontSize: 26}}>{index + 1}</div>
                <div>
                  <div style={{fontFamily: WC_EDITORIAL_SANS, color: '#e5dbc3', fontWeight: 700, fontSize: 19, letterSpacing: 2.4}}>{event.place}</div>
                  <div style={{marginTop: 4, fontFamily: WC_EDITORIAL_SANS, color: '#8f8b7d', fontSize: 16}}>{event.phase}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{position: 'absolute', right: 78, bottom: 42, fontFamily: WC_EDITORIAL_SANS, color: '#6f6d62', fontSize: 14, letterSpacing: 3}}>
        DESIGN PROOF
      </div>
    </div>
  );
};

export const CampaignChronologyProof: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: '#11120e', overflow: 'hidden'}}>
      <Terrain />
      <CampaignMap frame={frame} />
      <CopyPanel frame={frame} />
    </AbsoluteFill>
  );
};
