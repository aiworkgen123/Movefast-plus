import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E03: a large centred date fades in, the year fades in under it, then a yellow bar sweeps in behind the date. */
export type DateHighlightProps = Readonly<{date: string; year?: string; media: FrameMedia}>;
export const dateHighlightTextLimits = {date: {minWords: 1, maxWords: 3, maxChars: 16}, year: {minWords: 1, maxWords: 1, maxChars: 6}} as const;
export const dateHighlightDuration = {minSeconds: 3.5, maxSeconds: 10};
export const repairDateHighlight = (input: unknown): DateHighlightProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const date = repairText(v.date, dateHighlightTextLimits.date), media = repairFrameMedia(v.media);
  if (!date || !media) return null;
  const year = repairText(v.year, dateHighlightTextLimits.year);
  return {date, media, ...(year ? {year} : {})};
};
