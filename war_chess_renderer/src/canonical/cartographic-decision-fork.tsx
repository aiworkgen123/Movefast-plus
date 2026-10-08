import {decisionCueState} from '../component-cue-state';
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

type Point = readonly [number, number];
type Route = {p0: Point; p1: Point; p2: Point; p3: Point};

const serif = "'Iowan Old Style', Iowan, Baskerville, Georgia, serif";
const sans = "'Gill Sans', 'Gill Sans MT', 'Helvetica Neue', Arial, sans-serif";

export type CartographicDecisionOption = {optionId: string; label: string};

export type CartographicDecisionForkProps = {
  title: string;
  options: readonly CartographicDecisionOption[];
  chosenOptionId: string;
  durationInFrames: number;
  chosenRevealFrame?: number;
};

export const WC10_CARTOGRAPHIC_ROUTES: readonly Route[] = [
  {p0: [263, 827], p1: [530, 500], p2: [1020, 170], p3: [1465, 248]},
  {p0: [263, 827], p1: [640, 780], p2: [1120, 420], p3: [1542, 564]},
  {p0: [263, 827], p1: [660, 970], p2: [1130, 820], p3: [1460, 792]},
  {p0: [263, 827], p1: [420, 380], p2: [720, 145], p3: [950, 184]},
] as const;

const labelSlots = [
  {left: 1454, top: 143, width: 390},
  {left: 1600, top: 500, width: 270},
  {left: 1496, top: 823, width: 370},
  {left: 1030, top: 94, width: 380},
] as const;

export const wc10PathFor = ({p0, p1, p2, p3}: Route) =>
  `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;

export const wc10CubicPoint = ({p0, p1, p2, p3}: Route, t: number): Point => {
  const u = 1 - t;
  return [
    u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0],
    u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1],
  ];
};

export const wc10CubicTangent = ({p0, p1, p2, p3}: Route, t: number): Point => {
  const u = 1 - t;
  return [
    3 * u ** 2 * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t ** 2 * (p3[0] - p2[0]),
    3 * u ** 2 * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t ** 2 * (p3[1] - p2[1]),
  ];
};

const displayLabel = (value: string) => value.length <= 46 ? value : `${value.slice(0, 45).trimEnd()}…`;

const MovingRoute: React.FC<{route: Route; progress: number; core: string}> = ({route, progress, core}) => {
  const casing = '#f2e7d4';
  const point = wc10CubicPoint(route, progress);
  const tangent = wc10CubicTangent(route, progress);
  const angle = Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI;
  return <g>
    <path d={wc10PathFor(route)} pathLength="1" fill="none" stroke={casing} strokeWidth="24" strokeLinecap="butt" strokeDasharray="1" strokeDashoffset={1 - progress}/>
    <path d={wc10PathFor(route)} pathLength="1" fill="none" stroke={core} strokeWidth="15" strokeLinecap="butt" strokeDasharray="1" strokeDashoffset={1 - progress}/>
    <g transform={`translate(${point[0]} ${point[1]}) rotate(${angle})`} opacity={interpolate(progress, [0, .025], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}>
      <path d="M-34 -16 C-10 -15 16 -10 34 0 C16 10 -10 15 -34 16 L-20 0 Z" fill={casing}/>
      <path d="M-31 -10 C-9 -10 12 -7 27 0 C12 7 -9 10 -31 10 L-18 0 Z" fill={core}/>
    </g>
  </g>;
};

const QuietRoute: React.FC<{route: Route; index: number}> = ({route, index}) => <path
  d={wc10PathFor(route)}
  fill="none"
  stroke="#62716e"
  strokeWidth="4"
  strokeLinecap="butt"
  strokeDasharray={index % 2 ? '14 12' : undefined}
  opacity=".62"
/>;

const MapBase: React.FC<{routeCount: number}> = ({routeCount}) => <>
  <rect width="1920" height="1080" fill="#728b90"/>
  <defs>
    <pattern id="wc10-map-grid" width="160" height="160" patternUnits="userSpaceOnUse"><path d="M160 0H0V160" fill="none" stroke="#5d6966" strokeWidth="1" opacity=".13"/></pattern>
    <pattern id="wc10-map-grain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".55" fill="#30332f" opacity=".07"/></pattern>
    <linearGradient id="wc10-map-land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6dcc8"/><stop offset=".56" stopColor="#cec4ae"/><stop offset="1" stopColor="#aaa490"/></linearGradient>
    <linearGradient id="wc10-map-relief" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff8e8" stopOpacity=".48"/><stop offset=".5" stopColor="#8f927e" stopOpacity=".16"/><stop offset="1" stopColor="#4f554d" stopOpacity=".28"/></linearGradient>
  </defs>
  <path d="M0 0 H1678 C1644 82 1685 151 1633 221 C1588 282 1637 356 1585 428 C1540 491 1585 563 1535 626 C1481 695 1533 757 1474 828 C1423 889 1451 978 1385 1080 H0Z" fill="url(#wc10-map-land)"/>
  <path d="M1678 0 C1644 82 1685 151 1633 221 C1588 282 1637 356 1585 428 C1540 491 1585 563 1535 626 C1481 695 1533 757 1474 828 C1423 889 1451 978 1385 1080" fill="none" stroke="#475b5f" strokeWidth="5"/>
  <path d="M1720 0 C1691 89 1725 170 1680 235 C1647 284 1688 359 1644 430 M1592 682 C1544 752 1578 824 1532 892 C1498 943 1512 1010 1472 1080" fill="none" stroke="#c2d1cf" strokeWidth="2" opacity=".45"/>
  <path d="M0 0 H1678 C1644 82 1685 151 1633 221 C1588 282 1637 356 1585 428 C1540 491 1585 563 1535 626 C1481 695 1533 757 1474 828 C1423 889 1451 978 1385 1080 H0Z" fill="url(#wc10-map-relief)"/>
  <path d="M0 0H1920V1080H0Z" fill="url(#wc10-map-grain)"/><path d="M0 0H1920V1080H0Z" fill="url(#wc10-map-grid)"/>
  <g fill="none" stroke="#667063" opacity=".42"><path d="M392 312 C485 221 676 205 788 294 C893 377 827 470 694 482 C563 494 424 433 379 361Z" strokeWidth="2.6"/><path d="M451 322 C521 260 646 254 720 310 C786 361 745 421 665 429 C583 437 496 400 463 359Z"/><path d="M1028 184 C1134 98 1325 132 1400 250 C1471 361 1369 450 1234 430 C1107 411 1004 318 995 241Z" strokeWidth="2.6"/><path d="M1087 207 C1160 155 1281 176 1330 249 C1372 312 1310 367 1229 354 C1150 342 1084 288 1073 241Z"/><path d="M936 696 C1045 614 1247 638 1328 762 C1402 876 1295 971 1142 956 C997 942 891 837 897 753Z" strokeWidth="2.6"/><path d="M1000 717 C1073 670 1204 686 1254 762 C1299 831 1231 893 1139 884 C1050 875 987 814 980 763Z"/></g>
  <g fill="none" stroke="#536f76" strokeLinecap="round"><path d="M735 0 C722 123 772 217 748 329 C724 440 649 501 683 615 C719 735 835 780 812 916 C802 980 768 1025 744 1080" strokeWidth="6"/><path d="M747 331 C864 338 932 391 1000 476" strokeWidth="3"/><path d="M684 615 C571 631 503 680 437 755" strokeWidth="3"/><path d="M1290 0 C1268 113 1303 197 1268 290 C1236 375 1148 443 1168 541 C1185 627 1260 682 1238 787 C1225 848 1191 895 1178 948" strokeWidth="5"/><path d="M1267 289 C1376 307 1450 356 1572 421" strokeWidth="2.8"/></g>
  <g fill="none" strokeLinejoin="round" strokeLinecap="round">{WC10_CARTOGRAPHIC_ROUTES.slice(0, routeCount).map((route, index) => <React.Fragment key={index}><path d={wc10PathFor(route)} stroke="#eee4d1" strokeWidth="12"/><path d={wc10PathFor(route)} stroke="#8d806d" strokeWidth="4"/></React.Fragment>)}</g>
  <path d="M846 82 C901 174 940 266 1005 349 C1067 429 1139 463 1206 549 C1276 639 1313 715 1378 803" fill="none" stroke="#6d716b" strokeWidth="3" strokeDasharray="14 12" opacity=".7"/>
  <g fill="#4d5550"><circle cx="263" cy="827" r="7"/><circle cx="742" cy="688" r="5"/><circle cx="1218" cy="519" r="5"/><circle cx="1465" cy="248" r="5"/><circle cx="1460" cy="792" r="5"/></g>
  <g fill="none" stroke="#666e68" strokeWidth="2"><path d="M390 989V921"/><path d="M390 921 l-11 22 h22Z" fill="#666e68"/><path d="M110 972H310"/><path d="M110 965V979M210 965V979M310 965V979"/></g>
  <g fill="#59615c" fontFamily={sans} fontSize="13"><text x="365" y="1012">N</text><text x="110" y="1005">0</text><text x="198" y="1005">10</text><text x="293" y="1005">20 KM</text></g>
</>;

export const CartographicDecisionFork: React.FC<CartographicDecisionForkProps> = ({title, options, chosenOptionId, durationInFrames, chosenRevealFrame}) => {
  const frame = useCurrentFrame();
  const {state, selected, stateStart, stateDuration} = decisionCueState(frame, durationInFrames, options.length, chosenRevealFrame);
  const chosenIndex = Math.max(0, options.findIndex((option) => option.optionId === chosenOptionId));
  const activeIndex = selected ? chosenIndex : state;
  const progress = interpolate(frame, [stateStart + stateDuration * .08, stateStart + stateDuration * .78], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  });
  const completed = selected
    ? options.map((_, index) => index).filter((index) => index !== chosenIndex)
    : options.map((_, index) => index).filter((index) => index < state);
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
      <MapBase routeCount={options.length}/>
      {completed.map((index) => <QuietRoute key={options[index].optionId} route={WC10_CARTOGRAPHIC_ROUTES[index]} index={index}/>)}
      <MovingRoute route={WC10_CARTOGRAPHIC_ROUTES[activeIndex]} progress={progress} core={activeIndex === chosenIndex ? '#9c332b' : '#566b69'}/>
    </svg>
    <div style={{position: 'absolute', left: 90, top: 62, width: 610, color: '#252725', fontFamily: serif, fontSize: title.length > 42 ? 48 : title.length > 28 ? 57 : 68, fontWeight: 600, lineHeight: .96, letterSpacing: -.5, maxHeight: 132, overflow: 'hidden'}}>{displayLabel(title)}</div>
    <div style={{position: 'absolute', left: 94, top: 225, color: selected ? '#9c332b' : '#566b69', fontFamily: sans, fontSize: 17, fontWeight: 600, letterSpacing: 2.7}}>{selected ? 'DECISION MADE' : `OPTION ${activeIndex + 1}`}</div>
    {options.map((option, index) => {
      const slot = labelSlots[index];
      const active = index === activeIndex;
      const label = displayLabel(option.label);
      const fontSize = label.length > 34 ? 22 : label.length > 24 ? 26 : active ? 35 : 29;
      return <div key={option.optionId} style={{position: 'absolute', ...slot, color: active ? '#4e514d' : '#69736f', fontFamily: serif, fontSize, fontWeight: 600, lineHeight: 1.04, opacity: active ? 1 : .78, maxHeight: 76, overflow: 'hidden'}}>
        {label}
        {selected && index === chosenIndex ? <div style={{marginTop: 9, color: '#9c332b', fontFamily: sans, fontSize: 15, fontWeight: 600, letterSpacing: 2.5}}>SELECTED ROUTE</div> : null}
      </div>;
    })}
  </AbsoluteFill>;
};
