import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TacticalArrowSpec} from './production-contracts';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const ARROW_COLORS = {
  red: '#C73E36',
  blue: '#2878C8',
} as const;

const px = (point: readonly [number, number], width: number, height: number): [number, number] => [
  point[0] * width,
  point[1] * height,
];

type Point = readonly [number, number];
const distance = (a: Point, b: Point): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

const quadraticPoint = (a: Point, b: Point, c: Point, t: number): Point => {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
  ];
};

const samplePath = (start: Point, control: Point | undefined, end: Point) => {
  const points: Point[] = [];
  const cumulative = [0];
  const samples = 160;
  for (let index = 0; index <= samples; index += 1) {
    const amount = index / samples;
    points.push(control
      ? quadraticPoint(start, control, end, amount)
      : [
        start[0] + (end[0] - start[0]) * amount,
        start[1] + (end[1] - start[1]) * amount,
      ]);
    if (index > 0) cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
  }
  return {points, cumulative, total: cumulative[cumulative.length - 1]};
};

const pointAtDistance = (points: Point[], cumulative: number[], requested: number): Point => {
  const target = Math.max(0, Math.min(requested, cumulative[cumulative.length - 1]));
  let index = 1;
  while (index < cumulative.length && cumulative[index] < target) index += 1;
  if (index >= cumulative.length) return points[points.length - 1];
  const segment = Math.max(0.0001, cumulative[index] - cumulative[index - 1]);
  const amount = (target - cumulative[index - 1]) / segment;
  return [
    points[index - 1][0] + (points[index][0] - points[index - 1][0]) * amount,
    points[index - 1][1] + (points[index][1] - points[index - 1][1]) * amount,
  ];
};

const pathToDistance = (points: Point[], cumulative: number[], requested: number): string => {
  const target = Math.max(0, Math.min(requested, cumulative[cumulative.length - 1]));
  const visible: Point[] = [points[0]];
  for (let index = 1; index < points.length && cumulative[index] < target; index += 1) visible.push(points[index]);
  visible.push(pointAtDistance(points, cumulative, target));
  return visible.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
};

const arrowHeadPath = (
  tip: readonly [number, number],
  base: readonly [number, number],
  width: number,
): string => {
  const size = Math.max(0.0001, distance(base, tip));
  const direction: Point = [(tip[0] - base[0]) / size, (tip[1] - base[1]) / size];
  const perpendicular: Point = [-direction[1], direction[0]];
  const halfWidth = width / 2;
  const left: [number, number] = [base[0] + perpendicular[0] * halfWidth, base[1] + perpendicular[1] * halfWidth];
  const right: [number, number] = [base[0] - perpendicular[0] * halfWidth, base[1] - perpendicular[1] * halfWidth];
  return `M ${tip[0]} ${tip[1]} L ${left[0]} ${left[1]} L ${right[0]} ${right[1]} Z`;
};

export type WarChessTacticalArrowProps = {
  arrow: TacticalArrowSpec;
  treatment?: 'wc04_premium';
};

/**
 * The production arrow vocabulary is deliberately small: only E movement/
 * flank and F encirclement/sweep reach this primitive.  The shaft stops at
 * the live head base measured along the same sampled path, so the shaft and
 * head cannot separate, overlap, or leave a trailing line while drawing.
 */
export const WarChessTacticalArrow: React.FC<WarChessTacticalArrowProps> = ({arrow, treatment}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const premium = treatment === 'wc04_premium';
  const progress = interpolate(
    frame,
    [arrow.drawStartFrame, arrow.drawEndFrameExclusive],
    [0, 1],
    {...clamp, easing: premium ? Easing.linear : Easing.bezier(0.18, 0.84, 0.22, 1)},
  );
  const start = px(arrow.start, width, height);
  const end = px(arrow.end, width, height);
  const control = arrow.control ? px(arrow.control, width, height) : undefined;
  const sampled = samplePath(start, control, end);
  const tipDistance = sampled.total * progress;
  const headBaseDistance = Math.max(0, tipDistance - arrow.headLength);
  const casingBaseDistance = Math.max(0, tipDistance - arrow.headLength - 10);
  const tip = pointAtDistance(sampled.points, sampled.cumulative, tipDistance);
  const headBase = pointAtDistance(sampled.points, sampled.cumulative, headBaseDistance);
  const casingBase = pointAtDistance(sampled.points, sampled.cumulative, casingBaseDistance);
  const shaft = pathToDistance(sampled.points, sampled.cumulative, headBaseDistance);
  const casingShaft = pathToDistance(sampled.points, sampled.cumulative, casingBaseDistance);
  const meaningfulDistance = Math.max(arrow.headLength * 0.65, arrow.shaftWidth * 1.8);
  const opacity = interpolate(tipDistance, [meaningfulDistance, meaningfulDistance + 8], [0, 1], clamp);
  const color = premium ? '#8B302C' : ARROW_COLORS[arrow.palette];
  const casing = '#F4EBDD';
  const head = arrowHeadPath(tip, headBase, arrow.headWidth);
  const casingHead = arrowHeadPath(tip, casingBase, arrow.headWidth + 12);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}
    >
      {premium && <path
        d={casingShaft}
        fill="none"
        stroke={casing}
        strokeWidth={arrow.shaftWidth + 10}
        strokeLinecap={arrow.shaftCap === 'round' ? 'round' : 'square'}
        strokeLinejoin="round"
        opacity={opacity}
      />}
      <path
        d={shaft}
        fill="none"
        stroke={color}
        strokeWidth={arrow.shaftWidth}
        strokeLinecap={arrow.shaftCap === 'round' ? 'round' : 'square'}
        strokeLinejoin="round"
        opacity={opacity}
      />
      {premium && <path
        d={casingHead}
        fill={casing}
        stroke={casing}
        strokeWidth={arrow.headStyle === 'softened' ? Math.min(3, (arrow.headWidth + 12) / 10) : 0}
        strokeLinejoin={arrow.headStyle === 'softened' ? 'round' : 'miter'}
        opacity={opacity}
      />}
      <path
        d={head}
        fill={color}
        stroke={color}
        strokeWidth={arrow.headStyle === 'softened' ? Math.min(3, arrow.headWidth / 10) : 0}
        strokeLinejoin={arrow.headStyle === 'softened' ? 'round' : 'miter'}
        opacity={opacity}
      />
    </svg>
  );
};
