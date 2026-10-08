import React from 'react';
import {WC10_APPROVED_ARROW_HEAD_HALF_WIDTH, WC10_APPROVED_ARROW_HEAD_LENGTH, WC10_APPROVED_ARROW_SHAFT_WIDTH, WC10_APPROVED_ARROW_SPECS, type WC10ApprovedArrowPoint, type WC10ApprovedArrowSpec} from './wc10-approved-arrow';

export type WC10V4ArrowGeometry = WC10ApprovedArrowSpec & {
  headLength: number;
  headHalfWidth: number;
  shaftWidth: number;
  concealedOverlap: number;
  headBase: WC10ApprovedArrowPoint;
  shaftEnd: WC10ApprovedArrowPoint;
  shaftPath: string;
  headPath: string;
};

// The owner-required fix is a controlled 3px concealed overlap. The shaft cap
// reaches behind the triangle base, while the filled head is rendered after it.
export const WC10_V4_CONCEALED_OVERLAP = 3;
export const WC10_V4_ARROW_LAYER_ORDER = ['shaft', 'filled-head'] as const;

const subtract = (point: WC10ApprovedArrowPoint, direction: WC10ApprovedArrowPoint, distance: number): WC10ApprovedArrowPoint => [point[0] - direction[0] * distance, point[1] - direction[1] * distance];
const distance = (a: WC10ApprovedArrowPoint, b: WC10ApprovedArrowPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const makeWC10V4ArrowGeometry = (spec: WC10ApprovedArrowSpec): WC10V4ArrowGeometry => {
  const tangentX = spec.tip[0] - spec.control[0];
  const tangentY = spec.tip[1] - spec.control[1];
  const tangentLength = Math.hypot(tangentX, tangentY);
  if (tangentLength <= 0) throw new Error(`WC10 v4 arrow ${spec.id} has no terminal tangent`);
  const direction: WC10ApprovedArrowPoint = [tangentX / tangentLength, tangentY / tangentLength];
  const headBase = subtract(spec.tip, direction, WC10_APPROVED_ARROW_HEAD_LENGTH);
  const shaftEnd = subtract(spec.tip, direction, WC10_APPROVED_ARROW_HEAD_LENGTH - WC10_V4_CONCEALED_OVERLAP);
  const perpendicular: WC10ApprovedArrowPoint = [-direction[1], direction[0]];
  const headBaseLeft: WC10ApprovedArrowPoint = [headBase[0] + perpendicular[0] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH, headBase[1] + perpendicular[1] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH];
  const headBaseRight: WC10ApprovedArrowPoint = [headBase[0] - perpendicular[0] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH, headBase[1] - perpendicular[1] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH];
  return {
    ...spec,
    headLength: WC10_APPROVED_ARROW_HEAD_LENGTH,
    headHalfWidth: WC10_APPROVED_ARROW_HEAD_HALF_WIDTH,
    shaftWidth: WC10_APPROVED_ARROW_SHAFT_WIDTH,
    concealedOverlap: WC10_V4_CONCEALED_OVERLAP,
    headBase,
    shaftEnd,
    shaftPath: `M ${spec.from[0]} ${spec.from[1]} Q ${spec.control[0]} ${spec.control[1]} ${shaftEnd[0]} ${shaftEnd[1]}`,
    headPath: `M ${spec.tip[0]} ${spec.tip[1]} L ${headBaseLeft[0]} ${headBaseLeft[1]} L ${headBaseRight[0]} ${headBaseRight[1]} Z`,
  };
};

export const assertWC10V4ArrowGeometry = (geometry: WC10V4ArrowGeometry): true => {
  const tipToBase = distance(geometry.tip, geometry.headBase);
  const tipToShaftEnd = distance(geometry.tip, geometry.shaftEnd);
  const overlap = geometry.headLength - tipToShaftEnd;
  const roundCapReach = geometry.shaftWidth / 2;
  const epsilon = 1e-6;
  if (Math.abs(tipToBase - geometry.headLength) > epsilon) throw new Error(`WC10 v4 ${geometry.id} head base offset is ${tipToBase}, expected ${geometry.headLength}`);
  if (Math.abs(overlap - geometry.concealedOverlap) > epsilon || overlap < 2 || overlap > 4) throw new Error(`WC10 v4 ${geometry.id} concealed overlap is ${overlap}, expected 2-4px`);
  if (tipToShaftEnd >= tipToBase) throw new Error(`WC10 v4 ${geometry.id} shaft does not extend under the triangle base`);
  if (tipToShaftEnd + roundCapReach <= tipToBase) throw new Error(`WC10 v4 ${geometry.id} shaft cap cannot cover the triangle base`);
  return true;
};

export const WC10_V4_ARROW_GEOMETRIES = WC10_APPROVED_ARROW_SPECS.map(makeWC10V4ArrowGeometry);
WC10_V4_ARROW_GEOMETRIES.forEach(assertWC10V4ArrowGeometry);

export const WC10V4Arrow: React.FC<{geometry: WC10V4ArrowGeometry; opacity: number}> = ({geometry, opacity}) => <g opacity={opacity}>
  <path d={geometry.shaftPath} fill="none" stroke={geometry.color} strokeWidth={WC10_APPROVED_ARROW_SHAFT_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
  <path d={geometry.headPath} fill={geometry.color} stroke={geometry.color} strokeWidth="2" strokeLinejoin="round" />
</g>;
