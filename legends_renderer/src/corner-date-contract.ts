import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E01: a date with the year beneath it fades in at the top-left corner of the footage. */
export type CornerDateProps = Readonly<{date: string; year?: string; media: FrameMedia}>;
export const cornerDateTextLimits = {date: {minWords: 1, maxWords: 3, maxChars: 22}, year: {minWords: 1, maxWords: 1, maxChars: 6}} as const;
export const cornerDateDuration = {minSeconds: 1.5, maxSeconds: 10};
export const repairCornerDate = (input: unknown): CornerDateProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const date = repairText(v.date, cornerDateTextLimits.date), media = repairFrameMedia(v.media);
  if (!date || !media) return null;
  const year = repairText(v.year, cornerDateTextLimits.year);
  return {date, media, ...(year ? {year} : {})};
};
