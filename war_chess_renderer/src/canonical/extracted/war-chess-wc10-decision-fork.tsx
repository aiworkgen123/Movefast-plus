import React, {useEffect, useRef} from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {WC10_V4_ARROW_GEOMETRIES, WC10V4Arrow} from './wc10-v4-arrow';

export const WC10_FRAMES = 330;
export const WC10_V7_ID = 'WC10_STRATEGIC_DECISION_FORK_V7_20260801';
export const WC10_V7_COMPOSITION_ID = 'WarChessWC10StrategicDecisionForkV7';
export const WC10_REVIEW_START_FRAME = 38;
export const WC10_DECISION_START_FRAME = 238;
export const WC10_DECISION_END_FRAME = 326;
export const WC10_FONT_PUBLIC_PATH = 'fonts/b41138c9373112f32abb589cc22e8674b06ed4048b0c513be922bdd26f274440.ttf';

export type WarChessWC10Option = {
  id: string;
  displayTitle: string;
  displayDescription: string;
};

export type WarChessWC10Props = {
  map: string;
  options: WarChessWC10Option[];
  chosenOption: string;
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const colors = {
  stage: '#242220',
  paper: '#eee7d9',
  gold: '#c69346',
  signal: '#a83c32',
  muted: '#a79c8b',
  line: '#675d52',
  dark: '#1b1714',
};

const asset = (path: string): string => staticFile(path);

const WC10FontStyles: React.FC = () => (
  <style>{`
    @font-face {
      font-family: 'WarChessLiterata';
      src: url('${staticFile(WC10_FONT_PUBLIC_PATH)}') format('truetype');
      font-style: normal;
      font-weight: 200 900;
      font-display: block;
    }
  `}</style>
);

/** Fail instead of silently changing typography when the bundled font is absent. */
const WC10FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const handle = useRef<number | null>(null);
  if (typeof document !== 'undefined' && handle.current === null) {
    handle.current = delayRender('WC10 Literata font verification');
  }

  useEffect(() => {
    if (typeof document === 'undefined' || handle.current === null) return;
    const renderHandle = handle.current;
    Promise.all([
      document.fonts.load('500 24px "WarChessLiterata"'),
      document.fonts.load('700 14px "WarChessLiterata"'),
    ])
      .then((faces) => {
        if (faces.some((row) => row.length === 0)) {
          cancelRender(new Error('WC10 Literata font load failed'));
          return;
        }
        continueRender(renderHandle);
      })
      .catch((error) => cancelRender(
        error instanceof Error ? error : new Error(String(error)),
      ));
  }, []);

  return <>{children}</>;
};

const Redoubt: React.FC<{opacity: number}> = ({opacity}) => (
  <g opacity={opacity} transform="translate(964 475)">
    <path d="M0 38 L18 0 L36 38 Z" fill={`${colors.signal}55`} stroke={colors.signal} strokeWidth="4" />
    <path d="M7 35h22M12 25h12" stroke={colors.paper} strokeWidth="3" strokeLinecap="round" />
  </g>
);

const Node: React.FC<{
  x: number;
  y: number;
  color: string;
  opacity?: number;
  size?: number;
}> = ({x, y, color, opacity = 1, size = 11}) => (
  <g opacity={opacity}>
    <circle cx={x} cy={y} r={size + 8} fill={`${color}35`} />
    <circle cx={x} cy={y} r={size} fill={color} stroke={colors.paper} strokeWidth="2" />
  </g>
);

const MapSurface: React.FC<{map: string}> = ({map}) => (
  <>
    <Img
      src={asset(map)}
      style={{
        position: 'absolute',
        left: 350,
        top: 200,
        width: 1220,
        height: 650,
        objectFit: 'cover',
        opacity: 0.84,
        filter: 'grayscale(.48) sepia(.14) contrast(1.02) brightness(.98) saturate(.92)',
        zIndex: 1,
      }}
    />
    <div style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, backgroundColor: colors.gold, opacity: 0.12, border: `1px solid ${colors.line}`, boxSizing: 'border-box', zIndex: 2}} />
    <div style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, backgroundColor: colors.dark, opacity: 0.08, boxSizing: 'border-box', zIndex: 2}} />
    <div style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, background: 'radial-gradient(ellipse at center, transparent 52%, rgba(23,19,15,.15) 100%)', zIndex: 2}} />
    <div style={{position: 'absolute', left: 350, top: 200, width: 1220, height: 650, border: '1px solid rgba(238,231,217,.22)', boxSizing: 'border-box', zIndex: 4}} />
  </>
);

export type WC10RouteVisualState = {
  solidOpacity: number;
  actionOpacity: number;
};

export type WC10PresentationState = {
  optionIndex: number;
  selected: boolean;
  railOpacity: number;
  routes: WC10RouteVisualState[];
};

/**
 * One code-owned schedule drives both the decision rail and map routes.
 * This prevents an option label from ever appearing with another option's
 * arrow. The final phase keeps only the chosen arrow active and leaves the
 * alternatives as faint context.
 */
export const getWC10PresentationState = (
  frame: number,
  optionCount: number,
  chosenIndex: number,
): WC10PresentationState => {
  if (!Number.isInteger(optionCount) || optionCount < 2 || optionCount > 4) {
    throw new Error('WC10 option count must be between two and four');
  }
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex >= optionCount) {
    throw new Error('WC10 chosen option index is invalid');
  }
  if (frame >= WC10_DECISION_START_FRAME) {
    const opacity = interpolate(
      frame,
      [WC10_DECISION_START_FRAME, WC10_DECISION_START_FRAME + 14],
      [0, 1],
      clamp,
    );
    return {
      optionIndex: chosenIndex,
      selected: true,
      railOpacity: opacity,
      routes: Array.from({length: optionCount}, (_, index) => ({
        solidOpacity: opacity * (index === chosenIndex ? 0.42 : 0.08),
        actionOpacity: index === chosenIndex ? opacity : 0,
      })),
    };
  }

  const span = (
    WC10_DECISION_START_FRAME - WC10_REVIEW_START_FRAME
  ) / optionCount;
  const optionIndex = Math.max(0, Math.min(
    optionCount - 1,
    Math.floor((Math.max(frame, WC10_REVIEW_START_FRAME) - WC10_REVIEW_START_FRAME) / span),
  ));
  const segmentStart = WC10_REVIEW_START_FRAME + optionIndex * span;
  const localFrame = frame - segmentStart;
  const opacity = Math.min(
    interpolate(localFrame, [0, 10], [0, 1], clamp),
    interpolate(localFrame, [span - 10, span], [1, 0], clamp),
  );
  return {
    optionIndex,
    selected: false,
    railOpacity: opacity,
    routes: Array.from({length: optionCount}, (_, index) => ({
      solidOpacity: index === optionIndex ? opacity * 0.42 : 0,
      actionOpacity: index === optionIndex ? opacity : 0,
    })),
  };
};

const SolidRoute: React.FC<{
  geometry: (typeof WC10_V4_ARROW_GEOMETRIES)[number];
  opacity: number;
}> = ({geometry, opacity}) => (
  <path
    d={geometry.shaftPath}
    fill="none"
    stroke={geometry.color}
    strokeWidth="8"
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={opacity}
  />
);

const TacticalSurface: React.FC<{
  frame: number;
  options: WarChessWC10Option[];
  chosenOption: string;
}> = ({frame, options, chosenOption}) => {
  const chosenIndex = options.findIndex((option) => option.id === chosenOption);
  const state = getWC10PresentationState(frame, options.length, chosenIndex);
  const routePresence = Math.max(...state.routes.map((route) => route.actionOpacity));

  return (
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, zIndex: 3, overflow: 'visible', pointerEvents: 'none'}}>
      {WC10_V4_ARROW_GEOMETRIES.slice(0, options.length).map((geometry, index) => (
        <React.Fragment key={geometry.id}>
          <SolidRoute geometry={geometry} opacity={state.routes[index].solidOpacity} />
          <WC10V4Arrow geometry={geometry} opacity={state.routes[index].actionOpacity} />
        </React.Fragment>
      ))}
      <Redoubt opacity={routePresence} />
      <Node x={964} y={500} color={colors.signal} opacity={routePresence} size={10} />
      {Array.from({length: Math.max(0, options.length - 1)}, (_, index) => (
        <Node key={index} x={1035 + index * 80} y={510} color={colors.gold} opacity={state.routes[index + 1].actionOpacity} size={9} />
      ))}
    </svg>
  );
};

const balancedTitleLines = (title: string): string[] => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return [words.join(' ')];
  let best = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(' ').length;
    const right = words.slice(index).join(' ').length;
    const difference = Math.abs(left - right);
    // Prefer the later split on a tie so short command phrases such as
    // “HOLD THE / LINE” keep their natural reading rhythm.
    if (difference <= bestDifference) {
      best = index;
      bestDifference = difference;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
};

const DecisionRail: React.FC<{frame: number; props: WarChessWC10Props}> = ({frame, props}) => {
  const chosenIndex = props.options.findIndex((option) => option.id === props.chosenOption);
  const state = getWC10PresentationState(frame, props.options.length, chosenIndex);
  const option = props.options[state.optionIndex];
  const lines = balancedTitleLines(option.displayTitle);
  return (
    <div
      style={{
        position: 'absolute',
        left: 1592,
        top: 184,
        width: 284,
        height: 682,
        boxSizing: 'border-box',
        padding: '72px 18px 42px 28px',
        borderLeft: `1px solid rgba(198,147,70,.58)`,
        borderTop: '1px solid rgba(167,156,139,.32)',
        borderBottom: '1px solid rgba(167,156,139,.2)',
        background: 'linear-gradient(180deg, rgba(27,23,20,.38), rgba(27,23,20,.12))',
        opacity: state.railOpacity,
        transform: `translateX(${interpolate(state.railOpacity, [0, 1], [10, 0], clamp)}px)`,
        zIndex: 7,
      }}
    >
      <div style={{position: 'absolute', left: 28, top: 34, width: 52, height: 2, backgroundColor: colors.signal}} />
      <div style={{fontFamily: 'WarChessLiterata', fontSize: 14, lineHeight: 1, fontWeight: 700, letterSpacing: 3.1, color: colors.signal}}>
        {state.selected ? 'SELECTED' : 'OPTION'}
      </div>
      <div
        style={{
          marginTop: 26,
          color: colors.paper,
          fontFamily: 'WarChessLiterata',
          fontSize: 44,
          lineHeight: 0.96,
          fontWeight: 500,
          letterSpacing: 1.05,
          width: 250,
          textTransform: 'uppercase',
          fontKerning: 'normal',
          overflowWrap: 'anywhere',
        }}
      >
        {lines.map((line, index) => (
          <React.Fragment key={`${line}-${index}`}>
            {index > 0 ? <br /> : null}
            <span style={{display: 'inline-block', whiteSpace: 'nowrap'}}>{line}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{marginTop: 34, width: 184, height: 1, backgroundColor: colors.gold, opacity: 0.74}} />
      <div
        style={{
          marginTop: 20,
          width: 236,
          color: colors.paper,
          fontFamily: 'WarChessLiterata',
          fontSize: 21,
          lineHeight: 1.34,
          fontWeight: 500,
          letterSpacing: 0.08,
          fontKerning: 'normal',
        }}
      >
        {option.displayDescription}
      </div>
    </div>
  );
};

export const WarChessWC10DecisionForkV7: React.FC<WarChessWC10Props> = (props) => {
  const frame = useCurrentFrame();
  return (
    <WC10FontGate>
      <AbsoluteFill style={{backgroundColor: colors.stage, color: colors.paper, overflow: 'hidden'}}>
        <WC10FontStyles />
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(154,110,60,.18), transparent 66%)'}} />
        <MapSurface map={props.map} />
        <TacticalSurface frame={frame} options={props.options} chosenOption={props.chosenOption} />
        <DecisionRail frame={frame} props={props} />
      </AbsoluteFill>
    </WC10FontGate>
  );
};
