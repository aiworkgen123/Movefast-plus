import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {FrameContext} from './contract.ts';
import {FrameMediaView} from './frame-media.tsx';
import type {FrameMedia} from './frame-media-contract.ts';
/** A luminance colour grade: each output channel = gain × average(R,G,B); lift (0-1) is added to red only. */
export type Grade = Readonly<{r: number; g: number; b: number; lift: number}>;
export const gradeFromColour = (hex: string, lift = 0): Grade => {
  const n = parseInt(hex.slice(1), 16);
  return {r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255, lift};
};
export const mixGrade = (a: Grade, b: Grade, t: number): Grade => ({r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, lift: a.lift + (b.lift - a.lift) * t});
const matrix = (g: Grade) => [g.r, g.r, g.r, g.g, g.g, g.g, g.b, g.b, g.b].map((v) => (v / 3).toFixed(4));
/** Media drawn through a grade. Without `grade` the picture is shown untouched. */
export const GradedMedia: React.FC<{media: FrameMedia; context: FrameContext; grade?: Grade; id: string; mask?: string}> = ({media, context, grade, id, mask}) => {
  const m = grade ? matrix(grade) : null, l = grade ? grade.lift.toFixed(4) : '0';
  return <AbsoluteFill style={{maskImage: mask, WebkitMaskImage: mask}}>
    {m ? <svg width="0" height="0" style={{position: 'absolute'}}><filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix"
      values={`${m[0]} ${m[1]} ${m[2]} 0 ${l}  ${m[3]} ${m[4]} ${m[5]} 0 0  ${m[6]} ${m[7]} ${m[8]} 0 0  0 0 0 1 0`} /></filter></svg> : null}
    <AbsoluteFill style={{filter: m ? `url(#${id})` : undefined}}><FrameMediaView media={media} context={context} fit="cover" /></AbsoluteFill>
  </AbsoluteFill>;
};
