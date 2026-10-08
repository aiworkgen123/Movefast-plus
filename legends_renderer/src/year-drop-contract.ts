import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E02: one oversized year (or short date token) falls from above the frame onto the centre of the footage. */
export type YearDropProps = Readonly<{year: string; media: FrameMedia}>;
export const yearDropTextLimits = {year: {minWords: 1, maxWords: 1, maxChars: 6}} as const;
export const yearDropDuration = {minSeconds: 2, maxSeconds: 8};
export const repairYearDrop = (input: unknown): YearDropProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const year = repairText(v.year, yearDropTextLimits.year), media = repairFrameMedia(v.media);
  return year && media ? {year, media} : null;
};
