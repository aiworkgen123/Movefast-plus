import React from 'react';

export type WC10ApprovedArrowPoint = readonly [number, number];

export type WC10ApprovedArrowSpec = {
  id: 'safe' | 'laharpe' | 'massena' | 'augereau';
  from: WC10ApprovedArrowPoint;
  control: WC10ApprovedArrowPoint;
  tip: WC10ApprovedArrowPoint;
  color: string;
};

export type WC10ApprovedArrowGeometry = WC10ApprovedArrowSpec & {
  headLength: number;
  headHalfWidth: number;
  shaftWidth: number;
  shaftClearance: number;
  headBase: WC10ApprovedArrowPoint;
  shaftEnd: WC10ApprovedArrowPoint;
  shaftPath: string;
  headPath: string;
};

// These dimensions and stroke treatments are shared with the owner-approved
// WarChessMapRankedPiecesV2 arrow language (see
// src/candidate-library/war-chess-map-ranked-pieces-v2.tsx): solid, smooth,
// rounded shafts and large filled triangle heads with clean endpoint termination.
export const WC10_APPROVED_ARROW_HEAD_LENGTH = 44;
export const WC10_APPROVED_ARROW_HEAD_HALF_WIDTH = 24;
export const WC10_APPROVED_ARROW_SHAFT_WIDTH = 20;
export const WC10_APPROVED_ARROW_SHAFT_CLEARANCE = WC10_APPROVED_ARROW_SHAFT_WIDTH / 2;

export const WC10_APPROVED_ARROW_SPECS: readonly WC10ApprovedArrowSpec[] = [
  {id: 'safe', from: [620, 730], control: [760, 585], tip: [964, 500], color: '#a83c32'},
  {id: 'laharpe', from: [620, 730], control: [790, 615], tip: [950, 515], color: '#a83c32'},
  {id: 'massena', from: [620, 730], control: [850, 390], tip: [1025, 515], color: '#c69346'},
  {id: 'augereau', from: [620, 730], control: [1010, 315], tip: [1105, 505], color: '#c69346'},
];

const subtract = (point: WC10ApprovedArrowPoint, direction: WC10ApprovedArrowPoint, distance: number): WC10ApprovedArrowPoint => [point[0] - direction[0] * distance, point[1] - direction[1] * distance];
const distance = (a: WC10ApprovedArrowPoint, b: WC10ApprovedArrowPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const makeWC10ApprovedArrowGeometry = (spec: WC10ApprovedArrowSpec): WC10ApprovedArrowGeometry => {
  const tangentX = spec.tip[0] - spec.control[0];
  const tangentY = spec.tip[1] - spec.control[1];
  const tangentLength = Math.hypot(tangentX, tangentY);
  if (tangentLength <= 0) throw new Error(`WC10 approved arrow ${spec.id} has no terminal tangent`);
  const direction: WC10ApprovedArrowPoint = [tangentX / tangentLength, tangentY / tangentLength];
  const headBase = subtract(spec.tip, direction, WC10_APPROVED_ARROW_HEAD_LENGTH);
  // The rounded cap reaches the head base exactly; no shaft is hidden under the head.
  const shaftEnd = subtract(spec.tip, direction, WC10_APPROVED_ARROW_HEAD_LENGTH + WC10_APPROVED_ARROW_SHAFT_CLEARANCE);
  const perpendicular: WC10ApprovedArrowPoint = [-direction[1], direction[0]];
  const headBaseLeft: WC10ApprovedArrowPoint = [headBase[0] + perpendicular[0] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH, headBase[1] + perpendicular[1] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH];
  const headBaseRight: WC10ApprovedArrowPoint = [headBase[0] - perpendicular[0] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH, headBase[1] - perpendicular[1] * WC10_APPROVED_ARROW_HEAD_HALF_WIDTH];
  return {
    ...spec,
    headLength: WC10_APPROVED_ARROW_HEAD_LENGTH,
    headHalfWidth: WC10_APPROVED_ARROW_HEAD_HALF_WIDTH,
    shaftWidth: WC10_APPROVED_ARROW_SHAFT_WIDTH,
    shaftClearance: WC10_APPROVED_ARROW_SHAFT_CLEARANCE,
    headBase,
    shaftEnd,
    shaftPath: `M ${spec.from[0]} ${spec.from[1]} Q ${spec.control[0]} ${spec.control[1]} ${shaftEnd[0]} ${shaftEnd[1]}`,
    headPath: `M ${spec.tip[0]} ${spec.tip[1]} L ${headBaseLeft[0]} ${headBaseLeft[1]} L ${headBaseRight[0]} ${headBaseRight[1]} Z`,
  };
};

export const assertWC10ApprovedArrowGeometry = (geometry: WC10ApprovedArrowGeometry): true => {
  const tipToBase = distance(geometry.tip, geometry.headBase);
  const tipToShaftEnd = distance(geometry.tip, geometry.shaftEnd);
  const expectedShaftOffset = geometry.headLength + geometry.shaftClearance;
  const roundCapReach = geometry.shaftWidth / 2;
  const epsilon = 1e-6;
  if (Math.abs(tipToBase - geometry.headLength) > epsilon) throw new Error(`WC10 approved ${geometry.id} head base offset is ${tipToBase}, expected ${geometry.headLength}`);
  if (Math.abs(tipToShaftEnd - expectedShaftOffset) > epsilon) throw new Error(`WC10 approved ${geometry.id} shaft endpoint offset is not deterministic`);
  if (Math.abs((tipToShaftEnd - roundCapReach) - tipToBase) > epsilon) throw new Error(`WC10 approved ${geometry.id} shaft cap does not meet the head base without a gap`);
  return true;
};

export const WC10_APPROVED_ARROW_GEOMETRIES = WC10_APPROVED_ARROW_SPECS.map(makeWC10ApprovedArrowGeometry);
WC10_APPROVED_ARROW_GEOMETRIES.forEach(assertWC10ApprovedArrowGeometry);

export const WC10ApprovedArrow: React.FC<{geometry: WC10ApprovedArrowGeometry; opacity: number}> = ({geometry, opacity}) => <g opacity={opacity}>
  <path d={geometry.shaftPath} fill="none" stroke={geometry.color} strokeWidth={WC10_APPROVED_ARROW_SHAFT_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
  <path d={geometry.headPath} fill={geometry.color} stroke={geometry.color} strokeWidth="2" strokeLinejoin="round" />
</g>;
