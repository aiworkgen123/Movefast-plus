import {repairText} from './contract.ts';
import {repairFrameMedia, type FrameMedia} from './frame-media-contract.ts';
/** E09: a short headline over footage; every letter drops into place, then the whole shot pulls back. */
export type DropHeadlineProps = Readonly<{text: string; media: FrameMedia; wordStarts?: readonly number[]}>;
export const dropHeadlineTextLimits = {text: {minWords: 1, maxWords: 8, maxChars: 48}} as const;
export const dropHeadlineDuration = {minSeconds: 3, maxSeconds: 10};
export const repairDropHeadline = (input: unknown): DropHeadlineProps | null => {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const text = repairText(v.text, dropHeadlineTextLimits.text), media = repairFrameMedia(v.media);
  if (!text || !media) return null;
  const n = text.split(/\s+/u).length, s = v.wordStarts;
  const ok = Array.isArray(s) && s.length === n && s.every((t, i) => typeof t === 'number' && Number.isFinite(t) && t >= 0 && (i === 0 || t >= (s[i - 1] as number)));
  return {text, media, ...(ok ? {wordStarts: s as number[]} : {})};
};
