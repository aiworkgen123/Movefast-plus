import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from 'remotion';

import {WC_EDITORIAL_SANS, WC_EDITORIAL_SERIF} from '../editorial-theme';

export const STRATEGIC_DECISION_FORK_DURATION = 210;

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const editorialEase = {
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const options = [
  {
    title: 'DIRECT ASSAULT',
    description: 'Commit force against the strongest point',
  },
  {
    title: 'TURN THE FLANK',
    description: 'Threaten the road behind the position',
  },
  {
    title: 'WIDE ENVELOPMENT',
    description: 'Trade time for a deeper turning movement',
  },
] as const;

/**
 * Three intentionally different approaches to the same objective. The proven
 * WC10 shaft/head construction is retained, while the control points give each
 * option its own battlefield geography.
 */
type Point = readonly [number, number];
type RouteSpec = {
  id: string;
  from: Point;
  segments: readonly {
    control1: Point;
    control2: Point;
    end?: Point;
  }[];
  tip: Point;
  color: string;
  customShaftPath?: (shaftEnd: Point) => string;
};

const arrowHeadLength = 44;
const arrowHeadHalfWidth = 24;
const arrowShaftWidth = 20;
const concealedOverlap = 3;

const makeRouteGeometry = (spec: RouteSpec) => {
  const terminal = spec.segments.at(-1);
  if (!terminal || spec.segments.slice(0, -1).some((segment) => !segment.end)) {
    throw new Error(`${spec.id} route has an invalid segment chain`);
  }
  const tangentX = spec.tip[0] - terminal.control2[0];
  const tangentY = spec.tip[1] - terminal.control2[1];
  const tangentLength = Math.hypot(tangentX, tangentY);
  if (tangentLength <= 0) throw new Error(`${spec.id} route has no terminal tangent`);
  const direction: Point = [tangentX / tangentLength, tangentY / tangentLength];
  const perpendicular: Point = [-direction[1], direction[0]];
  const base: Point = [
    spec.tip[0] - direction[0] * arrowHeadLength,
    spec.tip[1] - direction[1] * arrowHeadLength,
  ];
  const shaftEnd: Point = [
    spec.tip[0] - direction[0] * (arrowHeadLength - concealedOverlap),
    spec.tip[1] - direction[1] * (arrowHeadLength - concealedOverlap),
  ];
  const baseLeft: Point = [
    base[0] + perpendicular[0] * arrowHeadHalfWidth,
    base[1] + perpendicular[1] * arrowHeadHalfWidth,
  ];
  const baseRight: Point = [
    base[0] - perpendicular[0] * arrowHeadHalfWidth,
    base[1] - perpendicular[1] * arrowHeadHalfWidth,
  ];
  return {
    ...spec,
    shaftPath: spec.customShaftPath?.(shaftEnd) ??
      `M ${spec.from[0]} ${spec.from[1]} ${spec.segments.map((segment, index) => {
        const end = index === spec.segments.length - 1 ? shaftEnd : segment.end!;
        return `C ${segment.control1[0]} ${segment.control1[1]} ${segment.control2[0]} ${segment.control2[1]} ${end[0]} ${end[1]}`;
      }).join(' ')}`,
    headPath: `M ${spec.tip[0]} ${spec.tip[1]} L ${baseLeft[0]} ${baseLeft[1]} L ${baseRight[0]} ${baseRight[1]} Z`,
  };
};

const routeGeometries = [
  makeRouteGeometry({
    id: 'direct',
    from: [620, 730],
    segments: [{control1: [740, 665], control2: [875, 565]}],
    tip: [980, 500],
    color: '#b94b39',
  }),
  makeRouteGeometry({
    id: 'flank',
    from: [620, 730],
    segments: [{control1: [760, 500], control2: [900, 500]}],
    tip: [980, 500],
    color: '#d0a044',
    customShaftPath: (end) =>
      `M 620 730 L 620 600 Q 620 500 720 500 L ${end[0]} ${end[1]}`,
  }),
  makeRouteGeometry({
    id: 'wide',
    from: [620, 730],
    segments: [{control1: [860, 945], control2: [1245, 815]}],
    tip: [980, 500],
    color: '#81999a',
  }),
] as const;

const RouteArrow: React.FC<{
  geometry: (typeof routeGeometries)[number];
  opacity: number;
}> = ({geometry, opacity}) => (
  <g opacity={opacity}>
    <path
      d={geometry.shaftPath}
      fill="none"
      stroke={geometry.color}
      strokeWidth={arrowShaftWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d={geometry.headPath}
      fill={geometry.color}
      stroke={geometry.color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </g>
);

const Terrain: React.FC = () => (
  <svg
    viewBox="0 0 1450 1080"
    style={{position: 'absolute', inset: 0, width: 1450, height: 1080}}
  >
    <defs>
      <radialGradient id="decision-field" cx="53%" cy="48%" r="70%">
        <stop offset="0" stopColor="#403b28" />
        <stop offset="0.62" stopColor="#22231a" />
        <stop offset="1" stopColor="#11120e" />
      </radialGradient>
      <filter id="decision-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#000" floodOpacity=".55" />
      </filter>
    </defs>
    <rect width="1450" height="1080" fill="url(#decision-field)" />
    <g fill="none" stroke="#d2c69c" strokeWidth="2" opacity=".1">
      <path d="M-50 180 C190 65 405 235 600 130 S980 230 1190 115 S1460 160 1550 60" />
      <path d="M-70 238 C185 120 400 298 622 185 S1000 286 1215 170 S1470 212 1565 113" />
      <path d="M-60 800 C210 655 425 850 690 700 S1110 830 1500 650" />
      <path d="M-35 855 C240 712 450 905 715 758 S1140 890 1515 710" />
      <path d="M245 0 C330 190 210 335 298 500 S255 855 342 1080" />
    </g>
    <path
      d="M1060 -20 C995 185 1100 310 1034 473 S1035 786 920 1100"
      fill="none"
      stroke="#6b8a8a"
      strokeWidth="64"
      opacity=".12"
    />
    <path
      d="M1060 -20 C995 185 1100 310 1034 473 S1035 786 920 1100"
      fill="none"
      stroke="#8fa8a0"
      strokeWidth="3"
      opacity=".34"
    />
    <g opacity=".36" fill="#d7c99a">
      {[[380, 220], [460, 270], [1210, 290], [320, 790], [1190, 820], [800, 165]].map(([x, y], index) => (
        <React.Fragment key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={10 + (index % 2) * 3} />
          <path d={`M ${x - 23} ${y + 18} Q ${x} ${y - 1} ${x + 23} ${y + 18}`} fill="none" stroke="#d7c99a" strokeWidth="3" />
        </React.Fragment>
      ))}
    </g>
    <g transform="translate(576 702)" filter="url(#decision-shadow)">
      <circle r="48" fill="#171611" stroke="#e7dbc0" strokeWidth="2" />
      <text x="0" y="22" textAnchor="middle" fill="#d3b56e" fontSize="72" fontFamily="Georgia, serif">♞</text>
    </g>
    <g transform="translate(980 498)" filter="url(#decision-shadow)">
      <circle r="56" fill="#171611" stroke="#b94b39" strokeWidth="3" />
      <text x="0" y="25" textAnchor="middle" fill="#b94b39" fontSize="82" fontFamily="Georgia, serif">♜</text>
    </g>
    <text x="575" y="792" textAnchor="middle" fill="#d9cfae" fontFamily={WC_EDITORIAL_SANS} fontWeight="700" fontSize="17" letterSpacing="4">FIELD ARMY</text>
    <text x="980" y="596" textAnchor="middle" fill="#d9cfae" fontFamily={WC_EDITORIAL_SANS} fontWeight="700" fontSize="17" letterSpacing="4">OBJECTIVE</text>
  </svg>
);

const RouteLayer: React.FC<{activeIndex: number; selected: boolean; progress: number}> = ({
  activeIndex,
  selected,
  progress,
}) => (
  <svg
    width="1920"
    height="1080"
    viewBox="0 0 1920 1080"
    style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
  >
    {routeGeometries.map((geometry, index) => {
      const opacity = selected
        ? index === 1
          ? progress
          : 0.34 * progress
        : index === activeIndex
          ? progress
          : 0;
      return <RouteArrow key={geometry.id} geometry={geometry} opacity={opacity} />;
    })}
  </svg>
);

const DecisionCopy: React.FC<{
  activeIndex: number;
  selected: boolean;
  progress: number;
}> = ({activeIndex, selected, progress}) => {
  const option = options[selected ? 1 : activeIndex];
  const title = selected ? 'DECISION MADE' : option.title;
  const description = selected
    ? 'Turn the flank — threaten the road behind the position'
    : option.description;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1512,
        top: 242,
        width: 330,
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [16, 0], editorialEase)}px)`,
      }}
    >
      <div
        style={{
          color: selected ? '#d2ad61' : '#b94b39',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: 4.8,
        }}
      >
        {selected ? 'COMMANDER’S CHOICE' : 'COMMAND OPTION'}
      </div>
      <div
        style={{
          marginTop: 19,
          color: '#f0e5cf',
          fontFamily: WC_EDITORIAL_SERIF,
          fontSize: title.length > 15 ? 49 : 62,
          fontWeight: 700,
          letterSpacing: -1.5,
          lineHeight: 0.91,
          maxWidth: 325,
          overflowWrap: 'normal',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 30,
          color: '#c9bea6',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 23,
          fontWeight: 500,
          lineHeight: 1.36,
          letterSpacing: 0.25,
          maxWidth: 300,
        }}
      >
        {description}
      </div>
    </div>
  );
};

export const StrategicDecisionForkProof: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 8, 199, 209], [0, 1, 1, 0], clamp);
  const reviewFrame = Math.max(0, frame - 18);
  const selected = frame >= 154;
  const activeIndex = Math.min(2, Math.floor(reviewFrame / 44));
  const segmentStart = 18 + activeIndex * 44;
  const local = frame - segmentStart;
  const reviewOpacity = Math.min(
    interpolate(local, [0, 9], [0, 1], editorialEase),
    interpolate(local, [34, 43], [1, 0], clamp),
  );
  const selectedOpacity = interpolate(frame, [154, 170], [0, 1], editorialEase);
  const progress = selected ? selectedOpacity : reviewOpacity;
  const camera = interpolate(frame, [0, 200], [1.025, 1], editorialEase);

  return (
    <AbsoluteFill
      style={{
        background: '#11120e',
        color: '#f0e5cf',
        overflow: 'hidden',
        opacity: fade,
      }}
    >
      <div style={{position: 'absolute', inset: 0, scale: camera, transformOrigin: '46% 52%'}}>
        <Terrain />
        <RouteLayer activeIndex={activeIndex} selected={selected} progress={progress} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1450,
          top: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(110deg, rgba(17,18,14,.82), #11120e 22%)',
        }}
      />
      <DecisionCopy activeIndex={activeIndex} selected={selected} progress={progress} />
      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 76,
          color: '#c9bea6',
          fontFamily: WC_EDITORIAL_SANS,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 4.5,
          opacity: 0.72,
        }}
      >
        STRATEGIC DECISION FORK · DESIGN PROOF
      </div>
    </AbsoluteFill>
  );
};
