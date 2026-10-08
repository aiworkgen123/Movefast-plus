import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {StageLook} from './skins.ts';

/** The charts' backdrop: a soft radial vignette (E35-E37) or a flat fill (E39). */
export const ChartBackground: React.FC<{look: StageLook; flat?: boolean}> = ({look, flat}) => <AbsoluteFill style={{background: flat
  ? look.chart.flat : `radial-gradient(ellipse farthest-corner at 50% 50%, ${look.chart.bgInner} 45%, ${look.chart.bgOuter} 100%)`}} />;

// Line-height 1: cap ink sits this far below the box top (Montserrat 0.1555 em, Open Sans 0.174 em).
const capOffset = {heavy: 0.1555, sans: 0.174} as const;
export type ChartFont = keyof typeof capOffset;

/** One line of text placed by its cap top (slant: an oblique angle in degrees, about the cap top), anchored at x (start / middle / end), in 1920x1080 units. */
export const ChartText: React.FC<{look: StageLook; font: ChartFont; size: number; weight: number; x: number; capTop: number; anchor: 'start' | 'middle' | 'end';
  opacity?: number; rotate?: boolean; color?: string; tracking?: number; slant?: number; shadow?: string; children: React.ReactNode}> = ({look, font, size, weight, x, capTop, anchor, opacity = 1, rotate, color, tracking = 0, slant = 0, shadow, children}) => {
  const shift = anchor === 'start' ? '0%' : anchor === 'middle' ? '-50%' : '-100%';
  // Rotated text (the vertical axis title) turns -90 degrees about (x, capTop), which then marks its centre line.
  return <div style={{position: 'absolute', left: x, top: capTop - capOffset[font] * size, fontFamily: look[font].family, fontWeight: weight, fontSize: size,
    lineHeight: 1, whiteSpace: 'pre', letterSpacing: `${tracking}em`, color: color ?? look.chart.ink, opacity, textShadow: shadow, transformOrigin: `0 ${capOffset[font] * size}px`,
    transform: rotate ? `rotate(-90deg) translateX(${shift})` : `translateX(${shift})${slant ? ` skewX(${-slant}deg)` : ''}`}}>{children}</div>;
};

/** Gridlines sweep in from the left while fading: a point at x is fully shown `fade` seconds after the sweep (left->right in
 * `draw` seconds, starting at `start`) passes it (E35/E36). Returns a <mask> for the grid group. */
export const SweepMask: React.FC<{id: string; left: number; right: number; t: number; start: number; draw: number; fade: number}> = ({id, left, right, t, start, draw, fade}) => {
  const v = (right - left) / draw, front = left + v * (t - start);
  return <defs>
    <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={front - v * fade} x2={front} y1={0} y2={0}>
      <stop offset={0} stopColor="white" /><stop offset={1} stopColor="black" />
    </linearGradient>
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}><rect width={1920} height={1080} fill={`url(#${id}-g)`} /></mask>
  </defs>;
};
